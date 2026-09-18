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
  stock?: { quantity_on_hand: number; average_cost: string | number };
  inventory_units?: InventoryUnit[];
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  has_serials: boolean;
  variants: ProductVariant[];
}

export interface InventoryUnit {
  id: string;
  variant_id: string;
  imei_or_serial: string | null;
  battery_health: number | null;
  cycle_count: number | null;
  sim_type: 'physical' | 'esim' | 'dual';
  condition: string;
  cost_basis?: string | number;
  status: 'in_stock' | 'reserved' | 'sold' | 'damaged' | 'returned';
  location: string;
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

  getProducts: (params?: { category?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    return request<Product[]>(`/products?${query.toString()}`);
  },

  getInventoryUnits: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    return request<InventoryUnit[]>(`/inventory/units?${query.toString()}`);
  },

  intakeInventoryUnit: (data: Partial<InventoryUnit> & { variant_id: string; cost_basis: number; condition: string; sim_type: string }) =>
    request<InventoryUnit>('/inventory/units', {
      method: 'POST',
      body: JSON.stringify(data),
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
};
