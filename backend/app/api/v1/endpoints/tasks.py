import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import TaskCreate, CustomRubricCreate

router = APIRouter()

@router.get("")
@router.get("/")
def list_tasks(
    subject_id: Optional[str] = None,
    category: Optional[str] = None,
    task_type: Optional[str] = None,
    batch_id: Optional[str] = None,
    division_name: Optional[str] = None,
    payload: dict = Depends(get_current_user_payload)
):
    """Lists academic tasks (assignments, experiments, and special documents) accessible to the user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    role = payload.get("role", "")
    user_id = payload.get("sub")

    if role == "faculty":
        query = """
        SELECT t.*, s.name as subject_name, s.code as subject_code, s.credits as subject_credits,
               lb.batch_name as batch_name
        FROM tasks t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN lab_batches lb ON t.batch_id = lb.id
        WHERE (t.faculty_id = ? OR ? IN (SELECT user_id FROM users WHERE role = 'admin'))
        """
        params = [user_id, user_id]
        if subject_id:
            query += " AND t.subject_id = ?"
            params.append(subject_id)
        if category:
            query += " AND t.category = ?"
            params.append(category)
        if task_type:
            query += " AND t.task_type = ?"
            params.append(task_type)
        if batch_id:
            query += " AND t.batch_id = ?"
            params.append(batch_id)
        if division_name:
            query += " AND (t.division_name = ? OR t.division_name = 'ALL')"
            params.append(division_name)

        query += " ORDER BY t.created_at DESC;"
        cursor.execute(query, tuple(params))

    elif role == "student":
        # Get student's enrolled profile & laboratory batches
        cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (user_id,))
        sp = cursor.fetchone()
        if not sp or sp["status"] != "approved":
            conn.close()
            return []

        # Find all lab batches the student belongs to
        cursor.execute("SELECT batch_id FROM batch_students WHERE student_id = ?;", (user_id,))
        student_batch_ids = [r[0] for r in cursor.fetchall()]

        # Query tasks targeting the student's division or assigned batches
        query = """
        SELECT t.*, s.name as subject_name, s.code as subject_code, s.credits as subject_credits,
               lb.batch_name as batch_name,
               (SELECT id FROM documents WHERE student_id = ? AND task_id = t.id LIMIT 1) as student_doc_id,
               (SELECT status FROM documents WHERE student_id = ? AND task_id = t.id LIMIT 1) as student_doc_status,
               (SELECT submission_code FROM submissions WHERE student_id = ? AND task_id = t.id LIMIT 1) as student_submission_code,
               (SELECT is_late FROM submissions WHERE student_id = ? AND task_id = t.id LIMIT 1) as student_is_late,
               (SELECT delay_text FROM submissions WHERE student_id = ? AND task_id = t.id LIMIT 1) as student_delay_text,
               (SELECT marks_awarded FROM evaluations e JOIN submissions sub ON e.submission_id = sub.id WHERE sub.student_id = ? AND sub.task_id = t.id LIMIT 1) as student_marks_awarded
        FROM tasks t
        JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN lab_batches lb ON t.batch_id = lb.id
        WHERE t.status = 'published'
          AND (t.branch_code = ? OR t.branch_code IS NULL OR t.branch_code = 'ALL')
          AND (t.semester_number = ? OR t.semester_number IS NULL)
          AND (
              -- Division-wide task for student's division
              (t.target_type = 'division' AND (t.division_name = ? OR t.division_name IS NULL OR t.division_name = 'ALL'))
              -- OR Batch-specific task where student is member of the batch
              OR (t.target_type = 'batch' AND t.batch_id IN ({}) )
          )
        """
        batch_placeholders = ', '.join(['?'] * len(student_batch_ids)) if student_batch_ids else "''"
        formatted_query = query.format(batch_placeholders)

        params = [
            user_id, user_id, user_id, user_id, user_id, user_id,
            sp["branch_code"], sp["semester_number"], sp["division_name"]
        ]
        if student_batch_ids:
            params.extend(student_batch_ids)

        if category:
            formatted_query += " AND t.category = ?"
            params.append(category)
        if task_type:
            formatted_query += " AND t.task_type = ?"
            params.append(task_type)

        formatted_query += " ORDER BY t.due_date ASC;"
        cursor.execute(formatted_query, tuple(params))

    else: # admin
        query = """
        SELECT t.*, s.name as subject_name, s.code as subject_code, u.full_name as faculty_name,
               lb.batch_name as batch_name
        FROM tasks t
        JOIN subjects s ON t.subject_id = s.id
        JOIN users u ON t.faculty_id = u.id
        LEFT JOIN lab_batches lb ON t.batch_id = lb.id
        ORDER BY t.created_at DESC;
        """
        cursor.execute(query)

    tasks = []
    for r in cursor.fetchall():
        task = dict(r)
        task["rubric"] = json.loads(task["rubric_json"]) if task.get("rubric_json") else []
        try:
            task["allowed_methods"] = json.loads(task["allowed_methods_json"]) if task.get("allowed_methods_json") else ["editor", "pdf", "docx", "other_files", "external_link"]
        except Exception:
            task["allowed_methods"] = ["editor", "pdf", "docx", "other_files", "external_link"]
        try:
            task["allowed_extensions"] = json.loads(task["allowed_extensions_json"]) if task.get("allowed_extensions_json") else ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]
        except Exception:
            task["allowed_extensions"] = ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]
        tasks.append(task)

    conn.close()
    return tasks

@router.get("/faculty-overview")
def get_faculty_overview(payload: dict = Depends(require_roles("faculty", "admin"))):
    """Returns assigned subjects, classes, laboratory batches, student rosters, and task summary for the faculty."""
    faculty_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Assigned subjects from subject_allotments & faculty_assignments
    cursor.execute("""
    SELECT DISTINCT s.id, s.name as subject_name, s.code as subject_code, s.credits, s.category, s.subject_type,
                    COALESCE(ag.branch_code, 'CE') as branch_code,
                    COALESCE(ag.year_level, 'SE') as year_level,
                    COALESCE(ag.semester_number, 3) as semester_number,
                    COALESCE(ag.division_name, fa.division_name, 'Div A') as division_name,
                    COALESCE(sa.academic_year, '2026-27') as academic_year
    FROM subjects s
    LEFT JOIN subject_allotments sa ON s.id = sa.subject_id AND sa.faculty_id = ?
    LEFT JOIN academic_groups ag ON sa.academic_group_id = ag.id
    LEFT JOIN faculty_assignments fa ON s.id = fa.subject_id AND fa.faculty_id = ?
    WHERE sa.faculty_id = ? OR fa.faculty_id = ?;
    """, (faculty_id, faculty_id, faculty_id, faculty_id))
    allotted_subjects = [dict(r) for r in cursor.fetchall()]

    # 2. Assigned laboratory batches
    cursor.execute("""
    SELECT lb.*, s.name as subject_name, s.code as subject_code,
           (SELECT COUNT(*) FROM batch_students WHERE batch_id = lb.id) as student_count
    FROM lab_batches lb
    LEFT JOIN subjects s ON lb.subject_id = s.id
    WHERE lb.faculty_id = ? AND lb.status = 'active';
    """, (faculty_id,))
    assigned_batches = [dict(r) for r in cursor.fetchall()]

    # Enrich subjects with student headcounts and task metrics
    for sub in allotted_subjects:
        cursor.execute("""
        SELECT COUNT(*) FROM student_profiles
        WHERE branch_code = ? AND year_level = ? AND semester_number = ? AND division_name = ? AND status = 'approved';
        """, (sub["branch_code"], sub["year_level"], sub["semester_number"], sub["division_name"]))
        sub["student_headcount"] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM tasks WHERE subject_id = ? AND faculty_id = ?;", (sub["id"], faculty_id))
        sub["task_count"] = cursor.fetchone()[0]

        cursor.execute("""
        SELECT COUNT(*) FROM submissions s
        JOIN tasks t ON s.task_id = t.id
        WHERE t.subject_id = ? AND t.faculty_id = ? AND s.status = 'submitted';
        """, (sub["id"], faculty_id))
        sub["pending_evaluations"] = cursor.fetchone()[0]

        cursor.execute("""
        SELECT COUNT(*) FROM submissions s
        JOIN tasks t ON s.task_id = t.id
        WHERE t.subject_id = ? AND t.faculty_id = ? AND s.status = 'graded';
        """, (sub["id"], faculty_id))
        sub["graded_evaluations"] = cursor.fetchone()[0]

    conn.close()
    return {
        "allotted_subjects": allotted_subjects,
        "assigned_batches": assigned_batches
    }

@router.get("/custom-rubrics")
@router.get("/rubrics")
def list_custom_rubrics(payload: dict = Depends(require_roles("faculty", "admin"))):
    """Lists reusable custom evaluation rubrics created by faculty."""
    faculty_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM custom_rubrics
    WHERE faculty_id = ? OR 1=1
    ORDER BY created_at DESC;
    """, (faculty_id,))
    rubrics = []
    for r in cursor.fetchall():
        rub = dict(r)
        rub["criteria"] = json.loads(rub["criteria_json"]) if rub.get("criteria_json") else []
        rubrics.append(rub)
    conn.close()
    return rubrics

@router.post("/custom-rubrics")
@router.post("/rubrics")
def create_custom_rubric(data: CustomRubricCreate, payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty creates a custom evaluation rubric for Mini Projects, Major Projects, or Research Papers."""
    faculty_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    rubric_id = f"rub_{uuid.uuid4().hex[:10]}"

    criteria_sum = sum(float(c.max_marks if c.max_marks is not None else (c.max_score or 0)) for c in data.criteria)
    if data.total_marks is None or data.total_marks <= 0:
        data.total_marks = round(criteria_sum, 2)
    else:
        # Align with actual criteria sum
        data.total_marks = round(criteria_sum, 2)

    criteria_list = [c.model_dump() for c in data.criteria]
    cursor.execute("""
    INSERT INTO custom_rubrics (id, faculty_id, title, document_category, total_marks, criteria_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """, (
        rubric_id, faculty_id, data.title.strip(), data.document_category,
        data.total_marks, json.dumps(criteria_list), now_iso
    ))

    conn.commit()
    conn.close()
    return {"message": "Custom rubric saved successfully.", "id": rubric_id, "total_marks": data.total_marks}

@router.get("/{task_id}")
def get_task(task_id: str, payload: dict = Depends(get_current_user_payload)):
    """Fetches details, instructions, laboratory requirements, and rubric for a single task."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT t.*, s.name as subject_name, s.code as subject_code, s.credits as subject_credits,
           u.full_name as faculty_name, lb.batch_name
    FROM tasks t
    JOIN subjects s ON t.subject_id = s.id
    JOIN users u ON t.faculty_id = u.id
    LEFT JOIN lab_batches lb ON t.batch_id = lb.id
    WHERE t.id = ?;
    """, (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")

    task = dict(task_row)
    task["rubric"] = json.loads(task["rubric_json"]) if task.get("rubric_json") else []
    try:
        task["allowed_methods"] = json.loads(task["allowed_methods_json"]) if task.get("allowed_methods_json") else ["editor", "pdf", "docx", "other_files", "external_link"]
    except Exception:
        task["allowed_methods"] = ["editor", "pdf", "docx", "other_files", "external_link"]
    try:
        task["allowed_extensions"] = json.loads(task["allowed_extensions_json"]) if task.get("allowed_extensions_json") else ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]
    except Exception:
        task["allowed_extensions"] = ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]
    conn.close()
    return task

@router.post("")
@router.post("/")
def create_task(task_in: TaskCreate, payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty or Administrator creates a new assignment, laboratory experiment, or special document task."""
    faculty_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    task_id = f"task_{uuid.uuid4().hex[:10]}"

    task_type = task_in.task_type or "Assignment"
    category = task_in.category or "standard"
    task_number = task_in.task_number or "1"
    max_marks = task_in.max_marks
    rubric = task_in.rubric or []

    if task_type == "Special Document":
        category = "special_document"
        task_number = "1"
        if task_in.custom_rubric_id:
            cursor.execute("SELECT total_marks, criteria_json FROM custom_rubrics WHERE id = ?;", (task_in.custom_rubric_id,))
            cr = cursor.fetchone()
            if cr:
                if not max_marks or max_marks <= 0:
                    max_marks = float(cr["total_marks"])
                if not rubric:
                    try:
                        rubric = json.loads(cr["criteria_json"])
                    except Exception:
                        rubric = []
        if not max_marks or max_marks <= 0:
            max_marks = 25.0
    elif task_type == "Experiment":
        category = "experiment"
        task_number = task_in.experiment_number or task_in.task_number or "1"
        if not max_marks or max_marks <= 0:
            max_marks = 15.0
        if not rubric:
            rubric = [
                {"name": "Knowledge & Theory", "max_score": 4.0},
                {"name": "Performance & Implementation", "max_score": 5.0},
                {"name": "Content & Observations", "max_score": 3.0},
                {"name": "Academic Punctuality", "max_score": 3.0}
            ]
    else: # Assignment
        task_type = "Assignment"
        category = "standard"
        task_number = task_in.task_number or "1"
        if not max_marks or max_marks <= 0:
            max_marks = 10.0
        if not rubric:
            rubric = [
                {"name": "Knowledge & Understanding", "max_score": 4.0},
                {"name": "Content Structure & Neatness", "max_score": 3.0},
                {"name": "Academic Punctuality", "max_score": 3.0}
            ]

    cursor.execute("""
    INSERT INTO tasks (
        id, title, description, subject_id, faculty_id, task_type, task_number, max_marks,
        instructions, due_date, rubric_json, status, created_at,
        academic_year, branch_code, year_level, semester_number, division_name,
        target_type, batch_id, category, document_category, experiment_number,
        objective, problem_statement, hardware_software_req, procedure, expected_output,
        reference_file_url, late_submission_policy, late_penalty_percent, custom_rubric_id,
        allowed_methods_json, allow_multiple_methods, max_file_size_mb, max_files_count,
        allowed_extensions_json, require_pdf_conversion, allow_resubmission, allow_edit_before_deadline
    ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, 'published', ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
    );
    """, (
        task_id,
        task_in.title.strip(),
        task_in.description or "",
        task_in.subject_id,
        faculty_id,
        task_type,
        task_number,
        max_marks,
        task_in.instructions or "",
        task_in.due_date,
        json.dumps(rubric),
        now_iso,
        task_in.academic_year or "2026-27",
        task_in.branch_code or "CE",
        task_in.year_level or "SE",
        task_in.semester_number or 3,
        task_in.division_name or "Div A",
        task_in.target_type or "division",
        task_in.batch_id,
        category,
        task_in.document_category,
        task_in.experiment_number,
        task_in.objective,
        task_in.problem_statement,
        task_in.hardware_software_req,
        task_in.procedure,
        task_in.expected_output,
        task_in.reference_file_url,
        task_in.late_submission_policy or "accept",
        task_in.late_penalty_percent or 0.0,
        task_in.custom_rubric_id,
        json.dumps(task_in.allowed_methods or ["editor", "pdf", "docx", "other_files", "external_link"]),
        1 if task_in.allow_multiple_methods else 0,
        int(task_in.max_file_size_mb or 10),
        int(task_in.max_files_count or 3),
        json.dumps(task_in.allowed_extensions or ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]),
        1 if task_in.require_pdf_conversion else 0,
        1 if task_in.allow_resubmission is not False else 0,
        1 if task_in.allow_edit_before_deadline is not False else 0
    ))

    conn.commit()
    conn.close()
    return {"message": "Academic task published successfully.", "task_id": task_id, "id": task_id}

@router.patch("/{task_id}")
def update_task(task_id: str, data: dict, payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty or Admin updates task configuration, instructions, deadline, or rubric."""
    user_id = payload.get("sub")
    role = payload.get("role")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")
    task = dict(task_row)

    if role == "faculty" and task["faculty_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Only the task creator or administrator can modify this task.")

    allowed_fields = [
        "title", "description", "instructions", "due_date", "max_marks",
        "objective", "problem_statement", "hardware_software_req", "procedure",
        "expected_output", "late_submission_policy", "late_penalty_percent",
        "status"
    ]
    updates = []
    params = []
    for f in allowed_fields:
        if f in data:
            updates.append(f"{f} = ?")
            params.append(data[f])

    if "rubric" in data:
        updates.append("rubric_json = ?")
        params.append(json.dumps(data["rubric"]))

    if updates:
        params.append(task_id)
        cursor.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?;", tuple(params))
        conn.commit()

    conn.close()
    return {"message": "Task updated successfully.", "id": task_id}

@router.patch("/{task_id}/archive")
def archive_task(task_id: str, payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty or Admin cancels/archives a task, removing it from active student submission lists."""
    user_id = payload.get("sub")
    role = payload.get("role")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")
    task = dict(task_row)

    if role == "faculty" and task["faculty_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Only the task creator or administrator can archive this task.")

    cursor.execute("UPDATE tasks SET status = 'archived' WHERE id = ?;", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "Task archived successfully.", "id": task_id}

@router.delete("/{task_id}")
def delete_task(task_id: str, payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty or Admin safely deletes a task if it has zero submissions, otherwise archives it."""
    user_id = payload.get("sub")
    role = payload.get("role")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")
    task = dict(task_row)

    if role == "faculty" and task["faculty_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Only the task creator or administrator can delete this task.")

    cursor.execute("SELECT COUNT(*) FROM submissions WHERE task_id = ?;", (task_id,))
    sub_count = cursor.fetchone()[0]

    if sub_count > 0:
        cursor.execute("UPDATE tasks SET status = 'archived' WHERE id = ?;", (task_id,))
        conn.commit()
        conn.close()
        return {"message": f"Task contains {sub_count} student submission(s); archived safely to preserve academic records.", "status": "archived"}

    cursor.execute("DELETE FROM tasks WHERE id = ?;", (task_id,))
    conn.commit()
    conn.close()
    return {"message": "Task deleted successfully.", "status": "deleted"}
