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
  phone?: string | null;
  owner?: {
    id: string | number;
    name: string;
    email: string;
    phone?: string | null;
    last_device?: string | null;
    last_device_type?: string | null;
    last_browser?: string | null;
    last_login_at?: string | null;
  } | null;
  owner_email?: string | null;
  primary_device?: string | null;
  primary_device_type?: string | null;
  business_type?: string | null;
  currency_code: string;
  created_at: string;
  is_locked: boolean;
  lock_reason?: string | null;
  locked_at?: string | null;
  settings?: Record<string, any> | null;
  users_count: number;
  products_count: number;
  stock_count: number;
  serialized_stock_count: number;
  accessory_stock_count: number;
  sales_count: number;
  sales_volume: number;
  last_activity_at: string;
}

export interface AdminPlatformSummary {
  total_tenants: number;
  active_tenants: number;
  locked_tenants: number;
  total_stock_count: number;
  total_sales_volume: number;
  total_sales_count: number;
  total_users: number;
}

export interface AdminTenantDetailResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
    phone?: string | null;
    business_type?: string | null;
    currency_code: string;
    created_at: string;
    settings?: Record<string, any> | null;
    is_locked: boolean;
    lock_reason?: string | null;
    locked_at?: string | null;
    owner?: {
      id: string | number;
      name: string;
      email: string;
      phone?: string | null;
      last_device?: string | null;
      last_device_type?: string | null;
      last_browser?: string | null;
      last_login_at?: string | null;
    } | null;
  };
  users: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    phone?: string | null;
    is_active: boolean;
    last_device?: string | null;
    last_device_type?: string | null;
    last_browser?: string | null;
    last_login_ip?: string | null;
    last_login_at?: string | null;
    created_at: string;
  }>;
  financial_accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    current_balance: number | string;
    is_active: boolean;
    default_fee_type?: string;
    default_fee_amount?: number | string;
    logo?: string | null;
  }>;
  inventory: {
    total_products: number;
    in_stock_units: number;
    sold_units: number;
    accessories_qty: number;
    total_stock_count: number;
    inventory_valuation_etb: number;
  };
  sales: {
    total_sales_count: number;
    total_sales_volume: number;
    recent_orders: Array<{
      id: string;
      order_number: string;
      customer?: { id: string; name: string } | null;
      total_amount: number | string;
      payment_status: string;
      payment_method?: string;
      created_at: string;
    }>;
  };
  recent_activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    user?: { id: number; name: string; email: string; last_device?: string | null } | null;
    created_at: string;
    ip_address?: string | null;
    user_agent?: string | null;
    device_info?: {
      type: string;
      platform: string;
      browser: string;
      label: string;
      raw?: string | null;
    } | null;
  }>;
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
  summary?: AdminPlatformSummary;
  pagination: AdminPagination;
}

const RAW_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const ADMIN_API_BASE = RAW_API_URL ? `${RAW_API_URL}/api/v1/admin` : '/api/v1/admin';

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
  getTenants: (params?: { page?: number; search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.search) q.set('search', params.search);
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    const qs = q.toString();
    return adminRequest<PaginatedResponse<AdminTenantItem>>(`/tenants${qs ? `?${qs}` : ''}`);
  },

  getTenantDetail: (id: string) =>
    adminRequest<AdminTenantDetailResponse>(`/tenants/${id}`),

  lockTenant: (id: string, reason: string) =>
    adminRequest<{ message: string; tenant: AdminTenantItem }>(`/tenants/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  unlockTenant: (id: string) =>
    adminRequest<{ message: string; tenant: AdminTenantItem }>(`/tenants/${id}/unlock`, {
      method: 'POST',
    }),

  resetTenantData: (id: string) =>
    adminRequest<{ message: string; tenant: { id: string; name: string } }>(`/tenants/${id}/reset-data`, {
      method: 'POST',
    }),

  deleteTenant: (id: string) =>
    adminRequest<{ message: string }>(`/tenants/${id}`, {
      method: 'DELETE',
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

