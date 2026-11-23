from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any

# Authentication & Users
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class RegisterRequest(BaseModel):
    username: str
    email: str
    full_name: str
    password: str
    role: str = "student" # student, faculty, admin

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

# Academic Setup & Student Profile
class StudentProfileSubmission(BaseModel):
    roll_number: str
    prn: Optional[str] = None
    year_level: str # FE, SE, TE, BE
    branch_code: str # CE, IT, ASH
    semester_number: int
    division_name: str # Div A, Div B
    elective_subject: Optional[str] = None

class ProfileApprovalUpdate(BaseModel):
    status: str # approved, rejected, blocked
    remarks: Optional[str] = None

# Tasks
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    subject_id: str
    task_type: str # Assignment, Experiment
    task_number: str
    max_marks: float
    instructions: Optional[str] = None
    due_date: str
    rubric: List[Dict[str, Any]]

# Documents
class DocumentSave(BaseModel):
    title: str
    subject_name: str
    subject_code: str
    doc_type: str # Assignment, Experiment
    doc_number: str
    content_html: str
    word_count: int = 0
    status: str = "draft" # draft, submitted
    task_id: Optional[str] = None

# Submissions
class SubmissionSubmit(BaseModel):
    document_id: str
    task_id: Optional[str] = None

# Evaluation
class EvaluationSubmit(BaseModel):
    submission_id: str
    marks_awarded: float
    rubric_scores: Dict[str, float]
    feedback: Optional[str] = None
    remarks: Optional[str] = None
    action: str = "approved" # approved, returned

# Integrity
class IntegrityEventLog(BaseModel):
    document_id: Optional[str] = None
    event_type: str # paste_attempt, drop_attempt, tab_blur, typing_burst, large_insertion
    severity: str = "medium"
    metadata: Dict[str, Any]

class IntegrityEventReview(BaseModel):
    review_status: str # reviewed, dismissed, investigating
    admin_remarks: Optional[str] = None
