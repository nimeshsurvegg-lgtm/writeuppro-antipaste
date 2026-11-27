import os
import sys
import json
import sqlite3

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/v1/health")
    print(f"Health check: {res.status_code} -> {res.json()}")
    assert res.status_code == 200

def login(username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    if res.status_code != 200:
        raise Exception(f"Login failed for {username}: {res.status_code} {res.text}")
    return res.json()["access_token"]

def main():
    print("=== TESTING FASTAPI APP VIA TESTCLIENT ===")
    test_health()

    # 1. Login
    admin_token = login("admin", "password")
    faculty_token = login("faculty", "password")
    student_token = login("student", "password")
    print("Tokens retrieved successfully for admin, faculty, student.")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # Reset demo data to pristine state before starting tests
    res = client.post("/api/v1/academic/admin/reset-demo-data", headers=admin_headers)
    assert res.status_code == 200

    # 2. Performance for student
    res = client.get("/api/v1/academic/student/academic-performance", headers=student_headers)
    print(f"Student performance: {res.status_code}")
    assert res.status_code == 200
    perf = res.json()
    print(f"Enrolled subjects count: {len(perf)}")
    for s in perf:
        print(f"  - {s['subject_name']} ({s['subject_code']}): Assignments Avg='{s['assignment_average_display']}', Experiments Avg='{s['experiment_average_display']}'")
    has_cn = any("Computer Network" in s["subject_name"] for s in perf)
    has_ds = any("Data Structure" in s["subject_name"] for s in perf)
    assert has_cn and has_ds, "Both Computer Networks and Data Structures must be present!"

    # 3. Calendar
    res = client.get("/api/v1/academic/calendar", headers=student_headers)
    assert res.status_code == 200
    print(f"Calendar events count (student): {len(res.json())}")

    # 4. Portfolio
    res = client.get("/api/v1/academic/student/portfolio", headers=student_headers)
    assert res.status_code == 200
    port = res.json()
    print(f"Portfolio retrieved for {port['profile']['full_name']} (Roll: {port['profile']['roll_number']}, CGPA: {port['profile']['cgpa']})")

    # 5. Promotion Window & Requests
    res = client.get("/api/v1/academic/promotions/windows", headers=admin_headers)
    assert res.status_code == 200
    windows = res.json()
    print(f"Promotion windows: {len(windows)}")
    assert len(windows) > 0
    win = windows[0]
    win_id = win["id"]

    # Toggle close
    res = client.patch(f"/api/v1/academic/promotions/windows/{win_id}/toggle", headers=admin_headers)
    assert res.status_code == 200
    print(f"Closed promotion window: {res.json()}")

    # Student checks closed window
    res = client.get("/api/v1/academic/promotions/student-window", headers=student_headers)
    assert res.status_code == 200
    stu_win = res.json()
    print(f"Student window check while closed: has_window={stu_win.get('has_window')}, is_open={stu_win.get('window', {}).get('is_open') if stu_win.get('window') else False}")

    # Student tries to apply when closed -> must fail with 400
    res = client.post("/api/v1/academic/promotions/apply", json={
        "promotion_window_id": win_id,
        "cgpa": 9.2,
        "requested_division": "Div A",
        "requested_roll_number": "31CE101"
    }, headers=student_headers)
    print(f"Application to closed window: {res.status_code} -> {res.json()}")
    assert res.status_code == 400

    # Reopen window
    res = client.patch(f"/api/v1/academic/promotions/windows/{win_id}/toggle", headers=admin_headers)
    assert res.status_code == 200
    print(f"Reopened promotion window: {res.json()}")

    # Student applies to open window -> must succeed
    res = client.post("/api/v1/academic/promotions/apply", json={
        "promotion_window_id": win_id,
        "cgpa": 9.2,
        "requested_division": "Div A",
        "requested_roll_number": "31CE101"
    }, headers=student_headers)
    print(f"Application to open window: {res.status_code} -> {res.json()}")
    assert res.status_code == 200
    req_id = res.json()["id"]

    # Student tries duplicate application -> must fail with 400
    res = client.post("/api/v1/academic/promotions/apply", json={
        "promotion_window_id": win_id,
        "cgpa": 9.2,
        "requested_division": "Div A",
        "requested_roll_number": "31CE101"
    }, headers=student_headers)
    print(f"Duplicate application: {res.status_code} -> {res.json()}")
    assert res.status_code == 400

    # Admin reviews and approves request
    res = client.patch(f"/api/v1/academic/promotions/requests/{req_id}/review", json={
        "status": "approved",
        "approved_division": "Div A",
        "approved_roll_number": "31CE101",
        "admin_remarks": "Approved promotion for high academic performance"
    }, headers=admin_headers)
    print(f"Admin review: {res.status_code} -> {res.json()}")
    assert res.status_code == 200

    # 6. Admin Tools (Backup, CSV Export, Audit Logs)
    res = client.post("/api/v1/academic/admin/backup-database", headers=admin_headers)
    print(f"Backup procedure: {res.status_code} -> {res.json()}")
    assert res.status_code == 200 and "backup_file" in res.json()

    res = client.get("/api/v1/academic/admin/audit-logs", headers=admin_headers)
    print(f"Audit logs: {res.status_code} -> {len(res.json())} logs")
    assert res.status_code == 200 and len(res.json()) > 0

    # 7. Special Document Task with flexible submission methods
    # Find Computer Networks subject ID dynamically
    res = client.get("/api/v1/academic/student/academic-performance", headers=student_headers)
    assert res.status_code == 200
    cn_sub_meta = [s for s in res.json() if "Computer Network" in s["subject_name"]][0]
    cn_subject_id = cn_sub_meta["subject_id"]
    print(f"Targeting Computer Networks subject ID: {cn_subject_id}")

    res = client.post("/api/v1/tasks", json={
        "title": "SE Capstone Project Review 1",
        "description": "Submit repository link or project documentation",
        "due_date": "2026-12-30T18:00:00Z",
        "subject_id": cn_subject_id, # Real Computer Networks subject ID
        "task_category": "special_document",
        "task_type": "Special Document",
        "max_marks": 50.0,
        "allowed_methods": ["editor", "pdf", "docx", "other_files", "external_link"],
        "allow_multiple_methods": True,
        "max_file_size_mb": 25,
        "max_files_count": 5
    }, headers=faculty_headers)
    print(f"Create Special Document Task: {res.status_code} -> {res.json()}")
    assert res.status_code == 200
    task_id = res.json()["id"]

    # Student submits external link for this task
    res = client.post("/api/v1/documents", json={
        "title": "SE Capstone Distributed Network Protocol",
        "task_id": task_id,
        "content_html": "<p>Implementation of high-throughput reliable multicast protocol.</p>",
        "submission_method": "external_link",
        "external_link_url": "https://github.com/aaravsharma/distributed-protocol",
        "external_link_title": "Distributed Protocol GitHub Repo",
        "external_link_description": "Source code, unit tests, and performance benchmarks."
    }, headers=student_headers)
    print(f"Create Document: {res.status_code} -> {res.json()}")
    assert res.status_code == 200
    doc_id = res.json()["id"]

    res = client.post("/api/v1/submissions", json={
        "task_id": task_id,
        "document_id": doc_id,
        "content_snapshot": "<p>Implementation of high-throughput reliable multicast protocol.</p>"
    }, headers=student_headers)
    print(f"Submit Document: {res.status_code} -> {res.json()}")
    assert res.status_code in (200, 201)
    submission_id = res.json()["submission_id"]

    # Faculty evaluates special document
    res = client.post("/api/v1/evaluations", json={
        "submission_id": submission_id,
        "marks_awarded": 46.5,
        "remarks": "Outstanding distributed protocol implementation and architecture design.",
        "rubric_scores": {
            "System Architecture": 19.0,
            "Code Quality": 18.5,
            "Documentation": 9.0
        }
    }, headers=faculty_headers)
    print(f"Faculty evaluation: {res.status_code} -> {res.json()}")
    assert res.status_code in (200, 201)

    # Check Student Performance again to verify Special Document is included in marks!
    res = client.get("/api/v1/academic/student/academic-performance", headers=student_headers)
    assert res.status_code == 200
    updated_subs = res.json()
    cn_sub = [s for s in updated_subs if "Computer Network" in s["subject_name"]][0]
    print(f"Updated Computer Networks: Special Docs count = {len(cn_sub['special_documents'])}")
    assert len(cn_sub['special_documents']) == 1
    spec_item = cn_sub['special_documents'][0]
    print(f"Special doc score: {spec_item['marks_obtained']} / {spec_item['max_marks']}")
    assert spec_item['marks_obtained'] == 46.5

    # 8. Reset Demo Data safely
    res = client.post("/api/v1/academic/admin/reset-demo-data", headers=admin_headers)
    print(f"Reset demo data: {res.status_code} -> {res.json()}")
    assert res.status_code == 200

    # Verify counts post-reset
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "writeuppro.db"))
    db = sqlite3.connect(db_path)
    c = db.cursor()
    c.execute("SELECT COUNT(*) FROM users WHERE role='student';")
    stu_cnt = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM users WHERE role='faculty';")
    fac_cnt = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM users WHERE role='admin';")
    adm_cnt = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM tasks;")
    task_cnt = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM submissions;")
    sub_cnt = c.fetchone()[0]
    db.close()

    print(f"Post-reset DB state: Students={stu_cnt}, Faculty={fac_cnt}, Admins={adm_cnt}, Tasks={task_cnt}, Submissions={sub_cnt}")
    assert stu_cnt == 10, f"Expected 10 students, got {stu_cnt}"
    assert fac_cnt == 3, f"Expected 3 faculty, got {fac_cnt}"
    assert adm_cnt == 1, f"Expected 1 admin, got {adm_cnt}"
    assert task_cnt == 0, f"Expected 0 tasks, got {task_cnt}"
    assert sub_cnt == 0, f"Expected 0 submissions, got {sub_cnt}"

    print("\n=======================================================")
    print(">>> IN-PROCESS FASTAPI TESTCLIENT PASSED ALL TESTS! <<<")
    print("=======================================================")

if __name__ == "__main__":
    main()
