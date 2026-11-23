from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import StudentProfileSubmission, ProfileApprovalUpdate

router = APIRouter()

@router.get("/hierarchy")
def get_academic_hierarchy():
    """Returns the configured institutional academic hierarchy."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM departments;")
    departments = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM branches;")
    branches = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM academic_years;")
    years = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM divisions;")
    divisions = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM subjects;")
    subjects = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "departments": departments,
        "branches": branches,
        "years": years,
        "divisions": divisions,
        "subjects": subjects
    }

@router.get("/curriculum")
def get_curriculum(year: str, branch: str, sem: int):
    """Returns available mandatory subjects and open electives for given year, branch, and semester."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT s.* FROM subjects s
    JOIN branches b ON s.branch_id = b.id
    WHERE b.code = ? AND s.semester_number = ?;
    """, (branch, sem))
    all_subs = [dict(r) for r in cursor.fetchall()]

    mandatory = [s for s in all_subs if s["is_elective"] == 0]
    electives = [s for s in all_subs if s["is_elective"] == 1]

    # If branch has no specific electives, check institute-wide open electives (e.g. beginner languages)
    cursor.execute("SELECT * FROM subjects WHERE is_elective = 1;")
    general_electives = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "subjects": mandatory,
        "electives": electives if electives else general_electives
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
        """, (f"notif_{datetime.now().timestamp()}", admin["id"], f"Student {stu_name} ({profile_data.roll_number}) submitted academic profile for verification.", now_iso))

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
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Student profile not found.")

    cursor.execute("""
    UPDATE student_profiles
    SET status = ?, admin_remarks = ?, updated_at = ?
    WHERE user_id = ?;
    """, (review.status, review.remarks or "", now_iso, user_id))

    # Notify student
    msg = f"Your profile registration was {review.status}."
    if review.remarks:
        msg += f" Remarks: {review.remarks}"

    cursor.execute("""
    INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
    VALUES (?, ?, 'Registration Status Update', ?, ?, '/student', 0, ?);
    """, (f"notif_{datetime.now().timestamp()}", user_id, msg, 'success' if review.status == 'approved' else 'alert', now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Student profile status updated to {review.status}."}
