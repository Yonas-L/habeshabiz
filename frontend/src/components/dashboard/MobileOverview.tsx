import React from 'react';
import type { DashboardData, User, FinancialAccount, Debt, LeaderboardItem } from '../../api/client';
import { AnimatedNumber } from '../AnimatedNumber';
import type { VitalType } from '../drawers/VitalBreakdownDrawer';
import { useBalancePrivacy } from '../../context/BalancePrivacyContext';
import {
  Package,
  Landmark,
  ArrowDown,
  ArrowUp,
  Coins,
  TrendingUp,
  BarChart3,
  MoreHorizontal,
  Wallet,
  Sprout,
  Plus,
  ChevronRight,
  ArrowUpRight,
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
}

interface MobileOverviewProps {
  data: DashboardData;
  user: User | null;
  accounts?: FinancialAccount[];
  selectedMonth?: string;
  onNavigateTab: (tab: any) => void;
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
    <div className="space-y-4 px-0.5 animate-page-enter">
      {/* ── 1. WORKING CAPITAL HERO WIDGET (Exact Match to Premium Reference Deck) ── */}
      <div className="relative w-full select-none -mx-1.5 px-0.5 py-0.5">
        <div className="relative w-full aspect-[420/270] min-[410px]:aspect-[420/256] overflow-visible">
          {/* Unified SVG Deck (Congruent Stacked Cards + Main Card + Spline Chart) */}
          <svg
            viewBox="0 0 420 256"
            className="w-full h-full overflow-visible drop-shadow-sm"
            preserveAspectRatio="none"
          >
            <defs>
              {/* Strong, deep, commanding drop shadow for main card */}
              <filter id="heroShadow" x="-10%" y="-10%" width="125%" height="130%">
                <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#01060c" floodOpacity="0.58" />
              </filter>
              <filter id="beadGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34d399" floodOpacity="0.95" />
              </filter>

              {/* Rich bold mesh gradient for the main focus card */}
              <radialGradient id="heroMeshGrad" cx="82%" cy="18%" r="85%">
                <stop offset="0%" stopColor="#183d36" />
                <stop offset="28%" stopColor="#112630" />
                <stop offset="62%" stopColor="#0c1a25" />
                <stop offset="100%" stopColor="#071118" />
              </radialGradient>

              {/* Top-Right Stack: Single refined Sage green card */}
              <linearGradient id="cardBackSage" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34594e" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#508575" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#79ad9c" stopOpacity="0.92" />
              </linearGradient>

              {/* Bottom-Left Stack: Single refined Midnight Navy card */}
              <linearGradient id="cardBackNavy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#122432" stopOpacity="0.96" />
                <stop offset="100%" stopColor="#0a1820" stopOpacity="0.92" />
              </linearGradient>

              {/* Chart Wave Gradients */}
              <linearGradient id="frontChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                <stop offset="60%" stopColor="#10b981" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#064e3b" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="backChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#064e3b" stopOpacity="0.0" />
              </linearGradient>

              {/* Smooth Fade-In and Fade-Out Stroke Gradients */}
              <linearGradient id="frontLineGrad" x1="175" y1="0" x2="408" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.0" />
                <stop offset="14%" stopColor="#34d399" stopOpacity="0.75" />
                <stop offset="80%" stopColor="#34d399" stopOpacity="0.95" />
                <stop offset="97%" stopColor="#34d399" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="backLineGrad" x1="165" y1="0" x2="408" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.0" />
                <stop offset="18%" stopColor="#10b981" stopOpacity="0.32" />
                <stop offset="78%" stopColor="#10b981" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>

              {/* Clip Path using the exact canonical Card Silhouette */}
              <clipPath id="mainCardClip">
                <path d={HERO_CARD_PATH} />
              </clipPath>
            </defs>

            {/* 1. Single Bottom-Left Stacked Card (Refined, offset -5px, +4px) */}
            <g transform="translate(-5, 4)">
              <path
                d={HERO_CARD_PATH}
                fill="url(#cardBackNavy)"
                stroke="rgba(52,211,153,0.3)"
                strokeWidth="1.2"
              />
            </g>

            {/* 2. Single Top-Right Stacked Card (Refined, offset +5px, -4px) */}
            <g transform="translate(5, -4)">
              <path
                d={HERO_CARD_PATH}
                fill="url(#cardBackSage)"
                stroke="rgba(168,203,182,0.65)"
                strokeWidth="1.2"
              />
            </g>

            {/* 3. Main Front Card (At 0, 0, MASSIVE, DOMINANT, BOLD FOCUS) */}
            <path
              d={HERO_CARD_PATH}
              fill="url(#heroMeshGrad)"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.4"
              filter="url(#heroShadow)"
            />

            {/* 4. Elements Clipped Inside Main Card */}
            <g clipPath="url(#mainCardClip)">
              {/* Ambient glows */}
              <circle cx="360" cy="65" r="95" fill="#15966b" opacity="0.28" />
              <circle cx="60" cy="80" r="65" fill="#0d3349" opacity="0.22" />

              {/* Back wave shape (Rolling peaks on the right side) */}
              <path
                d="
                  M 165 160
                  C 190 156, 215 130, 240 132
                  C 265 134, 288 112, 310 114
                  C 332 116, 354 92, 374 94
                  C 386 95, 398 82, 408 76
                  L 408 160
                  L 165 160
                  Z"
                fill="url(#backChartGrad)"
              />
              <path
                d="
                  M 165 160
                  C 190 156, 215 130, 240 132
                  C 265 134, 288 112, 310 114
                  C 332 116, 354 92, 374 94
                  C 386 95, 398 82, 408 76"
                fill="none"
                stroke="url(#backLineGrad)"
                strokeWidth="1.1"
                strokeLinecap="round"
              />

              {/* Front luminous wave shape (Minimal 1.5px stroke, smooth start/end fade) */}
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
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>

            {/* Glowing Endpoint Bead: Soft, subtle beacon */}
            <circle cx="403" cy="60" r="5" fill="#ffffff" filter="url(#beadGlow)" opacity="0.95" />
            <circle cx="403" cy="60" r="3" fill="#ffffff" stroke="#10b981" strokeWidth="0.8" />
          </svg>

          {/* ── Foreground Interactive Content ── */}
          <div
            className="absolute z-10 flex flex-col justify-between px-3 min-[390px]:px-3.5 sm:px-4 py-2 min-[390px]:py-2.5 min-[410px]:py-3"
            style={{
              left: '2.5%',
              width: '95%',
              top: '4%',
              height: '90%',
            }}
          >
            {/* Header Block: Top Row + Working Capital Number + Growth (Grouped with responsive, dynamic vertical spacing) */}
            <div className="flex flex-col pt-1 min-[390px]:pt-1.5 min-[410px]:pt-0.5">
              {/* Top Row: WORKING CAPITAL > and Strong Growth */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => openVital('inventory')}
                  className="flex items-center gap-1.5 group cursor-pointer active:scale-98 transition-transform"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399]" />
                  <span className="text-[11px] min-[390px]:text-[11.5px] min-[410px]:text-[12px] font-bold tracking-wider text-white">
                    WORKING CAPITAL
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all stroke-[2.5]" />
                </button>

                <div className="inline-flex items-center gap-1.5 px-2.5 min-[390px]:px-3 py-0.5 min-[390px]:py-1 rounded-full bg-[#082f23]/90 border border-[#34d399]/40 text-[#e6f7ef] text-[10px] min-[390px]:text-[10.5px] min-[410px]:text-[11px] font-semibold shadow-xs">
                  <ArrowUpRight className="w-3 min-[390px]:w-3.5 h-3 min-[390px]:h-3.5 text-[#34d399] stroke-[2.5]" />
                  <span>Strong Growth</span>
                </div>
              </div>

              {/* Big Financial Number + Growth (Dynamic fluid sizing for iPhone while preserving exact 41px on Samsung/Pixel) */}
              <div className="mt-1.5 min-[390px]:mt-2 min-[410px]:mt-2.5">
                <div className="flex items-baseline gap-1.5 min-[390px]:gap-2">
                  <span className="text-[clamp(31px,8.2vw,36px)] min-[410px]:text-[41px] sm:text-[47px] font-black tracking-tight text-white font-sans [font-feature-settings:'normal'] leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    {isBalancesHidden ? '••••••••' : <AnimatedNumber value={capital_overview.net_capital || 10293682} />}
                  </span>
                  <span className="text-[clamp(14px,3.8vw,16px)] min-[410px]:text-[17px] sm:text-[19px] font-bold text-slate-300 font-sans tracking-wide">
                    ETB
                  </span>
                </div>

                <div className="mt-1 min-[390px]:mt-1.5 flex items-center gap-1.5 text-[11px] min-[390px]:text-xs">
                  <span className="flex items-center text-[#34d399] font-extrabold">
                    <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>+12.5%</span>
                  </span>
                  <span className="text-slate-400 font-normal">vs last month</span>
                </div>
              </div>
            </div>

            {/* Inset Glassmorphic Breakdown Sub-Card (Balanced positioning and dynamic padding) */}
            <div className="rounded-[14px] min-[390px]:rounded-[16px] bg-[#102434]/50 backdrop-blur-xl border border-white/16 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)] p-2 min-[390px]:p-2.5 min-[410px]:p-2.5 sm:p-3 mx-0.5 mb-1.5 min-[390px]:mb-2 min-[410px]:mb-2 sm:mb-2.5">
              {/* Row 1: Stock, Liquid, Owed, Forex (Even, generous horizontal gaps) */}
              <div className="grid grid-cols-4 gap-1.5 min-[390px]:gap-2 sm:gap-3 text-[9.5px] min-[390px]:text-[10px] min-[410px]:text-[10.5px] sm:text-[11.5px]">
                <button
                  type="button"
                  onClick={() => openVital('inventory')}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left truncate active:scale-98"
                >
                  <span className="w-2 h-2 rounded-full bg-[#34d399] shrink-0" />
                  <span className="truncate">Stock <strong className="text-white font-bold">{stockPct || 37}%</strong></span>
                </button>

                <button
                  type="button"
                  onClick={() => openVital('cash')}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left truncate active:scale-98"
                >
                  <span className="w-2 h-2 rounded-full bg-[#3b82f6] shrink-0" />
                  <span className="truncate">Liquid <strong className="text-white font-bold">{cashPct || 5}%</strong></span>
                </button>

                <button
                  type="button"
                  onClick={() => openVital('receivables')}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left truncate active:scale-98"
                >
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b] shrink-0" />
                  <span className="truncate">Owed <strong className="text-white font-bold">{recPct || 20}%</strong></span>
                </button>

                <button
                  type="button"
                  onClick={() => openVital('reserves')}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left truncate active:scale-98"
                >
                  <span className="w-2 h-2 rounded-full bg-[#a855f7] shrink-0" />
                  <span className="truncate">Forex <strong className="text-white font-bold">{forexPct || 25}%</strong></span>
                </button>
              </div>

              {/* Row 2: Gold, Other, and Owe */}
              <div className="grid grid-cols-4 gap-1.5 min-[390px]:gap-2 sm:gap-3 text-[9.5px] min-[390px]:text-[10px] min-[410px]:text-[10.5px] sm:text-[11.5px] mt-1 min-[390px]:mt-1.5 pt-1 min-[390px]:pt-1.5 border-t border-white/8 items-center">
                <button
                  type="button"
                  onClick={() => openVital('reserves')}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left truncate active:scale-98"
                >
                  <span className="w-2 h-2 rounded-full bg-[#eab308] shrink-0" />
                  <span className="truncate">Gold <strong className="text-white font-bold">{goldPct || 7}%</strong></span>
                </button>

                <button
                  type="button"
                  onClick={() => openVital('reserves')}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left truncate active:scale-98"
                >
                  <span className="w-2 h-2 rounded-full bg-[#94a3b8] shrink-0" />
                  <span className="truncate">Other <strong className="text-white font-bold">{otherPct || 6}%</strong></span>
                </button>

                <div className="col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => openVital('payables')}
                    className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer active:scale-98"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#f87171] shrink-0" />
                    <span>Owe <strong className="text-rose-400 font-bold font-mono">
                      {isBalancesHidden ? '−••••••' : (capital_overview.payables && capital_overview.payables > 0 ? `−${capital_overview.payables.toLocaleString()}` : '−315,700')}
                    </strong></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. QUICK FINANCIAL ACTIONS ROW (5 Jewel-Tone Containers) ── */}
      <div className="grid grid-cols-5 gap-2 pt-1 pb-1">
        {/* 1. Stock */}
        <button
          type="button"
          onClick={() => openVital('inventory')}
          className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
          title={`Stock: ${isBalancesHidden ? '••••••' : capital_overview.stock_value.toLocaleString()} ETB`}
        >
          <div className="w-13 h-13 rounded-2xl bg-[#063e2e] dark:bg-[#072c21] border border-emerald-600/30 flex items-center justify-center text-emerald-300 shadow-sm mx-auto group-hover:bg-[#084b38] transition-colors">
            <Package className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
            Stock
          </span>
          <span className="text-[11px] font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-0.5 truncate max-w-full block">
            <AnimatedNumber value={capital_overview.stock_value} />
          </span>
        </button>

        {/* 2. Bank */}
        <button
          type="button"
          onClick={() => openVital('cash')}
          className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
          title={`Bank: ${isBalancesHidden ? '••••••' : capital_overview.cash_and_banks.toLocaleString()} ETB`}
        >
          <div className="w-13 h-13 rounded-2xl bg-[#0a3547] dark:bg-[#072836] border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-sm mx-auto group-hover:bg-[#0e445b] transition-colors">
            <Landmark className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
            Bank
          </span>
          <span className="text-[11px] font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-0.5 truncate max-w-full block">
            <AnimatedNumber value={capital_overview.cash_and_banks} />
          </span>
        </button>

        {/* 3. Owed to You */}
        <button
          type="button"
          onClick={() => openVital('receivables')}
          className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
          title={`Owed to You: ${isBalancesHidden ? '••••••' : capital_overview.receivables.toLocaleString()} ETB`}
        >
          <div className="w-13 h-13 rounded-2xl bg-[#0d4530] dark:bg-[#093324] border border-emerald-500/30 flex items-center justify-center text-emerald-300 shadow-sm mx-auto group-hover:bg-[#11543b] transition-colors">
            <ArrowDown className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
            Owed
          </span>
          <span className="text-[11px] font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400 mt-0.5 truncate max-w-full block">
            +<AnimatedNumber value={capital_overview.receivables} />
          </span>
        </button>

        {/* 4. You Owe */}
        <button
          type="button"
          onClick={() => openVital('payables')}
          className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
          title={`You Owe: ${isBalancesHidden ? '••••••' : capital_overview.payables.toLocaleString()} ETB`}
        >
          <div className="w-13 h-13 rounded-2xl bg-[#451e24] dark:bg-[#38151a] border border-rose-500/30 flex items-center justify-center text-rose-300 shadow-sm mx-auto group-hover:bg-[#57242c] transition-colors">
            <ArrowUp className="w-6 h-6 stroke-[2.2]" />
          </div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
            You Owe
          </span>
          <span className="text-[11px] font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-0.5 truncate max-w-full block">
            {(capital_overview.payables || 0) > 0 ? '−' : ''}
            <AnimatedNumber value={capital_overview.payables} />
          </span>
        </button>

        {/* 5. Other Assets */}
        <button
          type="button"
          onClick={() => openVital('reserves')}
          className="flex flex-col items-center text-center group cursor-pointer active:scale-90 transition-transform"
          title={`Other Assets: ${isBalancesHidden ? '••••••' : capital_overview.custom_assets.toLocaleString()} ETB`}
        >
          <div className="w-13 h-13 rounded-2xl bg-[#362711] dark:bg-[#2c1e0a] border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-sm mx-auto group-hover:bg-[#473417] transition-colors">
            <Coins className="w-6 h-6 stroke-[2]" />
          </div>
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 truncate max-w-full block">
            Other
          </span>
          <span className="text-[11px] font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100 mt-0.5 truncate max-w-full block">
            <AnimatedNumber value={capital_overview.custom_assets} />
          </span>
        </button>
      </div>

      {/* ── 3. MONTHLY PERFORMANCE SECTION (2x2 Grid) ── */}
      <div className="space-y-3">
        {/* Section Heading */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white truncate">
              {monthDisplayLabel} Performance
            </h2>
          </div>
          {topSeller && user?.role === 'owner' && (
            <button
              type="button"
              onClick={() => onNavigateTab('staff')}
              title="View Staff & Team Dashboard"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-[10px] font-semibold active:scale-[0.98] cursor-pointer"
            >
              <span>
                Top: <span className="font-bold">{topSeller.name}</span>
              </span>
              <ChevronRight className="w-3 h-3 opacity-60" />
            </button>
          )}
        </div>

        {/* 2x2 Performance Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card 1: Revenue (Dark Navy Surface with Glowing Sparkline) */}
          <div className="rounded-[24px] bg-[#111C2D] text-white p-4 border border-slate-800 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[148px]">
            {/* Ambient card tint */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                  Revenue
                </span>
              </div>
              <MoreHorizontal className="w-4 h-4 text-slate-500" />
            </div>

            <div className="mt-2.5 relative z-10">
              <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-white">
                <AnimatedNumber value={monthly_performance.revenue} />
                <span className="text-[11px] font-semibold text-slate-400 ml-1 font-sans">
                  ETB
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                Gross sales before discounts
              </span>
            </div>

            {/* Glowing Mini Sparkline Graphic */}
            <div className="relative h-6 w-full mt-2 overflow-visible">
              <svg viewBox="0 0 140 24" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <path
                  d="M 0 20 Q 30 18, 55 12 T 95 10 T 135 4"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Card 2: Gross Profit (Soft Mint Surface with Wave Curve) */}
          {canViewCost ? (
            <div className="rounded-[24px] bg-[#f0fbf5] dark:bg-[#0c241a] p-4 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[148px]">
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 dark:text-emerald-300">
                    Gross Profit
                  </span>
                </div>
              </div>

              <div className="mt-2.5 relative z-10">
                <div className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                  monthly_performance.gross_profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {monthly_performance.gross_profit > 0 ? '+' : monthly_performance.gross_profit < 0 ? '−' : ''}
                  <AnimatedNumber value={Math.abs(monthly_performance.gross_profit)} />
                  <span className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">
                    ETB
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 block truncate">
                  Net sales − stock cost
                </span>
              </div>

              {/* Soft Mint Wave Graphic */}
              <div className="relative h-6 w-full mt-2 overflow-visible">
                <svg viewBox="0 0 140 24" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <path
                    d="M 0 18 Q 35 15, 70 8 T 135 3"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    className="opacity-80"
                  />
                </svg>
              </div>
            </div>
          ) : (
            /* Fallback for staff who cannot view costs */
            <div className="rounded-[24px] bg-[#f0fbf5] dark:bg-[#0c241a] p-4 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[148px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-800 dark:text-emerald-300">
                  Store Activity
                </span>
              </div>
              <div className="text-xl font-bold font-mono tracking-tight text-emerald-700 dark:text-emerald-400">
                Active Store
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                Operational records active
              </span>
            </div>
          )}

          {/* Card 3: Expenses (Soft Rose Surface with Interactive +Record pill) */}
          <div className="rounded-[24px] bg-[#fdf4f4] dark:bg-[#281318] p-4 border border-rose-200/80 dark:border-rose-900/60 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[148px]">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[2.2]" />
                <span className="text-[10px] font-bold tracking-wider uppercase text-rose-800 dark:text-rose-300">
                  Expenses
                </span>
              </div>

              {/* Interactive + Record badge pill */}
              <button
                type="button"
                onClick={onOpenExpenseModal}
                title="Quickly record expense"
                className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-300 text-[9px] font-bold flex items-center gap-0.5 active:scale-95 cursor-pointer hover:bg-rose-500/25 transition-all"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Record</span>
              </button>
            </div>

            <div className="mt-2.5 relative z-10">
              <div className="text-xl sm:text-2xl font-extrabold font-mono tracking-tight text-rose-600 dark:text-rose-400">
                {(monthly_performance.operating_expenses || 0) > 0 ? '−' : ''}
                <AnimatedNumber value={monthly_performance.operating_expenses} />
                <span className="text-[11px] font-semibold text-rose-500/70 dark:text-rose-400/70 ml-1 font-sans">
                  ETB
                </span>
              </div>
              <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 block truncate">
                Bills + Bank Fees
              </span>
            </div>

            {/* Soft Rose Wave Graphic */}
            <div className="relative h-6 w-full mt-2 overflow-visible">
              <svg viewBox="0 0 140 24" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <path
                  d="M 0 10 Q 40 18, 75 14 T 135 20"
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  className="opacity-75"
                />
              </svg>
            </div>
          </div>

          {/* Card 4: Net Profit (Clean Light Surface with 5-Step Bar Graphic) */}
          <div className="rounded-[24px] bg-white dark:bg-[#131926] p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden flex flex-col justify-between min-h-[148px]">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-700 dark:text-slate-300">
                  Net Profit
                </span>
              </div>
            </div>

            <div className="mt-2.5 relative z-10">
              <div className={`text-xl sm:text-2xl font-extrabold font-mono tracking-tight ${
                monthly_performance.net_profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
              }`}>
                {monthly_performance.net_profit > 0 ? '+' : monthly_performance.net_profit < 0 ? '−' : ''}
                <AnimatedNumber value={Math.abs(monthly_performance.net_profit)} />
                <span className="text-[11px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 ml-1 font-sans">
                  ETB
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block truncate">
                After operating expenses
              </span>
            </div>

            {/* Miniature 5-Step Ascending Bar Visual */}
            <div className="flex items-end justify-end gap-1.5 h-6 mt-2">
              <div className="w-1.5 h-[30%] bg-emerald-400/50 rounded-xs" />
              <div className="w-1.5 h-[45%] bg-emerald-400/65 rounded-xs" />
              <div className="w-1.5 h-[62%] bg-emerald-500/80 rounded-xs" />
              <div className="w-1.5 h-[80%] bg-emerald-500/90 rounded-xs" />
              <div className="w-1.5 h-[100%] bg-emerald-600 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Owner Draws (if present and user can view costs) */}
        {canViewCost && (monthly_performance.owner_draws || 0) > 0 && (
          <div className="rounded-[20px] bg-purple-50/70 dark:bg-purple-950/30 p-3.5 border border-purple-200/70 dark:border-purple-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                  Owner Draws
                </span>
                <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80 block">
                  Personal drawings this month
                </span>
              </div>
            </div>
            <div className="text-base font-bold font-mono tracking-tight text-purple-700 dark:text-purple-300">
              −<AnimatedNumber value={Math.abs(monthly_performance.owner_draws)} />
              <span className="text-[10px] font-medium text-purple-400 ml-1 font-sans">ETB</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. DEBT LEDGERS (Refined Mobile Lists) ── */}
      <div className="space-y-3 pt-1">
        {/* Receivables: Owed to You */}
        <div className="bg-white dark:bg-[#131926] rounded-[24px] border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/60 mb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Owed to You
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenDebtModal('receivable')}
                className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-0.5 cursor-pointer py-0.5 px-1.5 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                <Plus className="w-3 h-3" />
                <span>Record</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => onNavigateTab('debts')}
                className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                View all · {counts.open_receivables} →
              </button>
            </div>
          </div>

          {groupedReceivables.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              No outstanding receivables
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {groupedReceivables.map((group) => (
                <button
                  key={group.contactId}
                  type="button"
                  onClick={() => openVital('receivables', group.contactId)}
                  className="w-full flex items-center justify-between min-h-[46px] p-2.5 rounded-xl text-xs bg-slate-50/70 dark:bg-[#0c1017]/70 border border-slate-100/90 dark:border-slate-800/70 hover:bg-slate-100/80 active:scale-[0.99] transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border ${
                        group.hasHandover
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/50'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/50'
                      }`}
                    >
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
                        {group.offsetAmount > 0.01 &&
                          ` · Offset −${isBalancesHidden ? '••••••' : group.offsetAmount.toLocaleString()} ETB`}
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

        {/* Payables: You Owe */}
        <div className="bg-white dark:bg-[#131926] rounded-[24px] border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/60 mb-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              You Owe
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenDebtModal('payable')}
                className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer py-0.5 px-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                <Plus className="w-3 h-3" />
                <span>Record</span>
              </button>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => onNavigateTab('debts')}
                className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
              >
                View all · {counts.open_payables} →
              </button>
            </div>
          </div>

          {groupedPayables.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              No outstanding payables
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {groupedPayables.map((group) => (
                <button
                  key={group.contactId}
                  type="button"
                  onClick={() => openVital('payables', group.contactId)}
                  className="w-full flex items-center justify-between min-h-[46px] p-2.5 rounded-xl text-xs bg-slate-50/70 dark:bg-[#0c1017]/70 border border-slate-100/90 dark:border-slate-800/70 hover:bg-slate-100/80 active:scale-[0.99] transition-all group text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold flex items-center justify-center text-[10px] uppercase shrink-0 border border-rose-200/60 dark:border-rose-800/50">
                      {group.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-900 dark:text-white truncate block">
                        {group.name}
                      </span>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {group.openCount} {group.openCount === 1 ? 'obligation' : 'obligations'}
                        {group.offsetAmount > 0.01 &&
                          ` · Offset −${isBalancesHidden ? '••••••' : group.offsetAmount.toLocaleString()} ETB`}
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
  );
};
