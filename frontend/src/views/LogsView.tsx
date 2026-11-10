import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User, AuditLogItem, AuditLogsResponse } from '../api/client';
import { api } from '../api/client';
import { SlideOverDrawer } from '../components/drawers/SlideOverDrawer';
import { UndoActionModal } from '../components/UndoActionModal';
import { humanizeAuditLog, getAuditQuickSummary } from '../utils/auditHumanizer';
import {
  ScrollText,
  Search,
  SearchX,
  RefreshCw,
  Download,
  Eye,
  X,
  ShieldAlert,
  ShieldCheck,
  Clock,
  RotateCcw,
  Undo2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface LogsViewProps {
  currentUser: User | null;
}

// Format relative elapsed time
function formatRelativeTime(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

// Format exact datetime for timestamps
function formatExactTime(dateString: string): string {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Format raw action identifiers into human-readable titles
function formatActionLabel(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Map action to semantic badge styling
function getActionBadgeStyle(action: string): { bg: string; text: string; dot: string } {
  const lower = action.toLowerCase();

  if (lower.includes('bonus')) {
    return {
      bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200/60 dark:border-orange-800/60',
      text: 'text-orange-700 dark:text-orange-400',
      dot: 'bg-orange-500',
    };
  }

  if (
    lower.includes('create') ||
    lower.includes('intake') ||
    lower.includes('restock') ||
    lower.includes('sale') ||
    lower.includes('settle') ||
    lower.includes('collect') ||
    lower.includes('add')
  ) {
    return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/60 dark:border-emerald-800/60',
      text: 'text-emerald-700 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    };
  }

  if (
    lower.includes('delete') ||
    lower.includes('remove') ||
    lower.includes('void') ||
    lower.includes('suspend') ||
    lower.includes('cancel')
  ) {
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200/60 dark:border-rose-800/60',
      text: 'text-rose-700 dark:text-rose-400',
      dot: 'bg-rose-500',
    };
  }

  if (
    lower.includes('update') ||
    lower.includes('transfer') ||
    lower.includes('handover') ||
    lower.includes('edit')
  ) {
    return {
      bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200/60 dark:border-sky-800/60',
      text: 'text-sky-700 dark:text-sky-400',
      dot: 'bg-sky-500',
    };
  }

  if (
    lower.includes('password') ||
    lower.includes('auth') ||
    lower.includes('login') ||
    lower.includes('reset') ||
    lower.includes('role')
  ) {
    return {
      bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200/60 dark:border-purple-800/60',
      text: 'text-purple-700 dark:text-purple-400',
      dot: 'bg-purple-500',
    };
  }

  if (lower.includes('expense') || lower.includes('draw') || lower.includes('refund')) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200/60 dark:border-amber-800/60',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    };
  }

  return {
    bg: 'bg-slate-100 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60',
    text: 'text-slate-700 dark:text-slate-300',
    dot: 'bg-slate-400',
  };
}

// Shimmer Skeleton Row for Desktop Table
const AuditLogRowSkeleton: React.FC = () => (
  <tr className="animate-pulse">
    {/* Event & Description */}
    <td className="py-3 px-4 align-middle">
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-48" />
      </div>
    </td>
    {/* Actor / Staff */}
    <td className="py-3 px-4 align-middle">
      <div className="flex items-center gap-2">
        <div className="size-6.5 bg-slate-200 dark:bg-slate-800 rounded-lg shrink-0" />
        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-24" />
      </div>
    </td>
    {/* Time */}
    <td className="py-3 px-4 align-middle whitespace-nowrap">
      <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md w-16" />
    </td>
    {/* Target Module */}
    <td className="py-3 px-4 align-middle whitespace-nowrap">
      <div className="h-4.5 bg-slate-100 dark:bg-slate-800/60 rounded-md w-16" />
    </td>
    {/* Actions */}
    <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
      <div className="h-6.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-28 ml-auto" />
    </td>
  </tr>
);

// Shimmer Skeleton Row for Mobile Cardless List
const AuditLogMobileSkeleton: React.FC = () => (
  <div className="flex items-center justify-between gap-3 px-2 py-3.5 animate-pulse">
    <div className="space-y-1.5 flex-1 min-w-0">
      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-3/5" />
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-md w-2/5" />
    </div>
    <div className="h-7 w-14 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0" />
  </div>
);

const PAGE_SIZE = 25;

export const LogsView: React.FC<LogsViewProps> = ({ currentUser }) => {
  const isOwner = currentUser?.role === 'owner';

  // Server state
  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Filter states
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedEntity, setSelectedEntity] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Inspector Drawer State
  const [inspectItem, setInspectItem] = useState<AuditLogItem | null>(null);

  // Undo Action Modal State
  const [selectedUndoLog, setSelectedUndoLog] = useState<AuditLogItem | null>(null);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);

  // Scroll container refs for eager loading checks
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch initial logs (page 1)
  const fetchInitialLogs = useCallback(async () => {
    if (!isOwner) return;

    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        page: 1,
        per_page: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        action: selectedAction,
        entity_type: selectedEntity,
        user_id: selectedUser,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setData(res);
      setItems(res.items || []);
      setPage(1);
      setHasMore(res.pagination ? res.pagination.current_page < res.pagination.last_page : false);
    } catch (err: any) {
      toast.error('Failed to load audit logs', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [isOwner, debouncedSearch, selectedAction, selectedEntity, selectedUser, startDate, endDate]);

  useEffect(() => {
    fetchInitialLogs();
  }, [fetchInitialLogs]);

  // Load more items as user scrolls down inside the fixed-height container
  const loadMoreLogs = async () => {
    if (loading || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const res = await api.getAuditLogs({
        page: nextPage,
        per_page: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        action: selectedAction,
        entity_type: selectedEntity,
        user_id: selectedUser,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      setItems((prev) => [...prev, ...(res.items || [])]);
      setPage(nextPage);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: [...(prev.items || []), ...(res.items || [])],
              pagination: res.pagination,
            }
          : res
      );
      setHasMore(res.pagination ? res.pagination.current_page < res.pagination.last_page : false);
    } catch (err: any) {
      toast.error('Failed to load older audit logs', { description: err.message });
    } finally {
      setLoadingMore(false);
    }
  };

  // Eager progressive loading: If initial chunk renders but container has leftover viewport space, eagerly fetch page 2
  useEffect(() => {
    if (!loading && !loadingMore && hasMore && items.length > 0 && items.length <= PAGE_SIZE) {
      const desktopEl = desktopScrollRef.current;
      if (desktopEl && desktopEl.scrollHeight <= desktopEl.clientHeight + 120) {
        loadMoreLogs();
      }
    }
  }, [items.length, loading, loadingMore, hasMore]);

  // Scroll listener for fixed-height internal scrolling with eager threshold
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const bottomThreshold = 350; // Eagerly trigger loading before reaching the bottom
    if (target.scrollHeight - target.scrollTop - target.clientHeight < bottomThreshold) {
      if (hasMore && !loading && !loadingMore) {
        loadMoreLogs();
      }
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedAction('all');
    setSelectedEntity('all');
    setSelectedUser('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const isFiltered = Boolean(
    debouncedSearch ||
      selectedAction !== 'all' ||
      selectedEntity !== 'all' ||
      selectedUser !== 'all' ||
      startDate ||
      endDate
  );

  // Export current loaded view to CSV
  const handleExportCSV = () => {
    if (!items || items.length === 0) {
      toast.error('No logs available to export');
      return;
    }

    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Entity Type', 'Summary'];
    const rows = items.map((log) => [
      `"${formatExactTime(log.created_at)}"`,
      `"${log.user?.name || 'System'}"`,
      `"${log.user?.email || '—'}"`,
      `"${log.action}"`,
      `"${log.entity_type}"`,
      `"${getAuditQuickSummary(log).replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Audit logs downloaded as CSV');
  };

  // Non-owner security wall
  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-page-enter">
        <div className="size-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-center text-rose-500 mb-4 shadow-sm">
          <ShieldAlert className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Security & Audit Wall</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1.5 leading-relaxed">
          Access to system-wide audit records and administrative trail logs is restricted strictly to business owners and super administrators.
        </p>
      </div>
    );
  }

  const summary = data?.summary;
  const filterOptions = data?.filter_options;
  const humanizedInspect = inspectItem ? humanizeAuditLog(inspectItem) : null;

  return (
    <div className="space-y-4 animate-page-enter flex-1 flex flex-col min-h-0">
      {/* Top Header & Actions Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
              <ScrollText className="size-5 text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">User Activities</h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Owner Access
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit trail of system events, inventory intakes, user actions &amp; data changes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInitialLogs}
            disabled={loading}
            title="Refresh logs"
            className="size-8.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="h-8.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Download className="size-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Minimal Search & Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-2 flex-wrap min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
            <Search className="size-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8.5 pl-8 pr-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="size-4 absolute right-2.5 top-2.5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={(e) => {
              setSelectedAction(e.target.value);
              setPage(1);
            }}
            className="h-8.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Actions</option>
            {filterOptions?.actions?.map((act) => (
              <option key={act} value={act}>
                {formatActionLabel(act)}
              </option>
            ))}
          </select>

          {/* Staff Filter */}
          <select
            value={selectedUser}
            onChange={(e) => {
              setSelectedUser(e.target.value);
              setPage(1);
            }}
            className="h-8.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Staff</option>
            {filterOptions?.users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          {/* Module Filter */}
          <select
            value={selectedEntity}
            onChange={(e) => {
              setSelectedEntity(e.target.value);
              setPage(1);
            }}
            className="h-8.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="all">All Modules</option>
            {filterOptions?.entity_types?.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8.5 px-2.5 text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 flex items-center gap-1 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <X className="size-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop View (≥ md): Sticky Header + Table in Clean Card Container */}
      <div className="hidden md:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div
          ref={desktopScrollRef}
          onScroll={handleContainerScroll}
          className="overflow-x-auto overflow-y-auto h-[calc(100vh-190px)] min-h-[500px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 relative"
        >
          <table className="w-full text-left text-xs border-collapse table-fixed min-w-[960px]">
            <colgroup>
              <col className="w-auto min-w-[280px]" />
              <col className="w-[180px]" />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[190px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-[#161d2d]/95 backdrop-blur-xs border-b border-slate-100 dark:border-slate-800/80 shadow-xs">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-3 px-4">Event &amp; Description</th>
                <th className="py-3 px-4">Actor / Staff</th>
                <th className="py-3 px-4 whitespace-nowrap">Time</th>
                <th className="py-3 px-4 whitespace-nowrap">Target Module</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && items.length === 0 ? (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <AuditLogRowSkeleton key={`skel-row-${i}`} />
                  ))}
                </>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <ScrollText className="size-6" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No audit log entries found
                      </span>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {isFiltered
                          ? 'No entries match your current search and filter parameters. Try clearing your filters.'
                          : 'System events and actions will automatically appear here as team members operate the business.'}
                      </p>
                      {isFiltered && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((log) => {
                  const badgeStyle = getActionBadgeStyle(log.action);
                  const isSystem = !log.user;
                  const quickSummary = getAuditQuickSummary(log);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setInspectItem(log)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Event & Description */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-col gap-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 ${badgeStyle.bg} ${badgeStyle.text} ${log.is_reverted ? 'opacity-70 line-through' : ''}`}
                            >
                              <span className={`size-1.5 rounded-full ${badgeStyle.dot}`} />
                              {formatActionLabel(log.action)}
                            </span>
                            {log.is_reverted && (
                              <span
                                title={
                                   log.reverted_by_name && log.reverted_at
                                    ? `Reverted by ${log.reverted_by_name} at ${formatExactTime(log.reverted_at)}`
                                    : 'Action was reverted'
                                }
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 shrink-0"
                              >
                                Reverted
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">
                            {quickSummary}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase shrink-0">
                            {isSystem ? 'SY' : log.user?.name.slice(0, 2) || 'US'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white truncate">
                              <span className="truncate">{isSystem ? 'System Engine' : log.user?.name}</span>
                              {log.user?.role === 'owner' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50 shrink-0">
                                  Owner
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate">
                              {isSystem ? 'Automated' : log.user?.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 align-middle whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatRelativeTime(log.created_at)}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {formatExactTime(log.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Target Module */}
                      <td className="py-3 px-4 align-middle whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                          {log.entity_type}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 shrink-0">
                          {log.is_reverted ? (
                            <span
                              title={
                                log.reverted_by_name && log.reverted_at
                                  ? `Reverted by ${log.reverted_by_name} at ${formatExactTime(log.reverted_at)}`
                                  : 'This action has been reverted'
                              }
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700/60 line-through tracking-tight"
                            >
                              Reverted
                            </span>
                          ) : log.can_undo && isOwner ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUndoLog(log);
                                setIsUndoModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors shadow-xs"
                              title="Undo this business action within 24 hours"
                            >
                              <RotateCcw className="size-3" />
                              <span>Undo</span>
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectItem(log);
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white group-hover:border-slate-300 dark:group-hover:border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Eye className="size-3" />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {loadingMore && (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <AuditLogRowSkeleton key={`skel-more-row-${i}`} />
                  ))}
                </>
              )}
            </tbody>
          </table>

          {/* Bottom Infinite Scroll Sentinel & Loader */}
          {items.length > 0 && (
            <div className="p-3 text-center border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-400">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                  <Loader2 className="size-3.5 animate-spin text-emerald-500" />
                  <span>Loading older activities...</span>
                </div>
              ) : hasMore ? (
                <button
                  onClick={loadMoreLogs}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  Load older records
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">
                  ✓ All {summary?.filtered_count || items.length} audit records loaded
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile View (< md): Cardless Table List (Minimal Text + Undo Button Only) */}
      <div
        ref={mobileScrollRef}
        onScroll={handleContainerScroll}
        className="md:hidden overflow-y-auto h-[calc(100dvh-185px)] min-h-[440px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 overscroll-contain pb-28 px-0.5"
      >
        {loading && items.length === 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {Array.from({ length: 8 }).map((_, i) => (
              <AuditLogMobileSkeleton key={`skel-mob-${i}`} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="flex flex-col items-center justify-center gap-2">
              <SearchX className="size-8 text-slate-300 dark:text-slate-600" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                No user activities match your filters
              </span>
              <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                Try changing selected filters or clearing search.
              </p>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {items.map((log: AuditLogItem) => {
              const quickSummary = getAuditQuickSummary(log);

              return (
                <div
                  key={log.id}
                  onClick={() => setInspectItem(log)}
                  className="flex items-center justify-between gap-3 px-2 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 active:bg-slate-100/80 dark:active:bg-slate-800/50 transition-colors cursor-pointer select-none"
                >
                  {/* Minimal Text: Summary + Actor · Time */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {quickSummary}
                      </span>
                      {log.is_reverted && (
                        <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 shrink-0 uppercase tracking-tight">
                          Reverted
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                      <span>{log.user?.name || 'System'}</span>
                      <span className="mx-1.5">·</span>
                      <span>{formatRelativeTime(log.created_at)}</span>
                    </div>
                  </div>

                  {/* Undo Button ONLY (Rendered strictly when eligible) */}
                  {log.can_undo && isOwner && !log.is_reverted ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUndoLog(log);
                        setIsUndoModalOpen(true);
                      }}
                      className="h-7.5 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-bold inline-flex items-center gap-1 shadow-2xs active:scale-95 shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="size-3" />
                      <span>Undo</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
            {loadingMore && (
              <>
                {Array.from({ length: 3 }).map((_, i) => (
                  <AuditLogMobileSkeleton key={`skel-more-mob-${i}`} />
                ))}
              </>
            )}
          </div>
        )}

        {/* Bottom Infinite Scroll Sentinel & Loader on Mobile */}
        {items.length > 0 && (
          <div className="p-3 text-center text-xs text-slate-400">
            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                <Loader2 className="size-3.5 animate-spin text-emerald-500" />
                <span>Loading older activities...</span>
              </div>
            ) : hasMore ? (
              <button
                onClick={loadMoreLogs}
                className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              >
                Load older records
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">
                ✓ All {summary?.filtered_count || items.length} audit records loaded
              </span>
            )}
          </div>
        )}
      </div>

      {/* Human-Readable Inspect Item SlideOver Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        title={humanizedInspect?.eventTitle || 'Audit Event Inspector'}
        subtitle={humanizedInspect ? `${humanizedInspect.eventSubtitle} · ${formatExactTime(inspectItem?.created_at || '')}` : ''}
        widthClass="sm:max-w-xl"
        badge={
          inspectItem ? (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeStyle(inspectItem.action).bg} ${getActionBadgeStyle(inspectItem.action).text}`}
            >
              <span className={`size-1.5 rounded-full ${getActionBadgeStyle(inspectItem.action).dot}`} />
              {formatActionLabel(inspectItem.action)}
            </span>
          ) : undefined
        }
      >
        {inspectItem && humanizedInspect && (
          <div className="space-y-4 text-xs">
            {/* Reverted or Undo Action Banner */}
            {inspectItem.is_reverted ? (
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                    <RotateCcw className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>This action has been reverted</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                        Reverted
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {inspectItem.reverted_by_name ? `Reverted by ${inspectItem.reverted_by_name}` : 'Reverted by Owner'}
                      {inspectItem.reverted_at ? ` · ${formatExactTime(inspectItem.reverted_at)}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            ) : inspectItem.can_undo && isOwner ? (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <Undo2 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <span>Eligible for Undo Reversal</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                        24h Window
                      </span>
                    </div>
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      Restores inventory &amp; relative cash balance deltas safely
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUndoLog(inspectItem);
                    setIsUndoModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs shrink-0 cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Undo Action</span>
                </button>
              </div>
            ) : null}

            {/* Actor Profile Section */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
                  {inspectItem.user?.name ? inspectItem.user.name.slice(0, 2) : 'SY'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                      {inspectItem.user?.name || 'System Automatic'}
                    </span>
                    {inspectItem.user?.role === 'owner' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {inspectItem.user?.email || 'Automated business task'}
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60 pt-2 sm:pt-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center sm:justify-end gap-1">
                  <Clock className="size-3 text-slate-400" />
                  <span>{formatRelativeTime(inspectItem.created_at)}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {formatExactTime(inspectItem.created_at)}
                </div>
              </div>
            </div>

            {/* Key Event Highlights / Big Metrics */}
            {humanizedInspect.highlights.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {humanizedInspect.highlights.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {h.label}
                    </span>
                    <span
                      className={`text-base font-bold font-mono mt-1 ${
                        h.isHighlight
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Business Details Grid (Filtered Clean Fields) */}
            {humanizedInspect.details.length > 0 && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Business &amp; Transaction Details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {humanizedInspect.details.map((d, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 flex flex-col"
                    >
                      <span className="text-[10px] text-slate-400 font-medium">{d.label}</span>
                      <span className="font-semibold text-slate-900 dark:text-white mt-0.5 break-words">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recorded Differences (Before vs After) */}
            {humanizedInspect.diffs.length > 0 && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Field Modifications (Before ➔ After)
                </div>
                <div className="space-y-2">
                  {humanizedInspect.diffs.map((diff, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                        {diff.label}
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-mono text-[11px] truncate">
                          {diff.from}
                        </span>
                        <ArrowRight className="size-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] truncate">
                          {diff.to}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SlideOverDrawer>

      {/* Undo Action Reversal Modal */}
      <UndoActionModal
        isOpen={isUndoModalOpen}
        onClose={() => {
          setIsUndoModalOpen(false);
          setSelectedUndoLog(null);
        }}
        log={selectedUndoLog}
        onSuccess={() => {
          fetchInitialLogs();
          if (inspectItem && selectedUndoLog && inspectItem.id === selectedUndoLog.id) {
            setInspectItem((prev) =>
              prev
                ? {
                    ...prev,
                    is_reverted: true,
                    can_undo: false,
                    reverted_at: new Date().toISOString(),
                    reverted_by_name: currentUser?.name || 'Owner',
                  }
                : null
            );
          }
        }}
      />
    </div>
  );
};
