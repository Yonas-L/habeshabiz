export interface TenantSettings {
  city?: string;
  address?: string;
  team_size?: string;
  tin_number?: string;
  logo_url?: string | null;
  footer_note?: string;
  secondary_currencies?: string[];
  vat_registered?: boolean;
  [key: string]: any;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  currency_code?: string;
  business_type?: string;
  phone?: string;
  settings?: TenantSettings;
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
  can_handover?: boolean;
  can_intake_stock?: boolean;
  can_manage_inventory?: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  storage: string | null;
  ram: string | null;
  color: string | null;
  sku?: string | null;
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
  is_active?: boolean;
  is_archived?: boolean;
  variants: ProductVariant[];
}

export interface MaintenanceRecord {
  id: string;
  inventory_unit_id: string;
  cost: string | number;
  is_capitalized: boolean;
  billing_type?: 'shop' | 'vendor_deduct' | string;
  vendor_contact_id?: string | null;
  vendor_contact?: Contact;
  vendor_debt_id?: string | null;
  financial_account_id?: string | null;
  description: string;
  date: string;
  created_at?: string;
  financial_account?: FinancialAccount;
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
  selling_price?: string | number | null;
  status: 'in_stock' | 'out' | 'sold' | 'returned' | 'returned_to_vendor' | 'reserved' | 'damaged' | 'fixed';
  customer_waiting?: boolean;
  customer_waiting_at?: string | null;
  is_repaired?: boolean;
  is_swapped?: boolean;
  swapped_at?: string | null;
  swapped_sales_order_id?: string | null;
  swapped_from_unit_id?: string | null;
  swapped_replacement_unit_id?: string | null;
  swapped_sales_order?: SalesOrder;
  swapped_from_unit?: InventoryUnit;
  swapped_replacement_unit?: InventoryUnit;
  source_type?: 'purchase' | 'consignment' | 'exchange' | 'vendor_direct';
  supplier_contact_id?: string | null;
  funding_source?: string | null;
  payment_account_id?: string | null;
  receivable_contact_id?: string | null;
  receivable_offset_amount?: string | number | null;
  exchange_sales_order_id?: string | null;
  return_deadline?: string | null;
  handover_payout?: string | number | null;
  location: string;
  handover_to?: string | null;
  handed_out_at?: string | null;
  notes?: string | null;
  return_reason?: string | null;
  returned_at?: string | null;
  sold_at?: string | null;
  created_at?: string;
  updated_at?: string;
  variant?: ProductVariant & { product?: Product };
  supplier?: Contact;
  maintenance_records?: MaintenanceRecord[];
  sales_order_item?: SalesOrderItem;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  alt_phone?: string | null;
  email?: string | null;
  roles: string[];
  notes?: string | null;
  is_active?: boolean;
  statement_token?: string | null;
  created_at?: string;
  updated_at?: string;
  debts_count?: number;
  sales_orders_count?: number;
  brokered_items_count?: number;
  supplied_units_count?: number;
  net_balance?: number;
  open_receivable?: number;
  open_payable?: number;
}

export interface StatementLedgerRow {
  id: string;
  date: string;
  formatted_date: string;
  type: string;
  type_label: string;
  context: string;
  payable: number;
  receivable: number;
  balance_effect: number;
  running_balance: number;
  reference_number: string | null;
}

export interface StatementSuppliedUnit {
  id: string;
  model: string;
  specs: string[];
  imei_or_serial: string | null;
  status: string;
  location: string | null;
  cost_basis: number;
  selling_price: number;
  source_type: string;
  created_at: string;
  sold_at: string | null;
  order_number: string | null;
}

export interface StatementHandedOutUnit {
  id: string;
  model: string;
  specs: string[];
  imei_or_serial: string | null;
  status: string;
  location: string | null;
  handed_out_at: string | null;
  handover_payout: number;
}

export interface StatementVendorReturnUnit {
  id: string;
  model: string;
  specs: string[];
  imei_or_serial: string | null;
  status: string;
  return_reason: string | null;
  returned_at: string | null;
  maintenance_cost: number;
}

export interface PartnerStatementData {
  contact: {
    id: string;
    name: string;
    phone: string | null;
    alt_phone?: string | null;
    email?: string | null;
    roles: string[];
    statement_token: string;
  };
  range: {
    start_date: string | null;
    end_date: string | null;
    formatted_range: string;
  };
  kpis: {
    current_open_payable: number;
    current_open_receivable: number;
    current_net_balance: number;
    balance_verdict: string;
    range_opening_balance: number;
    range_closing_balance: number;
    range_payable_total: number;
    range_receivable_total: number;
    range_paid_to_vendor: number;
    range_received_from_vendor: number;
    supplied_units_count: number;
    supplied_in_stock_count: number;
    handed_out_count: number;
    repairs_count: number;
  };
  business: {
    name: string;
    branch: string;
    phone: string;
    email: string;
    logo_url?: string | null;
    tin_number?: string | null;
    footer_note?: string | null;
    bank_accounts: Array<{
      id: string;
      name: string;
      account_number: string | null;
      type: string;
      logo?: string | null;
    }>;
  };
  ledger: StatementLedgerRow[];
  supplied_units: StatementSuppliedUnit[];
  handed_out_units: StatementHandedOutUnit[];
  vendor_return_units: StatementVendorReturnUnit[];
}

export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  variant_id: string;
  inventory_unit_id: string | null;
  quantity: number;
  unit_price: string | number;
  setted_price?: string | number | null;
  unit_cost?: string | number;
  profit?: string | number;
  bonus_amount?: string | number;
  sourcing_type: 'internal_stock' | 'brokered_neighbour';
  vendor_contact_id: string | null;
  vendor_contact?: Contact;
  variant?: ProductVariant & { product?: Product };
  inventory_unit?: InventoryUnit;
  sales_order?: SalesOrder;
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
  exchange_allowance?: string | number;
  exchange_unit_id?: string | null;
  exchange_unit?: InventoryUnit;
  total_bonus_amount?: string | number;
  paid_amount: string | number;
  payment_status: 'paid' | 'partially_paid' | 'unpaid';
  payment_method: string;
  financial_account_id?: string | null;
  financial_account?: FinancialAccount;
  is_vendor_sourced?: boolean;
  vendor_contact_id?: string | null;
  vendor_cost_basis?: string | number | null;
  vendor_payment_status?: string | null;
  vendor?: Contact | null;
  order_date: string;
  notes?: string | null;
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
  due_date: string | null;
  notes: string | null;
  created_at: string;
  payments?: DebtPayment[];
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'bank' | 'mobile_money' | 'cash' | 'asset_gold' | 'asset_fx' | 'custom';
  account_number: string | null;
  currency: string;
  current_balance: string | number;
  default_fee_type?: 'none' | 'percentage' | 'fixed' | null;
  default_fee_amount?: string | number | null;
  is_custom_asset: boolean;
  is_active?: boolean;
  asset_details?: Record<string, any> | null;
  logo?: string | null;
}

export interface AccountActivity {
  id: string;
  transaction_number: string;
  date: string;
  type: string;
  type_label: string;
  direction: 'inflow' | 'outflow';
  amount: number;
  fee: number;
  inflow: number;
  outflow: number;
  net_effect: number;
  balance_after: number;
  reference_number: string | null;
  contact_id: string | null;
  counterparty: string | null;
  description: string | null;
  created_by: string | null;
}

export interface AccountActivitiesResponse {
  account: FinancialAccount;
  summary: {
    current_balance: number;
    total_inflow: number;
    total_outflow: number;
    net_flow: number;
    filtered_inflow: number;
    filtered_outflow: number;
    filtered_net: number;
    total_count: number;
    filtered_count: number;
  };
  activities: AccountActivity[];
}

export interface Expense {
  id: string;
  financial_account_id: string;
  financial_account?: FinancialAccount;
  category: string;
  amount: string | number;
  is_owner_draw: boolean;
  description: string;
  inventory_unit_id?: string | null;
  inventory_unit?: InventoryUnit;
  vendor_billing?: 'shop' | 'vendor_deduct' | string | null;
  vendor_contact_id?: string | null;
  vendor_contact?: Contact;
  date: string;
}

export interface DashboardSalesChartPoint {
  date: string;
  day: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface PartnerSettlementItem {
  id: string;
  name: string;
  phone: string | null;
  statement_token?: string | null;
  open_receivable: number;
  open_payable: number;
  net_balance: number;
  verdict: 'owes_us' | 'we_owe' | 'settled';
  active_handovers_count: number;
  supplied_in_stock_count: number;
}

export interface PartnerSettlementsOverview {
  partners_owing_us_count: number;
  total_owed_to_us_net: number;
  partners_we_owe_count: number;
  total_we_owe_net: number;
  partners: PartnerSettlementItem[];
}

export interface DashboardData {
  capital_overview: {
    net_capital: number;
    stock_value: number;
    receivables: number;
    cash_and_banks: number;
    custom_assets: number;
    liquid_finance?: number;
    forex_assets?: number;
    gold_assets?: number;
    other_assets?: number;
    payables: number;
  };
  monthly_performance: {
    selected_month?: string;
    revenue: number;
    gross_profit: number;
    operating_expenses: number;
    manual_expenses?: number;
    transaction_fees?: number;
    owner_draws: number;
    net_profit: number;
  };
  counts: {
    in_stock_phones: number;
    open_receivables: number;
    open_receivable_parties?: number;
    open_payables: number;
    open_payable_parties?: number;
    uncollected_staff_bonuses?: number;
    pending_bonus_staff_count?: number;
  };
  partner_settlements?: PartnerSettlementsOverview;
  recent_sales: SalesOrder[];
  top_receivables: Debt[];
  top_payables: Debt[];
  sales_chart?: DashboardSalesChartPoint[];
}

export interface StaffMember {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  permissions?: {
    can_discount?: boolean;
    can_handover?: boolean;
    can_intake_stock?: boolean;
    can_view_costs?: boolean;
    can_manage_inventory?: boolean;
    [key: string]: boolean | undefined;
  };
  created_at: string;
  stats: {
    sales_count_week: number;
    sales_volume_week: number;
    sales_count_month: number;
    sales_volume_month: number;
    uncollected_bonus?: number;
    collected_bonus?: number;
    total_bonus_earned?: number;
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
  uncollected_bonus?: number;
  collected_bonus?: number;
  total_bonus_earned?: number;
}

export interface AuditLogItem {
  id: string;
  user_id: number | null;
  user?: { id: number; name: string; email: string; role?: string } | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values?: any;
  new_values?: any;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditLogsResponse {
  items: AuditLogItem[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    has_more: boolean;
  };
  summary: {
    total_count: number;
    today_count: number;
    filtered_count: number;
  };
  filter_options: {
    actions: string[];
    entity_types: string[];
    users: Array<{ id: number; name: string; role: string }>;
  };
}

export interface StaffTask {
  id: string;
  title: string;
  is_completed: boolean;
  priority: 'high' | 'normal' | 'low';
  due_date?: string | null;
  created_at: string;
}

const DEFAULT_BACKEND_URL = 'https://habeshabiz-backend.onrender.com';

const RAW_API_URL = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : DEFAULT_BACKEND_URL)
).replace(/\/$/, '');

const API_BASE = RAW_API_URL ? `${RAW_API_URL}/api/v1` : '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('habeshabiz_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('habeshabiz_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('habeshabiz_token');
}

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  const backendOrigin =
    RAW_API_URL ||
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? ''
      : DEFAULT_BACKEND_URL);

  const storageIndex = trimmed.indexOf('/storage/');
  if (storageIndex !== -1) {
    const path = trimmed.slice(storageIndex);
    return backendOrigin ? `${backendOrigin}${path}` : path;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      const cleanPath = trimmed.replace(/^https?:\/\/[^\/]+/, '');
      return backendOrigin ? `${backendOrigin}${cleanPath}` : cleanPath;
    }
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
      return trimmed.replace(/^http:\/\//i, 'https://');
    }
    return trimmed;
  }

  return backendOrigin ? `${backendOrigin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}` : trimmed;
}

export class ApiError extends Error {
  status: number;
  error?: string;
  attempt_id?: string;
  lock_reason?: string;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.error = data?.error;
    this.attempt_id = data?.attempt_id;
    this.lock_reason = data?.lock_reason;
    this.data = data;
  }
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

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 403 && data.error === 'tenant_suspended') {
      removeAuthToken();
      if (typeof window !== 'undefined') {
        localStorage.setItem('habeshabiz_lock_reason', data.lock_reason || '');
        if (window.location.pathname !== '/suspended') {
          window.location.href = '/suspended';
        }
      }
    }

    throw new ApiError(data.message || 'API request failed', res.status, data);
  }

  return data.data !== undefined ? data.data : data;
}

export interface WaitlistPayload {
  name: string;
  email: string;
  phone?: string;
  business_name?: string;
  message?: string;
  consented: boolean;
  attempt_id?: string;
}

export interface OnboardingPayload {
  business_type: 'electronics' | 'general_retail' | 'clothing' | 'food_beverage';
  business_name: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  password: string;
  city: string;
  team_size: string;
  logo?: File | null;
}

export interface SettingsProfileResponse {
  tenant: {
    id: string;
    name: string;
    slug: string;
    phone: string;
    currency_code: string;
    business_type: string;
    city: string;
    address: string;
    team_size: string;
    tin_number: string;
    logo_url: string | null;
    footer_note: string;
    secondary_currencies: string[];
  };
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
}

export interface UpdateSettingsPayload {
  name: string;
  phone?: string;
  currency_code?: string;
  city?: string;
  address?: string;
  tin_number?: string;
  footer_note?: string;
  secondary_currencies?: string[];
  owner_name?: string;
  owner_phone?: string;
}

export interface BankFeeItem {
  id: string;
  type: string;
  amount: number;
  fee: number;
  description: string;
  date: string;
  source_account?: {
    id: string;
    name: string;
    type: string;
    currency: string;
  } | null;
}

export interface ExpensesData {
  expenses: Expense[];
  bank_fees: BankFeeItem[];
  total_bank_fees: number;
}

export const api = {
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User; tenant: Tenant }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  onboard: (data: OnboardingPayload) => {
    if (data.logo instanceof File) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          formData.append(key, val);
        }
      });
      return request<{ token: string; user: User; tenant: Tenant }>('/onboard', {
        method: 'POST',
        body: formData,
      });
    }

    return request<{ token: string; user: User; tenant: Tenant }>('/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  joinWaitlist: (payload: WaitlistPayload) =>
    request<{ message: string }>('/waitlist', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: () => request<{ user: User; tenant: Tenant }>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  getDashboardSummary: (month?: string) =>
    request<DashboardData>(month ? `/dashboard/summary?month=${month}` : '/dashboard/summary'),

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
  getProducts: (params?: { category?: string; category_id?: string; search?: string; include_inactive?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.search) query.set('search', params.search);
    if (params?.include_inactive) query.set('include_inactive', '1');
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

  updateProduct: (
    id: string,
    data: {
      name?: string;
      brand?: string;
      category_id?: string;
      category?: string;
      has_serials?: boolean;
      is_active?: boolean;
    }
  ) =>
    request<{ success: boolean; message: string; data: Product }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: string) =>
    request<{ success: boolean; message: string; deleted?: boolean; deactivated?: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    }),

  archiveProduct: (id: string) =>
    request<{ success: boolean; message: string; data: Product }>(`/products/${id}/archive`, {
      method: 'POST',
    }),

  unarchiveProduct: (id: string) =>
    request<{ success: boolean; message: string; data: Product }>(`/products/${id}/unarchive`, {
      method: 'POST',
    }),

  updateVariant: (
    id: string,
    data: {
      storage?: string;
      ram?: string;
      color?: string;
      specs?: Record<string, any>;
      sku?: string;
      default_selling_price?: number;
    }
  ) =>
    request<{ success: boolean; message: string; data: ProductVariant }>(`/variants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteVariant: (id: string) =>
    request<{ success: boolean; message: string }>(`/variants/${id}`, {
      method: 'DELETE',
    }),

  getInventoryUnits: (params?: { status?: string; category_id?: string; category?: string; search?: string; variant_id?: string; product_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.variant_id) query.set('variant_id', params.variant_id);
    if (params?.product_id) query.set('product_id', params.product_id);
    return request<InventoryUnit[]>(`/inventory/units?${query.toString()}`);
  },

  getInventoryWithCounts: async (params?: { status?: string; category_id?: string; category?: string; search?: string; variant_id?: string; product_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.category_id) query.set('category_id', params.category_id);
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.variant_id) query.set('variant_id', params.variant_id);
    if (params?.product_id) query.set('product_id', params.product_id);
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
      counts: (json.counts || { in_stock: 0, vendor_stock: 0, exchange_stock: 0, out: 0, sold: 0, returned: 0, returned_to_vendor: 0, all: 0 }) as {
        in_stock: number;
        vendor_stock: number;
        exchange_stock?: number;
        out: number;
        sold: number;
        returned: number;
        returned_to_vendor: number;
        all: number;
      },
    };
  },

  intakeInventoryUnit: (data: {
    variant_id?: string;
    cost_basis?: number;
    condition?: string;
    quantity?: number;
    imei_or_serial?: string | null;
    imeis?: string[];
    selling_price?: number;
    source_type?: 'purchase' | 'consignment';
    supplier_contact_id?: string | null;
    return_deadline?: string | null;
    location?: string;
    notes?: string | null;
    battery_health?: number | null;
    cycle_count?: number | null;
    sim_type?: string;
    funding_source?: 'none' | 'account' | 'debtor_offset' | 'split';
    payment_account_id?: string | null;
    receivable_contact_id?: string | null;
    receivable_offset_amount?: number;
    units?: Array<{
      variant_id: string;
      imei_or_serial?: string | null;
      battery_health?: number | null;
      cycle_count?: number | null;
      sim_type?: string;
      condition: string;
      cost_basis: number;
      selling_price?: number | null;
      location?: string;
      notes?: string | null;
    }>;
  }) =>
    request<{ data: InventoryUnit; units_created: number }>('/inventory/units', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateInventoryUnit: (
    id: string,
    data: {
      imei_or_serial?: string | null;
      condition?: string;
      cost_basis?: number;
      selling_price?: number | null;
      battery_health?: number | null;
      cycle_count?: number | null;
      sim_type?: string;
      location?: string;
      notes?: string | null;
      supplier_contact_id?: string | null;
    }
  ) =>
    request<InventoryUnit>(`/inventory/units/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  handoverInventoryUnit: (id: string, data: { handover_to: string; location?: string; notes?: string; return_deadline?: string; handover_payout?: number }) =>
    request<InventoryUnit>(`/inventory/units/${id}/handover`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  markHandoverSold: (
    id: string,
    data: {
      settlement_type: 'paid' | 'offset' | 'credit';
      selling_price?: number;
      financial_account_id?: string;
      payment_date?: string;
      reference_number?: string;
      notes?: string;
    }
  ) =>
    request<InventoryUnit>(`/inventory/units/${id}/mark-handover-sold`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  restockInventoryUnit: (id: string) =>
    request<InventoryUnit>(`/inventory/units/${id}/restock`, {
      method: 'POST',
    }),

  customerReturnInventoryUnit: (id: string, data: { return_reason: string; condition?: string; notes?: string; destination?: 'repair' | 'vendor'; customer_waiting?: boolean }) =>
    request<InventoryUnit>(`/inventory/units/${id}/customer-return`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  swapInventoryUnit: (
    id: string,
    data: {
      replacement_unit_id: string;
      swap_reason: string;
      destination?: 'repair' | 'in_stock';
      condition?: string;
      notes?: string;
    }
  ) =>
    request<{ old_unit: InventoryUnit; replacement_unit: InventoryUnit }>(`/inventory/units/${id}/swap`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  returnUnitToVendor: (id: string, data?: { return_reason?: string; notes?: string }) =>
    request<InventoryUnit>(`/inventory/units/${id}/return-to-vendor`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  receiveFromVendor: (
    id: string,
    data: {
      action: 'deliver_to_customer' | 'restock';
      condition?: string;
      battery_health?: number;
      cycle_count?: number;
      notes?: string;
      new_selling_price?: number;
      imei_or_serial?: string;
    }
  ) =>
    request<{ success: boolean; message: string; data: InventoryUnit }>(`/inventory/units/${id}/receive-from-vendor`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  vendorSwap: (
    id: string,
    data: {
      replacement_imei: string;
      action: 'deliver_to_customer' | 'restock';
      condition?: string;
      battery_health?: number;
      cycle_count?: number;
      sim_type?: 'physical' | 'esim' | 'dual' | 'na';
      notes?: string;
      new_selling_price?: number;
    }
  ) =>
    request<{ success: boolean; message: string; data: { old_unit: InventoryUnit; replacement_unit: InventoryUnit } }>(`/inventory/units/${id}/vendor-swap`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  repairedRestockInventoryUnit: (id: string, data?: { action?: 'restock' | 'deliver_to_customer'; condition?: string; notes?: string; new_selling_price?: number; cost_basis?: number; imei_or_serial?: string }) =>
    request<InventoryUnit>(`/inventory/units/${id}/repaired-restock`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  getSales: (params?: { payment_status?: string; source_type?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.payment_status) query.set('payment_status', params.payment_status);
    if (params?.source_type) query.set('source_type', params.source_type);
    if (params?.search) query.set('search', params.search);
    return request<SalesOrder[]>(`/sales?${query.toString()}`);
  },

  getSalesWithCounts: async (params?: { payment_status?: string; source_type?: string; search?: string; per_page?: number | string }) => {
    const query = new URLSearchParams();
    if (params?.payment_status) query.set('payment_status', params.payment_status);
    if (params?.source_type) query.set('source_type', params.source_type);
    if (params?.search) query.set('search', params.search);
    if (params?.per_page) query.set('per_page', String(params.per_page));
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/sales?${query.toString()}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'API request failed');
    return {
      sales: (json.data || []) as SalesOrder[],
      counts: (json.counts || { all: 0, paid: 0, credit: 0, exchange: 0 }) as {
        all: number;
        paid: number;
        credit: number;
        exchange: number;
      },
      pagination: json.pagination,
    };
  },

  recordSale: (data: any) =>
    request<SalesOrder>('/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  vendorDirectSale: (data: {
    product_id?: string;
    variant_id?: string;
    product_name?: string;
    storage?: string;
    ram?: string;
    color?: string;
    imei_or_serial?: string;
    condition?: string;
    vendor_contact_id: string;
    vendor_cost: number;
    vendor_payment_method: 'paid_now' | 'owed';
    vendor_payment_account_id?: string | null;
    selling_price: number;
    paid_amount: number;
    payment_method: 'cash' | 'telebirr' | 'cbe' | 'bank_transfer' | 'credit';
    financial_account_id?: string | null;
    customer_id?: string | null;
    customer_name?: string;
    customer_phone?: string;
    notes?: string;
  }) =>
    request<SalesOrder>('/sales/vendor-direct', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  collectSalesPayment: (
    orderId: string,
    data: {
      amount: number;
      financial_account_id: string;
      reference_number?: string;
      notes?: string;
    }
  ) =>
    request<{ success: boolean; message: string; data: SalesOrder }>(`/sales/${orderId}/collect`, {
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

  createDebt: (data: {
    type: 'receivable' | 'payable';
    contact_id?: string;
    contact_name?: string;
    contact_phone?: string;
    amount: number;
    due_date?: string;
    notes?: string;
    disburse_account_id?: string;
    cash_flow_direction?: 'in' | 'out' | 'none';
  }) =>
    request<Debt>('/debts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDebt: (id: string, data: { amount?: number; due_date?: string | null; notes?: string | null }) =>
    request<Debt>(`/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDebt: (id: string) =>
    request<{ message: string }>(`/debts/${id}`, {
      method: 'DELETE',
    }),

  getAccounts: (params?: { month?: string }) => {
    const qs = params?.month ? `?month=${encodeURIComponent(params.month)}` : '';
    return request<{
      treasury_accounts: FinancialAccount[];
      asset_accounts: FinancialAccount[];
      total_treasury: number;
      total_assets: number;
      grand_total: number;
    }>(`/accounts${qs}`);
  },

  transferFunds: (data: { source_account_id: string; destination_account_id: string; amount: number; fee?: number; reference_number?: string; description?: string }) =>
    request<{ source_balance: number; destination_balance: number }>('/accounts/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createAccount: (data: {
    name: string;
    type: string;
    account_number?: string;
    currency?: string;
    opening_balance?: number;
    default_fee_type?: 'none' | 'percentage' | 'fixed' | null;
    default_fee_amount?: number | null;
    is_custom_asset?: boolean;
    asset_details?: Record<string, any>;
    logo?: string | null;
  }) =>
    request<FinancialAccount>('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAccount: (id: string, data: {
    name?: string;
    type?: string;
    account_number?: string | null;
    currency?: string;
    default_fee_type?: 'none' | 'percentage' | 'fixed' | null;
    default_fee_amount?: number | null;
    is_custom_asset?: boolean;
    is_active?: boolean;
    asset_details?: Record<string, any> | null;
    balance_adjustment?: number;
    current_balance?: number;
    logo?: string | null;
  }) =>
    request<FinancialAccount>(`/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteAccount: (id: string) =>
    request<{ message: string; deactivated?: boolean }>(`/accounts/${id}`, {
      method: 'DELETE',
    }),

  getAccountActivities: (
    id: string,
    params?: {
      type?: string;
      search?: string;
      start_date?: string;
      end_date?: string;
    }
  ) => {
    const query = new URLSearchParams();
    if (params?.type && params.type !== 'all') query.set('type', params.type);
    if (params?.search) query.set('search', params.search);
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    const qs = query.toString();
    return request<AccountActivitiesResponse>(`/accounts/${id}/activities${qs ? `?${qs}` : ''}`);
  },

  getContacts: (params?: { role?: string; search?: string; is_active?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.search) query.set('search', params.search);
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
    return request<Contact[]>(`/contacts?${query.toString()}`);
  },

  getContact: (id: string) =>
    request<Contact>(`/contacts/${id}`),

  createContact: (data: {
    name: string;
    phone?: string | null;
    alt_phone?: string | null;
    email?: string | null;
    roles: string[];
    notes?: string | null;
    is_active?: boolean;
  }) =>
    request<Contact>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateContact: (id: string, data: Partial<Contact>) =>
    request<Contact>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteContact: (id: string) =>
    request<{ message: string; can_deactivate?: boolean }>(`/contacts/${id}`, {
      method: 'DELETE',
    }),

  getPartnerStatement: (id: string, params?: { start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    const qs = query.toString();
    return request<PartnerStatementData>(`/contacts/${id}/statement${qs ? `?${qs}` : ''}`);
  },

  getPublicStatement: (token: string, params?: { start_date?: string; end_date?: string }) => {
    const query = new URLSearchParams();
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    const qs = query.toString();
    return request<PartnerStatementData>(`/public/statement/${token}${qs ? `?${qs}` : ''}`);
  },

  getExpenses: (params?: { is_owner_draw?: boolean; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.is_owner_draw !== undefined) query.set('is_owner_draw', String(params.is_owner_draw));
    if (params?.category) query.set('category', params.category);
    return request<ExpensesData>(`/expenses?${query.toString()}`);
  },

  recordExpense: (data: { financial_account_id: string; inventory_unit_id?: string; category: string; amount: number; is_owner_draw?: boolean; vendor_billing?: 'shop' | 'vendor_deduct' | 'vendor_reimburse'; vendor_contact_id?: string; description: string; date?: string }) =>
    request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Staff Management (Owner)
  getStaff: () => request<StaffMember[]>('/staff'),

  createStaff: (data: {
    name: string;
    phone: string;
    email?: string;
    can_discount?: boolean;
    can_handover?: boolean;
    can_intake_stock?: boolean;
    can_view_costs?: boolean;
    can_manage_inventory?: boolean;
  }) =>
    request<{ user: User; temporary_password: string }>('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateStaff: (
    id: number,
    data: {
      name: string;
      phone: string;
      email?: string;
      can_discount?: boolean;
      can_handover?: boolean;
      can_intake_stock?: boolean;
      can_view_costs?: boolean;
      can_manage_inventory?: boolean;
    }
  ) =>
    request<StaffMember>(`/staff/${id}`, {
      method: 'PUT',
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

  getLeaderboard: (month?: string) =>
    request<{ leaderboard: LeaderboardItem[]; top_seller: LeaderboardItem | null }>(
      month ? `/staff/leaderboard?month=${month}` : '/staff/leaderboard'
    ),

  getAuditLogs: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    action?: string;
    entity_type?: string;
    user_id?: string | number;
    start_date?: string;
    end_date?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.search) query.set('search', params.search);
    if (params?.action && params.action !== 'all') query.set('action', params.action);
    if (params?.entity_type && params.entity_type !== 'all') query.set('entity_type', params.entity_type);
    if (params?.user_id && params.user_id !== 'all') query.set('user_id', String(params.user_id));
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    const qs = query.toString();
    return request<AuditLogsResponse>(qs ? `/staff/audit-logs?${qs}` : '/staff/audit-logs');
  },

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

  // Business Settings Profile & Logo
  getSettingsProfile: () => request<SettingsProfileResponse>('/settings/profile'),
  updateSettingsProfile: (data: UpdateSettingsPayload) =>
    request<SettingsProfileResponse>('/settings/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  uploadBusinessLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return request<{ logo_url: string }>('/settings/profile/logo', {
      method: 'POST',
      body: formData,
    });
  },
};
