import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import SubmissionSubmit

router = APIRouter()

@router.post("/")
def create_submission(sub_in: SubmissionSubmit, payload: dict = Depends(require_roles("student"))):
    """Submits a document, freezes an immutable snapshot, and issues a submission receipt."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now()
    now_iso = now.isoformat()

    # Verify student is approved
    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    profile = cursor.fetchone()
    if not profile or profile["status"] != "approved":
        conn.close()
        raise HTTPException(status_code=403, detail="Your profile must be approved by the administrator before submitting academic work.")

    # Verify document ownership and completeness
    cursor.execute("SELECT * FROM documents WHERE id = ? AND student_id = ?;", (sub_in.document_id, student_id))
    doc = cursor.fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")

    if not doc["title"] or not doc["content_html"] or len(doc["content_html"].strip()) < 20:
        conn.close()
        raise HTTPException(status_code=400, detail="Document cannot be submitted empty. Please write your content before submitting.")

    # Check if already submitted
    cursor.execute("SELECT id FROM submissions WHERE document_id = ?;", (sub_in.document_id,))
    existing_sub = cursor.fetchone()
    if existing_sub:
        conn.close()
        raise HTTPException(status_code=400, detail="This document has already been submitted.")

    # Generate immutable snapshot and unique receipt
    sub_id = f"sub_{uuid.uuid4().hex[:10]}"
    sub_code = f"SUB-{now.year}-IIET-{uuid.uuid4().hex[:6].upper()}"
    submission_date_str = now.strftime("%d/%m/%Y %H:%M")

    cursor.execute("""
    INSERT INTO submissions (
        id, document_id, task_id, student_id, submission_code, snapshot_html, submission_date, is_late, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'submitted', ?);
    """, (
        sub_id, sub_in.document_id, doc["task_id"] or sub_in.task_id, student_id,
        sub_code, doc["content_html"], submission_date_str, now_iso
    ))

    # Mark document as submitted
    cursor.execute("""
    UPDATE documents SET status = 'submitted', updated_at = ? WHERE id = ?;
    """, (now_iso, sub_in.document_id))

    # Notify faculty
    cursor.execute("SELECT full_name FROM users WHERE id = ?;", (student_id,))
    stu_name = cursor.fetchone()["full_name"]
    cursor.execute("SELECT id FROM users WHERE role = 'faculty' LIMIT 1;")
    fac = cursor.fetchone()
    if fac:
        cursor.execute("""
        INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
        VALUES (?, ?, 'New Academic Submission', ?, 'info', '/faculty', 0, ?);
        """, (f"notif_{uuid.uuid4().hex[:8]}", fac["id"], f"{stu_name} ({profile['roll_number']}) submitted {doc['doc_type']} '{doc['title']}'.", now_iso))

    conn.commit()
    conn.close()
    return {
        "message": "Document successfully submitted.",
        "submission_id": sub_id,
        "submission_code": sub_code,
        "submission_date": submission_date_str
    }

@router.get("/")
def list_submissions(
    subject: str = None,
    division: str = None,
    status_filter: str = None,
    payload: dict = Depends(require_roles("faculty", "admin"))
):
    """Lists student submissions grouped by classroom folders for faculty evaluation."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT s.id as submission_id, s.submission_code, s.submission_date, s.status,
           d.id as document_id, d.title, d.doc_type, d.doc_number, d.subject_name, d.subject_code,
           u.id as student_id, u.full_name as student_name,
           sp.roll_number, sp.year_level, sp.branch_code, sp.division_name,
           e.marks_awarded, e.max_marks as eval_max_marks, e.evaluated_at
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON s.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    LEFT JOIN evaluations e ON s.id = e.submission_id
    WHERE 1=1
    """
    params = []
    if subject:
        query += " AND d.subject_name = ?"
        params.append(subject)
    if division:
        query += " AND sp.division_name = ?"
        params.append(division)
    if status_filter:
        query += " AND s.status = ?"
        params.append(status_filter)

    query += " ORDER BY s.created_at DESC;"
    cursor.execute(query, params)
    subs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return subs

@router.get("/{submission_id}")
def get_submission(submission_id: str, payload: dict = Depends(get_current_user_payload)):
    """Retrieves full submission details, snapshot, and evaluation for grading panel."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT s.*, s.id as submission_id,
           d.id as doc_id, d.title, d.doc_type, d.doc_number, d.subject_name, d.subject_code,
           u.full_name as student_name,
           sp.roll_number, sp.year_level, sp.branch_code, sp.division_name,
           e.id as evaluation_id, e.marks_awarded, e.max_marks as eval_max_marks, e.rubric_scores_json,
           e.feedback, e.remarks as faculty_remarks, e.digital_signature_code, e.evaluated_at,
           fac.full_name as evaluator_name
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON s.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    LEFT JOIN evaluations e ON s.id = e.submission_id
    LEFT JOIN users fac ON e.faculty_id = fac.id
    WHERE s.id = ?;
    """, (submission_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Submission not found.")

    sub = dict(row)
    if sub.get("rubric_scores_json"):
        import json
        try:
            sub["rubric_scores"] = json.loads(sub["rubric_scores_json"])
        except Exception:
            sub["rubric_scores"] = {}
    else:
        sub["rubric_scores"] = {}
    conn.close()
    return sub
