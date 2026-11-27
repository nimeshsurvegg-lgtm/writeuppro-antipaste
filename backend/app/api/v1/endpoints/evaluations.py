import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import EvaluationSubmit
from app.services.similarity_service import analyze_submission_similarity

router = APIRouter()

@router.post("")
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
    SELECT s.*, d.id as doc_id, d.doc_type, d.title, d.student_id, u.full_name as student_name,
           t.custom_rubric_id, t.max_marks as task_max_marks, COALESCE(t.category, 'standard') as task_category,
           t.faculty_id as task_faculty_id, t.subject_id as task_subject_id, t.division_name as task_division_name
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON d.student_id = u.id
    LEFT JOIN tasks t ON s.task_id = t.id
    WHERE s.id = ?;
    """, (eval_in.submission_id,))
    sub_row = cursor.fetchone()

    if not sub_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Submission not found.")

    sub = dict(sub_row)

    # Faculty evaluation authorization check
    user_role = payload.get("role")
    if user_role == "faculty":
        is_author = sub.get("task_faculty_id") == faculty_id
        cursor.execute("""
        SELECT 1 FROM faculty_assignments WHERE faculty_id = ? AND subject_id = ?
        UNION
        SELECT 1 FROM subject_allotments WHERE faculty_id = ? AND subject_id = ?
        UNION
        SELECT 1 FROM faculty_substitutions WHERE substitute_faculty_id = ? AND subject_id = ? AND status = 'active';
        """, (faculty_id, sub.get("task_subject_id"), faculty_id, sub.get("task_subject_id"), faculty_id, sub.get("task_subject_id")))
        is_allotted_or_sub = bool(cursor.fetchone())
        if not is_author and not is_allotted_or_sub and sub.get("task_faculty_id"):
            conn.close()
            raise HTTPException(status_code=403, detail="You are not authorized to evaluate submissions for this subject/division.")

    doc_type = sub["doc_type"]
    task_category = sub.get("task_category") or doc_type

    # Check for custom rubric
    custom_rubric = None
    if sub.get("custom_rubric_id"):
        cursor.execute("SELECT * FROM custom_rubrics WHERE id = ?;", (sub["custom_rubric_id"],))
        cr_row = cursor.fetchone()
        if cr_row:
            custom_rubric = dict(cr_row)
            try:
                custom_rubric["criteria"] = json.loads(custom_rubric["criteria_json"])
            except Exception:
                custom_rubric["criteria"] = []

    if custom_rubric and custom_rubric.get("criteria"):
        max_allowed = float(custom_rubric.get("total_marks") or sum(c.get("max_score", 0) for c in custom_rubric["criteria"]))
        if eval_in.marks_awarded < 0 or eval_in.marks_awarded > max_allowed + 0.01:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Awarded score {eval_in.marks_awarded} exceeds maximum limit of {max_allowed} for {custom_rubric.get('title', 'Custom Rubric')}."
            )
        # Validate individual criteria
        scores = eval_in.rubric_scores
        for c in custom_rubric["criteria"]:
            c_key = c.get("id") or c.get("name")
            c_name = c.get("name") or c_key
            c_max = float(c.get("max_score") if c.get("max_score") is not None else (c.get("max_marks", 0)))
            score_val = scores.get(c_key, scores.get(c_name, 0))
            if score_val > c_max + 0.01:
                conn.close()
                raise HTTPException(status_code=400, detail=f"Criterion '{c_name}' score cannot exceed {c_max}.")
    else:
        # Standard grading rubrics or task-specified limits
        if sub.get("task_max_marks"):
            max_allowed = float(sub["task_max_marks"])
        elif doc_type == "Assignment":
            max_allowed = 10.0
        elif doc_type == "Experiment":
            max_allowed = 15.0
        else:
            max_allowed = 25.0

        # Validate rubric sum & limits
        if eval_in.marks_awarded < 0 or eval_in.marks_awarded > max_allowed + 0.01:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail=f"Awarded score {eval_in.marks_awarded} exceeds maximum limit of {max_allowed} for {doc_type}."
            )

        # Check individual criteria limits for standard docs
        scores = eval_in.rubric_scores
        k_val = scores.get("knowledge", scores.get("Knowledge & Theory", scores.get("Knowledge & Understanding", 0)))
        c_val = scores.get("content", scores.get("Content Structure & Neatness", scores.get("Content & Observations", 0)))
        p_val = scores.get("punctuality", scores.get("Academic Punctuality", 0))
        perf_val = scores.get("performance", scores.get("Performance & Implementation", scores.get("Practical Execution & Performance", 0)))

        # Enforce specific standard criteria caps only when task uses default max marks
        if doc_type == "Assignment" and max_allowed == 10.0:
            if k_val > 4.01:
                conn.close()
                raise HTTPException(status_code=400, detail="Knowledge score cannot exceed 4.0.")
            if c_val > 3.01:
                conn.close()
                raise HTTPException(status_code=400, detail="Content score cannot exceed 3.0.")
            if p_val > 3.01:
                conn.close()
                raise HTTPException(status_code=400, detail="Punctuality score cannot exceed 3.0.")
        elif doc_type == "Experiment" and max_allowed == 15.0:
            if k_val > 4.01:
                conn.close()
                raise HTTPException(status_code=400, detail="Knowledge score cannot exceed 4.0.")
            if perf_val > 5.01:
                conn.close()
                raise HTTPException(status_code=400, detail="Performance score cannot exceed 5.0.")
            if c_val > 3.01:
                conn.close()
                raise HTTPException(status_code=400, detail="Content score cannot exceed 3.0.")
            if p_val > 3.01:
                conn.close()
                raise HTTPException(status_code=400, detail="Punctuality score cannot exceed 3.0.")

    # Calculate net score after late penalty if applicable
    late_penalty_applied = float(sub.get("late_penalty_applied") or 0.0)
    final_remarks = eval_in.remarks or "Approved and verified"
    if late_penalty_applied > 0:
        penalty_cut = round(eval_in.marks_awarded * (late_penalty_applied / 100.0), 2)
        net_score = round(eval_in.marks_awarded - penalty_cut, 2)
        final_remarks += f" [Late Penalty: -{late_penalty_applied}% (-{penalty_cut} marks). Net Score: {net_score}/{max_allowed}]"

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
        final_remarks,
        digital_stamp,
        now_iso
    ))

    # Mark submission and document as graded (or returned if action is returned)
    sub_status = "returned" if eval_in.action == "returned" else "graded"
    cursor.execute("""
    UPDATE submissions SET
        status = ?,
        faculty_private_notes = COALESCE(?, faculty_private_notes)
    WHERE id = ?;
    """, (sub_status, eval_in.faculty_private_notes, eval_in.submission_id))
    cursor.execute("UPDATE documents SET status = ?, updated_at = ? WHERE id = ?;", (sub_status, now_iso, sub["doc_id"]))

    # Notify student
    if sub_status == "returned":
        cursor.execute("""
        INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
        VALUES (?, ?, 'Document Returned for Corrections', ?, 'alert', '/student', 0, ?);
        """, (
            f"notif_{uuid.uuid4().hex[:8]}",
            sub["student_id"],
            f"Your {doc_type} '{sub['title']}' was returned for revision: {eval_in.feedback or final_remarks}",
            now_iso
        ))
    else:
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
    sub_row = cursor.fetchone()

    if not sub_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Submission not found.")

    sub = dict(sub_row)

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

