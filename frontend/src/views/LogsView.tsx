import React, { useState, useEffect, useCallback } from 'react';
import type { User, AuditLogItem, AuditLogsResponse } from '../api/client';
import { api } from '../api/client';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { SlideOverDrawer } from '../components/drawers/SlideOverDrawer';
import { UndoActionModal } from '../components/UndoActionModal';
import { humanizeAuditLog, getAuditQuickSummary } from '../utils/auditHumanizer';
import {
  ScrollText,
  Search,
  SearchX,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Eye,
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  Clock,
  FileCode,
  RotateCcw,
  Undo2,
  Loader2,
  ChevronDown,
  ArrowRight,
  Copy,
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Undo Action Modal State
  const [selectedUndoLog, setSelectedUndoLog] = useState<AuditLogItem | null>(null);
  const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);

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
        per_page: 50,
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
        per_page: 50,
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

  // Scroll listener for fixed-height internal scrolling
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const bottomThreshold = 180;
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

  // Copy helper with feedback
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 1800);
  };

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
    <div className="flex flex-col gap-4 animate-page-enter">
      {/* Top Header & Actions Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
              <ScrollText className="size-5 text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Audit & System Logs</h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                  <ShieldCheck className="size-3 text-emerald-500" />
                  Owner Access
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Tamper-evident record of all system events, inventory intakes, user actions &amp; data changes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchInitialLogs}
            disabled={loading}
            title="Refresh logs"
            className="size-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs font-semibold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Download className="size-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Recorded</span>
            <ScrollText className="size-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {summary?.total_count?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Immutable system events</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Today's Activity</span>
            <Activity className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {summary?.today_count?.toLocaleString() ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Logged since midnight</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Action Types</span>
            <Layers className="size-3.5 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {filterOptions?.actions?.length ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Distinct event categories</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Filtered Matches</span>
            <Filter className="size-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {summary?.filtered_count?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isFiltered ? 'Active search filters' : 'All records in view'}
          </div>
        </div>
      </div>

      {/* Filter Surface */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-center">
          {/* Search Input */}
          <div className="lg:col-span-5 relative">
            <Search className="size-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search actions, items, staff, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="size-5 absolute right-2.5 top-2 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Action Filter */}
          <div className="lg:col-span-3">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs font-medium text-slate-900 dark:text-white focus:outline-none transition-colors"
            >
              <option value="all">All Actions</option>
              {filterOptions?.actions?.map((act) => (
                <option key={act} value={act}>
                  {formatActionLabel(act)}
                </option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs font-medium text-slate-900 dark:text-white focus:outline-none transition-colors"
            >
              <option value="all">All Modules</option>
              {filterOptions?.entity_types?.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div className="lg:col-span-2">
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs font-medium text-slate-900 dark:text-white focus:outline-none transition-colors"
            >
              <option value="all">All Staff</option>
              {filterOptions?.users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter Strip & Reset Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="size-3.5" />
              <span className="text-[11px] font-medium">Date:</span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-[11px] font-medium text-slate-900 dark:text-white focus:outline-none"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-[11px] font-medium text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <X className="size-3" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Fixed Height Container with Internal Scrolling (No Horizontal Scroll) */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden flex flex-col h-[calc(100vh-290px)] min-h-[500px]">
        {/* Desktop View: Sticky Header + Internal Scrollable Table */}
        <div
          onScroll={handleContainerScroll}
          className="hidden md:flex flex-col flex-1 overflow-y-auto overscroll-contain"
        >
          <table className="w-full text-left text-xs border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-[#161d2d]/95 backdrop-blur-xs border-b border-slate-100 dark:border-slate-800/80 shadow-xs">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-3 px-4 w-[36%]">Event &amp; Description</th>
                <th className="py-3 px-4 w-[22%]">Actor / Staff</th>
                <th className="py-3 px-4 w-[16%]">Time</th>
                <th className="py-3 px-4 w-[14%]">Target Module</th>
                <th className="py-3 px-4 w-[12%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <CustomPageLoader mode="app" fullScreen={false} />
                  </td>
                </tr>
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
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                          {log.entity_type}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
            </tbody>
          </table>

          {/* Bottom Infinite Scroll Sentinel & Loader */}
          {items.length > 0 && (
            <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-400">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                  <Loader2 className="size-4 animate-spin text-emerald-500" />
                  <span>Loading older records...</span>
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

        {/* Mobile View: Fixed Height Scrollable Card Stream */}
        <div
          onScroll={handleContainerScroll}
          className="md:hidden flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-3"
        >
          {loading && items.length === 0 ? (
            <div className="py-12 text-center">
              <CustomPageLoader mode="app" fullScreen={false} />
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="flex flex-col items-center justify-center gap-2">
                <SearchX className="size-8 text-slate-300 dark:text-slate-600" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  No audit events match your filters
                </span>
                <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                  Try changing selected filters or clearing text search.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          ) : (
            items.map((log: AuditLogItem) => {
              const badgeStyle = getActionBadgeStyle(log.action);
              const isSystem = !log.user;
              const quickSummary = getAuditQuickSummary(log);

              return (
                <div
                  key={log.id}
                  onClick={() => setInspectItem(log)}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/70 transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
                >
                  {/* Card Header: Actor Profile + Action Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-[11px] uppercase shrink-0">
                        {isSystem ? 'SY' : log.user?.name.slice(0, 2) || 'US'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {isSystem ? 'System Engine' : log.user?.name}
                          </span>
                          {log.user?.role === 'owner' && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50 shrink-0">
                              Owner
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${log.is_reverted ? 'opacity-70 line-through' : ''}`}
                      >
                        <span className={`size-1.5 rounded-full ${badgeStyle.dot}`} />
                        {formatActionLabel(log.action)}
                      </span>
                      {log.is_reverted && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40 shrink-0">
                          Reverted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Clean Business Summary */}
                  <div className="p-2.5 rounded-lg bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800/70 text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {quickSummary}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Module: <span className="font-medium text-slate-600 dark:text-slate-300">{log.entity_type}</span>
                    </div>
                  </div>

                  {/* Card Footer: Relative Time + Actions */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="size-3 text-slate-400" />
                      <span>{formatRelativeTime(log.created_at)}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      {log.is_reverted ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/60 dark:border-slate-700/60 line-through">
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
                          className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[11px] font-bold inline-flex items-center gap-1 shadow-xs"
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
                        className="px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Eye className="size-3" />
                        <span>Inspect</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Bottom Infinite Scroll Sentinel & Loader on Mobile */}
          {items.length > 0 && (
            <div className="p-3 text-center text-xs text-slate-400">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                  <Loader2 className="size-4 animate-spin text-emerald-500" />
                  <span>Loading older records...</span>
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

            {/* Technical & Developer Data (Collapsed by default) */}
            <details className="group border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
              <summary className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <div className="flex items-center gap-2">
                  <FileCode className="size-3.5 text-slate-400" />
                  <span>Technical &amp; Developer Details (Raw JSON &amp; IP)</span>
                </div>
                <ChevronDown className="size-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
              </summary>

              <div className="p-3.5 pt-1 space-y-3 border-t border-slate-200/60 dark:border-slate-800/60">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono">
                    <span className="text-[10px] text-slate-400 block font-sans">IP Address</span>
                    {inspectItem.ip_address || '127.0.0.1'}
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono truncate">
                    <span className="text-[10px] text-slate-400 block font-sans">Event UUID</span>
                    #{inspectItem.id}
                  </div>
                </div>

                {inspectItem.new_values && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden">
                    <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>raw_new_values.json</span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(inspectItem.new_values, null, 2), 'raw-json')}
                        className="hover:text-white flex items-center gap-1"
                      >
                        {copiedKey === 'raw-json' ? (
                          <>
                            <Check className="size-3 text-emerald-500" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-3 text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-48 leading-relaxed">
                      {JSON.stringify(inspectItem.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
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
