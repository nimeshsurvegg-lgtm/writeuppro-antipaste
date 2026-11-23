export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending';
  profile?: StudentProfile | FacultyProfile;
}

export interface StudentProfile {
  user_id: string;
  roll_number: string;
  prn?: string;
  year_level: string; // FE, SE, TE, BE
  branch_code: string; // CE, IT, ASH
  semester_number: number;
  division_name: string; // Div A, Div B
  elective_subject?: string;
  status: 'pending' | 'approved' | 'rejected' | 'blocked';
  admin_remarks?: string;
  name?: string;
}

export interface FacultyProfile {
  user_id: string;
  employee_id: string;
  department_code: string;
  designation: string;
}

export interface AcademicHierarchy {
  departments: Array<{ id: string; name: string; code: string }>;
  branches: Array<{ id: string; department_id: string; name: string; code: string }>;
  years: Array<{ id: string; year_name: string; academic_cycle: string }>;
  divisions: Array<{ id: string; name: string; code: string }>;
  subjects: Array<{ id: string; branch_id: string; semester_number: number; name: string; code: string; is_elective: number }>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  task_type: 'Assignment' | 'Experiment';
  task_number: string;
  max_marks: number;
  instructions?: string;
  due_date: string;
  status: string;
  rubric: Array<{ criteria: string; max: number; guidance?: string }>;
  student_doc_id?: string;
  student_doc_status?: string;
}

export interface AcademicDocument {
  id: string;
  student_id: string;
  task_id?: string;
  title: string;
  doc_type: 'Assignment' | 'Experiment';
  subject_name: string;
  subject_code: string;
  doc_number: string;
  content_html: string;
  word_count: number;
  status: 'draft' | 'submitted' | 'graded' | 'returned';
  created_at: string;
  updated_at: string;
  marks?: number;
  submission_code?: string;
  submission_date?: string;
  faculty_remarks?: string;
  versions?: Array<{ version_num: number; change_summary: string; created_at: string }>;
}

export interface Submission {
  submission_id: string;
  submission_code: string;
  submission_date: string;
  status: 'submitted' | 'graded' | 'returned';
  document_id: string;
  title: string;
  doc_type: 'Assignment' | 'Experiment';
  doc_number: string;
  subject_name: string;
  subject_code: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  year_level: string;
  branch_code: string;
  division_name: string;
  marks_awarded?: number;
  eval_max_marks?: number;
  snapshot_html?: string;
  evaluated_at?: string;
  feedback?: string;
  faculty_remarks?: string;
  digital_signature_code?: string;
  evaluator_name?: string;
}

export interface IntegrityEvent {
  id: string;
  student_id: string;
  student_name?: string;
  roll_number?: string;
  document_id?: string;
  document_title?: string;
  event_type: 'paste_attempt' | 'drop_attempt' | 'tab_blur' | 'typing_burst' | 'large_insertion';
  severity: 'low' | 'medium' | 'high';
  metadata_json: string;
  review_status: 'pending' | 'reviewed' | 'dismissed' | 'investigating';
  admin_remarks?: string;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  link?: string;
  is_read: number;
  created_at: string;
}
