import React, { useState, useEffect, useMemo } from 'react';
import type { DashboardData, User, FinancialAccount, Debt, LeaderboardItem, SalesTrend, DashboardSalesChartPoint } from '../api/client';
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
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useBalancePrivacy } from '../context/BalancePrivacyContext';

interface OverviewViewProps {
  data: DashboardData | null;
  user: User | null;
  accounts?: FinancialAccount[];
  selectedMonth?: string;
  onNavigateTab: (tab: any, replace?: boolean, context?: any) => void;
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

  const [salesRange, setSalesRange] = useState<'1M' | '3M' | '6M' | '1Y'>('1M');
  const [rangePerformance, setRangePerformance] = useState<{
    revenue: number;
    gross_profit: number;
    net_profit: number;
    operating_expenses: number;
    owner_draws: number;
    sales_trend?: SalesTrend;
    sales_chart?: DashboardSalesChartPoint[];
  } | null>(null);
  const [isLoadingRange, setIsLoadingRange] = useState(false);
  const [hoveredPointVal, setHoveredPointVal] = useState<number | null>(null);

  const handleRangeChange = (range: '1M' | '3M' | '6M' | '1Y') => {
    setSalesRange(range);
    setHoveredPointVal(null);
    if (range === '1M') {
      setRangePerformance(null);
      return;
    }
    setIsLoadingRange(true);
    api.getDashboardSummary(selectedMonth, range.toLowerCase())
      .then((res) => {
        setRangePerformance({
          revenue: res.monthly_performance.revenue,
          gross_profit: res.monthly_performance.gross_profit,
          net_profit: res.monthly_performance.net_profit,
          operating_expenses: res.monthly_performance.operating_expenses,
          owner_draws: res.monthly_performance.owner_draws,
          sales_trend: res.sales_trend,
          sales_chart: res.sales_chart,
        });
      })
      .catch((err) => {
        console.error('Failed to load range performance:', err);
      })
      .finally(() => {
        setIsLoadingRange(false);
      });
  };

  useEffect(() => {
    if (salesRange !== '1M') {
      handleRangeChange(salesRange);
    } else {
      setRangePerformance(null);
    }
  }, [selectedMonth]);

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
      isStaffBonus?: boolean;
    }>();

    (top_payables || []).forEach((debt) => {
      const isBonus = debt.reference_type === 'salesperson_bonus';
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
          isStaffBonus: isBonus,
        });
      }
      const g = map.get(cid)!;
      g.debts.push(debt);
      const rem = parseFloat(String(debt.remaining_amount)) || 0;
      g.totalRemaining += rem;
      if (rem > 0.001) {
        g.openCount += 1;
      }
      if (isBonus) {
        g.isStaffBonus = true;
      }
    });

    map.forEach((g) => {
      if (g.isStaffBonus) {
        // Staff commission bonuses are NEVER offset against handovers or trade credit!
        g.offsetAmount = 0;
        g.netRemaining = g.totalRemaining;
      } else {
        const firstDebt = g.debts[0];
        if (firstDebt?.contact && firstDebt.contact.net_balance !== undefined) {
          const netBal = Number(firstDebt.contact.net_balance);
          g.netRemaining = Math.max(0, -netBal);
          g.offsetAmount = Math.max(0, g.totalRemaining - g.netRemaining);
        } else {
          g.netRemaining = g.totalRemaining;
          g.offsetAmount = 0;
        }
      }
    });

    return Array.from(map.values())
      .filter((g) => g.netRemaining > 0.001)
      .sort((a, b) => b.netRemaining - a.netRemaining);
  }, [top_payables]);

  /* ─── Active sales metrics & trends (range-aware) ─── */
  const activeRevenue = rangePerformance ? rangePerformance.revenue : monthly_performance.revenue;
  const activeGrossProfit = rangePerformance ? rangePerformance.gross_profit : monthly_performance.gross_profit;
  const activeNetProfit = rangePerformance ? rangePerformance.net_profit : monthly_performance.net_profit;
  const activeExpenses = rangePerformance ? rangePerformance.operating_expenses : (monthly_performance.operating_expenses || 0);
  const activeOwnerDraws = rangePerformance ? rangePerformance.owner_draws : (monthly_performance.owner_draws || 0);
  const activeSalesChart = rangePerformance?.sales_chart ?? data.sales_chart ?? [];
  const activeSalesTrend = rangePerformance?.sales_trend ?? data.sales_trend ?? monthly_performance.sales_trend ?? {
    percentage: 12.0,
    raw_percentage: 12.0,
    is_up: true,
    prior_revenue: 0,
    comparison_label: salesRange === '1M' ? 'vs last month' : `vs prior ${salesRange}`,
  };
  const displaySalesVal = hoveredPointVal !== null ? hoveredPointVal : activeRevenue;

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
      onClick: () => openVital('inventory'),
    },
    {
      key: 'receivables',
      label: 'Receivables',
      value: capital_overview.receivables,
      prefix: '+',
      accent: 'text-emerald-600 dark:text-emerald-400',
      onClick: () => openVital('receivables'),
    },
    {
      key: 'cash',
      label: 'Bank Accounts',
      value: capital_overview.cash_and_banks,
      prefix: '',
      onClick: () => openVital('cash'),
    },
    {
      key: 'reserves',
      label: 'Other Assets',
      value: capital_overview.custom_assets,
      prefix: '',
      onClick: () => openVital('reserves'),
    },
    {
      key: 'payables',
      label: 'Payables',
      value: capital_overview.payables,
      prefix: '−',
      accent: 'text-rose-600/80 dark:text-rose-400/80',
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
      <div className="hidden sm:block space-y-4 2xl:space-y-6">
        {/* 1. Capital Strip — single clean white card with compact sizing for 13" laptops, scaling up dynamically for 15"/17" */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl shadow-xs overflow-hidden grid grid-cols-5 divide-x divide-slate-100 dark:divide-slate-800/60 animate-stagger-2">
          {capitalMetrics.map((m) => (
            <button
              key={m.key}
              onClick={m.onClick}
              className="bg-white dark:bg-[#131926] px-3 py-2.5 2xl:px-5 2xl:py-4 text-left hover:bg-slate-50/80 dark:hover:bg-[#171e2e] transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-inset cursor-pointer"
            >
              <div className="text-[10px] 2xl:text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5 truncate">
                {m.label}
              </div>
              <div className={`text-sm sm:text-[15px] 2xl:text-lg font-bold font-mono tracking-tight truncate ${m.accent || 'text-slate-900 dark:text-slate-100'}`}>
                {m.prefix}<AnimatedNumber value={m.value} />
                <span className="text-[10px] 2xl:text-xs font-medium text-slate-400 dark:text-slate-500 ml-1 font-sans">ETB</span>
              </div>
            </button>
          ))}
        </div>

        {/* 2. Charts — Sales Performance (with embedded metrics) + Asset Allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 2xl:gap-6 animate-stagger-3">
          {/* Sales Performance Card (Clean, locked with comfortable breathing room) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-2xl p-4 sm:p-5 2xl:p-6 shadow-xs flex flex-col justify-between h-[296px] 2xl:h-[350px] overflow-hidden">
            <div>
              {/* Header: Title on Left, Range selector pills on Right matching mockup */}
              <div className="flex items-center justify-between gap-3 shrink-0">
                {/* Left: Title + Optional subtle Top Seller pill */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h2 className="text-sm 2xl:text-base font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                      Sales Performance
                    </h2>
                  </div>

                  {topSeller && user?.role === 'owner' && (
                    <button
                      onClick={() => onNavigateTab('staff')}
                      title="View Staff & Team Dashboard"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-[10.5px] 2xl:text-xs font-semibold hover:border-amber-400 transition-all cursor-pointer"
                    >
                      <span>Top: <span className="font-bold">{topSeller.name}</span></span>
                      <ChevronRight className="w-3 h-3 opacity-60" />
                    </button>
                  )}
                </div>

                {/* Right: Range pills matching exact mockup */}
                <div className="inline-flex p-1 bg-slate-100/90 dark:bg-slate-800/90 rounded-xl text-xs font-medium shrink-0">
                  {(['1M', '3M', '6M', '1Y'] as const).map((r) => {
                    const isActive = salesRange === r;
                    return (
                      <button
                        key={r}
                        onClick={() => handleRangeChange(r)}
                        className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-xs ${
                          isActive
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Headline Sales Number + Trend Indicator */}
              <div className="mt-1.5 2xl:mt-2">
                <div className="text-xl sm:text-2xl 2xl:text-3xl font-bold font-mono tracking-tight text-slate-900 dark:text-white flex items-baseline gap-1.5">
                  {isBalancesHidden ? (
                    '******'
                  ) : (
                    <>
                      <AnimatedNumber value={displaySalesVal} />
                      <span className="text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-500 font-sans">
                        ETB
                      </span>
                    </>
                  )}
                </div>

                {/* Minimalist Percentage Trend (coloring the icon + and the percent only in a non bold correct color) */}
                <div className="flex items-center gap-1 text-xs 2xl:text-[13px] font-normal mt-0.5">
                  {activeSalesTrend.is_up ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-normal">
                      <ArrowUp className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>+{activeSalesTrend.percentage}%</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-normal">
                      <ArrowDown className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>-{activeSalesTrend.percentage}%</span>
                    </span>
                  )}
                  <span className="text-slate-400 dark:text-slate-500 font-normal ml-0.5">
                    {activeSalesTrend.comparison_label || (salesRange === '1M' ? 'vs last month' : `vs prior ${salesRange}`)}
                  </span>
                  {isLoadingRange && (
                    <span className="text-[10px] text-slate-400 animate-pulse ml-1 font-sans">updating...</span>
                  )}
                </div>
              </div>

              {/* Chart Canvas */}
              <div className="mt-1.5">
                <InteractiveSalesWaveChart
                  data={activeSalesChart}
                  totalRevenue={activeRevenue}
                  totalProfit={activeGrossProfit}
                  canViewCost={canViewCost}
                  hideHeader={true}
                  hideGridLines={true}
                  heightClass="h-[90px] sm:h-[95px] 2xl:h-[125px]"
                  onHoverPoint={(pt) => {
                    setHoveredPointVal(pt ? pt.val : null);
                  }}
                />
              </div>
            </div>

            {/* Embedded 4-Column Footer Bar (Divided by crisp vertical borders with ample breathing room) */}
            <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2.5 2xl:pt-3 pb-0.5 mt-auto shrink-0">
              <div className={`grid ${canViewCost ? 'grid-cols-4' : 'grid-cols-2'}`}>
                {canViewCost && (
                  <>
                    {/* 1. Gross Profit */}
                    <div className="pr-3.5 2xl:pr-5 border-r border-slate-100 dark:border-slate-800/80">
                      <div className="text-[10.5px] 2xl:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                        Gross Profit
                      </div>
                      <div className="text-sm sm:text-base 2xl:text-lg font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 2xl:mt-1.5 truncate">
                        {isBalancesHidden ? '******' : (
                          <>
                            {activeGrossProfit < 0 ? '−' : ''}<AnimatedNumber value={Math.abs(activeGrossProfit)} />
                            <span className="text-[10px] 2xl:text-xs font-sans font-medium text-emerald-600/70 ml-1">ETB</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 2. Net Profit */}
                    <div className="px-3.5 2xl:px-5 border-r border-slate-100 dark:border-slate-800/80">
                      <div className="text-[10.5px] 2xl:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                        Net Profit
                      </div>
                      <div className="text-sm sm:text-base 2xl:text-lg font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-1 2xl:mt-1.5 truncate">
                        {isBalancesHidden ? '******' : (
                          <>
                            {activeNetProfit < 0 ? '−' : ''}<AnimatedNumber value={Math.abs(activeNetProfit)} />
                            <span className="text-[10px] 2xl:text-xs font-sans font-medium text-emerald-600/70 ml-1">ETB</span>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* 3. Expenses */}
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(true)}
                  title="Click to record an expense or personal draw"
                  className={`px-3.5 2xl:px-5 text-left group cursor-pointer focus:outline-none transition-colors ${canViewCost ? 'border-r border-slate-100 dark:border-slate-800/80' : 'border-r-0'}`}
                >
                  <div className="text-[10.5px] 2xl:text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    Expenses
                  </div>
                  <div className="text-sm sm:text-base 2xl:text-lg font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-1 2xl:mt-1.5 truncate">
                    {isBalancesHidden ? '******' : (
                      <>
                        <AnimatedNumber value={activeExpenses} />
                        <span className="text-[10px] 2xl:text-xs font-sans font-medium text-slate-400 dark:text-slate-500 ml-1">ETB</span>
                      </>
                    )}
                  </div>
                </button>

                {/* 4. Owner Draws (Neutral color like revenue, NOT purple!) */}
                <div className="pl-3.5 2xl:pl-5">
                  <div className="text-[10.5px] 2xl:text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    Owner Draws
                  </div>
                  <div className="text-sm sm:text-base 2xl:text-lg font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-1 2xl:mt-1.5 truncate">
                    {isBalancesHidden ? '******' : (
                      <>
                        <AnimatedNumber value={Math.abs(activeOwnerDraws)} />
                        <span className="text-[10px] 2xl:text-xs font-sans font-medium text-slate-400 dark:text-slate-500 ml-1">ETB</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Allocation Donut Card (Locked with matching height) */}
          <div className="hidden lg:flex lg:col-span-5 bg-white dark:bg-[#131926] rounded-2xl p-4 sm:p-5 2xl:p-6 flex-col justify-between shadow-xs h-[296px] 2xl:h-[350px] overflow-hidden">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80 mb-2 shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Asset Allocation
              </span>
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                Portfolio Balance
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-0">
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
                showLegend={false}
              />
            </div>
          </div>
        </div>

        {/* 3. Debt Ledgers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 2xl:gap-6 animate-stagger-4">
          {/* Receivables */}
          <div className="bg-white dark:bg-[#131926] rounded-2xl p-5 2xl:p-6 shadow-xs flex flex-col h-[285px] 2xl:h-[340px]">
            <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Receivables</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDebtModalDefaultType('receivable');
                    setIsDebtModalOpen(true);
                  }}
                  title="Record new customer credit or receivable"
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer py-0.5 px-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  onClick={() => onNavigateTab('debts', false, { debtType: 'receivable' })}
                  className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer py-0.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40"
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
                    className="w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-xs uppercase shrink-0 border ${
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
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                              Handover
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {group.openCount} {group.openCount === 1 ? 'obligation' : 'obligations'}
                          {group.offsetAmount > 0.01 && ` · Offset −${isBalancesHidden ? '******' : group.offsetAmount.toLocaleString()} ETB`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pl-2">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight text-xs">
                        {isBalancesHidden ? '+******' : `+${group.netRemaining.toLocaleString()}`}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Payables */}
          <div className="bg-white dark:bg-[#131926] rounded-2xl p-5 2xl:p-6 shadow-xs flex flex-col h-[285px] 2xl:h-[340px]">
            <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">Payables</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDebtModalDefaultType('payable');
                    setIsDebtModalOpen(true);
                  }}
                  title="Record new vendor payable or debt"
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 transition-colors flex items-center gap-1 cursor-pointer py-0.5 px-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  onClick={() => onNavigateTab('debts', false, { debtType: 'payable' })}
                  className="text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-rose-600 transition-colors cursor-pointer py-0.5 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40"
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
                    className="w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all group text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold flex items-center justify-center text-xs uppercase shrink-0 border border-rose-200/60 dark:border-rose-800/50">
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 dark:text-white truncate block">
                            {group.name}
                          </span>
                          {group.isStaffBonus && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                              Staff Bonus
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {group.openCount} {group.openCount === 1 ? 'obligation' : 'obligations'}
                          {group.offsetAmount > 0.01 && ` · Offset −${isBalancesHidden ? '******' : group.offsetAmount.toLocaleString()} ETB`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pl-2">
                      <span className="font-bold text-rose-600 dark:text-rose-400 font-mono tracking-tight text-xs">
                        {isBalancesHidden ? '−******' : `−${group.netRemaining.toLocaleString()}`}
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
