import React, { useState, useEffect, useMemo } from 'react';
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
import { MobileOverview } from '../components/dashboard/MobileOverview';
import {
  ChevronRight,
  TrendingUp,
  Plus,
  ArrowLeftRight,
  Package,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
} from 'lucide-react';
import { useBalancePrivacy } from '../context/BalancePrivacyContext';

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
  const { isBalancesHidden } = useBalancePrivacy();
  const [selectedVital, setSelectedVital] = useState<VitalType | null>(null);
  const [focusedContactId, setFocusedContactId] = useState<string | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [topSeller, setTopSeller] = useState<LeaderboardItem | null>(null);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtModalDefaultType, setDebtModalDefaultType] = useState<'receivable' | 'payable'>('receivable');

  const openVital = (vital: VitalType, contactId: string | null = null) => {
    setFocusedContactId(contactId);
    setSelectedVital(vital);
  };

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

  const groupedReceivables = useMemo(() => {
    const map = new Map<string, {
      contactId: string;
      name: string;
      phone: string | null;
      totalRemaining: number;
      netRemaining: number;
      offsetAmount: number;
      debts: Debt[];
      hasHandover: boolean;
      openCount: number;
    }>();

    (top_receivables || []).forEach((debt) => {
      const cid = debt.contact?.id || debt.contact?.name || 'unassigned';
      if (!map.has(cid)) {
        map.set(cid, {
          contactId: cid,
          name: debt.contact?.name || 'Unassigned',
          phone: debt.contact?.phone || null,
          totalRemaining: 0,
          netRemaining: 0,
          offsetAmount: 0,
          debts: [],
          hasHandover: false,
          openCount: 0,
        });
      }
      const g = map.get(cid)!;
      g.debts.push(debt);
      if (debt.reference_type === 'handover_holding') {
        g.hasHandover = true;
      }
      const rem = parseFloat(String(debt.remaining_amount)) || 0;
      g.totalRemaining += rem;
      if (rem > 0.001) {
        g.openCount += 1;
      }
      if (debt.contact && debt.contact.net_balance !== undefined) {
        const netBal = Number(debt.contact.net_balance);
        g.netRemaining = Math.max(0, netBal);
        g.offsetAmount = Math.max(0, g.totalRemaining - g.netRemaining);
      } else {
        g.netRemaining = g.totalRemaining;
        g.offsetAmount = 0;
      }
    });

    return Array.from(map.values())
      .filter((g) => g.netRemaining > 0.001)
      .sort((a, b) => b.netRemaining - a.netRemaining);
  }, [top_receivables]);

  const groupedPayables = useMemo(() => {
    const map = new Map<string, {
      contactId: string;
      name: string;
      phone: string | null;
      totalRemaining: number;
      netRemaining: number;
      offsetAmount: number;
      debts: Debt[];
      openCount: number;
    }>();

    (top_payables || []).forEach((debt) => {
      const cid = debt.contact?.id || debt.contact?.name || 'unassigned';
      if (!map.has(cid)) {
        map.set(cid, {
          contactId: cid,
          name: debt.contact?.name || 'Unassigned',
          phone: debt.contact?.phone || null,
          totalRemaining: 0,
          netRemaining: 0,
          offsetAmount: 0,
          debts: [],
          openCount: 0,
        });
      }
      const g = map.get(cid)!;
      g.debts.push(debt);
      const rem = parseFloat(String(debt.remaining_amount)) || 0;
      g.totalRemaining += rem;
      if (rem > 0.001) {
        g.openCount += 1;
      }
      if (debt.contact && debt.contact.net_balance !== undefined) {
        const netBal = Number(debt.contact.net_balance);
        g.netRemaining = Math.max(0, -netBal);
        g.offsetAmount = Math.max(0, g.totalRemaining - g.netRemaining);
      } else {
        g.netRemaining = g.totalRemaining;
        g.offsetAmount = 0;
      }
    });

    return Array.from(map.values())
      .filter((g) => g.netRemaining > 0.001)
      .sort((a, b) => b.netRemaining - a.netRemaining);
  }, [top_payables]);

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
      onClick: () => openVital('inventory'),
    },
    {
      key: 'receivables',
      label: 'Owed to You',
      value: capital_overview.receivables,
      prefix: '+',
      accent: 'text-emerald-600 dark:text-emerald-400',
      icon: <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
      colorBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      onClick: () => openVital('receivables'),
    },
    {
      key: 'cash',
      label: 'Bank Accounts',
      value: capital_overview.cash_and_banks,
      prefix: '',
      icon: <Landmark className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
      colorBg: 'bg-teal-50 dark:bg-teal-950/60',
      onClick: () => openVital('cash'),
    },
    {
      key: 'reserves',
      label: 'Other Assets',
      value: capital_overview.custom_assets,
      prefix: '',
      icon: <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
      colorBg: 'bg-amber-50 dark:bg-amber-950/60',
      onClick: () => openVital('reserves'),
    },
    {
      key: 'payables',
      label: 'You Owe',
      value: capital_overview.payables,
      prefix: '−',
      accent: 'text-rose-600/80 dark:text-rose-400/80',
      icon: <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
      colorBg: 'bg-rose-50 dark:bg-rose-950/60',
      onClick: () => openVital('payables'),
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Mobile Native View (< sm) ── */}
      <div className="sm:hidden">
        <MobileOverview
          data={data}
          user={user}
          accounts={accounts}
          selectedMonth={selectedMonth}
          onNavigateTab={onNavigateTab}
          openVital={openVital}
          onOpenExpenseModal={() => setIsExpenseModalOpen(true)}
          onOpenDebtModal={(type) => {
            setDebtModalDefaultType(type);
            setIsDebtModalOpen(true);
          }}
          topSeller={topSeller}
          groupedReceivables={groupedReceivables}
          groupedPayables={groupedPayables}
        />
      </div>

      {/* ── Desktop View (>= sm) ── */}
      <div className="hidden sm:block space-y-4">
        {/* 1. Capital Strip — single compact row on desktop */}
        <div className="grid grid-cols-5 gap-px bg-slate-200/60 dark:bg-slate-800/50 rounded-xl overflow-hidden animate-stagger-2">
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

        {/* 2. Charts — Sales trajectory + Capital allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-stagger-3">
          <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-5">
            <InteractiveSalesWaveChart
              data={data.sales_chart || []}
              totalRevenue={monthly_performance.revenue}
              totalProfit={monthly_performance.gross_profit}
              canViewCost={canViewCost}
            />
          </div>

          <div className="hidden lg:flex lg:col-span-5 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-5 flex-col justify-between">
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
                liquidFinance={capital_overview.liquid_finance}
                forexAssets={capital_overview.forex_assets}
                goldAssets={capital_overview.gold_assets}
                otherAssets={capital_overview.other_assets}
                payables={capital_overview.payables}
                netCapital={capital_overview.net_capital}
              />
            </div>
          </div>
        </div>

        {/* 3. Monthly Performance */}
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-xs animate-stagger-4">
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

              <button
                onClick={() => setIsExpenseModalOpen(true)}
                title="Quickly record a shop expense or owner personal draw"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>Record Expense</span>
              </button>

              <button
                onClick={() => {
                  setDebtModalDefaultType('receivable');
                  setIsDebtModalOpen(true);
                }}
                title="Record customer credit, peer vendor payout, or loan entry"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#131926] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-[11px] font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Record Debt</span>
              </button>
            </div>
          </div>

          <div className={`grid ${canViewCost ? 'grid-cols-3 lg:grid-cols-5' : 'grid-cols-3'} gap-6 pt-3.5`}>
            {/* Revenue */}
            <div className="flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Revenue
              </span>
              <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-1.5">
                <AnimatedNumber value={monthly_performance.revenue} />
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                Gross sales before discounts
              </span>
            </div>

            {canViewCost && (
              <div className="flex flex-col justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  monthly_performance.gross_profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  Gross Profit
                </span>
                <div className={`text-2xl font-bold font-mono tracking-tight mt-1.5 ${
                  monthly_performance.gross_profit < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {monthly_performance.gross_profit > 0 ? '+' : monthly_performance.gross_profit < 0 ? '−' : ''}<AnimatedNumber value={Math.abs(monthly_performance.gross_profit)} />
                  <span className={`text-xs font-medium ml-1 font-sans ${monthly_performance.gross_profit < 0 ? 'text-rose-600/70 dark:text-rose-400/70' : 'text-emerald-600/70 dark:text-emerald-400/70'}`}>ETB</span>
                </div>
                <span className={`text-[10px] mt-1 block ${monthly_performance.gross_profit < 0 ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-emerald-600/80 dark:text-emerald-500/80'}`}>
                  Net sales − stock cost
                </span>
              </div>
            )}

            {/* Expenses */}
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              title="Click to record an expense or personal draw"
              className="text-left group cursor-pointer -m-2 p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                  Expenses
                </span>
              </div>
              <div className={`text-2xl font-bold font-mono tracking-tight mt-1.5 ${
                (monthly_performance.operating_expenses || 0) > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}>
                {(monthly_performance.operating_expenses || 0) > 0 ? '−' : ''}
                <AnimatedNumber value={monthly_performance.operating_expenses} />
                <span className={`text-xs font-medium ml-1 font-sans ${
                  (monthly_performance.operating_expenses || 0) > 0
                    ? 'text-rose-500/70 dark:text-rose-400/70'
                    : 'text-slate-400 dark:text-slate-500'
                }`}>ETB</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {(monthly_performance.transaction_fees || 0) > 0 && (monthly_performance.manual_expenses || 0) === 0 ? (
                  <span>Bank & Transfer Fees · <span className="underline decoration-dotted">Record +</span></span>
                ) : (monthly_performance.transaction_fees || 0) > 0 ? (
                  <span>Bills + Bank Fees · <span className="underline decoration-dotted">Record +</span></span>
                ) : (
                  <span>Rent, ride, bills · <span className="underline decoration-dotted">Record +</span></span>
                )}
              </span>
            </button>

            {canViewCost && (
              <div className="flex flex-col justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${monthly_performance.net_profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  Net Profit
                </span>
                <div className={`text-2xl font-bold font-mono tracking-tight mt-1.5 ${monthly_performance.net_profit < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {monthly_performance.net_profit > 0 ? '+' : monthly_performance.net_profit < 0 ? '−' : ''}<AnimatedNumber value={Math.abs(monthly_performance.net_profit)} />
                  <span className={`text-xs font-medium ml-1 font-sans ${monthly_performance.net_profit < 0 ? 'text-rose-600/70 dark:text-rose-400/70' : 'text-emerald-600/70 dark:text-emerald-400/70'}`}>ETB</span>
                </div>
                <span className={`text-[10px] mt-1 block ${monthly_performance.net_profit < 0 ? 'text-rose-600/80 dark:text-rose-400/80' : 'text-emerald-600/80 dark:text-emerald-500/80'}`}>
                  After operating expenses
                </span>
              </div>
            )}

            {/* Draws */}
            <div className={`flex flex-col justify-between ${canViewCost ? 'col-span-2 sm:col-span-1' : ''}`}>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Owner Draws
              </span>
              <div className="text-2xl font-bold font-mono tracking-tight text-purple-700 dark:text-purple-300 mt-1.5">
                {monthly_performance.owner_draws > 0 ? '−' : ''}<AnimatedNumber value={Math.abs(monthly_performance.owner_draws)} />
                <span className="text-xs font-medium text-purple-400 ml-1 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-purple-500/80 dark:text-purple-400/80 mt-1 block">
                Personal drawings
              </span>
            </div>
          </div>
        </div>

        {/* 4. Debt Ledgers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-stagger-5">
          {/* Receivables */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs flex flex-col h-[285px]">
            <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Owed to You</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDebtModalDefaultType('receivable');
                    setIsDebtModalOpen(true);
                  }}
                  title="Record new customer credit or receivable"
                  className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors flex items-center gap-0.5 cursor-pointer py-1 px-1.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Record</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  onClick={() => onNavigateTab('debts')}
                  className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer py-1 px-1.5"
                >
                  View all · {counts.open_receivables} →
                </button>
              </div>
            </div>

            {groupedReceivables.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-400 dark:text-slate-500 rounded-xl">
                No outstanding receivables
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {groupedReceivables.map((group) => (
                  <button
                    key={group.contactId}
                    onClick={() => openVital('receivables', group.contactId)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border ${
                        group.hasHandover
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/50'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/50'
                      }`}>
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {group.name}
                          </span>
                          {group.hasHandover && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                              Handover
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {group.openCount} {group.openCount === 1 ? 'obligation' : 'obligations'}
                          {group.offsetAmount > 0.01 && ` · Offset −${isBalancesHidden ? '••••••' : group.offsetAmount.toLocaleString()} ETB`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                        {isBalancesHidden ? '+••••••' : `+${group.netRemaining.toLocaleString()}`}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Payables */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs flex flex-col h-[285px]">
            <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
              <span className="text-sm font-bold text-slate-900 dark:text-white">You Owe</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDebtModalDefaultType('payable');
                    setIsDebtModalOpen(true);
                  }}
                  title="Record new vendor payable or debt"
                  className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 transition-colors flex items-center gap-0.5 cursor-pointer py-1 px-1.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>Record</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  onClick={() => onNavigateTab('debts')}
                  className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-rose-600 transition-colors cursor-pointer py-1 px-1.5"
                >
                  View all · {counts.open_payables} →
                </button>
              </div>
            </div>

            {groupedPayables.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-400 dark:text-slate-500 rounded-xl">
                No outstanding payables
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {groupedPayables.map((group) => (
                  <button
                    key={group.contactId}
                    onClick={() => openVital('payables', group.contactId)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border border-rose-200/60 dark:border-rose-800/50">
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-slate-900 dark:text-white truncate block">
                          {group.name}
                        </span>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {group.openCount} {group.openCount === 1 ? 'obligation' : 'obligations'}
                          {group.offsetAmount > 0.01 && ` · Offset −${isBalancesHidden ? '••••••' : group.offsetAmount.toLocaleString()} ETB`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono tracking-tight">
                        {isBalancesHidden ? '−••••••' : `−${group.netRemaining.toLocaleString()}`}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Drawers ── */}
      <VitalBreakdownDrawer
        vitalType={selectedVital}
        focusedContactId={focusedContactId}
        onClearFocusedContact={() => setFocusedContactId(null)}
        isOpen={selectedVital !== null}
        onClose={() => {
          setSelectedVital(null);
          setFocusedContactId(null);
        }}
        data={data}
        accounts={accounts}
        selectedMonth={selectedMonth}
        onNavigateTab={onNavigateTab}
        onSelectDebt={(debt) => {
          setSelectedVital(null);
          setFocusedContactId(null);
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
