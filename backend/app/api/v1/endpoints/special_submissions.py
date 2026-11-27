import os
import uuid
import json
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import SpecialSubmissionSubmit

router = APIRouter()

BLOCKED_EXTENSIONS = {
    "exe", "bat", "cmd", "sh", "php", "py", "pl", "cgi", "jar",
    "vbs", "msi", "com", "scr", "pif", "hta", "cpl", "msc", "wsf"
}

ALLOWED_MIME_PATTERNS = [
    r"^application/pdf$",
    r"^application/msword$",
    r"^application/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$",
    r"^application/vnd\.ms-powerpoint$",
    r"^application/vnd\.openxmlformats-officedocument\.presentationml\.presentation$",
    r"^application/vnd\.ms-excel$",
    r"^application/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$",
    r"^application/zip$",
    r"^application/x-zip-compressed$",
    r"^text/plain$",
    r"^image/(jpeg|png|webp|gif)$"
]

def sanitize_filename(filename: str) -> str:
    """Removes path traversals, special characters, and sanitizes filenames."""
    basename = os.path.basename(filename)
    clean = re.sub(r"[^\w\.\-\_]", "_", basename)
    return clean[:120] if clean else "document"

@router.post("/upload")
async def upload_special_attachment(
    task_id: str = Form(...),
    document_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    payload: dict = Depends(require_roles("student"))
):
    """Securely uploads and validates an academic attachment for a Special Document task."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Verify student profile is approved
    cursor.execute("SELECT status FROM student_profiles WHERE user_id = ?;", (student_id,))
    sp = cursor.fetchone()
    if not sp or sp["status"] != "approved":
        conn.close()
        raise HTTPException(status_code=403, detail="Student profile must be approved before uploading documents.")

    # 2. Verify task existence and settings
    cursor.execute("SELECT * FROM tasks WHERE id = ?;", (task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Special document task not found.")

    task = dict(task_row)
    try:
        allowed_methods = json.loads(task["allowed_methods_json"]) if task.get("allowed_methods_json") else ["editor", "pdf", "docx", "other_files", "external_link"]
    except Exception:
        allowed_methods = ["editor", "pdf", "docx", "other_files", "external_link"]

    try:
        allowed_extensions = json.loads(task["allowed_extensions_json"]) if task.get("allowed_extensions_json") else ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]
    except Exception:
        allowed_extensions = ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]

    max_size_mb = int(task.get("max_file_size_mb") or 10)
    max_files = int(task.get("max_files_count") or 3)
    max_bytes = max_size_mb * 1024 * 1024

    # 3. Check attachment count
    cursor.execute("""
    SELECT COUNT(*) FROM submission_attachments
    WHERE student_id = ? AND task_id = ? AND submission_id IS NULL;
    """, (student_id, task_id))
    current_count = cursor.fetchone()[0]
    if current_count >= max_files:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Attachment limit exceeded. Maximum {max_files} file(s) allowed.")

    # 4. Validate filename & extension
    original_name = file.filename or "uploaded_file"
    safe_name = sanitize_filename(original_name)
    parts = safe_name.rsplit(".", 1)
    if len(parts) < 2:
        conn.close()
        raise HTTPException(status_code=400, detail="Uploaded file missing extension.")

    ext = parts[1].lower()
    if ext in BLOCKED_EXTENSIONS:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unsafe file format (.{ext}) blocked by academic security policy.")

    # Validate against allowed extensions and methods
    file_method = None
    if ext == "pdf":
        file_method = "pdf"
    elif ext in ["doc", "docx"]:
        file_method = "docx"
    else:
        file_method = "other_files"

    if file_method not in allowed_methods:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"The submission method for .{ext} files is not permitted for this assignment. Faculty has enabled: {', '.join(allowed_methods)}."
        )

    clean_allowed_exts = [e.lower().lstrip(".") for e in allowed_extensions]
    if ext not in clean_allowed_exts and ext != "pdf" and ext not in ["doc", "docx"]:
        conn.close()
        raise HTTPException(status_code=400, detail=f"File extension '.{ext}' is not among the allowed formats ({', '.join(clean_allowed_exts)}).")

    # 5. Read and validate file content & size
    content = await file.read()
    file_size = len(content)
    if file_size <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if file_size > max_bytes:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"File size ({round(file_size / (1024 * 1024), 2)} MB) exceeds configured maximum limit of {max_size_mb} MB."
        )

    # 6. Validate MIME type
    content_type = file.content_type or "application/octet-stream"
    mime_matched = any(re.match(pat, content_type, re.IGNORECASE) for pat in ALLOWED_MIME_PATTERNS)
    if not mime_matched and ext in ["pdf", "docx", "doc", "jpg", "jpeg", "png"]:
        # Fallback inspection by extension
        pass

    # 7. Persist to storage directory
    att_id = f"att_{uuid.uuid4().hex[:12]}"
    stored_name = f"{att_id}_{safe_name}"
    uploads_dir = settings.uploads_directory
    file_path = os.path.join(uploads_dir, stored_name)

    with open(file_path, "wb") as f_out:
        f_out.write(content)

    # 8. Insert record into database
    cursor.execute("""
    INSERT INTO submission_attachments (
        id, task_id, document_id, submission_id, student_id, original_filename,
        stored_filename, file_size, mime_type, file_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        att_id, task_id, document_id, None, student_id, safe_name,
        stored_name, file_size, content_type, file_path, now_iso
    ))

    conn.commit()
    conn.close()

    return {
        "id": att_id,
        "original_filename": safe_name,
        "file_size": file_size,
        "mime_type": content_type,
        "created_at": now_iso,
        "file_method": file_method
    }

@router.delete("/attachments/{attachment_id}")
def delete_special_attachment(attachment_id: str, payload: dict = Depends(require_roles("student"))):
    """Deletes an unsubmitted attachment belonging to the student."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM submission_attachments WHERE id = ? AND student_id = ?;", (attachment_id, student_id))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Attachment not found or access denied.")

    att = dict(row)
    if att.get("submission_id"):
        # Check if submission is already graded
        cursor.execute("SELECT status FROM submissions WHERE id = ?;", (att["submission_id"],))
        sub = cursor.fetchone()
        if sub and sub["status"] == "graded":
            conn.close()
            raise HTTPException(status_code=400, detail="Cannot delete attachment from an already graded submission.")

    # Remove file from disk
    file_path = att["file_path"]
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    cursor.execute("DELETE FROM submission_attachments WHERE id = ?;", (attachment_id,))
    conn.commit()
    conn.close()

    return {"message": "Attachment deleted successfully.", "id": attachment_id}

@router.get("/attachments/{attachment_id}/download")
def download_special_attachment(
    attachment_id: str,
    token: Optional[str] = Query(None),
    payload: Optional[dict] = None
):
    """Securely downloads an attachment with authenticated access verification."""
    # Support token in query param for direct browser file links
    actual_payload = None
    if token:
        from app.core.security import decode_token
        actual_payload = decode_token(token)
    elif payload:
        actual_payload = payload

    if not actual_payload:
        raise HTTPException(status_code=401, detail="Authentication required to download attachment.")

    user_id = actual_payload.get("sub")
    role = actual_payload.get("role")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM submission_attachments WHERE id = ?;", (attachment_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    att = dict(row)
    if role == "student" and att["student_id"] != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to student attachment.")

    file_path = att["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical attachment file missing from storage.")

    return FileResponse(
        path=file_path,
        filename=att["original_filename"],
        media_type=att["mime_type"],
        headers={"Content-Disposition": f'attachment; filename="{att["original_filename"]}"'}
    )

@router.get("/attachments/{attachment_id}/preview")
def preview_special_attachment(
    attachment_id: str,
    token: Optional[str] = Query(None),
    payload: Optional[dict] = None
):
    """Streams preview of attachment (inline PDF, image, or text)."""
    actual_payload = None
    if token:
        from app.core.security import decode_token
        actual_payload = decode_token(token)
    elif payload:
        actual_payload = payload

    if not actual_payload:
        raise HTTPException(status_code=401, detail="Authentication required to preview attachment.")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM submission_attachments WHERE id = ?;", (attachment_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Attachment not found.")

    att = dict(row)
    file_path = att["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical attachment file missing from storage.")

    return FileResponse(
        path=file_path,
        media_type=att["mime_type"],
        headers={"Content-Disposition": f'inline; filename="{att["original_filename"]}"'}
    )

@router.post("/submit")
def submit_special_document(data: SpecialSubmissionSubmit, payload: dict = Depends(require_roles("student"))):
    """Submits or saves draft for a Special Document with flexible submission methods."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now()
    now_iso = now.isoformat()

    # 1. Verify student profile
    cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (student_id,))
    profile = cursor.fetchone()
    if not profile or profile["status"] != "approved":
        conn.close()
        raise HTTPException(status_code=403, detail="Student profile must be approved before submitting academic work.")

    # 2. Fetch task
    cursor.execute("SELECT * FROM tasks WHERE id = ?;", (data.task_id,))
    task_row = cursor.fetchone()
    if not task_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Special document task not found.")

    task = dict(task_row)
    try:
        allowed_methods = json.loads(task["allowed_methods_json"]) if task.get("allowed_methods_json") else ["editor", "pdf", "docx", "other_files", "external_link"]
    except Exception:
        allowed_methods = ["editor", "pdf", "docx", "other_files", "external_link"]

    allow_multiple = bool(task.get("allow_multiple_methods"))
    allow_resubmission = bool(task.get("allow_resubmission", 1))

    # 3. Validate selected submission method
    if data.submission_method != "multi" and data.submission_method not in allowed_methods:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"The submission method '{data.submission_method}' is not enabled by faculty for this task."
        )

    # 4. Collect attachments
    attachments_list = []
    if data.attachment_ids:
        placeholders = ", ".join(["?"] * len(data.attachment_ids))
        cursor.execute(f"SELECT * FROM submission_attachments WHERE id IN ({placeholders}) AND student_id = ?;", (*data.attachment_ids, student_id))
        attachments_list = [dict(r) for r in cursor.fetchall()]
    elif data.attachments:
        attachments_list = data.attachments

    # 5. Validate content presence for final submission
    has_editor = bool(data.content_html and len(data.content_html.strip()) >= 15)
    has_link = bool(data.external_link_url and len(data.external_link_url.strip()) > 5)
    has_files = len(attachments_list) > 0

    if not data.is_draft:
        if not has_editor and not has_link and not has_files:
            conn.close()
            raise HTTPException(
                status_code=400,
                detail="Submission cannot be empty. Please provide editor content, uploaded file(s), or an external project link."
            )

        # Validate URL format if provided
        if has_link:
            url_str = data.external_link_url.strip()
            if not re.match(r"^https?:\/\/[^\s\/$.?#].[^\s]*$", url_str, re.IGNORECASE):
                conn.close()
                raise HTTPException(status_code=400, detail="Invalid external link URL. Must begin with http:// or https://")

    # 6. Check existing submission and resubmission rules
    cursor.execute("""
    SELECT s.*, e.marks_awarded, e.status as eval_status FROM submissions s
    LEFT JOIN evaluations e ON s.id = e.submission_id
    WHERE s.student_id = ? AND s.task_id = ?
    ORDER BY s.created_at DESC LIMIT 1;
    """, (student_id, data.task_id))
    existing_sub = cursor.fetchone()

    resubmission_count = 0
    version_number = 1
    if existing_sub:
        resubmission_count = (existing_sub.get("resubmission_count") or 0) + 1
        version_number = (existing_sub.get("version_number") or 1) + 1

        if not data.is_draft:
            if existing_sub["status"] == "graded":
                conn.close()
                raise HTTPException(status_code=400, detail="This special submission has already been graded and finalized.")
            if existing_sub["status"] == "submitted" and not allow_resubmission:
                conn.close()
                raise HTTPException(status_code=400, detail="Resubmission is not permitted for this assignment.")

    # 7. Check Deadline & Late Submission Policy
    is_late = 0
    delay_seconds = 0
    delay_text = "Submitted on time"
    late_penalty_applied = 0.0

    due_date_str = task.get("due_date")
    if due_date_str and not data.is_draft:
        try:
            cleaned_date = due_date_str.replace("Z", "+00:00")
            if "T" in cleaned_date:
                due_dt = datetime.fromisoformat(cleaned_date)
            else:
                due_dt = datetime.strptime(cleaned_date, "%Y-%m-%d %H:%M")

            now_cmp = datetime.now(timezone.utc) if due_dt.tzinfo is not None else now
            diff_sec = int((now_cmp - due_dt).total_seconds())

            if diff_sec > 0:
                is_late = 1
                delay_seconds = diff_sec
                if diff_sec < 60:
                    delay_text = f"Submitted {diff_sec}s late"
                elif diff_sec < 3600:
                    delay_text = f"Submitted {diff_sec // 60}m late"
                elif diff_sec < 86400:
                    hrs = diff_sec // 3600
                    mins = (diff_sec % 3600) // 60
                    delay_text = f"Submitted {hrs}h {mins}m late" if mins > 0 else f"Submitted {hrs}h late"
                else:
                    days = diff_sec // 86400
                    hrs = (diff_sec % 86400) // 3600
                    delay_text = f"Submitted {days}d {hrs}h late" if hrs > 0 else f"Submitted {days}d late"

                policy = task.get("late_submission_policy") or "accept"
                if policy == "reject":
                    conn.close()
                    raise HTTPException(
                        status_code=400,
                        detail=f"Submission rejected: The deadline expired on {due_date_str}. Late submissions are not accepted."
                    )
                elif policy == "penalty":
                    late_penalty_applied = float(task.get("late_penalty_percent") or 10.0)
        except Exception as ex:
            if isinstance(ex, HTTPException):
                raise ex

    # 8. Create or Update Document Record
    doc_id = data.document_id
    if not doc_id:
        # Check if existing doc exists for this task
        cursor.execute("SELECT id FROM documents WHERE student_id = ? AND task_id = ? LIMIT 1;", (student_id, data.task_id))
        doc_row = cursor.fetchone()
        if doc_row:
            doc_id = doc_row["id"]
        else:
            doc_id = f"doc_{uuid.uuid4().hex[:10]}"

    cursor.execute("SELECT id FROM documents WHERE id = ?;", (doc_id,))
    doc_exists = bool(cursor.fetchone())

    subject_name = task.get("subject_name") or "Special Course"
    subject_code = task.get("subject_code") or "SP-101"
    cursor.execute("SELECT name, code FROM subjects WHERE id = ?;", (task["subject_id"],))
    sub_subj = cursor.fetchone()
    if sub_subj:
        subject_name = sub_subj["name"]
        subject_code = sub_subj["code"]

    status_str = "draft" if data.is_draft else "submitted"
    attachments_json_str = json.dumps([{
        "id": a["id"],
        "original_filename": a["original_filename"],
        "file_size": a["file_size"],
        "mime_type": a.get("mime_type", "")
    } for a in attachments_list])

    if doc_exists:
        cursor.execute("""
        UPDATE documents SET
            title = ?, content_html = ?, word_count = ?, status = ?, updated_at = ?,
            submission_method = ?, external_link_url = ?, external_link_title = ?,
            external_link_description = ?, attachments_json = ?
        WHERE id = ?;
        """, (
            data.title.strip(), data.content_html or "", data.word_count or 0, status_str, now_iso,
            data.submission_method, data.external_link_url, data.external_link_title,
            data.external_link_description, attachments_json_str, doc_id
        ))
    else:
        cursor.execute("""
        INSERT INTO documents (
            id, student_id, task_id, title, doc_type, subject_name, subject_code,
            doc_number, content_html, word_count, status, created_at, updated_at,
            submission_method, external_link_url, external_link_title,
            external_link_description, attachments_json
        ) VALUES (
            ?, ?, ?, ?, 'Special Document', ?, ?,
            '1', ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        );
        """, (
            doc_id, student_id, data.task_id, data.title.strip(), subject_name, subject_code,
            data.content_html or "", data.word_count or 0, status_str, now_iso, now_iso,
            data.submission_method, data.external_link_url, data.external_link_title,
            data.external_link_description, attachments_json_str
        ))

    # Link attachments to document
    for a in attachments_list:
        cursor.execute("UPDATE submission_attachments SET document_id = ? WHERE id = ?;", (doc_id, a["id"]))

    if data.is_draft:
        conn.commit()
        conn.close()
        return {
            "message": "Special document draft saved successfully.",
            "document_id": doc_id,
            "status": "draft",
            "updated_at": now_iso
        }

    # 9. Create Final Submission Snapshot
    sub_id = f"sub_{uuid.uuid4().hex[:10]}"
    sub_code = f"SUB-{now.year}-SP-{uuid.uuid4().hex[:6].upper()}"
    submission_date_str = now.strftime("%d/%m/%Y %H:%M")

    # Generate snapshot representation
    snapshot_parts = []
    if has_files:
        files_html = "<div class='special-sub-files'><h4>Attached Files:</h4><ul>"
        for f in attachments_list:
            files_html += f"<li><strong>{f['original_filename']}</strong> ({round(f['file_size']/1024, 1)} KB)</li>"
        files_html += "</ul></div>"
        snapshot_parts.append(files_html)

    if has_link:
        link_html = f"<div class='special-sub-link'><h4>External Project Link:</h4><p><a href='{data.external_link_url}' target='_blank' rel='noopener noreferrer'>{data.external_link_title or data.external_link_url}</a></p>"
        if data.external_link_description:
            link_html += f"<p><em>{data.external_link_description}</em></p>"
        link_html += "</div>"
        snapshot_parts.append(link_html)

    if has_editor:
        snapshot_parts.append(f"<div class='special-sub-editor'>{data.content_html}</div>")

    snapshot_html = "".join(snapshot_parts) or "<p>Special Document Submission</p>"

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
        sub_id, doc_id, data.task_id, student_id, sub_code, snapshot_html,
        submission_date_str, is_late, delay_seconds, delay_text, late_penalty_applied, task.get("batch_id"), now_iso,
        data.submission_method, data.external_link_url, data.external_link_title, data.external_link_description,
        attachments_json_str, resubmission_count, version_number
    ))

    # Link attachments to submission
    for a in attachments_list:
        cursor.execute("UPDATE submission_attachments SET submission_id = ?, document_id = ? WHERE id = ?;", (sub_id, doc_id, a["id"]))

    # Notify faculty
    cursor.execute("SELECT full_name FROM users WHERE id = ?;", (student_id,))
    stu_name = cursor.fetchone()["full_name"]
    faculty_id = task.get("faculty_id")
    if faculty_id:
        cursor.execute("""
        INSERT INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
        VALUES (?, ?, 'Special Document Submitted', ?, 'info', '/faculty', 0, ?);
        """, (
            f"notif_{uuid.uuid4().hex[:8]}",
            faculty_id,
            f"{stu_name} ({profile['roll_number']}) submitted Special Document '{data.title}'.",
            now_iso
        ))

    conn.commit()
    conn.close()

    return {
        "message": "Special document submitted successfully.",
        "submission_id": sub_id,
        "submission_code": sub_code,
        "submission_date": submission_date_str,
        "is_late": is_late,
        "delay_text": delay_text,
        "version_number": version_number
    }
