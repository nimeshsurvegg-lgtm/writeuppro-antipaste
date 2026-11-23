import csv
import io
from typing import List, Dict, Any

def generate_grading_ledger_csv(records: List[Dict[str, Any]]) -> str:
    """Generates a standardized institutional grading ledger CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Roll Number",
        "Student Name",
        "PRN",
        "Department/Branch",
        "Class & Division",
        "Subject Name",
        "Subject Code",
        "Document Type",
        "Document Number",
        "Marks Awarded",
        "Max Marks",
        "Evaluation Status",
        "Evaluator Faculty",
        "Evaluation Date",
        "Digital Stamp Hash"
    ])

    for r in records:
        writer.writerow([
            r.get("roll_number", "-"),
            r.get("student_name", "-"),
            r.get("prn", "-"),
            r.get("branch_code", "-"),
            f"{r.get('year_level', '')} {r.get('division_name', '')}",
            r.get("subject_name", "-"),
            r.get("subject_code", "-"),
            r.get("doc_type", "-"),
            r.get("doc_number", "-"),
            r.get("marks_awarded", "-"),
            r.get("max_marks", "-"),
            r.get("evaluation_status", "submitted"),
            r.get("faculty_name", "-"),
            r.get("evaluated_at", "-"),
            r.get("digital_signature_code", "-")
        ])

    return output.getvalue()

def generate_integrity_ledger_csv(events: List[Dict[str, Any]]) -> str:
    """Generates an academic integrity and audit events CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID",
        "Timestamp",
        "Student Name",
        "Roll Number",
        "Event Type",
        "Severity",
        "Document ID",
        "Review Status",
        "Admin Remarks",
        "Telemetry Metadata"
    ])

    for e in events:
        writer.writerow([
            e.get("id", "-"),
            e.get("timestamp", "-"),
            e.get("student_name", "-"),
            e.get("roll_number", "-"),
            e.get("event_type", "-"),
            e.get("severity", "-"),
            e.get("document_id", "-"),
            e.get("review_status", "-"),
            e.get("admin_remarks", "-"),
            e.get("metadata_json", "-")
        ])

    return output.getvalue()
