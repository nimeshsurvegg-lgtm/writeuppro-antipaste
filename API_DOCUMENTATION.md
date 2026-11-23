# WriteUp Pro — Comprehensive REST API Documentation (API_DOCUMENTATION.md)

Base URL: `http://localhost:8000/api/v1`  
Interactive OpenAPI / Swagger UI: `http://localhost:8000/docs`

---

## 1. Authentication (`/api/v1/auth`)

### `POST /auth/login`
- **Description**: Authenticates user credentials and issues a signed JWT token.
- **Request Body**:
  ```json
  {
    "username": "student",
    "password": "password"
  }
  ```
- **Responses**:
  - `200 OK`: Returns JWT token and user profile object.
  - `401 Unauthorized`: Invalid credentials.
  - `403 Forbidden`: Account suspended.

### `POST /auth/register`
- **Description**: Self-registration for student accounts.
- **Request Body**:
  ```json
  {
    "username": "johndoe",
    "email": "johndoe@writeuppro.edu",
    "full_name": "John Doe",
    "password": "securepassword",
    "role": "student"
  }
  ```

### `GET /auth/me`
- **Description**: Returns current authenticated user and role profile. Requires Bearer Token.

### `POST /auth/change-password`
- **Description**: Updates user password after verifying old password.

---

## 2. Academic Hierarchy & Profiles (`/api/v1/academic`)

### `GET /academic/hierarchy`
- **Description**: Returns all configured departments, branches, academic years, divisions, and subjects.

### `GET /academic/curriculum`
- **Parameters**: `year` (string, e.g. "SE"), `branch` (string, e.g. "CE"), `sem` (integer, e.g. 3).
- **Description**: Returns mandatory curriculum subjects and open electives for the specified semester.

### `POST /academic/student-profile`
- **Role**: `student`
- **Description**: Submits or updates student academic onboarding details. Sets profile status to `pending` and notifies administrators.

### `GET /academic/student-profiles`
- **Role**: `faculty`, `admin`
- **Description**: Lists all registered student profiles with approval status.

### `PATCH /academic/student-profiles/{user_id}/status`
- **Role**: `admin`
- **Description**: Updates student profile status (`approved`, `rejected`, `blocked`). Accepts optional administrative discrepancy remarks.

---

## 3. Tasks & Assignments (`/api/v1/tasks`)

### `GET /tasks/`
- **Role**: All authenticated roles
- **Description**: Returns published assignments and experiments relevant to user's class or teaching assignment.

### `GET /tasks/{task_id}`
- **Description**: Fetches instructions, deadline, and rubric criteria matrix for a task.

### `POST /tasks/`
- **Role**: `faculty`, `admin`
- **Description**: Publishes a new assignment or practical experiment.

---

## 4. Document Authoring (`/api/v1/documents`)

### `GET /documents/`
- **Description**: Lists authored documents for student, or all documents for administrator.

### `GET /documents/{doc_id}`
- **Description**: Fetches document content, metadata, and version snapshot history.

### `POST /documents/`
- **Role**: `student`
- **Description**: Saves or auto-saves draft write-up. Creates an incremental snapshot in `document_versions`.

### `POST /documents/{doc_id}/duplicate`
- **Role**: `student`
- **Description**: Duplicates an existing document as a clean draft.

---

## 5. Submissions (`/api/v1/submissions`)

### `POST /submissions/`
- **Role**: `student`
- **Description**: Validates document completeness and eligibility, freezes an immutable snapshot, generates a unique submission receipt (`SUB-2026-IIET-XXXX`), and locks document.

### `GET /submissions/`
- **Role**: `faculty`, `admin`
- **Parameters**: `subject`, `division`, `status_filter`.
- **Description**: Lists submissions grouped by classroom folders.

### `GET /submissions/{submission_id}`
- **Description**: Returns submission details and read-only frozen HTML snapshot.

---

## 6. Evaluations & Rubrics (`/api/v1/evaluations`)

### `POST /evaluations/`
- **Role**: `faculty`, `admin`
- **Description**: Grades student submission. Enforces rubric criteria maximums ($\le 10$ for Assignment, $\le 15$ for Experiment), generates a digital approval stamp hash (`SIG-FAC9021-IIET-XXXX`), marks submission as `graded`, and notifies student.

### `POST /evaluations/{submission_id}/return`
- **Role**: `faculty`, `admin`
- **Description**: Returns submission for corrections with remarks, unlocking student's draft.

---

## 7. Security & Integrity Ledger (`/api/v1/integrity`)

### `POST /integrity/events`
- **Role**: `student`
- **Description**: Client logs telemetry events (`paste_attempt`, `drop_attempt`, `tab_blur`, `typing_burst`).

### `GET /integrity/events`
- **Role**: `admin`, `faculty`
- **Description**: Lists logged integrity events with filters.

### `PATCH /integrity/events/{event_id}`
- **Role**: `admin`
- **Description**: Reviews, dismisses, or flags an integrity event for investigation.

---

## 8. Academic Analytics (`/api/v1/analytics`)

### `GET /analytics/student`
- **Role**: `student`
- **Description**: Computes student document counts, assignment average, experiment average, and subject-wise score breakdown from database records.

### `GET /analytics/faculty`
- **Role**: `faculty`, `admin`
- **Description**: Returns faculty workload and evaluation completion metrics.

### `GET /analytics/admin`
- **Role**: `admin`
- **Description**: Returns institutional counters (students, faculty, classes, documents, submissions, cheat flags).

---

## 9. Notifications (`/api/v1/notifications`)

### `GET /notifications/`
- **Description**: Returns notifications and unread count for current user.

### `POST /notifications/read-all`
- **Description**: Marks all notifications as read.

---

## 10. Document Exports (`/api/v1/exports`)

### `GET /exports/pdf/{doc_id}`
- **Description**: Generates and downloads a two-pass numbered (`Page X of Y`) institutional A4 PDF with cover page, rubric table, write-up content, drawings, and digital approval stamp.

### `GET /exports/ledger/csv`
- **Role**: `faculty`, `admin`
- **Description**: Downloads complete institutional grading ledger in CSV format.

### `GET /exports/integrity/csv`
- **Role**: `admin`
- **Description**: Downloads security and anti-cheat telemetry ledger in CSV format.
