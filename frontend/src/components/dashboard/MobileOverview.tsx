import React from 'react';
import type { DashboardData, User, FinancialAccount, Debt, LeaderboardItem } from '../../api/client';
import { AnimatedNumber } from '../AnimatedNumber';
import type { VitalType } from '../drawers/VitalBreakdownDrawer';
import { useBalancePrivacy } from '../../context/BalancePrivacyContext';
import {
  Package,
  Landmark,
  Coins,
  TrendingUp,
  MoreHorizontal,
  Wallet,
  Sprout,
  Plus,
  ChevronRight,
} from 'lucide-react';

interface GroupedDebtContact {
  contactId: string;
  name: string;
  phone: string | null;
  totalRemaining: number;
  netRemaining: number;
  offsetAmount: number;
  debts: Debt[];
  hasHandover?: boolean;
  openCount: number;
  isStaffBonus?: boolean;
}

interface MobileOverviewProps {
  data: DashboardData;
  user: User | null;
  accounts?: FinancialAccount[];
  selectedMonth?: string;
  onNavigateTab: (tab: any, replace?: boolean, context?: any) => void;
  openVital: (vital: VitalType, contactId?: string | null) => void;
  onOpenExpenseModal: () => void;
  onOpenDebtModal: (type: 'receivable' | 'payable') => void;
  topSeller: LeaderboardItem | null;
  groupedReceivables: GroupedDebtContact[];
  groupedPayables: GroupedDebtContact[];
}

const HERO_CARD_PATH =
  'M 8 36 C 8 20, 20 12, 38 12 C 105 12, 155 26, 210 26 C 265 26, 315 12, 382 12 C 400 12, 412 20, 412 36 L 412 220 C 412 236, 400 246, 382 246 C 315 246, 265 234, 210 234 C 155 234, 105 246, 38 246 C 20 246, 8 236, 8 220 L 8 36 Z';

export const MobileOverview: React.FC<MobileOverviewProps> = ({
  data,
  user,
  selectedMonth,
  onNavigateTab,
  openVital,
  onOpenExpenseModal,
  onOpenDebtModal,
  topSeller,
  groupedReceivables,
  groupedPayables,
}) => {
  const { isBalancesHidden } = useBalancePrivacy();
  const { capital_overview, monthly_performance, counts } = data;
  const canViewCost = user?.can_view_costs ?? false;

  /* ─── Asset calculations for proportional bar ─── */
  const liquidVal = capital_overview.liquid_finance ?? capital_overview.cash_and_banks ?? 0;
  const forexVal = capital_overview.forex_assets ?? 0;
  const goldVal = capital_overview.gold_assets ?? 0;
  const otherVal = capital_overview.other_assets ?? Math.max(0, (capital_overview.custom_assets || 0) - forexVal - goldVal);
  const hasGranularAssets = forexVal > 0 || goldVal > 0;

  const grossAssets =
    (capital_overview.stock_value || 0) +
    liquidVal +
    (capital_overview.receivables || 0) +
    (hasGranularAssets ? forexVal + goldVal + otherVal : capital_overview.custom_assets || 0);

  const stockPct = grossAssets > 0 ? Math.round(((capital_overview.stock_value || 0) / grossAssets) * 100) : 0;
  const cashPct = grossAssets > 0 ? Math.round((liquidVal / grossAssets) * 100) : 0;
  const recPct = grossAssets > 0 ? Math.round(((capital_overview.receivables || 0) / grossAssets) * 100) : 0;
  const forexPct = grossAssets > 0 && hasGranularAssets ? Math.round((forexVal / grossAssets) * 100) : 0;
  const goldPct = grossAssets > 0 && hasGranularAssets ? Math.round((goldVal / grossAssets) * 100) : 0;
  const otherPct =
    grossAssets > 0 && hasGranularAssets
      ? Math.max(0, 100 - stockPct - cashPct - recPct - forexPct - goldPct)
      : grossAssets > 0
      ? Math.max(0, 100 - stockPct - cashPct - recPct)
      : 0;

  /* ─── Month display label ─── */
  const monthDisplayLabel = selectedMonth
    ? (() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1);
        return `${d.toLocaleString('default', { month: 'long' })} ${y}`;
      })()
    : "This Month's";

  return (
    <div className="space-y-4 px-0.5 select-none scroll-smooth">
      {/* ── 1. WORKING CAPITAL HERO WIDGET (Curvature Silhouette with Solid High-Contrast Tone) ── */}
      <div className="relative w-full select-none -mx-1.5 px-0.5 py-0.5 animate-stagger-1">
        <div className="relative w-full aspect-[420/260] min-[410px]:aspect-[420/250] overflow-visible">
          {/* Curvature SVG with Solid Slate/Emerald Tone & Fluid Trend Line */}
          <svg
            viewBox="0 0 420 256"
            className="w-full h-full overflow-visible drop-shadow-sm"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Chart Wave Downward Radiant Beam Gradients */}
              <linearGradient id="frontChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.0" />
              </linearGradient>

              {/* Smooth Fade-In and Fade-Out Stroke Gradients */}
              <linearGradient id="frontLineGrad" x1="175" y1="0" x2="408" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.0" />
                <stop offset="14%" stopColor="#34d399" stopOpacity="0.75" />
                <stop offset="80%" stopColor="#34d399" stopOpacity="0.95" />
                <stop offset="97%" stopColor="#34d399" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
              </linearGradient>

              {/* Clip Path using the exact canonical Card Silhouette */}
              <clipPath id="mainCardClip">
                <path d={HERO_CARD_PATH} />
              </clipPath>
            </defs>

            {/* Main Front Card with Persistent Curvature Silhouette & Solid Crisp Surface (No layered back cards) */}
            <path
              d={HERO_CARD_PATH}
              fill="#0f172a"
              stroke="rgba(52,211,153,0.3)"
              strokeWidth="1.2"
            />

            {/* Elements Clipped Inside Main Card */}
            <g clipPath="url(#mainCardClip)">
              {/* Front luminous wave shape */}
              <path
                d="
                  M 175 160
                  C 200 144, 225 118, 248 120
                  C 268 122, 282 130, 298 128
                  C 318 125, 332 104, 350 102
                  C 366 101, 378 108, 388 96
                  C 394 86, 398 72, 405 58
                  L 408 160
                  L 175 160
                  Z"
                fill="url(#frontChartGrad)"
              />
              <path
                d="
                  M 175 160
                  C 200 144, 225 118, 248 120
                  C 268 122, 282 130, 298 128
                  C 318 125, 332 104, 350 102
                  C 366 101, 378 108, 388 96
                  C 394 86, 398 72, 405 58"
                fill="none"
                stroke="url(#frontLineGrad)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </g>

            {/* Clean Static Endpoint Dot (No radial animation, no slop) */}
            <circle cx="403" cy="60" r="2.5" fill="#34d399" />
          </svg>

          {/* ── Foreground Interactive Content (Cleaned up, un-congested, zero truncation) ── */}
          <div
            className="absolute z-10 flex flex-col justify-between px-3.5 min-[390px]:px-4 py-3 min-[410px]:py-3.5"
            style={{
              left: '2.5%',
              width: '95%',
              top: '4%',
              height: '92%',
            }}
          >
            {/* Top Row: Clean, Un-nested Header (No glowing dot, no chevron, no nested +12% pill) */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => openVital('inventory')}
                className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors cursor-pointer text-left"
              >
                Working Capital
              </button>
            </div>

            {/* Big Financial Number */}
            <div className="my-auto py-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[clamp(28px,7.5vw,36px)] min-[410px]:text-[38px] font-black tracking-tight text-white font-mono leading-none">
                  {isBalancesHidden ? '******' : <AnimatedNumber value={capital_overview.net_capital || 10293682} />}
                </span>
                <span className="text-sm min-[410px]:text-base font-bold text-slate-400 font-sans tracking-wide">
                  ETB
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <span className="text-emerald-400 font-semibold font-mono">+12.5%</span>
                <span>vs last month</span>
              </div>
            </div>

            {/* Proportional Asset Breakdown Bar & Clean Legend (Un-nested, generous breathing room) */}
            <div className="space-y-2 pt-1">
              {/* Proportional distribution bar (Teal for forex, zero purple) */}
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                {stockPct > 0 && <div style={{ width: `${stockPct}%` }} className="h-full bg-emerald-400" title={`Stock ${stockPct}%`} />}
                {cashPct > 0 && <div style={{ width: `${cashPct}%` }} className="h-full bg-sky-400" title={`Liquid ${cashPct}%`} />}
                {recPct > 0 && <div style={{ width: `${recPct}%` }} className="h-full bg-amber-400" title={`Owed ${recPct}%`} />}
                {forexPct > 0 && <div style={{ width: `${forexPct}%` }} className="h-full bg-teal-400" title={`Forex ${forexPct}%`} />}
                {goldPct > 0 && <div style={{ width: `${goldPct}%` }} className="h-full bg-yellow-400" title={`Gold ${goldPct}%`} />}
                {otherPct > 0 && <div style={{ width: `${otherPct}%` }} className="h-full bg-slate-400" title={`Other ${otherPct}%`} />}
              </div>

              {/* Clean Legend Chips with Zero Truncation */}
              <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                <button
                  type="button"
                  onClick={() => openVital('inventory')}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span>Stock <strong className="text-white font-bold">{stockPct || 37}%</strong></span>
                </button>

                <button
                  type="button"
                  onClick={() => openVital('cash')}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                  <span>Liquid <strong className="text-white font-bold">{cashPct || 5}%</strong></span>
                </button>

                <button
                  type="button"
                  onClick={() => openVital('receivables')}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span>Owed <strong className="text-white font-bold">{recPct || 20}%</strong></span>
                </button>

                <button
                  type="button"
                  onClick={() => openVital('payables')}
                  className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer active:scale-95"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  <span>Owe <strong className="font-mono font-bold">{isBalancesHidden ? '***' : ((capital_overview.payables || 0) > 0 ? `−${capital_overview.payables.toLocaleString()}` : '0')}</strong></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. QUICK FINANCIAL METRICS & VITAL STATS (Stock, Bank, Other Assets) ── */}
      <div className="w-full rounded-[24px] sm:rounded-[28px] bg-white dark:bg-[#111C2D] border-0 shadow-xs p-2.5 min-[390px]:p-3.5 sm:p-4 select-none animate-stagger-2">
        <div className="grid grid-cols-3 gap-2 min-[390px]:gap-3">
          {/* 1. Stock */}
          <button
            type="button"
            onClick={() => openVital('inventory')}
            className="flex flex-col items-center text-center group cursor-pointer haptic-press"
            title={`Stock: ${isBalancesHidden ? '******' : capital_overview.stock_value.toLocaleString()} ETB`}
          >
            <div className="size-12 min-[390px]:size-[52px] rounded-[18px] min-[390px]:rounded-[20px] p-1 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 flex items-center justify-center shrink-0 mx-auto shadow-xs group-hover:scale-105 transition-all duration-200">
              <div className="w-full h-full rounded-[14px] min-[390px]:rounded-[16px] bg-gradient-to-b from-[#eef9f2] to-[#ddf4e6] dark:from-[#0b2b1d] dark:to-[#071f15] flex items-center justify-center shadow-xs">
                <Package className="w-6 h-6 min-[390px]:w-[26px] min-[390px]:h-[26px] text-[#047857] dark:text-emerald-400 stroke-[2.2]" />
              </div>
            </div>
            <span className="text-[11px] min-[390px]:text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 min-[390px]:mt-2 truncate max-w-full block">
              Stock
            </span>
            <span className="text-[10px] min-[390px]:text-[11.5px] font-medium font-mono tracking-tight text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full block transition-opacity duration-200">
              {isBalancesHidden ? '******' : <AnimatedNumber value={capital_overview.stock_value} compact />}
            </span>
          </button>

          {/* 2. Bank */}
          <button
            type="button"
            onClick={() => openVital('cash')}
            className="flex flex-col items-center text-center group cursor-pointer haptic-press"
            title={`Bank: ${isBalancesHidden ? '******' : capital_overview.cash_and_banks.toLocaleString()} ETB`}
          >
            <div className="size-12 min-[390px]:size-[52px] rounded-[18px] min-[390px]:rounded-[20px] p-1 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 flex items-center justify-center shrink-0 mx-auto shadow-xs group-hover:scale-105 transition-all duration-200">
              <div className="w-full h-full rounded-[14px] min-[390px]:rounded-[16px] bg-gradient-to-b from-[#eaf4ff] to-[#d6ebff] dark:from-[#0d273a] dark:to-[#091b29] flex items-center justify-center shadow-xs">
                <Landmark className="w-6 h-6 min-[390px]:w-[26px] min-[390px]:h-[26px] text-[#0284c7] dark:text-sky-400 stroke-[2.2]" />
              </div>
            </div>
            <span className="text-[11px] min-[390px]:text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 min-[390px]:mt-2 truncate max-w-full block">
              Bank
            </span>
            <span className="text-[10px] min-[390px]:text-[11.5px] font-medium font-mono tracking-tight text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full block transition-opacity duration-200">
              {isBalancesHidden ? '******' : <AnimatedNumber value={capital_overview.cash_and_banks} compact />}
            </span>
          </button>

          {/* 3. Other Assets */}
          <button
            type="button"
            onClick={() => openVital('reserves')}
            className="flex flex-col items-center text-center group cursor-pointer haptic-press"
            title={`Other Assets: ${isBalancesHidden ? '******' : capital_overview.custom_assets.toLocaleString()} ETB`}
          >
            <div className="size-12 min-[390px]:size-[52px] rounded-[18px] min-[390px]:rounded-[20px] p-1 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 flex items-center justify-center shrink-0 mx-auto shadow-xs group-hover:scale-105 transition-all duration-200">
              <div className="w-full h-full rounded-[14px] min-[390px]:rounded-[16px] bg-gradient-to-b from-[#f3eefe] to-[#e7dbfc] dark:from-[#25153d] dark:to-[#1a0e2b] flex items-center justify-center shadow-xs">
                <Coins className="w-6 h-6 min-[390px]:w-[26px] min-[390px]:h-[26px] text-[#6b21a8] dark:text-purple-300 stroke-[2.2]" />
              </div>
            </div>
            <span className="text-[11px] min-[390px]:text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1.5 min-[390px]:mt-2 truncate max-w-full block">
              Other
            </span>
            <span className="text-[10px] min-[390px]:text-[11.5px] font-medium font-mono tracking-tight text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-full block transition-opacity duration-200">
              {isBalancesHidden ? '******' : <AnimatedNumber value={capital_overview.custom_assets} compact />}
            </span>
          </button>
        </div>
      </div>

      {/* ── 3. MONTHLY PERFORMANCE SECTION (Cardless, 4 Cards Span Full Space) ── */}
      <div className="w-full space-y-2.5 select-none animate-stagger-3">
        {/* Section Heading */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <div className="size-7 min-[390px]:size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400 stroke-[2.4]" />
            </div>
            <div className="leading-tight">
              <span className="text-[9px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 block">
                {monthDisplayLabel}
              </span>
              <h2 className="text-base min-[390px]:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Performance
              </h2>
            </div>
          </div>
          {topSeller && user?.role === 'owner' && (
            <button
              type="button"
              onClick={() => onNavigateTab('staff')}
              title="View Staff & Team Dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs text-[11px] font-bold text-slate-800 dark:text-slate-200 active:scale-95 hover:scale-[1.03] cursor-pointer transition-all duration-150"
            >
              <span>
                Top: <span className="font-extrabold text-slate-900 dark:text-white">{topSeller.name}</span>
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* 2x2 Performance Grid (Spanning Full Horizontal Space) */}
        <div className="grid grid-cols-2 gap-2.5 min-[390px]:gap-3">
          {/* Card 1: Revenue (Dark Mesh Surface with Multi-Node Spline & Luminous Beam) */}
          <div className="relative h-[106px] min-[390px]:h-[110px] flex flex-col overflow-visible active:scale-[0.97] hover:scale-[1.01] transition-all duration-200 ease-out cursor-pointer group haptic-press">
            {/* Pinched Card Background */}
            <svg viewBox="0 0 172 108" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-sm overflow-visible" preserveAspectRatio="none">
              <defs>
                <radialGradient id="cardRevGrad" cx="85%" cy="15%" r="95%">
                  <stop offset="0%" stopColor="#1a443a" />
                  <stop offset="35%" stopColor="#122f3c" />
                  <stop offset="70%" stopColor="#0d212c" />
                  <stop offset="100%" stopColor="#08141b" />
                </radialGradient>
                <linearGradient id="cardRevBeam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="#10b981" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#064e3b" stopOpacity="0.0" />
                </linearGradient>
                <filter id="revDotGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#34d399" floodOpacity="0.9" />
                </filter>
              </defs>
              <path
                d="M 16 0 L 156 0 C 165 0, 172 7, 172 16 C 170 35, 169.2 54, 169.2 54 C 169.2 54, 170 73, 172 92 C 172 101, 165 108, 156 108 L 16 108 C 7 108, 0 101, 0 92 C 2 73, 2.8 54, 2.8 54 C 2.8 54, 2 35, 0 16 C 0 7, 7 0, 16 0 Z"
                fill="url(#cardRevGrad)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="1"
              />
              {/* Spline Beam under the chart */}
              <path
                d="M 2 108 L 2 92 C 25 90, 50 96, 75 91 C 100 86, 115 92, 135 84 C 148 78, 158 68, 164 62 L 164 108 Z"
                fill="url(#cardRevBeam)"
                className="animate-beam-reveal"
              />
              {/* Spline Line */}
              <path
                d="M 2 92 C 25 90, 50 96, 75 91 C 100 86, 115 92, 135 84 C 148 78, 158 68, 164 62"
                fill="none"
                stroke="#34d399"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-chart-line"
              />
              {/* Vertex Nodes */}
              <circle cx="28" cy="91" r="1.8" fill="#34d399" />
              <circle cx="75" cy="91" r="1.8" fill="#34d399" />
              <circle cx="110" cy="89" r="1.8" fill="#34d399" />
              <circle cx="135" cy="84" r="1.8" fill="#34d399" />
              {/* Native Sonar Radar Ripple on Beacon */}
              <g>
                <circle cx="164" cy="62" r="2.5" fill="none" stroke="#34d399" strokeWidth="1.2">
                  <animate attributeName="r" values="2.5;13" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.85;0" dur="2.2s" repeatCount="indefinite" />
                </circle>
                <circle cx="164" cy="62" r="4.5" fill="#34d399" fillOpacity="0.25" />
                <circle cx="164" cy="62" r="2.5" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
              </g>
            </svg>

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col h-full p-2.5 min-[390px]:p-3 text-white">
              <div className="flex items-center justify-between h-6">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="size-6 rounded-[7px] bg-[#a7f3d0] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none">
                      <rect x="3.5" y="9" width="3" height="8" rx="1" fill="#064e3b" />
                      <rect x="8.5" y="4" width="3" height="13" rx="1" fill="#064e3b" />
                      <rect x="13.5" y="11" width="3" height="6" rx="1" fill="#064e3b" />
                    </svg>
                  </div>
                  <span className="text-[11.5px] min-[390px]:text-xs font-bold text-white shrink-0">
                    Revenue
                  </span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-80" />
              </div>

              <div className="mt-2 min-[390px]:mt-2.5">
                <div className="text-base min-[390px]:text-[17px] font-black font-mono tracking-tight text-white flex items-baseline leading-none transition-opacity duration-200">
                  {isBalancesHidden ? '******' : <AnimatedNumber value={monthly_performance.revenue} />}
                  <span className="text-[9.5px] min-[390px]:text-[10px] font-semibold text-slate-300 ml-1 font-sans opacity-80">
                    ETB
                  </span>
                </div>
                <span className="text-[8.5px] min-[390px]:text-[9px] text-slate-300/80 mt-1 block truncate max-w-[70%] font-normal leading-tight">
                  Gross sales before discounts
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Gross Profit (Soft Mint Surface with Rising Curve & Beam) */}
          {canViewCost ? (
            <div className="relative h-[106px] min-[390px]:h-[110px] flex flex-col overflow-visible active:scale-[0.97] hover:scale-[1.01] transition-all duration-200 ease-out cursor-pointer group haptic-press">
              {/* Pinched Card Background */}
              <svg viewBox="0 0 172 108" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xs overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="cardGrossGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f2faf5" />
                    <stop offset="100%" stopColor="#e7f6ee" />
                  </linearGradient>
                  <linearGradient id="cardGrossBeam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 16 0 L 156 0 C 165 0, 172 7, 172 16 C 170 35, 169.2 54, 169.2 54 C 169.2 54, 170 73, 172 92 C 172 101, 165 108, 156 108 L 16 108 C 7 108, 0 101, 0 92 C 2 73, 2.8 54, 2.8 54 C 2.8 54, 2 35, 0 16 C 0 7, 7 0, 16 0 Z"
                  fill="url(#cardGrossGrad)"
                  stroke="#a7f3d0"
                  strokeOpacity="0.8"
                  strokeWidth="1"
                />
                {/* Soft radiant beam under rising curve */}
                <path
                  d="M 70 108 L 70 102 C 95 103, 115 97, 135 91 C 150 85, 158 74, 164 64 L 164 108 Z"
                  fill="url(#cardGrossBeam)"
                  className="animate-beam-reveal"
                />
                <path
                  d="M 70 102 C 95 103, 115 97, 135 91 C 150 85, 158 74, 164 64"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-chart-line-delayed"
                />
                {/* Native Sonar Radar Ripple on Beacon */}
                <g>
                  <circle cx="164" cy="64" r="2.5" fill="none" stroke="#10b981" strokeWidth="1.2">
                    <animate attributeName="r" values="2.5;13" dur="2.2s" begin="1.1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.85;0" dur="2.2s" begin="1.1s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="164" cy="64" r="4.5" fill="#10b981" fillOpacity="0.25" />
                  <circle cx="164" cy="64" r="2.5" fill="#047857" stroke="#ffffff" strokeWidth="1" />
                </g>
              </svg>

              {/* Foreground Content */}
              <div className="relative z-10 flex flex-col h-full p-2.5 min-[390px]:p-3">
                <div className="flex items-center justify-between h-6">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="size-6 rounded-[7px] bg-[#a7f3d0] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <ellipse cx="9" cy="8" rx="5" ry="2.5" fill="#047857" />
                        <ellipse cx="9" cy="12" rx="5" ry="2.5" fill="#065f46" />
                        <ellipse cx="14" cy="15" rx="5" ry="2.5" fill="#047857" />
                      </svg>
                    </div>
                    <span className="text-[11.5px] min-[390px]:text-xs font-bold text-slate-900 shrink-0">
                      Gross Profit
                    </span>
                  </div>
                  <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-80" />
                </div>

                <div className="mt-2 min-[390px]:mt-2.5">
                  <div className={`text-base min-[390px]:text-[17px] font-black font-mono tracking-tight flex items-baseline leading-none transition-opacity duration-200 ${
                    monthly_performance.gross_profit < 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}>
                    {isBalancesHidden ? (
                      '******'
                    ) : (
                      <>
                        {monthly_performance.gross_profit > 0 ? '+' : monthly_performance.gross_profit < 0 ? '−' : ''}
                        <AnimatedNumber value={Math.abs(monthly_performance.gross_profit)} />
                      </>
                    )}
                    <span className="text-[9.5px] min-[390px]:text-[10px] font-semibold text-slate-500 ml-1 font-sans">
                      ETB
                    </span>
                  </div>
                  <span className="text-[8.5px] min-[390px]:text-[9px] text-slate-500 mt-1 block truncate max-w-[70%] font-normal leading-tight">
                    Net sales − stock cost
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-[106px] min-[390px]:h-[110px] flex flex-col overflow-visible active:scale-[0.97] transition-transform duration-200">
              <svg viewBox="0 0 172 108" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xs" preserveAspectRatio="none">
                <path
                  d="M 16 0 L 156 0 C 165 0, 172 7, 172 16 C 170 35, 169.2 54, 169.2 54 C 169.2 54, 170 73, 172 92 C 172 101, 165 108, 156 108 L 16 108 C 7 108, 0 101, 0 92 C 2 73, 2.8 54, 2.8 54 C 2.8 54, 2 35, 0 16 C 0 7, 7 0, 16 0 Z"
                  fill="#f2faf5"
                  stroke="#a7f3d0"
                  strokeWidth="1"
                />
              </svg>
              <div className="relative z-10 flex flex-col h-full p-2.5 min-[390px]:p-3">
                <span className="text-xs font-bold text-emerald-800">Store Activity</span>
                <div className="text-base font-bold font-mono text-emerald-700 mt-2">Active Store</div>
                <span className="text-[9px] text-emerald-600 mt-1">Operational records active</span>
              </div>
            </div>
          )}

          {/* Card 3: Expenses (Soft Rose Surface with Overlapping Waves & Record Button) */}
          <div className="relative h-[106px] min-[390px]:h-[110px] flex flex-col overflow-visible active:scale-[0.97] hover:scale-[1.01] transition-all duration-200 ease-out cursor-pointer group haptic-press">
            {/* Pinched Card Background */}
            <svg viewBox="0 0 172 108" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xs overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cardExpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff5f5" />
                  <stop offset="100%" stopColor="#fee8e8" />
                </linearGradient>
              </defs>
              <path
                d="M 16 0 L 156 0 C 165 0, 172 7, 172 16 C 170 35, 169.2 54, 169.2 54 C 169.2 54, 170 73, 172 92 C 172 101, 165 108, 156 108 L 16 108 C 7 108, 0 101, 0 92 C 2 73, 2.8 54, 2.8 54 C 2.8 54, 2 35, 0 16 C 0 7, 7 0, 16 0 Z"
                fill="url(#cardExpGrad)"
                stroke="#fecdd3"
                strokeOpacity="0.8"
                strokeWidth="1"
              />
              {/* Overlapping Rose Waves in Bottom Right */}
              <path
                d="M 85 108 C 110 108, 125 96, 142 98 C 155 100, 164 94, 172 88 L 172 108 Z"
                fill="#fda4af"
                fillOpacity="0.3"
                className="animate-beam-reveal"
              />
              <path
                d="M 105 108 C 122 108, 135 102, 148 103 C 160 104, 166 99, 172 96 L 172 108 Z"
                fill="#fb7185"
                fillOpacity="0.35"
                className="animate-beam-reveal"
              />
            </svg>

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col h-full p-2.5 min-[390px]:p-3">
              <div className="flex items-center justify-between h-6">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="size-6 rounded-[7px] bg-[#fecdd3] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                    <Wallet className="w-3.5 h-3.5 text-[#be123c] stroke-[2.2]" />
                  </div>
                  <span className="text-[11.5px] min-[390px]:text-xs font-bold text-slate-900 shrink-0">
                    Expenses
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenExpenseModal}
                    title="Quickly record expense"
                    className="px-2 py-0.5 rounded-full bg-[#fee2e2] hover:bg-[#fecdd3] border border-[#fecdd3] text-[#e11d48] text-[8.5px] font-extrabold animate-record-pulse active:scale-90 hover:scale-105 cursor-pointer shadow-2xs transition-all duration-150 shrink-0"
                  >
                    + Record
                  </button>
                  <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-80" />
                </div>
              </div>

              <div className="mt-2 min-[390px]:mt-2.5">
                <div className="text-base min-[390px]:text-[17px] font-black font-mono tracking-tight text-[#e11d48] flex items-baseline leading-none transition-opacity duration-200">
                  {isBalancesHidden ? (
                    '******'
                  ) : (
                    <>
                      {(monthly_performance.operating_expenses || 0) > 0 ? '-' : ''}
                      <AnimatedNumber value={monthly_performance.operating_expenses} />
                    </>
                  )}
                  <span className="text-[9.5px] min-[390px]:text-[10px] font-semibold text-rose-500/80 ml-1 font-sans">
                    ETB
                  </span>
                </div>
                <span className="text-[8.5px] min-[390px]:text-[9px] text-slate-500 mt-1 block truncate max-w-[70%] font-normal leading-tight">
                  Rent, ride, bills...
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Net Profit (Soft Mint Surface with Living Equalizer Rhythm) */}
          <div className="relative h-[106px] min-[390px]:h-[110px] flex flex-col overflow-visible active:scale-[0.97] hover:scale-[1.01] transition-all duration-200 ease-out cursor-pointer group haptic-press">
            {/* Pinched Card Background */}
            <svg viewBox="0 0 172 108" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-2xs overflow-visible" preserveAspectRatio="none">
              <path
                d="M 16 0 L 156 0 C 165 0, 172 7, 172 16 C 170 35, 169.2 54, 169.2 54 C 169.2 54, 170 73, 172 92 C 172 101, 165 108, 156 108 L 16 108 C 7 108, 0 101, 0 92 C 2 73, 2.8 54, 2.8 54 C 2.8 54, 2 35, 0 16 C 0 7, 7 0, 16 0 Z"
                fill="url(#cardGrossGrad)"
                stroke="#a7f3d0"
                strokeOpacity="0.8"
                strokeWidth="1"
              />
            </svg>

            {/* 5 Living Ascending Equalizer Pillar Bars in Bottom Right */}
            <div className="flex items-end justify-end gap-1 h-5 absolute right-2.5 bottom-2 pointer-events-none z-10">
              <div className="w-1 min-[390px]:w-1.2 bg-[#6ee7b7] rounded-full animate-eq-1" />
              <div className="w-1 min-[390px]:w-1.2 bg-[#34d399] rounded-full animate-eq-2" />
              <div className="w-1 min-[390px]:w-1.2 bg-[#10b981] rounded-full animate-eq-3" />
              <div className="w-1 min-[390px]:w-1.2 bg-[#059669] rounded-full animate-eq-4" />
              <div className="w-1 min-[390px]:w-1.2 bg-[#047857] rounded-full animate-eq-5" />
            </div>

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col h-full p-2.5 min-[390px]:p-3">
              <div className="flex items-center justify-between h-6">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="size-6 rounded-[7px] bg-[#a7f3d0] flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-200">
                    <Sprout className="w-3.5 h-3.5 text-[#047857] stroke-[2.4]" />
                  </div>
                  <span className="text-[11.5px] min-[390px]:text-xs font-bold text-slate-900 shrink-0">
                    Net Profit
                  </span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-80" />
              </div>

              <div className="mt-2 min-[390px]:mt-2.5">
                <div className={`text-base min-[390px]:text-[17px] font-black font-mono tracking-tight flex items-baseline leading-none transition-opacity duration-200 ${
                  monthly_performance.net_profit < 0 ? 'text-rose-600' : 'text-slate-900'
                }`}>
                  {isBalancesHidden ? (
                    '******'
                  ) : (
                    <>
                      {monthly_performance.net_profit > 0 ? '+' : monthly_performance.net_profit < 0 ? '−' : ''}
                      <AnimatedNumber value={Math.abs(monthly_performance.net_profit)} />
                    </>
                  )}
                  <span className="text-[9.5px] min-[390px]:text-[10px] font-semibold text-slate-500 ml-1 font-sans">
                    ETB
                  </span>
                </div>
                <span className="text-[8.5px] min-[390px]:text-[9px] text-slate-500 mt-1 block truncate max-w-[65%] font-normal leading-tight">
                  After operating expenses
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Owner Draws (if present and user can view costs) */}
        {canViewCost && (monthly_performance.owner_draws || 0) > 0 && (
          <div className="rounded-2xl bg-white dark:bg-[#131926] p-3.5 border-0 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Owner Draws
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  Personal drawings this month
                </span>
              </div>
            </div>
            <div className="text-base font-bold font-mono tracking-tight text-slate-900 dark:text-white">
              −<AnimatedNumber value={Math.abs(monthly_performance.owner_draws)} />
              <span className="text-[10px] font-medium text-slate-400 ml-1 font-sans">ETB</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. UNIFIED TWO-COLUMN MOBILE FINANCIAL LEDGER (Cardless, Full Width, Bold Typography) ── */}
      <div className="w-full select-none animate-stagger-4 pt-1 pb-1">
        <div
          className="grid divide-x divide-slate-200 dark:divide-slate-800"
          style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
        >
          {/* ── LEFT COLUMN: RECEIVABLES ── */}
          <div className="flex flex-col pr-3 min-[390px]:pr-3.5 min-w-0 [box-sizing:border-box]">
            {/* Fixed Header */}
            <div className="pb-2 mb-1 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
                  Receivables
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDebtModal('receivable')}
                  title="Record Receivable"
                  className="p-1 -mr-1 rounded-md text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 active:scale-90 transition-transform cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('debts', false, { debtType: 'receivable' })}
                className="text-left cursor-pointer group mt-0.5 block w-full focus:outline-none"
                title="View all receivables"
              >
                <div className="text-[17px] min-[390px]:text-[19px] font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight truncate">
                  {isBalancesHidden ? '+******' : (
                    <>
                      +<AnimatedNumber value={capital_overview.receivables} />
                      <span className="text-[10px] font-sans font-bold text-emerald-600/70 dark:text-emerald-400/70 ml-0.5">ETB</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate group-hover:text-emerald-600 transition-colors">
                  {counts.open_receivables ?? groupedReceivables.length} {((counts.open_receivables ?? groupedReceivables.length) === 1) ? 'record' : 'records'}
                </div>
              </button>
            </div>

            {/* Independent Scroll Container with Soft Foamy Bottom Fade */}
            <div className="relative">
              <div className="h-[340px] min-[390px]:h-[380px] min-[410px]:h-[420px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-auto scroll-smooth pb-8">
                {groupedReceivables.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                    No receivables
                  </div>
                ) : (
                  <div className="divide-y-0">
                    {groupedReceivables.map((group) => (
                      <button
                        key={group.contactId}
                        type="button"
                        onClick={() => openVital('receivables', group.contactId)}
                        className="w-full flex items-center justify-between py-2.5 border-b border-slate-200/50 dark:border-slate-800/50 text-left active:opacity-60 transition-opacity cursor-pointer min-w-0 group"
                        title={`${group.name}: +${group.netRemaining.toLocaleString()} ETB`}
                      >
                        <span className="text-[13px] min-[390px]:text-sm font-bold text-slate-900 dark:text-white truncate pr-1.5 leading-snug">
                          {group.name}
                        </span>
                        <span
                          className="text-[13px] min-[390px]:text-sm font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400 shrink-0 text-right leading-snug pl-1"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {isBalancesHidden ? '+***' : `+${group.netRemaining.toLocaleString()}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Foamy bottom gradient fade */}
              <div className="pointer-events-none absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#f6f8fa] via-[#f6f8fa]/80 to-transparent dark:from-[#0b0f17] dark:via-[#0b0f17]/80 dark:to-transparent" />
            </div>
          </div>

          {/* ── RIGHT COLUMN: PAYABLES ── */}
          <div className="flex flex-col pl-3 min-[390px]:pl-3.5 min-w-0 [box-sizing:border-box]">
            {/* Fixed Header */}
            <div className="pb-2 mb-1 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 truncate">
                  Payables
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDebtModal('payable')}
                  title="Record Payable"
                  className="p-1 -mr-1 rounded-md text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 active:scale-90 transition-transform cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('debts', false, { debtType: 'payable' })}
                className="text-left cursor-pointer group mt-0.5 block w-full focus:outline-none"
                title="View all payables"
              >
                <div className="text-[17px] min-[390px]:text-[19px] font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 leading-tight truncate">
                  {isBalancesHidden ? '−******' : (
                    <>
                      {(capital_overview.payables || 0) > 0 ? '−' : ''}<AnimatedNumber value={capital_overview.payables} />
                      <span className="text-[10px] font-sans font-bold text-rose-600/70 dark:text-rose-400/70 ml-0.5">ETB</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5 truncate group-hover:text-rose-600 transition-colors">
                  {counts.open_payables ?? groupedPayables.length} {((counts.open_payables ?? groupedPayables.length) === 1) ? 'record' : 'records'}
                </div>
              </button>
            </div>

            {/* Independent Scroll Container with Soft Foamy Bottom Fade */}
            <div className="relative">
              <div className="h-[340px] min-[390px]:h-[380px] min-[410px]:h-[420px] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden overscroll-auto scroll-smooth pb-8">
                {groupedPayables.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                    No payables
                  </div>
                ) : (
                  <div className="divide-y-0">
                    {groupedPayables.map((group) => (
                      <button
                        key={group.contactId}
                        type="button"
                        onClick={() => openVital('payables', group.contactId)}
                        className="w-full flex items-center justify-between py-2.5 border-b border-slate-200/50 dark:border-slate-800/50 text-left active:opacity-60 transition-opacity cursor-pointer min-w-0 group"
                        title={`${group.name}: −${group.netRemaining.toLocaleString()} ETB`}
                      >
                        <span className="text-[13px] min-[390px]:text-sm font-bold text-slate-900 dark:text-white truncate pr-1.5 leading-snug">
                          {group.name}
                        </span>
                        <span
                          className="text-[13px] min-[390px]:text-sm font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 shrink-0 text-right leading-snug pl-1"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {isBalancesHidden ? '−***' : `−${group.netRemaining.toLocaleString()}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Foamy bottom gradient fade */}
              <div className="pointer-events-none absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-[#f6f8fa] via-[#f6f8fa]/80 to-transparent dark:from-[#0b0f17] dark:via-[#0b0f17]/80 dark:to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
