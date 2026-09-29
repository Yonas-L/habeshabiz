import React, { useState, useEffect } from 'react';
import {
  adminApi,
  type AdminWaitlistItem,
  type AdminPagination,
} from '../../api/adminClient';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import { toast } from 'sonner';
import {
  UserCheck,
  PhoneCall,
  Loader2,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Users,
  Check,
  X,
  Phone,
  Building,
} from 'lucide-react';

export const AdminWaitlistView: React.FC = () => {
  const [entries, setEntries] = useState<AdminWaitlistItem[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  useEffect(() => {
    loadData(1, activeFilter);
  }, [activeFilter]);

  const loadData = async (page = 1, filter = activeFilter) => {
    try {
      setLoading(true);
      const filters: { consented?: boolean; status?: string } = {};
      if (filter === 'consented') {
        filters.consented = true;
      } else if (filter !== 'all') {
        filters.status = filter;
      }

      const res = await adminApi.getWaitlist(page, filters);
      setEntries(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error('Failed to load waitlist', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    entry: AdminWaitlistItem,
    newStatus: 'pending' | 'contacted' | 'approved'
  ) => {
    try {
      setActionLoadingId(entry.id);
      const res = await adminApi.updateWaitlist(entry.id, { status: newStatus });
      if (newStatus === 'approved') {
        toast.success(`${entry.name} approved & added to Whitelist!`);
      } else if (newStatus === 'contacted') {
        toast.success(`Marked ${entry.name} as contacted`);
      } else {
        toast.success(res.message);
      }
      loadData(pagination.current_page, activeFilter);
    } catch (err: any) {
      toast.error('Failed to update waitlist entry', { description: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: AdminWaitlistItem['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            Approved
          </span>
        );
      case 'contacted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <PhoneCall className="w-3 h-3 text-blue-500" />
            Contacted
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3 text-amber-500" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#131926] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Waitlist Submissions
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Leads and prospective merchants who submitted access requests.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'consented', label: 'Consented Only' },
          { key: 'contacted', label: 'Contacted' },
          { key: 'approved', label: 'Approved' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              activeFilter === tab.key
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Waitlist Table Card */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Merchant Name</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-3.5 hidden md:table-cell">Business</th>
                <th className="py-3 px-3.5 hidden lg:table-cell">Message</th>
                <th className="py-3 px-3 text-center">Consent</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Submitted</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CustomPageLoader mode="admin" fullScreen={false} />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 italic">
                    No waitlist submissions found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isOperating = actionLoadingId === entry.id;
                  const isExpanded = expandedMessageId === entry.id;

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {entry.name}
                        </span>
                      </td>

                      {/* Contact Info (Email + Phone) */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="font-mono text-slate-700 dark:text-slate-300 block truncate max-w-[200px]">
                            {entry.email}
                          </span>
                          {entry.phone && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{entry.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Business */}
                      <td className="py-3 px-3.5 hidden md:table-cell">
                        {entry.business_name ? (
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{entry.business_name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Message */}
                      <td className="py-3 px-3.5 hidden lg:table-cell max-w-[220px]">
                        {entry.message ? (
                          <div
                            onClick={() =>
                              setExpandedMessageId(isExpanded ? null : entry.id)
                            }
                            className="cursor-pointer group"
                            title="Click to toggle expand"
                          >
                            <p
                              className={`text-[11px] text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 ${
                                isExpanded ? 'whitespace-normal' : 'truncate'
                              }`}
                            >
                              {entry.message}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Consent */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {entry.consented ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" title="Consented to contact">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400" title="No consent given">
                            <X className="w-3 h-3" />
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        {getStatusBadge(entry.status)}
                      </td>

                      {/* Submitted At */}
                      <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        {new Date(entry.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.status !== 'approved' && (
                            <button
                              type="button"
                              disabled={isOperating}
                              onClick={() => handleUpdateStatus(entry, 'approved')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                              title="Approve and automatically add to Whitelist"
                            >
                              {isOperating ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Approve</span>
                            </button>
                          )}

                          {entry.status === 'pending' && (
                            <button
                              type="button"
                              disabled={isOperating}
                              onClick={() => handleUpdateStatus(entry, 'contacted')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                              title="Mark as contacted"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>Contacted</span>
                            </button>
                          )}
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span>
              Page {pagination.current_page} of {pagination.last_page} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pagination.current_page <= 1 || loading}
                onClick={() => loadData(pagination.current_page - 1, activeFilter)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page || loading}
                onClick={() => loadData(pagination.current_page + 1, activeFilter)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
