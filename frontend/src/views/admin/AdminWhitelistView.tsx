import React, { useState, useEffect } from 'react';
import {
  adminApi,
  type AdminWhitelistItem,
  type AdminPagination,
} from '../../api/adminClient';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  X,
} from 'lucide-react';

export const AdminWhitelistView: React.FC = () => {
  const [entries, setEntries] = useState<AdminWhitelistItem[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'used'>('all');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Modal State
  const [entryToDelete, setEntryToDelete] = useState<AdminWhitelistItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData(1, activeTab);
  }, [activeTab]);

  const loadData = async (page = 1, tab = activeTab) => {
    try {
      setLoading(true);
      const res = await adminApi.getWhitelist(page, tab);
      setEntries(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error('Failed to load whitelist', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;

    try {
      setIsSubmitting(true);
      await adminApi.addWhitelist({
        email: addEmail.trim(),
        notes: addNotes.trim() ? addNotes.trim() : undefined,
      });
      toast.success(`${addEmail.trim()} added to whitelist`);
      setShowAddModal(false);
      setAddEmail('');
      setAddNotes('');
      loadData(1, activeTab);
    } catch (err: any) {
      toast.error('Failed to add to whitelist', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;

    try {
      setIsDeleting(true);
      await adminApi.deleteWhitelist(entryToDelete.id);
      toast.success(`${entryToDelete.email} removed from whitelist`);
      setEntryToDelete(null);
      loadData(pagination.current_page, activeTab);
    } catch (err: any) {
      toast.error('Failed to delete whitelist entry', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#131926] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Whitelist Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pre-authorize emails to allow shop creation when public registration is closed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Email</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {(['all', 'pending', 'used'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-colors ${
              activeTab === tab
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Authorized Email</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Used At</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Added</th>
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
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400 italic">
                    No whitelist entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isUsed = entry.status === 'used';
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Email */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-medium text-slate-900 dark:text-white block">
                          {entry.email}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[220px] truncate">
                        {entry.notes || <span className="text-slate-400 italic">No notes</span>}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isUsed
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isUsed ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Used
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-500" />
                              Pending
                            </>
                          )}
                        </span>
                      </td>

                      {/* Used At */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {entry.used_at ? (
                          new Date(entry.used_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Added At */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(entry.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!isUsed && (
                          <button
                            type="button"
                            onClick={() => setEntryToDelete(entry)}
                            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-semibold p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Delete</span>
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

        {/* Pagination Footer */}
        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span>
              Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.current_page <= 1 || loading}
                onClick={() => loadData(pagination.current_page - 1, activeTab)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page || loading}
                onClick={() => loadData(pagination.current_page + 1, activeTab)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#131926] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Add Whitelist Email
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. founder@ethiopianbusiness.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Bole branch electronics shop, referred via Telegram"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white/40 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !addEmail.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Add to Whitelist</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#131926] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Remove from Whitelist?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Are you sure you want to remove <strong className="text-slate-700 dark:text-slate-200">{entryToDelete.email}</strong>? They will no longer be authorized to register unless added again.
            </p>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
