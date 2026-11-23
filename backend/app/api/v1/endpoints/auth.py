import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import get_db_connection
from app.core.security import (
    hash_password, verify_password, create_access_token,
    get_current_user_payload
)
from app.schemas.models import LoginRequest, TokenResponse, RegisterRequest, ChangePasswordRequest

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ? COLLATE NOCASE;", (req.username.strip(),))
    user = cursor.fetchone()

    if not user or not verify_password(req.password, user["hashed_password"]):
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )

    if user["status"] == "suspended":
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended by the institution administrator."
        )

    # Fetch profile details if student or faculty
    profile = {}
    if user["role"] == "student":
        cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (user["id"],))
        p = cursor.fetchone()
        if p:
            profile = dict(p)
    elif user["role"] == "faculty":
        cursor.execute("SELECT * FROM faculty_profiles WHERE user_id = ?;", (user["id"],))
        p = cursor.fetchone()
        if p:
            profile = dict(p)

    conn.close()

    user_data = {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "status": user["status"],
        "profile": profile
    }

    token = create_access_token(data={"sub": user["id"], "username": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "user": user_data}

@router.post("/register")
def register(req: RegisterRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if username or email exists
    cursor.execute("SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE;", (req.username.strip(), req.email.strip()))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username or email already registered.")

    now_iso = datetime.now(timezone.utc).isoformat()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    pw_hash = hash_password(req.password)
    role = req.role.lower() if req.role.lower() in ("student", "faculty") else "student"

    cursor.execute("""
    INSERT INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?);
    """, (user_id, req.username.strip(), req.email.strip(), req.full_name.strip(), pw_hash, role, now_iso, now_iso))

    conn.commit()
    conn.close()

    token = create_access_token(data={"sub": user_id, "username": req.username.strip(), "role": role})
    return {
        "message": "User registered successfully.",
        "access_token": token,
        "user": {
            "id": user_id,
            "username": req.username.strip(),
            "email": req.email.strip(),
            "full_name": req.full_name.strip(),
            "role": role,
            "status": "active"
        }
    }

@router.get("/me")
def get_me(payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, full_name, role, status FROM users WHERE id = ?;", (user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    profile = {}
    if user["role"] == "student":
        cursor.execute("SELECT * FROM student_profiles WHERE user_id = ?;", (user_id,))
        p = cursor.fetchone()
        if p:
            profile = dict(p)
    elif user["role"] == "faculty":
        cursor.execute("SELECT * FROM faculty_profiles WHERE user_id = ?;", (user_id,))
        p = cursor.fetchone()
        if p:
            profile = dict(p)

    conn.close()
    return {**dict(user), "profile": profile}

@router.post("/change-password")
def change_password(req: ChangePasswordRequest, payload: dict = Depends(get_current_user_payload)):
    user_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT hashed_password FROM users WHERE id = ?;", (user_id,))
    user = cursor.fetchone()
    if not user or not verify_password(req.old_password, user["hashed_password"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Current password incorrect.")

    new_hash = hash_password(req.new_password)
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor.execute("UPDATE users SET hashed_password = ?, updated_at = ? WHERE id = ?;", (new_hash, now_iso, user_id))
    conn.commit()
    conn.close()
    return {"message": "Password changed successfully."}
