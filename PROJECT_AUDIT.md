# WriteUp Pro — Comprehensive Legacy Project Audit (PROJECT_AUDIT.md)

## 1. Executive Summary
This document provides a thorough audit of the original **WriteUp Pro – Smart Academic Workspace** repository (`writeuppro-antipaste`), evaluating its code, architecture, security, data structures, and workflows prior to full-stack transformation.

---

## 2. File-by-File Inventory & Analysis

### 2.1 `index.html` (Original Monolithic SPA, 105,494 bytes)
- **Structure**: Contains HTML layout, inline CSS stylesheets (variables, dark mode, print media queries), modal templates, and embedded vanilla JavaScript (`app` object).
- **Core Components Present**:
  - Global header with role indicator and theme toggle button.
  - `#login-view`: Hardcoded credential prompt.
  - `#student-view`: Academic setup form (branch, year, semester, division, elective) and student dashboard.
  - `#editor-view`: Canvas layout mimicking an A4 page, toolbar using `document.execCommand`, cover page template, and watermark.
  - `#faculty-view`: Folder accordion grouping students by classroom and split-screen grading panel.
  - `#admin-view`: Dashboard counters, student registration approval/rejection with remarks prompt, and cheat log counter.
  - `#canvas-modal`: 2D HTML5 canvas for freehand drawing.
  - `#jury-modal`: Evaluation guide for quick logins.

### 2.2 `styles.css` & `app.js` (Referenced in Documentation)
- **Status in Legacy Repository**: The legacy repository bundled all logic and styling directly inside `index.html` rather than external CSS/JS files.
- **Legacy Styling Strengths**: Clean color tokens (`--primary: #6366f1`, `--bg: #f8fafc`, `--surface: #ffffff`), custom scrollbar styling, responsive cards, and comprehensive `@media print` rules.

### 2.3 `README.md` & `LICENSE`
- **Original Content**: Described problem statement (student plagiarism in practicals), stated credentials (`student`/`faculty`/`admin` with `password`), and highlighted client-side features.
- **License**: MIT License.

---

## 3. Detailed Audit by Functional Domain

### 3.1 Authentication & Authorization
- **Working Elements**: Simple client-side routing based on selected role.
- **Critical Vulnerabilities & Limitations**:
  - Passwords hardcoded to `'password'` without hashing (e.g. `if (p !== 'password')`).
  - No session tokens, cookies, or JWTs.
  - Client-side role selection stored in `sessionStorage` (`writeup_user`). Any user could run `sessionStorage.setItem('writeup_user', JSON.stringify({role: 'admin'}))` to gain full administrative UI access.
  - No server-side authorization guards.

### 3.2 Data Persistence & Relational Modelling
- **Working Elements**: Immediate zero-config browser storage using `localStorage` keys (`writeup_docs`, `writeup_profiles`, `writeup_cheats`).
- **Critical Limitations**:
  - Local to individual browser instances; student submissions could not naturally be viewed by faculty on another machine without manual JSON export/import.
  - No relational integrity, foreign keys, or database transactions.
  - Susceptible to silent data loss on browser cache clearing.

### 3.3 Academic Structure & Curriculum
- **Working Elements**: Nested JSON object (`curriculum`) mapping `FE`, `SE`, `TE`, `BE` to semesters and subjects.
- **Deficiencies**:
  - Hardcoded in JavaScript; administrators could not add departments, subjects, or academic years dynamically.
  - Hardcoded branch coverage (`CE`, `IT`, `ASH`).

### 3.4 Document Authoring Engine
- **Working Elements**:
  - WYSIWYG editing inside `#rich-editor` with `contenteditable="true"`.
  - Client-side paste event interception (`e.preventDefault()`).
  - Window blur listener detecting tab switching.
  - Rapid keystroke burst listener ($< 30\text{ ms}$ delta).
  - Word count calculation against a target goal.
- **Flaws & Vulnerabilities**:
  - Relied on deprecated `document.execCommand`, which is obsolete across modern web standards.
  - Paste restrictions could be trivially bypassed via developer tools console (`document.getElementById('rich-editor').innerHTML = '...'`).
  - No version history or diff tracking.
  - Documents overwritten in-place during saves; no immutable snapshots upon submission.

### 3.5 Academic Cover Page Generator & Rubrics
- **Working Elements**:
  - Dynamic layout switching for `Assignment` (max 10 marks) vs. `Experiment` (max 15 marks).
  - Client-side rubric score summation ($K + C + P + Perf$) with basic boundary checks.
- **Limitations**:
  - Rubric criteria hardcoded into template HTML strings.
  - Faculty digital signature was merely an unverified formatted text block.

### 3.6 Engineering Canvas
- **Working Elements**: Freehand drawing on HTML5 2D canvas with mouse and touch events; exported as base64 PNG data URL into editor.
- **Limitations**:
  - Only freehand line drawing supported. No vector shapes (rectangles, circles, lines, arrows), no text annotations, no grid snapping, no layer management, no undo/redo.

### 3.7 Plagiarism & Integrity Verification
- **Audit Finding**: In the legacy `openGradeView` method:
  ```javascript
  let score = Math.random() > 0.95 ? Math.floor(Math.random()*40)+60 : Math.floor(Math.random()*15);
  ```
  Plagiarism scores were completely fabricated via `Math.random()`.
- **Requirement**: Must be replaced with an authentic, deterministic internal similarity analysis engine that compares submissions against cohort records and identifies actual matching n-grams.

### 3.8 Document Exports & Printing
- **Working Elements**: Native browser `window.print()` using `@media print` CSS.
- **Limitations**: Inconsistent across different browsers and operating systems; lacked verifiable digital approval stamps, headers/footers with exact page numbers, and downloadable binary PDF generation.

---

## 4. Audit Conclusion & Migration Mandate
The legacy application established a compelling user concept and clear workflows, but lacked the enterprise architecture, security, persistence, and authenticity required for an institutional platform. The full-stack transformation must preserve all original workflows while replacing simulated mechanisms with genuine, server-backed functionality.
