import json
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from app.core.database import get_db_connection
from app.core.security import get_current_user_payload, require_roles
from app.services.pdf_service import generate_academic_pdf
from app.services.export_service import generate_grading_ledger_csv, generate_integrity_ledger_csv

router = APIRouter()

@router.get("/pdf/{doc_id}")
def export_document_pdf(doc_id: str, payload: dict = Depends(get_current_user_payload)):
    """Generates and serves a formatted A4 academic PDF with cover page, rubrics, and digital stamp."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch document
    cursor.execute("SELECT * FROM documents WHERE id = ?;", (doc_id,))
    doc = cursor.fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")

    doc_data = dict(doc)

    # Fetch student profile & user
    cursor.execute("""
    SELECT sp.*, u.full_name as name
    FROM users u
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    WHERE u.id = ?;
    """, (doc_data["student_id"],))
    stu_row = cursor.fetchone()
    student_profile = dict(stu_row) if stu_row else {}

    # Fetch submission
    cursor.execute("SELECT * FROM submissions WHERE document_id = ?;", (doc_id,))
    sub_row = cursor.fetchone()
    submission_data = dict(sub_row) if sub_row else {}

    # Fetch evaluation
    evaluation_data = None
    if sub_row:
        cursor.execute("""
        SELECT e.*, u.full_name as faculty_name
        FROM evaluations e
        JOIN users u ON e.faculty_id = u.id
        WHERE e.submission_id = ?;
        """, (sub_row["id"],))
        eval_row = cursor.fetchone()
        if eval_row:
            evaluation_data = dict(eval_row)
            if evaluation_data.get("rubric_scores_json"):
                evaluation_data["rubric_scores"] = json.loads(evaluation_data["rubric_scores_json"])

    conn.close()

    pdf_bytes = generate_academic_pdf(
        doc_data=doc_data,
        student_profile=student_profile,
        submission_data=submission_data,
        evaluation_data=evaluation_data
    )

    clean_filename = f"{doc_data.get('doc_type', 'Document')}_{doc_data.get('doc_number', '1')}_{student_profile.get('roll_number', 'Student')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{clean_filename}"'}
    )

@router.get("/ledger/csv")
def export_grading_ledger_csv(payload: dict = Depends(require_roles("admin", "faculty"))):
    """Exports the institutional grading ledger in CSV format."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT 
        sp.roll_number, u.full_name as student_name, sp.prn, sp.branch_code, sp.year_level, sp.division_name,
        d.subject_name, d.subject_code, d.doc_type, d.doc_number,
        e.marks_awarded, e.max_marks, e.status as evaluation_status,
        fac.full_name as faculty_name, e.evaluated_at, e.digital_signature_code
    FROM evaluations e
    JOIN submissions s ON e.submission_id = s.id
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON s.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    JOIN users fac ON e.faculty_id = fac.id
    ORDER BY sp.year_level, sp.branch_code, sp.division_name, sp.roll_number ASC;
    """)
    records = [dict(r) for r in cursor.fetchall()]
    conn.close()

    csv_data = generate_grading_ledger_csv(records)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="WriteUp_Pro_Grading_Ledger.csv"'}
    )

@router.get("/integrity/csv")
def export_integrity_ledger_csv(payload: dict = Depends(require_roles("admin"))):
    """Exports academic integrity telemetry logs in CSV format."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT ie.*, u.full_name as student_name, sp.roll_number
    FROM integrity_events ie
    JOIN users u ON ie.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    ORDER BY ie.timestamp DESC;
    """)
    events = [dict(r) for r in cursor.fetchall()]
    conn.close()

    csv_data = generate_integrity_ledger_csv(events)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="WriteUp_Pro_Integrity_Ledger.csv"'}
    )
