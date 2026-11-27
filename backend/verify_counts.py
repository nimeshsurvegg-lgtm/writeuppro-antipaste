from app.core.database import get_db_connection

conn = get_db_connection()
c = conn.cursor()

print("Students:", c.execute("SELECT COUNT(*) FROM users WHERE role='student'").fetchone()[0])
print("Faculty:", c.execute("SELECT COUNT(*) FROM users WHERE role='faculty'").fetchone()[0])
print("Admin:", c.execute("SELECT COUNT(*) FROM users WHERE role='admin'").fetchone()[0])
print("Tasks:", c.execute("SELECT COUNT(*) FROM tasks").fetchone()[0])
print("Submissions:", c.execute("SELECT COUNT(*) FROM submissions").fetchone()[0])
print("Evaluations:", c.execute("SELECT COUNT(*) FROM evaluations").fetchone()[0])
subjects = [r[0] for r in c.execute("SELECT s.name FROM student_subject_enrollments sse JOIN subjects s ON sse.subject_id=s.id WHERE sse.student_id='user_student'").fetchall()]
print("Primary Student Subjects:", subjects)
conn.close()

from app.api.v1.endpoints.academic import get_student_performance_averages
res = get_student_performance_averages({'sub': 'user_student', 'role': 'student'})
print("Performance subjects count:", len(res))
for r in res:
    print("Subject:", r['subject_name'], "| Code:", r['subject_code'], "| Avg:", r['assignment_average_display'], "| Experiments:", r['experiment_average_display'])
