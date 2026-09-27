import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, AuditLogItem, AuditLogsResponse } from '../api/client';
import { api } from '../api/client';
import { SlideOverDrawer } from '../components/drawers/SlideOverDrawer';
import {
  ScrollText,
  Search,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  Eye,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Layers,
  Clock,
  Globe,
  FileCode,
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
    second: '2-digit',
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
  const [loading, setLoading] = useState(true);

  // Filter states
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch paginated logs from backend
  const fetchLogs = useCallback(async () => {
    if (!isOwner) return;

    try {
      setLoading(true);
      const res = await api.getAuditLogs({
        page,
        per_page: perPage,
        search: debouncedSearch.trim() || undefined,
        action: selectedAction,
        entity_type: selectedEntity,
        user_id: selectedUser,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load audit logs', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [isOwner, page, perPage, debouncedSearch, selectedAction, selectedEntity, selectedUser, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  // Export current filtered view to CSV
  const handleExportCSV = () => {
    if (!data?.items || data.items.length === 0) {
      toast.error('No logs available to export');
      return;
    }

    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'New Values'];
    const rows = data.items.map((log) => [
      `"${formatExactTime(log.created_at)}"`,
      `"${log.user?.name || 'System'}"`,
      `"${log.user?.email || '—'}"`,
      `"${log.action}"`,
      `"${log.entity_type}"`,
      `"${log.entity_id || '—'}"`,
      `"${log.ip_address || '—'}"`,
      `"${JSON.stringify(log.new_values || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
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

  const pagination = data?.pagination;
  const summary = data?.summary;
  const filterOptions = data?.filter_options;

  // Pagination navigation helpers
  const totalPages = pagination?.last_page || 1;
  const currentPage = pagination?.current_page || 1;

  const visiblePageNumbers = useMemo(() => {
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    return range;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      {/* Top Header & Actions Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                Tamper-evident record of all system events, inventory intakes, user actions & data changes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
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
        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Recorded</span>
            <ScrollText className="size-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {summary?.total_count?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Immutable system events</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Today's Activity</span>
            <Activity className="size-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {summary?.today_count?.toLocaleString() ?? 0}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Logged since midnight</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Action Types</span>
            <Layers className="size-3.5 text-sky-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {filterOptions?.actions?.length ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Distinct event categories</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between">
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

      {/* Filter and Control Surface */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="lg:col-span-4 relative">
            <Search className="size-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, entity, user, IP, or payload..."
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
          <div className="lg:col-span-2">
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
              <option value="all">All Entities</option>
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

          {/* Rows Per Page */}
          <div className="lg:col-span-2 flex items-center justify-end gap-2">
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Show:</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Date Filter Strip & Reset Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Calendar className="size-3.5" />
              <span className="text-[11px] font-medium">Date Range:</span>
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

      {/* Main Paginated Table Card */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden flex flex-col">
        {/* Table Body */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/30 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-3.5 px-4 whitespace-nowrap">Timestamp</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Actor</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Action Event</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Entity Target</th>
                <th className="py-3.5 px-4 whitespace-nowrap">IP Address</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Change Overview</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading && (!data?.items || data.items.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="size-6 text-slate-400 animate-spin" />
                      <span className="text-xs text-slate-400 font-medium">Loading audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
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
                data.items.map((log) => {
                  const badgeStyle = getActionBadgeStyle(log.action);
                  const isSystem = !log.user;
                  const newValsCount = log.new_values ? Object.keys(log.new_values).length : 0;
                  const oldValsCount = log.old_values ? Object.keys(log.old_values).length : 0;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setInspectItem(log)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col leading-tight">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {formatRelativeTime(log.created_at)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {formatExactTime(log.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase shrink-0">
                            {isSystem ? 'SY' : log.user?.name.slice(0, 2) || 'US'}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white truncate">
                              <span>{isSystem ? 'System Automatic' : log.user?.name}</span>
                              {log.user?.role === 'owner' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/50">
                                  Owner
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate">
                              {isSystem ? 'Cron / Engine' : log.user?.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action Event Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${badgeStyle.bg} ${badgeStyle.text}`}
                        >
                          <span className={`size-1.5 rounded-full ${badgeStyle.dot}`} />
                          {formatActionLabel(log.action)}
                        </span>
                      </td>

                      {/* Entity Target */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                            {log.entity_type}
                          </span>
                          {log.entity_id && (
                            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded">
                              #{log.entity_id.length > 12 ? `${log.entity_id.slice(0, 10)}...` : log.entity_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                          <Globe className="size-3 text-slate-400" />
                          <span>{log.ip_address || '127.0.0.1'}</span>
                        </div>
                      </td>

                      {/* Change Overview */}
                      <td className="py-3 px-4 max-w-xs truncate">
                        {newValsCount > 0 || oldValsCount > 0 ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {oldValsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-mono">
                                -{oldValsCount} fields
                              </span>
                            )}
                            {newValsCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono">
                                +{newValsCount} fields
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 truncate">
                              {log.new_values?.notes ||
                                log.new_values?.model ||
                                log.new_values?.name ||
                                (log.new_values ? Object.keys(log.new_values).slice(0, 3).join(', ') : '')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.total > 0 && (
          <div className="px-4 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{pagination.from || 0}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{pagination.to || 0}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{pagination.total.toLocaleString()}</span> entries
            </div>

            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              {/* First Page */}
              <button
                onClick={() => setPage(1)}
                disabled={currentPage === 1 || loading}
                title="First Page"
                className="size-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronsLeft className="size-4" />
              </button>

              {/* Prev Page */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                title="Previous Page"
                className="size-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>

              {/* Page 1 */}
              <button
                onClick={() => setPage(1)}
                className={`size-8 rounded-lg text-xs font-semibold transition-all ${
                  currentPage === 1
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                1
              </button>

              {/* Leading Ellipsis */}
              {visiblePageNumbers.length > 0 && visiblePageNumbers[0] > 2 && (
                <span className="px-1 text-slate-400 text-xs">...</span>
              )}

              {/* Visible Mid-range Pages */}
              {visiblePageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`size-8 rounded-lg text-xs font-semibold transition-all ${
                    currentPage === p
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}

              {/* Trailing Ellipsis */}
              {visiblePageNumbers.length > 0 &&
                visiblePageNumbers[visiblePageNumbers.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-slate-400 text-xs">...</span>
                )}

              {/* Last Page */}
              {totalPages > 1 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`size-8 rounded-lg text-xs font-semibold transition-all ${
                    currentPage === totalPages
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {totalPages}
                </button>
              )}

              {/* Next Page */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
                title="Next Page"
                className="size-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>

              {/* Last Page */}
              <button
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages || loading}
                title="Last Page"
                className="size-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Item SlideOver Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        title="Audit Event Inspector"
        subtitle={inspectItem ? `Event #${inspectItem.id} · ${formatExactTime(inspectItem.created_at)}` : ''}
        widthClass="sm:max-w-2xl"
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
        headerActions={
          inspectItem ? (
            <button
              onClick={() => handleCopy(JSON.stringify(inspectItem, null, 2), 'raw-log')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedKey === 'raw-log' ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          ) : undefined
        }
      >
        {inspectItem && (
          <div className="p-6 flex flex-col gap-6 overflow-y-auto">
            {/* Actor Profile Section */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-xs uppercase">
                  {inspectItem.user?.name ? inspectItem.user.name.slice(0, 2) : 'SY'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {inspectItem.user?.name || 'System Worker / Automated'}
                    </span>
                    {inspectItem.user?.role === 'owner' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{inspectItem.user?.email || 'automated-task@system.local'}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                  <Globe className="size-3 text-slate-400" />
                  <span>{inspectItem.ip_address || '127.0.0.1'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">IP Address</div>
              </div>
            </div>

            {/* Event Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Action Identifier</div>
                <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                  {inspectItem.action}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Entity Model & ID</div>
                <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                  {inspectItem.entity_type} {inspectItem.entity_id ? `(#${inspectItem.entity_id})` : ''}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Relative Time</div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="size-3.5 text-slate-400" />
                  {formatRelativeTime(inspectItem.created_at)}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Full ISO Timestamp</div>
                <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  {inspectItem.created_at}
                </div>
              </div>
            </div>

            {/* Changes / Payload Diff Viewer */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <FileCode className="size-4 text-emerald-500" />
                  <span>Payload & Audit Diff</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">JSON Snapshot</span>
              </div>

              {/* If both old and new exist, show comparison */}
              {inspectItem.old_values && inspectItem.new_values ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Previous State */}
                  <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20 overflow-hidden">
                    <div className="px-3.5 py-2 border-b border-rose-200/60 dark:border-rose-900/40 bg-rose-100/50 dark:bg-rose-950/40 flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
                      <span>Previous State (Before)</span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(inspectItem.old_values, null, 2), 'old-val')}
                        className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        {copiedKey === 'old-val' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="p-3.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-72">
                      {JSON.stringify(inspectItem.old_values, null, 2)}
                    </pre>
                  </div>

                  {/* New State */}
                  <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/20 overflow-hidden">
                    <div className="px-3.5 py-2 border-b border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-100/50 dark:bg-emerald-950/40 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <span>Result State (After)</span>
                      <button
                        onClick={() => handleCopy(JSON.stringify(inspectItem.new_values, null, 2), 'new-val')}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        {copiedKey === 'new-val' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <pre className="p-3.5 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto max-h-72">
                      {JSON.stringify(inspectItem.new_values, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : inspectItem.new_values ? (
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-900 text-slate-100 overflow-hidden shadow-sm">
                  <div className="px-3.5 py-2 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="font-mono text-[11px] text-emerald-400">new_values.json</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(inspectItem.new_values, null, 2), 'new-json')}
                      className="text-[10px] text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedKey === 'new-json' ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-96 text-emerald-300/90 selection:bg-emerald-900">
                    {JSON.stringify(inspectItem.new_values, null, 2)}
                  </pre>
                </div>
              ) : inspectItem.old_values ? (
                <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/80 bg-rose-950/90 text-rose-100 overflow-hidden shadow-sm">
                  <div className="px-3.5 py-2 border-b border-rose-900 bg-rose-950 flex items-center justify-between text-xs font-semibold text-rose-300">
                    <span className="font-mono text-[11px] text-rose-400">deleted_values.json</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(inspectItem.old_values, null, 2), 'old-json')}
                      className="text-[10px] text-rose-400 hover:text-white transition-colors"
                    >
                      {copiedKey === 'old-json' ? 'Copied' : 'Copy JSON'}
                    </button>
                  </div>
                  <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-x-auto max-h-96 text-rose-200/90">
                    {JSON.stringify(inspectItem.old_values, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  No additional JSON attributes or payload recorded for this event.
                </div>
              )}
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
};
