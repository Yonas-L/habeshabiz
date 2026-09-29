import React, { useState, useEffect } from 'react';
import type { DashboardData, User, FinancialAccount, Debt, LeaderboardItem } from '../api/client';
import { api } from '../api/client';
import {
  InteractiveSalesWaveChart,
  DonutCapitalChart,
} from '../components/Charts';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { VitalBreakdownDrawer, type VitalType } from '../components/drawers/VitalBreakdownDrawer';
import { DebtDrawer } from '../components/drawers/DebtDrawer';
import { RecordExpenseModal } from '../components/RecordExpenseModal';
import { RecordDebtModal } from '../components/debts/RecordDebtModal';
import {
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Plus,
  ArrowLeftRight,
  Package,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

interface OverviewViewProps {
  data: DashboardData | null;
  user: User | null;
  accounts?: FinancialAccount[];
  selectedMonth?: string;
  onNavigateTab: (tab: any) => void;
  onRefreshData?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  user,
  accounts = [],
  selectedMonth,
  onNavigateTab,
  onRefreshData,
}) => {
  const [selectedVital, setSelectedVital] = useState<VitalType | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [topSeller, setTopSeller] = useState<LeaderboardItem | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtModalDefaultType, setDebtModalDefaultType] = useState<'receivable' | 'payable'>('receivable');

  useEffect(() => {
    if (user?.role === 'owner') {
      api.getLeaderboard(selectedMonth)
        .then((res) => setTopSeller(res.top_seller || null))
        .catch(() => {});
    }
  }, [user, selectedMonth]);

  /* ─── Skeleton ─── */
  if (!data) {
    return (
      <div className="space-y-4 animate-page-enter">
        <div className="grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 h-72 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
          <div className="lg:col-span-5 h-72 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
        </div>
        <div className="h-28 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
      </div>
    );
  }

  const { capital_overview, monthly_performance, counts, top_receivables, top_payables } = data;
  const canViewCost = user?.can_view_costs ?? false;

  const receivableParties = counts.open_receivable_parties ?? counts.open_receivables;
  const payableParties = counts.open_payable_parties ?? counts.open_payables;

  const hasReceivablesAlert = counts.open_receivables > 0 && capital_overview.receivables > 0;
  const hasPayablesAlert = counts.open_payables > 0 && capital_overview.payables > 0;

  /* ─── Capital metrics for the unified strip ─── */
  const capitalMetrics: {
    key: VitalType;
    label: string;
    value: number;
    prefix: string;
    accent?: string;
    icon: React.ReactNode;
    colorBg: string;
    onClick: () => void;
  }[] = [
    {
      key: 'inventory',
      label: 'Stock',
      value: capital_overview.stock_value,
      prefix: '',
      icon: <Package className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />,
      colorBg: 'bg-slate-100 dark:bg-slate-800',
      onClick: () => setSelectedVital('inventory'),
    },
    {
      key: 'receivables',
      label: 'Owed to You',
      value: capital_overview.receivables,
      prefix: '+',
      accent: 'text-emerald-600 dark:text-emerald-400',
      icon: <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
      colorBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      onClick: () => setSelectedVital('receivables'),
    },
    {
      key: 'cash',
      label: 'Bank Accounts',
      value: capital_overview.cash_and_banks,
      prefix: '',
      icon: <Landmark className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
      colorBg: 'bg-blue-50 dark:bg-blue-950/60',
      onClick: () => setSelectedVital('cash'),
    },
    {
      key: 'reserves',
      label: 'Reserves',
      value: capital_overview.custom_assets,
      prefix: '',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
      colorBg: 'bg-amber-50 dark:bg-amber-950/60',
      onClick: () => setSelectedVital('reserves'),
    },
    {
      key: 'payables',
      label: 'You Owe',
      value: capital_overview.payables,
      prefix: '−',
      accent: 'text-rose-600/80 dark:text-rose-400/80',
      icon: <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
      colorBg: 'bg-rose-50 dark:bg-rose-950/60',
      onClick: () => setSelectedVital('payables'),
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── 1. Inline Alerts (only when action needed) ── */}
      {(hasReceivablesAlert || hasPayablesAlert) && (
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 animate-stagger-1">
          {hasReceivablesAlert && (
            <button
              onClick={() => setSelectedVital('receivables')}
              className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2.5 px-3.5 py-2.5 sm:py-2 rounded-xl sm:rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200 text-xs font-medium hover:border-emerald-300 dark:hover:border-emerald-600 transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300">Owed to you:</span>{' '}
                  <span className="font-semibold">{receivableParties}</span> {receivableParties === 1 ? 'party owes' : 'parties owe'}{' '}
                  <span className="font-mono font-bold text-emerald-950 dark:text-emerald-100">{capital_overview.receivables.toLocaleString()}</span> ETB
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 sm:hidden" />
              <ArrowRight className="w-3 h-3 opacity-50 shrink-0 hidden sm:block" />
            </button>
          )}

          {hasPayablesAlert && (
            <button
              onClick={() => setSelectedVital('payables')}
              className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2.5 px-3.5 py-2.5 sm:py-2 rounded-xl sm:rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-xs font-medium hover:border-rose-300 dark:hover:border-rose-700 transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 opacity-80" />
                <span className="truncate">
                  <span className="font-bold text-rose-800 dark:text-rose-300">You owe:</span>{' '}
                  <span className="font-semibold">{payableParties}</span> {payableParties === 1 ? 'party' : 'parties'}{' '}
                  <span className="font-mono font-bold text-rose-900 dark:text-rose-200">{capital_overview.payables.toLocaleString()}</span> ETB
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0 sm:hidden" />
              <ArrowRight className="w-3 h-3 opacity-50 shrink-0 hidden sm:block" />
            </button>
          )}
        </div>
      )}

      {/* ── 2. Capital Strip — single compact row on desktop, tactile native cards on mobile ── */}
      {/* Desktop view (>= sm) */}
      <div className="hidden sm:grid sm:grid-cols-5 gap-px bg-slate-200/60 dark:bg-slate-800/50 rounded-xl overflow-hidden animate-stagger-2">
        {capitalMetrics.map((m) => (
          <button
            key={m.key}
            onClick={m.onClick}
            className="bg-white dark:bg-[#131926] px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-[#171e2e] transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-inset cursor-pointer"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">
              {m.label}
            </div>
            <div className={`text-sm font-bold font-mono tracking-tight ${m.accent || 'text-slate-900 dark:text-slate-100'}`}>
              {m.prefix}<AnimatedNumber value={m.value} />
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
          </button>
        ))}
      </div>

      {/* Mobile view (< sm) */}
      <div className="grid grid-cols-2 gap-2 sm:hidden animate-stagger-2">
        {capitalMetrics.map((m, idx) => (
          <button
            key={m.key}
            onClick={m.onClick}
            className={`p-3 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/70 shadow-2xs text-left active:scale-[0.98] transition-all flex flex-col justify-between cursor-pointer ${
              idx === 4 ? 'col-span-2' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {m.label}
              </span>
              <div className={`w-6 h-6 rounded-lg ${m.colorBg} flex items-center justify-center shrink-0`}>
                {m.icon}
              </div>
            </div>
            <div className={`text-base font-bold font-mono tracking-tight ${m.accent || 'text-slate-900 dark:text-slate-100'}`}>
              {m.prefix}<AnimatedNumber value={m.value} />
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── 3. Charts — Sales trajectory + Capital allocation, side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-stagger-3">
        <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-5">
          <InteractiveSalesWaveChart
            data={data.sales_chart || []}
            totalRevenue={monthly_performance.revenue}
            totalProfit={monthly_performance.gross_profit}
            canViewCost={canViewCost}
          />
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-3.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Asset Allocation
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                Portfolio Balance
              </span>
            </div>
            <DonutCapitalChart
              stock={capital_overview.stock_value}
              receivables={capital_overview.receivables}
              treasury={capital_overview.cash_and_banks}
              assets={capital_overview.custom_assets}
              payables={capital_overview.payables}
              netCapital={capital_overview.net_capital}
            />
          </div>
        </div>
      </div>

      {/* ── 4. Monthly Performance (High-Visibility Operational Metrics) ── */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-5 animate-stagger-4">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
              {selectedMonth ? (() => {
                const [y, m] = selectedMonth.split('-').map(Number);
                const d = new Date(y, m - 1);
                return `${d.toLocaleString('default', { month: 'long' })} ${y} Performance`;
              })() : "This Month's Performance"}
            </h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {topSeller && user?.role === 'owner' && (
              <button
                onClick={() => onNavigateTab('staff')}
                title="View Staff & Team Dashboard"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-[11px] font-semibold hover:border-amber-400 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Top: <span className="font-bold">{topSeller.name}</span></span>
                <ChevronRight className="w-3 h-3 opacity-60" />
              </button>
            )}

            {/* Quick Action: Record Expense - hidden on mobile since FAB is available */}
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              title="Quickly record a shop expense or owner personal draw"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
              <span>Record Expense</span>
            </button>

            {/* Quick Action: Record Debt Modal - hidden on mobile since FAB is available */}
            <button
              onClick={() => {
                setDebtModalDefaultType('receivable');
                setIsDebtModalOpen(true);
              }}
              title="Record customer credit, peer vendor payout, or loan entry"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#131926] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-[11px] font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Record Debt</span>
            </button>
          </div>
        </div>

        <div className={`grid grid-cols-2 ${canViewCost ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-3'} gap-2.5 sm:gap-6 pt-4`}>
          {/* Revenue */}
          <div className="p-3 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100/90 dark:border-slate-800/60 sm:border-0 flex flex-col justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Revenue
            </span>
            <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-1">
              <AnimatedNumber value={monthly_performance.revenue} />
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
              Sales volume
            </span>
          </div>

          {canViewCost && (
            <div className="p-3 sm:p-0 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 sm:bg-transparent border border-emerald-100/80 dark:border-emerald-900/30 sm:border-0 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Gross Margin
              </span>
              <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-1">
                +<AnimatedNumber value={monthly_performance.gross_profit} />
                <span className="text-[10px] sm:text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 mt-1 block">
                Sales minus unit cost
              </span>
            </div>
          )}

          {/* Expenses (Clickable to trigger Record Expense Modal) */}
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            title="Click to record an expense or personal draw"
            className="p-3 sm:p-0 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 sm:bg-transparent border border-slate-100/90 dark:border-slate-800/60 sm:border-0 text-left group cursor-pointer sm:-m-2 sm:p-2 sm:rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 active:scale-[0.98] sm:active:scale-100 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                Expenses
              </span>
              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded sm:hidden flex items-center gap-0.5">
                <Plus className="w-2.5 h-2.5" /> Record
              </span>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-slate-800 dark:text-slate-200 mt-1">
              −<AnimatedNumber value={monthly_performance.operating_expenses} />
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Rent, ride, food · <span className="underline decoration-dotted sm:inline hidden">Record +</span>
            </span>
          </button>

          {canViewCost && (
            <div className="p-3 sm:p-0 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 sm:bg-transparent border border-emerald-100/80 dark:border-emerald-900/30 sm:border-0 flex flex-col justify-between">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Net Profit
              </span>
              <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-1">
                +<AnimatedNumber value={monthly_performance.net_profit} />
                <span className="text-[10px] sm:text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 mt-1 block">
                Clean operating profit
              </span>
            </div>
          )}

          {/* Draws */}
          <div className={`p-3 sm:p-0 rounded-xl bg-purple-50/40 dark:bg-purple-950/20 sm:bg-transparent border border-purple-100/80 dark:border-purple-900/30 sm:border-0 flex flex-col justify-between ${
            canViewCost ? 'col-span-2 sm:col-span-1' : ''
          }`}>
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
              Owner Draws
            </span>
            <div className="text-lg sm:text-2xl font-bold font-mono tracking-tight text-purple-700 dark:text-purple-300 mt-1">
              <AnimatedNumber value={monthly_performance.owner_draws} />
              <span className="text-[10px] sm:text-xs font-medium text-purple-400 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-purple-500/80 dark:text-purple-400/80 mt-1 block">
              Personal drawings
            </span>
          </div>
        </div>
      </div>

      {/* ── 5. Debt Ledgers — compact side-by-side tables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-stagger-5">
        {/* Receivables */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Owed to You</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                +{capital_overview.receivables.toLocaleString()} ETB
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDebtModalDefaultType('receivable');
                  setIsDebtModalOpen(true);
                }}
                title="Record new customer credit or receivable"
                className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors flex items-center gap-0.5 cursor-pointer py-1 px-1.5"
              >
                <Plus className="w-3 h-3" />
                <span>Record</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                onClick={() => onNavigateTab('debts')}
                className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer py-1 px-1.5"
              >
                View all · {counts.open_receivables} →
              </button>
            </div>
          </div>

          {top_receivables.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              No outstanding receivables
            </div>
          ) : (
            <div className="space-y-1">
              {top_receivables.map((debt) => (
                <button
                  key={debt.id}
                  onClick={() => setSelectedDebt(debt)}
                  className="w-full flex items-center justify-between min-h-[44px] py-2 px-2.5 sm:px-2 rounded-xl sm:rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70 transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border ${
                      debt.reference_type === 'handover_holding'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/50'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent'
                    }`}>
                      {debt.reference_type === 'handover_holding' ? 'HH' : (debt.contact?.name?.slice(0, 2) || 'CU')}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {debt.contact?.name}
                        </span>
                        {debt.reference_type === 'handover_holding' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                            Handover
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {debt.reference_type === 'handover_holding'
                          ? 'Vendor holding · Owes upon sale or returns device'
                          : (debt.notes || 'Customer credit balance')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      +{Number(debt.remaining_amount).toLocaleString()}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payables */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">You Owe</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                −{capital_overview.payables.toLocaleString()} ETB
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDebtModalDefaultType('payable');
                  setIsDebtModalOpen(true);
                }}
                title="Record new vendor payable or debt"
                className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors flex items-center gap-0.5 cursor-pointer py-1 px-1.5"
              >
                <Plus className="w-3 h-3" />
                <span>Record</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                onClick={() => onNavigateTab('debts')}
                className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer py-1 px-1.5"
              >
                View all · {counts.open_payables} →
              </button>
            </div>
          </div>

          {top_payables.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              All settled
            </div>
          ) : (
            <div className="space-y-0.5">
              {top_payables.map((debt) => (
                <button
                  key={debt.id}
                  onClick={() => setSelectedDebt(debt)}
                  className="w-full flex items-center justify-between min-h-[44px] py-2 px-2.5 sm:px-2 rounded-xl sm:rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 active:bg-slate-100 dark:active:bg-slate-800/70 transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-center text-[10px] uppercase shrink-0">
                      {debt.contact?.name?.slice(0, 2) || 'SP'}
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {debt.contact?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="font-semibold text-rose-600/80 dark:text-rose-400/70 font-mono">
                      −{Number(debt.remaining_amount).toLocaleString()}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Drawers ── */}
      <VitalBreakdownDrawer
        vitalType={selectedVital}
        isOpen={selectedVital !== null}
        onClose={() => setSelectedVital(null)}
        data={data}
        accounts={accounts}
        onNavigateTab={onNavigateTab}
        onSelectDebt={(debt) => {
          setSelectedVital(null);
          setSelectedDebt(debt);
        }}
        onRefreshData={onRefreshData}
      />

      <DebtDrawer
        debt={selectedDebt}
        isOpen={selectedDebt !== null}
        onClose={() => setSelectedDebt(null)}
        accounts={accounts}
        onPaymentSettled={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* ── Quick Action: Record Expense / Draw Modal ── */}
      <RecordExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        accounts={accounts}
        onSuccess={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* ── Quick Action: Record Receivable / Payable Modal ── */}
      <RecordDebtModal
        isOpen={isDebtModalOpen}
        onClose={() => setIsDebtModalOpen(false)}
        accounts={accounts}
        defaultType={debtModalDefaultType}
        onSuccess={() => {
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
