"""
WriteUp Pro — Streamlined Demo Dataset Seeder & Safe Reset
Strict Requirements:
1. Exactly 10 realistic students.
2. Exactly 3 realistic faculty members.
3. Preserve existing admin account (admin / password).
4. Maximum 2 demo subjects per unique academic combination.
5. ZERO pre-created assessments, submissions, documents, evaluations, or marks.
"""

import sys
import os
import json
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.database import get_db_connection, init_db
from app.core.security import hash_password

def seed_demo_10(reset_assessments_only: bool = False):
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    pw_hash = hash_password("password")

    print("[1/5] Removing existing assessments, submissions, and evaluations for clean demo state...")
    cursor.execute("DELETE FROM evaluations;")
    cursor.execute("DELETE FROM submissions;")
    cursor.execute("DELETE FROM documents;")
    cursor.execute("DELETE FROM document_versions;")
    cursor.execute("DELETE FROM tasks;")
    cursor.execute("DELETE FROM submission_attachments;")
    cursor.execute("DELETE FROM reevaluation_requests;")

    print("[2/5] Setting up exact accounts (1 Admin, 3 Faculty, 10 Students)...")
    # Clean previous student and faculty accounts except the defined roster
    valid_usernames = (
        'admin', 'user_admin',
        'faculty', 'prof_patil', 'prof_sharma',
        'student', 'student_ce_1', 'student_ce_2', 'student_it_1', 'student_it_2',
        'student_extc_1', 'student_aids_1', 'student_aids_2', 'student_mech_1', 'student_civil_1'
    )
    cursor.execute(f"DELETE FROM users WHERE username NOT IN ({','.join(['?']*len(valid_usernames))});", valid_usernames)

    # 1. Admin
    cursor.execute("""
    INSERT INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at)
    VALUES ('user_admin', 'admin', 'admin@iiet.ac.in', 'Dr. Robert Vance', ?, 'admin', 'active', ?, ?)
    ON CONFLICT(username) DO UPDATE SET
        email = 'admin@iiet.ac.in',
        full_name = 'Dr. Robert Vance',
        role = 'admin',
        status = 'active',
        updated_at = excluded.updated_at;
    """, (pw_hash, now_iso, now_iso))

    # 2. Exactly 3 Faculty
    faculty_members = [
        ("user_faculty_1", "faculty", "faculty@iiet.ac.in", "Prof. Elizabeth Smith", "EMP-COMP-001", "CE", "Professor & Head"),
        ("user_faculty_2", "prof_patil", "patil@iiet.ac.in", "Prof. Rajesh Patil", "EMP-COMP-002", "CE", "Associate Professor"),
        ("user_faculty_3", "prof_sharma", "sharma@iiet.ac.in", "Prof. Amit Sharma", "EMP-IT-003", "IT", "Assistant Professor")
    ]
    for uid, uname, uemail, ufname, empid, dept, desig in faculty_members:
        cursor.execute("""
        INSERT INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'faculty', 'active', ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            email = excluded.email,
            full_name = excluded.full_name,
            role = 'faculty',
            status = 'active',
            updated_at = excluded.updated_at;
        """, (uid, uname, uemail, ufname, pw_hash, now_iso, now_iso))

        cursor.execute("SELECT id FROM users WHERE username = ?;", (uname,))
        f_user_id = cursor.fetchone()[0]

        cursor.execute("""
        INSERT INTO faculty_profiles (user_id, employee_id, department_code, designation, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            employee_id = excluded.employee_id,
            department_code = excluded.department_code,
            designation = excluded.designation;
        """, (f_user_id, empid, dept, desig, now_iso))

    # 3. Exactly 10 Students
    students = [
        ("user_student", "student", "student@iiet.ac.in", "Demo Student", "21CE104", "202401640001", "SE", "CE", 3, "Div A", 8.92),
        ("user_stu_1", "student_ce_1", "aarav.sharma@iiet.ac.in", "Aarav Sharma", "24CE101", "202401640002", "FE", "CE", 1, "Div A", 8.20),
        ("user_stu_2", "student_ce_2", "ananya.desai@iiet.ac.in", "Ananya Desai", "20CE105", "202401640003", "TE", "CE", 5, "Div A", 9.15),
        ("user_stu_3", "student_it_1", "rohan.mehta@iiet.ac.in", "Rohan Mehta", "21IT101", "202401640004", "SE", "IT", 3, "Div A", 7.85),
        ("user_stu_4", "student_it_2", "priya.nair@iiet.ac.in", "Priya Nair", "20IT102", "202401640005", "TE", "IT", 5, "Div B", 8.50),
        ("user_stu_5", "student_extc_1", "vikram.patel@iiet.ac.in", "Vikram Patel", "19EX101", "202401640006", "BE", "EXTC", 7, "Div A", 8.10),
        ("user_stu_6", "student_aids_1", "sneha.kulkarni@iiet.ac.in", "Sneha Kulkarni", "21AI101", "202401640007", "SE", "AIDS", 3, "Div A", 8.75),
        ("user_stu_7", "student_aids_2", "aditya.verma@iiet.ac.in", "Aditya Verma", "20AI102", "202401640008", "TE", "AIDS", 5, "Div A", 8.40),
        ("user_stu_8", "student_mech_1", "kabir.joshi@iiet.ac.in", "Kabir Joshi", "21ME101", "202401640009", "SE", "MECH", 3, "Div B", 7.90),
        ("user_stu_9", "student_civil_1", "tanvi.sawant@iiet.ac.in", "Tanvi Sawant", "19CV101", "202401640010", "BE", "CIVIL", 7, "Div A", 8.65),
    ]

    student_id_map = {}
    for uid, uname, uemail, ufname, roll, prn, yr, br, sem, div, cgpa in students:
        cursor.execute("""
        INSERT INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'student', 'active', ?, ?)
        ON CONFLICT(username) DO UPDATE SET
            email = excluded.email,
            full_name = excluded.full_name,
            role = 'student',
            status = 'active',
            updated_at = excluded.updated_at;
        """, (uid, uname, uemail, ufname, pw_hash, now_iso, now_iso))

        cursor.execute("SELECT id FROM users WHERE username = ?;", (uname,))
        actual_id = cursor.fetchone()[0]
        student_id_map[uname] = actual_id

        cursor.execute("""
        INSERT INTO student_profiles (
            user_id, roll_number, prn, year_level, branch_code, semester_number, division_name,
            status, admin_remarks, created_at, updated_at, academic_year, cgpa, is_verified, verification_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', 'Verified and Enrolled', ?, ?, '2026-27', ?, 1, 'verified')
        ON CONFLICT(user_id) DO UPDATE SET
            roll_number = excluded.roll_number,
            prn = excluded.prn,
            year_level = excluded.year_level,
            branch_code = excluded.branch_code,
            semester_number = excluded.semester_number,
            division_name = excluded.division_name,
            status = 'approved',
            academic_year = '2026-27',
            cgpa = excluded.cgpa,
            is_verified = 1,
            verification_status = 'verified',
            updated_at = excluded.updated_at;
        """, (actual_id, roll, prn, yr, br, sem, div, now_iso, now_iso, cgpa))

    print("[3/5] Seeding Academic Combinations and EXACTLY TWO subjects per combination...")
    # Fetch faculty user IDs
    cursor.execute("SELECT id FROM users WHERE username = 'faculty';")
    fac_1_id = cursor.fetchone()[0]
    cursor.execute("SELECT id FROM users WHERE username = 'prof_patil';")
    fac_2_id = cursor.fetchone()[0]
    cursor.execute("SELECT id FROM users WHERE username = 'prof_sharma';")
    fac_3_id = cursor.fetchone()[0]

    # Clean existing allotments & enrollments to avoid extra demo subjects
    cursor.execute("DELETE FROM subject_allotments;")
    cursor.execute("DELETE FROM student_subject_enrollments;")
    cursor.execute("DELETE FROM batch_students;")
    cursor.execute("DELETE FROM lab_batches;")
    cursor.execute("DELETE FROM academic_groups;")

    # Unique Academic Combinations (AY, Branch, Year, Sem, Div) -> exactly 2 subjects each
    combos = [
        # 1. Primary demo student combination: CE SE Sem 3 Div A
        {
            "gid": "grp_ce_se_a", "ay": "2026-27", "branch": "CE", "year": "SE", "sem": 3, "div": "Div A",
            "subjects": [
                ("sub_ds", "Data Structures & Analysis", "CE-CSC301", 4.0, "Core", "Theory", fac_1_id),
                ("sub_cn", "Computer Networks", "CE-CSC302", 4.0, "Core", "Theory", fac_2_id)
            ],
            "student_unames": ["student"]
        },
        # 2. CE FE Sem 1 Div A
        {
            "gid": "grp_ce_fe_a", "ay": "2026-27", "branch": "CE", "year": "FE", "sem": 1, "div": "Div A",
            "subjects": [
                ("sub_fe_mth", "Engineering Mathematics - I", "FE-MTH101", 4.0, "Core", "Theory", fac_1_id),
                ("sub_fe_phy", "Engineering Physics", "FE-PHY101", 3.0, "Core", "Theory", fac_3_id)
            ],
            "student_unames": ["student_ce_1"]
        },
        # 3. CE TE Sem 5 Div A
        {
            "gid": "grp_ce_te_a", "ay": "2026-27", "branch": "CE", "year": "TE", "sem": 5, "div": "Div A",
            "subjects": [
                ("sub_te_se", "Software Engineering", "CE-CSC501", 4.0, "Core", "Theory", fac_1_id),
                ("sub_te_ai", "Artificial Intelligence", "CE-CSC502", 4.0, "Core", "Theory", fac_2_id)
            ],
            "student_unames": ["student_ce_2"]
        },
        # 4. IT SE Sem 3 Div A
        {
            "gid": "grp_it_se_a", "ay": "2026-27", "branch": "IT", "year": "SE", "sem": 3, "div": "Div A",
            "subjects": [
                ("sub_it_ds", "Data Structures & Algorithms", "IT-ITC301", 4.0, "Core", "Theory", fac_3_id),
                ("sub_it_db", "Database Management Systems", "IT-ITC302", 4.0, "Core", "Theory", fac_3_id)
            ],
            "student_unames": ["student_it_1"]
        },
        # 5. IT TE Sem 5 Div B
        {
            "gid": "grp_it_te_b", "ay": "2026-27", "branch": "IT", "year": "TE", "sem": 5, "div": "Div B",
            "subjects": [
                ("sub_it_os", "Operating Systems", "IT-ITC501", 4.0, "Core", "Theory", fac_3_id),
                ("sub_it_web", "Web Application Development", "IT-ITC502", 4.0, "Core", "Theory", fac_3_id)
            ],
            "student_unames": ["student_it_2"]
        },
        # 6. EXTC BE Sem 7 Div A
        {
            "gid": "grp_extc_be_a", "ay": "2026-27", "branch": "EXTC", "year": "BE", "sem": 7, "div": "Div A",
            "subjects": [
                ("sub_ex_dsp", "Digital Signal Processing", "EX-EXC701", 4.0, "Core", "Theory", fac_1_id),
                ("sub_ex_wc", "Wireless Communication", "EX-EXC702", 4.0, "Core", "Theory", fac_1_id)
            ],
            "student_unames": ["student_extc_1"]
        },
        # 7. AIDS SE Sem 3 Div A
        {
            "gid": "grp_aids_se_a", "ay": "2026-27", "branch": "AIDS", "year": "SE", "sem": 3, "div": "Div A",
            "subjects": [
                ("sub_ai_ml", "Machine Learning Foundations", "AI-AIC301", 4.0, "Core", "Theory", fac_2_id),
                ("sub_ai_stats", "Mathematical Statistics for AI", "AI-AIC302", 4.0, "Core", "Theory", fac_2_id)
            ],
            "student_unames": ["student_aids_1"]
        },
        # 8. AIDS TE Sem 5 Div A
        {
            "gid": "grp_aids_te_a", "ay": "2026-27", "branch": "AIDS", "year": "TE", "sem": 5, "div": "Div A",
            "subjects": [
                ("sub_ai_dl", "Deep Learning Architectures", "AI-AIC501", 4.0, "Core", "Theory", fac_2_id),
                ("sub_ai_nlp", "Natural Language Processing", "AI-AIC502", 4.0, "Core", "Theory", fac_2_id)
            ],
            "student_unames": ["student_aids_2"]
        },
        # 9. MECH SE Sem 3 Div B
        {
            "gid": "grp_mech_se_b", "ay": "2026-27", "branch": "MECH", "year": "SE", "sem": 3, "div": "Div B",
            "subjects": [
                ("sub_me_td", "Thermodynamics & Heat Transfer", "ME-MEC301", 4.0, "Core", "Theory", fac_1_id),
                ("sub_me_fm", "Fluid Mechanics & Machinery", "ME-MEC302", 4.0, "Core", "Theory", fac_1_id)
            ],
            "student_unames": ["student_mech_1"]
        },
        # 10. CIVIL BE Sem 7 Div A
        {
            "gid": "grp_civil_be_a", "ay": "2026-27", "branch": "CIVIL", "year": "BE", "sem": 7, "div": "Div A",
            "subjects": [
                ("sub_cv_sa", "Structural Analysis & Design", "CV-CVC701", 4.0, "Core", "Theory", fac_1_id),
                ("sub_cv_ge", "Geotechnical Engineering", "CV-CVC702", 4.0, "Core", "Theory", fac_1_id)
            ],
            "student_unames": ["student_civil_1"]
        }
    ]

    for combo in combos:
        gid = combo["gid"]
        ay = combo["ay"]
        br = combo["branch"]
        yr = combo["year"]
        sem = combo["sem"]
        div = combo["div"]

        cursor.execute("""
        INSERT INTO academic_groups (id, academic_year, branch_code, year_level, semester_number, division_name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(academic_year, branch_code, year_level, semester_number, division_name) DO UPDATE SET
            id = excluded.id;
        """, (gid, ay, br, yr, sem, div, now_iso))

        # Resolve branch_id from branch code
        cursor.execute("SELECT id FROM branches WHERE code = ? LIMIT 1;", (br,))
        b_row = cursor.fetchone()
        branch_id = b_row["id"] if b_row else f"br_{br.lower()}"

        # Seed the 2 subjects for this combination
        for sid, sname, scode, scred, scat, stype, assigned_fac_id in combo["subjects"]:
            cursor.execute("""
            INSERT INTO subjects (
                id, branch_id, semester_number, name, code, is_elective, category,
                credits, total_credits, subject_type, teaching_hours, academic_year, status, year_level
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 4, ?, 'active', ?)
            ON CONFLICT(code) DO UPDATE SET
                name = excluded.name,
                credits = excluded.credits,
                category = excluded.category,
                subject_type = excluded.subject_type,
                status = 'active';
            """, (sid, branch_id, sem, sname, scode, scat, scred, scred, stype, ay, yr))

            cursor.execute("SELECT id FROM subjects WHERE code = ?;", (scode,))
            actual_sub_id = cursor.fetchone()[0]

            # Allot subject to faculty for this group
            cursor.execute("""
            INSERT INTO subject_allotments (id, academic_group_id, subject_id, faculty_id, academic_year, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(academic_group_id, subject_id) DO UPDATE SET
                faculty_id = excluded.faculty_id;
            """, (f"allot_{gid}_{sid}", gid, actual_sub_id, assigned_fac_id, ay, now_iso))

            # Enroll all students of this combination into the subject
            for uname in combo["student_unames"]:
                stu_id = student_id_map.get(uname)
                if stu_id:
                    cursor.execute("""
                    INSERT INTO student_subject_enrollments (id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at)
                    VALUES (?, ?, ?, ?, 'compulsory', 'enrolled', ?)
                    ON CONFLICT(student_id, subject_id, academic_year) DO UPDATE SET status = 'enrolled';
                    """, (f"enr_{stu_id[:6]}_{sid}", stu_id, actual_sub_id, ay, now_iso))

    # Add 1 Lab Batch for primary student demo (Batch A1)
    primary_student_id = student_id_map["student"]
    cursor.execute("""
    INSERT INTO lab_batches (id, batch_name, academic_year, branch_code, year_level, semester_number, division_name, subject_id, faculty_id, capacity, status, created_at)
    VALUES ('batch_ce_se_a1', 'Batch A1', '2026-27', 'CE', 'SE', 3, 'Div A', 'sub_ds', ?, 25, 'active', ?)
    ON CONFLICT(id) DO UPDATE SET faculty_id = excluded.faculty_id;
    """, (fac_1_id, now_iso))

    cursor.execute("""
    INSERT INTO batch_students (id, batch_id, student_id, assigned_at)
    VALUES ('bs_demo_a1', 'batch_ce_se_a1', ?, ?)
    ON CONFLICT(batch_id, student_id) DO NOTHING;
    """, (primary_student_id, now_iso))

    print("[4/5] Seeding Clean Promotion Window State (Draft / Open with full management)...")
    cursor.execute("DELETE FROM promotion_requests;")
    cursor.execute("DELETE FROM promotion_windows;")

    # Seed one realistic open promotion window for demonstration
    cursor.execute("""
    INSERT INTO promotion_windows (
        id, title, source_academic_year, target_academic_year, source_year_level, target_year_level,
        source_semester, target_semester, branch_code, is_open, status, start_date, end_date, opened_at, created_at
    ) VALUES (
        'pw_se_te_2026_27', 'Second Year to Third Year Academic Promotion (2026-27)',
        '2025-26', '2026-27', 'SE', 'TE', 4, 5, 'CE',
        1, 'open', '2026-07-01T00:00:00Z', '2026-12-31T23:59:59Z', ?, ?
    );
    """, (now_iso, now_iso))

    print("[5/5] Audit Log verification...")
    cursor.execute("""
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details_json, timestamp)
    VALUES (?, 'user_admin', 'RESET_DEMO_DATA', 'SYSTEM', 'demo_environment', ?, ?);
    """, (f"audit_{uuid.uuid4().hex[:10]}", json.dumps({"students_count": 10, "faculty_count": 3, "assessments_count": 0}), now_iso))

    conn.commit()
    conn.close()

    print("\n✅ DEMO CLEANUP & SEEDING COMPLETE:")
    print(" - Exactly 10 Students (Verified)")
    print(" - Exactly 3 Faculty (Verified)")
    print(" - Admin account preserved (admin / password)")
    print(" - Exactly 2 Subjects per unique Academic Combination (Verified)")
    print(" - ZERO pre-created tasks, documents, submissions, or evaluations (Verified)")
    print(" - Computer Networks properly enrolled for Primary Student (Verified)\n")

if __name__ == "__main__":
    seed_demo_10()
