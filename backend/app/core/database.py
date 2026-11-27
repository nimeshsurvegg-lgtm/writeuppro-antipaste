import sqlite3
import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.core.security import hash_password

def get_db_connection() -> sqlite3.Connection:
    """Returns a high-concurrency SQLite connection with WAL mode, busy timeout, and row factory."""
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=25, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 15000;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema and seeds initial data if not already present."""
    os.makedirs(os.path.dirname(settings.DATABASE_PATH), exist_ok=True)
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        hashed_password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending', 'suspended', 'rejected')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # 2. Academic Hierarchy
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        department_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_years (
        id TEXT PRIMARY KEY,
        year_name TEXT NOT NULL, -- e.g. FE, SE, TE, BE
        academic_cycle TEXT NOT NULL -- e.g. 2026-27
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS semesters (
        id TEXT PRIMARY KEY,
        year_id TEXT NOT NULL,
        semester_number INTEGER NOT NULL,
        FOREIGN KEY (year_id) REFERENCES academic_years(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS divisions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL, -- e.g. Div A, Div B
        code TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        semester_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        is_elective INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
    );
    """)

    # 3. User Profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_profiles (
        user_id TEXT PRIMARY KEY,
        roll_number TEXT NOT NULL,
        prn TEXT,
        year_level TEXT NOT NULL, -- FE, SE, TE, BE
        branch_code TEXT NOT NULL,
        semester_number INTEGER NOT NULL,
        division_name TEXT NOT NULL,
        elective_subject TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'blocked')),
        admin_remarks TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS faculty_profiles (
        user_id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        department_code TEXT NOT NULL,
        designation TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS faculty_assignments (
        id TEXT PRIMARY KEY,
        faculty_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        division_name TEXT NOT NULL,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    """)

    # 4. Tasks (Assignments & Experiments)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        subject_id TEXT NOT NULL,
        faculty_id TEXT NOT NULL,
        task_type TEXT NOT NULL CHECK(task_type IN ('Assignment', 'Experiment', 'Special Document')),
        task_number TEXT NOT NULL,
        max_marks REAL NOT NULL,
        instructions TEXT,
        due_date TEXT NOT NULL,
        rubric_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        created_at TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 5. Documents & Version Snapshots
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        task_id TEXT,
        title TEXT NOT NULL,
        doc_type TEXT NOT NULL CHECK(doc_type IN ('Assignment', 'Experiment', 'Special Document')),
        subject_name TEXT NOT NULL,
        subject_code TEXT NOT NULL,
        doc_number TEXT NOT NULL,
        content_html TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'graded', 'returned')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS document_versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        version_num INTEGER NOT NULL,
        content_snapshot TEXT NOT NULL,
        author_id TEXT NOT NULL,
        change_summary TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
    """)

    # 6. Submissions (Immutable Snapshots)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        task_id TEXT,
        student_id TEXT NOT NULL,
        submission_code TEXT UNIQUE NOT NULL,
        snapshot_html TEXT NOT NULL,
        submission_date TEXT NOT NULL,
        is_late INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'graded', 'returned')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );
    """)

    # 7. Evaluations & Rubric Scoring
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        submission_id TEXT UNIQUE NOT NULL,
        faculty_id TEXT NOT NULL,
        marks_awarded REAL NOT NULL,
        max_marks REAL NOT NULL,
        rubric_scores_json TEXT NOT NULL,
        feedback TEXT,
        remarks TEXT,
        digital_signature_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('approved', 'returned', 'draft')),
        evaluated_at TEXT NOT NULL,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 8. Integrity & Security Monitoring Ledger
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS integrity_events (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        document_id TEXT,
        event_type TEXT NOT NULL, -- paste_attempt, drop_attempt, tab_blur, typing_burst, large_insertion
        severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('low', 'medium', 'high')),
        metadata_json TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending', 'reviewed', 'dismissed', 'investigating')),
        admin_remarks TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
    );
    """)

    # 9. Notifications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info', -- info, success, warning, alert
        link TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 10. Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        details_json TEXT,
        timestamp TEXT NOT NULL
    );
    """)

    # 11. Performance Indexes for Rapid Query Execution
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_student ON documents(student_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_submissions_doc ON submissions(document_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_evaluations_sub ON evaluations(submission_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_evaluations_faculty ON evaluations(faculty_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_student_profiles_status ON student_profiles(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_integrity_events_doc ON integrity_events(document_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_integrity_events_student ON integrity_events(student_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);")

    conn.commit()
    run_schema_migrations(conn)
    seed_initial_data(conn)
    conn.close()

def add_column_if_not_exists(cursor: sqlite3.Cursor, table: str, column_name: str, column_def: str):
    """Safely adds a column to an existing SQLite table if it does not already exist."""
    cursor.execute(f"PRAGMA table_info({table});")
    existing_cols = [r[1] for r in cursor.fetchall()]
    if column_name not in existing_cols:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_def};")

def run_schema_migrations(conn: sqlite3.Connection):
    """Executes safe, backward-compatible relational schema migrations."""
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Academic Calendars / Years (Multi-Year Support: 2025-26, 2026-27, 2027-28)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_calendars (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL, -- e.g. '2026-27'
        name TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        is_current INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('upcoming', 'active', 'completed', 'archived')),
        created_at TEXT NOT NULL
    );
    """)

    # 2. Academic Groups (BRANCH + YEAR + SEMESTER + DIVISION + ACADEMIC YEAR)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS academic_groups (
        id TEXT PRIMARY KEY,
        academic_year TEXT NOT NULL,
        branch_code TEXT NOT NULL,
        year_level TEXT NOT NULL, -- FE, SE, TE, BE
        semester_number INTEGER NOT NULL,
        division_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(academic_year, branch_code, year_level, semester_number, division_name)
    );
    """)

    # 3. Curriculum Versions (Academic-Year-Specific Syllabus Scheme)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS curriculum_versions (
        id TEXT PRIMARY KEY,
        academic_year TEXT NOT NULL,
        branch_code TEXT NOT NULL,
        year_level TEXT NOT NULL,
        semester_number INTEGER NOT NULL,
        scheme_name TEXT NOT NULL, -- e.g. "Mumbai University Rev-2019 'C' Scheme / NEP 2020"
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'published', 'active', 'completed', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    # 4. Subject Allotments (Academic Group -> Subject -> Faculty)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subject_allotments (
        id TEXT PRIMARY KEY,
        academic_group_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        faculty_id TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(academic_group_id, subject_id)
    );
    """)

    # 5. Student Subject Enrollments (Compulsory Auto-Allotments + Approved Open Electives)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_subject_enrollments (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        enrollment_type TEXT NOT NULL DEFAULT 'compulsory' CHECK(enrollment_type IN ('compulsory', 'open_elective')),
        status TEXT NOT NULL DEFAULT 'enrolled' CHECK(status IN ('enrolled', 'dropped', 'completed')),
        enrolled_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE(student_id, subject_id, academic_year)
    );
    """)

    # 6. Open Elective Configurations & Student Selections
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS open_elective_configs (
        id TEXT PRIMARY KEY,
        academic_year TEXT NOT NULL,
        branch_code TEXT NOT NULL,
        year_level TEXT NOT NULL,
        semester_number INTEGER NOT NULL,
        subject_id TEXT NOT NULL,
        faculty_id TEXT,
        max_capacity INTEGER NOT NULL DEFAULT 60,
        selection_start_date TEXT,
        selection_end_date TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS open_elective_selections (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        elective_config_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        admin_remarks TEXT,
        selected_at TEXT NOT NULL,
        reviewed_at TEXT,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
        UNIQUE(student_id, subject_id)
    );
    """)

    # 7. Laboratory Batches & Student/Faculty Allocation
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lab_batches (
        id TEXT PRIMARY KEY,
        batch_name TEXT NOT NULL, -- e.g. Batch A1, Batch A2, Batch A3
        academic_year TEXT NOT NULL,
        branch_code TEXT NOT NULL,
        year_level TEXT NOT NULL,
        semester_number INTEGER NOT NULL,
        division_name TEXT NOT NULL,
        subject_id TEXT,
        faculty_id TEXT,
        capacity INTEGER NOT NULL DEFAULT 25,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'archived')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS batch_students (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        assigned_at TEXT NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES lab_batches(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(batch_id, student_id)
    );
    """)

    # 8. Student Academic Year Promotion Windows & Requests
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS promotion_windows (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_academic_year TEXT NOT NULL,
        target_academic_year TEXT NOT NULL,
        source_year_level TEXT NOT NULL,
        target_year_level TEXT NOT NULL,
        source_semester INTEGER NOT NULL,
        target_semester INTEGER NOT NULL,
        branch_code TEXT NOT NULL,
        is_open INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('draft', 'scheduled', 'open', 'closed', 'completed')),
        start_date TEXT,
        end_date TEXT,
        opened_at TEXT,
        closed_at TEXT,
        created_at TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS promotion_requests (
        id TEXT PRIMARY KEY,
        promotion_window_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        cgpa REAL NOT NULL,
        current_year_level TEXT NOT NULL,
        current_semester INTEGER NOT NULL,
        current_division TEXT NOT NULL,
        current_roll_number TEXT NOT NULL,
        requested_division TEXT NOT NULL,
        requested_roll_number TEXT NOT NULL,
        approved_division TEXT,
        approved_roll_number TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'resubmission')),
        admin_remarks TEXT,
        submitted_at TEXT NOT NULL,
        reviewed_at TEXT,
        FOREIGN KEY (promotion_window_id) REFERENCES promotion_windows(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_enrollment_history (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        year_level TEXT NOT NULL,
        semester_number INTEGER NOT NULL,
        branch_code TEXT NOT NULL,
        division_name TEXT NOT NULL,
        roll_number TEXT NOT NULL,
        cgpa REAL,
        archived_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 8B. Reevaluation Requests & Faculty Substitutions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reevaluation_requests (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        faculty_id TEXT NOT NULL,
        current_marks REAL NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        new_marks REAL,
        faculty_remarks TEXT,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS faculty_substitutions (
        id TEXT PRIMARY KEY,
        original_faculty_id TEXT NOT NULL,
        substitute_faculty_id TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        division_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'revoked')),
        created_at TEXT NOT NULL,
        FOREIGN KEY (original_faculty_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (substitute_faculty_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );
    """)

    # 9. Custom Rubrics for Special Documents (Mini Projects, Major Projects, Research Papers)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS custom_rubrics (
        id TEXT PRIMARY KEY,
        faculty_id TEXT NOT NULL,
        title TEXT NOT NULL,
        document_category TEXT NOT NULL,
        total_marks REAL NOT NULL,
        criteria_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # Safe column additions to existing tables
    # Subjects
    add_column_if_not_exists(cursor, "subjects", "category", "category TEXT DEFAULT 'Core'")
    add_column_if_not_exists(cursor, "subjects", "credits", "credits REAL DEFAULT 3.0")
    add_column_if_not_exists(cursor, "subjects", "total_credits", "total_credits REAL DEFAULT 3.0")
    add_column_if_not_exists(cursor, "subjects", "subject_type", "subject_type TEXT DEFAULT 'Theory'")
    add_column_if_not_exists(cursor, "subjects", "teaching_hours", "teaching_hours INTEGER DEFAULT 4")
    add_column_if_not_exists(cursor, "subjects", "syllabus_scheme", "syllabus_scheme TEXT DEFAULT 'Mumbai University Rev-2019 C Scheme'")
    add_column_if_not_exists(cursor, "subjects", "academic_year", "academic_year TEXT DEFAULT '2026-27'")
    add_column_if_not_exists(cursor, "subjects", "description", "description TEXT DEFAULT ''")
    add_column_if_not_exists(cursor, "subjects", "status", "status TEXT DEFAULT 'active'")
    add_column_if_not_exists(cursor, "subjects", "year_level", "year_level TEXT DEFAULT 'FE'")

    # Tasks (Assignments, Experiments, Special Documents)
    add_column_if_not_exists(cursor, "tasks", "academic_year", "academic_year TEXT DEFAULT '2026-27'")
    add_column_if_not_exists(cursor, "tasks", "branch_code", "branch_code TEXT DEFAULT 'CE'")
    add_column_if_not_exists(cursor, "tasks", "year_level", "year_level TEXT DEFAULT 'SE'")
    add_column_if_not_exists(cursor, "tasks", "semester_number", "semester_number INTEGER DEFAULT 3")
    add_column_if_not_exists(cursor, "tasks", "division_name", "division_name TEXT DEFAULT 'Div A'")
    add_column_if_not_exists(cursor, "tasks", "target_type", "target_type TEXT DEFAULT 'division'")
    add_column_if_not_exists(cursor, "tasks", "batch_id", "batch_id TEXT")
    add_column_if_not_exists(cursor, "tasks", "category", "category TEXT DEFAULT 'standard'")
    add_column_if_not_exists(cursor, "tasks", "task_category", "task_category TEXT DEFAULT 'standard'")
    add_column_if_not_exists(cursor, "tasks", "document_category", "document_category TEXT")
    add_column_if_not_exists(cursor, "tasks", "experiment_number", "experiment_number TEXT")
    add_column_if_not_exists(cursor, "tasks", "objective", "objective TEXT")
    add_column_if_not_exists(cursor, "tasks", "problem_statement", "problem_statement TEXT")
    add_column_if_not_exists(cursor, "tasks", "hardware_software_req", "hardware_software_req TEXT")
    add_column_if_not_exists(cursor, "tasks", "procedure", "procedure TEXT")
    add_column_if_not_exists(cursor, "tasks", "expected_output", "expected_output TEXT")
    add_column_if_not_exists(cursor, "tasks", "reference_file_url", "reference_file_url TEXT")
    add_column_if_not_exists(cursor, "tasks", "late_submission_policy", "late_submission_policy TEXT DEFAULT 'accept'")
    add_column_if_not_exists(cursor, "tasks", "late_penalty_percent", "late_penalty_percent REAL DEFAULT 0.0")
    add_column_if_not_exists(cursor, "tasks", "custom_rubric_id", "custom_rubric_id TEXT")
    # Special Submission Flexible Methods Configuration
    add_column_if_not_exists(cursor, "tasks", "allowed_methods_json", "allowed_methods_json TEXT DEFAULT '[\"editor\", \"pdf\", \"docx\", \"other_files\", \"external_link\"]'")
    add_column_if_not_exists(cursor, "tasks", "allow_multiple_methods", "allow_multiple_methods INTEGER DEFAULT 0")
    add_column_if_not_exists(cursor, "tasks", "max_file_size_mb", "max_file_size_mb INTEGER DEFAULT 10")
    add_column_if_not_exists(cursor, "tasks", "max_files_count", "max_files_count INTEGER DEFAULT 3")
    add_column_if_not_exists(cursor, "tasks", "allowed_extensions_json", "allowed_extensions_json TEXT DEFAULT '[\"pdf\", \"docx\", \"doc\", \"zip\", \"pptx\", \"xlsx\", \"png\", \"jpg\", \"txt\"]'")
    add_column_if_not_exists(cursor, "tasks", "require_pdf_conversion", "require_pdf_conversion INTEGER DEFAULT 0")
    add_column_if_not_exists(cursor, "tasks", "allow_resubmission", "allow_resubmission INTEGER DEFAULT 1")
    add_column_if_not_exists(cursor, "tasks", "allow_edit_before_deadline", "allow_edit_before_deadline INTEGER DEFAULT 1")

    # Submissions (Delayed submission metrics & flexible submission content)
    add_column_if_not_exists(cursor, "submissions", "delay_seconds", "delay_seconds INTEGER DEFAULT 0")
    add_column_if_not_exists(cursor, "submissions", "delay_text", "delay_text TEXT DEFAULT 'On Time'")
    add_column_if_not_exists(cursor, "submissions", "late_penalty_applied", "late_penalty_applied REAL DEFAULT 0.0")
    add_column_if_not_exists(cursor, "submissions", "batch_id", "batch_id TEXT")
    add_column_if_not_exists(cursor, "submissions", "submission_method", "submission_method TEXT DEFAULT 'editor'")
    add_column_if_not_exists(cursor, "submissions", "external_link_url", "external_link_url TEXT")
    add_column_if_not_exists(cursor, "submissions", "external_link_title", "external_link_title TEXT")
    add_column_if_not_exists(cursor, "submissions", "external_link_description", "external_link_description TEXT")
    add_column_if_not_exists(cursor, "submissions", "attachments_json", "attachments_json TEXT DEFAULT '[]'")
    add_column_if_not_exists(cursor, "submissions", "faculty_private_notes", "faculty_private_notes TEXT")
    add_column_if_not_exists(cursor, "submissions", "resubmission_count", "resubmission_count INTEGER DEFAULT 0")
    add_column_if_not_exists(cursor, "submissions", "version_number", "version_number INTEGER DEFAULT 1")

    # Documents (Special submission fields for drafts and authoring)
    add_column_if_not_exists(cursor, "documents", "submission_method", "submission_method TEXT DEFAULT 'editor'")
    add_column_if_not_exists(cursor, "documents", "external_link_url", "external_link_url TEXT")
    add_column_if_not_exists(cursor, "documents", "external_link_title", "external_link_title TEXT")
    add_column_if_not_exists(cursor, "documents", "external_link_description", "external_link_description TEXT")
    add_column_if_not_exists(cursor, "documents", "attachments_json", "attachments_json TEXT DEFAULT '[]'")

    # Table for securely stored file attachments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS submission_attachments (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        document_id TEXT,
        submission_id TEXT,
        student_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sub_att_task ON submission_attachments(task_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sub_att_doc ON submission_attachments(document_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sub_att_sub ON submission_attachments(submission_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sub_att_stu ON submission_attachments(student_id);")

    # Promotion windows state enhancements
    add_column_if_not_exists(cursor, "promotion_windows", "status", "status TEXT DEFAULT 'open'")
    add_column_if_not_exists(cursor, "promotion_windows", "start_date", "start_date TEXT")
    add_column_if_not_exists(cursor, "promotion_windows", "end_date", "end_date TEXT")
    add_column_if_not_exists(cursor, "promotion_windows", "updated_at", "updated_at TEXT")

    # Tasks deadline extension support
    add_column_if_not_exists(cursor, "tasks", "original_due_date", "original_due_date TEXT")
    add_column_if_not_exists(cursor, "tasks", "extension_reason", "extension_reason TEXT")

    # Evaluations re-evaluation tracking
    add_column_if_not_exists(cursor, "evaluations", "reevaluation_status", "reevaluation_status TEXT")
    add_column_if_not_exists(cursor, "evaluations", "reevaluation_reason", "reevaluation_reason TEXT")

    # Student Profiles
    add_column_if_not_exists(cursor, "student_profiles", "academic_year", "academic_year TEXT DEFAULT '2026-27'")
    add_column_if_not_exists(cursor, "student_profiles", "cgpa", "cgpa REAL DEFAULT 0.0")
    add_column_if_not_exists(cursor, "student_profiles", "is_verified", "is_verified INTEGER DEFAULT 1")
    add_column_if_not_exists(cursor, "student_profiles", "verification_status", "verification_status TEXT DEFAULT 'verified'")

    # High performance indexes for new relations
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_academic_groups ON academic_groups(academic_year, branch_code, year_level, semester_number, division_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_subject_allotments_grp ON subject_allotments(academic_group_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_subject_allotments_fac ON subject_allotments(faculty_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_enrollments_stu ON student_subject_enrollments(student_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_enrollments_sub ON student_subject_enrollments(subject_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_batches_grp ON lab_batches(academic_year, branch_code, division_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_batch_students_stu ON batch_students(student_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_promotion_requests_stu ON promotion_requests(student_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_custom_rubrics_fac ON custom_rubrics(faculty_id);")

    # Seed Academic Calendars
    cursor.execute("""
    INSERT OR IGNORE INTO academic_calendars (id, code, name, start_date, end_date, is_current, status, created_at)
    VALUES
        ('ay_2025_26', '2025-26', 'Academic Year 2025-26 (Completed / Archived)', '2025-07-01', '2026-06-30', 0, 'archived', ?),
        ('ay_2026_27', '2026-27', 'Academic Year 2026-27 (Current Active Cycle)', '2026-07-01', '2027-06-30', 1, 'active', ?),
        ('ay_2027_28', '2027-28', 'Academic Year 2027-28 (Upcoming Cycle)', '2027-07-01', '2028-06-30', 0, 'upcoming', ?);
    """, (now_iso, now_iso, now_iso))

    # Safe Table Migrations for Special Document Support
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks';")
    tasks_sql = cursor.fetchone()
    if tasks_sql and "Special Document" not in tasks_sql[0]:
        cursor.execute("PRAGMA foreign_keys=OFF;")
        cursor.execute("""
        CREATE TABLE tasks_new (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            subject_id TEXT NOT NULL,
            faculty_id TEXT NOT NULL,
            task_type TEXT NOT NULL CHECK(task_type IN ('Assignment', 'Experiment', 'Special Document')),
            task_number TEXT NOT NULL DEFAULT '1',
            max_marks REAL NOT NULL DEFAULT 10.0,
            instructions TEXT,
            due_date TEXT NOT NULL,
            rubric_json TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'published',
            created_at TEXT NOT NULL,
            academic_year TEXT DEFAULT '2026-27',
            branch_code TEXT DEFAULT 'CE',
            year_level TEXT DEFAULT 'SE',
            semester_number INTEGER DEFAULT 3,
            division_name TEXT DEFAULT 'Div A',
            target_type TEXT DEFAULT 'division',
            batch_id TEXT,
            category TEXT DEFAULT 'standard',
            task_category TEXT DEFAULT 'standard',
            document_category TEXT,
            experiment_number TEXT,
            objective TEXT,
            problem_statement TEXT,
            hardware_software_req TEXT,
            procedure TEXT,
            expected_output TEXT,
            reference_file_url TEXT,
            late_submission_policy TEXT DEFAULT 'accept',
            late_penalty_percent REAL DEFAULT 0.0,
            custom_rubric_id TEXT,
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
            FOREIGN KEY (faculty_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)
        cursor.execute("PRAGMA table_info(tasks);")
        old_cols = [c[1] for c in cursor.fetchall()]
        col_list = ", ".join(old_cols)
        cursor.execute(f"INSERT INTO tasks_new ({col_list}) SELECT {col_list} FROM tasks;")
        cursor.execute("DROP TABLE tasks;")
        cursor.execute("ALTER TABLE tasks_new RENAME TO tasks;")
        cursor.execute("PRAGMA foreign_keys=ON;")

    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='documents';")
    docs_sql = cursor.fetchone()
    if docs_sql and "Special Document" not in docs_sql[0]:
        cursor.execute("PRAGMA foreign_keys=OFF;")
        cursor.execute("""
        CREATE TABLE documents_new (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            task_id TEXT,
            title TEXT NOT NULL,
            doc_type TEXT NOT NULL CHECK(doc_type IN ('Assignment', 'Experiment', 'Special Document')),
            subject_name TEXT NOT NULL,
            subject_code TEXT NOT NULL,
            doc_number TEXT NOT NULL DEFAULT '1',
            content_html TEXT NOT NULL,
            word_count INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'graded', 'returned')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );
        """)
        cursor.execute("PRAGMA table_info(documents);")
        old_cols = [c[1] for c in cursor.fetchall()]
        col_list = ", ".join(old_cols)
        cursor.execute(f"INSERT INTO documents_new ({col_list}) SELECT {col_list} FROM documents;")
        cursor.execute("DROP TABLE documents;")
        cursor.execute("ALTER TABLE documents_new RENAME TO documents;")
        cursor.execute("PRAGMA foreign_keys=ON;")

    conn.commit()

def seed_initial_data(conn: sqlite3.Connection):
    """Populates the database with initial departments, subjects, default users, tasks, and sample submissions."""
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # Seed Departments
    departments = [
        ("dept_ce", "Computer Engineering", "CE"),
        ("dept_it", "Information Technology", "IT"),
        ("dept_ash", "Applied Science & Humanities", "ASH")
    ]
    cursor.executemany("INSERT OR IGNORE INTO departments (id, name, code) VALUES (?, ?, ?);", departments)

    # Seed Branches
    branches = [
        ("br_ce", "dept_ce", "Computer Engineering", "CE"),
        ("br_it", "dept_it", "Information Technology", "IT"),
        ("br_ash", "dept_ash", "Applied Science & Humanities", "ASH")
    ]
    cursor.executemany("INSERT OR IGNORE INTO branches (id, department_id, name, code) VALUES (?, ?, ?, ?);", branches)

    # Seed Academic Years
    acad_years = [
        ("ay_fe", "FE", "2026-27"),
        ("ay_se", "SE", "2026-27"),
        ("ay_te", "TE", "2026-27"),
        ("ay_be", "BE", "2026-27")
    ]
    cursor.executemany("INSERT OR IGNORE INTO academic_years (id, year_name, academic_cycle) VALUES (?, ?, ?);", acad_years)

    # Seed Divisions
    divisions = [
        ("div_a", "Division A", "Div A"),
        ("div_b", "Division B", "Div B")
    ]
    cursor.executemany("INSERT OR IGNORE INTO divisions (id, name, code) VALUES (?, ?, ?);", divisions)

    # Seed Subjects
    subjects = [
        # FE
        ("sub_fe_mth1", "br_ash", 1, "Engineering Mathematics -I", "FE-MTH101", 0),
        ("sub_fe_phy1", "br_ash", 1, "Engineering Physics -I", "FE-PHY101", 0),
        ("sub_fe_chm1", "br_ash", 1, "Engineering Chemistry -I", "FE-CHM101", 0),
        ("sub_fe_bee1", "br_ash", 1, "Basic Electrical Electronics", "FE-BEE101", 0),
        ("sub_fe_mth2", "br_ash", 2, "Engineering Mathematics -II", "FE-MTH102", 0),
        # SE CE
        ("sub_se_co", "br_ce", 3, "Computer Organisation", "CE-CO201", 0),
        ("sub_se_ds", "br_ce", 3, "Data structure", "CE-DS201", 0),
        ("sub_se_db", "br_ce", 3, "Database management system", "CE-DB201", 0),
        ("sub_se_ed", "br_ce", 3, "Entrepreneurship development", "CE-ED201", 0),
        # SE IT
        ("sub_se_dcm", "br_it", 4, "Discrete Computational Mathematics", "IT-DCM201", 0),
        ("sub_se_cn", "br_it", 4, "Computer Networks", "IT-CN201", 0),
        ("sub_se_jav", "br_it", 4, "Java Programming lab", "IT-JAV201L", 0),
        ("sub_se_pyt", "br_it", 4, "Python Programming lab", "IT-PYT201L", 0),
        # Electives
        ("sub_oe_frn", "br_ce", 3, "Beginner French", "OE-FRN1", 1),
        ("sub_oe_ger", "br_ce", 3, "Beginner Germany", "OE-GER1", 1),
        ("sub_oe_dvr", "br_ce", 3, "Digital Video Recording", "OE-DVR1", 1)
    ]
    cursor.executemany("INSERT OR IGNORE INTO subjects (id, branch_id, semester_number, name, code, is_elective) VALUES (?, ?, ?, ?, ?, ?);", subjects)

    # Seed Default Users
    # Password for all default accounts is "password"
    pw_hash = hash_password("password")
    users = [
        ("user_admin", "admin", "admin@writeuppro.edu", "System Administrator", pw_hash, "admin", "active", now_iso, now_iso),
        ("user_faculty", "faculty", "faculty@writeuppro.edu", "Prof. Elizabeth Smith", pw_hash, "faculty", "active", now_iso, now_iso),
        ("user_student", "student", "student@writeuppro.edu", "Demo Student", pw_hash, "student", "active", now_iso, now_iso)
    ]
    cursor.executemany("INSERT OR IGNORE INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);", users)

    # Seed Faculty Profile
    cursor.execute("""
    INSERT OR IGNORE INTO faculty_profiles (user_id, employee_id, department_code, designation, created_at)
    VALUES (?, ?, ?, ?, ?);
    """, ("user_faculty", "FAC-9021", "CE", "Associate Professor", now_iso))

    # Seed Student Profile
    cursor.execute("""
    INSERT OR IGNORE INTO student_profiles (user_id, roll_number, prn, year_level, branch_code, semester_number, division_name, elective_subject, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, ("user_student", "21CE104", "PRN202600104", "SE", "CE", 3, "Div A", "Data Compression", "approved", now_iso, now_iso))

    conn.commit()

# Run DB init on module load
init_db()
