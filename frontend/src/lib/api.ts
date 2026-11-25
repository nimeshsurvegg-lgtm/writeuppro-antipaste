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
