import React, { useState, useEffect } from 'react';
import {
  adminApi,
  type AdminTenantItem,
  type AdminPagination,
  type AdminPlatformSummary,
  type AdminBusinessTypeVertical,
} from '../../api/adminClient';
import { TenantDetailDrawer, DeviceBadge } from './TenantDetailDrawer';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import { toast } from 'sonner';
import {
  Lock,
  Unlock,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Users,
  Search,
  RefreshCw,
  Eye,
  ShieldCheck,
  X,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Store,
  Shirt,
  Coffee,
  CheckCircle2,
  Layers,
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

  // Selected vertical (All, or specific business type card clicked)
  const [selectedVertical, setSelectedVertical] = useState<string>('all');

  // Inline expanded store ID to view tabular branches under that tenant
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);

  // Search & Status Filter (all, active, inactive)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Access Gate Setting
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
    loadData(1, searchQuery, statusFilter, selectedVertical);
    loadSettings();
  }, [statusFilter, selectedVertical]);

  const loadData = async (
    page = 1,
    search = searchQuery,
    status = statusFilter,
    vertical = selectedVertical
  ) => {
    try {
      setLoading(true);
      const res = await adminApi.getTenants({
        page,
        search: search.trim() ? search.trim() : undefined,
        status: status !== 'all' ? status : undefined,
        business_type: vertical !== 'all' ? vertical : undefined,
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
    loadData(1, searchQuery, statusFilter, selectedVertical);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadData(1, '', statusFilter, selectedVertical);
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
      toast.success(
        nextVal
          ? 'Public registration is now OPEN'
          : 'Registration is now GATED (Invite whitelist required)'
      );
    } catch (err: any) {
      toast.error('Failed to update access gate', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleVertical = async (
    settingKey: string,
    nextEnabled: boolean,
    verticalTitle: string
  ) => {
    try {
      setActionLoading(true);
      await adminApi.updateSetting(settingKey, String(nextEnabled));
      toast.success(
        nextEnabled
          ? `${verticalTitle} registration is now ACTIVE on signup modal`
          : `${verticalTitle} registration is now DISABLED on signup modal`
      );
      loadData(pagination.current_page, searchQuery, statusFilter, selectedVertical);
    } catch (err: any) {
      toast.error('Failed to update vertical status', { description: err.message });
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
      loadData(pagination.current_page, searchQuery, statusFilter, selectedVertical);
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
      loadData(pagination.current_page, searchQuery, statusFilter, selectedVertical);
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
      loadData(pagination.current_page, searchQuery, statusFilter, selectedVertical);
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
      loadData(pagination.current_page, searchQuery, statusFilter, selectedVertical);
      if (selectedTenantForDetail?.id === tenantToDelete.id) {
        setSelectedTenantForDetail(null);
      }
    } catch (err: any) {
      toast.error('Failed to delete store', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleTenantExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedTenantId((prev) => (prev === id ? null : id));
  };

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
    return diffSec < 1800;
  };

  const getVerticalIcon = (id: string) => {
    switch (id) {
      case 'electronics':
        return Smartphone;
      case 'clothing':
        return Shirt;
      case 'food_beverage':
        return Coffee;
      case 'general_retail':
      default:
        return Store;
    }
  };

  const verticalCards: AdminBusinessTypeVertical[] = summary?.business_types || [
    {
      id: 'electronics',
      title: 'Electronics & Mobile',
      subtitle: 'Phones, laptops & IMEIs',
      icon: 'smartphone',
      is_enabled: true,
      setting_key: 'business_type_electronics_enabled',
      stores_count: pagination.total || 0,
      active_stores_count: summary?.active_tenants || 0,
      stock_count: summary?.total_stock_count || 0,
      sales_volume: summary?.total_sales_volume || 0,
    },
    {
      id: 'general_retail',
      title: 'General Retail',
      subtitle: 'Supermarkets, FMCG & goods',
      icon: 'store',
      is_enabled: false,
      setting_key: 'business_type_general_retail_enabled',
      stores_count: 0,
      active_stores_count: 0,
      stock_count: 0,
      sales_volume: 0,
    },
    {
      id: 'clothing',
      title: 'Clothing & Fashion',
      subtitle: 'Apparel, footwear & variants',
      icon: 'shirt',
      is_enabled: false,
      setting_key: 'business_type_clothing_enabled',
      stores_count: 0,
      active_stores_count: 0,
      stock_count: 0,
      sales_volume: 0,
    },
    {
      id: 'food_beverage',
      title: 'Food & Beverage',
      subtitle: 'Cafes, bakeries & menus',
      icon: 'coffee',
      is_enabled: false,
      setting_key: 'business_type_food_beverage_enabled',
      stores_count: 0,
      active_stores_count: 0,
      stock_count: 0,
      sales_volume: 0,
    },
  ];

  const currentVerticalMeta = verticalCards.find((v) => v.id === selectedVertical);

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════════════════
          1. TENANT VERTICAL CARDS (Styled Like Treasury Bank Cards)
      ════════════════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Tenant Verticals & Registration
            </span>
            {selectedVertical !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedVertical('all')}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Reset to all stores
              </button>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {summary?.total_tenants ?? pagination.total} total stores registered
          </span>
        </div>

        {/* Bank Card Style Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {verticalCards.map((v) => {
            const isSelected = selectedVertical === v.id;
            const Icon = getVerticalIcon(v.id);

            return (
              <div
                key={v.id}
                onClick={() => {
                  const next = isSelected ? 'all' : v.id;
                  setSelectedVertical(next);
                }}
                className={`bg-white dark:bg-[#131926] rounded-2xl border p-4.5 flex flex-col justify-between cursor-pointer transition-all active:scale-[0.99] ${
                  isSelected
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* Top Row: Icon + Title + Active/Disable Toggle */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight truncate">
                          {v.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {v.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Active and Disable Toggle Switch */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVertical(v.setting_key, !v.is_enabled, v.title);
                      }}
                      disabled={actionLoading}
                      title={
                        v.is_enabled
                          ? 'Click to turn inactive on registration modal'
                          : 'Click to turn active on registration modal'
                      }
                      className="flex items-center gap-1 cursor-pointer shrink-0 p-1 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                    >
                      <span
                        className={`text-[9px] font-bold ${
                          v.is_enabled
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {v.is_enabled ? 'Active' : 'Disabled'}
                      </span>
                      {v.is_enabled ? (
                        <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Stores Metrics & Selection Cue */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {v.stores_count}
                    </span>
                    <span className="text-[10px] text-slate-400">stores</span>
                    {v.stock_count > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono truncate">
                        · {v.stock_count.toLocaleString()} units
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                        Filtered &darr;
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 hover:text-emerald-500 transition-colors">
                        View &rarr;
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. SEARCH & FILTER TOOLBAR
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#131926] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        {/* Search */}
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

        {/* Status Pills & Controls */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          {/* Active Vertical Tag (if filtered) */}
          {selectedVertical !== 'all' && currentVerticalMeta && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
              <span>{currentVerticalMeta.title}</span>
              <button
                type="button"
                onClick={() => setSelectedVertical('all')}
                className="hover:text-rose-500 cursor-pointer"
                title="Clear vertical filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Status filter tabs */}
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-all ${
                statusFilter === tab
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'active' ? 'Active' : 'Suspended'}
            </button>
          ))}

          {/* Access Gate Button */}
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
            className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              registrationOpen
                ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
            title="Toggle Registration Whitelist Gate"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">
              Gate: {registrationOpen ? 'Public' : 'Gated'}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() =>
              loadData(pagination.current_page, searchQuery, statusFilter, selectedVertical)
            }
            disabled={loading}
            title="Refresh stores"
            className="h-9 w-9 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          3. TABULAR LIST OF BUSINESSES UNDER TENANTS (No Nested Cards)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/70 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Business / Store</th>
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
                    No matching stores found
                    {selectedVertical !== 'all' ? ` for "${selectedVertical}"` : ''}.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const isLocked = t.is_locked;
                  const logo = t.settings?.logo_url;
                  const recent = isRecentlyActive(t.last_activity_at);
                  const isExpanded = expandedTenantId === t.id;
                  const categories = t.categories || [];

                  return (
                    <React.Fragment key={t.id}>
                      <tr
                        onClick={() => setSelectedTenantForDetail(t)}
                        className={`cursor-pointer transition-colors ${
                          isLocked
                            ? 'bg-rose-500/5 dark:bg-rose-950/15 hover:bg-rose-500/10 dark:hover:bg-rose-950/25'
                            : isExpanded
                            ? 'bg-slate-50/60 dark:bg-slate-900/50'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Store / Business */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => toggleTenantExpand(t.id, e)}
                              title={isExpanded ? 'Collapse branches' : 'Expand branches under store'}
                              className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>

                            {logo ? (
                              <img
                                src={logo}
                                alt={t.name}
                                className="w-8 h-8 rounded-xl object-contain border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5 shrink-0 shadow-2xs"
                              />
                            ) : (
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isLocked
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {t.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white block truncate text-xs hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                                {t.name}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  /{t.slug}
                                </span>
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

                        {/* Live Stock Count */}
                        <td className="py-3.5 px-3.5 text-center">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {(t.stock_count ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 block">units</span>
                        </td>

                        {/* Sales Volume */}
                        <td className="py-3.5 px-3.5 text-right font-mono">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {Number(t.sales_volume ?? 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            {t.sales_count ?? 0} txns
                          </span>
                        </td>

                        {/* Team Count */}
                        <td className="py-3.5 px-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            <Users className="w-3 h-3 text-slate-400" />
                            {t.users_count ?? 1}
                          </span>
                        </td>

                        {/* Last Active */}
                        <td className="py-3.5 px-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              recent
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {recent && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            {formatTimeAgo(t.last_activity_at)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3.5 text-center">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                              <Lock className="w-3 h-3" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedTenantForDetail(t)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Inspect store telemetry"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Reset Data Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setTenantToReset(t);
                                setResetConfirmText('');
                              }}
                              className="p-1.5 rounded-lg text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Reset store data (Fresh start)"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            {isLocked ? (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleUnlock(t)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                title="Restore active store"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => {
                                  setTenantToLock(t);
                                  setLockReason('');
                                }}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Suspend store"
                              >
                                <Lock className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete Store Permanently Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setTenantToDelete(t);
                                setDeleteConfirmText('');
                              }}
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 dark:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Permanently Delete Store"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── EXPANDED TABULAR BRANCHES UNDER THIS TENANT ── */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-900/50">
                          <td colSpan={8} className="p-0 border-y border-slate-200/60 dark:border-slate-800">
                            <div className="px-5 py-3.5 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    Catalog Departments & Branches under {t.name}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {categories.length} departments · {t.stock_count} units on hand
                                </span>
                              </div>

                              {categories.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">
                                  No specific catalog departments registered under this store yet.
                                </p>
                              ) : (
                                <div className="border border-slate-200/70 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926]">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100/60 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      <tr>
                                        <th className="py-2 px-3">Department / Catalog</th>
                                        <th className="py-2 px-3">Tracking Mode</th>
                                        <th className="py-2 px-3 text-center">Products</th>
                                        <th className="py-2 px-3 text-right">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                      {categories.map((cat) => (
                                        <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                          <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                            {cat.name}
                                          </td>
                                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                                            {cat.has_serials ? 'Serialized (IMEI / Serial)' : 'Bulk Quantity'}
                                          </td>
                                          <td className="py-2 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                                            {cat.products_count} items
                                          </td>
                                          <td className="py-2 px-3 text-right">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                              <CheckCircle2 className="w-3 h-3" />
                                              Active
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span>
              Showing {(pagination.current_page - 1) * pagination.per_page + 1} to{' '}
              {Math.min(pagination.current_page * pagination.per_page, pagination.total)} of{' '}
              {pagination.total} stores
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.current_page <= 1 || loading}
                onClick={() =>
                  loadData(
                    pagination.current_page - 1,
                    searchQuery,
                    statusFilter,
                    selectedVertical
                  )
                }
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono px-2">
                {pagination.current_page} / {pagination.last_page}
              </span>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page || loading}
                onClick={() =>
                  loadData(
                    pagination.current_page + 1,
                    searchQuery,
                    statusFilter,
                    selectedVertical
                  )
                }
                className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer: Detailed Deep-dive */}
      <TenantDetailDrawer
        isOpen={!!selectedTenantForDetail}
        tenant={selectedTenantForDetail}
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
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setShowToggleModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-page-enter">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Open Public Registration?
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Opening registration allows merchants to register without an invite code or whitelist approval.
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
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setTenantToLock(null)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-page-enter">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <Lock className="w-5 h-5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Suspend Store — {tenantToLock.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Store staff will be locked out and will see a suspension notice
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmLock} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="e.g. Terms violation or non-payment..."
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
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Suspend Store</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Store Data Modal */}
      {tenantToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setTenantToReset(null)}
          />
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
                  Fresh start: wipes catalog, sales, and debt transactions
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Owner and staff login credentials will remain preserved. All inventory units, sales receipts, and financial ledger records will be cleared.
            </p>

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
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Wipe</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanently Delete Store Modal */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setTenantToDelete(null)}
          />
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
                  Irreversible deletion of store and all accounts
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Type <strong className="font-mono text-rose-600 dark:text-rose-400">"{tenantToDelete.name}"</strong> to confirm:
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
                  {actionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete Permanently</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
