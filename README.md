# WriteUp Pro - Smart Academic Workspace 📝✨

A comprehensive, role-based web application designed to solve the problem of student plagiarism in academic write-ups and assignments. WriteUp Pro forces students to manually author their documents in a secure environment while providing faculty and administrators with seamless evaluation and ledger management workflows.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)

## 📌 Problem Statement
Students often evade manual effort in practical write-ups and assignments by copying and pasting text or printing documents authored by others. Faculty have no choice but to accept these documents, defeating the educational purpose of the assignments.

## 💡 The Solution
**WriteUp Pro** acts as a secure, sandboxed Word Processor inside the browser. It strictly blocks copy-pasting and window switching to enforce manual typing. It features a complete workflow starting from student registration to faculty grading and admin oversight.

---

## 🔑 Default Login Credentials

To evaluate the application, use the following credentials. The password for **all** roles is: `password`

| Role | Username | Password | Features Unlocked |
| :--- | :--- | :--- | :--- |
| **Student** | `student` | `password` | Registration, Drafts, Document Authoring, Submitting |
| **Faculty** | `faculty` | `password` | Classroom Folders, Document Viewing, Rubric Grading |
| **Administrator**| `admin` | `password` | Profile Approvals/Rejections, Cheat Logs, CSV Exports |

---

## 🚀 Key Features

### 👨‍🎓 For Students
*   **Academic Setup:** First-time login requires students to fill out their Branch, Year, Semester, Division, and Open Electives.
*   **Anti-Cheat Editor:** A full rich-text editor (Bold, Italics, Lists, Tables, Code Blocks) that entirely blocks the Paste (`Ctrl+V`) and Drop events.
*   **Security Monitor:** Keystroke burst monitoring and tab-switching triggers flag alerts logged directly to the admin console.
*   **Auto-Generated Cover Pages:** Dynamically generates an institution-standard cover page and marking rubric based on whether it is an "Assignment" or "Experiment".
*   **Engineering Canvas:** A built-in drawing tool to manually draw diagrams and insert them natively into the document.
*   **Subject Score Tracking:** The dashboard automatically calculates and separates the average marks scored in Assignments vs. Experiments.

### 👨‍🏫 For Faculty
*   **Organized Submissions:** Students are automatically grouped into classroom folders (e.g., `SE - CE (Div A)`).
*   **Split-View Evaluation Panel:** View the read-only student submission side-by-side with an evaluation panel.
*   **Smart Rubrics:** Faculty enter scores directly into the generated cover page rubric table. The system auto-calculates the sum and enforces maximum mark validation (10 marks for Assignment, 15 marks for Experiment).
*   **Digital Signatures:** Automatically applies a secure timestamp and faculty name to the document upon approval.

### 🛡️ For Administrators
*   **Registration Management:** Review pending student profile registrations. Approve them to grant workspace access, or "Revert/Reject" them with custom remarks.
*   **Security Ledger:** View live statistics including total authored documents, graded assignments, and a running tally of triggered "Security/Cheat Flags".
*   **Export Data:** Download a comprehensive Grading Ledger in CSV format for institutional record keeping.

---

## 📁 Repository Structure
```text
WriteUp-Pro/
│
├── index.html       # Main application view and layout
├── styles.css   # Modern SaaS styling, dark mode, print media queries
├── app.js       # Core logic, local storage DB, role routing, security
├── README.md        # Documentation
├── .gitignore       # Git configurations
└── LICENSE          # MIT License
