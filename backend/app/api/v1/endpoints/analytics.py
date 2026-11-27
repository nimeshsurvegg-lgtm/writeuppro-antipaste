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
    faculty_id = payload.get("sub")
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

    # Subject-wise statistics for allotted subjects
    cursor.execute("""
    SELECT sa.id, s.name as subject_name, s.code as subject_code, ag.division_name, ag.year_level, ag.branch_code,
           COUNT(DISTINCT sub.id) as submission_count,
           SUM(CASE WHEN sub.status = 'graded' THEN 1 ELSE 0 END) as graded_count,
           AVG(CASE WHEN e.marks_awarded IS NOT NULL THEN (e.marks_awarded / e.max_marks) * 100 ELSE NULL END) as avg_score_pct
    FROM subject_allotments sa
    JOIN subjects s ON sa.subject_id = s.id
    JOIN academic_groups ag ON sa.academic_group_id = ag.id
    LEFT JOIN tasks t ON t.subject_id = s.id
    LEFT JOIN submissions sub ON sub.task_id = t.id
    LEFT JOIN evaluations e ON sub.id = e.submission_id
    WHERE sa.faculty_id = ?
    GROUP BY sa.id;
    """, (faculty_id,))
    stats["allotted_subjects_stats"] = [dict(r) for r in cursor.fetchall()]

    # Lab batch statistics
    cursor.execute("""
    SELECT lb.id, lb.batch_name, lb.division_name, lb.branch_code, lb.year_level, s.name as subject_name,
           COUNT(DISTINCT bs.student_id) as student_count,
           COUNT(DISTINCT sub.id) as submission_count
    FROM lab_batches lb
    LEFT JOIN subjects s ON lb.subject_id = s.id
    LEFT JOIN batch_students bs ON lb.id = bs.batch_id
    LEFT JOIN submissions sub ON sub.batch_id = lb.id
    WHERE lb.faculty_id = ?
    GROUP BY lb.id;
    """, (faculty_id,))
    stats["lab_batches_stats"] = [dict(r) for r in cursor.fetchall()]

    # Score distribution for completed evaluations
    cursor.execute("""
    SELECT 
        SUM(CASE WHEN (e.marks_awarded / e.max_marks) * 100 < 40 THEN 1 ELSE 0 END) as range_under_40,
        SUM(CASE WHEN (e.marks_awarded / e.max_marks) * 100 >= 40 AND (e.marks_awarded / e.max_marks) * 100 < 60 THEN 1 ELSE 0 END) as range_40_60,
        SUM(CASE WHEN (e.marks_awarded / e.max_marks) * 100 >= 60 AND (e.marks_awarded / e.max_marks) * 100 < 75 THEN 1 ELSE 0 END) as range_60_75,
        SUM(CASE WHEN (e.marks_awarded / e.max_marks) * 100 >= 75 AND (e.marks_awarded / e.max_marks) * 100 < 90 THEN 1 ELSE 0 END) as range_75_90,
        SUM(CASE WHEN (e.marks_awarded / e.max_marks) * 100 >= 90 THEN 1 ELSE 0 END) as range_90_100
    FROM evaluations e;
    """)
    score_dist = dict(cursor.fetchone() or {})
    stats["score_distribution"] = score_dist

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

    # Additional academic metrics
    cursor.execute("SELECT COUNT(*) FROM subjects WHERE status != 'archived';")
    total_subjects = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM subject_allotments;")
    total_allotments = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM lab_batches WHERE status = 'active';")
    total_lab_batches = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM promotion_requests WHERE status = 'pending';")
    pending_promotions = cursor.fetchone()[0]

    # Branch-wise student breakdown
    cursor.execute("""
    SELECT branch_code, COUNT(*) as student_count
    FROM student_profiles
    GROUP BY branch_code
    ORDER BY student_count DESC;
    """)
    branch_distribution = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        "total_students": total_students,
        "pending_registrations": pending_registrations,
        "total_faculty": total_faculty,
        "total_documents": total_documents,
        "pending_submissions": pending_submissions,
        "graded_submissions": graded_submissions,
        "total_integrity_events": total_integrity_events,
        "total_subjects": total_subjects,
        "total_allotments": total_allotments,
        "total_lab_batches": total_lab_batches,
        "pending_promotions": pending_promotions,
        "branch_distribution": branch_distribution
    }
