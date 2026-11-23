import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import EvaluationSubmit
from app.services.similarity_service import analyze_submission_similarity

router = APIRouter()

@router.post("/")
def submit_evaluation(eval_in: EvaluationSubmit, payload: dict = Depends(require_roles("faculty", "admin"))):
    """Faculty digitally grades, validates rubric limits, and approves student submission."""
    faculty_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now()
    now_iso = now.isoformat()

    # Get submission and document
    cursor.execute("""
    SELECT s.*, d.id as doc_id, d.doc_type, d.title, d.student_id, u.full_name as student_name
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON d.student_id = u.id
    WHERE s.id = ?;
    """, (eval_in.submission_id,))
    sub = cursor.fetchone()

    if not sub:
        conn.close()
        raise HTTPException(status_code=404, detail="Submission not found.")

    doc_type = sub["doc_type"]
    max_allowed = 10.0 if doc_type == "Assignment" else 15.0

    # Validate rubric sum & limits
    if eval_in.marks_awarded < 0 or eval_in.marks_awarded > max_allowed:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Awarded score {eval_in.marks_awarded} exceeds maximum limit of {max_allowed} for {doc_type}."
        )

    # Check individual criteria limits
    scores = eval_in.rubric_scores
    if scores.get("knowledge", 0) > 4.0:
        conn.close()
        raise HTTPException(status_code=400, detail="Knowledge score cannot exceed 4.0.")
    if scores.get("content", 0) > 3.0:
        conn.close()
        raise HTTPException(status_code=400, detail="Content score cannot exceed 3.0.")
    if scores.get("punctuality", 0) > 3.0:
        conn.close()
        raise HTTPException(status_code=400, detail="Punctuality score cannot exceed 3.0.")
    if doc_type == "Experiment" and scores.get("performance", 0) > 5.0:
        conn.close()
        raise HTTPException(status_code=400, detail="Performance score cannot exceed 5.0.")

    # Generate Digital Stamp Signature Code
    digital_stamp = f"SIG-{uuid.uuid4().hex[:8].upper()}-IIET-{now.strftime('%y%m%d')}"
    eval_id = f"eval_{uuid.uuid4().hex[:10]}"

    cursor.execute("""
    INSERT INTO evaluations (
        id, submission_id, faculty_id, marks_awarded, max_marks, rubric_scores_json,
        feedback, remarks, digital_signature_code, status, evaluated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
    ON CONFLICT(submission_id) DO UPDATE SET
        marks_awarded = excluded.marks_awarded,
        rubric_scores_json = excluded.rubric_scores_json,
        feedback = excluded.feedback,
        remarks = excluded.remarks,
        digital_signature_code = excluded.digital_signature_code,
        status = 'approved',
        evaluated_at = excluded.evaluated_at;
    """, (
        eval_id,
        eval_in.submission_id,
        faculty_id,
        eval_in.marks_awarded,
        max_allowed,
        json.dumps(eval_in.rubric_scores),
        eval_in.feedback or "",
        eval_in.remarks or "Approved and verified",
        digital_stamp,
        now_iso
    ))

    # Mark submission and document as graded
    cursor.execute("UPDATE submissions SET status = 'graded' WHERE id = ?;", (eval_in.submission_id,))
    cursor.execute("UPDATE documents SET status = 'graded', updated_at = ? WHERE id = ?;", (now_iso, sub["doc_id"]))

    # Notify student
    cursor.execute("""
    INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
    VALUES (?, ?, 'Document Evaluated & Graded', ?, 'success', '/student', 0, ?);
    """, (
        f"notif_{uuid.uuid4().hex[:8]}",
        sub["student_id"],
        f"Your {doc_type} '{sub['title']}' has been graded: {eval_in.marks_awarded}/{max_allowed} marks. Digital stamp applied.",
        now_iso
    ))

    conn.commit()
    conn.close()
    return {
        "message": "Evaluation finalized and approved with digital signature.",
        "marks_awarded": eval_in.marks_awarded,
        "max_marks": max_allowed,
        "digital_signature_code": digital_stamp,
        "evaluated_at": now_iso
    }

@router.post("/{submission_id}/return")
def return_for_correction(
    submission_id: str,
    remarks: str = "Please revise the document as requested by faculty.",
    payload: dict = Depends(require_roles("faculty", "admin"))
):
    """Faculty returns a student submission for corrections, unlocking the draft."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    SELECT s.*, d.id as doc_id, d.title, d.student_id
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    WHERE s.id = ?;
    """, (submission_id,))
    sub = cursor.fetchone()

    if not sub:
        conn.close()
        raise HTTPException(status_code=404, detail="Submission not found.")

    cursor.execute("UPDATE submissions SET status = 'returned' WHERE id = ?;", (submission_id,))
    cursor.execute("UPDATE documents SET status = 'returned', updated_at = ? WHERE id = ?;", (now_iso, sub["doc_id"]))

    cursor.execute("""
    INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
    VALUES (?, ?, 'Document Returned for Corrections', ?, 'alert', '/student', 0, ?);
    """, (
        f"notif_{uuid.uuid4().hex[:8]}",
        sub["student_id"],
        f"Your document '{sub['title']}' was returned for corrections: {remarks}",
        now_iso
    ))

    conn.commit()
    conn.close()
    return {"message": "Document returned to student for corrections."}

@router.get("/{submission_id}/similarity")
def get_submission_similarity(
    submission_id: str,
    payload: dict = Depends(require_roles("faculty", "admin"))
):
    """Computes real text similarity against all other cohort submissions in the database."""
    result = analyze_submission_similarity(submission_id)
    return result

