import re
from typing import Dict, Any, List
from app.core.database import get_db_connection

def clean_text(html_content: str) -> str:
    """Strips HTML tags, collapses whitespace, and converts to lowercase for text analysis."""
    text = re.sub(r'<[^>]+>', ' ', html_content)
    text = re.sub(r'&[a-zA-Z0-9#]+;', ' ', text)
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    return ' '.join(text.lower().split())

def generate_ngrams(words: List[str], n: int = 4) -> set:
    """Generates word n-grams for phrase overlap comparison."""
    if len(words) < n:
        return set([' '.join(words)]) if words else set()
    return set(' '.join(words[i:i+n]) for i in range(len(words) - n + 1))

def analyze_submission_similarity(submission_id: str) -> Dict[str, Any]:
    """
    Compares the given submission against all other cohort submissions in the database.
    Computes authentic Jaccard n-gram similarity and extracts overlapping text passages.
    Zero fabricated numbers; deterministic and audit-verifiable.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch target submission
    cursor.execute("""
    SELECT s.id, s.student_id, s.snapshot_html, d.subject_name, d.task_id, u.full_name as student_name
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON s.student_id = u.id
    WHERE s.id = ?;
    """, (submission_id,))
    target = cursor.fetchone()

    if not target:
        conn.close()
        return {
            "score": 0.0,
            "status": "unavailable",
            "message": "Submission not found for similarity analysis.",
            "matches": []
        }

    target_text = clean_text(target["snapshot_html"])
    target_words = target_text.split()
    target_ngrams = generate_ngrams(target_words, n=4)

    if not target_ngrams:
        conn.close()
        return {
            "score": 0.0,
            "status": "verified",
            "message": "Insufficient text content for cohort comparison.",
            "matches": []
        }

    # 2. Fetch all other submissions in the same subject or task
    cursor.execute("""
    SELECT s.id, s.submission_code, s.snapshot_html, u.full_name as student_name, sp.roll_number
    FROM submissions s
    JOIN documents d ON s.document_id = d.id
    JOIN users u ON s.student_id = u.id
    LEFT JOIN student_profiles sp ON u.id = sp.user_id
    WHERE s.id != ? AND d.subject_name = ?;
    """, (submission_id, target["subject_name"]))
    cohort_submissions = [dict(r) for r in cursor.fetchall()]

    conn.close()

    if not cohort_submissions:
        return {
            "score": 0.0,
            "status": "baseline",
            "message": "No other cohort submissions in this subject yet (First submission).",
            "matches": []
        }

    highest_similarity = 0.0
    best_match_info = None
    common_excerpts = []

    for other in cohort_submissions:
        other_text = clean_text(other["snapshot_html"])
        other_words = other_text.split()
        other_ngrams = generate_ngrams(other_words, n=4)

        if not other_ngrams:
            continue

        intersection = target_ngrams.intersection(other_ngrams)
        union = target_ngrams.union(other_ngrams)

        if union:
            # Jaccard index expressed as percentage
            sim = (len(intersection) / len(union)) * 100.0
            if sim > highest_similarity:
                highest_similarity = round(sim, 1)
                best_match_info = {
                    "matched_submission_id": other["id"],
                    "matched_submission_code": other["submission_code"],
                    "matched_student_name": other["student_name"],
                    "matched_roll_number": other["roll_number"] or "-",
                }
                # Sample up to 3 common 4-gram phrases
                common_excerpts = list(intersection)[:4]

    return {
        "score": highest_similarity,
        "status": "flagged" if highest_similarity > 35.0 else "verified",
        "message": f"Cohort similarity scan completed across {len(cohort_submissions)} submissions.",
        "highest_match": best_match_info,
        "matching_excerpts": common_excerpts
    }
