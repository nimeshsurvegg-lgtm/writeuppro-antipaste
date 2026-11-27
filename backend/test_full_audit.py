import os
import sys
import json
import sqlite3

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def login(username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    if res.status_code != 200:
        raise Exception(f"Login failed for {username}: {res.status_code} {res.text}")
    return res.json()["access_token"]

def main():
    print("=================================================================")
    print(">>> COMPLETE APPLICATION AUDIT & REGRESSION TEST SUITE <<<")
    print("=================================================================")

    # -------------------------------------------------------------
    # SUITE 1: AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
    # -------------------------------------------------------------
    print("\n[SUITE 1] Testing Authentication, Bad Logins & Role Restrictions...")
    
    # 1a. Invalid credentials
    bad_res = client.post("/api/v1/auth/login", json={"username": "student", "password": "wrongpassword"})
    assert bad_res.status_code == 401, f"Expected 401 for bad password, got {bad_res.status_code}"
    print("  ✓ Invalid password correctly rejected (401)")

    bad_user_res = client.post("/api/v1/auth/login", json={"username": "nonexistent_user", "password": "password"})
    assert bad_user_res.status_code == 401, f"Expected 401 for unknown user, got {bad_user_res.status_code}"
    print("  ✓ Non-existent user correctly rejected (401)")

    # 1b. Valid logins
    admin_token = login("admin", "password")
    faculty_token = login("faculty", "password")
    student_token = login("student", "password")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    faculty_headers = {"Authorization": f"Bearer {faculty_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("  ✓ Valid logins succeeded for Admin, Faculty, and Student")

    # 1c. Unauthorized role attempts (student accessing admin endpoint)
    unauth_res = client.post("/api/v1/academic/admin/backup-database", headers=student_headers)
    assert unauth_res.status_code == 403, f"Expected 403 for student accessing admin backup, got {unauth_res.status_code}"
    print("  ✓ Student blocked from Admin database backup (403 Forbidden)")

    unauth_fac_res = client.post("/api/v1/academic/admin/backup-database", headers=faculty_headers)
    assert unauth_fac_res.status_code == 403, f"Expected 403 for faculty accessing admin backup, got {unauth_fac_res.status_code}"
    print("  ✓ Faculty blocked from Admin database backup (403 Forbidden)")

    unauth_stu_promo = client.get("/api/v1/academic/promotions/windows", headers=student_headers)
    assert unauth_stu_promo.status_code == 403, f"Expected 403 for student accessing admin windows, got {unauth_stu_promo.status_code}"
    print("  ✓ Student blocked from Admin promotion windows list (403 Forbidden)")

    # -------------------------------------------------------------
    # SUITE 2: PRISTINE DEMO RESET & VERIFICATION OF DATA ROSTER
    # -------------------------------------------------------------
    print("\n[SUITE 2] Testing Demo Data Cleanup & Exact Roster Count Verification...")
    res = client.post("/api/v1/academic/admin/reset-demo-data", headers=admin_headers)
    assert res.status_code == 200

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
    c.execute("SELECT COUNT(*) FROM evaluations;")
    eval_cnt = c.fetchone()[0]
    db.close()

    print(f"  Exact counts: Students={stu_cnt}, Faculty={fac_cnt}, Admins={adm_cnt}, Tasks={task_cnt}, Submissions={sub_cnt}, Evaluations={eval_cnt}")
    assert stu_cnt == 10, f"Expected 10 students, got {stu_cnt}"
    assert fac_cnt == 3, f"Expected 3 faculty, got {fac_cnt}"
    assert adm_cnt == 1, f"Expected 1 admin, got {adm_cnt}"
    assert task_cnt == 0, f"Expected 0 tasks, got {task_cnt}"
    assert sub_cnt == 0, f"Expected 0 submissions, got {sub_cnt}"
    assert eval_cnt == 0, f"Expected 0 evaluations, got {eval_cnt}"
    print("  ✓ Exactly 10 Students, 3 Faculty, 1 Admin preserved, ZERO tasks/submissions/evaluations verified!")

    # -------------------------------------------------------------
    # SUITE 3: STUDENT SUBJECT-WISE PERFORMANCE (MARKS VS PERCENTAGE)
    # -------------------------------------------------------------
    print("\n[SUITE 3] Testing Subject-wise Academic Performance Calculation & Missing Subject Fix...")
    res = client.get("/api/v1/academic/student/academic-performance", headers=student_headers)
    assert res.status_code == 200
    perf = res.json()
    sub_names = [s["subject_name"] for s in perf]
    print(f"  Enrolled subjects: {sub_names}")
    assert any("Computer Network" in n for n in sub_names), "Computer Networks missing!"
    assert any("Data Structure" in n for n in sub_names), "Data Structures missing!"
    for s in perf:
        assert s["assignment_average_display"] == "No marks yet"
        assert s["experiment_average_display"] == "No marks yet"
        assert s["assignment_total_obtained"] == 0
        assert s["experiment_total_obtained"] == 0
        assert len(s["special_documents"]) == 0
    print("  ✓ Both Computer Networks & Data Structures present with clean 'No marks yet' state")

    # -------------------------------------------------------------
    # SUITE 4: ASSIGNMENTS WORKFLOW (CREATION, SUBMISSION & EVALUATION)
    # -------------------------------------------------------------
    print("\n[SUITE 4] Testing Standard Assignment Workflow (10 Marks Max)...")
    ds_sub = [s for s in perf if "Data Structure" in s["subject_name"]][0]
    ds_sub_id = ds_sub["subject_id"]

    # Faculty creates assignment
    res = client.post("/api/v1/tasks", json={
        "title": "Assignment 1: AVL Trees & Graph Traversal",
        "subject_id": ds_sub_id,
        "task_type": "Assignment",
        "task_number": "1",
        "max_marks": 10.0,
        "due_date": "2026-12-25T23:59:59Z",
        "description": "Implement AVL tree self-balancing rotations."
    }, headers=faculty_headers)
    assert res.status_code == 200
    assign_task_id = res.json().get("id") or res.json().get("task_id")
    print(f"  ✓ Assignment created: {assign_task_id}")

    # Student drafts and submits document
    res = client.post("/api/v1/documents", json={
        "title": "AVL Trees Implementation Report",
        "task_id": assign_task_id,
        "content_html": "<p>AVL trees maintain height balance factor of -1, 0, or 1 through single and double rotations.</p>",
        "word_count": 18
    }, headers=student_headers)
    assert res.status_code == 200
    assign_doc_id = res.json()["id"]

    res = client.post("/api/v1/submissions", json={
        "task_id": assign_task_id,
        "document_id": assign_doc_id,
        "content_snapshot": "<p>AVL trees maintain height balance factor of -1, 0, or 1 through single and double rotations.</p>"
    }, headers=student_headers)
    assert res.status_code in (200, 201)
    assign_sub_id = res.json()["submission_id"]
    print(f"  ✓ Assignment submitted: {assign_sub_id}")

    # Faculty grades assignment (8.5 / 10.0)
    res = client.post("/api/v1/evaluations", json={
        "submission_id": assign_sub_id,
        "marks_awarded": 8.5,
        "remarks": "Clean rotation logic and good time complexity analysis.",
        "rubric_scores": {"Content & Logic": 8.5}
    }, headers=faculty_headers)
    assert res.status_code in (200, 201)
    print(f"  ✓ Assignment evaluated: 8.5 / 10.0")

    # -------------------------------------------------------------
    # SUITE 5: EXPERIMENTS WORKFLOW (MANUAL BATCH, SUBMISSION & EVALUATION)
    # -------------------------------------------------------------
    print("\n[SUITE 5] Testing Laboratory Experiment Workflow (15 Marks Max & Batch Allocation)...")
    c_db = sqlite3.connect(db_path)
    cur = c_db.cursor()
    cur.execute("SELECT id FROM users WHERE role='faculty' LIMIT 1;")
    fac_user_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM users WHERE username='student';")
    stu_id = cur.fetchone()[0]
    c_db.close()

    # Admin creates manual lab batch
    res = client.post("/api/v1/academic/batches", json={
        "batch_name": "Batch A1 - Advanced Networks",
        "academic_year": "2026-27",
        "branch_code": "CE",
        "year_level": "SE",
        "semester_number": 3,
        "division_name": "Div A",
        "subject_id": ds_sub_id,
        "faculty_id": fac_user_id,
        "max_capacity": 20
    }, headers=admin_headers)
    assert res.status_code in (200, 201)
    batch_id = res.json()["id"]
    print(f"  ✓ Manual Lab Batch created: {batch_id}")

    res = client.post("/api/v1/academic/batches/manual-assign", json={
        "batch_id": batch_id,
        "student_ids": [stu_id]
    }, headers=admin_headers)
    assert res.status_code == 200
    print(f"  ✓ Student manually allocated to batch")

    # Faculty creates experiment
    res = client.post("/api/v1/tasks", json={
        "title": "Experiment 1: Socket Programming & TCP Handshake",
        "subject_id": ds_sub_id,
        "task_type": "Experiment",
        "task_number": "1",
        "max_marks": 15.0,
        "due_date": "2026-12-25T23:59:59Z",
        "description": "Establish three-way TCP handshake over client-server sockets."
    }, headers=faculty_headers)
    assert res.status_code == 200
    expt_task_id = res.json().get("id") or res.json().get("task_id")
    print(f"  ✓ Experiment created: {expt_task_id}")

    # Student submits experiment
    res = client.post("/api/v1/documents", json={
        "title": "TCP Sockets Experiment Writeup",
        "task_id": expt_task_id,
        "content_html": "<p>Server socket bound to port 8080. Client initiates SYN packet followed by SYN-ACK.</p>",
        "word_count": 16
    }, headers=student_headers)
    assert res.status_code == 200
    expt_doc_id = res.json()["id"]

    res = client.post("/api/v1/submissions", json={
        "task_id": expt_task_id,
        "document_id": expt_doc_id,
        "content_snapshot": "<p>Server socket bound to port 8080. Client initiates SYN packet followed by SYN-ACK.</p>"
    }, headers=student_headers)
    assert res.status_code in (200, 201)
    expt_sub_id = res.json()["submission_id"]

    # Faculty grades experiment (14.0 / 15.0)
    res = client.post("/api/v1/evaluations", json={
        "submission_id": expt_sub_id,
        "marks_awarded": 14.0,
        "remarks": "Excellent socket handling and Wireshark trace analysis.",
        "rubric_scores": {"Practical Execution": 14.0}
    }, headers=faculty_headers)
    assert res.status_code in (200, 201)
    print(f"  ✓ Experiment evaluated: 14.0 / 15.0")

    # -------------------------------------------------------------
    # SUITE 6: VERIFY PERFORMANCE SEPARATION (ASSIGNMENT VS EXPERIMENT)
    # -------------------------------------------------------------
    print("\n[SUITE 6] Verifying Academic Marks Separation...")
    res = client.get("/api/v1/academic/student/academic-performance", headers=student_headers)
    assert res.status_code == 200
    ds_perf = [s for s in res.json() if s["subject_id"] == ds_sub_id][0]
    print(f"  Data Structures Performance:")
    print(f"    - Assignment Average: {ds_perf['assignment_average_display']} (Total: {ds_perf['assignment_total_obtained']}/{ds_perf['assignment_total_max']})")
    print(f"    - Experiment Average: {ds_perf['experiment_average_display']} (Total: {ds_perf['experiment_total_obtained']}/{ds_perf['experiment_total_max']})")
    assert ds_perf["assignment_average_display"] == "8.5 / 10", f"Unexpected assignment avg: {ds_perf['assignment_average_display']}"
    assert ds_perf["experiment_average_display"] == "14 / 15", f"Unexpected experiment avg: {ds_perf['experiment_average_display']}"
    assert ds_perf["assignment_total_obtained"] == 8.5
    assert ds_perf["experiment_total_obtained"] == 14.0
    print("  ✓ Assignment and Experiment marks strictly separated and displayed in actual marks!")

    # -------------------------------------------------------------
    # SUITE 7: PROMOTION REJECTION & PRESERVATION OF ACADEMIC HISTORY
    # -------------------------------------------------------------
    print("\n[SUITE 7] Testing Promotion Window Rejection Workflow...")
    res = client.get("/api/v1/academic/promotions/windows", headers=admin_headers)
    win_id = res.json()[0]["id"]

    # Student applies
    res = client.post("/api/v1/academic/promotions/apply", json={
        "promotion_window_id": win_id,
        "cgpa": 7.5,
        "requested_division": "Div A",
        "requested_roll_number": "31CE199"
    }, headers=student_headers)
    assert res.status_code == 200
    p_req_id = res.json()["id"]

    # Admin rejects
    res = client.patch(f"/api/v1/academic/promotions/requests/{p_req_id}/review", json={
        "status": "rejected",
        "admin_remarks": "Insufficient credits in prerequisite courses."
    }, headers=admin_headers)
    assert res.status_code == 200
    print(f"  ✓ Admin rejected promotion request: {res.json()['message']}")

    # Verify student placement remains unchanged in SE
    res = client.get("/api/v1/academic/student/portfolio", headers=student_headers)
    assert res.status_code == 200
    assert res.json()["profile"]["year_level"] == "SE", "Student year should remain SE after rejection!"
    print(f"  ✓ Student year level remained SE (preserved) after rejection")

    # -------------------------------------------------------------
    # SUITE 8: SECURITY - ATTACHMENT BLOCKED EXTENSIONS
    # -------------------------------------------------------------
    print("\n[SUITE 8] Testing File Upload Security & Extension Sanitization...")
    # Student attempts to upload dangerous executable (.exe)
    res = client.post(
        "/api/v1/special-submissions/upload",
        data={"task_id": assign_task_id},
        files={"file": ("malicious_payload.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")},
        headers=student_headers
    )
    print(f"  Upload of .exe file: HTTP {res.status_code} -> {res.json().get('detail')}")
    assert res.status_code == 400
    assert "blocked by academic security policy" in res.json().get("detail", "").lower()
    print("  ✓ Unsafe executable format (.exe) securely blocked by academic security filter!")

    # -------------------------------------------------------------
    # SUITE 9: RESET DEMO DATA POST-AUDIT
    # -------------------------------------------------------------
    print("\n[SUITE 9] Safe Reset to Final Clean Demonstration State...")
    res = client.post("/api/v1/academic/admin/reset-demo-data", headers=admin_headers)
    assert res.status_code == 200
    print("  ✓ Final clean demo reset successful!")

    print("\n=================================================================")
    print(">>> ALL 9 AUDIT SUITES PASSED WITH 100% SUCCESS! <<<")
    print("=================================================================")

if __name__ == "__main__":
    main()
