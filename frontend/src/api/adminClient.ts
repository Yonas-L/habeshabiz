export interface AdminUser {
  id: string;
  name: string;
  email: string;
  last_login_at?: string | null;
}

export interface AdminTenantItem {
  id: string;
  name: string;
  slug: string;
  owner_email?: string | null;
  business_type?: string | null;
  created_at: string;
  is_locked: boolean;
  lock_reason?: string | null;
  locked_at?: string | null;
}

export interface AdminWhitelistItem {
  id: string;
  email: string;
  notes?: string | null;
  status: 'pending' | 'used';
  used_at?: string | null;
  created_at: string;
}

export interface AdminWaitlistItem {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  business_name?: string | null;
  message?: string | null;
  consented: boolean;
  status: 'pending' | 'contacted' | 'approved';
  contacted_at?: string | null;
  created_at: string;
}

export interface AdminSignupAttemptItem {
  id: string;
  email: string;
  business_name?: string | null;
  outcome: 'success' | 'waitlisted' | 'opted_out';
  created_at: string;
}

export interface AdminPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: AdminPagination;
}

const ADMIN_API_BASE = '/api/v1/admin';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function setAdminToken(token: string): void {
  localStorage.setItem('admin_token', token);
}

export function removeAdminToken(): void {
  localStorage.removeItem('admin_token');
}

async function adminRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${ADMIN_API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      removeAdminToken();
      if (typeof window !== 'undefined' && window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }
    const errorMsg = data.message || 'Admin API request failed';
    const err = new Error(errorMsg) as any;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const adminApi = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    adminRequest<{ token: string; admin: AdminUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    adminRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  getMe: () =>
    adminRequest<{ admin: AdminUser }>('/auth/me'),

  // Tenants
  getTenants: (page = 1) =>
    adminRequest<PaginatedResponse<AdminTenantItem>>(`/tenants?page=${page}`),

  lockTenant: (id: string, reason: string) =>
    adminRequest<{ message: string; tenant: AdminTenantItem }>(`/tenants/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  unlockTenant: (id: string) =>
    adminRequest<{ message: string; tenant: AdminTenantItem }>(`/tenants/${id}/unlock`, {
      method: 'POST',
    }),

  // Whitelist
  getWhitelist: (page = 1, status?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status && status !== 'all') params.set('status', status);
    return adminRequest<PaginatedResponse<AdminWhitelistItem>>(`/whitelist?${params.toString()}`);
  },

  addWhitelist: (data: { email: string; notes?: string }) =>
    adminRequest<{ message: string; entry: AdminWhitelistItem }>('/whitelist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteWhitelist: (id: string) =>
    adminRequest<{ message: string }>(`/whitelist/${id}`, {
      method: 'DELETE',
    }),

  // Waitlist
  getWaitlist: (page = 1, filters?: { consented?: boolean; status?: string }) => {
    const params = new URLSearchParams({ page: String(page) });
    if (filters?.consented !== undefined) params.set('consented', String(filters.consented));
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    return adminRequest<PaginatedResponse<AdminWaitlistItem>>(`/waitlist?${params.toString()}`);
  },

  updateWaitlist: (id: string, data: { status: 'pending' | 'contacted' | 'approved' }) =>
    adminRequest<{ message: string; entry: AdminWaitlistItem }>(`/waitlist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Signup Attempts
  getSignupAttempts: (page = 1, outcome?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (outcome && outcome !== 'all') params.set('outcome', outcome);
    return adminRequest<PaginatedResponse<AdminSignupAttemptItem>>(`/signup-attempts?${params.toString()}`);
  },

  // Platform Settings
  getSettings: () =>
    adminRequest<{ settings: Record<string, string> }>('/settings'),

  updateSetting: (key: string, value: string) =>
    adminRequest<{ message: string; key: string; value: string }>('/settings', {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    }),
};
