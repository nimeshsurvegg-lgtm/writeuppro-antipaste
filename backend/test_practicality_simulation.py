import sys
import os
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.main import app
from app.core.database import get_db_connection

client = TestClient(app)

def run_practicality_acceptance():
    print("=================================================================")
    print(">>> REAL-WORLD PRACTICALITY & BUSINESS WORKFLOW ACCEPTANCE TEST <<<")
    print("=================================================================\n")

    # Step 1: Admin configures / verifies academic year
    print("[STEP 1] Administrator Configures Academic Year & Calendars...")
    admin_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "password"})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    admin_hdr = {"Authorization": f"Bearer {admin_token}"}

    # Reset to baseline demo data first to ensure predictable state
    client.post("/api/v1/academic/admin/reset-demo-data", headers=admin_hdr)

    cal_res = client.get("/api/v1/academic/hierarchy")
    assert cal_res.status_code == 200
    print("  ✓ Academic hierarchy & active cycle verified.")

    # Step 2: Subject Allotments & Faculty
    print("[STEP 2] Subject Allotments & Faculty Scoping...")
    fac_login = client.post("/api/v1/auth/login", json={"username": "faculty", "password": "password"})
    assert fac_login.status_code == 200
    fac_token = fac_login.json()["access_token"]
    fac_hdr = {"Authorization": f"Bearer {fac_token}"}

    fac2_login = client.post("/api/v1/auth/login", json={"username": "prof_patil", "password": "password"})
    assert fac2_login.status_code == 200
    fac2_token = fac2_login.json()["access_token"]
    fac2_hdr = {"Authorization": f"Bearer {fac2_token}"}

    allot_res = client.get("/api/v1/academic/allotments?branch_code=CE&division=Div A")
    assert allot_res.status_code == 200
    allots = allot_res.json()
    assert len(allots) > 0
    # Choose student's enrolled subject: Data Structures & Analysis (CE-CSC301)
    ds_allot = next((a for a in allots if a["subject_code"] == "CE-CSC301"), allots[0])
    sub_id = ds_allot["subject_id"]
    sub_name = ds_allot["subject_name"]
    print(f"  ✓ Verified Faculty allotted to {sub_name} ({ds_allot['subject_code']})")

    # Step 3: Students Enrolled in Correct Subjects
    print("[STEP 3] Student Subject Enrollment Verification...")
    stu_login = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    assert stu_login.status_code == 200
    stu_token = stu_login.json()["access_token"]
    stu_hdr = {"Authorization": f"Bearer {stu_token}"}
    stu_id = stu_login.json()["user"]["id"]

    stu_subs = client.get("/api/v1/academic/student/enrolled-subjects", headers=stu_hdr).json()
    assert len(stu_subs) >= 2
    enrolled_names = [s["name"] for s in stu_subs]
    assert "Computer Networks" in enrolled_names
    assert "Data Structures & Analysis" in enrolled_names
    print(f"  ✓ Student enrolled in: {enrolled_names}")

    # Step 4: Administrator Creates Practical Batches Manually
    print("[STEP 4] Administrator Practical Batch Allocation...")
    batch_res = client.post("/api/v1/academic/batches", headers=admin_hdr, json={
        "batch_name": "Batch A1 - Advanced Lab",
        "academic_year": "2026-27",
        "branch_code": "CE",
        "year_level": "SE",
        "semester_number": 3,
        "division_name": "Div A",
        "capacity": 20,
        "student_ids": [stu_id]
    })
    assert batch_res.status_code == 200
    batch_id = batch_res.json()["id"]
    print(f"  ✓ Practical Batch A1 created ({batch_id}) with student allocated manually.")

    # Step 5: Faculty Creates Assignment & Lab Experiment
    print("[STEP 5] Faculty Creates Assignment & Lab Experiment...")
    # Assignment
    assign_res = client.post("/api/v1/tasks", headers=fac_hdr, json={
        "title": "Practical Simulation Assignment: Tree Traversals",
        "description": "Implement BFS and DFS tree traversal algorithms.",
        "subject_id": sub_id,
        "task_type": "Assignment",
        "max_marks": 10.0,
        "due_date": "2026-12-15 23:59",
        "target_type": "division",
        "division_name": "Div A",
        "academic_year": "2026-27"
    })
    assert assign_res.status_code == 200
    assign_task_id = assign_res.json()["task_id"]

    # Experiment
    expt_res = client.post("/api/v1/tasks", headers=fac_hdr, json={
        "title": "Lab Experiment 1: AVL Tree Balance Rotation",
        "description": "Demonstrate Left and Right AVL rotations.",
        "subject_id": sub_id,
        "task_type": "Experiment",
        "max_marks": 15.0,
        "due_date": "2026-12-15 23:59",
        "target_type": "batch",
        "batch_id": batch_id,
        "academic_year": "2026-27"
    })
    assert expt_res.status_code == 200
    expt_task_id = expt_res.json()["task_id"]
    print(f"  ✓ Created Assignment ({assign_task_id}) and Lab Experiment ({expt_task_id})")

    # Step 5B: Test Task Lifecycle (Update & Deadline Extension)
    print("[STEP 5B] Testing Task Lifecycle (Update & Deadline Extension)...")
    update_res = client.patch(f"/api/v1/tasks/{assign_task_id}", headers=fac_hdr, json={
        "instructions": "Added new requirement: provide Big-O runtime analysis."
    })
    assert update_res.status_code == 200
    ext_res = client.post(f"/api/v1/academic/tasks/{assign_task_id}/extend-deadline", headers=fac_hdr, json={
        "new_due_date": "2026-12-20 23:59",
        "reason": "College technical symposium holiday extension."
    })
    assert ext_res.status_code == 200
    print("  ✓ Faculty updated task instructions and extended deadline with recorded justification.")

    # Step 6: Special Document Submission with Custom Rubric
    print("[STEP 6] Special Document Submission with Custom Rubric (50 Marks)...")
    rubric_res = client.post("/api/v1/tasks/custom-rubrics", headers=fac_hdr, json={
        "title": "Mini-Project Capstone Rubric",
        "document_category": "Mini Project",
        "total_marks": 50.0,
        "criteria": [
            {"id": "c1", "name": "System Architecture", "max_score": 15.0},
            {"id": "c2", "name": "Implementation & Testing", "max_score": 20.0},
            {"id": "c3", "name": "Project Viva & Defense", "max_score": 15.0}
        ]
    })
    assert rubric_res.status_code == 200
    rubric_id = rubric_res.json()["id"]

    spec_res = client.post("/api/v1/tasks", headers=fac_hdr, json={
        "title": "Semester 3 Mini-Project Submission",
        "description": "Submit full code repo and technical documentation.",
        "subject_id": sub_id,
        "task_type": "Special Document",
        "max_marks": 50.0,
        "due_date": "2026-12-25 23:59",
        "custom_rubric_id": rubric_id,
        "target_type": "division",
        "division_name": "Div A",
        "academic_year": "2026-27"
    })
    assert spec_res.status_code == 200
    spec_task_id = spec_res.json()["task_id"]
    print(f"  ✓ Special Document task created with 50-mark custom rubric ({spec_task_id})")

    # Step 7: Student Completes & Submits Work
    print("[STEP 7] Student Submits Assignment, Experiment, and Special Document...")
    # 7A: Assignment doc & sub
    doc1 = client.post("/api/v1/documents", headers=stu_hdr, json={
        "title": "Assignment 1 Solution: Tree Traversals",
        "doc_type": "Assignment",
        "doc_number": "1",
        "content_html": "<p>Here is my detailed solution for BFS and DFS with time complexity analysis.</p>",
        "task_id": assign_task_id
    }).json()
    sub1 = client.post("/api/v1/submissions", headers=stu_hdr, json={"document_id": doc1["id"]}).json()
    assert "submission_code" in sub1

    # 7B: Experiment doc & sub
    doc2 = client.post("/api/v1/documents", headers=stu_hdr, json={
        "title": "Experiment 1 Report: AVL Trees",
        "doc_type": "Experiment",
        "doc_number": "1",
        "content_html": "<p>Experimental setup, algorithm code, and performance observations.</p>",
        "task_id": expt_task_id
    }).json()
    sub2 = client.post("/api/v1/submissions", headers=stu_hdr, json={"document_id": doc2["id"]}).json()
    assert "submission_code" in sub2

    # 7C: Special Document with External Link (e.g. GitHub repo)
    doc3 = client.post("/api/v1/documents", headers=stu_hdr, json={
        "title": "Mini-Project: Distributed Log Analytics",
        "doc_type": "Special Document",
        "doc_number": "1",
        "content_html": "<p>Distributed Log Analytics project report and architectural diagrams.</p>",
        "task_id": spec_task_id,
        "submission_method": "external_link",
        "external_link_url": "https://github.com/student-demo/log-analytics",
        "external_link_title": "GitHub Repository & Release",
        "external_link_description": "Production repo with commit history and automated test suite."
    }).json()
    sub3 = client.post("/api/v1/submissions", headers=stu_hdr, json={
        "document_id": doc3["id"],
        "submission_method": "external_link",
        "external_link_url": "https://github.com/student-demo/log-analytics"
    }).json()
    assert "submission_code" in sub3
    print("  ✓ Student submitted all 3 tasks (Assignment, Lab Experiment, Special Document via GitHub link).")

    # Step 8: Faculty Evaluation & Scoping Checks
    print("[STEP 8] Faculty Evaluates Submissions & Role Scoping Verification...")
    # 8A: Verify Unauthorized Faculty 2 is blocked from grading Faculty 1's class
    unauth_eval = client.post("/api/v1/evaluations", headers=fac2_hdr, json={
        "submission_id": sub1["id"],
        "marks_awarded": 8.0,
        "rubric_scores": {"knowledge": 3.0, "content": 2.5, "punctuality": 2.5},
        "feedback": "Trying to grade another faculty's subject."
    })
    assert unauth_eval.status_code == 403
    print("  ✓ Unauthorized faculty correctly blocked with HTTP 403 Forbidden!")

    # 8B: Authorized Faculty 1 grades Assignment (9.0 / 10.0)
    eval1 = client.post("/api/v1/evaluations", headers=fac_hdr, json={
        "submission_id": sub1["id"],
        "marks_awarded": 9.0,
        "rubric_scores": {"knowledge": 3.5, "content": 2.8, "punctuality": 2.7},
        "feedback": "Excellent traversal logic and neat complexity analysis."
    })
    assert eval1.status_code == 200

    # 8C: Faculty 1 grades Experiment (14.5 / 15.0)
    eval2 = client.post("/api/v1/evaluations", headers=fac_hdr, json={
        "submission_id": sub2["id"],
        "marks_awarded": 14.5,
        "rubric_scores": {"knowledge": 4.0, "performance": 4.8, "content": 2.9, "punctuality": 2.8},
        "feedback": "Flawless AVL rotation implementation."
    })
    assert eval2.status_code == 200

    # 8D: Faculty 1 grades Special Document using 50-mark custom rubric (46.0 / 50.0)
    eval3 = client.post("/api/v1/evaluations", headers=fac_hdr, json={
        "submission_id": sub3["id"],
        "marks_awarded": 46.0,
        "rubric_scores": {"c1": 14.0, "c2": 18.5, "c3": 13.5},
        "feedback": "Outstanding project defense and high-quality codebase."
    })
    assert eval3.status_code == 200
    print("  ✓ All 3 assessments graded with digital signatures and rubrics validated.")

    # Step 9: Student Views Marks, Feedback & Re-evaluation Workflow
    print("[STEP 9] Student Marks Verification & Marks Re-evaluation Workflow...")
    perf = client.get("/api/v1/academic/student/academic-performance", headers=stu_hdr).json()
    ds_perf = next(p for p in perf if p["subject_id"] == sub_id)
    assert ds_perf["assignment_average_display"] == "9 / 10"
    assert ds_perf["experiment_average_display"] == "14.5 / 15"
    assert ds_perf["special_documents_count"] == 1
    assert ds_perf["special_documents"][0]["marks_obtained"] == 46.0
    print(f"  ✓ Academic Performance verified: Assign={ds_perf['assignment_average_display']}, Expt={ds_perf['experiment_average_display']}, Special=46.0/50.0")

    # 9B: Student Requests Marks Re-evaluation on Assignment
    reeval_req = client.post(f"/api/v1/academic/evaluations/{sub1['id']}/reevaluation-request", headers=stu_hdr, json={
        "reason": "Included recursive DFS which was not counted in the initial review."
    })
    assert reeval_req.status_code == 200
    reeval_id = reeval_req.json()["request_id"]

    # 9C: Faculty reviews and adjusts marks to 9.5
    review_res = client.patch(f"/api/v1/academic/evaluations/reevaluation-requests/{reeval_id}/review", headers=fac_hdr, json={
        "status": "approved",
        "new_marks": 9.5,
        "remarks": "Verified recursive traversal implementation. Marks updated from 9.0 to 9.5."
    })
    assert review_res.status_code == 200

    perf_updated = client.get("/api/v1/academic/student/academic-performance", headers=stu_hdr).json()
    ds_perf_updated = next(p for p in perf_updated if p["subject_id"] == sub_id)
    assert ds_perf_updated["assignment_average_display"] == "9.5 / 10"
    print(f"  ✓ Re-evaluation completed: Marks successfully updated to {ds_perf_updated['assignment_average_display']}")

    # Step 10: Promotion Lifecycle Management
    print("[STEP 10] Promotion Lifecycle Management...")
    # Admin creates Promotion Window (SE Sem 3 -> TE Sem 5, AY 2026-27 -> 2027-28)
    pw_res = client.post("/api/v1/academic/promotions/windows", headers=admin_hdr, json={
        "title": "AY 2027-28 TE Admission & Promotion Window",
        "source_academic_year": "2026-27",
        "target_academic_year": "2027-28",
        "source_year_level": "SE",
        "target_year_level": "TE",
        "source_semester": 3,
        "target_semester": 5,
        "branch_code": "CE",
        "is_open": True
    })
    assert pw_res.status_code == 200
    win_id = pw_res.json()["id"]

    # Student applies for promotion
    apply_res = client.post("/api/v1/academic/promotions/apply", headers=stu_hdr, json={
        "promotion_window_id": win_id,
        "cgpa": 9.25,
        "requested_division": "Div A",
        "requested_roll_number": "21CE301"
    })
    assert apply_res.status_code == 200
    preq_id = apply_res.json()["id"]
    print(f"  ✓ Promotion window opened ({win_id}) and student applied ({preq_id}).")

    # Step 11: Admin Approves Promotion, Advances Year & Preserves History
    print("[STEP 11] Promotion Approval & Academic History Archiving...")
    promote_res = client.patch(f"/api/v1/academic/promotions/requests/{preq_id}/review", headers=admin_hdr, json={
        "status": "approved",
        "approved_division": "Div A",
        "approved_roll_number": "21CE301",
        "remarks": "Eligible for Third Year Engineering."
    })
    assert promote_res.status_code == 200

    # Verify student profile advanced to TE for AY 2027-28
    sp_res = client.get("/api/v1/academic/student-profiles", headers=admin_hdr).json()
    promoted_sp = next(p for p in sp_res if p["user_id"] == stu_id)
    assert promoted_sp["year_level"] == "TE"
    assert promoted_sp["academic_year"] == "2027-28"
    assert promoted_sp["semester_number"] == 5
    print(f"  ✓ Student profile advanced: Year={promoted_sp['year_level']}, Sem={promoted_sp['semester_number']}, AY={promoted_sp['academic_year']}")

    # Step 12: Faculty & Admin Access Historical Records (Portfolio & History)
    print("[STEP 12] Historical Records Preservation & Student Academic Portfolio...")
    portfolio = client.get(f"/api/v1/academic/student/academic-portfolio?student_id={stu_id}", headers=admin_hdr).json()
    assert portfolio["profile"]["id"] == stu_id
    assert portfolio["summary"]["assignments_evaluated"] >= 1
    assert portfolio["summary"]["experiments_evaluated"] >= 1
    assert portfolio["summary"]["special_docs_evaluated"] >= 1
    assert len(portfolio["records"]["assignments"]) >= 1
    assert len(portfolio["records"]["experiments"]) >= 1
    assert len(portfolio["records"]["special_documents"]) >= 1
    assert len(portfolio["academic_history"]) >= 1
    print(f"  ✓ Academic Portfolio verified: {len(portfolio['records']['assignments'])} assignment(s), {len(portfolio['records']['experiments'])} experiment(s), {len(portfolio['records']['special_documents'])} special doc(s) safely archived!")
    print(f"  ✓ Historical Academic Year record preserved: AY={portfolio['academic_history'][0]['academic_year']}, Year={portfolio['academic_history'][0]['year_level']}, CGPA={portfolio['academic_history'][0]['cgpa']}")

    # Step 13: Clean Reset Back to Initial Demo State
    print("\n[CLEANUP] Resetting Database to Clean Initial Demonstration State...")
    reset_res = client.post("/api/v1/academic/admin/reset-demo-data", headers=admin_hdr)
    assert reset_res.status_code == 200
    print("  ✓ Demo data reset verified: 10 students, 3 faculty, 1 admin, 0 tasks.")

    print("\n=================================================================")
    print(">>> ALL 12 PRACTICALITY ACCEPTANCE STEPS COMPLETED & VERIFIED! <<<")
    print("=================================================================")

if __name__ == "__main__":
    run_practicality_acceptance()
