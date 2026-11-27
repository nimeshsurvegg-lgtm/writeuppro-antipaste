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
  branch_code: string; // CE, IT, EXTC, AIDS, MECH, CIVIL
  semester_number: number;
  division_name: string; // Div A, Div B
  elective_subject?: string;
  status: 'pending' | 'approved' | 'rejected' | 'blocked';
  admin_remarks?: string;
  name?: string;
  academic_year?: string;
  cgpa?: number;
}

export interface FacultyProfile {
  user_id: string;
  employee_id: string;
  department_code: string;
  designation: string;
}

export interface AcademicCalendar {
  id: string;
  code: string;
  name: string;
  start_date?: string;
  end_date?: string;
  is_current: number;
  status: 'upcoming' | 'active' | 'completed' | 'archived';
}

export interface Subject {
  id: string;
  branch_id: string;
  branch_name?: string;
  branch_code?: string;
  semester_number: number;
  name: string;
  code: string;
  is_elective: number;
  category?: string;
  credits: number;
  total_credits?: number;
  subject_type?: string;
  teaching_hours?: number;
  syllabus_scheme?: string;
  academic_year?: string;
  description?: string;
  status: string;
  year_level: string;
}

export interface CurriculumVersion {
  id: string;
  academic_year: string;
  branch_code: string;
  branch_name?: string;
  year_level: string;
  semester_number: number;
  scheme_name: string;
  status: 'draft' | 'published' | 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface SubjectAllotment {
  id: string;
  academic_group_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  credits?: number;
  faculty_id: string;
  faculty_name: string;
  academic_year: string;
  branch_code: string;
  year_level: string;
  semester_number: number;
  division_name: string;
  allotted_students_count?: number;
}

export interface LabBatch {
  id: string;
  batch_name: string;
  academic_year: string;
  branch_code: string;
  year_level: string;
  semester_number: number;
  division_name: string;
  subject_id?: string;
  subject_name?: string;
  faculty_id?: string;
  faculty_name?: string;
  capacity: number;
  status: 'active' | 'inactive' | 'archived';
  student_count: number;
  students?: Array<{ student_id: string; full_name: string; roll_number: string }>;
}

export interface OpenElectiveConfig {
  id: string;
  academic_year: string;
  branch_code: string;
  year_level: string;
  semester_number: number;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  credits: number;
  faculty_id?: string;
  faculty_name?: string;
  max_capacity: number;
  enrolled_count: number;
  is_active: number;
}

export interface OpenElectiveSelection {
  id: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  division_name?: string;
  branch_code?: string;
  elective_config_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_remarks?: string;
  selected_at: string;
  reviewed_at?: string;
}

export interface PromotionWindow {
  id: string;
  title: string;
  source_academic_year: string;
  target_academic_year: string;
  source_year_level: string;
  target_year_level: string;
  source_semester: number;
  target_semester: number;
  branch_code: string;
  is_open: number;
  opened_at?: string;
  closed_at?: string;
}

export interface PromotionRequest {
  id: string;
  promotion_window_id: string;
  window_title?: string;
  student_id: string;
  student_name: string;
  cgpa: number;
  current_year_level: string;
  current_semester: number;
  current_division: string;
  current_roll_number: string;
  requested_division: string;
  requested_roll_number: string;
  approved_division?: string;
  approved_roll_number?: string;
  status: 'pending' | 'approved' | 'rejected' | 'resubmission';
  admin_remarks?: string;
  submitted_at: string;
}

export interface CustomRubricCriterion {
  id: string;
  name: string;
  max_score: number;
  guidance?: string;
}

export interface CustomRubric {
  id: string;
  faculty_id: string;
  faculty_name?: string;
  title: string;
  document_category: string;
  total_marks: number;
  criteria: CustomRubricCriterion[];
}

export interface StudentPerformanceAverage {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  credits: number;
  assignment_average?: number;
  assignment_evaluated_count: number;
  experiment_average?: number;
  experiment_evaluated_count: number;
  overall_average?: number;
  total_evaluated: number;
  pending_evaluations: number;
  highest_marks?: number;
  lowest_marks?: number;
}

export interface AcademicHierarchy {
  departments: Array<{ id: string; name: string; code: string }>;
  branches: Array<{ id: string; department_id: string; name: string; code: string }>;
  years: Array<{ id: string; year_name: string; academic_cycle: string }>;
  divisions: Array<{ id: string; name: string; code: string }>;
  subjects: Array<{ id: string; branch_id: string; semester_number: number; name: string; code: string; is_elective: number }>;
}

export interface SubmissionAttachment {
  id: string;
  task_id?: string;
  document_id?: string;
  submission_id?: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  created_at?: string;
  file_method?: string;
}

export interface SpecialSubmissionPayload {
  task_id: string;
  document_id?: string;
  submission_method: 'editor' | 'pdf' | 'docx' | 'other_files' | 'external_link' | 'multi';
  title: string;
  content_html?: string;
  word_count?: number;
  external_link_url?: string;
  external_link_title?: string;
  external_link_description?: string;
  attachment_ids?: string[];
  is_draft?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  task_type: 'Assignment' | 'Experiment' | 'Special Document';
  task_number: string;
  max_marks: number;
  instructions?: string;
  due_date: string;
  status: string;
  rubric: Array<{ criteria?: string; name?: string; max?: number; max_score?: number; guidance?: string }>;
  target_type?: 'division' | 'batch';
  batch_id?: string;
  batch_name?: string;
  category?: 'standard' | 'special' | 'special_document';
  document_category?: string;
  experiment_number?: string;
  objective?: string;
  problem_statement?: string;
  hardware_software_req?: string;
  procedure?: string;
  expected_output?: string;
  late_submission_policy?: 'allow' | 'penalty' | 'reject';
  late_penalty_percent?: number;
  custom_rubric_id?: string;
  student_doc_id?: string;
  student_doc_status?: string;
  student_submission_code?: string;
  student_is_late?: number;
  student_delay_text?: string;
  student_marks_awarded?: number;
  // Flexible Submission Methods
  allowed_methods?: Array<'editor' | 'pdf' | 'docx' | 'other_files' | 'external_link'>;
  allow_multiple_methods?: boolean | number;
  max_file_size_mb?: number;
  max_files_count?: number;
  allowed_extensions?: string[];
  require_pdf_conversion?: boolean | number;
  allow_resubmission?: boolean | number;
  allow_edit_before_deadline?: boolean | number;
}

export interface AcademicDocument {
  id: string;
  student_id: string;
  task_id?: string;
  title: string;
  doc_type: 'Assignment' | 'Experiment' | 'Special Document';
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
  student_name?: string;
  roll_number?: string;
  year_level?: string;
  division_name?: string;
  rubric_scores_json?: string;
  rubric_scores?: any;
  digital_signature_code?: string;
  versions?: Array<{ version_num: number; change_summary: string; created_at: string }>;
  // Flexible Submission Fields
  submission_method?: 'editor' | 'pdf' | 'docx' | 'other_files' | 'external_link' | 'multi';
  external_link_url?: string;
  external_link_title?: string;
  external_link_description?: string;
  attachments?: SubmissionAttachment[];
}

export interface Submission {
  submission_id: string;
  submission_code: string;
  submission_date: string;
  status: 'submitted' | 'graded' | 'returned';
  document_id: string;
  title: string;
  doc_type: 'Assignment' | 'Experiment' | 'Special Document';
  doc_number: string;
  subject_name: string;
  subject_code: string;
  student_id: string;
  student_name: string;
  roll_number: string;
  year_level: string;
  branch_code: string;
  division_name: string;
  is_late?: number;
  delay_seconds?: number;
  delay_text?: string;
  late_penalty_applied?: number;
  batch_id?: string;
  batch_name?: string;
  task_title?: string;
  task_category?: string;
  target_type?: string;
  task_due_date?: string;
  late_submission_policy?: string;
  custom_rubric_id?: string;
  custom_rubric?: CustomRubric;
  marks_awarded?: number;
  eval_max_marks?: number;
  snapshot_html?: string;
  evaluated_at?: string;
  feedback?: string;
  faculty_remarks?: string;
  faculty_private_notes?: string;
  submission_method?: 'editor' | 'pdf' | 'docx' | 'other_files' | 'external_link' | 'multi';
  external_link_url?: string;
  external_link_title?: string;
  external_link_description?: string;
  attachments?: SubmissionAttachment[];
  resubmission_count?: number;
  version_number?: number;
}
  digital_signature_code?: string;
  evaluator_name?: string;
  rubric_scores?: any;
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

// ============================================================================
// ROLE-BASED ACADEMIC FOLDER SYSTEM TYPES
// ============================================================================

export interface PrioritySubmissionItem {
  task_id: string;
  title: string;
  description?: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  task_type: 'Assignment' | 'Experiment' | 'Special Document';
  faculty_name: string;
  max_marks: number;
  assigned_date?: string;
  due_date?: string;
  due_time?: string;
  time_remaining: string;
  deadline_indicator: string; // 'Due today' | 'Due tomorrow' | 'Due in X days' | 'Due soon' | 'Overdue' | 'Submitted'
  is_overdue: boolean;
  delay_text?: string;
  submission_status: 'pending' | 'submitted' | 'graded' | 'returned';
  submission_id?: string;
  document_id?: string;
  marks_awarded?: number;
  feedback?: string;
  eval_status?: string;
}

export interface SubjectAssessmentItem extends PrioritySubmissionItem {}

export interface SubjectFolderItem {
  subject_id: string;
  name: string;
  code: string;
  category: string;
  credits: number;
  faculty_name: string;
  lab_batch_name?: string;
  enrollment_type: string;
  counts: {
    total: number;
    assignments: number;
    experiments: number;
    special_documents: number;
    pending: number;
    submitted: number;
    evaluated: number;
  };
  assessments: SubjectAssessmentItem[];
}

export interface SubmissionHistoryItem {
  submission_id: string;
  document_id: string;
  task_id?: string;
  title: string;
  task_type: string;
  subject_name: string;
  subject_code: string;
  academic_year: string;
  semester_number: number;
  submission_date: string;
  is_late: boolean;
  delay_text: string;
  submission_status: string;
  eval_status: string;
  marks_awarded?: number;
  max_marks: number;
  feedback?: string;
  remarks?: string;
  digital_signature_code?: string;
  created_at: string;
}

export interface StudentWorkspaceFolders {
  priority_submissions: PrioritySubmissionItem[];
  subject_folders: SubjectFolderItem[];
  submission_history: SubmissionHistoryItem[];
  summary_counts: {
    pending_count: number;
    overdue_count: number;
    submitted_count: number;
    evaluated_count: number;
    subjects_count: number;
  };
}

export interface PendingEvaluationQueueItem {
  submission_id: string;
  document_id: string;
  task_id: string;
  student_id: string;
  submission_code: string;
  submission_date: string;
  is_late: number;
  delay_text: string;
  status: string;
  created_at: string;
  student_name: string;
  roll_number?: string;
  prn?: string;
  task_title: string;
  task_type: string;
  due_date: string;
  max_marks: number;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  division_name: string;
  batch_id?: string;
  batch_name?: string;
  branch_code: string;
  year_level: string;
}

export interface OverdueUnsubmittedTask {
  task_id: string;
  title: string;
  task_type: string;
  due_date: string;
  max_marks: number;
  subject_name: string;
  subject_code: string;
  division_name: string;
  batch_id?: string;
  branch_code: string;
  year_level: string;
  total_expected_students: number;
  submitted_students_count: number;
  missing_count: number;
}

export interface FacultySubjectSubfolder {
  subject_id: string;
  name: string;
  code: string;
  category: string;
  subject_type: string;
  assignments: any[];
  experiments: any[];
  special_documents: any[];
  submissions: any[];
  pending_evaluations_count: number;
  evaluated_count: number;
  total_submissions_count: number;
  average_score: number;
}

export interface FacultyBatchFolder {
  id: string;
  batch_name: string;
  academic_year: string;
  branch_code: string;
  year_level: string;
  semester_number: number;
  division_name: string;
  subject_id?: string;
  subject_name?: string;
  faculty_id?: string;
  capacity: number;
  students: Array<{ student_id: string; student_name: string; email: string; roll_number?: string; prn?: string }>;
  students_count: number;
  experiments: any[];
  submissions: any[];
  pending_evaluations_count: number;
  average_score: number;
}

export interface FacultyClassFolder {
  academic_group_id: string;
  class_name: string;
  academic_year: string;
  branch_code: string;
  branch_name: string;
  year_level: string;
  semester_number: number;
  division_name: string;
  student_count: number;
  assigned_subjects: FacultySubjectSubfolder[];
  assigned_batches: FacultyBatchFolder[];
  counts: {
    subjects_count: number;
    batches_count: number;
    pending_evaluations: number;
    total_submissions: number;
  };
}

export interface FacultyTeachingFolders {
  pending_evaluations_queue: PendingEvaluationQueueItem[];
  overdue_unsubmitted_tasks: OverdueUnsubmittedTask[];
  class_folders: FacultyClassFolder[];
  summary_counts: {
    total_pending_evaluations: number;
    total_classes: number;
    total_overdue_tasks: number;
  };
}

export interface AdminClassFolderItem {
  id: string;
  academic_year: string;
  branch_code: string;
  branch_name: string;
  year_level: string;
  semester_number: number;
  division_name: string;
  class_name: string;
  student_count: number;
  faculty_count: number;
  subject_count: number;
  batch_count: number;
  tasks_count: number;
  total_submissions: number;
  pending_evaluations: number;
  is_archived: boolean;
}

export interface AdminClassFoldersResponse {
  academic_years: AcademicCalendar[];
  selected_year: string;
  is_archived: boolean;
  classes: AdminClassFolderItem[];
  total_classes: number;
}

export interface AdminClassFolderDetail {
  academic_group: {
    id: string;
    academic_year: string;
    branch_code: string;
    branch_name: string;
    year_level: string;
    semester_number: number;
    division_name: string;
    is_archived: boolean;
  };
  students: any[];
  faculty_allocations: any[];
  batches: any[];
  tasks: any[];
  submission_stats: {
    total_tasks: number;
    total_submissions: number;
    graded_count: number;
    pending_evaluations: number;
    students_count: number;
  };
}
