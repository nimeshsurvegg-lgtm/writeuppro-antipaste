import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import SubmissionSubmit

router = APIRouter()

@router.post("")
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
    profile_row = cursor.fetchone()
    if not profile_row or profile_row["status"] != "approved":
        conn.close()
        raise HTTPException(status_code=403, detail="Your profile must be approved by the administrator before submitting academic work.")
    profile = dict(profile_row)

    # Verify document ownership and completeness
    cursor.execute("SELECT * FROM documents WHERE id = ? AND student_id = ?;", (sub_in.document_id, student_id))
    doc_row = cursor.fetchone()
    if not doc_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")
    doc = dict(doc_row)

    # Check content completeness across editor, attachments, or external link
    cursor.execute("SELECT COUNT(*) FROM submission_attachments WHERE document_id = ?;", (sub_in.document_id,))
    att_count = cursor.fetchone()[0]
    has_files = att_count > 0 or bool(doc.get("attachments_json") and doc["attachments_json"] != "[]")
    has_link = bool(doc.get("external_link_url") and len(doc["external_link_url"].strip()) > 5)
    has_editor = bool(doc["content_html"] and len(doc["content_html"].strip()) >= 15)

    if not doc["title"] or (not has_editor and not has_files and not has_link):
        conn.close()
        raise HTTPException(status_code=400, detail="Document cannot be submitted empty. Please write your content, upload file(s), or submit an external link.")

    # Check if already submitted and allow resubmission if returned
    cursor.execute("SELECT id, status, resubmission_count, version_number FROM submissions WHERE document_id = ? ORDER BY created_at DESC LIMIT 1;", (sub_in.document_id,))
    existing_sub_row = cursor.fetchone()
    existing_sub = dict(existing_sub_row) if existing_sub_row else None
    resub_count = 0
    ver_num = 1
    if existing_sub:
        if existing_sub["status"] != "returned":
            conn.close()
            raise HTTPException(status_code=400, detail="This document has already been submitted.")
        resub_count = (existing_sub.get("resubmission_count") or 0) + 1
        ver_num = (existing_sub.get("version_number") or 1) + 1

    # Task and batch verification & deadline delay calculation
    task_id = doc["task_id"] or sub_in.task_id
    task = None
    is_late = 0
    delay_seconds = 0
    delay_text = "Submitted on time"
    late_penalty_applied = 0.0
    batch_id = None

    if task_id:
        cursor.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,))
        task_row = cursor.fetchone()
        if task_row:
            task = dict(task_row)
            batch_id = task["batch_id"]
            # Verify batch membership if experiment is targeted to a specific batch
            if task["target_type"] == "batch" and batch_id:
                cursor.execute("SELECT * FROM batch_students WHERE batch_id = ? AND student_id = ?;", (batch_id, student_id))
                if not cursor.fetchone():
                    conn.close()
                    raise HTTPException(status_code=403, detail="You are not enrolled in the specific laboratory batch assigned for this experiment.")

            # Calculate deadline delay
            due_date_str = task["due_date"]
            if due_date_str:
                try:
                    # Clean ISO format or whitespace
                    cleaned_date = due_date_str.replace("Z", "+00:00")
                    if "T" in cleaned_date:
                        due_dt = datetime.fromisoformat(cleaned_date)
                    else:
                        due_dt = datetime.strptime(cleaned_date, "%Y-%m-%d %H:%M")
                    
                    if due_dt.tzinfo is not None:
                        now_cmp = datetime.now(timezone.utc)
                    else:
                        now_cmp = now

                    diff_sec = int((now_cmp - due_dt).total_seconds())
                    if diff_sec > 0:
                        is_late = 1
                        delay_seconds = diff_sec
                        if diff_sec < 60:
                            delay_text = f"Submitted {diff_sec}s late"
                        elif diff_sec < 3600:
                            mins = diff_sec // 60
                            delay_text = f"Submitted {mins}m late"
                        elif diff_sec < 86400:
                            hrs = diff_sec // 3600
                            mins = (diff_sec % 3600) // 60
                            delay_text = f"Submitted {hrs}h {mins}m late" if mins > 0 else f"Submitted {hrs}h late"
                        else:
                            days = diff_sec // 86400
                            hrs = (diff_sec % 86400) // 3600
                            delay_text = f"Submitted {days}d {hrs}h late" if hrs > 0 else f"Submitted {days}d late"

                        # Apply late submission policy
                        policy = task.get("late_submission_policy") or "allow"
                        if policy == "reject":
                            conn.close()
                            raise HTTPException(
                                status_code=400,
                                detail=f"Submission rejected: The deadline expired on {due_date_str}. Faculty policy does not permit late submissions for this assignment."
                            )
                        elif policy == "penalty":
                            late_penalty_applied = float(task.get("late_penalty_percent") or 10.0)
                except Exception as ex:
                    if isinstance(ex, HTTPException):
                        raise ex
                    # Date parsing fallback

    # Generate immutable snapshot and unique receipt
    sub_id = f"sub_{uuid.uuid4().hex[:10]}"
    sub_code = f"SUB-{now.year}-IIET-{uuid.uuid4().hex[:6].upper()}"
    submission_date_str = now.strftime("%d/%m/%Y %H:%M")

    # Snapshot HTML: assemble files/links if present
    snapshot_content = doc["content_html"] or ""
    sub_method = getattr(sub_in, "submission_method", None) or doc.get("submission_method") or "editor"
    ext_url = getattr(sub_in, "external_link_url", None) or doc.get("external_link_url")
    ext_title = getattr(sub_in, "external_link_title", None) or doc.get("external_link_title")
    ext_desc = getattr(sub_in, "external_link_description", None) or doc.get("external_link_description")
    att_json = doc.get("attachments_json") or "[]"

    cursor.execute("""
    INSERT INTO submissions (
        id, document_id, task_id, student_id, submission_code, snapshot_html,
        submission_date, is_late, delay_seconds, delay_text, late_penalty_applied, batch_id, status, created_at,
        submission_method, external_link_url, external_link_title, external_link_description,
        attachments_json, resubmission_count, version_number
    ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, 'submitted', ?,
        ?, ?, ?, ?,
        ?, ?, ?
    );
    """, (
        sub_id, sub_in.document_id, task_id, student_id,
        sub_code, snapshot_content, submission_date_str,
        is_late, delay_seconds, delay_text, late_penalty_applied, batch_id, now_iso,
        sub_method, ext_url, ext_title, ext_desc,
        att_json, resub_count, ver_num
    ))

    # Link any attachments belonging to this document to this submission
    cursor.execute("UPDATE submission_attachments SET submission_id = ? WHERE document_id = ? AND submission_id IS NULL;", (sub_id, sub_in.document_id))

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
        "id": sub_id,
        "submission_code": sub_code,
        "submission_date": submission_date_str
    }

@router.get("")
@router.get("/")
def list_submissions(
    subject: str = None,
    division: str = None,
    status_filter: str = None,
    batch_id: str = None,
    task_id: str = None,
    payload: dict = Depends(require_roles("faculty", "admin"))
):
    """Lists student submissions grouped by classroom folders for faculty evaluation."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT s.id as submission_id, s.submission_code, s.submission_date, s.status,
           s.is_late, s.delay_seconds, s.delay_text, s.late_penalty_applied, s.batch_id,
           lb.batch_name,
           t.title as task_title, COALESCE(t.category, 'standard') as task_category, t.target_type,
           d.id as document_id, d.title, d.doc_type, d.doc_number, d.subject_name, d.subject_code,
           u.id as student_id, u.full_name as student_name,
           sp.roll_number, sp.year_level, sp.branch_code, sp.division_name,
           e.marks_awarded, e.max_marks as eval_max_marks, e.evaluated_at
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON s.student_id = u.id
    LEFT JOIN tasks t ON s.task_id = t.id
    LEFT JOIN lab_batches lb ON s.batch_id = lb.id
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
    if batch_id:
        query += " AND s.batch_id = ?"
        params.append(batch_id)
    if task_id:
        query += " AND s.task_id = ?"
        params.append(task_id)

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
           lb.batch_name,
           t.title as task_title, COALESCE(t.category, 'standard') as task_category, t.target_type, t.due_date as task_due_date,
           t.late_submission_policy, t.custom_rubric_id, t.instructions as task_instructions,
           d.id as doc_id, d.title, d.doc_type, d.doc_number, d.subject_name, d.subject_code,
           u.full_name as student_name,
           sp.roll_number, sp.year_level, sp.branch_code, sp.division_name,
           e.id as evaluation_id, e.marks_awarded, e.max_marks as eval_max_marks, e.rubric_scores_json,
           e.feedback, e.remarks as faculty_remarks, e.digital_signature_code, e.evaluated_at,
           fac.full_name as evaluator_name
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON s.student_id = u.id
    LEFT JOIN tasks t ON s.task_id = t.id
    LEFT JOIN lab_batches lb ON s.batch_id = lb.id
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

    if sub.get("custom_rubric_id"):
        cursor.execute("SELECT * FROM custom_rubrics WHERE id = ?;", (sub["custom_rubric_id"],))
        cr = cursor.fetchone()
        if cr:
            import json
            c_dict = dict(cr)
            try:
                c_dict["criteria"] = json.loads(c_dict["criteria_json"])
            except Exception:
                c_dict["criteria"] = []
            sub["custom_rubric"] = c_dict
        else:
            sub["custom_rubric"] = None
    else:
        sub["custom_rubric"] = None

    # Load attachments
    cursor.execute("""
    SELECT id, original_filename, stored_filename, file_size, mime_type, created_at
    FROM submission_attachments
    WHERE submission_id = ? OR document_id = ?;
    """, (submission_id, sub.get("doc_id")))
    att_rows = [dict(a) for a in cursor.fetchall()]
    if att_rows:
        sub["attachments"] = att_rows
    elif sub.get("attachments_json"):
        import json
        try:
            sub["attachments"] = json.loads(sub["attachments_json"])
        except Exception:
            sub["attachments"] = []
    else:
        sub["attachments"] = []

    conn.close()
    return sub
