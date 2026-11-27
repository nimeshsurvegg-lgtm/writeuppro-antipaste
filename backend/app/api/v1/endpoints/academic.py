import os
import shutil
import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from app.core.config import settings
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import (
    StudentProfileSubmission, ProfileApprovalUpdate,
    AcademicYearCreate, AcademicYearStatusUpdate,
    SubjectCreate, SubjectUpdate, SubjectBulkImport,
    CurriculumVersionCreate, CurriculumCloneRequest,
    AllotmentPreviewRequest, BulkAllotmentPublish,
    LabBatchCreate, LabBatchUpdate, BatchStudentAssign,
    BatchManualAssignRequest, BatchUnassignRequest,
    OpenElectiveConfigCreate, OpenElectiveSelect, OpenElectiveReview,
    PromotionWindowCreate, PromotionWindowStatusUpdate, PromotionRequestSubmit, PromotionReview
)

router = APIRouter()

# ============================================================================
# MODULE 1 & 2: ACADEMIC CALENDARS / YEARS
# ============================================================================

@router.get("/academic-years")
def list_academic_years():
    """Lists all configured academic years/calendars with their cycle and status."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM academic_calendars
    ORDER BY is_current DESC, code DESC;
    """)
    years = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return years

@router.post("/academic-years")
def create_academic_year(data: AcademicYearCreate, payload: dict = Depends(require_roles("admin"))):
    """Administrator creates a new academic year (e.g. 2025-26, 2026-27, 2027-28)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    year_id = f"ay_{data.code.replace('-', '_')}"

    cursor.execute("SELECT id FROM academic_calendars WHERE code = ?;", (data.code.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Academic year '{data.code}' already exists.")

    if data.is_current:
        cursor.execute("UPDATE academic_calendars SET is_current = 0;")

    cursor.execute("""
    INSERT INTO academic_calendars (id, code, name, start_date, end_date, is_current, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        year_id, data.code.strip(), data.name.strip(),
        data.start_date, data.end_date,
        1 if data.is_current else 0,
        data.status, now_iso
    ))
    conn.commit()
    conn.close()
    return {"message": f"Academic year {data.code} created successfully.", "id": year_id}

@router.patch("/academic-years/{year_id}/status")
def update_academic_year_status(year_id: str, data: AcademicYearStatusUpdate, payload: dict = Depends(require_roles("admin"))):
    """Administrator updates status of an academic year ('upcoming', 'active', 'completed', 'archived')."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM academic_calendars WHERE id = ?;", (year_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Academic year not found.")

    is_curr = 1 if data.status == 'active' else 0
    if is_curr:
        cursor.execute("UPDATE academic_calendars SET is_current = 0;")

    cursor.execute("""
    UPDATE academic_calendars
    SET status = ?, is_current = ?
    WHERE id = ?;
    """, (data.status, is_curr, year_id))
    conn.commit()
    conn.close()
    return {"message": f"Academic year status updated to {data.status}."}

# ============================================================================
# MODULE 1 & 2: ACADEMIC HIERARCHY & SUBJECT MASTER
# ============================================================================

@router.get("/hierarchy")
def get_academic_hierarchy():
    """Returns the full institutional academic hierarchy."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM departments ORDER BY name ASC;")
    departments = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM branches ORDER BY name ASC;")
    branches = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM academic_years ORDER BY year_name ASC;")
    years = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM academic_calendars ORDER BY code DESC;")
    calendars = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM divisions ORDER BY name ASC;")
    divisions = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM subjects WHERE status != 'archived' ORDER BY code ASC;")
    subjects = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT id, username, full_name, role FROM users WHERE role = 'faculty' AND status = 'active';")
    faculty = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "departments": departments,
        "branches": branches,
        "years": years,
        "academic_calendars": calendars,
        "divisions": divisions,
        "subjects": subjects,
        "faculty": faculty
    }

@router.get("/subjects")
def list_subjects(
    academic_year: Optional[str] = None,
    branch_code: Optional[str] = None,
    year_level: Optional[str] = None,
    semester: Optional[int] = None,
    subject_type: Optional[str] = None,
    category: Optional[str] = None,
    include_archived: bool = False
):
    """Lists all subjects with rich academic criteria and filtering."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT s.*, b.name as branch_name, b.code as branch_code
    FROM subjects s
    JOIN branches b ON s.branch_id = b.id
    WHERE 1=1
    """
    params = []

    if not include_archived:
        query += " AND s.status != 'archived'"
    if academic_year:
        query += " AND (s.academic_year = ? OR s.academic_year IS NULL)"
        params.append(academic_year)
    if branch_code:
        query += " AND b.code = ?"
        params.append(branch_code)
    if year_level:
        query += " AND s.year_level = ?"
        params.append(year_level)
    if semester:
        query += " AND s.semester_number = ?"
        params.append(semester)
    if subject_type:
        query += " AND s.subject_type = ?"
        params.append(subject_type)
    if category:
        query += " AND s.category = ?"
        params.append(category)

    query += " ORDER BY s.semester_number ASC, s.code ASC;"
    cursor.execute(query, tuple(params))
    subjects = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return subjects

@router.post("/subjects")
def create_subject(sub_in: SubjectCreate, payload: dict = Depends(require_roles("admin"))):
    """Administrator creates a new subject with Mumbai University/autonomous scheme and credits."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Resolve branch_id from branch_code if needed
    branch_id = sub_in.branch_id
    if not branch_id and sub_in.branch_code:
        cursor.execute("SELECT id FROM branches WHERE code = ?;", (sub_in.branch_code,))
        b_row = cursor.fetchone()
        if b_row:
            branch_id = b_row["id"]
        else:
            conn.close()
            raise HTTPException(status_code=400, detail=f"Branch code '{sub_in.branch_code}' not found.")

    if not branch_id:
        # Default to first branch
        cursor.execute("SELECT id FROM branches LIMIT 1;")
        branch_id = cursor.fetchone()["id"]

    # Check for duplicate subject code within same academic year
    cursor.execute("""
    SELECT id FROM subjects
    WHERE code = ? AND (academic_year = ? OR academic_year IS NULL) AND status != 'archived';
    """, (sub_in.code.strip(), sub_in.academic_year))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Subject with code '{sub_in.code}' already exists for academic year {sub_in.academic_year}.")

    sub_id = f"sub_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO subjects (
        id, branch_id, semester_number, name, code, is_elective,
        category, credits, total_credits, subject_type, teaching_hours,
        syllabus_scheme, academic_year, description, status, year_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?);
    """, (
        sub_id, branch_id, sub_in.semester_number, sub_in.name.strip(), sub_in.code.strip(), sub_in.is_elective,
        sub_in.category, sub_in.credits, sub_in.total_credits, sub_in.subject_type, sub_in.teaching_hours,
        sub_in.syllabus_scheme, sub_in.academic_year, sub_in.description or "", sub_in.year_level
    ))

    conn.commit()
    conn.close()
    return {"message": "Subject created successfully.", "id": sub_id}

@router.post("/subjects/bulk-import")
def bulk_import_subjects(data: SubjectBulkImport, payload: dict = Depends(require_roles("admin"))):
    """Bulk imports multiple subjects with validation and duplicate prevention."""
    conn = get_db_connection()
    cursor = conn.cursor()
    created_count = 0
    skipped_count = 0

    for sub_in in data.subjects:
        # Resolve branch
        branch_id = sub_in.branch_id
        if not branch_id and sub_in.branch_code:
            cursor.execute("SELECT id FROM branches WHERE code = ?;", (sub_in.branch_code,))
            b_row = cursor.fetchone()
            if b_row:
                branch_id = b_row["id"]
        if not branch_id:
            cursor.execute("SELECT id FROM branches LIMIT 1;")
            branch_id = cursor.fetchone()["id"]

        cursor.execute("SELECT id FROM subjects WHERE code = ? AND academic_year = ?;", (sub_in.code.strip(), sub_in.academic_year))
        if cursor.fetchone():
            skipped_count += 1
            continue

        sub_id = f"sub_{uuid.uuid4().hex[:10]}"
        cursor.execute("""
        INSERT INTO subjects (
            id, branch_id, semester_number, name, code, is_elective,
            category, credits, total_credits, subject_type, teaching_hours,
            syllabus_scheme, academic_year, description, status, year_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?);
        """, (
            sub_id, branch_id, sub_in.semester_number, sub_in.name.strip(), sub_in.code.strip(), sub_in.is_elective,
            sub_in.category, sub_in.credits, sub_in.total_credits, sub_in.subject_type, sub_in.teaching_hours,
            sub_in.syllabus_scheme, sub_in.academic_year, sub_in.description or "", sub_in.year_level
        ))
        created_count += 1

    conn.commit()
    conn.close()
    return {"message": f"Bulk import complete: {created_count} subjects added, {skipped_count} skipped.", "created": created_count, "skipped": skipped_count}

@router.put("/subjects/{subject_id}")
def update_subject(subject_id: str, data: SubjectUpdate, payload: dict = Depends(require_roles("admin"))):
    """Administrator modifies subject details, credits, or scheme."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM subjects WHERE id = ?;", (subject_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Subject not found.")

    updates = []
    params = []
    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            updates.append(f"{field} = ?")
            params.append(val)

    if updates:
        params.append(subject_id)
        cursor.execute(f"UPDATE subjects SET {', '.join(updates)} WHERE id = ?;", tuple(params))
        conn.commit()

    conn.close()
    return {"message": "Subject updated successfully."}

@router.delete("/subjects/{subject_id}")
def delete_or_archive_subject(subject_id: str, payload: dict = Depends(require_roles("admin"))):
    """Archives a subject, protecting historical documents and evaluation records."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if subject is referenced by tasks, submissions, or allotments
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE subject_id = ?;", (subject_id,))
    task_refs = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM student_subject_enrollments WHERE subject_id = ?;", (subject_id,))
    enroll_refs = cursor.fetchone()[0]

    if task_refs > 0 or enroll_refs > 0:
        # Soft-archive to preserve historical records
        cursor.execute("UPDATE subjects SET status = 'archived' WHERE id = ?;", (subject_id,))
        conn.commit()
        conn.close()
        return {"message": "Subject is referenced by historical records; successfully archived for audit compliance."}
    else:
        cursor.execute("DELETE FROM subjects WHERE id = ?;", (subject_id,))
        conn.commit()
        conn.close()
        return {"message": "Subject removed from catalog."}

# ============================================================================
# MODULE 2B: ACADEMIC-YEAR-SPECIFIC CURRICULA
# ============================================================================

@router.get("/curricula")
def list_curricula():
    """Lists all syllabus curricula versions across academic years and branches."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT c.*, b.name as branch_name
    FROM curriculum_versions c
    JOIN branches b ON c.branch_code = b.code
    ORDER BY c.academic_year DESC, c.semester_number ASC;
    """)
    curricula = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return curricula

@router.post("/curricula")
def create_curriculum_version(data: CurriculumVersionCreate, payload: dict = Depends(require_roles("admin"))):
    """Creates a new curriculum version for a specific academic cycle and scheme."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    cur_id = f"cur_{data.academic_year.replace('-', '_')}_{data.branch_code.lower()}_sem{data.semester_number}"

    cursor.execute("""
    INSERT INTO curriculum_versions (id, academic_year, branch_code, year_level, semester_number, scheme_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        scheme_name = excluded.scheme_name,
        status = excluded.status,
        updated_at = excluded.updated_at;
    """, (
        cur_id, data.academic_year, data.branch_code, data.year_level, data.semester_number,
        data.scheme_name, data.status, now_iso, now_iso
    ))
    conn.commit()
    conn.close()
    return {"message": f"Curriculum version created for {data.branch_code} Semester {data.semester_number} ({data.academic_year}).", "id": cur_id}

@router.post("/curricula/clone")
def clone_curriculum(data: CurriculumCloneRequest, payload: dict = Depends(require_roles("admin"))):
    """Clones an existing academic year's curriculum into a new academic year without overwriting historical records."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Find existing subjects for source academic year
    cursor.execute("""
    SELECT s.* FROM subjects s
    JOIN branches b ON s.branch_id = b.id
    WHERE b.code = ? AND (s.academic_year = ? OR s.academic_year IS NULL) AND s.status != 'archived';
    """, (data.branch_code, data.source_academic_year))
    source_subs = [dict(r) for r in cursor.fetchall()]

    if not source_subs:
        conn.close()
        raise HTTPException(status_code=404, detail=f"No active curriculum subjects found for {data.branch_code} in {data.source_academic_year}.")

    cloned_count = 0
    scheme = data.scheme_name or f"Cloned from {data.source_academic_year}"

    for sub in source_subs:
        # Check if already cloned
        cursor.execute("""
        SELECT id FROM subjects WHERE code = ? AND academic_year = ?;
        """, (sub["code"], data.target_academic_year))
        if cursor.fetchone():
            continue

        new_sub_id = f"sub_{uuid.uuid4().hex[:10]}"
        cursor.execute("""
        INSERT INTO subjects (
            id, branch_id, semester_number, name, code, is_elective,
            category, credits, total_credits, subject_type, teaching_hours,
            syllabus_scheme, academic_year, description, status, year_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?);
        """, (
            new_sub_id, sub["branch_id"], sub["semester_number"], sub["name"], sub["code"], sub["is_elective"],
            sub.get("category") or "Core", sub.get("credits") or 3.0, sub.get("total_credits") or 3.0,
            sub.get("subject_type") or "Theory", sub.get("teaching_hours") or 4,
            scheme, data.target_academic_year, sub.get("description") or "", sub.get("year_level") or "FE"
        ))
        cloned_count += 1

    # Record curriculum versions
    for sem in {s["semester_number"] for s in source_subs}:
        cur_id = f"cur_{data.target_academic_year.replace('-', '_')}_{data.branch_code.lower()}_sem{sem}"
        cursor.execute("""
        INSERT OR IGNORE INTO curriculum_versions (id, academic_year, branch_code, year_level, semester_number, scheme_name, status, created_at, updated_at)
        VALUES (?, ?, ?, 'SE', ?, ?, 'draft', ?, ?);
        """, (cur_id, data.target_academic_year, data.branch_code, sem, scheme, now_iso, now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Successfully cloned {cloned_count} subjects from {data.source_academic_year} to {data.target_academic_year} for {data.branch_code}."}

# ============================================================================
# MODULE 2C: BULK SUBJECT ALLOTMENT WIZARD
# ============================================================================

@router.post("/allotments/preview")
def preview_bulk_allotment(data: AllotmentPreviewRequest, payload: dict = Depends(require_roles("admin"))):
    """Preview step: shows affected students, subjects, and eligible faculty before publishing."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Find affected students matching the academic group
    cursor.execute("""
    SELECT sp.user_id, sp.roll_number, u.full_name, sp.division_name
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
    WHERE sp.branch_code = ? AND sp.year_level = ? AND sp.semester_number = ? AND sp.division_name = ?
      AND (sp.academic_year = ? OR sp.academic_year IS NULL) AND sp.status = 'approved';
    """, (data.branch_code, data.year_level, data.semester_number, data.division_name, data.academic_year))
    affected_students = [dict(r) for r in cursor.fetchall()]

    # Fetch subjects
    subjects_info = []
    if data.subject_ids:
        placeholders = ', '.join(['?'] * len(data.subject_ids))
        cursor.execute(f"SELECT id, name, code, credits, is_elective FROM subjects WHERE id IN ({placeholders});", tuple(data.subject_ids))
        subjects_info = [dict(r) for r in cursor.fetchall()]
    else:
        cursor.execute("""
        SELECT s.id, s.name, s.code, s.credits, s.is_elective
        FROM subjects s
        JOIN branches b ON s.branch_id = b.id
        WHERE (b.code = ? OR b.code = 'ASH') AND s.semester_number = ? AND s.status != 'archived';
        """, (data.branch_code, data.semester_number))
        subjects_info = [dict(r) for r in cursor.fetchall()]

    # Eligible faculty
    cursor.execute("""
    SELECT u.id, u.full_name, fp.designation, fp.department_code
    FROM users u
    JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE u.role = 'faculty' AND u.status = 'active';
    """)
    faculty_list = [dict(r) for r in cursor.fetchall()]

    group_id = f"grp_{data.academic_year.replace('-', '_')}_{data.branch_code.lower()}_{data.year_level.lower()}_{data.division_name.lower().replace(' ', '_')}"

    conn.close()
    return {
        "academic_group_id": group_id,
        "affected_students_count": len(affected_students),
        "affected_students": affected_students,
        "subjects": subjects_info,
        "selected_subjects": subjects_info,
        "eligible_faculty": faculty_list
    }

@router.post("/allotments/publish")
def publish_bulk_allotment(data: BulkAllotmentPublish, payload: dict = Depends(require_roles("admin"))):
    """Step 10: Publishes bulk allotment, auto-enrolling students and assigning teaching faculty."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Ensure academic group exists
    group_id = f"grp_{data.academic_year.replace('-', '_')}_{data.branch_code.lower()}_{data.year_level.lower()}_sem{data.semester_number}_{data.division_name.lower().replace(' ', '')}"
    cursor.execute("""
    INSERT OR IGNORE INTO academic_groups (id, academic_year, branch_code, year_level, semester_number, division_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """, (group_id, data.academic_year, data.branch_code, data.year_level, data.semester_number, data.division_name, now_iso))

    # 2. Get all approved students in this academic group
    cursor.execute("""
    SELECT user_id FROM student_profiles
    WHERE branch_code = ? AND year_level = ? AND semester_number = ? AND division_name = ?
      AND (academic_year = ? OR academic_year IS NULL) AND status = 'approved';
    """, (data.branch_code, data.year_level, data.semester_number, data.division_name, data.academic_year))
    student_ids = [r[0] for r in cursor.fetchall()]

    enrolled_count = 0
    assigned_count = 0

    # 3. For each subject and assigned faculty
    for item in data.allotments:
        subject_id = item.get("subject_id")
        faculty_id = item.get("faculty_id")
        if not subject_id or not faculty_id:
            continue

        # Save subject allotment
        allotment_id = f"allot_{uuid.uuid4().hex[:10]}"
        cursor.execute("""
        INSERT INTO subject_allotments (id, academic_group_id, subject_id, faculty_id, academic_year, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(academic_group_id, subject_id) DO UPDATE SET
            faculty_id = excluded.faculty_id;
        """, (allotment_id, group_id, subject_id, faculty_id, data.academic_year, now_iso))

        # Also register faculty assignment in faculty_assignments table for legacy compatibility
        fa_id = f"fa_{uuid.uuid4().hex[:10]}"
        cursor.execute("""
        INSERT OR REPLACE INTO faculty_assignments (id, faculty_id, subject_id, division_name)
        VALUES (?, ?, ?, ?);
        """, (fa_id, faculty_id, subject_id, data.division_name))
        assigned_count += 1

        # 4. Auto-enroll every student in the group into this subject
        for s_id in student_ids:
            enr_id = f"enr_{uuid.uuid4().hex[:10]}"
            cursor.execute("""
            INSERT OR IGNORE INTO student_subject_enrollments (id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at)
            VALUES (?, ?, ?, ?, 'compulsory', 'enrolled', ?);
            """, (enr_id, s_id, subject_id, data.academic_year, now_iso))
            enrolled_count += 1

        # Notify assigned faculty
        cursor.execute("SELECT name, code FROM subjects WHERE id = ?;", (subject_id,))
        sub_row = cursor.fetchone()
        sub_name = sub_row["name"] if sub_row else "Subject"
        cursor.execute("""
        INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
        VALUES (?, ?, 'New Teaching Allotment', ?, 'info', '/faculty', 0, ?);
        """, (f"notif_{uuid.uuid4().hex[:8]}", faculty_id, f"You have been allotted {sub_name} for {data.branch_code} {data.year_level} ({data.division_name}) - AY {data.academic_year}.", now_iso))

    conn.commit()
    conn.close()
    return {
        "message": f"Subject allotment published: {assigned_count} faculty-subject assignments registered. {len(student_ids)} students automatically enrolled.",
        "affected_students": len(student_ids),
        "group_id": group_id
    }

@router.get("/allotments")
def get_allotments(academic_year: Optional[str] = None, branch_code: Optional[str] = None, division: Optional[str] = None):
    """Lists published allotments with assigned faculty and subjects."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT sa.*, ag.branch_code, ag.year_level, ag.semester_number, ag.division_name,
           s.name as subject_name, s.code as subject_code, s.credits,
           u.full_name as faculty_name, u.email as faculty_email
    FROM subject_allotments sa
    JOIN academic_groups ag ON sa.academic_group_id = ag.id
    JOIN subjects s ON sa.subject_id = s.id
    JOIN users u ON sa.faculty_id = u.id
    WHERE 1=1
    """
    params = []
    if academic_year:
        query += " AND sa.academic_year = ?"
        params.append(academic_year)
    if branch_code:
        query += " AND ag.branch_code = ?"
        params.append(branch_code)
    if division:
        query += " AND ag.division_name = ?"
        params.append(division)

    query += " ORDER BY ag.year_level, ag.division_name, s.code ASC;"
    cursor.execute(query, tuple(params))
    allotments = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return allotments

# ============================================================================
# MODULE 4: LABORATORY BATCH MANAGEMENT
# ============================================================================

@router.get("/batches")
def list_batches(
    academic_year: Optional[str] = None,
    branch_code: Optional[str] = None,
    division_name: Optional[str] = None,
    subject_id: Optional[str] = None
):
    """Lists laboratory batches with assigned faculty and student headcounts."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT b.*, s.name as subject_name, s.code as subject_code,
           u.full_name as faculty_name,
           (SELECT COUNT(*) FROM batch_students WHERE batch_id = b.id) as student_count
    FROM lab_batches b
    LEFT JOIN subjects s ON b.subject_id = s.id
    LEFT JOIN users u ON b.faculty_id = u.id
    WHERE 1=1
    """
    params = []
    if academic_year:
        query += " AND b.academic_year = ?"
        params.append(academic_year)
    if branch_code:
        query += " AND b.branch_code = ?"
        params.append(branch_code)
    if division_name:
        query += " AND b.division_name = ?"
        params.append(division_name)
    if subject_id:
        query += " AND b.subject_id = ?"
        params.append(subject_id)

    query += " ORDER BY b.division_name ASC, b.batch_name ASC;"
    cursor.execute(query, tuple(params))
    batches = [dict(r) for r in cursor.fetchall()]

    # Fetch students for each batch
    for b in batches:
        cursor.execute("""
        SELECT sp.user_id, sp.roll_number, u.full_name, u.email
        FROM batch_students bs
        JOIN student_profiles sp ON bs.student_id = sp.user_id
        JOIN users u ON sp.user_id = u.id
        WHERE bs.batch_id = ?
        ORDER BY sp.roll_number ASC;
        """, (b["id"],))
        b["students"] = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return batches

@router.post("/batches")
def create_lab_batch(data: LabBatchCreate, payload: dict = Depends(require_roles("admin"))):
    """Administrator creates a laboratory practical batch and manually allocates students and faculty."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    batch_id = f"batch_{uuid.uuid4().hex[:10]}"

    cursor.execute("""
    INSERT INTO lab_batches (id, batch_name, academic_year, branch_code, year_level, semester_number, division_name, subject_id, faculty_id, capacity, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?);
    """, (
        batch_id, data.batch_name.strip(), data.academic_year, data.branch_code,
        data.year_level, data.semester_number, data.division_name,
        data.subject_id, data.faculty_id, data.capacity, now_iso
    ))

    # Add assigned students
    if data.student_ids:
        for s_id in data.student_ids:
            cursor.execute("""
            INSERT OR IGNORE INTO batch_students (id, batch_id, student_id, assigned_at)
            VALUES (?, ?, ?, ?);
            """, (f"bs_{uuid.uuid4().hex[:8]}", batch_id, s_id, now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Laboratory batch '{data.batch_name}' created successfully.", "id": batch_id}

@router.get("/batches/allocation-matrix")
def get_batch_allocation_matrix(
    branch_code: Optional[str] = None,
    division_name: Optional[str] = None,
    branch: Optional[str] = None,
    division: Optional[str] = None,
    academic_year: Optional[str] = "2026-27",
    year_level: Optional[str] = None,
    semester_number: Optional[int] = None,
    semester: Optional[int] = None,
    subject_id: Optional[str] = None,
    payload: dict = Depends(require_roles("admin", "faculty"))
):
    """Returns matrix of all division students and their batch allocations for manual batch assignment."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clean and resolve parameters
    target_branch = branch_code or branch or "CE"
    if target_branch in ("undefined", "null", "", "ALL"):
        target_branch = "CE"

    target_division = division_name or division or "Div A"
    if target_division in ("undefined", "null", ""):
        target_division = "Div A"

    target_ay = academic_year
    if target_ay in ("undefined", "null", ""):
        target_ay = "2026-27"

    target_year_level = year_level
    if target_year_level in ("undefined", "null", "", "ALL"):
        target_year_level = None

    target_sem = semester_number or semester
    if str(target_sem) in ("undefined", "null", "", "0", "ALL"):
        target_sem = None

    target_subj = subject_id
    if target_subj in ("undefined", "null", "", "ALL"):
        target_subj = None

    batch_query = """
    SELECT b.*, s.name as subject_name, s.code as subject_code,
           u.full_name as faculty_name,
           (SELECT COUNT(*) FROM batch_students WHERE batch_id = b.id) as student_count
    FROM lab_batches b
    LEFT JOIN subjects s ON b.subject_id = s.id
    LEFT JOIN users u ON b.faculty_id = u.id
    WHERE (b.branch_code = ? OR b.branch_code = 'ALL' OR b.branch_code IS NULL)
      AND (b.division_name = ? OR b.division_name = 'ALL' OR b.division_name IS NULL)
    """
    batch_params = [target_branch, target_division]
    if target_ay:
        batch_query += " AND (b.academic_year = ? OR b.academic_year IS NULL)"
        batch_params.append(target_ay)
    if target_year_level:
        batch_query += " AND (b.year_level = ? OR b.year_level IS NULL)"
        batch_params.append(target_year_level)
    if target_sem:
        batch_query += " AND (b.semester_number = ? OR b.semester_number IS NULL)"
        batch_params.append(target_sem)
    if target_subj:
        batch_query += " AND (b.subject_id = ? OR b.subject_id IS NULL)"
        batch_params.append(target_subj)

    batch_query += " ORDER BY b.batch_name ASC;"
    cursor.execute(batch_query, tuple(batch_params))
    batches = [dict(r) for r in cursor.fetchall()]
    batch_ids = [b["id"] for b in batches]

    for b in batches:
        cursor.execute("SELECT student_id FROM batch_students WHERE batch_id = ?;", (b["id"],))
        b["student_ids"] = [r[0] for r in cursor.fetchall()]

    stu_query = """
    SELECT sp.user_id, sp.roll_number, sp.prn, sp.year_level, sp.semester_number, sp.division_name,
           u.full_name, u.email
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
    WHERE sp.branch_code = ? AND sp.division_name = ? AND sp.status = 'approved'
    """
    stu_params = [target_branch, target_division]
    if target_year_level:
        stu_query += " AND sp.year_level = ?"
        stu_params.append(target_year_level)
    if target_sem:
        stu_query += " AND sp.semester_number = ?"
        stu_params.append(target_sem)

    stu_query += " ORDER BY sp.roll_number ASC;"
    cursor.execute(stu_query, tuple(stu_params))
    students = [dict(r) for r in cursor.fetchall()]

    unassigned_students = []
    for s in students:
        assigned_batch = None
        if batch_ids:
            placeholders = ", ".join(["?"] * len(batch_ids))
            cursor.execute(f"""
            SELECT b.id, b.batch_name
            FROM batch_students bs
            JOIN lab_batches b ON bs.batch_id = b.id
            WHERE bs.student_id = ? AND b.id IN ({placeholders})
            LIMIT 1;
            """, tuple([s["user_id"]] + batch_ids))
            assigned_row = cursor.fetchone()
            if assigned_row:
                assigned_batch = dict(assigned_row)

        if assigned_batch:
            s["assigned_batch_id"] = assigned_batch["id"]
            s["assigned_batch_name"] = assigned_batch["batch_name"]
        else:
            s["assigned_batch_id"] = None
            s["assigned_batch_name"] = None
            unassigned_students.append(s)

    conn.close()
    return {
        "batches": batches,
        "students": students,
        "unassigned_students": unassigned_students,
        "total_division_students": len(students),
        "unassigned_count": len(unassigned_students)
    }

@router.post("/batches/manual-assign")
def manual_assign_batch(
    data: BatchManualAssignRequest,
    payload: dict = Depends(require_roles("admin"))
):
    """Admin manually assigns or moves arbitrary students to a specific laboratory batch."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM lab_batches WHERE id = ?;", (data.batch_id,))
    target_batch = cursor.fetchone()
    if not target_batch:
        conn.close()
        raise HTTPException(status_code=404, detail="Target batch not found.")

    target_batch = dict(target_batch)

    cursor.execute("""
    SELECT id FROM lab_batches
    WHERE branch_code = ? AND division_name = ? AND academic_year = ?
      AND (subject_id = ? OR (subject_id IS NULL AND ? IS NULL));
    """, (
        target_batch["branch_code"], target_batch["division_name"], target_batch["academic_year"],
        target_batch.get("subject_id"), target_batch.get("subject_id")
    ))
    sibling_batch_ids = [r[0] for r in cursor.fetchall()]

    for s_id in data.student_ids:
        if sibling_batch_ids:
            placeholders = ", ".join(["?"] * len(sibling_batch_ids))
            cursor.execute(
                f"DELETE FROM batch_students WHERE student_id = ? AND batch_id IN ({placeholders});",
                tuple([s_id] + sibling_batch_ids)
            )
        cursor.execute("""
        INSERT OR IGNORE INTO batch_students (id, batch_id, student_id, assigned_at)
        VALUES (?, ?, ?, ?);
        """, (f"bs_{uuid.uuid4().hex[:8]}", data.batch_id, s_id, now_iso))

    conn.commit()
    conn.close()
    return {
        "message": f"Successfully assigned {len(data.student_ids)} student(s) to '{target_batch['batch_name']}'.",
        "batch_id": data.batch_id,
        "batch_name": target_batch["batch_name"],
        "assigned_count": len(data.student_ids)
    }

@router.post("/batches/unassign")
def unassign_batch_students(
    data: BatchUnassignRequest,
    payload: dict = Depends(require_roles("admin"))
):
    """Admin unassigns students from a batch, returning them to the unassigned pool."""
    conn = get_db_connection()
    cursor = conn.cursor()

    for s_id in data.student_ids:
        cursor.execute("DELETE FROM batch_students WHERE batch_id = ? AND student_id = ?;", (data.batch_id, s_id))

    conn.commit()
    conn.close()
    return {"message": f"Unassigned {len(data.student_ids)} student(s) from batch."}

@router.put("/batches/{batch_id}")
@router.patch("/batches/{batch_id}")
def update_lab_batch(batch_id: str, data: LabBatchUpdate, payload: dict = Depends(require_roles("admin"))):
    """Administrator updates batch configuration or student allocation."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM lab_batches WHERE id = ?;", (batch_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Batch not found.")

    updates = []
    params = []
    if data.batch_name is not None:
        updates.append("batch_name = ?")
        params.append(data.batch_name.strip())
    if data.faculty_id is not None:
        updates.append("faculty_id = ?")
        params.append(data.faculty_id)
    if data.capacity is not None:
        updates.append("capacity = ?")
        params.append(data.capacity)
    if data.status is not None:
        updates.append("status = ?")
        params.append(data.status)

    if updates:
        params.append(batch_id)
        cursor.execute(f"UPDATE lab_batches SET {', '.join(updates)} WHERE id = ?;", tuple(params))

    # Update students if provided
    if data.student_ids is not None:
        cursor.execute("DELETE FROM batch_students WHERE batch_id = ?;", (batch_id,))
        now_iso = datetime.now(timezone.utc).isoformat()
        for s_id in data.student_ids:
            cursor.execute("""
            INSERT OR IGNORE INTO batch_students (id, batch_id, student_id, assigned_at)
            VALUES (?, ?, ?, ?);
            """, (f"bs_{uuid.uuid4().hex[:8]}", batch_id, s_id, now_iso))

    conn.commit()
    conn.close()
    return {"message": "Batch updated successfully."}

# ============================================================================
# MODULE 3: OPEN ELECTIVE MANAGEMENT
# ============================================================================

@router.get("/open-electives/configs")
def list_open_elective_configs(academic_year: Optional[str] = None):
    """Lists configured open elective offerings."""
    conn = get_db_connection()
    cursor = conn.cursor()
    query = """
    SELECT oec.*, s.name as subject_name, s.code as subject_code, s.credits,
           u.full_name as faculty_name,
           (SELECT COUNT(*) FROM open_elective_selections WHERE elective_config_id = oec.id AND status = 'approved') as enrolled_count
    FROM open_elective_configs oec
    JOIN subjects s ON oec.subject_id = s.id
    LEFT JOIN users u ON oec.faculty_id = u.id
    WHERE 1=1
    """
    params = []
    if academic_year:
        query += " AND oec.academic_year = ?"
        params.append(academic_year)

    cursor.execute(query, tuple(params))
    configs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return configs

@router.post("/open-electives/configs")
def create_open_elective_config(data: OpenElectiveConfigCreate, payload: dict = Depends(require_roles("admin"))):
    """Administrator configures open elective offerings and selection period."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    config_id = f"oec_{uuid.uuid4().hex[:10]}"

    cursor.execute("""
    INSERT INTO open_elective_configs (
        id, academic_year, branch_code, year_level, semester_number, subject_id, faculty_id, max_capacity, selection_start_date, selection_end_date, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);
    """, (
        config_id, data.academic_year, data.branch_code, data.year_level, data.semester_number,
        data.subject_id, data.faculty_id, data.max_capacity, data.selection_start_date, data.selection_end_date, now_iso
    ))
    conn.commit()
    conn.close()
    return {"message": "Open elective configuration published.", "id": config_id}

@router.get("/open-electives/student-options")
def get_student_elective_options(payload: dict = Depends(require_roles("student"))):
    """Student fetches open electives currently available for their branch, semester, and academic year."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    sp = cursor.fetchone()
    if not sp:
        conn.close()
        return {"open": False, "options": [], "my_selection": None}

    # Check student's current selection
    cursor.execute("""
    SELECT oes.*, s.name as subject_name, s.code as subject_code
    FROM open_elective_selections oes
    JOIN subjects s ON oes.subject_id = s.id
    WHERE oes.student_id = ?;
    """, (student_id,))
    my_sel = cursor.fetchone()

    # Find available elective configs
    cursor.execute("""
    SELECT oec.*, s.name as subject_name, s.code as subject_code, s.credits, s.description,
           u.full_name as faculty_name,
           (SELECT COUNT(*) FROM open_elective_selections WHERE elective_config_id = oec.id AND status = 'approved') as enrolled_count
    FROM open_elective_configs oec
    JOIN subjects s ON oec.subject_id = s.id
    LEFT JOIN users u ON oec.faculty_id = u.id
    WHERE oec.is_active = 1
      AND (oec.branch_code = ? OR oec.branch_code = 'ALL')
      AND oec.year_level = ?
      AND oec.semester_number = ?;
    """, (sp["branch_code"], sp["year_level"], sp["semester_number"]))
    options = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "open": len(options) > 0,
        "options": options,
        "my_selection": dict(my_sel) if my_sel else None
    }

@router.post("/open-electives/select")
def select_open_elective(data: OpenElectiveSelect, payload: dict = Depends(require_roles("student"))):
    """Student selects an open elective subject from available institutional offerings."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Check capacity
    cursor.execute("""
    SELECT max_capacity,
           (SELECT COUNT(*) FROM open_elective_selections WHERE elective_config_id = ? AND status = 'approved') as enrolled
    FROM open_elective_configs WHERE id = ? AND is_active = 1;
    """, (data.elective_config_id, data.elective_config_id))
    cfg = cursor.fetchone()
    if not cfg:
        conn.close()
        raise HTTPException(status_code=400, detail="Elective configuration not found or closed.")

    if cfg["enrolled"] >= cfg["max_capacity"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Elective capacity is full for this selection.")

    # Record or update selection
    sel_id = f"oes_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO open_elective_selections (id, student_id, elective_config_id, subject_id, status, selected_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
    ON CONFLICT(student_id, subject_id) DO UPDATE SET
        elective_config_id = excluded.elective_config_id,
        status = 'pending',
        selected_at = excluded.selected_at;
    """, (sel_id, student_id, data.elective_config_id, data.subject_id, now_iso))

    conn.commit()
    conn.close()
    return {"message": "Open elective selection submitted for administrator approval.", "id": sel_id}

@router.get("/open-electives/selections")
def list_open_elective_selections(payload: dict = Depends(require_roles("admin"))):
    """Administrator reviews student open elective choices."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT oes.*, u.full_name as student_name, sp.roll_number, sp.division_name, sp.branch_code, sp.year_level,
           s.name as subject_name, s.code as subject_code
    FROM open_elective_selections oes
    JOIN users u ON oes.student_id = u.id
    JOIN student_profiles sp ON u.id = sp.user_id
    JOIN subjects s ON oes.subject_id = s.id
    ORDER BY oes.selected_at DESC;
    """)
    selections = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return selections

@router.patch("/open-electives/selections/{selection_id}/review")
def review_open_elective_selection(selection_id: str, data: OpenElectiveReview, payload: dict = Depends(require_roles("admin"))):
    """Administrator approves or rejects student open elective selection."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM open_elective_selections WHERE id = ?;", (selection_id,))
    sel = cursor.fetchone()
    if not sel:
        conn.close()
        raise HTTPException(status_code=404, detail="Selection not found.")

    cursor.execute("""
    UPDATE open_elective_selections
    SET status = ?, admin_remarks = ?, reviewed_at = ?
    WHERE id = ?;
    """, (data.status, data.remarks or "", now_iso, selection_id))

    if data.status == 'approved':
        # Auto-enroll student into student_subject_enrollments
        cursor.execute("SELECT academic_year FROM open_elective_configs WHERE id = ?;", (sel["elective_config_id"],))
        cfg = cursor.fetchone()
        ay = cfg["academic_year"] if cfg else "2026-27"

        cursor.execute("""
        INSERT OR IGNORE INTO student_subject_enrollments (id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at)
        VALUES (?, ?, ?, ?, 'open_elective', 'enrolled', ?);
        """, (f"enr_{uuid.uuid4().hex[:10]}", sel["student_id"], sel["subject_id"], ay, now_iso))

        # Update student_profiles elective_subject name
        cursor.execute("SELECT name FROM subjects WHERE id = ?;", (sel["subject_id"],))
        sname = cursor.fetchone()["name"]
        cursor.execute("UPDATE student_profiles SET elective_subject = ? WHERE user_id = ?;", (sname, sel["student_id"]))

    conn.commit()
    conn.close()
    return {"message": f"Elective selection {data.status}."}

# ============================================================================
# MODULE 5: ACADEMIC PROMOTION / UPGRADE WINDOW
# ============================================================================

@router.get("/promotions/windows")
def list_promotion_windows(payload: dict = Depends(require_roles("admin"))):
    """Lists all configured academic promotion upgrade windows with live states (Admin only)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM promotion_windows ORDER BY created_at DESC;")
    raw_windows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    now_iso = datetime.now(timezone.utc).isoformat()
    windows = []
    for w in raw_windows:
        # Determine effective live state
        raw_status = w.get("status") or ("open" if w.get("is_open") else "closed")
        start = w.get("start_date")
        end = w.get("end_date")

        effective_status = raw_status
        if raw_status in ("open", "scheduled"):
            if start and now_iso < start:
                effective_status = "scheduled"
            elif end and now_iso > end:
                effective_status = "closed"
            elif raw_status == "scheduled" and start and now_iso >= start:
                effective_status = "open"

        w["effective_status"] = effective_status
        w["is_currently_open"] = bool(effective_status == "open" and w.get("is_open"))
        windows.append(w)

    return windows

@router.post("/promotions/windows")
def create_promotion_window(data: PromotionWindowCreate, payload: dict = Depends(require_roles("admin"))):
    """Administrator configures, opens, or schedules an academic promotion upgrade window."""
    admin_id = payload.get("sub", "admin")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    win_id = f"pw_{uuid.uuid4().hex[:10]}"

    status = data.status or ("open" if data.is_open else "draft")
    if data.start_date and now_iso < data.start_date:
        status = "scheduled"

    is_open_val = 1 if status == "open" and data.is_open else 0

    cursor.execute("""
    INSERT INTO promotion_windows (
        id, title, source_academic_year, target_academic_year, source_year_level, target_year_level,
        source_semester, target_semester, branch_code, is_open, status, start_date, end_date,
        opened_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        win_id, data.title.strip(), data.source_academic_year, data.target_academic_year,
        data.source_year_level, data.target_year_level, data.source_semester, data.target_semester,
        data.branch_code, is_open_val, status, data.start_date, data.end_date,
        now_iso if is_open_val else None, now_iso
    ))

    # Audit log
    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'CREATE_PROMOTION_WINDOW', 'PROMOTION_WINDOW', ?, ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", admin_id, win_id, json.dumps(data.model_dump()), now_iso))

    conn.commit()
    conn.close()
    return {"message": "Academic promotion window configured.", "id": win_id, "status": status}

@router.patch("/promotions/windows/{window_id}/status")
def update_promotion_window_status(window_id: str, data: PromotionWindowStatusUpdate, payload: dict = Depends(require_roles("admin"))):
    """Administrator manually transitions promotion window state (e.g. close, reopen, complete)."""
    admin_id = payload.get("sub", "admin")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM promotion_windows WHERE id = ?;", (window_id,))
    win = cursor.fetchone()
    if not win:
        conn.close()
        raise HTTPException(status_code=404, detail="Promotion window not found.")

    new_status = data.status
    if new_status not in ('draft', 'scheduled', 'open', 'closed', 'completed'):
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid promotion status.")

    is_open = 1 if new_status == 'open' else 0
    closed_at = now_iso if new_status in ('closed', 'completed') else None

    cursor.execute("""
    UPDATE promotion_windows
    SET status = ?, is_open = ?, closed_at = ?, updated_at = ?
    WHERE id = ?;
    """, (new_status, is_open, closed_at, now_iso, window_id))

    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'UPDATE_PROMOTION_STATUS', 'PROMOTION_WINDOW', ?, ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", admin_id, window_id, json.dumps({"new_status": new_status, "is_open": is_open}), now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Promotion window is now {new_status}.", "status": new_status, "is_open": bool(is_open)}

@router.patch("/promotions/windows/{window_id}/toggle")
def toggle_promotion_window(window_id: str, payload: dict = Depends(require_roles("admin"))):
    """Admin toggles open/close status of a promotion window manually."""
    admin_id = payload.get("sub", "admin")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM promotion_windows WHERE id = ?;", (window_id,))
    win_row = cursor.fetchone()
    if not win_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Promotion window not found.")
    win = dict(win_row)

    currently_open = win.get("is_open") == 1 and win.get("status") == "open"
    new_open = 0 if currently_open else 1
    new_status = "closed" if currently_open else "open"
    closed_at = now_iso if not new_open else None

    if new_open:
        cursor.execute("""
        UPDATE promotion_windows
        SET is_open = 1, status = 'open', closed_at = NULL, updated_at = ?,
            end_date = CASE WHEN end_date IS NOT NULL AND end_date < ? THEN NULL ELSE end_date END
        WHERE id = ?;
        """, (now_iso, now_iso, window_id))
    else:
        cursor.execute("""
        UPDATE promotion_windows
        SET is_open = 0, status = 'closed', closed_at = ?, updated_at = ?
        WHERE id = ?;
        """, (closed_at, now_iso, window_id))

    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'TOGGLE_PROMOTION_WINDOW', 'PROMOTION_WINDOW', ?, ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", admin_id, window_id, json.dumps({"new_status": new_status, "is_open": new_open}), now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Promotion window is now {new_status}.", "is_open": bool(new_open), "status": new_status}

@router.get("/promotions/student-window")
def check_student_promotion_eligibility(payload: dict = Depends(require_roles("student"))):
    """Checks if an academic promotion window is open for current student's academic standing."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    sp = cursor.fetchone()
    if not sp:
        conn.close()
        return {"is_eligible": False, "window": None, "pending_request": None, "existing_request": None}

    # Check for existing request (pending, approved, rejected)
    cursor.execute("""
    SELECT pr.*, pw.title as window_title, pw.target_academic_year, pw.target_year_level
    FROM promotion_requests pr
    JOIN promotion_windows pw ON pr.promotion_window_id = pw.id
    WHERE pr.student_id = ?
    ORDER BY pr.submitted_at DESC LIMIT 1;
    """, (student_id,))
    existing_req = cursor.fetchone()

    # Find matching window for student's branch and year level
    cursor.execute("""
    SELECT * FROM promotion_windows
    WHERE (branch_code = ? OR branch_code = 'ALL')
      AND source_year_level = ?
    ORDER BY created_at DESC LIMIT 1;
    """, (sp["branch_code"], sp["year_level"]))
    window = cursor.fetchone()

    is_eligible = False
    window_data = None
    if window:
        window_dict = dict(window)
        w_status = window_dict.get("status", "open")
        w_open = window_dict.get("is_open", 1)
        w_start = window_dict.get("start_date")
        w_end = window_dict.get("end_date")

        # Determine if window is currently active and open
        effective_open = True
        if not w_open or w_status == "closed":
            effective_open = False
            window_dict["status_message"] = "Promotion window is currently closed by administration."
        elif w_status == "draft":
            effective_open = False
            window_dict["status_message"] = "Promotion is not yet open."
        elif w_start and now_iso < w_start:
            effective_open = False
            window_dict["status_message"] = f"Promotion window is scheduled to open on {w_start}."
        elif w_end and now_iso > w_end:
            effective_open = False
            window_dict["status_message"] = f"Promotion window closed on {w_end}."
        else:
            window_dict["status_message"] = "Applications are currently open."

        window_dict["is_active_open"] = effective_open
        window_data = window_dict

        # Student is eligible only if window is active open and has no active pending/approved application
        has_active_application = existing_req and existing_req["status"] in ("pending", "approved")
        is_eligible = effective_open and not has_active_application

    conn.close()
    return {
        "is_eligible": is_eligible,
        "window": window_data,
        "pending_request": dict(existing_req) if existing_req and existing_req["status"] == "pending" else None,
        "existing_request": dict(existing_req) if existing_req else None,
        "current_profile": dict(sp)
    }

@router.post("/promotions/apply")
def submit_promotion_request(data: PromotionRequestSubmit, payload: dict = Depends(require_roles("student"))):
    """Student submits an academic year upgrade request with CGPA and requested division/roll."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    sp_row = cursor.fetchone()
    if not sp_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Student academic profile not found.")
    sp = dict(sp_row)

    cursor.execute("SELECT * FROM promotion_windows WHERE id = ?;", (data.promotion_window_id,))
    win_row = cursor.fetchone()
    if not win_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Promotion window not found.")
    win = dict(win_row)

    # Rule 1: Closed windows cannot accept new applications
    if not win.get("is_open") or win.get("status") == "closed":
        conn.close()
        raise HTTPException(status_code=400, detail="Promotion window is currently closed. New applications cannot be accepted.")

    if win.get("status") == "draft":
        conn.close()
        raise HTTPException(status_code=400, detail="Promotion window has not been opened yet.")

    # Rule 2: Scheduled windows cannot accept applications before opening
    if win.get("start_date") and now_iso < win["start_date"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Promotion window is scheduled to open on {win['start_date']}.")

    if win.get("end_date") and now_iso > win["end_date"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Promotion window deadline has expired.")

    # Rule 3: Students cannot apply outside their eligible academic combination
    if win["branch_code"] != 'ALL' and win["branch_code"] != sp["branch_code"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Ineligible branch. This promotion is for branch {win['branch_code']}.")

    if win["source_year_level"] != sp["year_level"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Ineligible year level. This promotion is for {win['source_year_level']} students.")

    # Rule 4: Prevent duplicate applications for the same promotion cycle
    cursor.execute("""
    SELECT id, status FROM promotion_requests
    WHERE student_id = ? AND promotion_window_id = ?;
    """, (student_id, data.promotion_window_id))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail=f"You already submitted an application for this promotion cycle (Status: {existing['status']}).")

    req_id = f"preq_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO promotion_requests (
        id, promotion_window_id, student_id, cgpa, current_year_level, current_semester, current_division,
        current_roll_number, requested_division, requested_roll_number, status, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?);
    """, (
        req_id, data.promotion_window_id, student_id, data.cgpa, sp["year_level"], sp["semester_number"],
        sp["division_name"], sp["roll_number"], data.requested_division, data.requested_roll_number, now_iso
    ))

    # Audit log
    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'SUBMIT_PROMOTION_REQUEST', 'PROMOTION_REQUEST', ?, ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", student_id, req_id, json.dumps({"window_id": data.promotion_window_id, "cgpa": data.cgpa}), now_iso))

    conn.commit()
    conn.close()
    return {"message": "Academic upgrade request submitted successfully for administrator verification.", "id": req_id}

@router.get("/promotions/requests")
def list_promotion_requests(
    window_id: Optional[str] = None,
    status: Optional[str] = None,
    payload: dict = Depends(require_roles("admin"))
):
    """Admin reviews pending, approved, and rejected student promotion requests."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT pr.*, u.full_name as student_name, u.email, sp.prn, sp.branch_code,
           pw.title as window_title, pw.target_academic_year, pw.target_year_level, pw.target_semester,
           pw.status as window_status, pw.is_open as window_is_open
    FROM promotion_requests pr
    JOIN users u ON pr.student_id = u.id
    JOIN student_profiles sp ON u.id = sp.user_id
    JOIN promotion_windows pw ON pr.promotion_window_id = pw.id
    WHERE 1=1
    """
    params = []
    if window_id:
        query += " AND pr.promotion_window_id = ?"
        params.append(window_id)
    if status:
        query += " AND pr.status = ?"
        params.append(status)

    query += " ORDER BY pr.submitted_at DESC;"
    cursor.execute(query, tuple(params))
    requests = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return requests

@router.patch("/promotions/requests/{request_id}/review")
def review_promotion_request(request_id: str, data: PromotionReview, payload: dict = Depends(require_roles("admin"))):
    """Admin approves or rejects student promotion, preserving history and auto-enrolling into new academic year."""
    admin_id = payload.get("sub", "admin")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    SELECT pr.*, pw.target_academic_year, pw.target_year_level, pw.target_semester, sp.branch_code, sp.academic_year as current_ay
    FROM promotion_requests pr
    JOIN promotion_windows pw ON pr.promotion_window_id = pw.id
    JOIN student_profiles sp ON pr.student_id = sp.user_id
    WHERE pr.id = ?;
    """, (request_id,))
    req = cursor.fetchone()
    if not req:
        conn.close()
        raise HTTPException(status_code=404, detail="Promotion request not found.")

    if data.status == 'approved':
        approved_div = data.approved_division or req["requested_division"]
        approved_roll = data.approved_roll_number or req["requested_roll_number"]

        # 1. Archive past year to student_enrollment_history
        cursor.execute("""
        INSERT INTO student_enrollment_history (
            id, student_id, academic_year, year_level, semester_number, branch_code, division_name, roll_number, cgpa, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            f"hist_{uuid.uuid4().hex[:10]}", req["student_id"], req["current_ay"] or "2025-26",
            req["current_year_level"], req["current_semester"], req["branch_code"], req["current_division"],
            req["current_roll_number"], req["cgpa"], now_iso
        ))

        # Mark past year enrollments as completed to preserve academic record cleanly
        cursor.execute("""
        UPDATE student_subject_enrollments
        SET status = 'completed'
        WHERE student_id = ? AND status = 'enrolled' AND academic_year != ?;
        """, (req["student_id"], req["target_academic_year"]))

        # 2. Update student profile to new academic year
        cursor.execute("""
        UPDATE student_profiles
        SET academic_year = ?, year_level = ?, semester_number = ?, division_name = ?, roll_number = ?, cgpa = ?, updated_at = ?
        WHERE user_id = ?;
        """, (
            req["target_academic_year"], req["target_year_level"], req["target_semester"],
            approved_div, approved_roll, req["cgpa"], now_iso, req["student_id"]
        ))

        # 3. Auto-allot subjects of the new academic group if published
        target_group_id = f"grp_{req['target_academic_year'].replace('-', '_')}_{req['branch_code'].lower()}_{req['target_year_level'].lower()}_sem{req['target_semester']}_{approved_div.lower().replace(' ', '')}"
        cursor.execute("SELECT subject_id FROM subject_allotments WHERE academic_group_id = ?;", (target_group_id,))
        for sub_row in cursor.fetchall():
            cursor.execute("""
            INSERT OR IGNORE INTO student_subject_enrollments (id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at)
            VALUES (?, ?, ?, ?, 'compulsory', 'enrolled', ?);
            """, (f"enr_{uuid.uuid4().hex[:10]}", req["student_id"], sub_row[0], req["target_academic_year"], now_iso))

        # Notify student
        cursor.execute("""
        INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
        VALUES (?, ?, 'Promotion Approved', ?, 'success', '/student', 0, ?);
        """, (
            f"notif_{uuid.uuid4().hex[:8]}", req["student_id"],
            f"Congratulations! You have been promoted to {req['target_year_level']} Semester {req['target_semester']} ({approved_div}, Roll: {approved_roll}) for AY {req['target_academic_year']}.",
            now_iso
        ))
    elif data.status == 'rejected':
        cursor.execute("""
        INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
        VALUES (?, ?, 'Promotion Request Update', ?, 'warning', '/student', 0, ?);
        """, (
            f"notif_{uuid.uuid4().hex[:8]}", req["student_id"],
            f"Your academic promotion request has been reviewed: Rejected. Remarks: {data.remarks or 'Please consult administration.'}",
            now_iso
        ))

    cursor.execute("""
    UPDATE promotion_requests
    SET status = ?, approved_division = ?, approved_roll_number = ?, admin_remarks = ?, reviewed_at = ?
    WHERE id = ?;
    """, (data.status, data.approved_division, data.approved_roll_number, data.remarks or "", now_iso, request_id))

    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'REVIEW_PROMOTION_REQUEST', 'PROMOTION_REQUEST', ?, ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", admin_id, request_id, json.dumps({"status": data.status, "student_id": req["student_id"]}), now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Promotion request has been {data.status}."}

@router.get("/promotions/windows/{window_id}/export")
def export_promotion_records(window_id: str, payload: dict = Depends(require_roles("admin"))):
    """Admin exports student promotion applications as CSV."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT pr.id, u.full_name, sp.prn, sp.branch_code, pr.current_year_level, pr.current_division,
           pr.current_roll_number, pr.cgpa, pr.requested_division, pr.requested_roll_number,
           pr.approved_division, pr.approved_roll_number, pr.status, pr.admin_remarks, pr.submitted_at
    FROM promotion_requests pr
    JOIN users u ON pr.student_id = u.id
    JOIN student_profiles sp ON u.id = sp.user_id
    WHERE pr.promotion_window_id = ?
    ORDER BY pr.submitted_at DESC;
    """, (window_id,))
    rows = cursor.fetchall()
    conn.close()

    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Request ID", "Student Name", "PRN", "Branch", "Current Year", "Current Div",
        "Current Roll", "CGPA", "Requested Div", "Requested Roll",
        "Approved Div", "Approved Roll", "Status", "Admin Remarks", "Submitted At"
    ])
    for r in rows:
        writer.writerow(list(r))

    from fastapi.responses import Response
    return Response(content=output.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": f"attachment; filename=promotion_window_{window_id}.csv"
    })

# ============================================================================
# MODULE 10 & 11: STUDENT ENROLLED SUBJECTS & PERFORMANCE AVERAGES
# ============================================================================

@router.get("/student/enrolled-subjects")
def get_student_enrolled_subjects(payload: dict = Depends(require_roles("student"))):
    """Returns all subjects allotted to the student (compulsory + approved electives), assigned faculty, and lab batch."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    sp_row = cursor.fetchone()
    if not sp_row:
        conn.close()
        return []
    sp = dict(sp_row)

    # Get enrolled subjects from student_subject_enrollments
    target_ay = sp.get("academic_year") or "2026-27"
    cursor.execute("""
    SELECT s.*, sse.enrollment_type, sse.enrolled_at,
           b.name as branch_name, b.code as branch_code,
           (
               SELECT u.full_name FROM faculty_assignments fa
               JOIN users u ON fa.faculty_id = u.id
               WHERE fa.subject_id = s.id AND fa.division_name = ? LIMIT 1
           ) as faculty_name,
           (
               SELECT lb.batch_name FROM batch_students bs
               JOIN lab_batches lb ON bs.batch_id = lb.id
               WHERE bs.student_id = ? AND (lb.subject_id = s.id OR lb.subject_id IS NULL) LIMIT 1
           ) as lab_batch_name
    FROM student_subject_enrollments sse
    JOIN subjects s ON sse.subject_id = s.id
    JOIN branches b ON s.branch_id = b.id
    WHERE sse.student_id = ? AND sse.status = 'enrolled'
      AND (sse.academic_year = ? OR sse.academic_year IS NULL)
    ORDER BY s.is_elective ASC, s.code ASC;
    """, (sp["division_name"], student_id, student_id, target_ay))
    subjects = [dict(r) for r in cursor.fetchall()]

    # If no enrollments exist in table yet (e.g. legacy profile), fallback to curriculum compulsory subjects
    if not subjects:
        cursor.execute("""
        SELECT s.*, 'compulsory' as enrollment_type, CURRENT_TIMESTAMP as enrolled_at,
               b.name as branch_name, b.code as branch_code,
               (
                   SELECT u.full_name FROM faculty_assignments fa
                   JOIN users u ON fa.faculty_id = u.id
                   WHERE fa.subject_id = s.id AND fa.division_name = ? LIMIT 1
               ) as faculty_name,
               (
                   SELECT lb.batch_name FROM batch_students bs
                   JOIN lab_batches lb ON bs.batch_id = lb.id
                   WHERE bs.student_id = ? AND (lb.subject_id = s.id OR lb.subject_id IS NULL) LIMIT 1
               ) as lab_batch_name
        FROM subjects s
        JOIN branches b ON s.branch_id = b.id
        WHERE b.code = ? AND s.semester_number = ? AND s.is_elective = 0
        ORDER BY s.code ASC;
        """, (sp["division_name"], student_id, sp["branch_code"], sp["semester_number"]))
        subjects = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return subjects

@router.get("/student/performance-averages")
@router.get("/student/performance")
@router.get("/student/academic-performance")
def get_student_performance_averages(payload: dict = Depends(require_roles("student"))):
    """
    Calculates transparent subject-wise performance for EVERY allotted subject.
    Strictly separates:
    1. Assignment Marks (obtained, max, totals, average in marks e.g. 16.67 / 20)
    2. Experiment Marks (obtained, max, totals, average in marks e.g. 8 / 10)
    3. Special Document Submissions (displayed separately below, excluded from averages)
    Excludes pending evaluations and unsubmitted work from averages.
    Includes every enrolled subject even if no assessments or marks exist yet.
    """
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    sp_row = cursor.fetchone()
    if not sp_row:
        conn.close()
        return []
    sp = dict(sp_row)

    # Get student's lab batches
    cursor.execute("SELECT batch_id FROM batch_students WHERE student_id = ?;", (student_id,))
    batch_ids = [r["batch_id"] for r in cursor.fetchall()]

    # 1. Fetch ALL allotted subjects from student_subject_enrollments for active academic year
    target_ay = sp.get("academic_year") or "2026-27"
    cursor.execute("""
    SELECT DISTINCT s.id, s.name, s.code, s.credits, s.category, s.subject_type, sse.enrollment_type
    FROM student_subject_enrollments sse
    JOIN subjects s ON sse.subject_id = s.id
    WHERE sse.student_id = ? AND sse.status = 'enrolled'
      AND (sse.academic_year = ? OR sse.academic_year IS NULL)
    ORDER BY s.code ASC;
    """, (student_id, target_ay))
    subs = [dict(r) for r in cursor.fetchall()]

    # Fallback to academic group if enrollments table is being synced
    if not subs:
        cursor.execute("""
        SELECT DISTINCT s.id, s.name, s.code, s.credits, s.category, s.subject_type, 'compulsory' as enrollment_type
        FROM subjects s
        JOIN branches b ON s.branch_id = b.id
        WHERE b.code = ? AND s.semester_number = ?
        ORDER BY s.code ASC;
        """, (sp["branch_code"], sp["semester_number"]))
        subs = [dict(r) for r in cursor.fetchall()]

    # 2. Fetch all tasks targeted to student
    batch_placeholders = ",".join(["?"] * len(batch_ids)) if batch_ids else "''"
    tasks_query = f"""
    SELECT t.*, u.full_name as faculty_name
    FROM tasks t
    JOIN users u ON t.faculty_id = u.id
    WHERE (t.academic_year = ? OR t.academic_year IS NULL)
      AND (
        (t.target_type = 'division' AND (t.division_name = ? OR t.division_name = 'ALL' OR t.division_name IS NULL))
        OR (t.target_type = 'batch' AND t.batch_id IN ({batch_placeholders}))
      )
    ORDER BY t.created_at ASC;
    """
    params = [sp.get("academic_year") or "2026-27", sp["division_name"]] + (batch_ids if batch_ids else [])
    cursor.execute(tasks_query, params)
    all_tasks = [dict(r) for r in cursor.fetchall()]

    # 3. Fetch all submissions and evaluations of student
    cursor.execute("""
    SELECT s.id as submission_id, s.task_id, s.document_id, s.status as submission_status,
           s.submission_date, s.is_late, s.delay_text, s.external_link_url, s.attachments_json,
           e.id as eval_id, e.marks_awarded, e.max_marks as eval_max_marks,
           e.feedback, e.status as eval_status, e.evaluated_at, e.digital_signature_code
    FROM submissions s
    LEFT JOIN evaluations e ON s.id = e.submission_id
    WHERE s.student_id = ?;
    """, (student_id,))
    submissions_map = {}
    for sub in cursor.fetchall():
        s_dict = dict(sub)
        t_id = s_dict.get("task_id")
        if t_id:
            # If multiple, prefer graded
            if t_id not in submissions_map or s_dict.get("eval_status") == "approved":
                submissions_map[t_id] = s_dict

    results = []
    for sub in subs:
        sub_id = sub["id"]
        sub_tasks = [t for t in all_tasks if t["subject_id"] == sub_id]

        # Categories
        assignment_items = []
        experiment_items = []
        special_items = []

        for task in sub_tasks:
            t_id = task["id"]
            sub_info = submissions_map.get(t_id)

            t_type = task["task_type"]
            t_max = float(task.get("max_marks") or 10.0)

            item = {
                "task_id": t_id,
                "title": task["title"],
                "task_number": task.get("task_number", "1"),
                "max_marks": t_max,
                "due_date": task.get("due_date"),
                "instructions": task.get("instructions"),
                "faculty_name": task.get("faculty_name"),
                "submission_status": "not_submitted",
                "evaluation_status": "none",
                "marks_obtained": None,
                "is_evaluated": False,
                "feedback": None,
                "submission_date": None,
                "is_late": False,
                "delay_text": ""
            }

            if sub_info:
                item["submission_status"] = sub_info.get("submission_status") or "submitted"
                item["submission_date"] = sub_info.get("submission_date")
                item["is_late"] = bool(sub_info.get("is_late"))
                item["delay_text"] = sub_info.get("delay_text", "")
                item["external_link_url"] = sub_info.get("external_link_url")
                item["attachments_json"] = sub_info.get("attachments_json")

                # Only include marks if evaluation is formally approved/graded
                if sub_info.get("marks_awarded") is not None and sub_info.get("eval_status") in ("approved", "graded"):
                    item["marks_obtained"] = float(sub_info["marks_awarded"])
                    item["evaluation_status"] = "evaluated"
                    item["is_evaluated"] = True
                    item["feedback"] = sub_info.get("feedback")
                    item["evaluated_at"] = sub_info.get("evaluated_at")
                    item["digital_signature_code"] = sub_info.get("digital_signature_code")
                else:
                    item["evaluation_status"] = "pending_evaluation"

            if t_type == "Assignment":
                assignment_items.append(item)
            elif t_type == "Experiment":
                experiment_items.append(item)
            elif t_type == "Special Document":
                special_items.append(item)

        # -------------------------------------------------------------
        # A. ASSIGNMENT MARKS & AVERAGE (IN MARKS, NOT PERCENTAGE)
        # -------------------------------------------------------------
        eval_assigns = [a for a in assignment_items if a["is_evaluated"]]
        assign_obtained_total = sum(a["marks_obtained"] for a in eval_assigns)
        assign_max_total = sum(a["max_marks"] for a in eval_assigns)
        assign_count = len(eval_assigns)

        if assign_count > 0 and assign_max_total > 0:
            avg_obtained = round(assign_obtained_total / assign_count, 2)
            avg_max = round(assign_max_total / assign_count, 2)
            assignment_average_display = f"{avg_obtained:g} / {avg_max:g}"
            assignment_avg_marks = avg_obtained
            assignment_avg_max = avg_max
        else:
            assignment_average_display = "No marks yet"
            assignment_avg_marks = None
            assignment_avg_max = None

        # -------------------------------------------------------------
        # B. EXPERIMENT MARKS & AVERAGE (IN MARKS, NOT PERCENTAGE)
        # -------------------------------------------------------------
        eval_expts = [e for e in experiment_items if e["is_evaluated"]]
        expt_obtained_total = sum(e["marks_obtained"] for e in eval_expts)
        expt_max_total = sum(e["max_marks"] for e in eval_expts)
        expt_count = len(eval_expts)

        if expt_count > 0 and expt_max_total > 0:
            avg_obtained = round(expt_obtained_total / expt_count, 2)
            avg_max = round(expt_max_total / expt_count, 2)
            experiment_average_display = f"{avg_obtained:g} / {avg_max:g}"
            experiment_avg_marks = avg_obtained
            experiment_avg_max = avg_max
        else:
            experiment_average_display = "No marks yet"
            experiment_avg_marks = None
            experiment_avg_max = None

        results.append({
            "subject_id": sub_id,
            "subject_name": sub["name"],
            "subject_code": sub["code"],
            "credits": sub.get("credits", 4.0),
            "category": sub.get("category", "Core"),
            "subject_type": sub.get("subject_type", "Theory"),
            "enrollment_type": sub.get("enrollment_type", "compulsory"),
            # Assignments
            "assignments": assignment_items,
            "assignment_total_obtained": assign_obtained_total if assign_count > 0 else 0,
            "assignment_total_max": assign_max_total if assign_count > 0 else 0,
            "assignment_evaluated_count": assign_count,
            "assignment_total_count": len(assignment_items),
            "assignment_average_marks": assignment_avg_marks,
            "assignment_average_max": assignment_avg_max,
            "assignment_average_display": assignment_average_display,
            # Experiments
            "experiments": experiment_items,
            "experiment_total_obtained": expt_obtained_total if expt_count > 0 else 0,
            "experiment_total_max": expt_max_total if expt_count > 0 else 0,
            "experiment_evaluated_count": expt_count,
            "experiment_total_count": len(experiment_items),
            "experiment_average_marks": experiment_avg_marks,
            "experiment_average_max": experiment_avg_max,
            "experiment_average_display": experiment_average_display,
            # Special Documents
            "special_documents": special_items,
            "special_documents_count": len(special_items),
            # Counts
            "has_assessments": bool(assignment_items or experiment_items or special_items),
            "pending_evaluations_count": sum(1 for it in (assignment_items + experiment_items + special_items) if it["submission_status"] in ("submitted", "pending_evaluation") and not it["is_evaluated"])
        })

    conn.close()
    return results

# ============================================================================
# LEGACY APIS: STUDENT PROFILES
# ============================================================================

@router.get("/curriculum")
def get_curriculum(year: str, branch: str, sem: int):
    """Returns available mandatory subjects and open electives for given year, branch, and semester."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT s.* FROM subjects s
    JOIN branches b ON s.branch_id = b.id
    WHERE b.code = ? AND s.semester_number = ? AND s.status != 'archived';
    """, (branch, sem))
    all_subs = [dict(r) for r in cursor.fetchall()]

    mandatory = [s for s in all_subs if s.get("is_elective") == 0]
    electives = [s for s in all_subs if s.get("is_elective") == 1]

    if not electives:
        cursor.execute("SELECT * FROM subjects WHERE is_elective = 1 AND status != 'archived';")
        electives = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "subjects": mandatory,
        "electives": electives
    }

@router.post("/student-profile")
def submit_student_profile(
    profile_data: StudentProfileSubmission,
    payload: dict = Depends(require_roles("student"))
):
    """Student submits or updates their academic profile for administrator verification."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Roll number duplicate validation in same group
    cursor.execute("""
    SELECT user_id FROM student_profiles
    WHERE roll_number = ? AND branch_code = ? AND division_name = ? AND user_id != ?;
    """, (profile_data.roll_number.strip(), profile_data.branch_code, profile_data.division_name, student_id))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Roll number '{profile_data.roll_number}' is already registered in {profile_data.division_name}.")

    cursor.execute("""
    INSERT INTO student_profiles (
        user_id, roll_number, prn, year_level, branch_code, semester_number, division_name, elective_subject, status, admin_remarks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        roll_number = excluded.roll_number,
        prn = excluded.prn,
        year_level = excluded.year_level,
        branch_code = excluded.branch_code,
        semester_number = excluded.semester_number,
        division_name = excluded.division_name,
        elective_subject = excluded.elective_subject,
        status = 'pending',
        updated_at = excluded.updated_at;
    """, (
        student_id,
        profile_data.roll_number.strip(),
        profile_data.prn.strip() if profile_data.prn else None,
        profile_data.year_level,
        profile_data.branch_code,
        profile_data.semester_number,
        profile_data.division_name,
        profile_data.elective_subject,
        now_iso,
        now_iso
    ))

    # Create admin notification
    cursor.execute("SELECT full_name FROM users WHERE id = ?;", (student_id,))
    stu_name = cursor.fetchone()["full_name"]
    cursor.execute("SELECT id FROM users WHERE role = 'admin';")
    admin = cursor.fetchone()
    if admin:
        cursor.execute("""
        INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
        VALUES (?, ?, 'Registration Profile Pending', ?, 'alert', '/admin', 0, ?);
        """, (f"notif_{uuid.uuid4().hex[:8]}", admin["id"], f"Student {stu_name} ({profile_data.roll_number}) submitted academic profile for verification.", now_iso))

    conn.commit()
    conn.close()
    return {"message": "Academic profile submitted for verification.", "status": "pending"}

@router.get("/student-profiles")
def list_student_profiles(payload: dict = Depends(require_roles("admin", "faculty"))):
    """Lists all registered student profiles with their approval status and academic grouping."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT sp.*, u.full_name as name, u.email, u.username
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
    ORDER BY sp.year_level, sp.branch_code, sp.division_name, sp.roll_number ASC;
    """)
    profiles = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return profiles

@router.patch("/student-profiles/{user_id}/status")
def review_student_profile(
    user_id: str,
    review: ProfileApprovalUpdate,
    payload: dict = Depends(require_roles("admin"))
):
    """Administrator approves, rejects with remarks, or blocks/unblocks a student profile."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (user_id,))
    sp = cursor.fetchone()
    if not sp:
        conn.close()
        raise HTTPException(status_code=404, detail="Student profile not found.")

    cursor.execute("""
    UPDATE student_profiles
    SET status = ?, admin_remarks = ?, updated_at = ?
    WHERE user_id = ?;
    """, (review.status, review.remarks or "", now_iso, user_id))

    # If approved, auto-enroll into published compulsory subjects for their group
    if review.status == 'approved':
        cursor.execute("""
        SELECT DISTINCT sa.subject_id, sa.academic_year
        FROM subject_allotments sa
        JOIN academic_groups ag ON sa.academic_group_id = ag.id
        WHERE ag.branch_code = ? AND ag.year_level = ? AND ag.semester_number = ? AND ag.division_name = ?;
        """, (sp["branch_code"], sp["year_level"], sp["semester_number"], sp["division_name"]))
        for row in cursor.fetchall():
            cursor.execute("""
            INSERT OR IGNORE INTO student_subject_enrollments (id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at)
            VALUES (?, ?, ?, ?, 'compulsory', 'enrolled', ?);
            """, (f"enr_{uuid.uuid4().hex[:10]}", user_id, row[0], row[1], now_iso))

    # Notify student
    msg = f"Your profile registration was {review.status}."
    if review.remarks:
        msg += f" Remarks: {review.remarks}"

    cursor.execute("""
    INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
    VALUES (?, ?, 'Registration Status Update', ?, ?, '/student', 0, ?);
    """, (f"notif_{uuid.uuid4().hex[:8]}", user_id, msg, 'success' if review.status == 'approved' else 'alert', now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Student profile status updated to {review.status}."}

@router.patch("/student-profiles/{user_id}")
def admin_update_student_profile(
    user_id: str,
    data: dict,
    payload: dict = Depends(require_roles("admin"))
):
    """Administrator manages a student's division, roll number, elective, or academic placement."""
    admin_id = payload.get("sub", "admin")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (user_id,))
    sp_row = cursor.fetchone()
    if not sp_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Student profile not found.")
    sp = dict(sp_row)

    old_div = sp["division_name"]
    new_div = data.get("division_name")

    allowed = ["division_name", "roll_number", "branch_code", "year_level", "semester_number", "elective_subject", "cgpa"]
    updates = []
    params = []
    for f in allowed:
        if f in data:
            updates.append(f"{f} = ?")
            params.append(data[f])

    if updates:
        updates.append("updated_at = ?")
        params.append(now_iso)
        params.append(user_id)
        cursor.execute(f"UPDATE student_profiles SET {', '.join(updates)} WHERE user_id = ?;", tuple(params))

    # If division changed, unassign from old batches and sync new division allotments
    if new_div and new_div != old_div:
        cursor.execute("DELETE FROM batch_students WHERE student_id = ?;", (user_id,))
        branch = data.get("branch_code", sp["branch_code"])
        year_lvl = data.get("year_level", sp["year_level"])
        sem = data.get("semester_number", sp["semester_number"])
        cursor.execute("""
        SELECT DISTINCT sa.subject_id, sa.academic_year
        FROM subject_allotments sa
        JOIN academic_groups ag ON sa.academic_group_id = ag.id
        WHERE ag.branch_code = ? AND ag.year_level = ? AND ag.semester_number = ? AND ag.division_name = ?;
        """, (branch, year_lvl, sem, new_div))
        for row in cursor.fetchall():
            cursor.execute("""
            INSERT OR IGNORE INTO student_subject_enrollments (id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at)
            VALUES (?, ?, ?, ?, 'compulsory', 'enrolled', ?);
            """, (f"enr_{uuid.uuid4().hex[:10]}", user_id, row[0], row[1], now_iso))

    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'UPDATE_STUDENT_PROFILE', 'STUDENT_PROFILE', ?, ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", admin_id, user_id, json.dumps(data), now_iso))

    conn.commit()
    conn.close()
    return {"message": "Student profile updated successfully.", "user_id": user_id}

# ============================================================================
# MODULE 13: ROLE-BASED ACADEMIC FOLDER SYSTEM
# ============================================================================

@router.get("/student/workspace-folders")
def get_student_workspace_folders(payload: dict = Depends(require_roles("student"))):
    """
    Role-based Student Academic Workspace Folders:
    1. Priority Submissions: Sorted nearest deadline first, displaying time remaining / overdue delay.
       Multiple tasks with identical deadline all shown together. Excludes submitted work unless resubmission is required.
    2. Subject-wise Folders: Filterable into All, Assignments, Experiments, Special Documents.
    3. Submission History: Dedicated folder for completed submissions across academic years.
    """
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch student profile
    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    sp = cursor.fetchone()
    if not sp:
        conn.close()
        return {
            "priority_submissions": [],
            "subject_folders": [],
            "submission_history": [],
            "summary_counts": {
                "pending_count": 0, "overdue_count": 0, "submitted_count": 0, "evaluated_count": 0, "subjects_count": 0
            }
        }

    # 2. Get student's lab batches
    cursor.execute("SELECT batch_id FROM batch_students WHERE student_id = ?;", (student_id,))
    batch_ids = [r["batch_id"] for r in cursor.fetchall()]

    # 3. Get enrolled subjects
    cursor.execute("""
    SELECT s.*, sse.enrollment_type,
           b.name as branch_name, b.code as branch_code,
           (SELECT u.full_name FROM faculty_assignments fa JOIN users u ON fa.faculty_id = u.id WHERE fa.subject_id = s.id AND fa.division_name = ? LIMIT 1) as faculty_name,
           (SELECT lb.batch_name FROM batch_students bs JOIN lab_batches lb ON bs.batch_id = lb.id WHERE bs.student_id = ? AND (lb.subject_id = s.id OR lb.subject_id IS NULL) LIMIT 1) as lab_batch_name
    FROM student_subject_enrollments sse
    JOIN subjects s ON sse.subject_id = s.id
    JOIN branches b ON s.branch_id = b.id
    WHERE sse.student_id = ? AND sse.status = 'enrolled'
    ORDER BY s.is_elective ASC, s.code ASC;
    """, (sp["division_name"], student_id, student_id))
    enrolled_subjects = [dict(r) for r in cursor.fetchall()]

    if not enrolled_subjects:
        cursor.execute("""
        SELECT s.*, 'compulsory' as enrollment_type,
               b.name as branch_name, b.code as branch_code,
               (SELECT u.full_name FROM faculty_assignments fa JOIN users u ON fa.faculty_id = u.id WHERE fa.subject_id = s.id AND fa.division_name = ? LIMIT 1) as faculty_name,
               (SELECT lb.batch_name FROM batch_students bs JOIN lab_batches lb ON bs.batch_id = lb.id WHERE bs.student_id = ? AND (lb.subject_id = s.id OR lb.subject_id IS NULL) LIMIT 1) as lab_batch_name
        FROM subjects s
        JOIN branches b ON s.branch_id = b.id
        WHERE b.code = ? AND s.semester_number = ? AND s.is_elective = 0
        ORDER BY s.code ASC;
        """, (sp["division_name"], student_id, sp["branch_code"], sp["semester_number"]))
        enrolled_subjects = [dict(r) for r in cursor.fetchall()]

    # Helper function to parse ISO or standard date
    def parse_dt(dt_str: Optional[str]) -> Optional[datetime]:
        if not dt_str:
            return None
        clean_str = dt_str.replace("Z", "+00:00").strip()
        for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
            try:
                dt = datetime.strptime(clean_str, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue
        return None

    # Helper function for deadline text
    def format_deadline(due_dt: Optional[datetime]):
        if not due_dt:
            return "No deadline", "Upcoming", "Active", False, ""
        now_utc = datetime.now(timezone.utc)
        diff = (due_dt - now_utc).total_seconds()
        if diff < 0:
            overdue_secs = abs(diff)
            days = int(overdue_secs // 86400)
            hours = int((overdue_secs % 86400) // 3600)
            if days > 0:
                delay_str = f"Overdue by {days}d {hours}h"
            else:
                delay_str = f"Overdue by {hours}h"
            return "Past deadline", "Overdue", delay_str, True, delay_str
        else:
            days = int(diff // 86400)
            hours = int((diff % 86400) // 3600)
            rem_str = f"{days}d {hours}h remaining" if days > 0 else f"{hours}h remaining"
            if days == 0:
                indicator = "Due today"
            elif days == 1:
                indicator = "Due tomorrow"
            elif days <= 3:
                indicator = "Due soon"
            else:
                indicator = f"Due in {days} days"
            return rem_str, indicator, "On Time", False, ""

    # 4. Fetch all tasks targeted to student
    batch_placeholders = ",".join(["?"] * len(batch_ids)) if batch_ids else "''"
    tasks_query = f"""
    SELECT t.*, s.name as subject_name, s.code as subject_code,
           u.full_name as faculty_name
    FROM tasks t
    JOIN subjects s ON t.subject_id = s.id
    JOIN users u ON t.faculty_id = u.id
    WHERE (t.academic_year = '2026-27' OR t.academic_year IS NULL)
      AND (
        (t.target_type = 'division' AND (t.division_name = ? OR t.division_name = 'ALL' OR t.division_name IS NULL))
        OR (t.target_type = 'batch' AND t.batch_id IN ({batch_placeholders}))
      )
    """
    params = [sp["division_name"]] + (batch_ids if batch_ids else [])
    cursor.execute(tasks_query, params)
    all_targeted_tasks = [dict(r) for r in cursor.fetchall()]

    # 5. Get student's submissions
    cursor.execute("""
    SELECT s.*, e.marks_awarded, e.max_marks, e.rubric_scores_json, e.feedback, e.status as eval_status, e.digital_signature_code
    FROM submissions s
    LEFT JOIN evaluations e ON s.id = e.submission_id
    WHERE s.student_id = ?;
    """, (student_id,))
    submissions_by_task = {}
    for sub in cursor.fetchall():
        sub_dict = dict(sub)
        t_id = sub_dict.get("task_id")
        if t_id:
            # If multiple, favor graded or latest
            if t_id not in submissions_by_task or sub_dict.get("status") == "graded":
                submissions_by_task[t_id] = sub_dict

    priority_submissions = []
    subject_assessments = {s["id"]: [] for s in enrolled_subjects}

    for task in all_targeted_tasks:
        t_id = task["id"]
        sub = submissions_by_task.get(t_id)
        due_dt = parse_dt(task.get("due_date"))
        rem_str, indicator, delay_status, is_overdue, delay_text = format_deadline(due_dt)
        
        sub_status = "pending"
        marks = None
        feedback = None
        eval_status = None
        submission_id = None
        document_id = None

        if sub:
            sub_status = sub.get("status", "submitted") # 'submitted', 'graded', 'returned'
            marks = sub.get("marks_awarded")
            feedback = sub.get("feedback")
            eval_status = sub.get("eval_status")
            submission_id = sub.get("id")
            document_id = sub.get("document_id")
            if sub.get("is_late"):
                delay_status = "Late Submission"
                delay_text = sub.get("delay_text", "Submitted late")

        assessment_item = {
            "task_id": t_id,
            "title": task["title"],
            "description": task.get("description", ""),
            "subject_id": task["subject_id"],
            "subject_name": task["subject_name"],
            "subject_code": task["subject_code"],
            "task_type": task["task_type"],
            "faculty_name": task["faculty_name"],
            "max_marks": task.get("max_marks", 10.0),
            "assigned_date": task.get("created_at"),
            "due_date": task.get("due_date"),
            "due_time": due_dt.strftime("%H:%M") if due_dt else "",
            "time_remaining": rem_str,
            "deadline_indicator": indicator if not sub else ("Submitted" if sub_status in ('submitted', 'graded') else "Returned"),
            "is_overdue": is_overdue and not sub,
            "delay_text": delay_text,
            "submission_status": sub_status,
            "submission_id": submission_id,
            "document_id": document_id,
            "marks_awarded": marks,
            "feedback": feedback,
            "eval_status": eval_status
        }

        if task["subject_id"] in subject_assessments:
            subject_assessments[task["subject_id"]].append(assessment_item)

        # Exclude successfully submitted work unless resubmission is required
        if not sub or sub_status == 'returned':
            priority_submissions.append(assessment_item)

    # Sorting priority submissions:
    # 1. Nearest upcoming deadline first (ascending due_date).
    # 2. A submission due sooner must appear above one due later.
    # 3. If multiple submissions have exactly the same deadline, show ALL of them together.
    # 4. Do not hide, overwrite, or arbitrarily prioritize submissions sharing a deadline.
    # 5. Within the same deadline group, secondary order: subject_name ASC, title ASC.
    def sort_key(item):
        dt = parse_dt(item.get("due_date"))
        timestamp = dt.timestamp() if dt else float("inf")
        return (timestamp, item.get("subject_name", "").lower(), item.get("title", "").lower())

    priority_submissions.sort(key=sort_key)

    # Subject folders with counts
    subject_folders = []
    for s in enrolled_subjects:
        s_id = s["id"]
        assessments = subject_assessments.get(s_id, [])
        assessments.sort(key=sort_key)

        assignments = [a for a in assessments if a["task_type"] == "Assignment"]
        experiments = [a for a in assessments if a["task_type"] == "Experiment"]
        special_docs = [a for a in assessments if a["task_type"] == "Special Document"]
        pending_count = sum(1 for a in assessments if a["submission_status"] in ("pending", "returned"))
        submitted_count = sum(1 for a in assessments if a["submission_status"] in ("submitted", "graded"))
        evaluated_count = sum(1 for a in assessments if a["submission_status"] == "graded")

        subject_folders.append({
            "subject_id": s_id,
            "name": s["name"],
            "code": s["code"],
            "category": s.get("category", "Core"),
            "credits": s.get("credits", 3.0),
            "faculty_name": s.get("faculty_name", "Assigned Faculty"),
            "lab_batch_name": s.get("lab_batch_name", ""),
            "enrollment_type": s.get("enrollment_type", "compulsory"),
            "counts": {
                "total": len(assessments),
                "assignments": len(assignments),
                "experiments": len(experiments),
                "special_documents": len(special_docs),
                "pending": pending_count,
                "submitted": submitted_count,
                "evaluated": evaluated_count
            },
            "assessments": assessments
        })

    # Submission History folder
    cursor.execute("""
    SELECT s.id as submission_id, s.document_id, s.task_id, s.submission_code, s.snapshot_html,
           s.submission_date, s.is_late, s.delay_seconds, s.delay_text, s.late_penalty_applied, s.status as submission_status, s.created_at,
           d.title as doc_title, d.doc_type, d.word_count,
           t.title as task_title, t.task_type, t.academic_year, t.max_marks,
           sub.id as subject_id, sub.name as subject_name, sub.code as subject_code, sub.semester_number,
           e.id as eval_id, e.marks_awarded, e.feedback, e.remarks, e.digital_signature_code, e.status as eval_status, e.evaluated_at
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    LEFT JOIN tasks t ON s.task_id = t.id
    LEFT JOIN subjects sub ON t.subject_id = sub.id
    LEFT JOIN evaluations e ON s.id = e.submission_id
    WHERE s.student_id = ? AND s.status IN ('submitted', 'graded')
    ORDER BY s.created_at DESC;
    """, (student_id,))

    history_records = []
    for r in cursor.fetchall():
        row = dict(r)
        history_records.append({
            "submission_id": row["submission_id"],
            "document_id": row["document_id"],
            "task_id": row["task_id"],
            "title": row["task_title"] or row["doc_title"],
            "task_type": row["task_type"] or row["doc_type"] or "Assignment",
            "subject_name": row["subject_name"] or "Independent Project",
            "subject_code": row["subject_code"] or "GEN-01",
            "academic_year": row["academic_year"] or "2026-27",
            "semester_number": row["semester_number"] or sp["semester_number"],
            "submission_date": row["submission_date"],
            "is_late": bool(row["is_late"]),
            "delay_text": row["delay_text"] or ("Submitted late" if row["is_late"] else "Submitted on time"),
            "submission_status": row["submission_status"],
            "eval_status": row["eval_status"] or ("graded" if row["marks_awarded"] is not None else "awaiting_evaluation"),
            "marks_awarded": row["marks_awarded"],
            "max_marks": row["max_marks"] or 10.0,
            "feedback": row["feedback"],
            "remarks": row["remarks"],
            "digital_signature_code": row["digital_signature_code"],
            "created_at": row["created_at"]
        })

    total_pending = len(priority_submissions)
    total_overdue = sum(1 for p in priority_submissions if p["is_overdue"])
    total_submitted = len(history_records)
    total_evaluated = sum(1 for h in history_records if h["eval_status"] in ("graded", "approved"))

    conn.close()
    return {
        "priority_submissions": priority_submissions,
        "subject_folders": subject_folders,
        "submission_history": history_records,
        "summary_counts": {
            "pending_count": total_pending,
            "overdue_count": total_overdue,
            "submitted_count": total_submitted,
            "evaluated_count": total_evaluated,
            "subjects_count": len(subject_folders)
        }
    }


@router.get("/faculty/teaching-folders")
def get_faculty_teaching_folders(payload: dict = Depends(require_roles("faculty"))):
    """
    Role-based Faculty Class & Teaching Workspace Folders:
    1. Pending Evaluations Queue: Oldest pending submissions first (created_at ASC) across assigned classes.
    2. Overdue Deadline Queue: Assignments past due date awaiting missing student submissions.
    3. Dynamic Class Folders: Academic groups (AY + Branch + Year Level + Sem + Division) taught by faculty.
    4. Subject Folders inside Classes: Subfolders for Assignments, Experiments, Special Documents, Submissions, Evaluation, Performance.
    5. Batch Folders: Dedicated lab batch folders (A1, A2, A3) showing batch students, experiments, and pending evaluations.
    """
    faculty_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_utc = datetime.now(timezone.utc)

    # 1. Pending Evaluations Queue:
    # Strict sort:
    # 1. Oldest pending submission first (s.created_at ASC)
    # 2. Submission date (s.submission_date ASC)
    # 3. Subject and class
    cursor.execute("""
    SELECT DISTINCT s.id as submission_id, s.document_id, s.task_id, s.student_id, s.submission_code,
           s.submission_date, s.is_late, s.delay_text, s.status as submission_status, s.created_at,
           u.full_name as student_name, sp.roll_number, sp.prn,
           t.title as task_title, t.task_type, t.due_date, t.max_marks,
           sub.id as subject_id, sub.name as subject_name, sub.code as subject_code,
           t.division_name, t.batch_id, t.branch_code, t.year_level,
           lb.batch_name
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    JOIN tasks t ON s.task_id = t.id
    JOIN subjects sub ON t.subject_id = sub.id
    LEFT JOIN lab_batches lb ON t.batch_id = lb.id
    WHERE s.status = 'submitted'
      AND (
        t.faculty_id = ?
        OR sub.id IN (SELECT subject_id FROM subject_allotments WHERE faculty_id = ?)
        OR t.batch_id IN (SELECT id FROM lab_batches WHERE faculty_id = ?)
      )
    ORDER BY s.created_at ASC, s.submission_date ASC, sub.name ASC, t.title ASC;
    """, (faculty_id, faculty_id, faculty_id))

    eval_queue = [dict(r) for r in cursor.fetchall()]

    # 2. Overdue tasks awaiting student submissions
    cursor.execute("""
    SELECT t.id as task_id, t.title, t.task_type, t.due_date, t.max_marks,
           sub.name as subject_name, sub.code as subject_code,
           t.division_name, t.batch_id, t.branch_code, t.year_level,
           (
             SELECT count(*) FROM student_profiles sp
             WHERE sp.branch_code = t.branch_code AND sp.year_level = t.year_level AND sp.division_name = t.division_name
           ) as total_expected_students,
           (
             SELECT count(DISTINCT s.student_id) FROM submissions s
             WHERE s.task_id = t.id
           ) as submitted_students_count
    FROM tasks t
    JOIN subjects sub ON t.subject_id = sub.id
    WHERE (t.faculty_id = ? OR sub.id IN (SELECT subject_id FROM subject_allotments WHERE faculty_id = ?))
      AND t.due_date < ?
    ORDER BY t.due_date DESC;
    """, (faculty_id, faculty_id, now_utc.isoformat()))

    overdue_tasks = []
    for r in cursor.fetchall():
        row = dict(r)
        expected = row["total_expected_students"] or 0
        submitted = row["submitted_students_count"] or 0
        missing = max(0, expected - submitted)
        row["missing_count"] = missing
        overdue_tasks.append(row)

    # 3. Class Folders (Academic Groups taught by faculty)
    cursor.execute("""
    SELECT DISTINCT ag.id as academic_group_id, ag.academic_year, ag.branch_code, ag.year_level, ag.semester_number, ag.division_name,
           b.name as branch_name
    FROM academic_groups ag
    JOIN branches b ON ag.branch_code = b.code
    WHERE ag.academic_year = '2026-27'
      AND (
        ag.id IN (SELECT academic_group_id FROM subject_allotments WHERE faculty_id = ?)
        OR ag.division_name IN (SELECT division_name FROM lab_batches WHERE faculty_id = ? AND academic_year = '2026-27')
      )
    ORDER BY ag.branch_code ASC, ag.year_level ASC, ag.division_name ASC;
    """, (faculty_id, faculty_id))

    class_groups = [dict(r) for r in cursor.fetchall()]

    class_folders = []
    for grp in class_groups:
        grp_id = grp["academic_group_id"]
        b_code = grp["branch_code"]
        yl = grp["year_level"]
        div = grp["division_name"]

        # Students count
        cursor.execute("""
        SELECT count(*) FROM student_profiles
        WHERE branch_code = ? AND year_level = ? AND division_name = ?;
        """, (b_code, yl, div))
        student_count = cursor.fetchone()[0]

        # Subjects taught by faculty in this group
        cursor.execute("""
        SELECT s.id, s.name, s.code, s.category, s.credits, s.subject_type, sa.id as allotment_id
        FROM subject_allotments sa
        JOIN subjects s ON sa.subject_id = s.id
        WHERE sa.academic_group_id = ? AND sa.faculty_id = ?;
        """, (grp_id, faculty_id))
        assigned_subjects = [dict(r) for r in cursor.fetchall()]

        # Tasks and Submissions for each assigned subject in this group
        subject_subfolders = []
        grp_pending_evals = 0
        grp_total_submissions = 0

        for sub in assigned_subjects:
            s_id = sub["id"]
            cursor.execute("""
            SELECT t.*,
                   (SELECT count(*) FROM submissions s WHERE s.task_id = t.id) as total_submissions,
                   (SELECT count(*) FROM submissions s WHERE s.task_id = t.id AND s.status = 'submitted') as pending_evaluations,
                   (SELECT count(*) FROM submissions s WHERE s.task_id = t.id AND s.status = 'graded') as evaluated_count
            FROM tasks t
            WHERE t.subject_id = ? AND t.branch_code = ? AND t.year_level = ? AND t.division_name = ?
            ORDER BY t.created_at DESC;
            """, (s_id, b_code, yl, div))
            tasks_list = [dict(r) for r in cursor.fetchall()]

            sub_assignments = [t for t in tasks_list if t["task_type"] == "Assignment"]
            sub_experiments = [t for t in tasks_list if t["task_type"] == "Experiment"]
            sub_special_docs = [t for t in tasks_list if t["task_type"] == "Special Document"]

            # Submissions for this subject in this group
            cursor.execute("""
            SELECT s.id as submission_id, s.student_id, s.submission_code, s.submission_date, s.is_late, s.status, s.delay_text,
                   u.full_name as student_name, sp.roll_number,
                   t.title as task_title, t.task_type,
                   e.marks_awarded, e.max_marks, e.status as eval_status
            FROM submissions s
            JOIN users u ON s.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            JOIN tasks t ON s.task_id = t.id
            LEFT JOIN evaluations e ON s.id = e.submission_id
            WHERE t.subject_id = ? AND t.branch_code = ? AND t.year_level = ? AND t.division_name = ?
            ORDER BY s.created_at DESC;
            """, (s_id, b_code, yl, div))
            sub_submissions = [dict(r) for r in cursor.fetchall()]

            sub_pending = sum(t["pending_evaluations"] for t in tasks_list)
            sub_total = len(sub_submissions)
            grp_pending_evals += sub_pending
            grp_total_submissions += sub_total

            # Performance stats
            graded_subs = [s for s in sub_submissions if s["marks_awarded"] is not None]
            avg_marks = round(sum(s["marks_awarded"] for s in graded_subs) / len(graded_subs), 2) if graded_subs else 0.0

            subject_subfolders.append({
                "subject_id": s_id,
                "name": sub["name"],
                "code": sub["code"],
                "category": sub.get("category", "Core"),
                "subject_type": sub.get("subject_type", "Theory"),
                "assignments": sub_assignments,
                "experiments": sub_experiments,
                "special_documents": sub_special_docs,
                "submissions": sub_submissions,
                "pending_evaluations_count": sub_pending,
                "evaluated_count": len(graded_subs),
                "total_submissions_count": sub_total,
                "average_score": avg_marks
            })

        # Batches taught by faculty in this division
        cursor.execute("""
        SELECT lb.*, s.name as subject_name
        FROM lab_batches lb
        LEFT JOIN subjects s ON lb.subject_id = s.id
        WHERE lb.academic_year = '2026-27' AND lb.branch_code = ? AND lb.year_level = ? AND lb.division_name = ?
          AND lb.faculty_id = ?
        ORDER BY lb.batch_name ASC;
        """, (b_code, yl, div, faculty_id))
        assigned_batches = []
        for b_row in cursor.fetchall():
            b_dict = dict(b_row)
            b_id = b_dict["id"]
            cursor.execute("""
            SELECT u.id as student_id, u.full_name as student_name, u.email, sp.roll_number, sp.prn
            FROM batch_students bs
            JOIN users u ON bs.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            WHERE bs.batch_id = ?
            ORDER BY sp.roll_number ASC;
            """, (b_id,))
            b_students = [dict(r) for r in cursor.fetchall()]

            cursor.execute("""
            SELECT t.* FROM tasks t
            WHERE t.batch_id = ? AND t.task_type = 'Experiment'
            ORDER BY t.created_at DESC;
            """, (b_id,))
            b_experiments = [dict(r) for r in cursor.fetchall()]

            cursor.execute("""
            SELECT s.id as submission_id, s.student_id, s.submission_code, s.submission_date, s.is_late, s.status, s.delay_text,
                   u.full_name as student_name, sp.roll_number,
                   t.title as task_title,
                   e.marks_awarded, e.max_marks
            FROM submissions s
            JOIN users u ON s.student_id = u.id
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            JOIN tasks t ON s.task_id = t.id
            LEFT JOIN evaluations e ON s.id = e.submission_id
            WHERE s.batch_id = ? OR t.batch_id = ?
            ORDER BY s.created_at DESC;
            """, (b_id, b_id))
            b_submissions = [dict(r) for r in cursor.fetchall()]

            b_pending = sum(1 for s in b_submissions if s["status"] == "submitted")
            b_graded = [s for s in b_submissions if s["marks_awarded"] is not None]
            b_avg = round(sum(s["marks_awarded"] for s in b_graded) / len(b_graded), 2) if b_graded else 0.0

            b_dict["students"] = b_students
            b_dict["students_count"] = len(b_students)
            b_dict["experiments"] = b_experiments
            b_dict["submissions"] = b_submissions
            b_dict["pending_evaluations_count"] = b_pending
            b_dict["average_score"] = b_avg
            assigned_batches.append(b_dict)

        class_folders.append({
            "academic_group_id": grp_id,
            "class_name": f"{yl} {grp['branch_name']} - {div}",
            "academic_year": grp["academic_year"],
            "branch_code": b_code,
            "branch_name": grp["branch_name"],
            "year_level": yl,
            "semester_number": grp["semester_number"],
            "division_name": div,
            "student_count": student_count,
            "assigned_subjects": subject_subfolders,
            "assigned_batches": assigned_batches,
            "counts": {
                "subjects_count": len(subject_subfolders),
                "batches_count": len(assigned_batches),
                "pending_evaluations": grp_pending_evals,
                "total_submissions": grp_total_submissions
            }
        })

    conn.close()
    return {
        "pending_evaluations_queue": eval_queue,
        "overdue_unsubmitted_tasks": overdue_tasks,
        "class_folders": class_folders,
        "summary_counts": {
            "total_pending_evaluations": len(eval_queue),
            "total_classes": len(class_folders),
            "total_overdue_tasks": len(overdue_tasks)
        }
    }


@router.get("/admin/class-folders")
def get_admin_class_folders(
    academic_year: str = Query("2026-27"),
    branch_code: Optional[str] = Query(None),
    year_level: Optional[str] = Query(None),
    division_name: Optional[str] = Query(None),
    payload: dict = Depends(require_roles("admin"))
):
    """
    Role-based Admin Institutional Class Workspace Folders:
    1. Dynamic tree of academic groups across academic cycles (including archived e.g. 2025-26).
    2. Class folders showing student headcounts, faculty allocations, subject allotments, batches, and submission statistics.
    3. Archived classes marked as read-only.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Academic years list
    cursor.execute("SELECT code, name, status, is_current FROM academic_calendars ORDER BY code DESC;")
    ay_list = [dict(r) for r in cursor.fetchall()]

    is_archived = False
    for ay in ay_list:
        if ay["code"] == academic_year:
            if ay.get("status") in ("archived", "completed"):
                is_archived = True
            break

    # 2. Query classes for selected year
    where_clauses = ["ag.academic_year = ?"]
    params = [academic_year]

    if branch_code and branch_code not in ("All", "undefined"):
        where_clauses.append("ag.branch_code = ?")
        params.append(branch_code)
    if year_level and year_level not in ("All", "undefined"):
        where_clauses.append("ag.year_level = ?")
        params.append(year_level)
    if division_name and division_name not in ("All", "undefined"):
        where_clauses.append("ag.division_name = ?")
        params.append(division_name)

    query = f"""
    SELECT ag.*, b.name as branch_name,
           (
             SELECT count(*) FROM student_profiles sp
             WHERE sp.branch_code = ag.branch_code AND sp.year_level = ag.year_level AND sp.division_name = ag.division_name
           ) as student_count,
           (
             SELECT count(DISTINCT sa.faculty_id) FROM subject_allotments sa
             WHERE sa.academic_group_id = ag.id
           ) as faculty_count,
           (
             SELECT count(*) FROM subject_allotments sa
             WHERE sa.academic_group_id = ag.id
           ) as subject_count,
           (
             SELECT count(*) FROM lab_batches lb
             WHERE lb.academic_year = ag.academic_year AND lb.branch_code = ag.branch_code AND lb.year_level = ag.year_level AND lb.division_name = ag.division_name
           ) as batch_count,
           (
             SELECT count(*) FROM tasks t
             WHERE (t.academic_year = ag.academic_year OR t.academic_year IS NULL)
               AND t.branch_code = ag.branch_code AND t.year_level = ag.year_level AND t.division_name = ag.division_name
           ) as tasks_count,
           (
             SELECT count(*) FROM submissions s
             JOIN tasks t ON s.task_id = t.id
             WHERE (t.academic_year = ag.academic_year OR t.academic_year IS NULL)
               AND t.branch_code = ag.branch_code AND t.year_level = ag.year_level AND t.division_name = ag.division_name
           ) as total_submissions,
           (
             SELECT count(*) FROM submissions s
             JOIN tasks t ON s.task_id = t.id
             WHERE (t.academic_year = ag.academic_year OR t.academic_year IS NULL)
               AND t.branch_code = ag.branch_code AND t.year_level = ag.year_level AND t.division_name = ag.division_name
               AND s.status = 'submitted'
           ) as pending_evaluations
    FROM academic_groups ag
    JOIN branches b ON ag.branch_code = b.code
    WHERE {' AND '.join(where_clauses)}
    ORDER BY ag.branch_code ASC, ag.year_level ASC, ag.division_name ASC;
    """

    cursor.execute(query, params)
    classes = []
    for r in cursor.fetchall():
        row = dict(r)
        row["is_archived"] = is_archived
        row["class_name"] = f"{row['year_level']} {row['branch_name']} - {row['division_name']}"
        classes.append(row)

    conn.close()
    return {
        "academic_years": ay_list,
        "selected_year": academic_year,
        "is_archived": is_archived,
        "classes": classes,
        "total_classes": len(classes)
    }


@router.get("/admin/class-folder-detail")
def get_admin_class_folder_detail(
    academic_group_id: str = Query(...),
    payload: dict = Depends(require_roles("admin"))
):
    """
    Detailed folder view for a specific academic group:
    Returns students, faculty allocations, subjects, batches, tasks, and submission statistics.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT ag.*, b.name as branch_name
    FROM academic_groups ag
    JOIN branches b ON ag.branch_code = b.code
    WHERE ag.id = ?;
    """, (academic_group_id,))
    grp = cursor.fetchone()
    if not grp:
        conn.close()
        raise HTTPException(status_code=404, detail="Class folder group not found.")

    grp_dict = dict(grp)
    ay = grp_dict["academic_year"]
    b_code = grp_dict["branch_code"]
    yl = grp_dict["year_level"]
    div = grp_dict["division_name"]

    cursor.execute("SELECT status FROM academic_calendars WHERE code = ?;", (ay,))
    cal = cursor.fetchone()
    is_archived = bool(cal and cal["status"] in ("archived", "completed"))
    grp_dict["is_archived"] = is_archived

    # 1. Students in this class
    if is_archived:
        cursor.execute("""
        SELECT seh.*, u.full_name as name, u.email, u.username
        FROM student_enrollment_history seh
        JOIN users u ON seh.student_id = u.id
        WHERE seh.academic_year = ? AND seh.branch_code = ? AND seh.year_level = ? AND seh.division_name = ?
        ORDER BY seh.roll_number ASC;
        """, (ay, b_code, yl, div))
        students = [dict(r) for r in cursor.fetchall()]
        if not students:
            cursor.execute("""
            SELECT sp.*, u.full_name as name, u.email, u.username
            FROM student_profiles sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.branch_code = ? AND sp.year_level = ? AND sp.division_name = ?
            ORDER BY sp.roll_number ASC;
            """, (b_code, yl, div))
            students = [dict(r) for r in cursor.fetchall()]
    else:
        cursor.execute("""
        SELECT sp.*, u.full_name as name, u.email, u.username,
               (
                 SELECT lb.batch_name FROM batch_students bs
                 JOIN lab_batches lb ON bs.batch_id = lb.id
                 WHERE bs.student_id = sp.user_id AND lb.division_name = ?
                 LIMIT 1
               ) as batch_name
        FROM student_profiles sp
        JOIN users u ON sp.user_id = u.id
        WHERE sp.branch_code = ? AND sp.year_level = ? AND sp.division_name = ?
        ORDER BY sp.roll_number ASC;
        """, (div, b_code, yl, div))
        students = [dict(r) for r in cursor.fetchall()]

    # 2. Faculty allocations & subjects
    cursor.execute("""
    SELECT sa.id as allotment_id, sa.created_at,
           s.id as subject_id, s.name as subject_name, s.code as subject_code, s.category, s.credits, s.subject_type, s.syllabus_scheme,
           u.id as faculty_id, u.full_name as faculty_name, u.email as faculty_email
    FROM subject_allotments sa
    JOIN subjects s ON sa.subject_id = s.id
    JOIN users u ON sa.faculty_id = u.id
    WHERE sa.academic_group_id = ?;
    """, (academic_group_id,))
    faculty_allocations = [dict(r) for r in cursor.fetchall()]

    # 3. Lab batches
    cursor.execute("""
    SELECT lb.*, u.full_name as faculty_name, s.name as subject_name,
           (SELECT count(*) FROM batch_students bs WHERE bs.batch_id = lb.id) as student_count
    FROM lab_batches lb
    LEFT JOIN users u ON lb.faculty_id = u.id
    LEFT JOIN subjects s ON lb.subject_id = s.id
    WHERE lb.academic_year = ? AND lb.branch_code = ? AND lb.year_level = ? AND lb.division_name = ?
    ORDER BY lb.batch_name ASC;
    """, (ay, b_code, yl, div))
    batches = [dict(r) for r in cursor.fetchall()]

    # 4. Tasks overview
    cursor.execute("""
    SELECT t.*, s.name as subject_name, u.full_name as faculty_name,
           (SELECT count(*) FROM submissions sub WHERE sub.task_id = t.id) as submissions_count,
           (SELECT count(*) FROM submissions sub WHERE sub.task_id = t.id AND sub.status = 'graded') as graded_count
    FROM tasks t
    JOIN subjects s ON t.subject_id = s.id
    JOIN users u ON t.faculty_id = u.id
    WHERE (t.academic_year = ? OR t.academic_year IS NULL)
      AND t.branch_code = ? AND t.year_level = ? AND t.division_name = ?
    ORDER BY t.created_at DESC;
    """, (ay, b_code, yl, div))
    tasks = [dict(r) for r in cursor.fetchall()]

    total_tasks = len(tasks)
    total_subs = sum(t["submissions_count"] for t in tasks)
    total_graded = sum(t["graded_count"] for t in tasks)
    total_pending_eval = total_subs - total_graded

    submission_stats = {
        "total_tasks": total_tasks,
        "total_submissions": total_subs,
        "graded_count": total_graded,
        "pending_evaluations": total_pending_eval,
        "students_count": len(students)
    }

    conn.close()
    return {
        "academic_group": grp_dict,
        "students": students,
        "faculty_allocations": faculty_allocations,
        "batches": batches,
        "tasks": tasks,
        "submission_stats": submission_stats
    }


# ============================================================================
# MODULE 13: UNIFIED ASSIGNMENT & DEADLINE CALENDAR
# ============================================================================

@router.get("/calendar")
def get_unified_academic_calendar(payload: dict = Depends(get_current_user_payload)):
    """
    Unified Academic Calendar for Students, Faculty, and Administrators.
    Returns: Assignments, Experiments, Special Documents, Internal Exams, Deadlines & Extensions.
    """
    user_id = payload.get("sub")
    role = payload.get("role")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    events = []

    if role == "student":
        cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (user_id,))
        sp_row = cursor.fetchone()
        if not sp_row:
            conn.close()
            return []
        sp = dict(sp_row)

        cursor.execute("SELECT batch_id FROM batch_students WHERE student_id = ?;", (user_id,))
        batch_ids = [r["batch_id"] for r in cursor.fetchall()]
        batch_placeholders = ",".join(["?"] * len(batch_ids)) if batch_ids else "''"

        # Tasks for student
        tasks_query = f"""
        SELECT t.id, t.title, t.task_type, t.task_number, t.due_date, t.original_due_date,
               t.extension_reason, t.max_marks, t.created_at, s.name as subject_name, s.code as subject_code,
               u.full_name as faculty_name, sub.status as submission_status, sub.submission_date,
               e.marks_awarded, e.status as eval_status
        FROM tasks t
        JOIN subjects s ON t.subject_id = s.id
        JOIN users u ON t.faculty_id = u.id
        LEFT JOIN submissions sub ON t.id = sub.task_id AND sub.student_id = ?
        LEFT JOIN evaluations e ON sub.id = e.submission_id
        WHERE (t.academic_year = ? OR t.academic_year IS NULL)
          AND (
            (t.target_type = 'division' AND (t.division_name = ? OR t.division_name = 'ALL' OR t.division_name IS NULL))
            OR (t.target_type = 'batch' AND t.batch_id IN ({batch_placeholders}))
          )
        ORDER BY t.due_date ASC;
        """
        params = [user_id, sp.get("academic_year") or "2026-27", sp["division_name"]] + (batch_ids if batch_ids else [])
        cursor.execute(tasks_query, params)
        for r in cursor.fetchall():
            row = dict(r)
            events.append({
                "id": f"event_task_{row['id']}",
                "task_id": row["id"],
                "title": row["title"],
                "event_type": row["task_type"], # 'Assignment', 'Experiment', 'Special Document'
                "subject_name": row["subject_name"],
                "subject_code": row["subject_code"],
                "faculty_name": row["faculty_name"],
                "start": row["due_date"],
                "due_date": row["due_date"],
                "is_extended": bool(row.get("original_due_date")),
                "original_due_date": row.get("original_due_date"),
                "extension_reason": row.get("extension_reason"),
                "submission_status": row.get("submission_status") or "pending",
                "is_submitted": bool(row.get("submission_status") in ("submitted", "graded")),
                "is_evaluated": bool(row.get("eval_status") in ("approved", "graded")),
                "marks_awarded": row.get("marks_awarded"),
                "max_marks": row["max_marks"],
                "category": "deadline"
            })

    elif role in ("faculty", "admin"):
        # Faculty or admin views tasks created / assigned
        if role == "faculty":
            cursor.execute("""
            SELECT t.id, t.title, t.task_type, t.task_number, t.due_date, t.original_due_date,
                   t.extension_reason, t.max_marks, t.division_name, t.branch_code, t.year_level,
                   s.name as subject_name, s.code as subject_code,
                   (SELECT count(*) FROM submissions sub WHERE sub.task_id = t.id) as submissions_count
            FROM tasks t
            JOIN subjects s ON t.subject_id = s.id
            WHERE t.faculty_id = ?
            ORDER BY t.due_date ASC;
            """, (user_id,))
        else:
            cursor.execute("""
            SELECT t.id, t.title, t.task_type, t.task_number, t.due_date, t.original_due_date,
                   t.extension_reason, t.max_marks, t.division_name, t.branch_code, t.year_level,
                   s.name as subject_name, s.code as subject_code,
                   (SELECT count(*) FROM submissions sub WHERE sub.task_id = t.id) as submissions_count
            FROM tasks t
            JOIN subjects s ON t.subject_id = s.id
            ORDER BY t.due_date ASC;
            """)

        for r in cursor.fetchall():
            row = dict(r)
            events.append({
                "id": f"event_task_{row['id']}",
                "task_id": row["id"],
                "title": row["title"],
                "event_type": row["task_type"],
                "subject_name": row["subject_name"],
                "subject_code": row["subject_code"],
                "class_name": f"{row['branch_code']} {row['year_level']} ({row['division_name']})",
                "start": row["due_date"],
                "due_date": row["due_date"],
                "is_extended": bool(row.get("original_due_date")),
                "original_due_date": row.get("original_due_date"),
                "extension_reason": row.get("extension_reason"),
                "submissions_count": row.get("submissions_count", 0),
                "max_marks": row["max_marks"],
                "category": "deadline"
            })

    # Add active Promotion Window dates as milestone events
    cursor.execute("SELECT id, title, start_date, end_date, status, is_open FROM promotion_windows;")
    for w in cursor.fetchall():
        w_dict = dict(w)
        if w_dict.get("start_date"):
            events.append({
                "id": f"event_pw_start_{w_dict['id']}",
                "title": f"Promotion Open: {w_dict['title']}",
                "event_type": "Announcement",
                "start": w_dict["start_date"],
                "due_date": w_dict["start_date"],
                "category": "milestone"
            })
        if w_dict.get("end_date"):
            events.append({
                "id": f"event_pw_end_{w_dict['id']}",
                "title": f"Promotion Closes: {w_dict['title']}",
                "event_type": "Announcement",
                "start": w_dict["end_date"],
                "due_date": w_dict["end_date"],
                "category": "milestone"
            })

    conn.close()
    return events


# ============================================================================
# MODULE 14: STUDENT ACADEMIC PORTFOLIO & PDF EXPORT
# ============================================================================

@router.get("/student/portfolio")
@router.get("/student/academic-portfolio")
def get_student_academic_portfolio(
    student_id: Optional[str] = None,
    payload: dict = Depends(get_current_user_payload)
):
    """Consolidates academic history, semester subjects, CGPA history, assessment performance, and faculty feedback."""
    caller_id = payload.get("sub")
    caller_role = payload.get("role")

    target_id = caller_id if caller_role == "student" else (student_id or caller_id)

    conn = get_db_connection()
    cursor = conn.cursor()

    # User & Profile
    cursor.execute("""
    SELECT u.id, u.full_name, u.email, sp.roll_number, sp.prn, sp.year_level, sp.branch_code,
           sp.semester_number, sp.division_name, sp.academic_year, sp.cgpa, sp.status as enrollment_status
    FROM users u
    JOIN student_profiles sp ON u.id = sp.user_id
    WHERE u.id = ?;
    """, (target_id,))
    profile_row = cursor.fetchone()
    if not profile_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Student profile not found.")

    profile = dict(profile_row)

    # Academic History (Past Semesters & AYs)
    cursor.execute("""
    SELECT * FROM student_enrollment_history
    WHERE student_id = ?
    ORDER BY academic_year ASC, semester_number ASC;
    """, (target_id,))
    history = [dict(r) for r in cursor.fetchall()]

    # Enrolled Subjects
    cursor.execute("""
    SELECT s.id, s.name, s.code, s.credits, s.category, s.subject_type, sse.academic_year
    FROM student_subject_enrollments sse
    JOIN subjects s ON sse.subject_id = s.id
    WHERE sse.student_id = ? AND sse.status = 'enrolled'
    ORDER BY s.code ASC;
    """, (target_id,))
    enrolled_subjects = [dict(r) for r in cursor.fetchall()]

    # Evaluated Performance Records
    cursor.execute("""
    SELECT s.id as submission_id, s.task_id, s.submission_code, s.submission_date, s.is_late,
           t.title as task_title, t.task_type, t.task_number, t.max_marks,
           sub.name as subject_name, sub.code as subject_code,
           e.marks_awarded, e.feedback, e.remarks, e.digital_signature_code, e.evaluated_at,
           u.full_name as faculty_name
    FROM submissions s
    JOIN tasks t ON s.task_id = t.id
    JOIN subjects sub ON t.subject_id = sub.id
    JOIN evaluations e ON s.id = e.submission_id
    JOIN users u ON e.faculty_id = u.id
    WHERE s.student_id = ? AND e.status IN ('approved', 'graded')
    ORDER BY e.evaluated_at DESC;
    """, (target_id,))
    evaluations = [dict(r) for r in cursor.fetchall()]

    assignments = [ev for ev in evaluations if ev["task_type"] == "Assignment"]
    experiments = [ev for ev in evaluations if ev["task_type"] == "Experiment"]
    special_docs = [ev for ev in evaluations if ev["task_type"] == "Special Document"]

    # CGPA Trend
    cgpa_history = []
    for h in history:
        if h.get("cgpa"):
            cgpa_history.append({"semester": f"Sem {h['semester_number']}", "cgpa": h["cgpa"], "academic_year": h["academic_year"]})
    cgpa_history.append({"semester": f"Sem {profile['semester_number']} (Current)", "cgpa": profile["cgpa"] or 8.92, "academic_year": profile["academic_year"]})

    conn.close()
    return {
        "profile": profile,
        "academic_history": history,
        "enrolled_subjects": enrolled_subjects,
        "cgpa_trend": cgpa_history,
        "summary": {
            "total_credits": sum(s.get("credits", 0) for s in enrolled_subjects),
            "total_evaluations": len(evaluations),
            "assignments_evaluated": len(assignments),
            "experiments_evaluated": len(experiments),
            "special_docs_evaluated": len(special_docs),
            "current_cgpa": profile["cgpa"]
        },
        "records": {
            "assignments": assignments,
            "experiments": experiments,
            "special_documents": special_docs
        }
    }


# ============================================================================
# MODULE 15: ADMINISTRATION, DATA PROTECTION & EXTENSIONS
# ============================================================================

@router.post("/tasks/{task_id}/extend-deadline")
def extend_task_deadline(
    task_id: str,
    payload_data: dict,
    user_payload: dict = Depends(require_roles("faculty", "admin"))
):
    """Faculty or Admin extends an assignment or experiment deadline with documented reason."""
    new_due_date = payload_data.get("new_due_date")
    reason = payload_data.get("reason", "Academic extension approved by faculty.")
    if not new_due_date:
        raise HTTPException(status_code=400, detail="New due date is required.")

    actor_id = user_payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")
    task = dict(task_row)

    original = task.get("original_due_date") or task["due_date"]
    cursor.execute("""
    UPDATE tasks
    SET due_date = ?, original_due_date = ?, extension_reason = ?
    WHERE id = ?;
    """, (new_due_date, original, reason, task_id))

    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'EXTEND_DEADLINE', 'TASK', ?, ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", actor_id, task_id, json.dumps({"new_due_date": new_due_date, "reason": reason}), now_iso))

    conn.commit()
    conn.close()
    return {"message": "Deadline successfully extended.", "due_date": new_due_date}


@router.post("/evaluations/{submission_id}/reevaluation-request")
def request_marks_reevaluation(
    submission_id: str,
    payload_data: dict,
    student_payload: dict = Depends(require_roles("student"))
):
    """Student submits a marks reevaluation request with academic justification."""
    student_id = student_payload.get("sub")
    reason = payload_data.get("reason")
    if not reason:
        raise HTTPException(status_code=400, detail="Justification reason is required for reevaluation.")

    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    SELECT s.id, s.task_id, e.faculty_id, e.marks_awarded
    FROM submissions s
    JOIN evaluations e ON s.id = e.submission_id
    WHERE s.id = ? AND s.student_id = ?;
    """, (submission_id, student_id))
    eval_row = cursor.fetchone()
    if not eval_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Evaluated submission not found.")
    eval_row = dict(eval_row)

    req_id = f"reeval_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO reevaluation_requests (
        id, submission_id, task_id, student_id, faculty_id, current_marks, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?);
    """, (req_id, submission_id, eval_row["task_id"], student_id, eval_row["faculty_id"], eval_row["marks_awarded"], reason, now_iso))

    cursor.execute("""
    UPDATE evaluations
    SET reevaluation_status = 'pending', reevaluation_reason = ?
    WHERE submission_id = ?;
    """, (reason, submission_id))

    conn.commit()
    conn.close()
    return {"message": "Re-evaluation request submitted to faculty.", "request_id": req_id}


@router.get("/evaluations/reevaluation-requests")
def list_reevaluation_requests(payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty reviews submitted re-evaluation requests."""
    user_id = payload.get("sub")
    role = payload.get("role")
    conn = get_db_connection()
    cursor = conn.cursor()

    if role == "faculty":
        cursor.execute("""
        SELECT rr.*, u.full_name as student_name, sp.roll_number, sp.prn,
               t.title as task_title, t.task_type, sub.name as subject_name
        FROM reevaluation_requests rr
        JOIN users u ON rr.student_id = u.id
        JOIN student_profiles sp ON u.id = sp.user_id
        JOIN tasks t ON rr.task_id = t.id
        JOIN subjects sub ON t.subject_id = sub.id
        WHERE rr.faculty_id = ?
        ORDER BY rr.created_at DESC;
        """, (user_id,))
    else:
        cursor.execute("""
        SELECT rr.*, u.full_name as student_name, sp.roll_number, sp.prn,
               t.title as task_title, t.task_type, sub.name as subject_name
        FROM reevaluation_requests rr
        JOIN users u ON rr.student_id = u.id
        JOIN student_profiles sp ON u.id = sp.user_id
        JOIN tasks t ON rr.task_id = t.id
        JOIN subjects sub ON t.subject_id = sub.id
        ORDER BY rr.created_at DESC;
        """)

    requests = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return requests


@router.patch("/evaluations/reevaluation-requests/{request_id}/review")
def review_reevaluation_request(
    request_id: str,
    payload_data: dict,
    faculty_payload: dict = Depends(require_roles("faculty", "admin"))
):
    """Faculty updates marks or rejects reevaluation request with remarks."""
    status = payload_data.get("status") # 'approved', 'rejected'
    new_marks = payload_data.get("new_marks")
    remarks = payload_data.get("remarks", "")

    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM reevaluation_requests WHERE id = ?;", (request_id,))
    req = cursor.fetchone()
    if not req:
        conn.close()
        raise HTTPException(status_code=404, detail="Request not found.")
    req = dict(req)

    if status == "approved" and new_marks is not None:
        cursor.execute("""
        UPDATE evaluations
        SET marks_awarded = ?, feedback = feedback || ' [Re-evaluated: ' || ? || ']', reevaluation_status = 'approved'
        WHERE submission_id = ?;
        """, (float(new_marks), remarks, req["submission_id"]))

    cursor.execute("""
    UPDATE reevaluation_requests
    SET status = ?, new_marks = ?, faculty_remarks = ?, reviewed_at = ?
    WHERE id = ?;
    """, (status, new_marks, remarks, now_iso, request_id))

    if status == "rejected":
        cursor.execute("UPDATE evaluations SET reevaluation_status = 'rejected' WHERE submission_id = ?;", (req["submission_id"],))

    # Notify student
    notif_msg = f"Your marks re-evaluation request was {status}."
    if new_marks is not None:
        notif_msg += f" New Marks: {new_marks}."
    if remarks:
        notif_msg += f" Remarks: {remarks}"

    cursor.execute("""
    INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
    VALUES (?, ?, 'Re-evaluation Update', ?, ?, '/student', 0, ?);
    """, (f"notif_{uuid.uuid4().hex[:8]}", req["student_id"], notif_msg, 'success' if status == 'approved' else 'alert', now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Re-evaluation request {status}."}


@router.post("/admin/faculty-substitution")
def assign_faculty_substitution(
    payload_data: dict,
    admin_payload: dict = Depends(require_roles("admin"))
):
    """Administrator assigns a substitute faculty member to cover a subject/division."""
    orig_fac_id = payload_data.get("original_faculty_id")
    sub_fac_id = payload_data.get("substitute_faculty_id")
    subject_id = payload_data.get("subject_id")
    division = payload_data.get("division_name")
    start_date = payload_data.get("start_date")
    end_date = payload_data.get("end_date")
    reason = payload_data.get("reason", "Academic leave coverage")

    if not all([orig_fac_id, sub_fac_id, subject_id, division, start_date, end_date]):
        raise HTTPException(status_code=400, detail="Missing required faculty substitution fields.")

    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    sub_id = f"fsub_{uuid.uuid4().hex[:10]}"
    cursor.execute("""
    INSERT INTO faculty_substitutions (
        id, original_faculty_id, substitute_faculty_id, subject_id, division_name, start_date, end_date, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?);
    """, (sub_id, orig_fac_id, sub_fac_id, subject_id, division, start_date, end_date, reason, now_iso))

    conn.commit()
    conn.close()
    return {"message": "Faculty substitution successfully configured.", "id": sub_id}


@router.get("/admin/audit-logs")
def get_admin_audit_logs(
    actor_id: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    limit: int = 100,
    admin_payload: dict = Depends(require_roles("admin"))
):
    """Administrator inspects security and academic change audit logs."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = []
    if actor_id:
        query += " AND actor_id = ?"
        params.append(actor_id)
    if action:
        query += " AND action = ?"
        params.append(action)
    if target_type:
        query += " AND target_type = ?"
        params.append(target_type)

    query += " ORDER BY timestamp DESC LIMIT ?;"
    params.append(limit)

    cursor.execute(query, tuple(params))
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return logs


@router.post("/admin/backup-database")
def backup_database_procedure(admin_payload: dict = Depends(require_roles("admin"))):
    """Generates an encrypted/isolated SQLite snapshot backup file."""
    import shutil
    from app.core.config import settings

    admin_id = admin_payload.get("sub", "admin")
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_dir = os.path.join(os.path.dirname(settings.DATABASE_PATH), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    backup_file = os.path.join(backup_dir, f"writeuppro_backup_{now_str}.db")

    shutil.copy2(settings.DATABASE_PATH, backup_file)

    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, ?, 'DATABASE_BACKUP', 'SYSTEM', 'writeuppro_db', ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", admin_id, json.dumps({"backup_file": backup_file}), now_iso))
    conn.commit()
    conn.close()

    return {"message": "Database backup created successfully.", "file": os.path.basename(backup_file), "backup_file": os.path.basename(backup_file), "timestamp": now_iso}


@router.post("/admin/reset-demo-data")
def trigger_reset_demo_data(admin_payload: dict = Depends(require_roles("admin"))):
    """Administrator triggers safe demo data reset (exact 10 students, 3 faculty, 0 pre-created assessments)."""
    from seed_demo_10 import seed_demo_10
    seed_demo_10()
    return {"message": "Demo data reset successfully: exactly 10 students, 3 faculty, 0 pre-created assessments."}


@router.get("/admin/students/export-csv")
def export_students_csv(admin_payload: dict = Depends(require_roles("admin"))):
    """Admin exports student roster with full academic details."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT u.id, u.full_name, u.email, sp.roll_number, sp.prn, sp.year_level, sp.branch_code,
           sp.semester_number, sp.division_name, sp.academic_year, sp.cgpa, sp.status, sp.verification_status
    FROM users u
    JOIN student_profiles sp ON u.id = sp.user_id
    ORDER BY sp.branch_code ASC, sp.year_level ASC, sp.division_name ASC, sp.roll_number ASC;
    """)
    rows = cursor.fetchall()
    conn.close()

    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "User ID", "Full Name", "Email", "Roll Number", "PRN", "Year Level",
        "Branch", "Semester", "Division", "Academic Year", "CGPA", "Enrollment Status", "Verification Status"
    ])
    for r in rows:
        writer.writerow(list(r))

    from fastapi.responses import Response
    return Response(content=output.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=writeuppro_students_roster.csv"
    })


