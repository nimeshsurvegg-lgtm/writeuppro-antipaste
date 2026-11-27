import os
import sys
import sqlite3
import json

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

def audit_fastapi():
    print("=== AUDITING FASTAPI APP AND ROUTING ===")
    from app.main import app
    from app.api.v1.router import api_router
    print(f"api_router routes count: {len(api_router.routes)}")
    print(f"app.routes count: {len(app.routes)}")
    for i, r in enumerate(app.routes):
        print(f"  [{i}] {type(r).__name__}: {getattr(r, 'path', str(r))}")
        if hasattr(r, "routes"):
            print(f"      has nested routes: {len(r.routes)}")
            for nested in r.routes[:5]:
                print(f"         nested: {getattr(nested, 'methods', '')} -> {getattr(nested, 'path', '')}")
    return []

def audit_database():
    print("\n=== AUDITING DATABASE SCHEMA AND CONSTRAINTS ===")
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "writeuppro.db"))
    if not os.path.exists(db_path):
        print(f"ERROR: Database file not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in c.fetchall()]
    print(f"Database contains {len(tables)} tables:")
    for t in tables:
        c.execute(f"PRAGMA table_info({t});")
        cols = [col[1] for col in c.fetchall()]
        c.execute(f"SELECT COUNT(*) FROM {t};")
        cnt = c.fetchone()[0]
        print(f"  - {t} ({cnt} rows): {', '.join(cols[:8])}{'...' if len(cols)>8 else ''}")

    # Check key demo data counts
    print("\n=== DEMO DATA ROSTER AUDIT ===")
    c.execute("SELECT COUNT(*) FROM users WHERE role='student';")
    stu_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM users WHERE role='faculty';")
    fac_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM users WHERE role='admin';")
    adm_count = c.fetchone()[0]
    
    c.execute("SELECT COUNT(*) FROM tasks;")
    tasks_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM submissions;")
    subs_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM evaluations;")
    evals_count = c.fetchone()[0]
    
    print(f"Students count: {stu_count} (Target: exactly 10)")
    print(f"Faculty count: {fac_count} (Target: exactly 3)")
    print(f"Admin count: {adm_count} (Target: at least 1)")
    print(f"Tasks count: {tasks_count} (Fresh target: 0)")
    print(f"Submissions count: {subs_count} (Fresh target: 0)")
    print(f"Evaluations count: {evals_count} (Fresh target: 0)")
    
    # Check subjects per combination
    print("\n=== SUBJECTS PER ACADEMIC COMBINATION AUDIT ===")
    c.execute("""
    SELECT g.academic_year, g.branch_code, g.year_level, g.semester_number, g.division_name, COUNT(a.id) 
    FROM academic_groups g
    LEFT JOIN subject_allotments a ON a.academic_group_id = g.id
    GROUP BY g.id;
    """)
    combos = c.fetchall()
    for yr, br, lvl, sem, div, sub_cnt in combos:
        print(f"  Combo [{yr} | {br} | {lvl} | Sem {sem} | {div}]: {sub_cnt} subjects (Target <= 2)")
    
    # Check primary student enrollments
    print("\n=== PRIMARY STUDENT (21CE101 / student) ENROLLMENTS ===")
    c.execute("SELECT id FROM users WHERE username='student';")
    stu_row = c.fetchone()
    if stu_row:
        stu_id = stu_row[0]
        c.execute("""
        SELECT s.id, s.name, s.code, e.academic_year
        FROM student_subject_enrollments e
        JOIN subjects s ON e.subject_id = s.id
        WHERE e.student_id = ?;
        """, (stu_id,))
        enrolled = c.fetchall()
        for sid, sname, scode, ay in enrolled:
            print(f"  Enrolled: {sname} ({scode}) [AY: {ay}]")
    else:
        print("  WARNING: 'student' user not found!")

    conn.close()
    return True

if __name__ == "__main__":
    audit_fastapi()
    audit_database()
