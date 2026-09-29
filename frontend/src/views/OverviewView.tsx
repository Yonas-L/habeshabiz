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
  ChevronRight,
  TrendingUp,
  Plus,
  ArrowLeftRight,
  Package,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  Coins,
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
  const [isBarAnimated, setIsBarAnimated] = useState(false);

  useEffect(() => {
    setIsBarAnimated(false);
    const t = setTimeout(() => setIsBarAnimated(true), 100);
    return () => clearTimeout(t);
  }, [data]);

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

  /* ─── Gross assets and proportional breakdown for mobile visual bar ─── */
  const grossAssets = (capital_overview.stock_value || 0) +
    (capital_overview.cash_and_banks || 0) +
    (capital_overview.receivables || 0) +
    (capital_overview.custom_assets || 0);

  const stockPct = grossAssets > 0 ? Math.round(((capital_overview.stock_value || 0) / grossAssets) * 100) : 0;
  const cashPct = grossAssets > 0 ? Math.round(((capital_overview.cash_and_banks || 0) / grossAssets) * 100) : 0;
  const recPct = grossAssets > 0 ? Math.round(((capital_overview.receivables || 0) / grossAssets) * 100) : 0;
  const assetPct = grossAssets > 0 ? Math.max(0, 100 - stockPct - cashPct - recPct) : 0;

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
      label: 'Other Assets',
      value: capital_overview.custom_assets,
      prefix: '',
      icon: <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
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

      {/* ── 1. Capital Strip — single compact row on desktop, tactile native cards on mobile ── */}
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

      {/* ── Mobile Capital Hero + Action Cards (< sm) ── */}
      <div className="sm:hidden space-y-2.5 animate-stagger-2">
        {/* Working Capital Hero Card — Obsidian Black with Emerald Accents */}
        <div className="rounded-2xl bg-slate-900 dark:bg-black p-4 border border-slate-800/90 dark:border-slate-800 shadow-sm text-white relative overflow-hidden">
          {/* Subtle ambient emerald glow */}
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top header row */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Working Capital
              </span>
            </div>
          </div>

          {/* Primary Balance */}
          <div className="mt-2.5 relative z-10 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold font-mono tracking-tight text-white">
              <AnimatedNumber value={capital_overview.net_capital} />
            </span>
            <span className="text-xs font-bold text-emerald-400 font-sans">ETB</span>
          </div>

          {/* Asset Allocation Proportional Distribution Bar — Fatter with smooth load animation */}
          <div className="mt-3.5 relative z-10">
            <div className="h-3.5 w-full rounded-full bg-white/10 overflow-hidden flex gap-1 p-0.5 shadow-inner">
              {stockPct > 0 && (
                <div
                  style={{
                    width: isBarAnimated ? `${stockPct}%` : '0%',
                    transition: 'width 900ms cubic-bezier(0.16, 1, 0.3, 1)',
                    transitionDelay: '40ms',
                  }}
                  className="h-full bg-slate-400 rounded-full"
                  title={`Stock: ${stockPct}%`}
                />
              )}
              {cashPct > 0 && (
                <div
                  style={{
                    width: isBarAnimated ? `${cashPct}%` : '0%',
                    transition: 'width 900ms cubic-bezier(0.16, 1, 0.3, 1)',
                    transitionDelay: '90ms',
                  }}
                  className="h-full bg-blue-400 rounded-full"
                  title={`Cash: ${cashPct}%`}
                />
              )}
              {recPct > 0 && (
                <div
                  style={{
                    width: isBarAnimated ? `${recPct}%` : '0%',
                    transition: 'width 900ms cubic-bezier(0.16, 1, 0.3, 1)',
                    transitionDelay: '140ms',
                  }}
                  className="h-full bg-emerald-400 rounded-full"
                  title={`Receivables: ${recPct}%`}
                />
              )}
              {assetPct > 0 && (
                <div
                  style={{
                    width: isBarAnimated ? `${assetPct}%` : '0%',
                    transition: 'width 900ms cubic-bezier(0.16, 1, 0.3, 1)',
                    transitionDelay: '190ms',
                  }}
                  className="h-full bg-amber-400 rounded-full"
                  title={`Other Assets: ${assetPct}%`}
                />
              )}
            </div>

            {/* Micro legend chips */}
            <div className="flex items-center justify-between flex-wrap gap-y-1 text-[10px] text-slate-300 font-medium mt-2 pt-1.5 border-t border-white/10">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span>Stock {stockPct}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                <span>Cash {cashPct}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span>Owed {recPct}%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>Other {assetPct}%</span>
              </div>
              {capital_overview.payables > 0 && (
                <div className="flex items-center gap-1 text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                  <span>Owe −{capital_overview.payables.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cardless Native Financial Action Row (< sm) */}
        <div className="grid grid-cols-5 gap-1.5 pt-1.5 pb-1">
          {/* 1. Stock */}
          <button
            onClick={() => setSelectedVital('inventory')}
            className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
            title={`Stock: ${capital_overview.stock_value.toLocaleString()} ETB`}
          >
            <div className="w-13 h-13 rounded-2xl bg-slate-900 dark:bg-black border border-slate-800/80 dark:border-slate-800 shadow-xs flex items-center justify-center text-emerald-400 group-hover:bg-slate-800 dark:group-hover:bg-slate-900 transition-colors mx-auto">
              <Package className="w-7 h-7 text-emerald-400 stroke-[2]" />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
              Stock
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-0.5 truncate max-w-full block">
              <AnimatedNumber value={capital_overview.stock_value} />
            </span>
          </button>

          {/* 2. Bank */}
          <button
            onClick={() => setSelectedVital('cash')}
            className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
            title={`Bank: ${capital_overview.cash_and_banks.toLocaleString()} ETB`}
          >
            <div className="w-13 h-13 rounded-2xl bg-slate-900 dark:bg-black border border-slate-800/80 dark:border-slate-800 shadow-xs flex items-center justify-center text-emerald-400 group-hover:bg-slate-800 dark:group-hover:bg-slate-900 transition-colors mx-auto">
              <Landmark className="w-7 h-7 text-emerald-400 stroke-[2]" />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
              Bank
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-0.5 truncate max-w-full block">
              <AnimatedNumber value={capital_overview.cash_and_banks} />
            </span>
          </button>

          {/* 3. Owed to You (green down arrow) */}
          <button
            onClick={() => setSelectedVital('receivables')}
            className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
            title={`Owed to You: ${capital_overview.receivables.toLocaleString()} ETB`}
          >
            <div className="w-13 h-13 rounded-2xl bg-slate-900 dark:bg-black border border-slate-800/80 dark:border-slate-800 shadow-xs flex items-center justify-center text-emerald-400 group-hover:bg-slate-800 dark:group-hover:bg-slate-900 transition-colors mx-auto">
              <ArrowDown className="w-7 h-7 text-emerald-400 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
              Owed
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5 truncate max-w-full block">
              +<AnimatedNumber value={capital_overview.receivables} />
            </span>
          </button>

          {/* 4. You Owe (red up arrow) */}
          <button
            onClick={() => setSelectedVital('payables')}
            className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
            title={`You Owe: ${capital_overview.payables.toLocaleString()} ETB`}
          >
            <div className="w-13 h-13 rounded-2xl bg-slate-900 dark:bg-black border border-slate-800/80 dark:border-slate-800 shadow-xs flex items-center justify-center text-emerald-400 group-hover:bg-slate-800 dark:group-hover:bg-slate-900 transition-colors mx-auto">
              <ArrowUp className="w-7 h-7 text-emerald-400 stroke-[2.2]" />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
              You Owe
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-0.5 truncate max-w-full block">
              −<AnimatedNumber value={capital_overview.payables} />
            </span>
          </button>

          {/* 5. Other Assets */}
          <button
            onClick={() => setSelectedVital('reserves')}
            className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
            title={`Other Assets: ${capital_overview.custom_assets.toLocaleString()} ETB`}
          >
            <div className="w-13 h-13 rounded-2xl bg-slate-900 dark:bg-black border border-slate-800/80 dark:border-slate-800 shadow-xs flex items-center justify-center text-emerald-400 group-hover:bg-slate-800 dark:group-hover:bg-slate-900 transition-colors mx-auto">
              <Coins className="w-7 h-7 text-emerald-400 stroke-[2]" />
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
              Other
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-0.5 truncate max-w-full block">
              <AnimatedNumber value={capital_overview.custom_assets} />
            </span>
          </button>
        </div>
      </div>

      {/* ── 3. Charts — Sales trajectory + Capital allocation, visible ONLY on desktop ── */}
      <div className="hidden sm:grid grid-cols-1 lg:grid-cols-12 gap-4 animate-stagger-3">
        <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-5">
          <InteractiveSalesWaveChart
            data={data.sales_chart || []}
            totalRevenue={monthly_performance.revenue}
            totalProfit={monthly_performance.gross_profit}
            canViewCost={canViewCost}
          />
        </div>

        {/* Asset Allocation Donut Chart — visible on desktop (lg), hidden on mobile where it's shown above */}
        <div className="hidden lg:flex lg:col-span-5 bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4 sm:p-5 flex-col justify-between">
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

        <div className={`grid grid-cols-2 ${canViewCost ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-3'} gap-2 sm:gap-6 pt-3.5`}>
          {/* Revenue */}
          <div className="p-3 sm:p-0 rounded-2xl sm:rounded-none bg-slate-50/80 dark:bg-[#0c1017] sm:bg-transparent border border-slate-200/60 dark:border-slate-800/80 sm:border-0 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Revenue
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 sm:hidden" />
            </div>
            <div className="text-base sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-1.5">
              <AnimatedNumber value={monthly_performance.revenue} />
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
              Sales volume
            </span>
          </div>

          {canViewCost && (
            <div className="p-3 sm:p-0 rounded-2xl sm:rounded-none bg-slate-50/80 dark:bg-[#0c1017] sm:bg-transparent border border-slate-200/60 dark:border-slate-800/80 sm:border-0 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Gross Margin
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 sm:hidden" />
              </div>
              <div className="text-base sm:text-2xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-1.5">
                +<AnimatedNumber value={monthly_performance.gross_profit} />
                <span className="text-[10px] sm:text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 mt-1 block">
                Sales − unit cost
              </span>
            </div>
          )}

          {/* Expenses (Clickable to trigger Record Expense Modal) */}
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            title="Click to record an expense or personal draw"
            className="p-3 sm:p-0 rounded-2xl sm:rounded-none bg-slate-50/80 dark:bg-[#0c1017] sm:bg-transparent border border-slate-200/60 dark:border-slate-800/80 sm:border-0 text-left group cursor-pointer sm:-m-2 sm:p-2 sm:rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 active:scale-[0.98] sm:active:scale-100 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                Expenses
              </span>
              <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md sm:hidden flex items-center gap-0.5">
                <Plus className="w-2.5 h-2.5" /> Record
              </span>
            </div>
            <div className="text-base sm:text-2xl font-bold font-mono tracking-tight text-slate-800 dark:text-slate-200 mt-1.5">
              −<AnimatedNumber value={monthly_performance.operating_expenses} />
              <span className="text-[10px] sm:text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              Rent, ride, bills · <span className="underline decoration-dotted sm:inline hidden">Record +</span>
            </span>
          </button>

          {canViewCost && (
            <div className="p-3 sm:p-0 rounded-2xl sm:rounded-none bg-slate-50/80 dark:bg-[#0c1017] sm:bg-transparent border border-slate-200/60 dark:border-slate-800/80 sm:border-0 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Net Profit
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 sm:hidden" />
              </div>
              <div className="text-base sm:text-2xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-1.5">
                +<AnimatedNumber value={monthly_performance.net_profit} />
                <span className="text-[10px] sm:text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 mt-1 block">
                Operating profit
              </span>
            </div>
          )}

          {/* Draws */}
          <div className={`p-3 sm:p-0 rounded-2xl sm:rounded-none bg-slate-50/80 dark:bg-[#0c1017] sm:bg-transparent border border-slate-200/60 dark:border-slate-800/80 sm:border-0 flex flex-col justify-between ${
            canViewCost ? 'col-span-2 sm:col-span-1' : ''
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Owner Draws
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 sm:hidden" />
            </div>
            <div className="text-base sm:text-2xl font-bold font-mono tracking-tight text-purple-700 dark:text-purple-300 mt-1.5">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 animate-stagger-5">
        {/* Receivables */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Owed to You</span>
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
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#0c1017]/40 sm:bg-transparent rounded-xl border border-dashed border-slate-200/60 dark:border-slate-800/60 sm:border-0">
              No outstanding receivables
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-1">
              {top_receivables.map((debt) => (
                <button
                  key={debt.id}
                  onClick={() => setSelectedDebt(debt)}
                  className="w-full flex items-center justify-between min-h-[46px] p-2.5 sm:py-2 sm:px-2 rounded-xl sm:rounded-lg text-xs bg-slate-50/70 dark:bg-[#0c1017]/70 sm:bg-transparent border border-slate-100/90 dark:border-slate-800/70 sm:border-0 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 sm:hover:bg-slate-50 sm:dark:hover:bg-slate-800/40 active:scale-[0.99] sm:active:scale-100 transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border ${
                      debt.reference_type === 'handover_holding'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/50'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60'
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
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                      +{Number(debt.remaining_amount).toLocaleString()}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payables */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl sm:rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">You Owe</span>
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
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#0c1017]/40 sm:bg-transparent rounded-xl border border-dashed border-slate-200/60 dark:border-slate-800/60 sm:border-0">
              No outstanding payables
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-1">
              {top_payables.map((debt) => (
                <button
                  key={debt.id}
                  onClick={() => setSelectedDebt(debt)}
                  className="w-full flex items-center justify-between min-h-[46px] p-2.5 sm:py-2 sm:px-2 rounded-xl sm:rounded-lg text-xs bg-slate-50/70 dark:bg-[#0c1017]/70 sm:bg-transparent border border-slate-100/90 dark:border-slate-800/70 sm:border-0 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 sm:hover:bg-slate-50 sm:dark:hover:bg-slate-800/40 active:scale-[0.99] sm:active:scale-100 transition-all group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                      {debt.contact?.name?.slice(0, 2) || 'SP'}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">
                        {debt.contact?.name}
                      </span>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {debt.notes || 'Supplier payable balance'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                      −{Number(debt.remaining_amount).toLocaleString()}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
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
