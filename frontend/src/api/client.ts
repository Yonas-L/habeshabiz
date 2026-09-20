export interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'owner' | 'manager' | 'salesperson' | 'accountant';
  permissions: Record<string, boolean>;
  can_view_costs: boolean;
  can_discount: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  storage: string | null;
  ram: string | null;
  color: string | null;
  default_selling_price: string | number | null;
  specs?: Record<string, any> | null;
  display_name?: string;
  stock?: { quantity_on_hand: number; average_cost: string | number };
  inventory_units?: InventoryUnit[];
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string | null;
  has_serials: boolean;
  spec_fields?: string[] | null;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
  in_stock_units_count?: number;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  category_id?: string | null;
  category_rel?: ProductCategory | null;
  has_serials: boolean;
  variants: ProductVariant[];
}

export interface InventoryUnit {
  id: string;
  variant_id: string;
  imei_or_serial: string | null;
  battery_health: number | null;
  cycle_count: number | null;
  sim_type: 'physical' | 'esim' | 'dual' | 'na';
  condition: string;
  cost_basis?: string | number;
  status: 'in_stock' | 'out' | 'sold' | 'returned' | 'reserved' | 'damaged';
  location: string;
  handover_to?: string | null;
  handed_out_at?: string | null;
  notes?: string | null;
  return_reason?: string | null;
  returned_at?: string | null;
  sold_at?: string | null;
  variant?: ProductVariant & { product?: Product };
  supplier?: Contact;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  roles: string[];
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  variant_id: string;
  inventory_unit_id: string | null;
  quantity: number;
  unit_price: string | number;
  unit_cost?: string | number;
  profit?: string | number;
  sourcing_type: 'internal_stock' | 'brokered_neighbour';
  vendor_contact_id: string | null;
  vendor_contact?: Contact;
  variant?: ProductVariant & { product?: Product };
  inventory_unit?: InventoryUnit;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer?: Contact;
  salesperson_id: number | null;
  salesperson?: User;
  total_amount: string | number;
  discount_amount: string | number;
  paid_amount: string | number;
  payment_status: 'paid' | 'partially_paid' | 'unpaid';
  payment_method: string;
  order_date: string;
  items: SalesOrderItem[];
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: string | number;
  payment_date: string;
  reference_number: string | null;
  financial_account?: FinancialAccount;
}

export interface Debt {
  id: string;
  contact_id: string;
  contact: Contact;
  type: 'receivable' | 'payable';
  reference_type: string;
  original_amount: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
  status: 'open' | 'partially_paid' | 'settled' | 'disputed_loss';
  notes: string | null;
  created_at: string;
  payments?: DebtPayment[];
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'bank' | 'mobile_money' | 'cash' | 'asset_gold' | 'asset_fx';
  account_number: string | null;
  currency: string;
  current_balance: string | number;
  is_custom_asset: boolean;
  asset_details?: Record<string, any>;
}

export interface Expense {
  id: string;
  financial_account_id: string;
  financial_account?: FinancialAccount;
  category: string;
  amount: string | number;
  is_owner_draw: boolean;
  description: string;
  date: string;
}

export interface DashboardData {
  capital_overview: {
    net_capital: number;
    stock_value: number;
    receivables: number;
    cash_and_banks: number;
    custom_assets: number;
    payables: number;
  };
  monthly_performance: {
    revenue: number;
    gross_profit: number;
    operating_expenses: number;
    owner_draws: number;
    net_profit: number;
  };
  counts: {
    in_stock_phones: number;
    open_receivables: number;
    open_payables: number;
  };
  recent_sales: SalesOrder[];
  top_receivables: Debt[];
  top_payables: Debt[];
}

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  permissions?: Record<string, boolean>;
  created_at: string;
  stats: {
    sales_count_week: number;
    sales_volume_week: number;
    sales_count_month: number;
    sales_volume_month: number;
    last_sale_at: string | null;
  };
}

export interface LeaderboardItem {
  rank: number;
  user_id: number;
  name: string;
  email: string;
  week_count: number;
  week_volume: number;
  month_count: number;
  month_volume: number;
  bonus_tier: string;
  bonus_amount: number;
}

export interface AuditLogItem {
  id: string;
  user_id: number | null;
  user?: { id: number; name: string; email: string };
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  created_at: string;
}

export interface StaffTask {
  id: string;
  title: string;
  is_completed: boolean;
  priority: 'high' | 'normal' | 'low';
  due_date?: string | null;
  created_at: string;
}

const API_BASE = '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('habeshabiz_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('habeshabiz_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('habeshabiz_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'API request failed');
  }
  return data.data;
}

export const api = {
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User; tenant: Tenant }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  getMe: () => request<{ user: User; tenant: Tenant }>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  getDashboardSummary: () => request<DashboardData>('/dashboard/summary'),

  // Categories & Taxonomy
  getCategories: () => request<ProductCategory[]>('/categories'),

  createCategory: (data: {
    name: string;
    slug?: string;
    icon?: string;
    description?: string;
    has_serials?: boolean;
    spec_fields?: string[];
    sort_order?: number;
  }) =>
    request<ProductCategory>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (id: string, data: Partial<ProductCategory>) =>
    request<ProductCategory>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: string) =>
    request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    }),

  // Products & Variants Catalog
  getProducts: (params?: { category?: string; category_id?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.search) query.set('search', params.search);
    return request<Product[]>(`/products?${query.toString()}`);
  },

  createProduct: (data: {
    name: string;
    brand?: string;
    category?: string;
    category_id?: string;
    has_serials?: boolean;
    variants: Array<{
      storage?: string;
      ram?: string;
      color?: string;
      specs?: Record<string, any>;
      default_selling_price?: number;
    }>;
  }) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addVariant: (
    productId: string,
    data: {
      storage?: string;
      ram?: string;
      color?: string;
      specs?: Record<string, any>;
      sku?: string;
      default_selling_price?: number;
    }
  ) =>
    request<ProductVariant>(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getInventoryUnits: (params?: { status?: string; category_id?: string; category?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    return request<InventoryUnit[]>(`/inventory/units?${query.toString()}`);
  },

  getInventoryWithCounts: async (params?: { status?: string; category_id?: string; category?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/inventory/units?${query.toString()}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'API request failed');
    return {
      units: (json.data || []) as InventoryUnit[],
      counts: (json.counts || { in_stock: 0, out: 0, sold: 0, returned: 0, all: 0 }) as {
        in_stock: number;
        out: number;
        sold: number;
        returned: number;
        all: number;
      },
    };
  },

  intakeInventoryUnit: (data: {
    variant_id: string;
    cost_basis: number;
    condition: string;
    quantity?: number;
    imei_or_serial?: string | null;
    imeis?: string[];
    selling_price?: number;
    supplier_contact_id?: string | null;
    location?: string;
    notes?: string | null;
    battery_health?: number | null;
    cycle_count?: number | null;
    sim_type?: string;
  }) =>
    request<{ data: InventoryUnit; units_created: number }>('/inventory/units', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  handoverInventoryUnit: (id: string, data: { handover_to: string; location?: string; notes?: string }) =>
    request<InventoryUnit>(`/inventory/units/${id}/handover`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  restockInventoryUnit: (id: string) =>
    request<InventoryUnit>(`/inventory/units/${id}/restock`, {
      method: 'POST',
    }),

  customerReturnInventoryUnit: (id: string, data: { return_reason: string; condition?: string; notes?: string }) =>
    request<InventoryUnit>(`/inventory/units/${id}/customer-return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  repairedRestockInventoryUnit: (id: string, data?: { condition?: string; notes?: string }) =>
    request<InventoryUnit>(`/inventory/units/${id}/repaired-restock`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  getSales: (params?: { payment_status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.payment_status) query.set('payment_status', params.payment_status);
    if (params?.search) query.set('search', params.search);
    return request<SalesOrder[]>(`/sales?${query.toString()}`);
  },

  recordSale: (data: any) =>
    request<SalesOrder>('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getDebts: (params?: { type?: 'receivable' | 'payable'; status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return request<Debt[]>(`/debts?${query.toString()}`);
  },

  settleDebtPayment: (debtId: string, data: { amount: number; financial_account_id: string; reference_number?: string; notes?: string }) =>
    request<{ debt: Debt; payment: DebtPayment }>(`/debts/${debtId}/payments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAccounts: () =>
    request<{
      treasury_accounts: FinancialAccount[];
      asset_accounts: FinancialAccount[];
      total_treasury: number;
      total_assets: number;
      grand_total: number;
    }>('/accounts'),

  transferFunds: (data: { source_account_id: string; destination_account_id: string; amount: number; fee?: number; reference_number?: string; description?: string }) =>
    request<{ source_balance: number; destination_balance: number }>('/accounts/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getContacts: (params?: { role?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.search) query.set('search', params.search);
    return request<Contact[]>(`/contacts?${query.toString()}`);
  },

  getExpenses: (params?: { is_owner_draw?: boolean; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.is_owner_draw !== undefined) query.set('is_owner_draw', String(params.is_owner_draw));
    if (params?.category) query.set('category', params.category);
    return request<Expense[]>(`/expenses?${query.toString()}`);
  },

  recordExpense: (data: { financial_account_id: string; category: string; amount: number; is_owner_draw?: boolean; description: string }) =>
    request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Staff Management (Owner)
  getStaff: () => request<StaffMember[]>('/staff'),

  createStaff: (data: { name: string; phone: string; email?: string; can_discount?: boolean }) =>
    request<{ user: User; temporary_password: string }>('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggleStaffStatus: (id: number) =>
    request<User>(`/staff/${id}/toggle-status`, {
      method: 'PATCH',
    }),

  resetStaffPassword: (id: number) =>
    request<{ temporary_password: string }>(`/staff/${id}/reset-password`, {
      method: 'POST',
    }),

  getLeaderboard: () =>
    request<{ leaderboard: LeaderboardItem[]; top_seller: LeaderboardItem | null }>('/staff/leaderboard'),

  getAuditLogs: () => request<AuditLogItem[]>('/staff/audit-logs'),

  // Staff Tasks & Targets Checklist
  getTasks: () => request<StaffTask[]>('/tasks'),

  createTask: (data: { title: string; priority?: string; due_date?: string }) =>
    request<StaffTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggleTask: (id: string) =>
    request<StaffTask>(`/tasks/${id}/toggle`, {
      method: 'PATCH',
    }),

  deleteTask: (id: string) =>
    request<{ message: string }>(`/tasks/${id}`, {
      method: 'DELETE',
    }),

  // User Self-Management Profile & Password
  changePassword: (data: { current_password: string; new_password: string; new_password_confirmation: string }) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProfile: (data: { name: string; phone?: string }) =>
    request<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
