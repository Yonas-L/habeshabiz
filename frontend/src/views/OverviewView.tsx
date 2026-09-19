import React from 'react';
import type { DashboardData, User } from '../api/client';
import {
  InteractiveSalesWaveChart,
  MiniSparkline,
  MiniBarHistogram,
  DonutCapitalChart,
} from '../components/Charts';
import {
  Smartphone,
  CreditCard,
  Landmark,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

interface OverviewViewProps {
  data: DashboardData | null;
  user: User | null;
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data, user, onNavigateTab }) => {
  if (!data) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs flex items-center justify-center gap-2 animate-pulse">
        <Sparkles className="w-4 h-4 text-emerald-500 animate-spin" />
        <span>Loading live business intelligence...</span>
      </div>
    );
  }

  const { capital_overview, monthly_performance, counts, top_receivables, top_payables } = data;
  const canViewCost = user?.can_view_costs ?? false;

  return (
    <div className="space-y-6">
      {/* 1. Hero Feature Banner (Inspired by dashbord2.webp and dash5.webp) */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
        {/* Subtle decorative background glow circles */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 rounded-full bg-emerald-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold text-emerald-100 mb-3 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Authoritative Master Capital Matrix</span>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono">
              {capital_overview.net_capital.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{' '}
              <span className="text-lg sm:text-xl font-normal text-emerald-200 font-sans">ETB</span>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-2 leading-relaxed">
              Dynamically reconciled across physical shop inventory, customer debt receivables, liquid CBE/TeleBirr accounts, and 18k/21k gold wealth preservation assets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateTab('counter')}
              className="h-10 px-4 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-emerald-50 transition-all shadow-sm active:scale-[0.98] flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span>+ Quick POS Sale</span>
            </button>
            <button
              onClick={() => onNavigateTab('debts')}
              className="h-10 px-4 rounded-xl bg-slate-900/50 backdrop-blur-md hover:bg-slate-900/70 border border-white/20 text-white font-semibold text-xs transition-all active:scale-[0.98] flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
              <span>Collect Debts</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. 4 Bold KPI Cards with Embedded Visualizations (Inspired by dash6.webp & dash7.webp) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Physical Stock Value */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <MiniBarHistogram bars={[12, 18, 15, 24, 28, 35, 47]} color="slate" />
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Physical Stock Value
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono tracking-tight mt-0.5">
              {capital_overview.stock_value.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{counts.in_stock_phones} units in stock</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Customer Debts (Receivables) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <MiniSparkline data={[140, 180, 160, 220, 260, 310, 370]} color="emerald" />
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Customer Debts (Receivables)
            </span>
            <div className="text-xl font-extrabold text-emerald-700 font-mono tracking-tight mt-0.5">
              +{capital_overview.receivables.toLocaleString()}{' '}
              <span className="text-xs font-normal text-emerald-600 font-sans">ETB</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500 font-medium">
              <span>{counts.open_receivables} customers owe shop</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Liquid Treasury */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <MiniBarHistogram bars={[30, 45, 60, 50, 75, 80, 95]} color="indigo" />
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Liquid Cash & Banks
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono tracking-tight mt-0.5">
              +{capital_overview.cash_and_banks.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500 font-medium">
              <span>CBE, TeleBirr, Awash, Cash</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Store Gold & FX Hedges */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <MiniSparkline data={[200, 210, 230, 240, 280, 310, 350]} color="amber" />
          </div>
          <div className="mt-4">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Gold & FX Store Assets
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono tracking-tight mt-0.5">
              +{capital_overview.custom_assets.toLocaleString()}{' '}
              <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-700 font-semibold">
              <span>18k/21k Gold & USD/USDT</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Central Analytics Grid: Interactive Wave Chart + Donut Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Sales Wave Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <InteractiveSalesWaveChart />
        </div>

        {/* Right 1 Col: Donut Capital Composition */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Capital Composition
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Ratio
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

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Supplier Payables:</span>
            <span className="font-bold text-rose-600 font-mono">
              -{capital_overview.payables.toLocaleString()} ETB
            </span>
          </div>
        </div>
      </div>

      {/* 4. Executive P&L Strip (Inspired by dasboard3.webp and dash7.webp) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">Monthly Trading Performance & Cash Flow</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Fully verified with Addis Ababa December 2025 books</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 text-xs">
          <div>
            <span className="text-slate-400 text-[11px] block">Gross Revenue</span>
            <span className="font-extrabold text-slate-900 font-mono text-base mt-0.5 block">
              {monthly_performance.revenue.toLocaleString()} ETB
            </span>
            <span className="text-[10px] text-slate-400">Total phone sales</span>
          </div>

          {canViewCost && (
            <div>
              <span className="text-emerald-700 text-[11px] font-semibold block">Gross Margin Profit</span>
              <span className="font-extrabold text-emerald-700 font-mono text-base mt-0.5 block">
                +{monthly_performance.gross_profit.toLocaleString()} ETB
              </span>
              <span className="text-[10px] text-emerald-600">Before overhead costs</span>
            </div>
          )}

          <div>
            <span className="text-slate-500 text-[11px] block">Operating Expenses</span>
            <span className="font-extrabold text-slate-800 font-mono text-base mt-0.5 block">
              -{monthly_performance.operating_expenses.toLocaleString()} ETB
            </span>
            <span className="text-[10px] text-slate-400">RIDE, maintenance, food</span>
          </div>

          {canViewCost && (
            <div>
              <span className="text-emerald-700 text-[11px] font-semibold block">Net Operating Profit</span>
              <span className="font-extrabold text-emerald-700 font-mono text-base mt-0.5 block">
                +{monthly_performance.net_profit.toLocaleString()} ETB
              </span>
              <span className="text-[10px] text-emerald-600">Clean business profit</span>
            </div>
          )}

          <div>
            <span className="text-purple-600 text-[11px] font-semibold block">Owner Personal Draws</span>
            <span className="font-extrabold text-purple-700 font-mono text-base mt-0.5 block">
              {monthly_performance.owner_draws.toLocaleString()} ETB
            </span>
            <span className="text-[10px] text-purple-400">Personal drawings (Yoni)</span>
          </div>
        </div>
      </div>

      {/* 5. Bottom Open Ledgers: Receivables & Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Receivables Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-sm tracking-tight">
                Top Customer Credit Receivables
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Uncollected credit sales to customers</p>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Full Ledger &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {top_receivables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No open customer debts.</div>
            ) : (
              top_receivables.map((debt) => (
                <div key={debt.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs uppercase">
                      {debt.contact?.name?.slice(0, 2) || 'CU'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{debt.contact?.name}</div>
                      <div className="text-[11px] text-slate-400">{debt.notes || 'Credit purchase'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-emerald-700 font-mono">
                      +{Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700">
                      Open
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supplier Payables Card */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-bold text-slate-900 text-sm tracking-tight">
                Peer Merchant Sourcing Payables
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Debts owed to peer shops (Mekdi, Yenus)</p>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors"
            >
              Full Ledger &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {top_payables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">All peer shops settled.</div>
            ) : (
              top_payables.map((debt) => (
                <div key={debt.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 font-bold flex items-center justify-center text-xs uppercase">
                      {debt.contact?.name?.slice(0, 2) || 'PR'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{debt.contact?.name}</div>
                      <div className="text-[11px] text-slate-400">{debt.notes || 'Sourced inventory'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-rose-700 font-mono">
                      -{Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-rose-50 text-rose-700">
                      Due
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
