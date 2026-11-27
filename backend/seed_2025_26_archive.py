import sqlite3
import uuid
from datetime import datetime, timezone

def seed_2025_archive():
    conn = sqlite3.connect('backend/writeuppro.db')
    c = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Check if 2025-26 academic calendar exists and is marked archived
    c.execute("SELECT id, status FROM academic_calendars WHERE code = '2025-26'")
    cal = c.fetchone()
    if not cal:
        c.execute("""
        INSERT INTO academic_calendars (id, code, name, start_date, end_date, is_current, status, created_at)
        VALUES ('ay_2025_26', '2025-26', 'Academic Year 2025-26 (Completed / Archived)', '2025-07-01', '2026-06-30', 0, 'archived', ?)
        """, (now_iso,))
    else:
        c.execute("UPDATE academic_calendars SET status = 'archived', is_current = 0 WHERE code = '2025-26'")

    # 2. Add 2025-26 Academic Groups
    branches = ['CE', 'IT', 'EXTC', 'AIDS', 'MECH', 'CIVIL']
    year_levels = [('FE', 1), ('FE', 2), ('SE', 3), ('SE', 4), ('TE', 5), ('TE', 6), ('BE', 7), ('BE', 8)]
    divisions = ['Div A', 'Div B']

    for branch in branches:
        for yl, sem in year_levels:
            for div in divisions:
                grp_id = f"grp_2025_26_{branch.lower()}_{yl.lower()}_{div.lower().replace(' ', '_')}"
                c.execute("""
                INSERT OR IGNORE INTO academic_groups (id, academic_year, branch_code, year_level, semester_number, division_name, created_at)
                VALUES (?, '2025-26', ?, ?, ?, ?, ?)
                """, (grp_id, branch, yl, sem, div, '2025-07-15T00:00:00Z'))

    # 3. Add 2025-26 Subject Allotments for core groups
    c.execute("""
    SELECT ag.id, ag.branch_code, ag.semester_number, ag.division_name
    FROM academic_groups ag
    WHERE ag.academic_year = '2025-26' AND ag.branch_code IN ('CE', 'IT') AND ag.year_level IN ('FE', 'SE')
    """)
    groups = c.fetchall()

    for grp_id, b_code, sem_num, div_name in groups:
        c.execute("""
        SELECT s.id, b.code as b_code FROM subjects s
        JOIN branches b ON s.branch_id = b.id
        WHERE b.code = ? AND s.semester_number = ?
        LIMIT 4
        """, (b_code, sem_num))
        subs = c.fetchall()

        fac_id = 'user_faculty' if b_code == 'CE' else 'user_faculty_it'
        for sub_id, _ in subs:
            alt_id = f"alt_2025_{grp_id}_{sub_id}"
            c.execute("""
            INSERT OR IGNORE INTO subject_allotments (id, academic_group_id, subject_id, faculty_id, academic_year, created_at)
            VALUES (?, ?, ?, ?, '2025-26', ?)
            """, (alt_id, grp_id, sub_id, fac_id, '2025-07-20T00:00:00Z'))

    # 4. Add 2025-26 Lab Batches
    for branch in ['CE', 'IT']:
        for yl, sem in [('SE', 3), ('TE', 5)]:
            for div in ['Div A', 'Div B']:
                for b_name in ['Batch A1', 'Batch A2', 'Batch A3'] if div == 'Div A' else ['Batch B1', 'Batch B2', 'Batch B3']:
                    b_id = f"batch_2025_{branch.lower()}_{yl.lower()}_{div.lower().replace(' ', '_')}_{b_name.lower().replace(' ', '_')}"
                    fac_id = 'user_faculty' if branch == 'CE' else 'user_faculty_it'
                    c.execute("""
                    INSERT OR IGNORE INTO lab_batches (id, batch_name, academic_year, branch_code, year_level, semester_number, division_name, faculty_id, capacity, status, created_at)
                    VALUES (?, ?, '2025-26', ?, ?, ?, ?, ?, 20, 'archived', ?)
                    """, (b_id, b_name, branch, yl, sem, div, fac_id, '2025-07-20T00:00:00Z'))

    # 5. Add 2025-26 Student Enrollment History
    # E.g. Demo student was in FE Div A during 2025-26
    c.execute("""
    INSERT OR IGNORE INTO student_enrollment_history (id, student_id, academic_year, year_level, semester_number, branch_code, division_name, roll_number, cgpa, archived_at)
    VALUES ('hist_stu_2025_fe', 'user_student', '2025-26', 'FE', 2, 'CE', 'Div A', '20CE104', 8.75, '2026-06-30T23:59:59Z')
    """)

    # Also historical subject enrollments for student in 2025-26
    c.execute("""
    SELECT s.id FROM subjects s
    JOIN branches b ON s.branch_id = b.id
    WHERE b.code = 'CE' AND s.semester_number IN (1, 2)
    LIMIT 4
    """)
    fe_subs = c.fetchall()
    for s_row in fe_subs:
        enr_id = f"enr_2025_stu_{s_row[0]}"
        c.execute("""
        INSERT OR IGNORE INTO student_subject_enrollments (id, student_id, subject_id, academic_year, enrollment_type, status, enrolled_at)
        VALUES (?, 'user_student', ?, '2025-26', 'compulsory', 'completed', '2025-07-20T00:00:00Z')
        """, (enr_id, s_row[0]))

    # 6. Add a few historical tasks for 2025-26
    c.execute("""
    INSERT OR IGNORE INTO tasks (id, title, description, subject_id, faculty_id, task_type, task_number, max_marks, instructions, due_date, rubric_json, status, created_at, academic_year, branch_code, year_level, semester_number, division_name, target_type)
    VALUES (
        'task_hist_2025_1',
        'Historical Assignment: Object Oriented Modeling',
        'Archived 2025-26 Assignment for OOPM.',
        'sub_fec101',
        'user_faculty',
        'Assignment',
        '1',
        10.0,
        'Design complete class diagram with inheritance and polymorphism.',
        '2025-11-15T23:59:59Z',
        '[{\"criteria\":\"Class Hierarchy\",\"max\":4},{\"criteria\":\"Polymorphism\",\"max\":3},{\"criteria\":\"Code Quality\",\"max\":3}]',
        'archived',
        '2025-10-15T00:00:00Z',
        '2025-26',
        'CE',
        'FE',
        1,
        'Div A',
        'division'
    )
    """)

    conn.commit()
    conn.close()
    print("Successfully seeded 2025-26 archived academic records!")

if __name__ == '__main__':
    seed_2025_archive()
