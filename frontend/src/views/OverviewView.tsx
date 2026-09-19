import React from 'react';
import type { DashboardData, User } from '../api/client';
import { RevenueTrendChart, CapitalCompositionBar } from '../components/Charts';

interface OverviewViewProps {
  data: DashboardData | null;
  user: User | null;
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data, user, onNavigateTab }) => {
  if (!data) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs flex items-center justify-center gap-2 animate-pulse">
        <span>Loading business ledger...</span>
      </div>
    );
  }

  const { capital_overview, monthly_performance, counts, top_receivables, top_payables } = data;
  const canViewCost = user?.can_view_costs ?? false;

  return (
    <div className="space-y-5">
      {/* 1. Master Capital Matrix Control Surface */}
      <section className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Authoritative Net Capital Formula
            </div>
            <div className="text-2xl sm:text-3xl font-semibold text-slate-900 font-mono tracking-tight mt-0.5">
              {capital_overview.net_capital.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-sm font-normal text-slate-400">ETB</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => onNavigateTab('counter')}
              className="px-3 py-1.5 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800 transition-all shadow-xs active:scale-[0.98]"
            >
              + Quick POS Sale
            </button>
            <button
              onClick={() => onNavigateTab('debts')}
              className="px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-all active:scale-[0.98]"
            >
              Collect Debts
            </button>
          </div>
        </div>

        {/* Capital Composition Bar & Breakdown */}
        <div className="pt-4">
          <CapitalCompositionBar
            stock={capital_overview.stock_value}
            receivables={capital_overview.receivables}
            cashAndBanks={capital_overview.cash_and_banks}
            customAssets={capital_overview.custom_assets}
            payables={capital_overview.payables}
          />
        </div>
      </section>

      {/* 2. Charts & Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Interactive 14-day Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200/80 p-5 shadow-xs">
          <RevenueTrendChart />
        </div>

        {/* Monthly Performance Ledger Summary */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-3">
              Monthly P&L Metrics
            </div>

            <div className="space-y-3.5">
              <div className="flex items-baseline justify-between py-1 border-b border-slate-100">
                <span className="text-xs text-slate-500">Gross Sales Revenue</span>
                <span className="text-sm font-semibold text-slate-900 font-mono">
                  {monthly_performance.revenue.toLocaleString()} ETB
                </span>
              </div>

              {canViewCost && (
                <div className="flex items-baseline justify-between py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Gross Margin Profit</span>
                  <span className="text-sm font-semibold text-emerald-700 font-mono">
                    +{monthly_performance.gross_profit.toLocaleString()} ETB
                  </span>
                </div>
              )}

              <div className="flex items-baseline justify-between py-1 border-b border-slate-100">
                <span className="text-xs text-slate-500">Shop Operating Expenses</span>
                <span className="text-sm font-semibold text-slate-900 font-mono">
                  -{monthly_performance.operating_expenses.toLocaleString()} ETB
                </span>
              </div>

              {canViewCost && (
                <div className="flex items-baseline justify-between py-1 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Net Shop Operating Profit</span>
                  <span className="text-sm font-semibold text-emerald-700 font-mono">
                    +{monthly_performance.net_profit.toLocaleString()} ETB
                  </span>
                </div>
              )}

              <div className="flex items-baseline justify-between py-1">
                <span className="text-xs text-purple-600 font-medium">Owner Personal Draws</span>
                <span className="text-sm font-semibold text-purple-700 font-mono">
                  {monthly_performance.owner_draws.toLocaleString()} ETB
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            Real data strictly mapped from December 2025 cashflow records.
          </div>
        </div>
      </div>

      {/* 3. Debt Ledgers: Two Clean Open Columns (No Nested Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Customer Receivables */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Uncollected Customer Credit (Receivables)
              </h2>
              <span className="text-[11px] text-slate-400">
                {counts.open_receivables} customers currently owe the business
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Ledger &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {top_receivables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No open customer debts.</div>
            ) : (
              top_receivables.map((debt) => (
                <div key={debt.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{debt.contact?.name}</div>
                    <div className="text-[11px] text-slate-400">{debt.notes || 'Credit device purchase'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-700 font-mono">
                      +{Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    <span className="text-[10px] text-slate-400">Due collection</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supplier Payables */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Outstanding Peer & Supplier Payables
              </h2>
              <span className="text-[11px] text-slate-400">
                {counts.open_payables} peer shops to settle (Mekdi, Yenus)
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Ledger &rarr;
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {top_payables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No open supplier payables.</div>
            ) : (
              top_payables.map((debt) => (
                <div key={debt.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{debt.contact?.name}</div>
                    <div className="text-[11px] text-slate-400">{debt.notes || 'Brokered neighbour device'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-rose-700 font-mono">
                      -{Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    <span className="text-[10px] text-slate-400">Due settlement</span>
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
