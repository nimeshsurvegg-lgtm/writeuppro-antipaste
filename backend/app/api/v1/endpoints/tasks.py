import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import TaskCreate

router = APIRouter()

@router.get("/")
def list_tasks(payload: dict = Depends(get_current_user_payload)):
    """Lists published academic tasks (assignments & experiments) accessible to the user."""
    conn = get_db_connection()
    cursor = conn.cursor()
    role = payload.get("role", "")
    user_id = payload.get("sub")

    if role == "faculty":
        cursor.execute("""
        SELECT t.*, s.name as subject_name, s.code as subject_code
        FROM tasks t
        JOIN subjects s ON t.subject_id = s.id
        WHERE t.faculty_id = ?
        ORDER BY t.created_at DESC;
        """, (user_id,))
    elif role == "student":
        # Get student's enrolled branch & semester
        cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (user_id,))
        sp = cursor.fetchone()
        if not sp or sp["status"] != "approved":
            conn.close()
            return []

        cursor.execute("""
        SELECT t.*, s.name as subject_name, s.code as subject_code,
               (SELECT id FROM documents WHERE student_id = ? AND task_id = t.id LIMIT 1) as student_doc_id,
               (SELECT status FROM documents WHERE student_id = ? AND task_id = t.id LIMIT 1) as student_doc_status
        FROM tasks t
        JOIN subjects s ON t.subject_id = s.id
        JOIN branches b ON s.branch_id = b.id
        WHERE b.code = ? AND s.semester_number = ? AND t.status = 'published'
        ORDER BY t.due_date ASC;
        """, (user_id, user_id, sp["branch_code"], sp["semester_number"]))
    else: # admin
        cursor.execute("""
        SELECT t.*, s.name as subject_name, s.code as subject_code, u.full_name as faculty_name
        FROM tasks t
        JOIN subjects s ON t.subject_id = s.id
        JOIN users u ON t.faculty_id = u.id
        ORDER BY t.created_at DESC;
        """)

    tasks = []
    for r in cursor.fetchall():
        task = dict(r)
        task["rubric"] = json.loads(task["rubric_json"]) if task.get("rubric_json") else []
        tasks.append(task)

    conn.close()
    return tasks

@router.get("/{task_id}")
def get_task(task_id: str, payload: dict = Depends(get_current_user_payload)):
    """Fetches details, instructions, and rubric for a single task."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT t.*, s.name as subject_name, s.code as subject_code, u.full_name as faculty_name
    FROM tasks t
    JOIN subjects s ON t.subject_id = s.id
    JOIN users u ON t.faculty_id = u.id
    WHERE t.id = ?;
    """, (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found.")

    task = dict(task_row)
    task["rubric"] = json.loads(task["rubric_json"]) if task.get("rubric_json") else []
    conn.close()
    return task

@router.post("/")
def create_task(task_in: TaskCreate, payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty or Administrator creates a new assignment or practical experiment task."""
    faculty_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    task_id = f"task_{uuid.uuid4().hex[:10]}"

    cursor.execute("""
    INSERT INTO tasks (
        id, title, description, subject_id, faculty_id, task_type, task_number, max_marks, instructions, due_date, rubric_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?);
    """, (
        task_id,
        task_in.title.strip(),
        task_in.description or "",
        task_in.subject_id,
        faculty_id,
        task_in.task_type,
        task_in.task_number,
        task_in.max_marks,
        task_in.instructions or "",
        task_in.due_date,
        json.dumps(task_in.rubric),
        now_iso
    ))

    conn.commit()
    conn.close()
    return {"message": "Academic task published successfully.", "task_id": task_id}
