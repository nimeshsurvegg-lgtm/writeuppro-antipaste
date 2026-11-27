import type {
  StudentWorkspaceFolders,
  FacultyTeachingFolders,
  AdminClassFoldersResponse,
  AdminClassFolderDetail
} from '../types';

// Dynamic API Base URL resolver that works seamlessly across local dev, Render, Vercel, and unified deployments
export function getApiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local');

    // Only target local port 8000 if explicitly running in a local developer browser
    if (isLocalhost && (window.location.port === '5173' || window.location.port === '3000')) {
      return 'http://localhost:8000/api/v1';
    }
    // In production (Vercel, Render) or unified host, use origin-relative /api/v1 (never localhost!)
    return `${window.location.origin}/api/v1`;
  }
  return '/api/v1';
}

const API_BASE = getApiBase();

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('writeuppro_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  try {
    localStorage.setItem('writeuppro_token', token);
  } catch (e) {
    console.error('Failed to persist auth token', e);
  }
}

export function removeAuthToken() {
  try {
    localStorage.removeItem('writeuppro_token');
    localStorage.removeItem('writeuppro_user');
  } catch (e) {
    console.error('Failed to remove auth token', e);
  }
}

interface ApiOptions extends RequestInit {
  timeoutMs?: number;
  skipRetry?: boolean;
}

// In-flight GET request deduplication cache to prevent redundant concurrent fetches
const inFlightRequests = new Map<string, Promise<any>>();

export async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = `${method}:${endpoint}`;

  if (isGet && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey) as Promise<T>;
  }

  const executeFetch = async (attempt = 1): Promise<T> => {
    const token = getAuthToken();
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const timeoutMs = options.timeoutMs || (method === 'GET' ? 18000 : 25000);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // If caller provided their own signal, listen to it as well
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    const url = `${getApiBase()}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle 401 Unauthorized (Expired or Invalid JWT)
      if (response.status === 401) {
        removeAuthToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('writeuppro:unauthorized'));
        }
        throw new Error('Your session has expired. Please sign in again.');
      }

      // Handle 502/503/504 Render cold-start transient errors on GET
      if (
        (response.status === 502 || response.status === 503 || response.status === 504) &&
        isGet &&
        attempt < 2 &&
        !options.skipRetry
      ) {
        await new Promise((r) => setTimeout(r, 1200));
        return executeFetch(attempt + 1);
      }

      if (!response.ok) {
        let errorDetail = `Request failed with status ${response.status}`;
        try {
          const errJson = await response.json();
          if (Array.isArray(errJson.detail)) {
            errorDetail = errJson.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
          } else if (typeof errJson.detail === 'object' && errJson.detail !== null) {
            errorDetail = JSON.stringify(errJson.detail);
          } else if (errJson.detail) {
            errorDetail = String(errJson.detail);
          } else if (errJson.message) {
            errorDetail = String(errJson.message);
          } else {
            errorDetail = JSON.stringify(errJson);
          }
        } catch {
          errorDetail = (await response.text()) || response.statusText || errorDetail;
        }
        throw new Error(errorDetail);
      }

      if (response.status === 204) {
        return {} as T;
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        throw new Error(
          'Request timed out. The server might be waking up or experiencing high traffic. Please try again.'
        );
      }

      // If connection refused or network failure during cold start, retry once for GET
      if (
        isGet &&
        attempt < 2 &&
        !options.skipRetry &&
        (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'))
      ) {
        await new Promise((r) => setTimeout(r, 1200));
        return executeFetch(attempt + 1);
      }

      throw err;
    }
  };

  if (isGet) {
    const promise = executeFetch().finally(() => {
      inFlightRequests.delete(cacheKey);
    });
    inFlightRequests.set(cacheKey, promise);
    return promise;
  }

  return executeFetch();
}

export async function downloadAuthenticatedFile(endpoint: string, defaultFilename: string): Promise<void> {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${getApiBase()}${endpoint}`;
  const response = await fetch(url, { method: 'GET', headers });

  if (response.status === 401) {
    removeAuthToken();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('writeuppro:unauthorized'));
    }
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!response.ok) {
    let errMsg = `Download failed with status ${response.status}`;
    try {
      const errJson = await response.json();
      errMsg = errJson.detail || errMsg;
    } catch {
      // keep fallback
    }
    throw new Error(errMsg);
  }

  const disposition = response.headers.get('Content-Disposition');
  let filename = defaultFilename;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, '').trim();
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      apiFetch<{ access_token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    register: (data: { username: string; email: string; full_name: string; password: string; role: string }) =>
      apiFetch<{ message: string; access_token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => apiFetch<any>('/auth/me'),
    changePassword: (old_password: string, new_password: string) =>
      apiFetch<{ message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password, new_password }),
      }),
  },

  academic: {
    getHierarchy: () => apiFetch<any>('/academic/hierarchy'),
    getCurriculum: (year: string, branch: string, sem: number) =>
      apiFetch<{ subjects: any[]; electives: any[] }>(`/academic/curriculum?year=${year}&branch=${branch}&sem=${sem}`),
    submitStudentProfile: (profile: any) =>
      apiFetch<{ message: string; status: string }>('/academic/student-profile', {
        method: 'POST',
        body: JSON.stringify(profile),
      }),
    listStudentProfiles: () => apiFetch<any[]>('/academic/student-profiles'),
    updateProfileStatus: (userId: string, status: string, remarks?: string) =>
      apiFetch<{ message: string }>(`/academic/student-profiles/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, remarks }),
      }),

    // Module 1: Academic Calendars
    listAcademicYears: () => apiFetch<any[]>('/academic/academic-years'),
    createAcademicYear: (data: { code: string; name: string; start_date?: string; end_date?: string; is_current?: boolean; status?: string }) =>
      apiFetch<{ message: string; id: string }>('/academic/academic-years', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateAcademicYearStatus: (id: string, status: string, is_current?: boolean) =>
      apiFetch<{ message: string }>(`/academic/academic-years/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, is_current }),
      }),

    // Module 2: Subjects Master & Curricula Versions
    listSubjects: (filters?: { branch?: string; semester?: number; academic_year?: string; category?: string; status?: string }) => {
      const p = new URLSearchParams();
      if (filters?.branch) p.set('branch', filters.branch);
      if (filters?.semester) p.set('semester', String(filters.semester));
      if (filters?.academic_year) p.set('academic_year', filters.academic_year);
      if (filters?.category) p.set('category', filters.category);
      if (filters?.status) p.set('status', filters.status);
      return apiFetch<any[]>(`/academic/subjects?${p.toString()}`);
    },
    createSubject: (data: any) =>
      apiFetch<{ message: string; id: string }>('/academic/subjects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateSubject: (id: string, data: any) =>
      apiFetch<{ message: string }>(`/academic/subjects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteOrArchiveSubject: (id: string) =>
      apiFetch<{ message: string }>(`/academic/subjects/${id}`, {
        method: 'DELETE',
      }),
    bulkImportSubjects: (csv_text: string, academic_year?: string) =>
      apiFetch<{ message: string; imported_count: number }>('/academic/subjects/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ csv_text, academic_year }),
      }),
    listCurricula: () => apiFetch<any[]>('/academic/curricula'),
    createCurriculumVersion: (data: any) =>
      apiFetch<{ message: string; id: string }>('/academic/curricula', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    cloneCurriculum: (data: { source_academic_year: string; target_academic_year: string; branch_code: string; scheme_name?: string }) =>
      apiFetch<{ message: string }>('/academic/curricula/clone', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Module 2C: Bulk Allotment Wizard
    previewBulkAllotment: (data: { academic_year: string; branch_code: string; year_level: string; semester_number: number; division_name: string; subject_ids?: string[] }) =>
      apiFetch<any>('/academic/allotments/preview', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    publishBulkAllotment: (data: { academic_year: string; branch_code: string; year_level: string; semester_number: number; division_name: string; allotments: Array<{ subject_id: string; faculty_id: string }> }) =>
      apiFetch<any>('/academic/allotments/publish', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    listAllotments: (filters?: { academic_year?: string; branch?: string; faculty_id?: string }) => {
      const p = new URLSearchParams();
      if (filters?.academic_year) p.set('academic_year', filters.academic_year);
      if (filters?.branch) p.set('branch', filters.branch);
      if (filters?.faculty_id) p.set('faculty_id', filters.faculty_id);
      return apiFetch<any[]>(`/academic/allotments?${p.toString()}`);
    },

    // Module 4: Laboratory Batches
    listLabBatches: (filters?: { branch?: string; division?: string; year_level?: string; semester?: number; academic_year?: string }) => {
      const p = new URLSearchParams();
      if (filters?.branch) p.set('branch', filters.branch);
      if (filters?.division) p.set('division', filters.division);
      if (filters?.year_level) p.set('year_level', filters.year_level);
      if (filters?.semester) p.set('semester', String(filters.semester));
      if (filters?.academic_year) p.set('academic_year', filters.academic_year);
      return apiFetch<any[]>(`/academic/batches?${p.toString()}`);
    },
    createLabBatch: (data: any) =>
      apiFetch<{ message: string; id: string }>('/academic/batches', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateLabBatch: (batchId: string, data: any) =>
      apiFetch<{ message: string }>(`/academic/batches/${batchId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    assignBatchStudents: (batchId: string, student_ids: string[]) =>
      apiFetch<{ message: string; assigned_count: number }>(`/academic/batches/${batchId}/students`, {
        method: 'POST',
        body: JSON.stringify({ student_ids }),
      }),
    getBatchAllocationMatrix: (filters: {
      branch?: string;
      branch_code?: string;
      division?: string;
      division_name?: string;
      year_level?: string;
      semester?: number;
      semester_number?: number;
      subject_id?: string;
      academic_year?: string;
    }) => {
      const p = new URLSearchParams();
      const branch = filters.branch_code || filters.branch || 'CE';
      const division = filters.division_name || filters.division || 'Div A';
      p.set('branch_code', branch);
      p.set('division_name', division);
      if (filters.academic_year) p.set('academic_year', filters.academic_year);
      if (filters.year_level) p.set('year_level', filters.year_level);
      const sem = filters.semester_number ?? filters.semester;
      if (sem !== undefined && sem !== null) p.set('semester_number', String(sem));
      if (filters.subject_id) p.set('subject_id', filters.subject_id);
      return apiFetch<{
        batches: any[];
        students: any[];
        unassigned_students: any[];
        total_students: number;
        assigned_count: number;
        unassigned_count: number;
      }>(`/academic/batches/allocation-matrix?${p.toString()}`);
    },
    manualAssignBatch: (batchId: string, studentIds: string[], subjectId?: string) =>
      apiFetch<{ message: string; batch_id: string; batch_name: string; assigned_count: number }>('/academic/batches/manual-assign', {
        method: 'POST',
        body: JSON.stringify({ batch_id: batchId, student_ids: studentIds, subject_id: subjectId }),
      }),
    unassignBatchStudents: (batchId: string, studentIds: string[]) =>
      apiFetch<{ message: string }>('/academic/batches/unassign', {
        method: 'POST',
        body: JSON.stringify({ batch_id: batchId, student_ids: studentIds }),
      }),

    // Module 3: Open Electives
    listOpenElectives: (filters?: { branch?: string; semester?: number; academic_year?: string }) => {
      const p = new URLSearchParams();
      if (filters?.branch) p.set('branch', filters.branch);
      if (filters?.semester) p.set('semester', String(filters.semester));
      if (filters?.academic_year) p.set('academic_year', filters.academic_year);
      return apiFetch<any[]>(`/academic/open-electives?${p.toString()}`);
    },
    createOpenElectiveConfig: (data: any) =>
      apiFetch<{ message: string; id: string }>('/academic/open-electives', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    selectOpenElective: (elective_config_id: string, subject_id: string) =>
      apiFetch<{ message: string }>('/academic/open-electives/select', {
        method: 'POST',
        body: JSON.stringify({ elective_config_id, subject_id }),
      }),
    listOpenElectiveSelections: () => apiFetch<any[]>('/academic/open-electives/selections'),
    reviewOpenElectiveSelection: (selection_id: string, status: string, admin_remarks?: string) =>
      apiFetch<{ message: string }>(`/academic/open-electives/selections/${selection_id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, admin_remarks }),
      }),

    // Module 5: Student Promotion Windows & Requests
    listPromotionWindows: () => apiFetch<any[]>('/academic/promotions/windows'),
    createPromotionWindow: (data: any) =>
      apiFetch<{ message: string; id: string }>('/academic/promotions/windows', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    togglePromotionWindow: (windowId: string) =>
      apiFetch<{ message: string; is_open: boolean; status: string }>(`/academic/promotions/windows/${windowId}/toggle`, {
        method: 'PATCH',
      }),
    updatePromotionStatus: (windowId: string, status: string, closing_remarks?: string) =>
      apiFetch<{ message: string; status: string }>(`/academic/promotions/windows/${windowId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, closing_remarks }),
      }),
    getStudentPromotionEligibility: () =>
      apiFetch<{ is_eligible: boolean; window: any; pending_request: any; existing_request: any; current_profile: any }>('/academic/promotions/student-window'),
    applyPromotion: (data: { promotion_window_id: string; cgpa: number; requested_division: string; requested_roll_number: string }) =>
      apiFetch<{ message: string; id: string }>('/academic/promotions/apply', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    submitPromotionRequest: (data: { promotion_window_id: string; cgpa: number; requested_division: string; requested_roll_number: string }) =>
      apiFetch<{ message: string; id: string }>('/academic/promotions/apply', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    listPromotionRequests: (filters?: { window_id?: string; status_filter?: string }) => {
      const p = new URLSearchParams();
      if (filters?.window_id) p.set('window_id', filters.window_id);
      if (filters?.status_filter) p.set('status', filters.status_filter);
      return apiFetch<any[]>(`/academic/promotions/requests?${p.toString()}`);
    },
    reviewPromotionRequest: (requestId: string, status: string, approved_division?: string, approved_roll_number?: string, remarks?: string) =>
      apiFetch<{ message: string }>(`/academic/promotions/requests/${requestId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, approved_division, approved_roll_number, remarks }),
      }),
    exportPromotionCsv: (windowId: string) =>
      downloadAuthenticatedFile(`/academic/promotions/windows/${windowId}/export`, `promotion_records_${windowId}.csv`),

    // Module 10 & 11: Student Enrolled Subjects & Performance (Marks based)
    getStudentEnrolledSubjects: () => apiFetch<any[]>('/academic/student/enrolled-subjects'),
    getStudentPerformanceAverages: () => apiFetch<any[]>('/academic/student/academic-performance'),
    getStudentAcademicPerformance: () => apiFetch<any[]>('/academic/student/academic-performance'),

    // Module 13: Unified Assignment & Deadline Calendar
    getCalendar: () => apiFetch<any[]>('/academic/calendar'),

    // Module 14: Student Academic Portfolio
    getStudentPortfolio: (studentId?: string) =>
      apiFetch<any>(`/academic/student/portfolio${studentId ? `?student_id=${studentId}` : ''}`),

    // Module 15: Administration, Extensions & Data Protection
    extendTaskDeadline: (taskId: string, new_due_date: string, reason?: string) =>
      apiFetch<{ message: string; due_date: string }>(`/academic/tasks/${taskId}/extend-deadline`, {
        method: 'POST',
        body: JSON.stringify({ new_due_date, reason }),
      }),
    requestReevaluation: (submissionId: string, reason: string) =>
      apiFetch<{ message: string; request_id: string }>(`/academic/evaluations/${submissionId}/reevaluation-request`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    listReevaluations: () => apiFetch<any[]>('/academic/evaluations/reevaluation-requests'),
    reviewReevaluation: (requestId: string, status: string, new_marks?: number, remarks?: string) =>
      apiFetch<{ message: string }>(`/academic/evaluations/reevaluation-requests/${requestId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, new_marks, remarks }),
      }),
    assignFacultySubstitution: (data: { original_faculty_id: string; substitute_faculty_id: string; subject_id: string; division_name: string; start_date: string; end_date: string; reason?: string }) =>
      apiFetch<{ message: string; id: string }>('/academic/admin/faculty-substitution', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getAuditLogs: (filters?: { actor_id?: string; action?: string; target_type?: string; limit?: number }) => {
      const p = new URLSearchParams();
      if (filters?.actor_id) p.set('actor_id', filters.actor_id);
      if (filters?.action) p.set('action', filters.action);
      if (filters?.target_type) p.set('target_type', filters.target_type);
      if (filters?.limit) p.set('limit', String(filters.limit));
      return apiFetch<any[]>(`/academic/admin/audit-logs?${p.toString()}`);
    },
    backupDatabase: () =>
      apiFetch<{ message: string; file: string; timestamp: string }>('/academic/admin/backup-database', {
        method: 'POST',
      }),
    resetDemoData: () =>
      apiFetch<{ message: string }>('/academic/admin/reset-demo-data', {
        method: 'POST',
      }),
    exportStudentsCsv: () =>
      downloadAuthenticatedFile('/academic/admin/students/export-csv', 'writeuppro_students_roster.csv'),

    // Module 13: Role-Based Academic Folder System
    getStudentWorkspaceFolders: () => apiFetch<StudentWorkspaceFolders>('/academic/student/workspace-folders'),
    getFacultyTeachingFolders: () => apiFetch<FacultyTeachingFolders>('/academic/faculty/teaching-folders'),
    getAdminClassFolders: (filters?: { academic_year?: string; branch_code?: string; year_level?: string; division_name?: string }) => {
      const p = new URLSearchParams();
      if (filters?.academic_year) p.set('academic_year', filters.academic_year);
      if (filters?.branch_code && filters.branch_code !== 'All') p.set('branch_code', filters.branch_code);
      if (filters?.year_level && filters.year_level !== 'All') p.set('year_level', filters.year_level);
      if (filters?.division_name && filters.division_name !== 'All') p.set('division_name', filters.division_name);
      return apiFetch<AdminClassFoldersResponse>(`/academic/admin/class-folders?${p.toString()}`);
    },
    getAdminClassFolderDetail: (academicGroupId: string) =>
      apiFetch<AdminClassFolderDetail>(`/academic/admin/class-folder-detail?academic_group_id=${academicGroupId}`),
  },

  tasks: {
    listTasks: () => apiFetch<any[]>('/tasks/'),
    getTask: (taskId: string) => apiFetch<any>(`/tasks/${taskId}`),
    createTask: (data: any) =>
      apiFetch<{ message: string; task_id: string }>('/tasks/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    listCustomRubrics: () => apiFetch<any[]>('/tasks/rubrics'),
    createCustomRubric: (data: { title: string; document_category: string; criteria: Array<{ id: string; name: string; max_score: number; guidance?: string }> }) =>
      apiFetch<{ message: string; id: string }>('/tasks/rubrics', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getFacultyTasksOverview: () => apiFetch<any>('/tasks/faculty/overview'),
  },

  documents: {
    listDocuments: () => apiFetch<any[]>('/documents/'),
    getDocument: (docId: string) => apiFetch<any>(`/documents/${docId}`),
    saveDocument: (doc: any, docId?: string) =>
      apiFetch<{ message: string; id: string; updated_at: string }>(`/documents/${docId ? `?doc_id=${docId}` : ''}`, {
        method: 'POST',
        body: JSON.stringify(doc),
      }),
    duplicateDocument: (docId: string) =>
      apiFetch<{ message: string; new_id: string }>(`/documents/${docId}/duplicate`, {
        method: 'POST',
      }),
    deleteDocument: (docId: string) =>
      apiFetch<{ message: string }>(`/documents/${docId}`, {
        method: 'DELETE',
      }),
    restoreVersion: (docId: string, versionNum: number) =>
      apiFetch<{ message: string; content_html: string }>(`/documents/${docId}/versions/${versionNum}/restore`, {
        method: 'POST',
      }),
  },

  submissions: {
    createSubmission: (documentId: string, taskId?: string) =>
      apiFetch<{ message: string; submission_id: string; submission_code: string; submission_date: string }>('/submissions/', {
        method: 'POST',
        body: JSON.stringify({ document_id: documentId, task_id: taskId }),
      }),
    listSubmissions: (filters?: { subject?: string; division?: string; status_filter?: string; batch_id?: string; task_id?: string }) => {
      const params = new URLSearchParams();
      if (filters?.subject) params.set('subject', filters.subject);
      if (filters?.division) params.set('division', filters.division);
      if (filters?.status_filter) params.set('status_filter', filters.status_filter);
      if (filters?.batch_id) params.set('batch_id', filters.batch_id);
      if (filters?.task_id) params.set('task_id', filters.task_id);
      return apiFetch<any[]>(`/submissions/?${params.toString()}`);
    },
    getSubmission: (submissionId: string) => apiFetch<any>(`/submissions/${submissionId}`),
  },

  specialSubmissions: {
    uploadAttachment: async (taskId: string, file: File, documentId?: string) => {
      const token = getAuthToken();
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const formData = new FormData();
      formData.append('task_id', taskId);
      if (documentId) {
        formData.append('document_id', documentId);
      }
      formData.append('file', file);

      const url = `${getApiBase()}/special-submissions/upload`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        let errMsg = `Upload failed with status ${response.status}`;
        try {
          const errData = await response.json();
          errMsg = errData.detail || errMsg;
        } catch {}
        throw new Error(errMsg);
      }
      return await response.json();
    },

    deleteAttachment: (attachmentId: string) =>
      apiFetch<{ message: string; id: string }>(`/special-submissions/attachments/${attachmentId}`, {
        method: 'DELETE',
      }),

    downloadAttachment: (attachmentId: string, filename: string) =>
      downloadAuthenticatedFile(`/special-submissions/attachments/${attachmentId}/download`, filename),

    getAttachmentPreviewUrl: (attachmentId: string) => {
      const token = getAuthToken();
      return `${getApiBase()}/special-submissions/attachments/${attachmentId}/preview${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    },

    submitSpecialDocument: (data: any) =>
      apiFetch<any>('/special-submissions/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  evaluations: {
    submitEvaluation: (data: {
      submission_id: string;
      marks_awarded: number;
      rubric_scores: Record<string, number>;
      feedback?: string;
      remarks?: string;
      action?: string;
    }) =>
      apiFetch<{ message: string; marks_awarded: number; max_marks: number; digital_signature_code: string }>('/evaluations/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    returnSubmission: (submissionId: string, remarks: string) =>
      apiFetch<{ message: string }>(`/evaluations/${submissionId}/return?remarks=${encodeURIComponent(remarks)}`, {
        method: 'POST',
      }),
    getSimilarity: (submissionId: string) =>
      apiFetch<{
        score: number;
        status: string;
        message: string;
        highest_match?: {
          matched_submission_id: string;
          matched_submission_code: string;
          matched_student_name: string;
          matched_roll_number: string;
        };
        matching_excerpts?: string[];
      }>(`/evaluations/${submissionId}/similarity`),
  },

  integrity: {
    logEvent: (event: { document_id?: string; event_type: string; severity?: string; metadata: any }) =>
      apiFetch<{ message: string; event_id: string }>('/integrity/events', {
        method: 'POST',
        body: JSON.stringify(event),
      }),
    listEvents: (filters?: { event_type?: string; severity?: string; status_filter?: string }) => {
      const params = new URLSearchParams();
      if (filters?.event_type) params.set('event_type', filters.event_type);
      if (filters?.severity) params.set('severity', filters.severity);
      if (filters?.status_filter) params.set('status_filter', filters.status_filter);
      return apiFetch<any[]>(`/integrity/events?${params.toString()}`);
    },
    reviewEvent: (eventId: string, review_status: string, admin_remarks?: string) =>
      apiFetch<{ message: string }>(`/integrity/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ review_status, admin_remarks }),
      }),
  },

  analytics: {
    getStudentAnalytics: () => apiFetch<any>('/analytics/student'),
    getFacultyAnalytics: () => apiFetch<any>('/analytics/faculty'),
    getAdminAnalytics: () => apiFetch<any>('/analytics/admin'),
  },

  notifications: {
    getNotifications: () => apiFetch<{ notifications: any[]; unread_count: number }>('/notifications/'),
    markRead: (notifId: string) => apiFetch<{ message: string }>(`/notifications/${notifId}/read`, { method: 'PATCH' }),
    markAllRead: () => apiFetch<{ message: string }>('/notifications/read-all', { method: 'POST' }),
  },

  exports: {
    downloadPdf: (docId: string, title?: string) => {
      const cleanTitle = title ? title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) : docId;
      return downloadAuthenticatedFile(`/exports/pdf/${docId}`, `${cleanTitle}.pdf`);
    },
    downloadGradingLedgerCsv: () =>
      downloadAuthenticatedFile('/exports/ledger/csv', 'writeuppro_grading_ledger.csv'),
    downloadIntegrityLedgerCsv: () =>
      downloadAuthenticatedFile('/exports/integrity/csv', 'writeuppro_integrity_audit_ledger.csv'),
  },
};
