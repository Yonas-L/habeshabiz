import React, { useState, useEffect } from 'react';
import {
  adminApi,
  type AdminTenantItem,
  type AdminPagination,
} from '../../api/adminClient';
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
} from 'lucide-react';

export const AdminTenantsView: React.FC = () => {
  const [tenants, setTenants] = useState<AdminTenantItem[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);

  // Registration Setting
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showToggleModal, setShowToggleModal] = useState(false);

  // Lock Modal State
  const [tenantToLock, setTenantToLock] = useState<AdminTenantItem | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData(1);
    loadSettings();
  }, []);

  const loadData = async (page = 1) => {
    try {
      setLoading(true);
      const res = await adminApi.getTenants(page);
      setTenants(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error('Failed to load tenants', { description: err.message });
    } finally {
      setLoading(false);
    }
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
      toast.success(nextVal ? 'Registration is now OPEN to the public' : 'Registration is now CLOSED (Whitelist required)');
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
      toast.success(`Tenant ${tenantToLock.name} suspended`);
      setTenantToLock(null);
      setLockReason('');
      loadData(pagination.current_page);
    } catch (err: any) {
      toast.error('Failed to lock tenant', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlock = async (tenant: AdminTenantItem) => {
    try {
      setActionLoading(true);
      await adminApi.unlockTenant(tenant.id);
      toast.success(`Tenant ${tenant.name} restored to active`);
      loadData(pagination.current_page);
    } catch (err: any) {
      toast.error('Failed to unlock tenant', { description: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Registration Setting Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#131926] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            Tenant Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {pagination.total} registered business {pagination.total === 1 ? 'store' : 'stores'} on HabeshaBiz
          </p>
        </div>

        {/* Registration Toggle */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/80 px-4 py-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80">
          <div className="text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Public Onboarding
            </span>
            <span className={`text-xs font-bold ${registrationOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {registrationOpen ? 'Open to Public' : 'Gated (Whitelist Only)'}
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
            className="cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-transform active:scale-95 disabled:opacity-50"
            title="Toggle Registration Mode"
          >
            {registrationOpen ? (
              <ToggleRight className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Business Name</th>
                <th className="py-3 px-4">Owner Email</th>
                <th className="py-3 px-3.5 hidden sm:table-cell">Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Signed Up</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <CustomPageLoader mode="admin" fullScreen={false} />
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 italic">
                    No registered tenants found.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => {
                  const isLocked = t.is_locked;
                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${
                        isLocked
                          ? 'bg-rose-500/5 dark:bg-rose-950/20 hover:bg-rose-500/10 dark:hover:bg-rose-950/30'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Name & Slug */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isLocked
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white block truncate">
                              {t.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              /{t.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Owner Email */}
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                        {t.owner_email || <span className="text-slate-400 italic">None</span>}
                      </td>

                      {/* Business Type */}
                      <td className="py-3 px-3.5 hidden sm:table-cell capitalize text-slate-500 dark:text-slate-400">
                        {t.business_type?.replace(/_/g, ' ') || 'Electronics'}
                      </td>

                      {/* Signed up */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(t.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isLocked
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isLocked ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {isLocked ? 'Locked' : 'Active'}
                        </span>
                        {isLocked && t.lock_reason && (
                          <span className="block text-[9px] text-rose-500/80 max-w-[140px] truncate mx-auto mt-0.5" title={t.lock_reason}>
                            {t.lock_reason}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isLocked ? (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleUnlock(t)}
                            className="h-7 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-all shadow-2xs active:scale-95 cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Unlock</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                              setTenantToLock(t);
                              setLockReason('');
                            }}
                            className="h-7 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] transition-all shadow-2xs active:scale-95 cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Lock</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <div>
              Page {pagination.current_page} of {pagination.last_page} ({pagination.total} items)
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.current_page <= 1 || loading}
                onClick={() => loadData(pagination.current_page - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page || loading}
                onClick={() => loadData(pagination.current_page + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal to Open Registration */}
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
              Opening registration allows anyone to create a tenant on HabeshaBiz without needing to be on the access whitelist.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowToggleModal(false)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleToggleRegistration}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Yes, Open Registration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lock Tenant Modal */}
      {tenantToLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setTenantToLock(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 animate-page-enter">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <Lock className="w-5 h-5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Suspend Tenant — {tenantToLock.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Users will receive 403 suspension error on all API requests
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
                  placeholder="e.g. Subscription expired, Terms of service review, or Non-payment..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTenantToLock(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !lockReason.trim()}
                  className="h-9 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>Confirm Suspension</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
