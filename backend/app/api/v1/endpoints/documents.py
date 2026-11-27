import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import DocumentSave

router = APIRouter()

@router.get("")
@router.get("/")
def list_documents(payload: dict = Depends(get_current_user_payload)):
    """Lists documents authored by the student, or all documents if admin."""
    conn = get_db_connection()
    cursor = conn.cursor()
    user_id = payload.get("sub")
    role = payload.get("role")

    if role == "student":
        cursor.execute("""
        SELECT d.*, 
               e.marks_awarded as marks,
               e.max_marks as eval_max_marks,
               e.remarks as faculty_remarks,
               s.submission_code,
               s.submission_date
        FROM documents d
        LEFT JOIN submissions s ON d.id = s.document_id
        LEFT JOIN evaluations e ON s.id = e.submission_id
        WHERE d.student_id = ?
        ORDER BY d.updated_at DESC;
        """, (user_id,))
    else:
        cursor.execute("""
        SELECT d.*, u.full_name as student_name, sp.roll_number,
               e.marks_awarded as marks
        FROM documents d
        JOIN users u ON d.student_id = u.id
        LEFT JOIN student_profiles sp ON u.id = sp.user_id
        LEFT JOIN submissions s ON d.id = s.document_id
        LEFT JOIN evaluations e ON s.id = e.submission_id
        ORDER BY d.updated_at DESC;
        """)

    docs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return docs

@router.get("/{doc_id}")
def get_document(doc_id: str, payload: dict = Depends(get_current_user_payload)):
    """Retrieves document data and its latest version snapshot."""
    conn = get_db_connection()
    cursor = conn.cursor()
    user_id = payload.get("sub")
    role = payload.get("role")

    cursor.execute("""
    SELECT d.*, u.full_name as student_name, sp.roll_number, sp.year_level, sp.division_name,
           s.id as submission_id, s.submission_code, s.submission_date,
           e.marks_awarded as marks, e.marks_awarded, e.max_marks as eval_max_marks, e.rubric_scores_json, e.remarks as faculty_remarks,
           e.digital_signature_code, e.evaluated_at,
           t.custom_rubric_id, cr.title as custom_rubric_title, cr.criteria_json as custom_rubric_criteria_json
    FROM documents d
    JOIN users u ON d.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    LEFT JOIN submissions s ON s.id = (SELECT s2.id FROM submissions s2 WHERE s2.document_id = d.id ORDER BY s2.created_at DESC LIMIT 1)
    LEFT JOIN evaluations e ON s.id = e.submission_id
    LEFT JOIN tasks t ON d.task_id = t.id
    LEFT JOIN custom_rubrics cr ON t.custom_rubric_id = cr.id
    WHERE d.id = ?;
    """, (doc_id,))
    doc_row = cursor.fetchone()

    if not doc_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")

    doc = dict(doc_row)
    if doc.get("rubric_scores_json"):
        import json
        try:
            doc["rubric_scores"] = json.loads(doc["rubric_scores_json"])
        except Exception:
            doc["rubric_scores"] = {}
    else:
        doc["rubric_scores"] = {}

    if doc.get("custom_rubric_criteria_json"):
        import json
        try:
            doc["custom_rubric"] = {
                "id": doc.get("custom_rubric_id"),
                "title": doc.get("custom_rubric_title") or "Custom Rubric",
                "criteria": json.loads(doc["custom_rubric_criteria_json"])
            }
        except Exception:
            doc["custom_rubric"] = None
    else:
        doc["custom_rubric"] = None
    # Check permissions: student must own it unless faculty or admin
    if role == "student" and doc["student_id"] != user_id:
        conn.close()
        raise HTTPException(status_code=403, detail="Unauthorized access to document.")

    # Fetch version history
    cursor.execute("""
    SELECT version_num, change_summary, created_at
    FROM document_versions
    WHERE document_id = ?
    ORDER BY version_num DESC;
    """, (doc_id,))
    doc["versions"] = [dict(v) for v in cursor.fetchall()]

    # Fetch attachments
    cursor.execute("""
    SELECT id, original_filename, stored_filename, file_size, mime_type, created_at
    FROM submission_attachments
    WHERE document_id = ?;
    """, (doc_id,))
    att_rows = [dict(a) for a in cursor.fetchall()]
    if att_rows:
        doc["attachments"] = att_rows
    elif doc.get("attachments_json"):
        import json
        try:
            doc["attachments"] = json.loads(doc["attachments_json"])
        except Exception:
            doc["attachments"] = []
    else:
        doc["attachments"] = []

    conn.close()
    return doc

@router.post("")
@router.post("/")
def save_document(
    doc_in: DocumentSave,
    doc_id: str = None,
    payload: dict = Depends(require_roles("student"))
):
    """Saves a draft document, creates new version snapshot, and persists word count."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    if doc_id:
        # Verify ownership and state
        cursor.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
        existing = cursor.fetchone()
        if not existing:
            conn.close()
            raise HTTPException(status_code=404, detail="Document not found.")
        if existing["student_id"] != student_id:
            conn.close()
            raise HTTPException(status_code=403, detail="Unauthorized.")
        if existing["status"] in ("submitted", "graded"):
            conn.close()
            raise HTTPException(status_code=400, detail="Submitted or graded documents cannot be edited directly.")

        # Resolve subject metadata if task_id provided
        subj_name = doc_in.subject_name.strip() if doc_in.subject_name else None
        subj_code = doc_in.subject_code.strip() if doc_in.subject_code else None
        doc_tp = doc_in.doc_type
        if (not subj_name or not subj_code or not doc_tp) and doc_in.task_id:
            cursor.execute("SELECT t.task_type, s.name, s.code FROM tasks t LEFT JOIN subjects s ON t.subject_id = s.id WHERE t.id = ?;", (doc_in.task_id,))
            t_row = cursor.fetchone()
            if t_row:
                subj_name = subj_name or t_row["name"] or "Subject"
                subj_code = subj_code or t_row["code"] or "SUB101"
                doc_tp = doc_tp or t_row["task_type"] or "Assignment"
        subj_name = subj_name or "General"
        subj_code = subj_code or "GEN101"
        doc_tp = doc_tp or "Assignment"

        # Update document
        att_json = json.dumps(doc_in.attachments) if doc_in.attachments is not None else existing.get("attachments_json") or "[]"
        cursor.execute("""
        UPDATE documents SET
            title = ?, subject_name = ?, subject_code = ?, doc_type = ?,
            doc_number = ?, content_html = ?, word_count = ?, task_id = ?, updated_at = ?,
            submission_method = COALESCE(?, submission_method),
            external_link_url = COALESCE(?, external_link_url),
            external_link_title = COALESCE(?, external_link_title),
            external_link_description = COALESCE(?, external_link_description),
            attachments_json = COALESCE(?, attachments_json)
        WHERE id = ?;
        """, (
            doc_in.title.strip(), subj_name, subj_code,
            doc_tp, (doc_in.doc_number or "1").strip(), doc_in.content_html,
            doc_in.word_count, doc_in.task_id, now_iso,
            doc_in.submission_method, doc_in.external_link_url, doc_in.external_link_title,
            doc_in.external_link_description, att_json, doc_id
        ))

        # Create version snapshot if changed significantly
        cursor.execute("SELECT COUNT(*) FROM document_versions WHERE document_id = ?;", (doc_id,))
        ver_count = cursor.fetchone()[0] + 1
        cursor.execute("""
        INSERT INTO document_versions (id, document_id, version_num, content_snapshot, author_id, change_summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (f"ver_{uuid.uuid4().hex[:10]}", doc_id, ver_count, doc_in.content_html, student_id, f"Draft auto-saved (v{ver_count})", now_iso))

        saved_id = doc_id
    else:
        # Create new document
        saved_id = f"doc_{uuid.uuid4().hex[:10]}"
        att_json = json.dumps(doc_in.attachments) if doc_in.attachments is not None else "[]"

        # Resolve subject metadata if task_id provided
        subj_name = doc_in.subject_name.strip() if doc_in.subject_name else None
        subj_code = doc_in.subject_code.strip() if doc_in.subject_code else None
        doc_tp = doc_in.doc_type
        if (not subj_name or not subj_code or not doc_tp) and doc_in.task_id:
            cursor.execute("SELECT t.task_type, s.name, s.code FROM tasks t LEFT JOIN subjects s ON t.subject_id = s.id WHERE t.id = ?;", (doc_in.task_id,))
            t_row = cursor.fetchone()
            if t_row:
                subj_name = subj_name or t_row["name"] or "Subject"
                subj_code = subj_code or t_row["code"] or "SUB101"
                doc_tp = doc_tp or t_row["task_type"] or "Assignment"
        subj_name = subj_name or "General"
        subj_code = subj_code or "GEN101"
        doc_tp = doc_tp or "Assignment"

        cursor.execute("""
        INSERT INTO documents (
            id, student_id, task_id, title, doc_type, subject_name, subject_code,
            doc_number, content_html, word_count, status, created_at, updated_at,
            submission_method, external_link_url, external_link_title, external_link_description, attachments_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?);
        """, (
            saved_id, student_id, doc_in.task_id, doc_in.title.strip(),
            doc_tp, subj_name, subj_code,
            (doc_in.doc_number or "1").strip(), doc_in.content_html, doc_in.word_count, now_iso, now_iso,
            doc_in.submission_method or "editor", doc_in.external_link_url, doc_in.external_link_title,
            doc_in.external_link_description, att_json
        ))

        # Initial version
        cursor.execute("""
        INSERT INTO document_versions (id, document_id, version_num, content_snapshot, author_id, change_summary, created_at)
        VALUES (?, ?, 1, ?, ?, 'Initial document draft', ?);
        """, (f"ver_{uuid.uuid4().hex[:10]}", saved_id, doc_in.content_html, student_id, now_iso))

    conn.commit()
    conn.close()
    return {"message": "Document saved successfully.", "id": saved_id, "updated_at": now_iso}

@router.post("/{doc_id}/duplicate")
def duplicate_document(doc_id: str, payload: dict = Depends(require_roles("student"))):
    """Creates an independent copy of an existing document as a draft."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM documents WHERE id = ? AND student_id = ?;", (doc_id, student_id))
    original = cursor.fetchone()
    if not original:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")

    new_id = f"doc_{uuid.uuid4().hex[:10]}"
    new_title = f"{original['title']} (Copy)"

    cursor.execute("""
    INSERT INTO documents (
        id, student_id, task_id, title, doc_type, subject_name, subject_code,
        doc_number, content_html, word_count, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?);
    """, (
        new_id, student_id, original["task_id"], new_title,
        original["doc_type"], original["subject_name"], original["subject_code"],
        original["doc_number"], original["content_html"], original["word_count"], now_iso, now_iso
    ))

    cursor.execute("""
    INSERT INTO document_versions (id, document_id, version_num, content_snapshot, author_id, change_summary, created_at)
    VALUES (?, ?, 1, ?, ?, 'Duplicated from existing document', ?);
    """, (f"ver_{uuid.uuid4().hex[:10]}", new_id, original["content_html"], student_id, now_iso))

    conn.commit()
    conn.close()
    return {"message": "Document duplicated successfully.", "new_id": new_id}

@router.delete("/{doc_id}")
def delete_document(doc_id: str, payload: dict = Depends(require_roles("student"))):
    """Deletes an eligible unsubmitted draft document."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM documents WHERE id = ? AND student_id = ?;", (doc_id, student_id))
    doc = cursor.fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc["status"] in ("submitted", "graded"):
        conn.close()
        raise HTTPException(status_code=400, detail="Submitted or graded documents cannot be deleted.")

    cursor.execute("DELETE FROM documents WHERE id = ?;", (doc_id,))
    conn.commit()
    conn.close()
    return {"message": "Draft document deleted successfully."}

@router.post("/{doc_id}/versions/{version_num}/restore")
def restore_document_version(doc_id: str, version_num: int, payload: dict = Depends(require_roles("student"))):
    """Restores content from a historical version snapshot into the current draft."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("SELECT * FROM documents WHERE id = ? AND student_id = ?;", (doc_id, student_id))
    doc = cursor.fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc["status"] in ("submitted", "graded"):
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot restore versions on submitted documents.")

    cursor.execute("SELECT content_snapshot FROM document_versions WHERE document_id = ? AND version_num = ?;", (doc_id, version_num))
    ver = cursor.fetchone()
    if not ver:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Version {version_num} not found.")

    restored_content = ver["content_snapshot"]
    cursor.execute("""
    UPDATE documents SET content_html = ?, updated_at = ? WHERE id = ?;
    """, (restored_content, now_iso, doc_id))

    # Record restoration snapshot
    cursor.execute("SELECT COUNT(*) FROM document_versions WHERE document_id = ?;", (doc_id,))
    new_ver_num = cursor.fetchone()[0] + 1
    cursor.execute("""
    INSERT INTO document_versions (id, document_id, version_num, content_snapshot, author_id, change_summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """, (f"ver_{uuid.uuid4().hex[:10]}", doc_id, new_ver_num, restored_content, student_id, f"Restored from version v{version_num}", now_iso))

    conn.commit()
    conn.close()
    return {"message": f"Document restored to version {version_num}.", "content_html": restored_content}

