import React, { useState, useEffect } from 'react';
import {
  adminApi,
  type AdminSignupAttemptItem,
  type AdminPagination,
} from '../../api/adminClient';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import { toast } from 'sonner';
import {
  Activity,
  CheckCircle2,
  Clock,
  UserX,
  ChevronLeft,
  ChevronRight,
  Info,
  Building,
} from 'lucide-react';

export const AdminSignupAttemptsView: React.FC = () => {
  const [attempts, setAttempts] = useState<AdminSignupAttemptItem[]>([]);
  const [pagination, setPagination] = useState<AdminPagination>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeOutcome, setActiveOutcome] = useState<string>('all');

  useEffect(() => {
    loadData(1, activeOutcome);
  }, [activeOutcome]);

  const loadData = async (page = 1, outcome = activeOutcome) => {
    try {
      setLoading(true);
      const res = await adminApi.getSignupAttempts(page, outcome);
      setAttempts(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      toast.error('Failed to load signup attempts', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeBadge = (outcome: AdminSignupAttemptItem['outcome']) => {
    switch (outcome) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Success
          </span>
        );
      case 'waitlisted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3 text-amber-500" />
            Waitlisted
          </span>
        );
      case 'opted_out':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <UserX className="w-3 h-3 text-slate-400" />
            Opted Out
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
            <Activity className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Signup Attempts Audit Log
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time audit log of all registration attempts across the platform.
          </p>
        </div>

        {/* 90-day retention note */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Showing attempts from the last 90 days</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { key: 'all', label: 'All Attempts' },
          { key: 'success', label: 'Success' },
          { key: 'waitlisted', label: 'Waitlisted' },
          { key: 'opted_out', label: 'Opted Out' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveOutcome(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeOutcome === tab.key
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Attempt Email</th>
                <th className="py-3 px-4">Business Name</th>
                <th className="py-3 px-3.5 text-center">Outcome</th>
                <th className="py-3 px-4 text-right">Attempt Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <CustomPageLoader mode="admin" fullScreen={false} />
                  </td>
                </tr>
              ) : attempts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-400 italic">
                    No signup attempts recorded.
                  </td>
                </tr>
              ) : (
                attempts.map((attempt) => (
                  <tr
                    key={attempt.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Email */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-slate-900 dark:text-white font-medium">
                        {attempt.email}
                      </span>
                    </td>

                    {/* Business Name */}
                    <td className="py-3 px-4">
                      {attempt.business_name ? (
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{attempt.business_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Outcome Badge */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      {getOutcomeBadge(attempt.outcome)}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-4 text-right whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                      {new Date(attempt.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
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
                onClick={() => loadData(pagination.current_page - 1, activeOutcome)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page || loading}
                onClick={() => loadData(pagination.current_page + 1, activeOutcome)}
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
