import React, { useState, useEffect } from 'react';
import {
  adminApi,
  type AdminTenantItem,
  type AdminTenantDetailResponse,
} from '../../api/adminClient';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import {
  X,
  Building2,
  Phone,
  Mail,
  Calendar,
  ShieldAlert,
  Lock,
  Unlock,
  Package,
  ShoppingCart,
  Users,
  Activity,
  Clock,
  Coins,
  TrendingUp,
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

export const DeviceBadge: React.FC<{
  device?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  className?: string;
}> = ({ device, deviceType, browser, className = '' }) => {
  if (!device) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] text-slate-400 ${className}`}>
        <Globe className="w-3 h-3 text-slate-400" />
        <span>Web App</span>
      </span>
    );
  }

  const isIos = /iPhone|iOS|iPad/i.test(device);
  const isAndroid = /Android/i.test(device);
  const isMac = /Mac/i.test(device);
  const isWindows = /Windows/i.test(device);

  const isMobile = deviceType === 'mobile' || (!deviceType && (isIos || isAndroid));
  const isTablet = deviceType === 'tablet';

  const Icon = isTablet ? Tablet : isMobile ? Smartphone : isMac || isWindows ? Laptop : Monitor;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-medium border ${
        isIos
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300/70 dark:border-slate-700'
          : isAndroid
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50'
          : isMac
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300/70 dark:border-slate-700'
          : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/50'
      } ${className}`}
      title={`${device}${browser ? ` · ${browser}` : ''}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="truncate max-w-[130px]">{device}</span>
    </span>
  );
};

interface TenantDetailDrawerProps {
  tenant: AdminTenantItem | null;
  isOpen: boolean;
  onClose: () => void;
  onLockRequest: (tenant: AdminTenantItem) => void;
  onUnlockRequest: (tenant: AdminTenantItem) => void;
}

export const TenantDetailDrawer: React.FC<TenantDetailDrawerProps> = ({
  tenant,
  isOpen,
  onClose,
  onLockRequest,
  onUnlockRequest,
}) => {
  const [detail, setDetail] = useState<AdminTenantDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'activity'>('overview');

  useEffect(() => {
    if (isOpen && tenant) {
      loadDetail(tenant.id);
    } else {
      setDetail(null);
    }
  }, [isOpen, tenant]);

  const loadDetail = async (id: string) => {
    try {
      setLoading(true);
      const res = await adminApi.getTenantDetail(id);
      setDetail(res);
    } catch (err: any) {
      toast.error('Failed to load store details', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !tenant) return null;

  const logoUrl = tenant.settings?.logo_url;
  const isLocked = tenant.is_locked;

  // Format activity action names into human friendly text
  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\./g, ' › ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#131926] text-slate-900 dark:text-slate-100 shadow-2xl h-full flex flex-col z-10 border-l border-slate-200/80 dark:border-slate-800 animate-slide-in-right">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3.5 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={tenant.name}
                className="w-12 h-12 rounded-xl object-contain border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                {tenant.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {tenant.name}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isLocked
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  {isLocked ? 'Suspended' : 'Active'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">/{tenant.slug}</span>
                <span>•</span>
                <span className="capitalize">{tenant.business_type?.replace(/_/g, ' ') || 'Electronics'}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Calendar className="w-3 h-3" />
                  {new Date(tenant.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isLocked ? (
              <button
                type="button"
                onClick={() => onUnlockRequest(tenant)}
                className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Restore Store</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onLockRequest(tenant)}
                className="h-8 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Suspend</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lock Reason Banner (If Suspended) */}
        {isLocked && tenant.lock_reason && (
          <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              <strong>Suspension Reason:</strong> {tenant.lock_reason}
            </span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="px-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-4 text-xs font-semibold shrink-0 bg-white dark:bg-[#131926]">
          {[
            { key: 'overview', label: 'Overview & Health', icon: Activity },
            { key: 'team', label: `Staff & Team (${detail?.users?.length ?? tenant.users_count})`, icon: Users },
            { key: 'activity', label: 'Live Audit Trail', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-20">
              <CustomPageLoader mode="admin" fullScreen={false} />
            </div>
          ) : !detail ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Failed to load detailed store telemetry.
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & HEALTH */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* 4 Health KPI Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Live Stock</span>
                        <Package className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                        {detail.inventory.total_stock_count} <span className="text-[10px] font-sans font-normal text-slate-400">units</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {detail.inventory.in_stock_units} devices · {detail.inventory.accessories_qty} acc
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Inventory Value</span>
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white truncate">
                        {Number(detail.inventory.inventory_valuation_etb).toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">ETB</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {detail.inventory.total_products} catalog items
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Total Sales</span>
                        <ShoppingCart className="w-3.5 h-3.5 text-sky-500" />
                      </div>
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                        {detail.sales.total_sales_count} <span className="text-[10px] font-sans font-normal text-slate-400">orders</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {detail.inventory.sold_units} devices sold
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-slate-400 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Gross Volume</span>
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div className="text-base font-black font-mono text-slate-900 dark:text-white truncate">
                        {Number(detail.sales.total_sales_volume).toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">ETB</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        All-time revenue
                      </span>
                    </div>
                  </div>

                  {/* Owner & Store Profile Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Store Owner & Contact
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Owner Name</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {detail.tenant.owner?.name || 'Not specified'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                          <Mail className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-slate-400 block">Owner Email</span>
                          <span className="font-mono font-medium text-slate-900 dark:text-white truncate block">
                            {detail.tenant.owner?.email || 'None'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                          <Phone className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Phone</span>
                          <span className="font-mono text-slate-900 dark:text-white">
                            {detail.tenant.phone || detail.tenant.owner?.phone || 'None'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Currency</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {detail.tenant.currency_code}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:col-span-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                        <div className="w-7 h-7 rounded-lg bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                          <Smartphone className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-slate-400">Owner Device:</span>
                          <DeviceBadge
                            device={detail.tenant.owner?.last_device}
                            deviceType={detail.tenant.owner?.last_device_type}
                            browser={detail.tenant.owner?.last_browser}
                          />
                          {detail.tenant.owner?.last_login_at && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              · Active {new Date(detail.tenant.owner.last_login_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial Accounts Section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Treasury & Payment Accounts ({detail.financial_accounts?.length || 0})
                      </span>
                    </div>

                    {detail.financial_accounts.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 text-xs text-slate-400 italic">
                        No financial accounts configured yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {detail.financial_accounts.map((acc) => (
                          <div
                            key={acc.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/70 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-slate-900 dark:text-white block truncate">
                                {acc.name}
                              </span>
                              <span className="text-[10px] text-slate-400 capitalize">
                                {acc.type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {Number(acc.current_balance).toLocaleString()}{' '}
                                <span className="text-[10px] font-normal text-slate-400">{acc.currency}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Orders Section */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Recent Sales Orders
                    </span>

                    {detail.sales.recent_orders.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 text-xs text-slate-400 italic">
                        No sales recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.sales.recent_orders.map((ord) => (
                          <div
                            key={ord.id}
                            className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                                #{ord.order_number.slice(-3)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-900 dark:text-white font-mono block">
                                  {ord.order_number}
                                </span>
                                <span className="text-[10px] text-slate-400 block truncate">
                                  {ord.customer?.name || 'Walk-in Customer'} • {new Date(ord.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                +{Number(ord.total_amount).toLocaleString()} ETB
                              </span>
                              <span className="text-[9px] uppercase font-semibold text-slate-400 block capitalize">
                                {ord.payment_method?.replace(/_/g, ' ') || 'Cash'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: TEAM MEMBERS */}
              {activeTab === 'team' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Store Users & Staff ({detail.users.length})
                    </span>
                  </div>

                  {detail.users.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      No users registered.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detail.users.map((u) => (
                        <div
                          key={u.id}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white truncate">
                                  {u.name}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                  u.role === 'owner'
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                    : u.role === 'manager'
                                    ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                                    : 'bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}>
                                  {u.role}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[11px] font-mono flex-wrap">
                                <span>{u.email}</span>
                                {u.phone && (
                                  <>
                                    <span>•</span>
                                    <span>{u.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/40 dark:border-slate-800/40">
                            <div className="flex flex-col items-start sm:items-end gap-1">
                              <DeviceBadge
                                device={u.last_device}
                                deviceType={u.last_device_type}
                                browser={u.last_browser}
                              />
                              {u.last_login_at ? (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Active {new Date(u.last_login_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Joined {new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>

                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                              u.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                              {u.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: LIVE AUDIT TRAIL */}
              {activeTab === 'activity' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Recent Activity Stream ({detail.recent_activity.length})
                    </span>
                    <span className="text-[10px] text-slate-400">Last 30 actions</span>
                  </div>

                  {detail.recent_activity.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs italic">
                      No activity recorded for this store yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detail.recent_activity.map((act) => (
                        <div
                          key={act.id}
                          className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                              <Activity className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-white block truncate">
                                {formatAction(act.action)}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 flex-wrap">
                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                  {act.user?.name || act.user?.email || 'System'}
                                </span>
                                <span>•</span>
                                <span className="font-mono text-slate-400">{act.entity_type}</span>
                                {act.device_info ? (
                                  <>
                                    <span>•</span>
                                    <DeviceBadge
                                      device={act.device_info.platform}
                                      deviceType={act.device_info.type}
                                      browser={act.device_info.browser}
                                    />
                                  </>
                                ) : act.user?.last_device ? (
                                  <>
                                    <span>•</span>
                                    <DeviceBadge device={act.user.last_device} />
                                  </>
                                ) : null}
                                {act.ip_address && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-400">{act.ip_address}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 shrink-0 whitespace-nowrap">
                            {new Date(act.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
