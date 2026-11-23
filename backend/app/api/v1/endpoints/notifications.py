from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload

router = APIRouter()

@router.get("/")
def get_notifications(payload: dict = Depends(get_current_user_payload)):
    """Retrieves notifications for the current authenticated user."""
    user_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50;
    """, (user_id,))
    notifs = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0;", (user_id,))
    unread_count = cursor.fetchone()[0]

    conn.close()
    return {"notifications": notifs, "unread_count": unread_count}

@router.patch("/{notif_id}/read")
def mark_notification_read(notif_id: str, payload: dict = Depends(get_current_user_payload)):
    """Marks a single notification as read."""
    user_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?;", (notif_id, user_id))
    conn.commit()
    conn.close()
    return {"message": "Notification marked as read."}

@router.post("/read-all")
def mark_all_read(payload: dict = Depends(get_current_user_payload)):
    """Marks all user notifications as read."""
    user_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?;", (user_id,))
    conn.commit()
    conn.close()
    return {"message": "All notifications marked as read."}
