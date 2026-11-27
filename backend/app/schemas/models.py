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
    task_type: Optional[str] = "Assignment" # Assignment, Experiment, Special Document
    task_number: Optional[str] = "1"
    max_marks: Optional[float] = None
    instructions: Optional[str] = None
    due_date: str
    rubric: Optional[List[Dict[str, Any]]] = None
    # Extended Academic Management fields
    academic_year: Optional[str] = "2026-27"
    branch_code: Optional[str] = "CE"
    year_level: Optional[str] = "SE"
    semester_number: Optional[int] = 3
    division_name: Optional[str] = "Div A"
    target_type: Optional[str] = "division" # division, batch
    batch_id: Optional[str] = None
    category: Optional[str] = "standard" # standard, experiment, special_document
    document_category: Optional[str] = None # Mini Project Report, Major Project Report, Research Paper, etc.
    experiment_number: Optional[str] = None
    objective: Optional[str] = None
    problem_statement: Optional[str] = None
    hardware_software_req: Optional[str] = None
    procedure: Optional[str] = None
    expected_output: Optional[str] = None
    reference_file_url: Optional[str] = None
    late_submission_policy: Optional[str] = "accept" # accept, penalty, reject
    late_penalty_percent: Optional[float] = 0.0
    custom_rubric_id: Optional[str] = None
    # Special Document Flexible Submission Method Configurations
    allowed_methods: Optional[List[str]] = ["editor", "pdf", "docx", "other_files", "external_link"]
    allow_multiple_methods: Optional[bool] = False
    max_file_size_mb: Optional[int] = 10
    max_files_count: Optional[int] = 3
    allowed_extensions: Optional[List[str]] = ["pdf", "docx", "doc", "zip", "pptx", "xlsx", "png", "jpg", "txt"]
    require_pdf_conversion: Optional[bool] = False
    allow_resubmission: Optional[bool] = True
    allow_edit_before_deadline: Optional[bool] = True

# Academic Structure & Curriculum Management Models
class AcademicYearCreate(BaseModel):
    code: str # e.g. '2026-27'
    name: str # e.g. 'Academic Year 2026-27'
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_current: bool = False
    status: str = "active" # upcoming, active, completed, archived

class AcademicYearStatusUpdate(BaseModel):
    status: str

class SubjectCreate(BaseModel):
    name: str
    code: str
    branch_id: Optional[str] = None
    branch_code: Optional[str] = None
    year_level: str = "FE"
    semester_number: int = 1
    category: str = "Core" # Core, Professional Elective, Open Elective, Basic Science, etc.
    credits: float = 3.0
    total_credits: float = 3.0
    subject_type: str = "Theory" # Theory, Practical, Laboratory, Tutorial, Project, Open Elective, Other
    teaching_hours: int = 4
    syllabus_scheme: str = "Mumbai University Rev-2019 'C' Scheme"
    academic_year: str = "2026-27"
    description: Optional[str] = ""
    is_elective: int = 0

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    credits: Optional[float] = None
    total_credits: Optional[float] = None
    subject_type: Optional[str] = None
    teaching_hours: Optional[int] = None
    syllabus_scheme: Optional[str] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class SubjectBulkImport(BaseModel):
    subjects: List[SubjectCreate]

class CurriculumVersionCreate(BaseModel):
    academic_year: str
    branch_code: str
    year_level: str
    semester_number: int
    scheme_name: str
    status: str = "active" # draft, published, active, completed, archived

class CurriculumCloneRequest(BaseModel):
    source_academic_year: str
    target_academic_year: str
    branch_code: str
    scheme_name: Optional[str] = None

class AllotmentPreviewRequest(BaseModel):
    academic_year: str
    branch_code: str
    year_level: str
    semester_number: int
    division_name: str
    subject_ids: Optional[List[str]] = None

class BulkAllotmentPublish(BaseModel):
    academic_year: str
    branch_code: str
    year_level: str
    semester_number: int
    division_name: str
    allotments: List[Dict[str, str]] # [{"subject_id": "...", "faculty_id": "..."}]

class LabBatchCreate(BaseModel):
    batch_name: str # e.g. Batch A1
    academic_year: str
    branch_code: str
    year_level: str
    semester_number: int
    division_name: str
    subject_id: Optional[str] = None
    faculty_id: Optional[str] = None
    capacity: int = 25
    student_ids: Optional[List[str]] = None

class LabBatchUpdate(BaseModel):
    batch_name: Optional[str] = None
    faculty_id: Optional[str] = None
    capacity: Optional[int] = None
    status: Optional[str] = None
    student_ids: Optional[List[str]] = None

class BatchStudentAssign(BaseModel):
    student_ids: List[str]

class BatchManualAssignRequest(BaseModel):
    batch_id: str
    student_ids: List[str]
    subject_id: Optional[str] = None

class BatchUnassignRequest(BaseModel):
    batch_id: str
    student_ids: List[str]

class OpenElectiveConfigCreate(BaseModel):
    academic_year: str
    branch_code: str
    year_level: str
    semester_number: int
    subject_id: str
    faculty_id: Optional[str] = None
    max_capacity: int = 60
    selection_start_date: Optional[str] = None
    selection_end_date: Optional[str] = None

class OpenElectiveSelect(BaseModel):
    elective_config_id: str
    subject_id: str

class OpenElectiveReview(BaseModel):
    status: str # approved, rejected
    remarks: Optional[str] = None

class PromotionWindowCreate(BaseModel):
    title: str
    source_academic_year: str
    target_academic_year: str
    source_year_level: str
    target_year_level: str
    source_semester: int
    target_semester: int
    branch_code: str
    is_open: bool = True
    status: str = "open" # 'draft', 'scheduled', 'open', 'closed', 'completed'
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class PromotionWindowStatusUpdate(BaseModel):
    status: str # 'draft', 'scheduled', 'open', 'closed', 'completed'
    is_open: Optional[bool] = None
    closing_remarks: Optional[str] = None

class PromotionRequestSubmit(BaseModel):
    promotion_window_id: str
    cgpa: float
    requested_division: str
    requested_roll_number: str

class PromotionReview(BaseModel):
    status: str # approved, rejected, resubmission
    approved_division: Optional[str] = None
    approved_roll_number: Optional[str] = None
    remarks: Optional[str] = None

class CustomRubricCriterion(BaseModel):
    name: str
    description: Optional[str] = None
    max_marks: Optional[float] = None
    max_score: Optional[float] = None
    guidance: Optional[str] = None
    weightage: Optional[float] = None
    id: Optional[str] = None

class CustomRubricCreate(BaseModel):
    title: str
    document_category: str # Mini Project Report, Major Project Report, Research Paper, etc.
    total_marks: Optional[float] = None
    criteria: List[CustomRubricCriterion]

# Documents
class DocumentSave(BaseModel):
    title: str
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    doc_type: Optional[str] = None # Assignment, Experiment, Special Document
    doc_number: Optional[str] = "1"
    content_html: str
    word_count: int = 0
    status: str = "draft" # draft, submitted
    task_id: Optional[str] = None
    submission_method: Optional[str] = "editor"
    external_link_url: Optional[str] = None
    external_link_title: Optional[str] = None
    external_link_description: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None

# Submissions
class SubmissionSubmit(BaseModel):
    document_id: str
    task_id: Optional[str] = None
    submission_method: Optional[str] = "editor"
    external_link_url: Optional[str] = None
    external_link_title: Optional[str] = None
    external_link_description: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None

class SpecialSubmissionSubmit(BaseModel):
    task_id: str
    document_id: Optional[str] = None
    submission_method: str = "editor" # 'editor', 'pdf', 'docx', 'other_files', 'external_link', 'multi'
    title: str
    content_html: Optional[str] = ""
    word_count: Optional[int] = 0
    external_link_url: Optional[str] = None
    external_link_title: Optional[str] = None
    external_link_description: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    attachment_ids: Optional[List[str]] = None
    is_draft: bool = False

# Evaluation
class EvaluationSubmit(BaseModel):
    submission_id: str
    marks_awarded: float
    rubric_scores: Dict[str, float]
    feedback: Optional[str] = None
    remarks: Optional[str] = None
    faculty_private_notes: Optional[str] = None
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
