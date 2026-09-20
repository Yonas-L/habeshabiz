import React, { useState } from 'react';
import type { DashboardData, User, FinancialAccount, Debt } from '../api/client';
import {
  InteractiveSalesWaveChart,
  MiniSparkline,
  MiniBarHistogram,
  DonutCapitalChart,
} from '../components/Charts';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { VitalBreakdownDrawer, type VitalType } from '../components/drawers/VitalBreakdownDrawer';
import { DebtDrawer } from '../components/drawers/DebtDrawer';
import {
  Smartphone,
  CreditCard,
  Landmark,
  Coins,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

interface OverviewViewProps {
  data: DashboardData | null;
  user: User | null;
  accounts?: FinancialAccount[];
  onNavigateTab: (tab: any) => void;
  onRefreshData?: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  user,
  accounts = [],
  onNavigateTab,
  onRefreshData,
}) => {
  const [selectedVital, setSelectedVital] = useState<VitalType | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // 1. Premium Layout-Preserving Skeleton Loading State
  if (!data) {
    return (
      <div className="space-y-6 animate-page-enter">
        {/* Skeleton Hero Card */}
        <div className="h-52 rounded-3xl bg-slate-200/70 dark:bg-slate-800/60 animate-skeleton" />

        {/* Skeleton 4 Vitals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-skeleton" />
          ))}
        </div>

        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-skeleton" />
          <div className="h-72 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-skeleton" />
        </div>

        {/* Skeleton Performance Strip */}
        <div className="h-28 rounded-2xl bg-slate-200/70 dark:bg-slate-800/60 animate-skeleton" />
      </div>
    );
  }

  const { capital_overview, monthly_performance, counts, top_receivables, top_payables } = data;
  const canViewCost = user?.can_view_costs ?? false;

  const hasReceivablesAlert = counts.open_receivables > 0 && capital_overview.receivables > 0;
  const hasPayablesAlert = counts.open_payables > 0 && capital_overview.payables > 0;

  return (
    <div className="space-y-6 animate-page-enter">
      {/* 1. Contextual Actionable Alerts (Appears only when attention is required) */}
      {(hasReceivablesAlert || hasPayablesAlert) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-card-enter">
          {hasReceivablesAlert && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 transition-all hover:border-amber-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">
                    {counts.open_receivables} customers owe you money
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5 font-medium">
                    Total pending collection:{' '}
                    <span className="font-bold font-mono">
                      {capital_overview.receivables.toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVital('receivables')}
                className="h-8 px-3 rounded-xl bg-amber-600 dark:bg-amber-500 text-white font-bold text-xs hover:bg-amber-700 transition-all shadow-xs flex items-center gap-1 shrink-0 ml-2 active:scale-95"
              >
                <span>View Debts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {hasPayablesAlert && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/50 text-rose-900 dark:text-rose-200 transition-all hover:border-rose-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 dark:bg-rose-400/10 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">
                    {counts.open_payables} supplier payments due
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300/80 mt-0.5 font-medium">
                    Peer merchants waiting on settlement:{' '}
                    <span className="font-bold font-mono">
                      {capital_overview.payables.toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onNavigateTab('debts')}
                className="h-8 px-3 rounded-xl bg-rose-600 dark:bg-rose-500 text-white font-bold text-xs hover:bg-rose-700 transition-all shadow-xs flex items-center gap-1 shrink-0 ml-2 active:scale-95"
              >
                <span>Settle</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Primary Business Capital Spotlight (Clean, un-nested, authoritative card) */}
      <section className="bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)] animate-card-enter">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Total Store Capital (Net Worth)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Reconciled
              </span>
            </div>

            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
              <AnimatedNumber value={capital_overview.net_capital} />{' '}
              <span className="text-lg sm:text-2xl font-bold text-slate-400 dark:text-slate-500 font-sans">
                ETB
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Real store net worth: physical inventory + customer credit + available cash + gold/FX reserves minus debts owed to suppliers.
            </p>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateTab('counter')}
              className="h-11 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm active:scale-[0.98] flex items-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>+ Record Sale</span>
            </button>
            <button
              onClick={() => setSelectedVital('receivables')}
              className="h-11 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all active:scale-[0.98] flex items-center gap-1.5"
            >
              <span>Inspect Credit</span>
            </button>
          </div>
        </div>

        {/* Linear Capital Breakdown Strip (Interactive shortcuts to drawers) */}
        <div className="mt-7 pt-6 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div
            onClick={() => setSelectedVital('inventory')}
            className="cursor-pointer hover:opacity-80 transition-opacity p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Stock Value
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm mt-0.5 block">
              +<AnimatedNumber value={capital_overview.stock_value} /> ETB
            </span>
          </div>

          <div
            onClick={() => setSelectedVital('receivables')}
            className="cursor-pointer hover:opacity-80 transition-opacity p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
              Customer Debts
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm mt-0.5 block">
              +<AnimatedNumber value={capital_overview.receivables} /> ETB
            </span>
          </div>

          <div
            onClick={() => setSelectedVital('cash')}
            className="cursor-pointer hover:opacity-80 transition-opacity p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
              Cash & Banks
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm mt-0.5 block">
              +<AnimatedNumber value={capital_overview.cash_and_banks} /> ETB
            </span>
          </div>

          <div
            onClick={() => setSelectedVital('reserves')}
            className="cursor-pointer hover:opacity-80 transition-opacity p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
              Gold & FX
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm mt-0.5 block">
              +<AnimatedNumber value={capital_overview.custom_assets} /> ETB
            </span>
          </div>

          <div
            onClick={() => onNavigateTab('debts')}
            className="cursor-pointer hover:opacity-80 transition-opacity p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
              Owed to Suppliers
            </span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-sm mt-0.5 block">
              -<AnimatedNumber value={capital_overview.payables} /> ETB
            </span>
          </div>
        </div>
      </section>

      {/* 3. The 4 Essential Business Vitals (Interactive Cards that open drawer workspace) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Vital 1: Liquid Available Cash */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedVital('cash')}
          style={{ animationDelay: '50ms' }}
          className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md cursor-pointer active:scale-[0.99] animate-card-enter group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Available Cash
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight mt-2">
              <AnimatedNumber value={capital_overview.cash_and_banks} />{' '}
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
              <span>View accounts</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <MiniBarHistogram bars={[30, 45, 60, 50, 75, 80, 95]} color="indigo" />
          </div>
        </div>

        {/* Vital 2: Money Owed to You (Receivables) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedVital('receivables')}
          style={{ animationDelay: '100ms' }}
          className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md cursor-pointer active:scale-[0.99] animate-card-enter group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Money Owed to You
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tracking-tight mt-2">
              +<AnimatedNumber value={capital_overview.receivables} />{' '}
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-500">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
              <span>{counts.open_receivables} customers pending</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <MiniSparkline data={[140, 180, 160, 220, 260, 310, 370]} color="emerald" />
          </div>
        </div>

        {/* Vital 3: Physical Shop Inventory */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedVital('inventory')}
          style={{ animationDelay: '150ms' }}
          className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md cursor-pointer active:scale-[0.99] animate-card-enter group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Shop Inventory
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight mt-2">
              <AnimatedNumber value={capital_overview.stock_value} />{' '}
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
              <span>{counts.in_stock_phones} devices on shelf</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <MiniBarHistogram bars={[12, 18, 15, 24, 28, 35, 47]} color="slate" />
          </div>
        </div>

        {/* Vital 4: Store Gold & FX Reserves */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedVital('reserves')}
          style={{ animationDelay: '200ms' }}
          className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between transition-all hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md cursor-pointer active:scale-[0.99] animate-card-enter group"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Store Reserves
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight mt-2">
              <AnimatedNumber value={capital_overview.custom_assets} />{' '}
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
              <span>Gold & USDT hedge</span>
              <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <MiniSparkline data={[200, 210, 230, 240, 280, 310, 350]} color="amber" />
          </div>
        </div>
      </div>

      {/* 4. Secondary Analytics: Interactive Trading Wave + Capital Allocation Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Sales Wave Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]">
          <InteractiveSalesWaveChart canViewCost={canViewCost} />
        </div>

        {/* Right 1 Col: Donut Capital Composition */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Asset Allocation
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Store Balance
              </span>
            </div>

            <div className="py-4">
              <DonutCapitalChart
                stock={capital_overview.stock_value}
                receivables={capital_overview.receivables}
                treasury={capital_overview.cash_and_banks}
                assets={capital_overview.custom_assets}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 dark:text-slate-500 font-medium">Owed to peer shops:</span>
            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
              -{capital_overview.payables.toLocaleString()} ETB
            </span>
          </div>
        </div>
      </div>

      {/* 5. Executive P&L Strip (Monthly Trading Performance) */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">
              Monthly Trading Performance & Cash Flow
            </span>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Active Accounting Period
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium block">Gross Revenue</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono text-base mt-0.5 block">
              <AnimatedNumber value={monthly_performance.revenue} /> ETB
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Phone sales volume</span>
          </div>

          {canViewCost && (
            <div>
              <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold block">Gross Margin Profit</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-base mt-0.5 block">
                +<AnimatedNumber value={monthly_performance.gross_profit} /> ETB
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-500">Sales minus item cost</span>
            </div>
          )}

          <div>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium block">Operating Expenses</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-base mt-0.5 block">
              -<AnimatedNumber value={monthly_performance.operating_expenses} /> ETB
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Rent, delivery, staff</span>
          </div>

          {canViewCost && (
            <div>
              <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold block">Net Operating Profit</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-base mt-0.5 block">
                +<AnimatedNumber value={monthly_performance.net_profit} /> ETB
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-500">Clean shop profit</span>
            </div>
          )}

          <div>
            <span className="text-purple-600 dark:text-purple-400 text-[11px] font-bold block">Owner Personal Draws</span>
            <span className="font-bold text-purple-700 dark:text-purple-400 font-mono text-base mt-0.5 block">
              <AnimatedNumber value={monthly_performance.owner_draws} /> ETB
            </span>
            <span className="text-[10px] text-purple-400 dark:text-purple-500">Personal drawings (Yoni)</span>
          </div>
        </div>
      </div>

      {/* 6. Actionable Debts & Payables Ledgers (Interactive rows that open Debt Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Receivables Card */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                Top Customer Receivables
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Click any record to inspect or collect</p>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline transition-all"
            >
              Full Ledger &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
            {top_receivables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No open customer debts.
              </div>
            ) : (
              top_receivables.map((debt) => (
                <div
                  key={debt.id}
                  onClick={() => setSelectedDebt(debt)}
                  className="py-3 px-2 -mx-2 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-center text-xs uppercase border border-emerald-200/50 dark:border-emerald-800/50 group-hover:scale-105 transition-transform">
                      {debt.contact?.name?.slice(0, 2) || 'CU'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {debt.contact?.name}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{debt.notes || 'Credit purchase'}</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                        +{Number(debt.remaining_amount).toLocaleString()} ETB
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        Open
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supplier Payables Card */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                Peer Sourcing Payables
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Click any record to inspect or settle</p>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline transition-all"
            >
              Full Ledger &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-2">
            {top_payables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                All peer shops settled.
              </div>
            ) : (
              top_payables.map((debt) => (
                <div
                  key={debt.id}
                  onClick={() => setSelectedDebt(debt)}
                  className="py-3 px-2 -mx-2 rounded-xl flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 font-bold flex items-center justify-center text-xs uppercase border border-rose-200/50 dark:border-rose-800/50 group-hover:scale-105 transition-transform">
                      {debt.contact?.name?.slice(0, 2) || 'PR'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {debt.contact?.name}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{debt.notes || 'Sourced stock'}</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                        -{Number(debt.remaining_amount).toLocaleString()} ETB
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                        Due
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Vital Breakdown Drawer */}
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
      />

      {/* Debt Detail Workspace Drawer */}
      <DebtDrawer
        debt={selectedDebt}
        isOpen={selectedDebt !== null}
        onClose={() => setSelectedDebt(null)}
        accounts={accounts}
        onPaymentSettled={() => {
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
