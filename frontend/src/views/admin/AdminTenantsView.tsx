import React, { useState, useEffect } from 'react';
import {
  adminApi,
  type AdminTenantItem,
  type AdminPagination,
  type AdminPlatformSummary,
} from '../../api/adminClient';
import { TenantDetailDrawer, DeviceBadge } from './TenantDetailDrawer';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import { toast } from 'sonner';
import {
  Lock,
  Unlock,
  Loader2,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Package,
  Users,
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
  TrendingUp,
  X,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export const AdminTenantsView: React.FC = () => {
  const [tenants, setTenants] = useState<AdminTenantItem[]>([]);
  const [summary, setSummary] = useState<AdminPlatformSummary | null>(null);
  const [pagination, setPagination] = useState<AdminPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Search & Status Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked'>('all');

  // Registration Setting
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showToggleModal, setShowToggleModal] = useState(false);

  // Drawer & Action Modal State
  const [selectedTenantForDetail, setSelectedTenantForDetail] = useState<AdminTenantItem | null>(null);
  const [tenantToLock, setTenantToLock] = useState<AdminTenantItem | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [tenantToReset, setTenantToReset] = useState<AdminTenantItem | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [tenantToDelete, setTenantToDelete] = useState<AdminTenantItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData(1, searchQuery, statusFilter);
    loadSettings();
  }, [statusFilter]);

  const loadData = async (page = 1, search = searchQuery, status = statusFilter) => {
    try {
      setLoading(true);
      const res = await adminApi.getTenants({
        page,
        search: search.trim() ? search.trim() : undefined,
        status,
      });
      setTenants(res.data);
      if (res.summary) setSummary(res.summary);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error('Failed to load stores', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(1, searchQuery, statusFilter);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadData(1, '', statusFilter);
  };

  const loadSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await adminApi.getSettings();
      setRegistrationOpen(res.settings?.registration_open === 'true');
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleToggleRegistration = async () => {
    const nextVal = !registrationOpen;
    try {
      setActionLoading(true);
      await adminApi.updateSetting('registration_open', String(nextVal));
      setRegistrationOpen(nextVal);
      setShowToggleModal(false);
      toast.success(nextVal ? 'Public registration is now OPEN' : 'Registration is now GATED (Whitelist required)');
    } catch (err: any) {
      toast.error('Failed to update setting', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantToLock || !lockReason.trim()) return;

    try {
      setActionLoading(true);
      await adminApi.lockTenant(tenantToLock.id, lockReason.trim());
      toast.success(`Store "${tenantToLock.name}" suspended`);
      setTenantToLock(null);
      setLockReason('');
      loadData(pagination.current_page, searchQuery, statusFilter);
      if (selectedTenantForDetail?.id === tenantToLock.id) {
        setSelectedTenantForDetail(null);
      }
    } catch (err: any) {
      toast.error('Failed to lock store', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async (tenant: AdminTenantItem) => {
    try {
      setActionLoading(true);
      await adminApi.unlockTenant(tenant.id);
      toast.success(`Store "${tenant.name}" restored to active`);
      loadData(pagination.current_page, searchQuery, statusFilter);
      if (selectedTenantForDetail?.id === tenant.id) {
        setSelectedTenantForDetail(null);
      }
    } catch (err: any) {
      toast.error('Failed to unlock store', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantToReset || resetConfirmText.trim().toUpperCase() !== 'RESET') return;

    try {
      setActionLoading(true);
      const res = await adminApi.resetTenantData(tenantToReset.id);
      toast.success(res.message || `Store "${tenantToReset.name}" data reset successfully`);
      setTenantToReset(null);
      setResetConfirmText('');
      loadData(pagination.current_page, searchQuery, statusFilter);
      if (selectedTenantForDetail?.id === tenantToReset.id) {
        setSelectedTenantForDetail(null);
      }
    } catch (err: any) {
      toast.error('Failed to reset store data', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantToDelete || deleteConfirmText.trim() !== tenantToDelete.name.trim()) return;

    try {
      setActionLoading(true);
      const res = await adminApi.deleteTenant(tenantToDelete.id);
      toast.success(res.message || `Store "${tenantToDelete.name}" deleted permanently`);
      setTenantToDelete(null);
      setDeleteConfirmText('');
      loadData(pagination.current_page, searchQuery, statusFilter);
      if (selectedTenantForDetail?.id === tenantToDelete.id) {
        setSelectedTenantForDetail(null);
      }
    } catch (err: any) {
      toast.error('Failed to delete store', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Human readable time difference
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isRecentlyActive = (dateStr: string) => {
    if (!dateStr) return false;
    const diffSec = (new Date().getTime() - new Date(dateStr).getTime()) / 1000;
    return diffSec < 1800; // active in last 30 minutes
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP PLATFORM VITAL METRICS (5 Sleek Flat Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Active Stores */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active Stores</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
            {summary?.active_tenants ?? pagination.total}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">
              / {summary?.total_tenants ?? pagination.total}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {summary?.locked_tenants ? `${summary.locked_tenants} suspended` : 'All operating normally'}
          </span>
        </div>

        {/* Live Stock */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Live Stock Count</span>
            <Package className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
            {(summary?.total_stock_count ?? 0).toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">units</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Across all stores
          </span>
        </div>

        {/* Total Platform Volume */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Platform Volume</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white truncate">
            {Number(summary?.total_sales_volume ?? 0).toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {(summary?.total_sales_count ?? 0).toLocaleString()} total sales
          </span>
        </div>

        {/* Total Users */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Store Users</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white">
            {summary?.total_users ?? 0}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">staff & owners</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Registered accounts
          </span>
        </div>

        {/* Access Gate Switch Card */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Access Gate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className={`text-xs font-bold block ${registrationOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {registrationOpen ? 'Open to Public' : 'Gated Whitelist'}
              </span>
              <span className="text-[10px] text-slate-400">
                {registrationOpen ? 'Anyone can signup' : 'Invite code required'}
              </span>
            </div>

            <button
              type="button"
              disabled={settingsLoading || actionLoading}
              onClick={() => {
                if (!registrationOpen) {
                  setShowToggleModal(true);
                } else {
                  handleToggleRegistration();
                }
              }}
              className="cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-transform active:scale-95 disabled:opacity-50 shrink-0"
              title="Toggle Access Gate"
            >
              {registrationOpen ? (
                <ToggleRight className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-slate-400" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTER TOOLBAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#131926] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stores by name, slug, phone, owner email..."
            className="w-full h-9 pl-9 pr-8 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 border border-slate-200/80 dark:border-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
          {[
            { key: 'all', label: 'All Stores' },
            { key: 'active', label: 'Active' },
            { key: 'locked', label: 'Suspended' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key as any)}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-all ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => loadData(pagination.current_page, searchQuery, statusFilter)}
            disabled={loading}
            title="Refresh stores"
            className="h-9 w-9 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. STORES TABLE */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/70 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Store Profile</th>
                <th className="py-3.5 px-4">Owner & Contact</th>
                <th className="py-3.5 px-3.5 text-center">Live Stock</th>
                <th className="py-3.5 px-3.5 text-right">Sales Volume</th>
                <th className="py-3.5 px-3.5 text-center">Team</th>
                <th className="py-3.5 px-3.5 text-center">Last Active</th>
                <th className="py-3.5 px-3.5 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <CustomPageLoader mode="admin" fullScreen={false} />
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 italic">
                    No matching stores found.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const isLocked = t.is_locked;
                  const logo = t.settings?.logo_url;
                  const recent = isRecentlyActive(t.last_activity_at);

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTenantForDetail(t)}
                      className={`cursor-pointer transition-colors ${
                        isLocked
                          ? 'bg-rose-500/5 dark:bg-rose-950/15 hover:bg-rose-500/10 dark:hover:bg-rose-950/25'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Store Profile */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {logo ? (
                            <img
                              src={logo}
                              alt={t.name}
                              className="w-9 h-9 rounded-xl object-contain border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isLocked
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}>
                              {t.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white block truncate text-xs hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                              {t.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono">/{t.slug}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">
                                {t.business_type?.replace(/_/g, ' ') || 'Electronics'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Owner & Contact */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {t.owner?.name || t.owner_email || 'Owner'}
                            </span>
                            {t.primary_device && (
                              <DeviceBadge
                                device={t.primary_device}
                                deviceType={t.primary_device_type}
                              />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block truncate">
                            {t.owner?.email || t.owner_email || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Stock Count */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-xs border border-emerald-200/50 dark:border-emerald-800/30">
                          <Package className="w-3.5 h-3.5" />
                          <span>{t.stock_count.toLocaleString()}</span>
                        </span>
                      </td>

                      {/* Sales & Revenue */}
                      <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block text-xs">
                          {Number(t.sales_volume).toLocaleString()} {t.currency_code}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {t.sales_count} {t.sales_count === 1 ? 'sale' : 'sales'}
                        </span>
                      </td>

                      {/* Team Size */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{t.users_count}</span>
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                          {recent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          <span>{formatTimeAgo(t.last_activity_at)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isLocked
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {isLocked ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedTenantForDetail(t)}
                            title="Inspect Store Health & Activity"
                            className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>Inspect</span>
                          </button>

                          {isLocked ? (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleUnlock(t)}
                              title="Restore Store"
                              className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-all shadow-2xs active:scale-95 cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Restore</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                setTenantToLock(t);
                                setLockReason('');
                              }}
                              title="Suspend Store"
                              className="h-7 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 font-semibold text-[11px] transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Suspend</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              setTenantToReset(t);
                              setResetConfirmText('');
                            }}
                            title="Reset store data (Fresh start)"
                            className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              setTenantToDelete(t);
                              setDeleteConfirmText('');
                            }}
                            title="Delete store permanently"
                            className="h-7 w-7 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.last_page > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page {pagination.current_page} of {pagination.last_page} ({pagination.total} stores)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.current_page <= 1 || loading}
                onClick={() => loadData(pagination.current_page - 1, searchQuery, statusFilter)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page || loading}
                onClick={() => loadData(pagination.current_page + 1, searchQuery, statusFilter)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-out Store Health & Activity Drawer */}
      <TenantDetailDrawer
        tenant={selectedTenantForDetail}
        isOpen={Boolean(selectedTenantForDetail)}
        onClose={() => setSelectedTenantForDetail(null)}
        onLockRequest={(t) => {
          setTenantToLock(t);
          setLockReason('');
        }}
        onUnlockRequest={(t) => handleUnlock(t)}
        onResetRequest={(t) => {
          setTenantToReset(t);
          setResetConfirmText('');
        }}
        onDeleteRequest={(t) => {
          setTenantToDelete(t);
          setDeleteConfirmText('');
        }}
      />

      {/* Confirmation Modal: Open Public Registration */}
      {showToggleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setShowToggleModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-page-enter">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Open Public Registration?
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Opening registration allows any merchant to signup without an invite or whitelist approval.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowToggleModal(false)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleToggleRegistration}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {actionLoading ? 'Updating...' : 'Yes, Open Registration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Store Modal */}
      {tenantToLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setTenantToLock(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-page-enter">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <Lock className="w-5 h-5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Suspend Store — {tenantToLock.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Users of this store will be locked out and receive suspension notice
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmLock} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Suspension Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Subscription expired, Terms of service violation, or Non-payment..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTenantToLock(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !lockReason.trim()}
                  className="h-9 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Confirm Suspension</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Store Data Modal (Fresh Start) */}
      {tenantToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setTenantToReset(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-page-enter">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Reset Store Data — {tenantToReset.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Fresh start for test stores & early pilot users
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
              <p className="font-semibold">What will be cleared:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                <li>All products, inventory units, and stock quantities</li>
                <li>All sales orders, customer debts, and payment records</li>
                <li>All expense transactions and audit activity logs</li>
              </ul>
              <p className="text-[11px] pt-1 text-slate-600 dark:text-slate-400">
                ✓ <strong>Preserved:</strong> Store owner login credentials, email, password, and workspace settings remain intact.
              </p>
            </div>

            <form onSubmit={handleConfirmReset} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Type <strong className="font-mono text-amber-600 dark:text-amber-400">RESET</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  required
                  placeholder="RESET"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400 uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTenantToReset(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || resetConfirmText.trim().toUpperCase() !== 'RESET'}
                  className="h-9 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  <span>Wipe Data & Reset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanently Delete Store Modal */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setTenantToDelete(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-page-enter">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Permanently Delete Store
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Irreversible destruction of store and all accounts
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40 text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <p className="font-semibold text-rose-700 dark:text-rose-300">
                Warning: This action cannot be undone.
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                This will delete the entire tenant record, all owner and staff login accounts, all inventory data, and financial transactions permanently.
              </p>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Type the exact store name <strong className="font-mono text-rose-600 dark:text-rose-400">"{tenantToDelete.name}"</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  required
                  placeholder={tenantToDelete.name}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTenantToDelete(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || deleteConfirmText.trim() !== tenantToDelete.name.trim()}
                  className="h-9 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete Store Permanently</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
