import uuid
import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.schemas.models import IntegrityEventLog, IntegrityEventReview

router = APIRouter()

@router.post("/events")
def log_integrity_event(event_in: IntegrityEventLog, payload: dict = Depends(require_roles("student"))):
    """Logs client telemetry security flags (paste block, drop block, focus blur, keystroke burst)."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    event_id = f"ie_{uuid.uuid4().hex[:10]}"

    cursor.execute("""
    INSERT INTO integrity_events (
        id, student_id, document_id, event_type, severity, metadata_json, review_status, admin_remarks, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', '', ?);
    """, (
        event_id,
        student_id,
        event_in.document_id,
        event_in.event_type,
        event_in.severity,
        json.dumps(event_in.metadata),
        now_iso
    ))

    conn.commit()
    conn.close()
    return {"message": "Integrity event recorded in institutional ledger.", "event_id": event_id}

@router.get("/events")
def list_integrity_events(
    event_type: str = None,
    severity: str = None,
    status_filter: str = None,
    payload: dict = Depends(require_roles("admin", "faculty"))
):
    """Administrator lists and filters integrity events from the security ledger."""
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
    SELECT ie.*, u.full_name as student_name, sp.roll_number, d.title as document_title
    FROM integrity_events ie
    JOIN users u ON ie.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    LEFT JOIN documents d ON ie.document_id = d.id
    WHERE 1=1
    """
    params = []
    if event_type:
        query += " AND ie.event_type = ?"
        params.append(event_type)
    if severity:
        query += " AND ie.severity = ?"
        params.append(severity)
    if status_filter:
        query += " AND ie.review_status = ?"
        params.append(status_filter)

    query += " ORDER BY ie.timestamp DESC;"
    cursor.execute(query, params)
    events = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return events

@router.patch("/events/{event_id}")
def review_integrity_event(
    event_id: str,
    review: IntegrityEventReview,
    payload: dict = Depends(require_roles("admin"))
):
    """Administrator reviews, dismisses, or flags an integrity event."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM integrity_events WHERE id = ?;", (event_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Integrity event not found.")

    cursor.execute("""
    UPDATE integrity_events
    SET review_status = ?, admin_remarks = ?
    WHERE id = ?;
    """, (review.review_status, review.admin_remarks or "", event_id))

    conn.commit()
    conn.close()
    return {"message": "Integrity event review status updated."}
