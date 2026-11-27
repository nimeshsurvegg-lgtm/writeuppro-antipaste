import sqlite3

conn = sqlite3.connect('backend/writeuppro.db')
c = conn.cursor()

# Ensure document records exist
c.execute("""
INSERT OR IGNORE INTO documents (id, student_id, task_id, title, doc_type, subject_name, subject_code, doc_number, content_html, word_count, status, created_at, updated_at)
VALUES 
('doc_pending_eval_1', 'user_student', 'task_assign_1', 'Assignment 1: Relational Schema Design', 'Assignment', 'Database management system', 'CE-SE-201', '1', '<h2>Relational Schema</h2><p>Normalized entities and relations.</p>', 150, 'submitted', '2026-11-25T14:00:00Z', '2026-11-25T14:00:00Z'),
('doc_pending_eval_2', 'user_student', 'task_ds_expt_a1', 'Lab Experiment 3: Heap Sort & Priority Queues', 'Experiment', 'Data Structures Lab', 'CE-SE-202', '3', '<h2>Heap Sort Implementation</h2><p>Max-heap construction and heapify procedures.</p>', 220, 'submitted', '2026-11-26T11:00:00Z', '2026-11-26T11:00:00Z');
""")

# Insert submissions awaiting evaluation
c.execute("""
INSERT OR IGNORE INTO submissions (id, document_id, task_id, student_id, submission_code, snapshot_html, submission_date, is_late, status, created_at, delay_seconds, delay_text, late_penalty_applied, batch_id)
VALUES
('sub_pending_eval_1', 'doc_pending_eval_1', 'task_assign_1', 'user_student', 'SUB-2026-IIET-8821A', '<h2>Relational Schema</h2><p>Normalized entities and relations.</p>', '25/11/2026 14:00', 0, 'submitted', '2026-11-25T14:00:00Z', 0, 'On Time', 0.0, NULL),
('sub_pending_eval_2', 'doc_pending_eval_2', 'task_ds_expt_a1', 'user_student', 'SUB-2026-IIET-9943B', '<h2>Heap Sort Implementation</h2><p>Max-heap construction and heapify procedures.</p>', '26/11/2026 11:00', 1, 'submitted', '2026-11-26T11:00:00Z', 19200, 'Submitted 5h 20m late', 5.0, 'batch_ce_se_a1');
""")

conn.commit()
conn.close()
print("Added pending evaluation submissions for faculty queue testing.")
