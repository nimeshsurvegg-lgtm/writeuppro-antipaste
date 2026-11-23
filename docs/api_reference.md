# WriteUp Pro — REST API Reference (v2.0)

All protected endpoints require the HTTP Authorization header:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/login`
Authenticates a user and returns a signed JWT token with profile claims.
- **Request Body**:
  ```json
  { "username": "student", "password": "password" }
  ```
- **Response**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "user": {
      "id": "user_student",
      "username": "student",
      "full_name": "Demo Student",
      "role": "student"
    }
  }
  ```

### `POST /api/v1/auth/register`
Self-registers a new student or faculty account.

### `GET /api/v1/auth/me`
Fetches current authenticated profile metadata.

---

## 2. Academic Hierarchy Endpoints

### `GET /api/v1/academic/hierarchy`
Returns departments, branches, academic years, divisions, and subjects.

### `GET /api/v1/academic/curriculum`
Query parameters: `year` (FE/SE/TE/BE), `branch` (CE/IT/ASH), `sem` (1..8).

### `POST /api/v1/academic/student-profile`
Student submits academic configuration for administrator verification.

### `PATCH /api/v1/academic/student-profiles/{user_id}/status`
Administrator approves, reverts/rejects with remarks, or blocks student.

---

## 3. Documents & Submissions

### `POST /api/v1/documents/`
Saves document draft, creates version snapshot, and records word count.

### `POST /api/v1/submissions/`
Submits document. Verifies ownership and approval status, snapshots content, and issues a receipt code.

---

## 4. Evaluations & Rubrics

### `POST /api/v1/evaluations/`
Faculty grades submission with rubric criteria breakdown.
- Validates marks range ($\le 10$ for Assignment, $\le 15$ for Experiment).
- Computes cryptographic digital stamp signature code.
- Marks submission and document as `graded`.

### `POST /api/v1/evaluations/{submission_id}/return`
Returns submission for revision with remarks.

---

## 5. Exports & Reports

### `GET /api/v1/exports/pdf/{doc_id}`
Generates and streams authentic A4 PDF with ReportLab.

### `GET /api/v1/exports/ledger/csv`
Exports institutional grading ledger in CSV format.

### `GET /api/v1/exports/integrity/csv`
Exports security telemetry audit logs in CSV format.
