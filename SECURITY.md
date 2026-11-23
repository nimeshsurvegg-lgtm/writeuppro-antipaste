# WriteUp Pro — Cybersecurity & Academic Integrity Architecture (SECURITY.md)

## 1. Threat Model & Security Posture
WriteUp Pro operates under a **Zero-Trust Client Model**. In educational web environments, students have direct access to browser developer tools, DOM manipulation, console execution, accessibility APIs, and browser extensions. Consequently:
- **No client-side restriction is treated as an authoritative security boundary.**
- **All business logic, rubric boundaries, ownership validations, and immutable snapshots are strictly enforced on the server.**

---

## 2. Authentication & Authorization Guards

### 2.1 Password Hashing & Key Derivation
- Passwords are encrypted using **PBKDF2-HMAC-SHA256** with 100,000 iterations and a cryptographically secure 16-byte random salt generated via `os.urandom(16)`.
- Verification uses constant-time comparison (`hmac.compare_digest`) to prevent timing attack side-channels.

### 2.2 Token-Based Sessions
- Authenticated requests utilize signed **JSON Web Tokens (JWT)** with HMAC-SHA256 (`HS256`).
- Payload contains user identity (`sub`), username, role, and expiration timestamp (`exp`).
- Expired tokens or tampered signatures are rejected with HTTP 401 Unauthorized.

### 2.3 Role-Based Access Control (RBAC)
- Authorization is checked at the route level via FastAPI dependency injection:
  - `require_roles("student")`
  - `require_roles("faculty")`
  - `require_roles("admin")`
- Cross-student access is prohibited: a student attempting to view or edit another student's document receives HTTP 403 Forbidden or HTTP 404 Not Found.

---

## 3. Academic Integrity & Anti-Cheat Architecture

### 3.1 Client-Side Friction Controls
The academic document editor incorporates active event listeners to encourage manual authoring:
1. **Paste Interception**: `paste` event is intercepted (`e.preventDefault()`), notifying the student that external pasting is restricted and transmitting a telemetry event to the server.
2. **External Drag-and-Drop Interception**: `drop` event is intercepted, preventing external text/file insertion.
3. **Focus Loss & Tab Switching**: Window `blur` and visibility changes are detected and logged.
4. **Keystroke Cadence Burst Detection**: Rapid keydown intervals ($< 30\text{ ms}$) trigger telemetry logging to identify programmatic or automated insertion tools.

### 3.2 Server-Side Integrity Ledger & Due Process
- Telemetry signals are **imperfect indicators** and do not constitute automatic proof of plagiarism (e.g. accessibility software, speech-to-text, or operating system notifications can cause focus loss or bursts).
- All events are recorded in the `integrity_events` table with context metadata, severity, and timestamp.
- Administrators review flagged events through an institutional console with options to **Dismiss**, **Mark for Investigation**, or **Request Student Explanation**.
- Automatic penalties are never imposed based solely on browser telemetry.

---

## 4. Submission Immutability & Digital Verification Stamps

### 4.1 Immutable Snapshots
- Upon final submission, the document's content is copied into the `submissions` table as an immutable frozen snapshot.
- The working draft document is locked (`status = 'submitted'`).
- A unique receipt code (`SUB-2026-IIET-XXXX`) is issued to the student.

### 4.2 Faculty Digital Approval Stamps
- When faculty approves an evaluation, a cryptographic digital approval stamp hash is computed:
  ```
  SIG-<FACULTY_ID>-IIET-<TIMESTAMP_HASH>
  ```
- This record binds the evaluator's identity, rubric scores, timestamp, and submission ID. The digital stamp is embedded on the final A4 PDF export and institutional grade archive.

---

## 5. Input Validation & Injection Prevention
- **SQL Injection Prevention**: All database queries utilize parameterized SQL statements (`?` parameters), preventing SQL injection vulnerabilities.
- **XSS Prevention**: User content is escaped when rendered into tables or templates; PDF generation parses semantic tags into structured ReportLab flowables without executing arbitrary scripts.
- **Data Protection**: Secrets, database passwords, and JWT secret keys are managed through environment variables (`.env.example`).
