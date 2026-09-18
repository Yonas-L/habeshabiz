import React from 'react';
import type { DashboardData, User } from '../api/client';

interface OverviewViewProps {
  data: DashboardData | null;
  user: User | null;
  onNavigateTab: (tab: any) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ data, user, onNavigateTab }) => {
  if (!data) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm animate-pulse">
        Loading business metrics...
      </div>
    );
  }

  const { capital_overview, monthly_performance, counts, top_receivables, top_payables } = data;
  const canViewCost = user?.can_view_costs ?? false;

  return (
    <div className="space-y-6">
      {/* 1. Master Capital Matrix Banner (From the Client's Excel Formula) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Net Capital</div>
            <div className="text-3xl font-semibold text-slate-900 font-mono tracking-tight mt-1">
              {capital_overview.net_capital.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-sm font-normal text-slate-500">ETB</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('counter')}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
            >
              + Quick Counter Sale
            </button>
            <button
              onClick={() => onNavigateTab('debts')}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
            >
              Collect Debt
            </button>
          </div>
        </div>

        {/* Capital Breakdown Equation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-6 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-slate-500 font-medium">1. Physical Stock</div>
            <div className="text-base font-semibold text-slate-900 font-mono mt-0.5">
              {capital_overview.stock_value.toLocaleString()} ETB
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{counts.in_stock_phones} units in stock</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-slate-500 font-medium">2. Customer Debts (Receivable)</div>
            <div className="text-base font-semibold text-emerald-700 font-mono mt-0.5">
              +{capital_overview.receivables.toLocaleString()} ETB
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{counts.open_receivables} debtors owe you</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-slate-500 font-medium">3. Cash & Bank Accounts</div>
            <div className="text-base font-semibold text-slate-900 font-mono mt-0.5">
              +{capital_overview.cash_and_banks.toLocaleString()} ETB
            </div>
            <div className="text-[11px] text-slate-400 mt-1">CBE, BOA, Awash, TeleBirr</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-slate-500 font-medium">4. Assets (Gold & Forex)</div>
            <div className="text-base font-semibold text-slate-900 font-mono mt-0.5">
              +{capital_overview.custom_assets.toLocaleString()} ETB
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Gold 18/21k & USD/USDT</div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100/80">
            <div className="text-rose-700 font-medium">5. Supplier Payables</div>
            <div className="text-base font-semibold text-rose-700 font-mono mt-0.5">
              -{capital_overview.payables.toLocaleString()} ETB
            </div>
            <div className="text-[11px] text-rose-500 mt-1">{counts.open_payables} suppliers to pay</div>
          </div>
        </div>
      </div>

      {/* 2. Monthly Performance KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="text-slate-400 text-xs font-medium">Monthly Revenue</div>
          <div className="text-xl font-semibold text-slate-900 font-mono mt-1">
            {monthly_performance.revenue.toLocaleString()} <span className="text-xs text-slate-400">ETB</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">Gross sales this month</div>
        </div>

        {canViewCost && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="text-slate-400 text-xs font-medium">Gross Profit</div>
            <div className="text-xl font-semibold text-emerald-700 font-mono mt-1">
              {monthly_performance.gross_profit.toLocaleString()} <span className="text-xs text-emerald-600">ETB</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Before operational expenses</div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="text-slate-400 text-xs font-medium">Operating Expenses</div>
          <div className="text-xl font-semibold text-slate-900 font-mono mt-1">
            {monthly_performance.operating_expenses.toLocaleString()} <span className="text-xs text-slate-400">ETB</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">RIDE, food, maintenance</div>
        </div>

        {canViewCost && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="text-slate-400 text-xs font-medium">Net Operating Profit</div>
            <div className="text-xl font-semibold text-slate-900 font-mono mt-1">
              {monthly_performance.net_profit.toLocaleString()} <span className="text-xs text-slate-400">ETB</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-2">Clean business performance</div>
          </div>
        )}
      </div>

      {/* 3. Receivables & Payables Quick Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Receivables */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Who Owes the Business (Receivables)</h3>
              <p className="text-[11px] text-slate-500">Uncollected customer credit sales</p>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View all →
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {top_receivables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No open customer receivables.</div>
            ) : (
              top_receivables.map((debt) => (
                <div key={debt.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{debt.contact?.name}</div>
                    <div className="text-[11px] text-slate-400">{debt.notes || 'Credit sale'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-700 font-mono">
                      {Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Open</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Payables */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Who You Owe (Supplier & Peer Payables)</h3>
              <p className="text-[11px] text-slate-500">Brokered sourcing & supplier stock payables</p>
            </div>
            <button
              onClick={() => onNavigateTab('debts')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View all →
            </button>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {top_payables.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No open payables. All suppliers settled.</div>
            ) : (
              top_payables.map((debt) => (
                <div key={debt.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{debt.contact?.name}</div>
                    <div className="text-[11px] text-slate-400">{debt.notes || 'Sourced inventory'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-rose-700 font-mono">
                      {Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700">Due</span>
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
