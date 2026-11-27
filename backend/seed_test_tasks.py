import sqlite3

conn = sqlite3.connect('backend/writeuppro.db')
c = conn.cursor()

# Ensure task_assign_dbms_2 exists with exact same deadline as task_expt_1 ('2026-12-10T23:59:59Z')
c.execute("""
INSERT OR IGNORE INTO tasks (
    id, title, description, subject_id, faculty_id, task_type, task_number, max_marks,
    instructions, due_date, rubric_json, status, created_at, academic_year, branch_code,
    year_level, semester_number, division_name, target_type
) VALUES (
    'task_assign_dbms_2',
    'Assignment 2: Query Optimization & B+ Tree Indexing',
    'Analyze query execution plans and index selectivity.',
    'sub_fe_mth1', -- or DBMS subject
    'user_faculty',
    'Assignment',
    '2',
    10.0,
    'Explain clustering indexes and cost estimation.',
    '2026-12-10T23:59:59Z',
    '[{\"criteria\":\"Index Structure\",\"max\":5},{\"criteria\":\"Query Plan Analysis\",\"max\":5}]',
    'published',
    '2026-11-20T10:00:00Z',
    '2026-27',
    'CE',
    'SE',
    3,
    'Div A',
    'division'
)
""")

# Also check a task due today/tomorrow for testing indicator
# Let's see: today is 2026-11-27
# Let's add a task due tomorrow (2026-11-28 23:59:59)
c.execute("""
INSERT OR IGNORE INTO tasks (
    id, title, description, subject_id, faculty_id, task_type, task_number, max_marks,
    instructions, due_date, rubric_json, status, created_at, academic_year, branch_code,
    year_level, semester_number, division_name, target_type
) VALUES (
    'task_due_tomorrow',
    'Lab Experiment 4: Graph Traversals (BFS & DFS)',
    'Implement BFS and DFS using adjacency lists.',
    'sub_fec101',
    'user_faculty',
    'Experiment',
    '4',
    15.0,
    'Provide recursive and iterative implementations.',
    '2026-11-28T23:59:59Z',
    '[{\"criteria\":\"Implementation\",\"max\":8},{\"criteria\":\"Complexity Analysis\",\"max\":7}]',
    'published',
    '2026-11-21T10:00:00Z',
    '2026-27',
    'CE',
    'SE',
    3,
    'Div A',
    'division'
)
""")

conn.commit()
conn.close()
print("Added identical deadline and due-tomorrow test tasks.")
