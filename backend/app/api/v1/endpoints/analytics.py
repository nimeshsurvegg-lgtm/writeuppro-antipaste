from fastapi import APIRouter, Depends
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles

router = APIRouter()

@router.get("/student")
def get_student_analytics(payload: dict = Depends(require_roles("student"))):
    """Calculates live academic performance and score metrics from database records."""
    student_id = payload.get("sub")
    conn = get_db_connection()
    cursor = conn.cursor()

    # Document counts
    cursor.execute("""
    SELECT 
        COUNT(*) as total_docs,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN status = 'graded' THEN 1 ELSE 0 END) as graded_count
    FROM documents
    WHERE student_id = ?;
    """, (student_id,))
    counts = dict(cursor.fetchone())

    # Graded documents score calculations
    cursor.execute("""
    SELECT d.subject_name, d.doc_type, e.marks_awarded, e.max_marks
    FROM documents d
    JOIN submissions s ON d.id = s.document_id
    JOIN evaluations e ON s.id = e.submission_id
    WHERE d.student_id = ? AND d.status = 'graded';
    """, (student_id,))
    graded_rows = [dict(r) for r in cursor.fetchall()]

    assign_scores = [r["marks_awarded"] for r in graded_rows if r["doc_type"] == "Assignment"]
    expt_scores = [r["marks_awarded"] for r in graded_rows if r["doc_type"] == "Experiment"]

    assign_avg = round(sum(assign_scores) / len(assign_scores), 1) if assign_scores else None
    expt_avg = round(sum(expt_scores) / len(expt_scores), 1) if expt_scores else None

    # Group by subject
    subjects_map = {}
    for r in graded_rows:
        sub = r["subject_name"]
        if sub not in subjects_map:
            subjects_map[sub] = {"assignments": [], "experiments": []}
        if r["doc_type"] == "Assignment":
            subjects_map[sub]["assignments"].append(r["marks_awarded"])
        else:
            subjects_map[sub]["experiments"].append(r["marks_awarded"])

    breakdown = []
    for sub, scores in subjects_map.items():
        a_m = round(sum(scores["assignments"]) / len(scores["assignments"]), 1) if scores["assignments"] else None
        e_m = round(sum(scores["experiments"]) / len(scores["experiments"]), 1) if scores["experiments"] else None
        breakdown.append({
            "subject": sub,
            "assignment_avg": a_m,
            "experiment_avg": e_m
        })

    conn.close()
    return {
        "summary": counts,
        "averages": {
            "assignment_avg": assign_avg,
            "experiment_avg": expt_avg,
            "assignment_count": len(assign_scores),
            "experiment_count": len(expt_scores)
        },
        "subject_breakdown": breakdown
    }

@router.get("/faculty")
def get_faculty_analytics(payload: dict = Depends(require_roles("faculty", "admin"))):
    """Calculates faculty workload, pending evaluation count, and classroom statistics."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT 
        COUNT(s.id) as total_submissions,
        SUM(CASE WHEN s.status = 'submitted' THEN 1 ELSE 0 END) as pending_evaluations,
        SUM(CASE WHEN s.status = 'graded' THEN 1 ELSE 0 END) as completed_evaluations,
        COUNT(DISTINCT s.student_id) as total_active_students
    FROM submissions s;
    """)
    stats = dict(cursor.fetchone())

    conn.close()
    return stats

@router.get("/admin")
def get_admin_analytics(payload: dict = Depends(require_roles("admin"))):
    """Calculates institution-wide metrics for administrator control dashboard."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM student_profiles;")
    total_students = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM student_profiles WHERE status = 'pending';")
    pending_registrations = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'faculty';")
    total_faculty = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM documents;")
    total_documents = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM submissions WHERE status = 'submitted';")
    pending_submissions = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM submissions WHERE status = 'graded';")
    graded_submissions = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM integrity_events;")
    total_integrity_events = cursor.fetchone()[0]

    conn.close()
    return {
        "total_students": total_students,
        "pending_registrations": pending_registrations,
        "total_faculty": total_faculty,
        "total_documents": total_documents,
        "pending_submissions": pending_submissions,
        "graded_submissions": graded_submissions,
        "total_integrity_events": total_integrity_events
    }
