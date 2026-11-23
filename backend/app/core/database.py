import sqlite3
import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.core.security import hash_password

def get_db_connection() -> sqlite3.Connection:
    """Returns a SQLite connection with foreign keys enabled and row factory set to dict."""
    conn = sqlite3.connect(settings.DATABASE_PATH, timeout=15)
    conn.execute("PRAGMA foreign_keys = ON;")
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
        task_type TEXT NOT NULL CHECK(task_type IN ('Assignment', 'Experiment')),
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
        doc_type TEXT NOT NULL CHECK(doc_type IN ('Assignment', 'Experiment')),
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

    conn.commit()
    seed_initial_data(conn)
    conn.close()

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
        ("user_student", "student", "student@writeuppro.edu", "Demo Student", pw_hash, "student", "active", now_iso, now_iso),
        ("user_student2", "student2", "alex@writeuppro.edu", "Alex Turner", pw_hash, "student", "active", now_iso, now_iso),
        ("user_student3", "student3", "sarah@writeuppro.edu", "Sarah Jenkins", pw_hash, "student", "active", now_iso, now_iso)
    ]
    cursor.executemany("INSERT OR IGNORE INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);", users)

    # Seed Faculty Profile
    cursor.execute("""
    INSERT OR IGNORE INTO faculty_profiles (user_id, employee_id, department_code, designation, created_at)
    VALUES (?, ?, ?, ?, ?);
    """, ("user_faculty", "FAC-9021", "CE", "Associate Professor", now_iso))

    # Assign Faculty to Subjects
    assignments = [
        ("fa_1", "user_faculty", "sub_se_ds", "Div A"),
        ("fa_2", "user_faculty", "sub_se_db", "Div A"),
        ("fa_3", "user_faculty", "sub_se_co", "Div A")
    ]
    cursor.executemany("INSERT OR IGNORE INTO faculty_assignments (id, faculty_id, subject_id, division_name) VALUES (?, ?, ?, ?);", assignments)

    # Seed Student Profiles
    cursor.execute("""
    INSERT OR IGNORE INTO student_profiles (user_id, roll_number, prn, year_level, branch_code, semester_number, division_name, elective_subject, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, ("user_student", "21CE104", "PRN202600104", "SE", "CE", 3, "Div A", "Beginner French", "approved", now_iso, now_iso))

    cursor.execute("""
    INSERT OR IGNORE INTO student_profiles (user_id, roll_number, prn, year_level, branch_code, semester_number, division_name, elective_subject, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, ("user_student2", "21CE108", "PRN202600108", "SE", "CE", 3, "Div A", "Beginner Germany", "pending", now_iso, now_iso))

    cursor.execute("""
    INSERT OR IGNORE INTO student_profiles (user_id, roll_number, prn, year_level, branch_code, semester_number, division_name, elective_subject, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, ("user_student3", "21CE112", "PRN202600112", "SE", "CE", 3, "Div A", "Digital Video Recording", "approved", now_iso, now_iso))

    # Seed Initial Tasks
    default_assignment_rubric = json.dumps([
        {"criteria": "Knowledge & Conceptual Understanding", "max": 4.0, "guidance": "Clarity of theoretical principles and context"},
        {"criteria": "Content, Neatness & Structure", "max": 3.0, "guidance": "Depth of solution, adherence to template and readability"},
        {"criteria": "Punctuality & Academic Timeliness", "max": 3.0, "guidance": "Submission strictly before deadline"}
    ])

    default_experiment_rubric = json.dumps([
        {"criteria": "Knowledge & Theory", "max": 4.0, "guidance": "Understanding of algorithm, apparatus and objectives"},
        {"criteria": "Implementation & Performance", "max": 5.0, "guidance": "Correct execution, diagram completeness and code structure"},
        {"criteria": "Content & Observations", "max": 3.0, "guidance": "Tabulation of results, observations and precision"},
        {"criteria": "Punctuality & Timeliness", "max": 3.0, "guidance": "Submission strictly before deadline"}
    ])

    tasks = [
        (
            "task_assign_1",
            "Assignment 1: Relational Data Modelling & Normalization",
            "Explain 1NF, 2NF, 3NF and BCNF with real-world enterprise database examples.",
            "sub_se_db",
            "user_faculty",
            "Assignment",
            "1",
            10.0,
            "Document must contain theoretical explanations, ER diagrams drawn in canvas, and table schemas.",
            "2026-12-05T23:59:59Z",
            default_assignment_rubric,
            "published",
            now_iso
        ),
        (
            "task_expt_1",
            "Experiment 1: Balanced Binary Search Trees (AVL & Red-Black)",
            "Implement rotations and balance factor calculations for self-balancing search trees.",
            "sub_se_ds",
            "user_faculty",
            "Experiment",
            "1",
            15.0,
            "Include algorithm steps, tree rotation diagrams drawn in canvas, complete code, and output verification table.",
            "2026-12-10T23:59:59Z",
            default_experiment_rubric,
            "published",
            now_iso
        )
    ]
    cursor.executemany("""
    INSERT OR IGNORE INTO tasks (id, title, description, subject_id, faculty_id, task_type, task_number, max_marks, instructions, due_date, rubric_json, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, tasks)

    # Seed Sample Seed Documents & Submissions for immediate testing
    sample_content_1 = """<h2>Aim</h2><p>To design and implement a normalized relational database schema satisfying Third Normal Form (3NF).</p><h2>Theory & Methodology</h2><p>Normalization reduces data redundancy and prevents update anomalies. First Normal Form requires atomic attributes. Second Normal Form eliminates partial key dependencies. Third Normal Form guarantees no transitive dependencies exist.</p><h2>Functional Dependencies</h2><table><tr><th>Relation</th><th>Candidate Key</th><th>Determinant</th><th>Normal Form</th></tr><tr><td>Students</td><td>Roll_No</td><td>Roll_No -> Department</td><td>3NF</td></tr><tr><td>Courses</td><td>Course_Code</td><td>Course_Code -> Credits</td><td>3NF</td></tr></table><h2>Conclusion</h2><p>The schema was normalized to 3NF without information loss, ensuring referential integrity and zero update anomalies.</p>"""

    cursor.execute("""
    INSERT OR IGNORE INTO documents (id, student_id, task_id, title, doc_type, subject_name, subject_code, doc_number, content_html, word_count, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        "doc_sample_1",
        "user_student",
        "task_assign_1",
        "Assignment 1: Relational Data Modelling & Normalization",
        "Assignment",
        "Database management system",
        "CE-DB201",
        "1",
        sample_content_1,
        145,
        "graded",
        now_iso,
        now_iso
    ))

    # Seed Initial Submission
    cursor.execute("""
    INSERT OR IGNORE INTO submissions (id, document_id, task_id, student_id, submission_code, snapshot_html, submission_date, is_late, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        "sub_sample_1",
        "doc_sample_1",
        "task_assign_1",
        "user_student",
        "SUB-2026-IIET-9014",
        sample_content_1,
        "2026-11-20 14:30:00",
        0,
        "graded",
        now_iso
    ))

    # Seed Evaluation
    eval_rubric = json.dumps({"knowledge": 4.0, "content": 3.0, "punctuality": 2.5})
    cursor.execute("""
    INSERT OR IGNORE INTO evaluations (id, submission_id, faculty_id, marks_awarded, max_marks, rubric_scores_json, feedback, remarks, digital_signature_code, status, evaluated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        "eval_sample_1",
        "sub_sample_1",
        "user_faculty",
        9.5,
        10.0,
        eval_rubric,
        "Excellent theoretical analysis and well-structured dependency table.",
        "Approved with honors",
        "SIG-FAC9021-IIET-88392",
        "approved",
        now_iso
    ))

    # Seed Notifications
    notifications = [
        ("notif_1", "user_student", "Document Evaluated", "Your Assignment 1 has been evaluated by Prof. Elizabeth Smith with 9.5/10 marks.", "success", "/student/evaluations", 0, now_iso),
        ("notif_2", "user_student", "Registration Approved", "Your academic profile for SE CE (Div A) has been verified and approved by the Administrator.", "info", "/student", 1, now_iso),
        ("notif_3", "user_faculty", "New Submission Received", "Student Demo Student submitted Assignment 1: Relational Data Modelling.", "info", "/faculty/classroom", 0, now_iso),
        ("notif_4", "user_admin", "Registration Pending Review", "Student Alex Turner registered for SE CE (Div A) and is awaiting administrator verification.", "alert", "/admin/registrations", 0, now_iso)
    ]
    cursor.executemany("INSERT OR IGNORE INTO notifications (id, user_id, title, message, type, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?);", notifications)

    # Seed a sample integrity event
    cursor.execute("""
    INSERT OR IGNORE INTO integrity_events (id, student_id, document_id, event_type, severity, metadata_json, review_status, admin_remarks, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        "ie_sample_1",
        "user_student2",
        None,
        "paste_attempt",
        "medium",
        json.dumps({"attempted_chars": 482, "source": "external_clipboard", "action": "blocked"}),
        "pending",
        "Paste blocked by security policy.",
        now_iso
    ))

    conn.commit()

# Run DB init on module load
init_db()
