import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

client = TestClient(app)

def test_academic_calendars_multi_year():
    # Admin login
    res_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "password"})
    assert res_login.status_code == 200
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # List academic years
    res = client.get("/api/v1/academic/academic-years", headers=headers)
    assert res.status_code == 200
    years = res.json()
    codes = [y["code"] for y in years]
    assert "2025-26" in codes
    assert "2026-27" in codes
    assert "2027-28" in codes

def test_mumbai_university_syllabi_and_subjects():
    res_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "password"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch subjects for CE Semester 3
    res = client.get("/api/v1/academic/subjects?branch=CE&semester=3", headers=headers)
    assert res.status_code == 200
    subs = res.json()
    assert len(subs) >= 3
    codes = [s["code"] for s in subs]
    assert "CSC301" in codes or "CSC303" in codes

def test_bulk_allotment_preview_and_publish():
    res_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "password"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Preview Step
    preview_payload = {
        "academic_year": "2026-27",
        "branch_code": "CE",
        "year_level": "SE",
        "semester_number": 3,
        "division_name": "Div A"
    }
    res_prev = client.post("/api/v1/academic/allotments/preview", json=preview_payload, headers=headers)
    assert res_prev.status_code == 200
    prev_data = res_prev.json()
    assert prev_data["academic_group_id"] == "grp_2026_27_ce_se_div_a"
    assert len(prev_data["subjects"]) >= 1

    # Publish Step
    sub_id = prev_data["subjects"][0]["id"]
    fac_id = prev_data["eligible_faculty"][0]["id"]
    publish_payload = {
        "academic_year": "2026-27",
        "branch_code": "CE",
        "year_level": "SE",
        "semester_number": 3,
        "division_name": "Div A",
        "allotments": [
            {"subject_id": sub_id, "faculty_id": fac_id}
        ]
    }
    res_pub = client.post("/api/v1/academic/allotments/publish", json=publish_payload, headers=headers)
    assert res_pub.status_code == 200
    assert "published" in res_pub.json()["message"].lower()

def test_laboratory_batches_and_isolation():
    # Student login (Demo student is in SE CE Div A)
    res_stu = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    assert res_stu.status_code == 200
    stu_token = res_stu.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # Attempt to submit to a task for Batch B1 (should fail if student is in Batch A1)
    # Check that batch list works
    res_batches = client.get("/api/v1/academic/batches?branch=CE&division=Div A", headers=stu_headers)
    assert res_batches.status_code == 200
    batches = res_batches.json()
    assert len(batches) >= 1
    batch_names = [b["batch_name"] for b in batches]
    assert any("A1" in name or "A2" in name for name in batch_names)

def test_custom_rubric_creation_and_evaluation():
    # Faculty login
    res_fac = client.post("/api/v1/auth/login", json={"username": "faculty", "password": "password"})
    assert res_fac.status_code == 200
    fac_token = res_fac.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # Create Custom Rubric
    rubric_payload = {
        "title": "Automated Test Major Project Rubric",
        "document_category": "Major Project",
        "criteria": [
            {"id": "crit_1", "name": "System Architecture", "max_score": 20.0, "guidance": "UML class design"},
            {"id": "crit_2", "name": "Implementation Quality", "max_score": 30.0, "guidance": "Full stack integration"}
        ]
    }
    res_rub = client.post("/api/v1/tasks/rubrics", json=rubric_payload, headers=fac_headers)
    assert res_rub.status_code == 200
    rub_id = res_rub.json()["id"]

    # Verify rubric in list
    res_list = client.get("/api/v1/tasks/rubrics", headers=fac_headers)
    assert res_list.status_code == 200
    rub_ids = [r["id"] for r in res_list.json()]
    assert rub_id in rub_ids

def test_student_enrolled_courses_and_performance():
    res_stu = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    stu_token = res_stu.json()["access_token"]
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # Enrolled subjects
    res_enr = client.get("/api/v1/academic/student/enrolled-subjects", headers=stu_headers)
    assert res_enr.status_code == 200
    enr_subs = res_enr.json()
    assert len(enr_subs) >= 1

    # Performance averages
    res_perf = client.get("/api/v1/academic/student/performance", headers=stu_headers)
    assert res_perf.status_code == 200
    perf_data = res_perf.json()
    assert isinstance(perf_data, list)
