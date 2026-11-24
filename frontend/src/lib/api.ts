const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
export function getAuthToken(): string | null {
  return localStorage.getItem('writeuppro_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('writeuppro_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('writeuppro_token');
  localStorage.removeItem('writeuppro_user');
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'API Request Failed';
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
      errorDetail = (await response.text()) || response.statusText;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
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
  },

  tasks: {
    listTasks: () => apiFetch<any[]>('/tasks/'),
    getTask: (taskId: string) => apiFetch<any>(`/tasks/${taskId}`),
    createTask: (data: any) =>
      apiFetch<{ message: string; task_id: string }>('/tasks/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
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
    listSubmissions: (filters?: { subject?: string; division?: string; status_filter?: string }) => {
      const params = new URLSearchParams();
      if (filters?.subject) params.set('subject', filters.subject);
      if (filters?.division) params.set('division', filters.division);
      if (filters?.status_filter) params.set('status_filter', filters.status_filter);
      return apiFetch<any[]>(`/submissions/?${params.toString()}`);
    },
    getSubmission: (submissionId: string) => apiFetch<any>(`/submissions/${submissionId}`),
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
    getPdfUrl: (docId: string) => `${API_BASE}/exports/pdf/${docId}`,
    getGradingLedgerCsvUrl: () => `${API_BASE}/exports/ledger/csv`,
    getIntegrityLedgerCsvUrl: () => `${API_BASE}/exports/integrity/csv`,
  },
};
