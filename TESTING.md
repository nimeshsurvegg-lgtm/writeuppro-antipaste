# WriteUp Pro — Testing & Quality Assurance Documentation (TESTING.md)

## 1. Testing Strategy
WriteUp Pro employs automated backend API testing, role authorization boundary testing, and frontend production build verification to ensure continuous system reliability.

---

## 2. Automated Test Suite (`backend/tests/test_api.py`)

The test suite is built on **Pytest** and the FastAPI `TestClient`, executing against an initialized relational database.

### 2.1 Test Cases & Coverage Matrix

| Test Function | Target Feature | Verification Criteria |
| :--- | :--- | :--- |
| `test_health_check` | Health & Status API | Returns HTTP 200, status `healthy`, project metadata, and academic cycle. |
| `test_auth_login_all_roles` | Authentication & JWT | Issues valid Bearer tokens for `student`, `faculty`, and `admin`; rejects invalid passwords with HTTP 401. |
| `test_role_authorization_security` | RBAC Security | Verifies that a token belonging to `student` is rejected with HTTP 403 when requesting administrator endpoints. |
| `test_academic_hierarchy_and_curriculum` | Curriculum Management | Returns structured departments, branches, academic years, and semester subjects. |
| `test_document_authoring_and_submission_lifecycle` | End-to-End Workflow | Validates draft saving, retrieval, final submission, unique receipt issuance (`SUB-`), faculty rubric scoring, digital approval stamp generation (`SIG-`), and A4 PDF export. |
| `test_rubric_limit_enforcement` | Rubric Validation | Verifies that scores exceeding maximum allowable marks (e.g. 10 for assignments) are rejected with HTTP 400. |
| `test_integrity_event_logging` | Security Telemetry | Verifies that client-side paste and telemetry alerts are recorded in the institutional database. |
| `test_grading_ledger_csv_export` | Institutional Exports | Verifies that the grading archive CSV is generated with student roll numbers, subjects, and digital stamp hashes. |

---

## 3. Running the Test Suite Locally

```powershell
Set-Location "C:\Users\Nimesh\.gemini\antigravity\scratch\writeuppro-antipaste"

# Execute all tests with verbose output:
.\.venv\Scripts\pytest.exe backend/tests/test_api.py -v
```

Expected Output:
```text
backend/tests/test_api.py::test_health_check PASSED                      [ 12%]
backend/tests/test_api.py::test_auth_login_all_roles PASSED              [ 25%]
backend/tests/test_api.py::test_role_authorization_security PASSED       [ 37%]
backend/tests/test_api.py::test_academic_hierarchy_and_curriculum PASSED [ 50%]
backend/tests/test_api.py::test_document_authoring_and_submission_lifecycle PASSED [ 62%]
backend/tests/test_api.py::test_rubric_limit_enforcement PASSED          [ 75%]
backend/tests/test_api.py::test_integrity_event_logging PASSED           [ 87%]
backend/tests/test_api.py::test_grading_ledger_csv_export PASSED         [100%]

============================== 8 passed in 0.69s ==============================
```

---

## 4. Frontend Build Verification

To ensure that all React components, TypeScript types, and Tailwind styles compile without errors:

```powershell
Set-Location "C:\Users\Nimesh\.gemini\antigravity\scratch\writeuppro-antipaste\frontend"
.\node_modules\.bin\vite.cmd build
```

Expected Output:
```text
vite v8.3.8 building client environment for production...
✓ 2138 modules transformed.
dist/index.html                   0.84 kB
dist/assets/index.css            43.27 kB
dist/assets/index.js            329.96 kB
✓ built in 280ms
```
