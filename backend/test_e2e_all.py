import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api/v1"

def post_json(url, data, token=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def get_json(url, token=None):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def patch_json(url, data=None, token=None):
    encoded = json.dumps(data).encode("utf-8") if data else b""
    req = urllib.request.Request(url, data=encoded, method="PATCH", headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def login(username, password):
    status, data = post_json(f"{BASE_URL}/auth/login", {"username": username, "password": password})
    if status != 200:
        raise Exception(f"Login failed for {username}: status {status}, {data}")
    return data["access_token"]

def main():
    print("=== STARTING COMPREHENSIVE E2E VERIFICATION ===")

    # 1. Login with demo accounts
    print("\n--- 1. Testing Login for Admin, Faculty, Student ---")
    admin_token = login("admin", "password")
    faculty_token = login("faculty", "password")
    student_token = login("student", "password")
    print(f"Admin Token: {admin_token[:15]}...")
    print(f"Faculty Token: {faculty_token[:15]}...")
    print(f"Student Token: {student_token[:15]}...")

    # 2. Verify Subject-wise Academic Performance (including Computer Networks fix)
    print("\n--- 2. Testing Subject-wise Academic Performance (Marks & Missing Subject Fix) ---")
    status, perf = get_json(f"{BASE_URL}/academic/student/academic-performance", student_token)
    assert status == 200, f"Expected 200, got {status}: {perf}"
    subjects = perf if isinstance(perf, list) else perf.get("subjects", [])
    sub_names = [s["subject_name"] for s in subjects]
    print(f"Student enrolled subjects found ({len(subjects)}): {sub_names}")
    has_cn = any("Computer Network" in name for name in sub_names)
    has_ds = any("Data Structure" in name for name in sub_names)
    print(f"  - Computer Networks present: {has_cn}")
    print(f"  - Data Structures present: {has_ds}")
    assert has_cn, "Computer Networks must be present in student performance!"
    assert has_ds, "Data Structures must be present in student performance!"
    # Check marks format
    for s in subjects:
        print(f"  Subject: {s['subject_name']} ({s['subject_code']})")
        print(f"    Assignments ({len(s['assignments'])}): total={s['assignment_total_obtained']}/{s['assignment_total_max']}, avg={s['assignment_average_display']}")
        print(f"    Experiments ({len(s['experiments'])}): total={s['experiment_total_obtained']}/{s['experiment_total_max']}, avg={s['experiment_average_display']}")
        print(f"    Special Docs ({len(s['special_documents'])})")

    # 3. Unified Academic Calendar
    print("\n--- 3. Testing Unified Academic Calendar ---")
    status, cal_student = get_json(f"{BASE_URL}/academic/calendar", student_token)
    assert status == 200, f"Expected 200, got {status}"
    print(f"Calendar events for student: {len(cal_student)} events")
    status, cal_fac = get_json(f"{BASE_URL}/academic/calendar", faculty_token)
    assert status == 200, f"Expected 200, got {status}"
    print(f"Calendar events for faculty: {len(cal_fac)} events")

    # 4. Student Academic Portfolio
    print("\n--- 4. Testing Student Academic Portfolio ---")
    status, port = get_json(f"{BASE_URL}/academic/student/portfolio", student_token)
    assert status == 200, f"Expected 200, got {status}"
    student_info = port.get("student", {})
    print(f"Portfolio retrieved for: {student_info.get('full_name')} ({student_info.get('roll_number')}), Branch: {student_info.get('branch_code')}, Year: {student_info.get('year_level')}")
    print(f"Current CGPA: {student_info.get('cgpa')}, Semester history records: {len(port.get('semester_history', []))}")
    assert student_info.get("roll_number") == "21CE101", f"Unexpected student roll: {student_info.get('roll_number')}"

    # 5. Promotion Window State Machine & Eligibility
    print("\n--- 5. Testing Promotion Window State Machine & Admin Controls ---")
    status, wins = get_json(f"{BASE_URL}/academic/promotions/windows", admin_token)
    assert status == 200, f"Expected 200, got {status}"
    print(f"Existing promotion windows: {len(wins)}")
    assert len(wins) > 0, "Expected at least 1 promotion window"
    win = wins[0]
    win_id = win["id"]
    print(f"Window: '{win['title']}' | Status: {win['status']} | is_open: {win['is_open']}")

    # 5a. Toggle window to CLOSED
    print("  -> Admin closing promotion window...")
    status, toggle_res = patch_json(f"{BASE_URL}/academic/promotions/windows/{win_id}/toggle", token=admin_token)
    assert status == 200
    print(f"  Window state after toggle: {toggle_res}")

    # 5b. Student checks window while closed
    status, stu_win = get_json(f"{BASE_URL}/academic/promotions/student-window", student_token)
    assert status == 200
    print(f"  Student window check while closed: has_window={stu_win.get('has_window')}, is_open={stu_win.get('window', {}).get('is_open') if stu_win.get('window') else False}")
    if stu_win.get("window"):
        assert not stu_win["window"]["is_open"], "Window should report is_open=False!"

    # 5c. Student attempts to apply when closed -> Should be REJECTED with 400
    print("  -> Student attempting to apply to closed window (expect 400 rejection)...")
    status, err_resp = post_json(f"{BASE_URL}/academic/promotions/apply", {"promotion_window_id": win_id, "cgpa": 9.15, "requested_division": "Div A", "requested_roll_number": "31CE101"}, student_token)
    print(f"  Closed application response: HTTP {status} detail='{err_resp.get('detail')}'")
    assert status == 400, f"Expected 400 rejection when closed, got {status}"

    # 5d. Admin reopens window
    print("  -> Admin reopening promotion window...")
    status, toggle_res2 = patch_json(f"{BASE_URL}/academic/promotions/windows/{win_id}/toggle", token=admin_token)
    assert status == 200
    print(f"  Window state after reopening: {toggle_res2}")

    # 5e. Student applies to open window -> Should succeed
    print("  -> Student applying to reopened window...")
    status, app_res = post_json(f"{BASE_URL}/academic/promotions/apply", {"promotion_window_id": win_id, "cgpa": 9.15, "requested_division": "Div A", "requested_roll_number": "31CE101"}, student_token)
    print(f"  Open application response: HTTP {status} res={app_res}")
    assert status == 200, f"Expected 200, got {status}: {app_res}"

    # 5f. Student attempts duplicate application -> Should be rejected with 400
    print("  -> Student attempting duplicate application (expect 400 rejection)...")
    status, dup_err = post_json(f"{BASE_URL}/academic/promotions/apply", {"promotion_window_id": win_id, "cgpa": 9.15, "requested_division": "Div A", "requested_roll_number": "31CE101"}, student_token)
    print(f"  Duplicate application response: HTTP {status} detail='{dup_err.get('detail')}'")
    assert status == 400, f"Expected 400 for duplicate application, got {status}"

    # 5g. Admin reviews request
    print("  -> Admin reviewing and approving promotion request...")
    status, reqs = get_json(f"{BASE_URL}/academic/promotions/requests?window_id={win_id}", admin_token)
    assert status == 200
    print(f"  Admin sees {len(reqs)} requests")
    target_req = [r for r in reqs if r["student_name"] == "Aarav Sharma"][0]
    status, rev_res = patch_json(f"{BASE_URL}/academic/promotions/requests/{target_req['id']}/review", {
        "status": "approved",
        "approved_division": "Div A",
        "approved_roll_number": "31CE101",
        "admin_remarks": "Approved promotion for high academic performance"
    }, admin_token)
    print(f"  Review response: HTTP {status} {rev_res}")
    assert status == 200

    # 6. Administration & Data Protection (Backup, CSV Export, Audit Logs)
    print("\n--- 6. Testing Admin Tools (Backup, CSV Export, Audit Logs) ---")
    status, backup_res = post_json(f"{BASE_URL}/academic/admin/backup-database", {}, admin_token)
    print(f"  Backup procedure: HTTP {status} -> {backup_res}")
    assert status == 200 and "backup_file" in backup_res

    status, logs = get_json(f"{BASE_URL}/academic/audit-logs", admin_token)
    print(f"  Audit logs: HTTP {status} -> {len(logs)} entries logged")
    assert status == 200 and len(logs) > 0

    # 7. Create a Special Document Task with flexible submission methods
    print("\n--- 7. Testing Flexible Special Document Submission Workflow ---")
    status, task_res = post_json(f"{BASE_URL}/tasks", {
        "title": "SE Capstone Project Review 1",
        "description": "Submit repository link or project documentation",
        "due_date": "2026-12-30T18:00:00Z",
        "subject_id": "sub_ce_302", # Computer Networks
        "task_category": "special_document",
        "doc_type": "Special Document",
        "max_score": 50,
        "allowed_methods": ["editor", "pdf", "docx", "other_files", "external_link"],
        "allow_multiple_methods": True,
        "max_file_size_mb": 25,
        "max_files_count": 5
    }, faculty_token)
    print(f"  Created task: HTTP {status} -> {task_res.get('id') if isinstance(task_res, dict) else task_res}")
    task_id = task_res["id"]

    # Student submits external link for this task
    print("  -> Student submitting external link (e.g. GitHub project repository)...")
    status, doc_res = post_json(f"{BASE_URL}/documents", {
        "title": "SE Capstone Distributed Network Protocol",
        "task_id": task_id,
        "content_html": "<p>Implementation of high-throughput reliable multicast protocol.</p>",
        "submission_method": "external_link",
        "external_link_url": "https://github.com/aaravsharma/distributed-protocol",
        "external_link_title": "Distributed Protocol GitHub Repo",
        "external_link_description": "Source code, unit tests, and performance benchmarks."
    }, student_token)
    print(f"  Document created: HTTP {status} -> {doc_res.get('id') if isinstance(doc_res, dict) else doc_res}")
    doc_id = doc_res["id"]

    status, sub_res = post_json(f"{BASE_URL}/submissions", {
        "task_id": task_id,
        "document_id": doc_id,
        "content_snapshot": "<p>Implementation of high-throughput reliable multicast protocol.</p>"
    }, student_token)
    print(f"  Submission response: HTTP {status} -> {sub_res.get('submission_id') if isinstance(sub_res, dict) else sub_res}")
    assert status in (200, 201)
    submission_id = sub_res["submission_id"]

    # Faculty evaluates special document
    status, eval_res = post_json(f"{BASE_URL}/evaluations", {
        "submission_id": submission_id,
        "score": 46.5,
        "feedback": "Outstanding distributed protocol implementation and architecture design.",
        "rubric_breakdown": {
            "System Architecture": 19.0,
            "Code Quality": 18.5,
            "Documentation": 9.0
        }
    }, faculty_token)
    print(f"  Faculty evaluation: HTTP {status} -> {eval_res}")
    assert status in (200, 201)

    # Check Student Performance again to verify Special Document is included in marks!
    status, updated_perf = get_json(f"{BASE_URL}/academic/student/academic-performance", student_token)
    updated_subs = updated_perf if isinstance(updated_perf, list) else updated_perf["subjects"]
    cn_sub = [s for s in updated_subs if "Computer Network" in s["subject_name"]][0]
    print(f"  Updated Computer Networks performance: Special Docs count = {len(cn_sub['special_documents'])}")
    assert len(cn_sub['special_documents']) == 1, "Expected 1 evaluated special document under Computer Networks"
    spec_item = cn_sub['special_documents'][0]
    print(f"  Special doc score: {spec_item['marks_obtained']} / {spec_item['max_marks']}")
    assert spec_item['marks_obtained'] == 46.5, "Expected 46.5 marks obtained!"

    # 8. Reset Demo Data safely
    print("\n--- 8. Testing Reset Demo Data to 10 Students, 3 Faculty, 0 Tasks ---")
    status, reset_res = post_json(f"{BASE_URL}/academic/admin/reset-demo-data", {}, admin_token)
    print(f"  Reset result: HTTP {status} -> {reset_res}")
    assert status == 200

    # Verify counts post-reset
    import sqlite3
    db = sqlite3.connect("C:/Users/Nimesh/.gemini/antigravity/scratch/writeuppro-antipaste/backend/writeuppro.db")
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

    print(f"  Post-reset DB state: Students={stu_cnt}, Faculty={fac_cnt}, Admins={adm_cnt}, Tasks={task_cnt}, Submissions={sub_cnt}")
    assert stu_cnt == 10, f"Expected 10 students, got {stu_cnt}"
    assert fac_cnt == 3, f"Expected 3 faculty, got {fac_cnt}"
    assert adm_cnt == 1, f"Expected 1 admin, got {adm_cnt}"
    assert task_cnt == 0, f"Expected 0 tasks, got {task_cnt}"
    assert sub_cnt == 0, f"Expected 0 submissions, got {sub_cnt}"

    print("\n=======================================================")
    print(">>> ALL 4 MODULE SUITES FULLY TESTED & VERIFIED! <<<")
    print("=======================================================")

if __name__ == "__main__":
    main()
