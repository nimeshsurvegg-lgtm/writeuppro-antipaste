import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data

def test_auth_login_all_roles():
    # 1. Admin login
    res = client.post("/api/v1/auth/login", json={"username": "admin", "password": "password"})
    assert res.status_code == 200
    admin_data = res.json()
    assert admin_data["user"]["role"] == "admin"
    assert "access_token" in admin_data

    # 2. Faculty login
    res = client.post("/api/v1/auth/login", json={"username": "faculty", "password": "password"})
    assert res.status_code == 200
    faculty_data = res.json()
    assert faculty_data["user"]["role"] == "faculty"

    # 3. Student login
    res = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    assert res.status_code == 200
    student_data = res.json()
    assert student_data["user"]["role"] == "student"

    # 4. Invalid credentials
    res = client.post("/api/v1/auth/login", json={"username": "student", "password": "wrongpassword"})
    assert res.status_code == 401

def test_role_authorization_security():
    # Student token attempting to access admin endpoint
    res_login = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    student_token = res_login.json()["access_token"]

    headers = {"Authorization": f"Bearer {student_token}"}
    res_admin = client.get("/api/v1/analytics/admin", headers=headers)
    assert res_admin.status_code == 403

def test_academic_hierarchy_and_curriculum():
    res = client.get("/api/v1/academic/hierarchy")
    assert res.status_code == 200
    data = res.json()
    assert len(data["departments"]) >= 2
    assert len(data["branches"]) >= 2
    assert len(data["subjects"]) >= 5

    res_curr = client.get("/api/v1/academic/curriculum?year=SE&branch=CE&sem=3")
    assert res_curr.status_code == 200
    curr_data = res_curr.json()
    assert len(curr_data["subjects"]) >= 1

def test_document_authoring_and_submission_lifecycle():
    # 1. Login as Student
    res_login = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create and Save Document Draft
    doc_payload = {
        "title": "Automated Test Assignment: Computer Networks",
        "subject_name": "Computer Networks",
        "subject_code": "IT-CN201",
        "doc_type": "Assignment",
        "doc_number": "2",
        "content_html": "<h2>Aim</h2><p>To analyze TCP/IP protocol stack.</p><p>The transmission control protocol guarantees reliable byte-stream transfer.</p>",
        "word_count": 45,
        "status": "draft"
    }
    res_save = client.post("/api/v1/documents/", json=doc_payload, headers=headers)
    assert res_save.status_code == 200
    doc_id = res_save.json()["id"]

    # 3. Fetch Document
    res_doc = client.get(f"/api/v1/documents/{doc_id}", headers=headers)
    assert res_doc.status_code == 200
    assert res_doc.json()["title"] == doc_payload["title"]
    assert res_doc.json()["status"] == "draft"

    # 4. Submit Document
    res_sub = client.post("/api/v1/submissions/", json={"document_id": doc_id}, headers=headers)
    assert res_sub.status_code == 200
    sub_data = res_sub.json()
    sub_id = sub_data["submission_id"]
    assert sub_data["submission_code"].startswith("SUB-")

    # 5. Faculty Login & Evaluation
    fac_login = client.post("/api/v1/auth/login", json={"username": "faculty", "password": "password"})
    fac_token = fac_login.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # 6. Evaluation with Rubric Scoring
    eval_payload = {
        "submission_id": sub_id,
        "marks_awarded": 9.0,
        "rubric_scores": {
            "knowledge": 3.5,
            "content": 2.5,
            "punctuality": 3.0
        },
        "feedback": "Thorough network layer breakdown.",
        "remarks": "Approved"
    }
    res_eval = client.post("/api/v1/evaluations/", json=eval_payload, headers=fac_headers)
    assert res_eval.status_code == 200
    eval_res = res_eval.json()
    assert eval_res["marks_awarded"] == 9.0
    assert "digital_signature_code" in eval_res
    assert eval_res["digital_signature_code"].startswith("SIG-")

    # 7. Check PDF Export
    res_pdf = client.get(f"/api/v1/exports/pdf/{doc_id}", headers=headers)
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF")

def test_rubric_limit_enforcement():
    fac_login = client.post("/api/v1/auth/login", json={"username": "faculty", "password": "password"})
    fac_token = fac_login.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # Attempt to award marks exceeding max (e.g. 15 on an assignment with max 10)
    invalid_eval = {
        "submission_id": "sub_sample_1",
        "marks_awarded": 14.5,
        "rubric_scores": {"knowledge": 5.0, "content": 4.0, "punctuality": 5.5},
        "feedback": "Exceeding limit test"
    }
    res = client.post("/api/v1/evaluations/", json=invalid_eval, headers=fac_headers)
    assert res.status_code == 400
    assert "exceeds maximum limit" in res.json()["detail"] or "Knowledge score" in res.json()["detail"]

def test_integrity_event_logging():
    res_login = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    event_payload = {
        "event_type": "paste_attempt",
        "severity": "medium",
        "metadata": {"blocked_chars": 284, "source": "external_clipboard"}
    }
    res = client.post("/api/v1/integrity/events", json=event_payload, headers=headers)
    assert res.status_code == 200
    assert "event_id" in res.json()

def test_grading_ledger_csv_export():
    admin_login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "password"})
    token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res_csv = client.get("/api/v1/exports/ledger/csv", headers=headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    csv_text = res_csv.text
    assert "Roll Number" in csv_text
    assert "Student Name" in csv_text
    assert "Marks Awarded" in csv_text

def test_similarity_analysis():
    fac_login = client.post("/api/v1/auth/login", json={"username": "faculty", "password": "password"})
    token = fac_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/evaluations/sub_sample_1/similarity", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "score" in data
    assert "status" in data
    assert "message" in data

def test_document_delete_and_version_restore():
    res_login = client.post("/api/v1/auth/login", json={"username": "student", "password": "password"})
    token = res_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a draft
    doc_payload = {
        "title": "Draft to be restored and deleted",
        "subject_name": "Database management system",
        "subject_code": "CE-DB201",
        "doc_type": "Assignment",
        "doc_number": "3",
        "content_html": "<p>Initial content v1</p>",
        "word_count": 4,
        "status": "draft"
    }
    res_create = client.post("/api/v1/documents/", json=doc_payload, headers=headers)
    doc_id = res_create.json()["id"]

    # 2. Update to v2
    doc_payload["content_html"] = "<p>Updated content v2</p>"
    client.post(f"/api/v1/documents/?doc_id={doc_id}", json=doc_payload, headers=headers)

    # 3. Restore v1
    res_restore = client.post(f"/api/v1/documents/{doc_id}/versions/1/restore", headers=headers)
    assert res_restore.status_code == 200
    assert "Initial content v1" in res_restore.json()["content_html"]

    # 4. Delete draft
    res_delete = client.delete(f"/api/v1/documents/{doc_id}", headers=headers)
    assert res_delete.status_code == 200

