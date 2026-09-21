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
import {
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Award,
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
  const [topSeller, setTopSeller] = useState<LeaderboardItem | null>(null);

  useEffect(() => {
    if (user?.role === 'owner') {
      api.getLeaderboard()
        .then((res) => setTopSeller(res.top_seller || null))
        .catch(() => {});
    }
  }, [user]);

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

  const hasReceivablesAlert = counts.open_receivables > 0 && capital_overview.receivables > 0;
  const hasPayablesAlert = counts.open_payables > 0 && capital_overview.payables > 0;

  /* ─── Capital metrics for the unified strip ─── */
  const capitalMetrics: {
    key: VitalType;
    label: string;
    value: number;
    prefix: string;
    accent?: string;
    onClick: () => void;
  }[] = [
    {
      key: 'inventory',
      label: 'Stock',
      value: capital_overview.stock_value,
      prefix: '',
      onClick: () => setSelectedVital('inventory'),
    },
    {
      key: 'receivables',
      label: 'Owed to You',
      value: capital_overview.receivables,
      prefix: '+',
      accent: 'text-emerald-600 dark:text-emerald-400',
      onClick: () => setSelectedVital('receivables'),
    },
    {
      key: 'cash',
      label: 'Cash & Bank',
      value: capital_overview.cash_and_banks,
      prefix: '',
      onClick: () => setSelectedVital('cash'),
    },
    {
      key: 'reserves',
      label: 'Reserves',
      value: capital_overview.custom_assets,
      prefix: '',
      onClick: () => setSelectedVital('reserves'),
    },
    {
      key: 'payables',
      label: 'You Owe',
      value: capital_overview.payables,
      prefix: '−',
      accent: 'text-rose-600/80 dark:text-rose-400/80',
      onClick: () => setSelectedVital('payables'),
    },
  ];

  return (
    <div className="space-y-4 animate-page-enter">

      {/* ── 1. Inline Alerts (only when action needed) ── */}
      {(hasReceivablesAlert || hasPayablesAlert) && (
        <div className="flex flex-wrap gap-2">
          {hasReceivablesAlert && (
            <button
              onClick={() => setSelectedVital('receivables')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200 text-xs font-medium hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors active:scale-[0.99]"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                <span className="font-bold text-emerald-800 dark:text-emerald-300">Owed to you:</span>{' '}
                <span className="font-semibold">{counts.open_receivables}</span> {counts.open_receivables === 1 ? 'party owes' : 'parties owe'}{' '}
                <span className="font-mono font-bold text-emerald-950 dark:text-emerald-100">{capital_overview.receivables.toLocaleString()}</span> ETB
              </span>
              <ArrowRight className="w-3 h-3 opacity-50" />
            </button>
          )}

          {hasPayablesAlert && (
            <button
              onClick={() => setSelectedVital('payables')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-xs font-medium hover:border-rose-300 dark:hover:border-rose-700 transition-colors active:scale-[0.99]"
            >
              <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
              <span>
                <span className="font-bold text-rose-800 dark:text-rose-300">You owe:</span>{' '}
                <span className="font-semibold">{counts.open_payables}</span> {counts.open_payables === 1 ? 'payable due' : 'payables due'}{' '}
                <span className="font-mono font-bold text-rose-900 dark:text-rose-200">{capital_overview.payables.toLocaleString()}</span> ETB
              </span>
              <ArrowRight className="w-3 h-3 opacity-50" />
            </button>
          )}
        </div>
      )}

      {/* ── 2. Capital Strip — single compact row, no cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-slate-200/60 dark:bg-slate-800/50 rounded-xl overflow-hidden">
        {capitalMetrics.map((m) => (
          <button
            key={m.key}
            onClick={m.onClick}
            className="bg-white dark:bg-[#131926] px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-[#171e2e] transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-inset"
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

      {/* ── 3. Charts — Sales trajectory + Capital allocation, side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-5">
          <InteractiveSalesWaveChart canViewCost={canViewCost} />
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/60 mb-3.5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Asset & Capital Allocation
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Portfolio Balance & Debts
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                  Month Net Profit
                </span>
                <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  +<AnimatedNumber value={monthly_performance.net_profit} /> ETB
                </span>
              </div>
            </div>
            <DonutCapitalChart
              stock={capital_overview.stock_value}
              receivables={capital_overview.receivables}
              treasury={capital_overview.cash_and_banks}
              assets={capital_overview.custom_assets}
              payables={capital_overview.payables}
              netCapital={capital_overview.net_capital}
              netProfit={monthly_performance.net_profit}
            />
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between pr-3 border-r border-slate-100 dark:border-slate-800/60">
              <span className="text-slate-400 dark:text-slate-500 text-[11px]">Gross Assets</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                {(capital_overview.stock_value + capital_overview.receivables + capital_overview.cash_and_banks + capital_overview.custom_assets).toLocaleString()} ETB
              </span>
            </div>
            <div className="flex items-center justify-between pl-1">
              <span className="text-slate-400 dark:text-slate-500 text-[11px]">Payables Owed</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                −{capital_overview.payables.toLocaleString()} ETB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. This Month's Performance (High-Visibility Operational Metrics) ── */}
      <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-5">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              This Month's Performance
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {topSeller && user?.role === 'owner' && (
              <button
                onClick={() => onNavigateTab('staff')}
                title="View Staff & Team Dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-[11px] font-semibold hover:border-amber-400 transition-all active:scale-[0.98]"
              >
                <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Week's Top Seller: <span className="font-bold">{topSeller.name}</span></span>
                <ChevronRight className="w-3 h-3 opacity-60" />
              </button>
            )}
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Active Trading Period
            </span>
          </div>
        </div>

        <div className={`grid grid-cols-2 ${canViewCost ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-3'} gap-4 sm:gap-6 pt-4`}>
          {/* Revenue */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Revenue
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-1">
              <AnimatedNumber value={monthly_performance.revenue} />
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
              Sales volume
            </span>
          </div>

          {canViewCost && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Gross Margin
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-1">
                +<AnimatedNumber value={monthly_performance.gross_profit} />
                <span className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 mt-0.5 block">
                Sales minus unit cost
              </span>
            </div>
          )}

          {/* Expenses */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Expenses
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-800 dark:text-slate-200 mt-1">
              −<AnimatedNumber value={monthly_performance.operating_expenses} />
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
              Rent, delivery, staff
            </span>
          </div>

          {canViewCost && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Net Profit
              </span>
              <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400 mt-1">
                +<AnimatedNumber value={monthly_performance.net_profit} />
                <span className="text-xs font-medium text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500/80 mt-0.5 block">
                Clean operating profit
              </span>
            </div>
          )}

          {/* Draws */}
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
              Owner Draws
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-purple-700 dark:text-purple-300 mt-1">
              <AnimatedNumber value={monthly_performance.owner_draws} />
              <span className="text-xs font-medium text-purple-400 ml-1 font-sans">ETB</span>
            </div>
            <span className="text-[10px] text-purple-500/80 dark:text-purple-400/80 mt-0.5 block">
              Personal drawings (Yoni)
            </span>
          </div>
        </div>
      </div>

      {/* ── 5. Debt Ledgers — compact side-by-side tables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Receivables */}
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Owed to You (Inflow)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                +{capital_overview.receivables.toLocaleString()} ETB
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              View all ({counts.open_receivables}) →
            </button>
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
                  className="w-full flex items-center justify-between py-2 px-2 -mx-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-inset"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border ${
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
                    <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payables */}
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">You Owe (Outflow)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                −{capital_overview.payables.toLocaleString()} ETB
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              View all ({counts.open_payables}) →
            </button>
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
                  className="w-full flex items-center justify-between py-2 px-2 -mx-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-inset"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold flex items-center justify-center text-[10px] uppercase shrink-0">
                      {debt.contact?.name?.slice(0, 2) || 'SP'}
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {debt.contact?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-semibold text-rose-600/80 dark:text-rose-400/70 font-mono">
                      −{Number(debt.remaining_amount).toLocaleString()}
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
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
    </div>
  );
};
