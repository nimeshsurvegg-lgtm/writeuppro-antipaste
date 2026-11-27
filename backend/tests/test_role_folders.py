import sys
import os
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

client = TestClient(app)

def get_auth_headers(username, password="password"):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_student_workspace_folders():
    headers = get_auth_headers("student")
    res = client.get("/api/v1/academic/student/workspace-folders", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # 1. Check priority submissions
    priority = data["priority_submissions"]
    assert len(priority) >= 2, "Expected pending priority submissions"

    # Verify rule 1 & 2: Nearest upcoming deadline appears first, due sooner appears above due later
    # Check that sorting is monotonic non-decreasing by due_date
    due_dates = [p["due_date"] for p in priority if p.get("due_date")]
    assert due_dates == sorted(due_dates), f"Priority submissions not sorted by due date: {due_dates}"

    # Verify rule 3: Multiple submissions with exact same deadline all displayed together
    # In seed_test_tasks, task_expt_1 and task_assign_dbms_2 share '2026-12-10T23:59:59Z'
    same_deadline_items = [p for p in priority if p.get("due_date") == "2026-12-10T23:59:59Z"]
    assert len(same_deadline_items) >= 2, "Expected multiple submissions with exact same deadline to both appear"

    # Verify rule: Submitted work excluded from pending priority unless resubmission required
    # task_assign_1 has a graded submission 'sub_sample_1' and should NOT be in pending priority
    assign1_pending = [p for p in priority if p["task_id"] == "task_assign_1" and p["submission_status"] in ("submitted", "graded")]
    assert len(assign1_pending) == 0, "Submitted work must be excluded from pending priority"

    # Verify indicators exist (Overdue, Due tomorrow, Due soon, etc.)
    indicators = [p["deadline_indicator"] for p in priority]
    assert any("Due" in ind or "Overdue" in ind for ind in indicators)

    # 2. Check subject folders
    subject_folders = data["subject_folders"]
    assert len(subject_folders) >= 1
    for sf in subject_folders:
        assert "subject_id" in sf
        assert "name" in sf
        assert "counts" in sf
        assert "assessments" in sf
        # Verify counts match assessments
        counts = sf["counts"]
        assert counts["total"] == len(sf["assessments"])
        assert counts["assignments"] == sum(1 for a in sf["assessments"] if a["task_type"] == "Assignment")
        assert counts["experiments"] == sum(1 for a in sf["assessments"] if a["task_type"] == "Experiment")

    # 3. Check submission history folder
    history = data["submission_history"]
    assert len(history) >= 1, "Expected completed submissions in history"
    for h in history:
        assert h["submission_status"] in ("submitted", "graded")

def test_faculty_teaching_folders():
    headers = get_auth_headers("faculty")
    res = client.get("/api/v1/academic/faculty/teaching-folders", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # 1. Pending evaluations queue
    eval_queue = data["pending_evaluations_queue"]
    assert len(eval_queue) >= 1, "Expected submissions in pending evaluations queue"
    # Strict sort: oldest pending submission first (created_at ASC)
    created_ats = [eq["created_at"] for eq in eval_queue]
    assert created_ats == sorted(created_ats), f"Evaluation queue not sorted by oldest first: {created_ats}"

    # 2. Overdue unsubmitted tasks
    overdue_tasks = data["overdue_unsubmitted_tasks"]
    assert isinstance(overdue_tasks, list)

    # 3. Class folders
    class_folders = data["class_folders"]
    assert len(class_folders) >= 1
    for cf in class_folders:
        assert "academic_group_id" in cf
        assert "class_name" in cf
        assert "assigned_subjects" in cf
        assert "assigned_batches" in cf
        assert "counts" in cf

def test_admin_class_folders_and_archives():
    headers = get_auth_headers("admin")

    # 1. Active year 2026-27
    res_active = client.get("/api/v1/academic/admin/class-folders?academic_year=2026-27", headers=headers)
    assert res_active.status_code == 200, res_active.text
    active_data = res_active.json()
    assert active_data["is_archived"] is False
    assert len(active_data["classes"]) >= 1

    first_class_id = active_data["classes"][0]["id"]

    # Class folder detail
    res_detail = client.get(f"/api/v1/academic/admin/class-folder-detail?academic_group_id={first_class_id}", headers=headers)
    assert res_detail.status_code == 200, res_detail.text
    detail = res_detail.json()
    assert "academic_group" in detail
    assert "students" in detail
    assert "faculty_allocations" in detail
    assert "batches" in detail
    assert "tasks" in detail
    assert "submission_stats" in detail

    # 2. Archived year 2025-26
    res_archived = client.get("/api/v1/academic/admin/class-folders?academic_year=2025-26", headers=headers)
    assert res_archived.status_code == 200, res_archived.text
    archived_data = res_archived.json()
    assert archived_data["is_archived"] is True
    assert len(archived_data["classes"]) >= 1

    archived_class_id = archived_data["classes"][0]["id"]
    res_archived_detail = client.get(f"/api/v1/academic/admin/class-folder-detail?academic_group_id={archived_class_id}", headers=headers)
    assert res_archived_detail.status_code == 200
    arch_detail = res_archived_detail.json()
    assert arch_detail["academic_group"]["is_archived"] is True

def test_folder_permissions_enforced_on_backend():
    student_headers = get_auth_headers("student")
    faculty_headers = get_auth_headers("faculty")

    # Student cannot access faculty teaching folders
    res1 = client.get("/api/v1/academic/faculty/teaching-folders", headers=student_headers)
    assert res1.status_code in (401, 403), "Student must not access faculty folders"

    # Student cannot access admin class folders
    res2 = client.get("/api/v1/academic/admin/class-folders", headers=student_headers)
    assert res2.status_code in (401, 403), "Student must not access admin class folders"

    # Faculty cannot access admin class folders
    res3 = client.get("/api/v1/academic/admin/class-folders", headers=faculty_headers)
    assert res3.status_code in (401, 403), "Faculty must not access admin class folders"
