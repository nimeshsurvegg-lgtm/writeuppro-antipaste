"""
WriteUp Pro — Complete Academic Management Demo Seeding Script
Populates the database with:
- Exactly 60 realistic students across 6 branches (CE, IT, EXTC, AIDS, MECH, CIVIL), FE–BE, Div A & B.
- Dedicated Faculty accounts across departments.
- Official Mumbai University Rev-2019 'C' Scheme / NEP 2020 syllabi.
- Academic Groups, Subject Allotments, and Student Subject Enrollments.
- Laboratory Batches (A1, A2, A3, B1, B2, B3) with student memberships.
- Open Elective Offerings & Student Selections.
- Academic Year Promotion Windows & Student Requests.
- Assignments, Lab Experiments, Special Documents (Mini/Major Projects, Research Papers).
- Custom Rubrics with criteria-based grading.
- Submissions (on-time and late with exact delay metrics) and Evaluations with digital stamps.
"""

import sys
import os
import json
import uuid
from datetime import datetime, timezone, timedelta

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.core.database import get_db_connection
from app.core.security import hash_password

def seed_demo_environment():
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    pw_hash = hash_password("password")
    
    print("[1/10] Seeding Departments and Branches...")
    departments = [
        ("dept_ce", "Computer Engineering", "CE"),
        ("dept_it", "Information Technology", "IT"),
        ("dept_extc", "Electronics & Telecommunication", "EXTC"),
        ("dept_aids", "AI & Data Science", "AIDS"),
        ("dept_mech", "Mechanical Engineering", "MECH"),
        ("dept_civil", "Civil Engineering", "CIVIL"),
        ("dept_ash", "Applied Science & Humanities", "ASH")
    ]
    cursor.executemany("INSERT OR IGNORE INTO departments (id, name, code) VALUES (?, ?, ?);", departments)

    branches = [
        ("br_ce", "dept_ce", "Computer Engineering", "CE"),
        ("br_it", "dept_it", "Information Technology", "IT"),
        ("br_extc", "dept_extc", "Electronics & Telecommunication", "EXTC"),
        ("br_aids", "dept_aids", "Artificial Intelligence & Data Science", "AIDS"),
        ("br_mech", "dept_mech", "Mechanical Engineering", "MECH"),
        ("br_civil", "dept_civil", "Civil Engineering", "CIVIL"),
        ("br_ash", "dept_ash", "Applied Science & Humanities", "ASH")
    ]
    cursor.executemany("INSERT OR IGNORE INTO branches (id, department_id, name, code) VALUES (?, ?, ?, ?);", branches)

    print("[2/10] Seeding Academic Calendars...")
    calendars = [
        ("ay_2025_26", "2025-26", "Academic Year 2025-26 (Completed / Archived)", "2025-07-01", "2026-06-30", 0, "archived", now_iso),
        ("ay_2026_27", "2026-27", "Academic Year 2026-27 (Current Active Cycle)", "2026-07-01", "2027-06-30", 1, "active", now_iso),
        ("ay_2027_28", "2027-28", "Academic Year 2027-28 (Upcoming Cycle)", "2027-07-01", "2028-06-30", 0, "upcoming", now_iso)
    ]
    for c in calendars:
        cursor.execute("""
        INSERT INTO academic_calendars (id, code, name, start_date, end_date, is_current, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET is_current = excluded.is_current, status = excluded.status;
        """, c)

    print("[3/10] Seeding Mumbai University Rev-2019 'C' Scheme / NEP 2020 Syllabi...")
    # Comprehensive syllabus with accurate subject codes and credit weights
    syllabus_subjects = [
        # FE - Semester 1 (Common)
        ("sub_fec101", "br_ash", 1, "Engineering Mathematics-I", "FEC101", 0, "Core", 3.0, 3.0, "Theory", 4, "FE"),
        ("sub_fec102", "br_ash", 1, "Engineering Physics-I", "FEC102", 0, "Core", 2.0, 2.0, "Theory", 3, "FE"),
        ("sub_fec103", "br_ash", 1, "Engineering Chemistry-I", "FEC103", 0, "Core", 2.0, 2.0, "Theory", 3, "FE"),
        ("sub_fec104", "br_ash", 1, "Engineering Mechanics", "FEC104", 0, "Core", 3.0, 3.0, "Theory", 4, "FE"),
        ("sub_fec105", "br_ash", 1, "Basic Electrical Engineering", "FEC105", 0, "Core", 3.0, 3.0, "Theory", 4, "FE"),
        ("sub_fel101", "br_ash", 1, "Basic Electrical Engg Lab", "FEL101", 0, "Lab", 1.0, 1.0, "Practical", 2, "FE"),
        # FE - Semester 2 (Common)
        ("sub_fec201", "br_ash", 2, "Engineering Mathematics-II", "FEC201", 0, "Core", 3.0, 3.0, "Theory", 4, "FE"),
        ("sub_fec202", "br_ash", 2, "Engineering Physics-II", "FEC202", 0, "Core", 2.0, 2.0, "Theory", 3, "FE"),
        ("sub_fec203", "br_ash", 2, "Engineering Chemistry-II", "FEC203", 0, "Core", 2.0, 2.0, "Theory", 3, "FE"),
        ("sub_fec204", "br_ash", 2, "Engineering Graphics", "FEC204", 0, "Core", 3.0, 3.0, "Theory", 4, "FE"),
        ("sub_fec205", "br_ash", 2, "C Programming", "FEC205", 0, "Core", 2.0, 2.0, "Theory", 3, "FE"),
        ("sub_fel201", "br_ash", 2, "C Programming Lab", "FEL201", 0, "Lab", 1.0, 1.0, "Practical", 2, "FE"),

        # SE - Computer Engineering (Sem 3 & 4)
        ("sub_csc301", "br_ce", 3, "Engineering Mathematics-III", "CSC301", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_csc302", "br_ce", 3, "Discrete Structures & Graph Theory", "CSC302", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_csc303", "br_ce", 3, "Data Structures and Analysis", "CSC303", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_csc304", "br_ce", 3, "Digital Logic & Computer Org", "CSC304", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_csc305", "br_ce", 3, "Computer Graphics", "CSC305", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_csl301", "br_ce", 3, "Data Structures Lab", "CSL301", 0, "Lab", 1.0, 1.0, "Practical", 2, "SE"),
        ("sub_csl302", "br_ce", 3, "OOP Java Lab", "CSL302", 0, "Lab", 1.0, 1.0, "Practical", 2, "SE"),
        ("sub_csm301", "br_ce", 3, "Mini Project 1-A", "CSM301", 0, "Project", 2.0, 2.0, "Special", 4, "SE"),

        # TE - Computer Engineering (Sem 5 & 6)
        ("sub_csc501", "br_ce", 5, "Theoretical Computer Science", "CSC501", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_csc502", "br_ce", 5, "Software Engineering", "CSC502", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_csc503", "br_ce", 5, "Computer Network", "CSC503", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_csc504", "br_ce", 5, "Data Warehousing & Mining", "CSC504", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_csl501", "br_ce", 5, "Software Engineering Lab", "CSL501", 0, "Lab", 1.0, 1.0, "Practical", 2, "TE"),
        ("sub_csm501", "br_ce", 5, "Mini Project 2-A", "CSM501", 0, "Project", 2.0, 2.0, "Special", 4, "TE"),

        # BE - Computer Engineering (Sem 7 & 8)
        ("sub_csc701", "br_ce", 7, "Machine Learning", "CSC701", 0, "Core", 3.0, 3.0, "Theory", 4, "BE"),
        ("sub_csc702", "br_ce", 7, "Big Data Analytics", "CSC702", 0, "Core", 3.0, 3.0, "Theory", 4, "BE"),
        ("sub_csdlo701", "br_ce", 7, "DLO: Blockchain Technology", "CSDLO701", 1, "Elective", 3.0, 3.0, "Theory", 4, "BE"),
        ("sub_ilo701", "br_ce", 7, "ILO: Cyber Security & Laws", "ILO701", 1, "Open Elective", 3.0, 3.0, "Theory", 3, "BE"),
        ("sub_csp701", "br_ce", 7, "Major Project - Stage 1", "CSP701", 0, "Project", 3.0, 3.0, "Special", 6, "BE"),

        # IT Branch Subjects (Sem 3, 5, 7)
        ("sub_itc301", "br_it", 3, "Applied Mathematics-III", "ITC301", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_itc302", "br_it", 3, "Data Structure & Analysis", "ITC302", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_itc303", "br_it", 3, "Database Management Systems", "ITC303", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_itl301", "br_it", 3, "Python Lab", "ITL301", 0, "Lab", 1.0, 1.0, "Practical", 2, "SE"),
        ("sub_itc501", "br_it", 5, "Internet Programming", "ITC501", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_itc502", "br_it", 5, "Computer Network Security", "ITC502", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_itc701", "br_it", 7, "AI and Deep Learning", "ITC701", 0, "Core", 3.0, 3.0, "Theory", 4, "BE"),

        # EXTC Branch Subjects (Sem 3, 5, 7)
        ("sub_ecc301", "br_extc", 3, "Engineering Mathematics-III", "ECC301", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_ecc302", "br_extc", 3, "Electronic Devices & Circuits", "ECC302", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_ecc303", "br_extc", 3, "Digital System Design", "ECC303", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_ecl301", "br_extc", 3, "Electronic Circuit Lab", "ECL301", 0, "Lab", 1.0, 1.0, "Practical", 2, "SE"),
        ("sub_ecc501", "br_extc", 5, "Digital Communication", "ECC501", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_ecc701", "br_extc", 7, "Microwave Engineering", "ECC701", 0, "Core", 3.0, 3.0, "Theory", 4, "BE"),

        # AIDS Branch Subjects (Sem 3, 5, 7)
        ("sub_adc301", "br_aids", 3, "Discrete Mathematics for AI", "ADC301", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_adc302", "br_aids", 3, "Data Structures for AI", "ADC302", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_adc303", "br_aids", 3, "Database Systems & SQL", "ADC303", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_adl301", "br_aids", 3, "Data Science Lab", "ADL301", 0, "Lab", 1.0, 1.0, "Practical", 2, "SE"),
        ("sub_adc501", "br_aids", 5, "Deep Learning Foundations", "ADC501", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_adc701", "br_aids", 7, "Generative AI Systems", "ADC701", 0, "Core", 3.0, 3.0, "Theory", 4, "BE"),

        # MECH Branch Subjects (Sem 3, 5, 7)
        ("sub_mec301", "br_mech", 3, "Thermodynamics", "MEC301", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_mec302", "br_mech", 3, "Strength of Materials", "MEC302", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_mec303", "br_mech", 3, "Fluid Mechanics", "MEC303", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_mel301", "br_mech", 3, "Materials Testing Lab", "MEL301", 0, "Lab", 1.0, 1.0, "Practical", 2, "SE"),
        ("sub_mec501", "br_mech", 5, "Heat Transfer", "MEC501", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_mec701", "br_mech", 7, "Design of Mechanical Systems", "MEC701", 0, "Core", 3.0, 3.0, "Theory", 4, "BE"),

        # CIVIL Branch Subjects (Sem 3, 5, 7)
        ("sub_cvc301", "br_civil", 3, "Surveying-I", "CVC301", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_cvc302", "br_civil", 3, "Mechanics of Solids", "CVC302", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_cvc303", "br_civil", 3, "Fluid Mechanics-I", "CVC303", 0, "Core", 3.0, 3.0, "Theory", 4, "SE"),
        ("sub_cvl301", "br_civil", 3, "Surveying Lab", "CVL301", 0, "Lab", 1.0, 1.0, "Practical", 2, "SE"),
        ("sub_cvc501", "br_civil", 5, "Structural Analysis-II", "CVC501", 0, "Core", 3.0, 3.0, "Theory", 4, "TE"),
        ("sub_cvc701", "br_civil", 7, "Construction Mgmt & Safety", "CVC701", 0, "Core", 3.0, 3.0, "Theory", 4, "BE"),

        # Institutional Open Electives (Available across all BE branches)
        ("sub_oe_quantum", "br_ce", 7, "Quantum Computing & Algorithms", "ILO702", 1, "Open Elective", 3.0, 3.0, "Theory", 3, "BE"),
        ("sub_oe_cloud", "br_it", 7, "Enterprise Cloud Architectures", "ILO703", 1, "Open Elective", 3.0, 3.0, "Theory", 3, "BE"),
        ("sub_oe_robotics", "br_mech", 7, "Industrial Robotics & Automation", "ILO704", 1, "Open Elective", 3.0, 3.0, "Theory", 3, "BE")
    ]

    for s in syllabus_subjects:
        cursor.execute("""
        INSERT INTO subjects (
            id, branch_id, semester_number, name, code, is_elective, category,
            credits, total_credits, subject_type, teaching_hours, syllabus_scheme,
            academic_year, description, status, year_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Mumbai University Rev-2019 C Scheme / NEP 2020', '2026-27', ?, 'active', ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            is_elective = excluded.is_elective,
            category = excluded.category,
            credits = excluded.credits,
            total_credits = excluded.total_credits,
            subject_type = excluded.subject_type,
            year_level = excluded.year_level;
        """, (
            s[0], s[1], s[2], s[3], s[4], s[5], s[6],
            s[7], s[8], s[9], s[10], f"Standard curriculum course for {s[4]}", s[11]
        ))

    print("[4/10] Seeding Faculty Accounts...")
    faculty_members = [
        ("user_faculty", "faculty", "faculty@writeuppro.edu", "Prof. Elizabeth Smith", "FAC-9021", "CE", "Professor & HOD"),
        ("user_faculty_it", "faculty_it", "faculty_it@writeuppro.edu", "Prof. Alan Turing", "FAC-9022", "IT", "Associate Professor"),
        ("user_faculty_extc", "faculty_extc", "faculty_extc@writeuppro.edu", "Prof. Rajesh Sharma", "FAC-9023", "EXTC", "Associate Professor"),
        ("user_faculty_aids", "faculty_aids", "faculty_aids@writeuppro.edu", "Prof. Sunita Patel", "FAC-9024", "AIDS", "Assistant Professor"),
        ("user_faculty_mech", "faculty_mech", "faculty_mech@writeuppro.edu", "Prof. Vikram Mehta", "FAC-9025", "MECH", "Professor"),
        ("user_faculty_civil", "faculty_civil", "faculty_civil@writeuppro.edu", "Prof. Priya Kulkarni", "FAC-9026", "CIVIL", "Assistant Professor"),
        ("user_faculty_ash", "faculty_ash", "faculty_ash@writeuppro.edu", "Prof. Robert Brown", "FAC-9027", "ASH", "Associate Professor"),
        ("user_faculty_math", "faculty_math", "faculty_math@writeuppro.edu", "Prof. David Clark", "FAC-9028", "ASH", "Professor of Mathematics")
    ]

    for f in faculty_members:
        cursor.execute("""
        INSERT INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'faculty', 'active', ?, ?)
        ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, hashed_password = excluded.hashed_password;
        """, (f[0], f[1], f[2], f[3], pw_hash, now_iso, now_iso))

        cursor.execute("""
        INSERT INTO faculty_profiles (user_id, employee_id, department_code, designation, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET designation = excluded.designation;
        """, (f[0], f[4], f[5], f[6], now_iso))

    print("[5/10] Seeding Academic Groups & Subject Allotments...")
    branches_list = ["CE", "IT", "EXTC", "AIDS", "MECH", "CIVIL"]
    years_sem_map = [
        ("FE", 1),
        ("SE", 3),
        ("TE", 5),
        ("BE", 7)
    ]
    divisions_list = ["Div A", "Div B"]

    academic_groups = []
    for br in branches_list:
        for yl, sem in years_sem_map:
            for div in divisions_list:
                grp_id = f"grp_2026_27_{br.lower()}_{yl.lower()}_{div.lower().replace(' ', '_')}"
                cursor.execute("""
                INSERT OR IGNORE INTO academic_groups (id, academic_year, branch_code, year_level, semester_number, division_name, created_at)
                VALUES (?, '2026-27', ?, ?, ?, ?, ?);
                """, (grp_id, br, yl, sem, div, now_iso))
                academic_groups.append((grp_id, br, yl, sem, div))

    # Allot faculty to subjects for CE and other branches
    faculty_mapping = {
        "CE": "user_faculty",
        "IT": "user_faculty_it",
        "EXTC": "user_faculty_extc",
        "AIDS": "user_faculty_aids",
        "MECH": "user_faculty_mech",
        "CIVIL": "user_faculty_civil",
        "ASH": "user_faculty_ash"
    }

    cursor.execute("SELECT id, branch_id, semester_number, is_elective, year_level FROM subjects WHERE status = 'active';")
    all_active_subs = cursor.fetchall()

    for grp_id, br, yl, sem, div in academic_groups:
        fac_id = faculty_mapping.get(br, "user_faculty")
        # Find subjects matching branch or ASH and semester
        for s in all_active_subs:
            s_id = s["id"]
            if s["semester_number"] == sem:
                allot_id = f"alt_{grp_id}_{s_id}"
                cursor.execute("""
                INSERT OR IGNORE INTO subject_allotments (id, academic_group_id, subject_id, faculty_id, academic_year, created_at)
                VALUES (?, ?, ?, ?, '2026-27', ?);
                """, (allot_id, grp_id, s_id, fac_id, now_iso))

    print("[6/10] Seeding Laboratory Batches (A1, A2, A3, B1, B2, B3)...")
    batch_records = []
    for br in branches_list:
        for yl, sem in [("FE", 1), ("SE", 3), ("TE", 5), ("BE", 7)]:
            for div in ["Div A", "Div B"]:
                prefix = "A" if "A" in div else "B"
                for b_num in [1, 2, 3]:
                    b_name = f"Batch {prefix}{b_num}"
                    b_id = f"batch_{br.lower()}_{yl.lower()}_{prefix.lower()}{b_num}"
                    cursor.execute("""
                    INSERT OR IGNORE INTO lab_batches (
                        id, batch_name, academic_year, branch_code, year_level, semester_number, division_name, faculty_id, capacity, status, created_at
                    ) VALUES (?, ?, '2026-27', ?, ?, ?, ?, ?, 20, 'active', ?);
                    """, (b_id, b_name, br, yl, sem, div, faculty_mapping.get(br, "user_faculty"), now_iso))
                    batch_records.append((b_id, br, yl, sem, div, b_name))

    print("[7/10] Seeding Exactly 60 Demo Students with Verified Profiles...")
    # 6 Branches x 10 Students = Exactly 60 Students
    # Realistic student names
    first_names = [
        "Aarav", "Diya", "Rohan", "Ananya", "Ishaan", "Pooja", "Kabir", "Sneha", "Aditya", "Rhea",
        "Aryan", "Tanvi", "Siddharth", "Neha", "Arjun", "Kavya", "Varun", "Meera", "Karan", "Shreya",
        "Rahul", "Anika", "Manish", "Tara", "Nikhil", "Gauri", "Sameer", "Simran", "Pranav", "Nisha",
        "Akash", "Bhavna", "Gaurav", "Isha", "Kunal", "Lavanya", "Mayank", "Pallavi", "Rishabh", "Sakshi",
        "Tushar", "Vidya", "Yash", "Zoya", "Dev", "Fatima", "Harsh", "Jhanvi", "Mohit", "Natasha",
        "Omkar", "Payal", "Rajat", "Saloni", "Tejas", "Urvi", "Vivek", "Yamini", "Jay", "Alia"
    ]
    last_names = [
        "Sharma", "Verma", "Patel", "Kulkarni", "Deshmukh", "Mehta", "Iyer", "Nair", "Chauhan", "Joshi",
        "Reddy", "Rao", "Gupta", "Bhat", "Singh", "Pandey", "Mishra", "Jain", "Bansal", "Saxena"
    ]

    student_index = 0
    created_student_ids = []

    for br_idx, br in enumerate(branches_list):
        for s_num in range(1, 11):
            student_index += 1
            f_name = first_names[(student_index - 1) % len(first_names)]
            l_name = last_names[(student_index * 3) % len(last_names)]
            full_name = f"{f_name} {l_name}"
            
            # Distribution: 3 in FE, 3 in SE, 2 in TE, 2 in BE
            if s_num in [1, 2, 3]:
                yl = "FE"
                sem = 1
            elif s_num in [4, 5, 6]:
                yl = "SE"
                sem = 3
            elif s_num in [7, 8]:
                yl = "TE"
                sem = 5
            else:
                yl = "BE"
                sem = 7

            div = "Div A" if (s_num % 2 == 1) else "Div B"
            roll_no = f"21{br}{100 + s_num}"
            prn_no = f"PRN2026{br_idx + 1:02d}{s_num:03d}"
            
            # Default first student is 'student' for seamless login testing
            if student_index == 1:
                username = "student"
                user_id = "user_student"
                full_name = "Demo Student"
            else:
                username = f"student_{br.lower()}_{s_num}"
                user_id = f"user_{username}"

            email = f"{username}@writeuppro.edu"
            cgpa = round(7.2 + ((student_index * 7) % 27) / 10.0, 2)

            cursor.execute("""
            INSERT INTO users (id, username, email, full_name, hashed_password, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'student', 'active', ?, ?)
            ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, hashed_password = excluded.hashed_password;
            """, (user_id, username, email, full_name, pw_hash, now_iso, now_iso))

            cursor.execute("""
            INSERT INTO student_profiles (
                user_id, roll_number, prn, year_level, branch_code, semester_number,
                division_name, elective_subject, status, academic_year, cgpa, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Cyber Security & Laws', 'approved', '2026-27', ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                roll_number = excluded.roll_number,
                prn = excluded.prn,
                year_level = excluded.year_level,
                branch_code = excluded.branch_code,
                semester_number = excluded.semester_number,
                division_name = excluded.division_name,
                status = 'approved',
                cgpa = excluded.cgpa;
            """, (user_id, roll_no, prn_no, yl, br, sem, div, cgpa, now_iso, now_iso))

            created_student_ids.append((user_id, username, roll_no, yl, br, sem, div))

            # Auto-enroll student into active compulsory subjects for this semester & branch
            for s in all_active_subs:
                if s["semester_number"] == sem and s["is_elective"] == 0:
                    enr_id = f"enr_{user_id}_{s['id']}"
                    cursor.execute("""
                    INSERT OR IGNORE INTO student_subject_enrollments (
                        id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at
                    ) VALUES (?, ?, ?, '2026-27', 'compulsory', 'enrolled', ?);
                    """, (enr_id, user_id, s["id"], now_iso))

            # Assign student to Lab Batch
            prefix = "A" if "A" in div else "B"
            batch_num = 1 if (s_num % 3 == 1) else (2 if (s_num % 3 == 2) else 3)
            matching_batch_id = f"batch_{br.lower()}_{yl.lower()}_{prefix.lower()}{batch_num}"
            cursor.execute("""
            INSERT OR IGNORE INTO batch_students (id, batch_id, student_id, assigned_at)
            VALUES (?, ?, ?, ?);
            """, (f"bs_{matching_batch_id}_{user_id}", matching_batch_id, user_id, now_iso))

    print("[8/10] Seeding Custom Rubrics for Special Documents & Tasks...")
    # Mini-Project Rubric
    mini_project_criteria = [
        {"id": "crit_prob", "name": "Problem Formulation & Literature Review", "max_score": 10.0, "guidance": "Clarity of research gap and survey of 5+ IEEE papers"},
        {"id": "crit_arch", "name": "System Architecture & Engineering Design", "max_score": 15.0, "guidance": "UML class diagrams, ER diagrams, data flow models"},
        {"id": "crit_impl", "name": "Code Implementation & Working Prototype", "max_score": 15.0, "guidance": "Execution of functional modules and clean code standards"},
        {"id": "crit_viva", "name": "Viva Voce, Documentation & Reporting", "max_score": 10.0, "guidance": "Quality of IEEE formatted write-up and oral defense"}
    ]
    cursor.execute("""
    INSERT INTO custom_rubrics (id, faculty_id, title, document_category, total_marks, criteria_json, created_at)
    VALUES ('rubric_mini_project_2026', 'user_faculty', 'Mini Project 1-A Evaluation Rubric', 'Mini Project', 50.0, ?, ?)
    ON CONFLICT(id) DO UPDATE SET criteria_json = excluded.criteria_json;
    """, (json.dumps(mini_project_criteria), now_iso))

    # Research Paper Rubric
    research_paper_criteria = [
        {"id": "crit_abs", "name": "Abstract & Key Theoretical Contribution", "max_score": 5.0, "guidance": "Novelty and concise synthesis of results"},
        {"id": "crit_meth", "name": "Mathematical & Experimental Methodology", "max_score": 10.0, "guidance": "Correctness of algorithmic complexity & formulation"},
        {"id": "crit_res", "name": "Comparative Results & Benchmark Analysis", "max_score": 10.0, "guidance": "Empirical charts, KaTeX equations, error metrics"}
    ]
    cursor.execute("""
    INSERT INTO custom_rubrics (id, faculty_id, title, document_category, total_marks, criteria_json, created_at)
    VALUES ('rubric_research_paper_2026', 'user_faculty', 'Academic Research Paper Rubric', 'Research Paper', 25.0, ?, ?)
    ON CONFLICT(id) DO UPDATE SET criteria_json = excluded.criteria_json;
    """, (json.dumps(research_paper_criteria), now_iso))

    print("[9/10] Seeding Realistic Tasks (Division Assignments, Batch Experiments, Special Docs)...")
    # 1. Division-wide Assignment (Data Structures)
    due_tomorrow = (now + timedelta(days=2)).strftime("%Y-%m-%d %H:%M")
    past_due_date = (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M")

    cursor.execute("""
    INSERT INTO tasks (
        id, title, description, subject_id, faculty_id, task_type, task_number, max_marks,
        instructions, due_date, rubric_json, status, created_at, academic_year, branch_code,
        year_level, semester_number, division_name, target_type, category, late_submission_policy, late_penalty_percent
    ) VALUES (
        'task_ds_assign_1', 'Binary Search Tree Algorithms & Operations',
        'Implement BST insertion, deletion, inorder traversal, and balance verification.',
        'sub_csc303', 'user_faculty', 'Assignment', '1', 10.0,
        'Provide algorithmic analysis, pseudocode, edge-case analysis, and sample outputs.',
        ?, ?, 'published', ?, '2026-27', 'CE', 'SE', 3, 'Div A', 'division', 'standard', 'penalty', 10.0
    ) ON CONFLICT(id) DO UPDATE SET due_date = excluded.due_date;
    """, (due_tomorrow, json.dumps([
        {"criteria": "Knowledge & Conceptual Theory", "max": 4.0},
        {"criteria": "Content Structure & Neatness", "max": 3.0},
        {"criteria": "Academic Punctuality", "max": 3.0}
    ]), now_iso))

    # 2. Batch-Specific Laboratory Experiment (Batch A1 only!)
    cursor.execute("""
    INSERT INTO tasks (
        id, title, description, subject_id, faculty_id, task_type, task_number, max_marks,
        instructions, due_date, rubric_json, status, created_at, academic_year, branch_code,
        year_level, semester_number, division_name, target_type, batch_id, category,
        experiment_number, objective, hardware_software_req, procedure, expected_output,
        late_submission_policy, late_penalty_percent
    ) VALUES (
        'task_ds_expt_a1', 'Lab Experiment 3: Heap Sort & Priority Queues',
        'Demonstrate max-heap build and array sorting with O(n log n) efficiency.',
        'sub_csl301', 'user_faculty', 'Experiment', '3', 15.0,
        'Upload verified console output traces and memory complexity deductions.',
        ?, ?, 'published', ?, '2026-27', 'CE', 'SE', 3, 'Div A', 'batch', 'batch_ce_se_a1', 'standard',
        'EXPT-03', 'To design, trace, and evaluate Heap Sort for dynamic priority management.',
        'Hardware: Intel i5/i7 Workstation; Software: GCC 11.2 / Java JDK 17, Linux Ubuntu 22.04 LTS',
        '1. Construct array of N keys.\n2. Apply bottom-up heapify.\n3. Repeatedly swap root with last leaf and restore heap property.\n4. Log swap counts.',
        'Sorted array in ascending order with step-by-step tree visualization and verified timing.',
        'penalty', 10.0
    ) ON CONFLICT(id) DO UPDATE SET due_date = excluded.due_date;
    """, (past_due_date, json.dumps([
        {"criteria": "Knowledge & Theory", "max": 4.0},
        {"criteria": "Content & Neatness", "max": 3.0},
        {"criteria": "Punctuality", "max": 3.0},
        {"criteria": "Practical Execution & Output", "max": 5.0}
    ]), now_iso))

    # 3. Special Document Task (Mini Project 1-A) with Custom Rubric
    cursor.execute("""
    INSERT INTO tasks (
        id, title, description, subject_id, faculty_id, task_type, task_number, max_marks,
        instructions, due_date, rubric_json, status, created_at, academic_year, branch_code,
        year_level, semester_number, division_name, target_type, category, document_category,
        custom_rubric_id, late_submission_policy
    ) VALUES (
        'task_mini_project_se', 'Mini Project 1-A: Automated Hospital Triage System',
        'Full-stack engineering implementation of triage prioritization with secure patient dossier.',
        'sub_csm301', 'user_faculty', 'Assignment', 'MP-1', 50.0,
        'Follow IEEE project documentation schema: Abstract, Architecture, Implementation, Testing, Viva Defense.',
        ?, ?, 'published', ?, '2026-27', 'CE', 'SE', 3, 'Div A', 'division', 'special', 'Mini Project',
        'rubric_mini_project_2026', 'accept'
    ) ON CONFLICT(id) DO UPDATE SET due_date = excluded.due_date;
    """, ((now + timedelta(days=10)).strftime("%Y-%m-%d %H:%M"), json.dumps(mini_project_criteria), now_iso))

    print("[10/10] Seeding Submissions, Delay Tracking, Evaluations, Promotion Requests & Electives...")
    # Sample Document & Submissions for Demo Student (user_student)
    doc_id = "doc_demo_student_1"
    cursor.execute("""
    INSERT INTO documents (
        id, student_id, task_id, title, doc_type, subject_name, subject_code, doc_number, content_html, word_count, status, created_at, updated_at
    ) VALUES (
        ?, 'user_student', 'task_ds_assign_1', 'Binary Search Tree Algorithms & Operations',
        'Assignment', 'Data Structures and Analysis', 'CSC303', '1',
        '<h2>Aim</h2><p>To implement binary search trees with logarithmic lookup and insertion efficiency.</p><h3>Algorithm</h3><p>Nodes are partitioned recursively such that keys in the left subtree remain strictly smaller than the root.</p>',
        185, 'graded', ?, ?
    ) ON CONFLICT(id) DO UPDATE SET status = 'graded';
    """, (doc_id, now_iso, now_iso))

    sub_id = "sub_demo_student_1"
    cursor.execute("""
    INSERT INTO submissions (
        id, document_id, task_id, student_id, submission_code, snapshot_html, submission_date,
        is_late, delay_seconds, delay_text, late_penalty_applied, batch_id, status, created_at
    ) VALUES (
        ?, ?, 'task_ds_assign_1', 'user_student', 'SUB-2026-IIET-BST001',
        '<h2>Aim</h2><p>To implement binary search trees with logarithmic lookup and insertion efficiency.</p>',
        ?, 0, 0, 'Submitted on time', 0.0, NULL, 'graded', ?
    ) ON CONFLICT(id) DO UPDATE SET status = 'graded';
    """, (sub_id, doc_id, now.strftime("%d/%m/%Y %H:%M"), now_iso))

    # Evaluation for Demo Student
    cursor.execute("""
    INSERT INTO evaluations (
        id, submission_id, faculty_id, marks_awarded, max_marks, rubric_scores_json,
        feedback, remarks, digital_signature_code, status, evaluated_at
    ) VALUES (
        'eval_demo_student_1', ?, 'user_faculty', 9.5, 10.0,
        ?, 'Exceptional algorithmic rigor and comprehensive tree traversal proofs.',
        'Approved and signed digitally by HOD.', 'SIG-E8A42F-IIET-261127', 'approved', ?
    ) ON CONFLICT(submission_id) DO UPDATE SET marks_awarded = 9.5;
    """, (sub_id, json.dumps({"knowledge": 4.0, "content": 2.8, "punctuality": 2.7}), now_iso))

    # Delayed Submission Demo (Experiment 3 submitted 4h 30m late by student 2)
    doc_id_late = "doc_demo_late_1"
    cursor.execute("""
    INSERT INTO documents (
        id, student_id, task_id, title, doc_type, subject_name, subject_code, doc_number, content_html, word_count, status, created_at, updated_at
    ) VALUES (
        ?, 'user_student_ce_4', 'task_ds_expt_a1', 'Lab Experiment 3: Heap Sort & Priority Queues',
        'Experiment', 'Data Structures Lab', 'CSL301', '3',
        '<h2>Aim</h2><p>Heap Sort Implementation with min-heap property.</p><p>Completed benchmark tests with randomized array generation.</p>',
        210, 'graded', ?, ?
    ) ON CONFLICT(id) DO UPDATE SET status = 'graded';
    """, (doc_id_late, now_iso, now_iso))

    sub_id_late = "sub_demo_late_1"
    cursor.execute("""
    INSERT INTO submissions (
        id, document_id, task_id, student_id, submission_code, snapshot_html, submission_date,
        is_late, delay_seconds, delay_text, late_penalty_applied, batch_id, status, created_at
    ) VALUES (
        ?, ?, 'task_ds_expt_a1', 'user_student_ce_4', 'SUB-2026-IIET-HEAP09',
        '<h2>Aim</h2><p>Heap Sort Implementation with min-heap property.</p>',
        ?, 1, 16200, 'Submitted 4h 30m late', 10.0, 'batch_ce_se_a1', 'graded', ?
    ) ON CONFLICT(id) DO UPDATE SET status = 'graded';
    """, (sub_id_late, doc_id_late, now.strftime("%d/%m/%Y %H:%M"), now_iso))

    cursor.execute("""
    INSERT INTO evaluations (
        id, submission_id, faculty_id, marks_awarded, max_marks, rubric_scores_json,
        feedback, remarks, digital_signature_code, status, evaluated_at
    ) VALUES (
        'eval_demo_late_1', ?, 'user_faculty', 13.5, 15.0,
        ?, 'Solid heapify logic, but late penalty of 10% deducted.',
        'Approved [Late Penalty: -10% (-1.35 marks). Net Score: 12.15/15.0]',
        'SIG-99B7C1-IIET-261127', 'approved', ?
    ) ON CONFLICT(submission_id) DO UPDATE SET marks_awarded = 13.5;
    """, (sub_id_late, json.dumps({"knowledge": 3.8, "content": 2.7, "punctuality": 2.0, "performance": 5.0}), now_iso))

    # Open Elective Configurations
    oe_configs = [
        ("oe_cfg_cyber", "2026-27", "CE", "BE", 7, "sub_ilo701", "user_faculty", 60),
        ("oe_cfg_blockchain", "2026-27", "CE", "BE", 7, "sub_csdlo701", "user_faculty", 50),
        ("oe_cfg_quantum", "2026-27", "IT", "BE", 7, "sub_oe_quantum", "user_faculty_it", 45),
        ("oe_cfg_robotics", "2026-27", "MECH", "BE", 7, "sub_oe_robotics", "user_faculty_mech", 40)
    ]
    for oe in oe_configs:
        cursor.execute("""
        INSERT INTO open_elective_configs (
            id, academic_year, branch_code, year_level, semester_number, subject_id,
            faculty_id, max_capacity, is_active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(id) DO UPDATE SET max_capacity = excluded.max_capacity;
        """, (oe[0], oe[1], oe[2], oe[3], oe[4], oe[5], oe[6], oe[7], now_iso))

    # Sample Open Elective Selections
    cursor.execute("""
    INSERT OR IGNORE INTO open_elective_selections (id, student_id, elective_config_id, subject_id, status, selected_at)
    VALUES ('oes_demo_1', 'user_student', 'oe_cfg_cyber', 'sub_ilo701', 'approved', ?);
    """, (now_iso,))

    # Academic Year Promotion Window & Sample Student Requests
    cursor.execute("""
    INSERT INTO promotion_windows (
        id, title, source_academic_year, target_academic_year, source_year_level, target_year_level,
        source_semester, target_semester, branch_code, is_open, opened_at, created_at
    ) VALUES (
        'win_promo_2026_se_te', 'SE to TE Academic Promotion Window (2026-27 -> 2027-28)',
        '2026-27', '2027-28', 'SE', 'TE', 3, 5, 'CE', 1, ?, ?
    ) ON CONFLICT(id) DO UPDATE SET is_open = 1;
    """, (now_iso, now_iso))

    cursor.execute("""
    INSERT OR IGNORE INTO promotion_requests (
        id, promotion_window_id, student_id, cgpa, current_year_level, current_semester,
        current_division, current_roll_number, requested_division, requested_roll_number,
        status, submitted_at
    ) VALUES (
        'req_promo_demo_1', 'win_promo_2026_se_te', 'user_student', 9.15,
        'SE', 3, 'Div A', '21CE104', 'Div A', '22CE204', 'pending', ?
    );
    """, (now_iso,))

    conn.commit()
    conn.close()
    print("=" * 70)
    print("SUCCESS: 60 Demo Students, Faculty, Syllabi, Allotments & Workflows seeded!")
    print("=" * 70)

if __name__ == "__main__":
    seed_demo_environment()
