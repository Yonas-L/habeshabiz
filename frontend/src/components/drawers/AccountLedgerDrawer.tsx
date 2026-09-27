import React, { useState, useEffect, useCallback } from 'react';
import type { FinancialAccount, AccountActivitiesResponse } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { AccountLogo } from '../../utils/bankLogos';
import { AnimatedNumber } from '../AnimatedNumber';
import { toast } from 'sonner';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Search,
  Download,
  Copy,
  Check,
  Calendar,
  X,
  RefreshCw,
  Receipt,
  ChevronDown,
  ChevronUp,
  Layers,
  TrendingUp,
  Pencil,
} from 'lucide-react';

interface AccountLedgerDrawerProps {
  account: FinancialAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenTransfer?: (accountId: string) => void;
  onOpenEdit?: (account: FinancialAccount) => void;
}

type DatePreset = 'all' | 'today' | 'this_month' | 'last_30_days' | 'custom';

export const AccountLedgerDrawer: React.FC<AccountLedgerDrawerProps> = ({
  account,
  isOpen,
  onClose,
  onOpenTransfer,
  onOpenEdit,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccountActivitiesResponse | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI States
  const [copiedAccountNum, setCopiedAccountNum] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calculate dates based on preset
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const isoToday = now.toISOString().split('T')[0];
      setStartDate(isoToday);
      setEndDate(isoToday);
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_30_days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const isoToday = now.toISOString().split('T')[0];
      setStartDate(thirtyDaysAgo);
      setEndDate(isoToday);
    }
  };

  const fetchActivities = useCallback(async () => {
    if (!account) return;
    try {
      setLoading(true);
      const res = await api.getAccountActivities(account.id, {
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: search.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load account activities', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [account, typeFilter, search, startDate, endDate]);

  useEffect(() => {
    if (isOpen && account) {
      fetchActivities();
    } else {
      setData(null);
      setSearch('');
      setTypeFilter('all');
      setDatePreset('all');
      setStartDate('');
      setEndDate('');
      setExpandedId(null);
    }
  }, [isOpen, account]);

  // Debounced refetch on filter change
  useEffect(() => {
    if (!isOpen || !account) return;
    const timeout = setTimeout(() => {
      fetchActivities();
    }, 200);
    return () => clearTimeout(timeout);
  }, [fetchActivities]);

  const handleCopyAccountNum = () => {
    if (!account?.account_number) return;
    navigator.clipboard.writeText(account.account_number);
    setCopiedAccountNum(true);
    toast.success('Account number copied to clipboard');
    setTimeout(() => setCopiedAccountNum(false), 2000);
  };

  const hasActiveFilters = Boolean(
    search.trim() || typeFilter !== 'all' || datePreset !== 'all' || startDate || endDate
  );

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const exportToCSV = () => {
    if (!data || !data.activities.length) {
      toast.error('No activities to export');
      return;
    }

    const headers = [
      'Date',
      'Transaction Number',
      'Type',
      'Direction',
      'Counterparty',
      'Description',
      'Inflow (ETB)',
      'Outflow (ETB)',
      'Fee (ETB)',
      'Running Balance (ETB)',
      'Reference Number',
    ];

    const rows = data.activities.map((a) => [
      `"${new Date(a.date).toLocaleString()}"`,
      `"${a.transaction_number || ''}"`,
      `"${a.type_label}"`,
      `"${a.direction}"`,
      `"${(a.counterparty || '').replace(/"/g, '""')}"`,
      `"${(a.description || '').replace(/"/g, '""')}"`,
      a.inflow > 0 ? a.inflow.toFixed(2) : '0.00',
      a.outflow > 0 ? a.outflow.toFixed(2) : '0.00',
      a.fee > 0 ? a.fee.toFixed(2) : '0.00',
      a.balance_after.toFixed(2),
      `"${a.reference_number || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanAccountName = (account?.name || 'account').toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.setAttribute('download', `${cleanAccountName}-activity-ledger-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Activity ledger CSV downloaded');
  };

  if (!account) return null;

  const summary = data?.summary || {
    current_balance: Number(account.current_balance),
    total_inflow: 0,
    total_outflow: 0,
    net_flow: 0,
    filtered_inflow: 0,
    filtered_outflow: 0,
    filtered_net: 0,
    total_count: 0,
    filtered_count: 0,
  };

  const isInactive = account.is_active === false;

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      widthClass="sm:max-w-3xl lg:max-w-4xl"
      title={account.name}
      subtitle={
        account.account_number
          ? `Acc: ${account.account_number} · ${account.type.replace(/_/g, ' ')}`
          : `${account.type.replace(/_/g, ' ').toUpperCase()} Account`
      }
      badge={
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isInactive
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
          {isInactive ? 'Inactive' : 'Live'}
        </span>
      }
      headerActions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportToCSV}
            disabled={!data || data.activities.length === 0}
            title="Export filtered activities to CSV"
            className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {onOpenTransfer && (
            <button
              onClick={() => onOpenTransfer(account.id)}
              className="h-8 px-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transfer</span>
            </button>
          )}

          {onOpenEdit && (
            <button
              onClick={() => onOpenEdit(account)}
              title="Edit Account Details"
              className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center active:scale-95 shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Account Identity Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 dark:from-[#131926] dark:via-[#111723] dark:to-[#0d121c] p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <AccountLogo account={account} size="xl" className="shadow-md ring-2 ring-white dark:ring-slate-700" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{account.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {account.type.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {account.account_number ? (
                    <button
                      onClick={handleCopyAccountNum}
                      className="group inline-flex items-center gap-1 font-mono hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                      title="Click to copy account number"
                    >
                      <span>{account.account_number}</span>
                      {copiedAccountNum ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                      )}
                    </button>
                  ) : (
                    <span>Internal Treasury Account</span>
                  )}
                  <span>·</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Currency: {account.currency || 'ETB'}</span>
                </div>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Current Live Balance
              </span>
              <div className="inline-flex items-baseline gap-1.5 font-mono text-2xl font-black text-slate-900 dark:text-white">
                <AnimatedNumber value={summary.current_balance} decimals={2} />
                <span className="text-xs font-semibold text-slate-400 font-sans">ETB</span>
              </div>
            </div>
          </div>

          {/* Asset details if custom asset */}
          {account.asset_details && Object.keys(account.asset_details).length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-200/60 dark:border-slate-800/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {Object.entries(account.asset_details).map(([key, val]) => (
                <div key={key} className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2 border border-slate-200/50 dark:border-slate-800/50">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4 KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Total Inflows */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Inflows</span>
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400 truncate">
              +{Number(summary.filtered_inflow ?? summary.total_inflow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Sales & deposits</span>
          </div>

          {/* Total Outflows */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Outflows</span>
              <div className="w-5 h-5 rounded-md bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono font-black text-base text-rose-600 dark:text-rose-400 truncate">
              -{Number(summary.filtered_outflow ?? summary.total_outflow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Payouts & expenses</span>
          </div>

          {/* Net Flow */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Net Cashflow</span>
              <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div
              className={`font-mono font-black text-base truncate ${
                summary.filtered_net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary.filtered_net >= 0 ? '+' : ''}
              {Number(summary.filtered_net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Net activity</span>
          </div>

          {/* Total Transactions */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Activities</span>
              <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono font-black text-base text-slate-900 dark:text-white truncate">
              {summary.filtered_count}{' '}
              <span className="text-xs font-normal text-slate-400">of {summary.total_count}</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Recorded items</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-3 shadow-xs">
          {/* Top row: Search input + Date Presets */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transaction #, counterparty, description, ref..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Range Presets */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_30_days', label: 'Last 30D' },
                  { id: 'custom', label: 'Custom' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleDatePresetChange(preset.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    datePreset === preset.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs (shown only if custom selected) */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
              />
            </div>
          )}

          {/* Segmented Type Filter Pills */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All Activities' },
                { id: 'inflow', label: 'Inflows' },
                { id: 'outflow', label: 'Outflows' },
                { id: 'sale', label: 'Sales & Debt Collections' },
                { id: 'supplier_payment', label: 'Vendor Payouts' },
                { id: 'transfer', label: 'Transfers' },
                { id: 'expense', label: 'Expenses' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setTypeFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                    typeFilter === pill.id
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0 flex items-center gap-1 pl-2"
              >
                <X className="w-3 h-3" />
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Minimal Neat Activity Ledger Table */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Transaction Ledger
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {summary.filtered_count} records
              </span>
            </div>

            <button
              onClick={fetchActivities}
              disabled={loading}
              title="Refresh ledger"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : ''}`} />
            </button>
          </div>

          {/* Loading Skeleton */}
          {loading && !data && (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-1.5">
                      <div className="w-28 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="w-40 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="w-20 h-3.5 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                    <div className="w-24 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State: No activities match filter */}
          {!loading && data && data.activities.length === 0 && (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/70 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No transactions found</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No activity entries match your current search and filter settings.'
                  : 'There are no recorded transactions, collections, or transfers for this account yet.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Activity Rows */}
          {data && data.activities.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-x-auto">
              {/* Column labels for desktop view */}
              <div className="hidden md:grid md:grid-cols-12 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="col-span-3">Date & Number</div>
                <div className="col-span-3">Type & Counterparty</div>
                <div className="col-span-2 text-right">Inflow</div>
                <div className="col-span-2 text-right">Outflow</div>
                <div className="col-span-2 text-right">Running Balance</div>
              </div>

              {data.activities.map((act) => {
                const isExpanded = expandedId === act.id;
                const isInflow = act.direction === 'inflow';
                const formattedDate = new Date(act.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = new Date(act.date).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={act.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    {/* Main Row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : act.id)}
                      className="px-5 py-3 cursor-pointer grid grid-cols-1 md:grid-cols-12 items-center gap-2"
                    >
                      {/* Date & Transaction Number */}
                      <div className="md:col-span-3 flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                            isInflow
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isInflow ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                           <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                            {formattedDate}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono">{act.transaction_number || '—'}</span>
                            <span>·</span>
                            <span>{formattedTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Type & Counterparty */}
                      <div className="md:col-span-3 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {act.counterparty || act.type_label}
                          </span>
                          {act.reference_number && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                              Ref: {act.reference_number}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {act.type_label}
                          {act.description ? ` · ${act.description}` : ''}
                        </div>
                      </div>

                      {/* Mobile Row Amounts View (visible on < md) */}
                      <div className="md:hidden flex items-center justify-between pt-1 border-t border-slate-100/50 dark:border-slate-800/50 mt-1">
                        <div className="text-xs">
                          {isInflow ? (
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              +{act.inflow.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                              -{act.outflow.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 mr-1">Bal:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {act.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                          </span>
                        </div>
                      </div>

                      {/* Desktop Columns */}
                      {/* Inflow */}
                      <div className="hidden md:block md:col-span-2 text-right">
                        {isInflow ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            +{act.inflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 font-mono text-xs">—</span>
                        )}
                      </div>

                      {/* Outflow */}
                      <div className="hidden md:block md:col-span-2 text-right">
                        {!isInflow ? (
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                            -{act.outflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {act.fee > 0 && (
                              <span className="block text-[9px] text-slate-400 font-normal">
                                Fee: {act.fee.toFixed(2)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 font-mono text-xs">—</span>
                        )}
                      </div>

                      {/* Running Balance */}
                      <div className="hidden md:flex md:col-span-2 items-center justify-end gap-2 text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {act.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className="text-slate-400 p-0.5">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 text-xs space-y-2.5 animate-page-enter">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              Exact Timestamp
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                              {new Date(act.date).toLocaleString()}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              System Reference
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                              {act.reference_number || 'None'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              Recorded By
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">
                              {act.created_by || 'System Owner'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              Transfer Fee
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                              {act.fee > 0 ? `${act.fee.toFixed(2)} ETB` : '0.00 ETB'}
                            </span>
                          </div>
                        </div>

                        {act.description && (
                          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                            <span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold block mb-0.5">
                              Description
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/40 dark:border-slate-700/40 text-xs">
                              {act.description}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SlideOverDrawer>
  );
};
