import React, { useState, useMemo } from 'react';
import type { User, LeaderboardItem, StaffTask, StaffStatementData } from '../../api/client';
import { AnimatedNumber } from '../AnimatedNumber';
import { InteractiveSalesWaveChart, type DataPoint } from '../Charts';
import { CommissionMilestones } from './CommissionMilestones';
import {
  TrendingUp,
  Award,
  DollarSign,
  ShoppingCart,
  Smartphone,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  FileText,
  ChevronRight,
  Loader2,
  LineChart as ChartIcon,
  Package,
} from 'lucide-react';

interface MobileStaffOverviewProps {
  user: User | null;
  userStats: LeaderboardItem;
  leaderboard: LeaderboardItem[];
  tasks: StaffTask[];
  statement: StaffStatementData | null;
  onNavigateTab: (tab: any) => void;
  onOpenStatement: () => void;
  onAddTask: (title: string, priority: 'normal' | 'high' | 'low') => Promise<void>;
  onToggleTask: (id: string) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  isAddingTask: boolean;
}

const HERO_CARD_PATH =
  'M 8 36 C 8 20, 20 12, 38 12 C 105 12, 155 26, 210 26 C 265 26, 315 12, 382 12 C 400 12, 412 20, 412 36 L 412 220 C 412 236, 400 246, 382 246 C 315 246, 265 234, 210 234 C 155 234, 105 246, 38 246 C 20 246, 8 236, 8 220 L 8 36 Z';

export const MobileStaffOverview: React.FC<MobileStaffOverviewProps> = ({
  user,
  userStats,
  leaderboard,
  tasks,
  statement,
  onNavigateTab,
  onOpenStatement,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  isAddingTask,
}) => {
  const [activeTab, setActiveTab] = useState<'chart' | 'sales' | 'leaderboard' | 'tasks'>('chart');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'normal' | 'high' | 'low'>('normal');

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onAddTask(newTaskTitle, newTaskPriority);
    setNewTaskTitle('');
  };

  // Commission milestones (Emerald theme)
  const tierTargets = [
    { name: 'Starter', threshold: 0, bonus: 0 },
    { name: 'Bronze', threshold: 100000, bonus: 1000 },
    { name: 'Silver', threshold: 250000, bonus: 2500 },
    { name: 'Gold Champion', threshold: 500000, bonus: 6000 },
  ];

  const currentVolume = userStats.month_volume;
  let nextTier = tierTargets[1];

  for (let i = 0; i < tierTargets.length; i++) {
    if (currentVolume >= tierTargets[i].threshold) {
      nextTier = tierTargets[i + 1] || tierTargets[i];
    }
  }

  const targetDiff = Math.max(0, nextTier.threshold - currentVolume);

  const pendingTasks = tasks.filter((t) => !t.is_completed);
  const uncollectedBonus = statement?.summary?.uncollected_bonus ?? userStats.uncollected_bonus ?? 0;
  const recentSales = statement?.sales_orders?.slice(0, 10) || [];
  const activeHandoversCount = statement?.summary?.active_handovers_count || 0;
  const activeHandoversValue = statement?.summary?.active_handovers_value || 0;

  // Real 7-day sales wave trajectory chart data for this staff member
  const staffChartData: DataPoint[] = useMemo(() => {
    const days: DataPoint[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = dayNames[d.getDay()];

      const ordersOnDay = (statement?.sales_orders || []).filter((order) => {
        if (!order.order_date) return false;
        return order.order_date.startsWith(dateStr);
      });

      const dayRevenue = ordersOnDay.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const dayBonus = ordersOnDay.reduce((sum, o) => sum + (o.bonus_amount || 0), 0);

      days.push({
        day: dayLabel,
        date: dateStr,
        revenue: dayRevenue,
        profit: dayBonus,
        orders: ordersOnDay.length,
      });
    }

    return days;
  }, [statement?.sales_orders]);

  const getRankMedal = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="space-y-4 px-0.5 select-none scroll-smooth">
      {/* ── 1. OWNER-BENCHMARK CURVED HERO WIDGET WITH SPLINE CHART & RADAR BEACON ── */}
      <div className="relative w-full select-none -mx-1.5 px-0.5 py-0.5 animate-stagger-1">
        <div className="relative w-full aspect-[420/270] min-[410px]:aspect-[420/256] overflow-visible">
          {/* Unified SVG Deck (Stacked Accent + Main Card + Spline Wave Chart + Beacon) */}
          <svg
            viewBox="0 0 420 256"
            className="w-full h-full overflow-visible drop-shadow-sm"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="staffHeroShadow" x="-10%" y="-10%" width="125%" height="130%">
                <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#01060c" floodOpacity="0.58" />
              </filter>
              <filter id="staffBeadGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34d399" floodOpacity="0.95" />
              </filter>

              {/* Rich Bold Emerald Mesh Gradient (Matching Owner Benchmark) */}
              <radialGradient id="staffHeroMesh" cx="82%" cy="18%" r="85%">
                <stop offset="0%" stopColor="#183d36" />
                <stop offset="28%" stopColor="#112630" />
                <stop offset="62%" stopColor="#0c1a25" />
                <stop offset="100%" stopColor="#071118" />
              </radialGradient>

              {/* Stack Accent Gradient */}
              <linearGradient id="staffBackSage" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34594e" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#508575" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#79ad9c" stopOpacity="0.92" />
              </linearGradient>

              {/* Spline Wave Downward Radiant Beam */}
              <linearGradient id="staffFrontChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#071118" stopOpacity="0.0" />
              </linearGradient>

              {/* Spline Line Gradient */}
              <linearGradient id="staffFrontLineGrad" x1="175" y1="0" x2="408" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.0" />
                <stop offset="14%" stopColor="#34d399" stopOpacity="0.75" />
                <stop offset="80%" stopColor="#34d399" stopOpacity="0.95" />
                <stop offset="97%" stopColor="#34d399" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Back Accent Card */}
            <g transform="translate(14, -6) scale(0.965)">
              <path
                d={HERO_CARD_PATH}
                fill="url(#staffBackSage)"
              />
            </g>

            {/* Main Curved Hero Card */}
            <path
              d={HERO_CARD_PATH}
              fill="url(#staffHeroMesh)"
              filter="url(#staffHeroShadow)"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1.2"
            />

            {/* Radiant Spline Wave Area Fill */}
            <g>
              <path
                d="M 175 160 C 200 144, 225 118, 248 120 C 268 122, 282 130, 298 128 C 318 125, 332 104, 350 102 C 366 101, 378 108, 388 96 C 394 86, 398 72, 405 58 L 408 160 L 175 160 Z"
                fill="url(#staffFrontChartGrad)"
                className="animate-beam-reveal"
              />
              <path
                d="M 175 160 C 200 144, 225 118, 248 120 C 268 122, 282 130, 298 128 C 318 125, 332 104, 350 102 C 366 101, 378 108, 388 96 C 394 86, 398 72, 405 58"
                fill="none"
                stroke="url(#staffFrontLineGrad)"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="animate-chart-line"
              />
            </g>

            {/* Glowing Endpoint Bead with Concentric Sonar Radar Rings */}
            <g>
              <circle cx="403" cy="60" r="3" fill="none" stroke="#34d399" strokeWidth="1.5">
                <animate attributeName="r" values="3;18" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="stroke-width" values="1.8;0.3" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="403" cy="60" r="3" fill="none" stroke="#34d399" strokeWidth="1.5">
                <animate attributeName="r" values="3;18" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.85;0" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
                <animate attributeName="stroke-width" values="1.8;0.3" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="403" cy="60" r="5" fill="#ffffff" filter="url(#staffBeadGlow)" opacity="0.95" />
              <circle cx="403" cy="60" r="3" fill="#ffffff" stroke="#10b981" strokeWidth="0.8" />
            </g>
          </svg>

          {/* Holographic Aurora Sheen Sweep */}
          <div
            className="absolute pointer-events-none overflow-hidden rounded-[24px] z-10"
            style={{ left: '2.5%', width: '95%', top: '4%', height: '90%' }}
          >
            <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-emerald-400/15 via-white/30 to-transparent animate-holo-sweep pointer-events-none" />
          </div>

          {/* Foreground Hero Content */}
          <div
            className="absolute z-10 flex flex-col justify-between px-3 min-[390px]:px-4 py-2 min-[390px]:py-3"
            style={{ left: '2.5%', width: '95%', top: '4%', height: '90%' }}
          >
            {/* Top Row: User Tag & Store Rank Badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399]" />
                <span className="text-[11px] min-[390px]:text-[12px] font-bold tracking-wider text-white uppercase">
                  {user?.name?.split(' ')[0] || 'Staff'} · Month Sales
                </span>
              </div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#082f23]/90 border border-[#34d399]/40 text-[#e6f7ef] text-[10px] min-[390px]:text-[11px] font-semibold">
                <span>{getRankMedal(userStats.rank)}</span>
                <span>{userStats.rank === 1 ? 'Top Seller' : `Rank #${userStats.rank}`}</span>
              </div>
            </div>

            {/* Big Financial Number + Pacing */}
            <div className="mt-1 min-[390px]:mt-2">
              <div className="flex items-baseline gap-1.5 min-[390px]:gap-2">
                <span className="text-[clamp(31px,8.2vw,36px)] min-[410px]:text-[40px] font-black tracking-tight text-white font-sans leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                  <AnimatedNumber value={userStats.month_volume} />
                </span>
                <span className="text-[14px] min-[390px]:text-[16px] font-bold text-slate-300 font-sans tracking-wide">
                  ETB
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 text-[10.5px] min-[390px]:text-[11.5px] text-slate-300">
                <span className="inline-flex items-center gap-1 text-[#34d399] font-bold">
                  <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{userStats.month_count} orders completed</span>
                </span>
                <span>•</span>
                <span className="text-emerald-300 font-medium">{userStats.bonus_tier} Tier</span>
              </div>
            </div>

            {/* Inset Glassmorphic Breakdown Card (Exact Match to Owner Subcard) */}
            <div className="rounded-[14px] bg-[#102434]/50 backdrop-blur-xl border border-white/16 shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)] p-2 min-[390px]:p-2.5 mx-0.5 mb-0.5">
              <div className="grid grid-cols-4 gap-1 text-[9.5px] min-[390px]:text-[10px]">
                <div className="truncate">
                  <span className="text-slate-400 block text-[8.5px] uppercase font-bold">Week</span>
                  <span className="text-white font-bold font-mono">
                    {(userStats.week_volume / 1000).toFixed(0)}k <span className="text-slate-400 font-normal">ETB</span>
                  </span>
                </div>

                <div className="truncate">
                  <span className="text-emerald-400 block text-[8.5px] uppercase font-bold">Bonus</span>
                  <span className="text-emerald-300 font-bold font-mono">
                    {uncollectedBonus.toLocaleString()} <span className="text-emerald-500 font-normal">ETB</span>
                  </span>
                </div>

                <div className="truncate">
                  <span className="text-slate-400 block text-[8.5px] uppercase font-bold">Custody</span>
                  <span className="text-white font-bold font-mono">
                    {activeHandoversCount} units
                  </span>
                </div>

                <div className="truncate text-right">
                  <span className="text-slate-400 block text-[8.5px] uppercase font-bold">Rank</span>
                  <span className="text-amber-300 font-bold font-mono">
                    #{userStats.rank}
                  </span>
                </div>
              </div>

              <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[9px] min-[390px]:text-[9.5px]">
                <span className="text-slate-300 truncate">
                  {targetDiff > 0 ? (
                    <>
                      <strong className="text-white font-mono">{targetDiff.toLocaleString()} ETB</strong> to {nextTier.name}
                    </>
                  ) : (
                    <span className="text-emerald-300 font-bold">Max Tier Achieved</span>
                  )}
                </span>
                <span className="text-emerald-400 font-bold font-mono shrink-0 ml-1">
                  +{nextTier.bonus.toLocaleString()} ETB Bonus
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. QUICK ACTION PILLS (Native Touch Controls) ── */}
      <div className="grid grid-cols-3 gap-2 animate-stagger-2">
        <button
          onClick={() => onNavigateTab('counter')}
          className="h-11 rounded-2xl bg-black dark:bg-black text-white border border-emerald-500/40 hover:bg-slate-950 active:scale-[0.97] flex items-center justify-center gap-1.5 shadow-sm text-xs font-bold transition-all haptic-press"
        >
          <ShoppingCart className="w-4 h-4 text-emerald-400" />
          <span>+ Record Sale</span>
        </button>

        <button
          onClick={onOpenStatement}
          className="h-11 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 active:scale-[0.97] flex items-center justify-center gap-1.5 text-xs font-bold shadow-2xs transition-all haptic-press"
        >
          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>My Statement</span>
        </button>

        <button
          onClick={() => onNavigateTab('inventory')}
          className="h-11 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 active:scale-[0.97] flex items-center justify-center gap-1.5 text-xs font-bold shadow-2xs transition-all haptic-press"
        >
          <Smartphone className="w-4 h-4 text-slate-500" />
          <span>Check Stock</span>
        </button>
      </div>

      {/* ── 3. QUICK 4-CARD METRIC SQUIRCLES (Matching Owner Benchmark) ── */}
      <div className="w-full rounded-[24px] bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] p-2.5 min-[390px]:p-3 select-none animate-stagger-2">
        <div className="grid grid-cols-4 gap-1.5">
          {/* Week Volume */}
          <div className="flex flex-col items-center text-center">
            <div className="size-11 rounded-[16px] p-0.5 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 flex items-center justify-center shrink-0 shadow-xs">
              <div className="w-full h-full rounded-[13px] bg-gradient-to-b from-[#eef9f2] to-[#ddf4e6] dark:from-[#0b2b1d] dark:to-[#071f15] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
              </div>
            </div>
            <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
              Week
            </span>
            <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate">
              <AnimatedNumber value={userStats.week_volume} compact />
            </span>
          </div>

          {/* Month Volume */}
          <div className="flex flex-col items-center text-center">
            <div className="size-11 rounded-[16px] p-0.5 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 flex items-center justify-center shrink-0 shadow-xs">
              <div className="w-full h-full rounded-[13px] bg-gradient-to-b from-[#eaf4ff] to-[#d6ebff] dark:from-[#0d273a] dark:to-[#091b29] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-sky-600 dark:text-sky-400 stroke-[2.2]" />
              </div>
            </div>
            <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
              Month
            </span>
            <span className="text-[10px] font-bold font-mono text-sky-600 dark:text-sky-400 truncate">
              <AnimatedNumber value={userStats.month_volume} compact />
            </span>
          </div>

          {/* Bonus Due */}
          <button
            onClick={onOpenStatement}
            className="flex flex-col items-center text-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="size-11 rounded-[16px] p-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-xs">
              <div className="w-full h-full rounded-[13px] bg-gradient-to-b from-[#eef9f2] to-[#ddf4e6] dark:from-[#0b2b1d] dark:to-[#071f15] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2.4]" />
              </div>
            </div>
            <span className="text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300 mt-1 truncate">
              Bonus
            </span>
            <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-400 truncate">
              <AnimatedNumber value={uncollectedBonus} compact />
            </span>
          </button>

          {/* Custody */}
          <div className="flex flex-col items-center text-center">
            <div className="size-11 rounded-[16px] p-0.5 bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-white/5 flex items-center justify-center shrink-0 shadow-xs">
              <div className="w-full h-full rounded-[13px] bg-gradient-to-b from-[#f8fafc] to-[#f1f5f9] dark:from-[#182338] dark:to-[#0f172a] flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-slate-600 dark:text-slate-300 stroke-[2.2]" />
              </div>
            </div>
            <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
              Custody
            </span>
            <span className="text-[10px] font-bold font-mono text-slate-600 dark:text-slate-300 truncate">
              {activeHandoversCount > 0 ? `${activeHandoversCount}u · ${(activeHandoversValue / 1000).toFixed(0)}k` : '0 units'}
            </span>
          </div>
        </div>
      </div>

      {/* ── 3.5 COMMISSION MILESTONES (Interconnected Stepper & Gamified Achievement Bento) ── */}
      <CommissionMilestones
        currentVolume={userStats.month_volume}
        currentTier={userStats.bonus_tier}
        className="animate-stagger-2"
      />

      {/* ── 4. FIXED-HEIGHT TABBED TABLES & THE PERFECT CHART CONTAINER ── */}
      <div className="rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden animate-stagger-3">
        {/* Segmented Tab Controls */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-1">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'chart'
                ? 'bg-white dark:bg-[#111C2D] text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ChartIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Sales Wave</span>
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'sales'
                ? 'bg-white dark:bg-[#111C2D] text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span>Sales ({recentSales.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'leaderboard'
                ? 'bg-white dark:bg-[#111C2D] text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Rank</span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-[#111C2D] text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            <span>Tasks ({pendingTasks.length})</span>
          </button>
        </div>

        {/* Fixed Height Container for Internal Scroll */}
        <div className="h-[340px] overflow-y-auto p-3">
          {/* TAB 1: The Perfect Interactive Sales Wave Chart */}
          {activeTab === 'chart' && (
            <div className="space-y-3">
              <InteractiveSalesWaveChart
                data={staffChartData}
                currency="ETB"
                totalRevenue={userStats.month_volume}
                totalProfit={userStats.bonus_amount || uncollectedBonus}
                canViewCost={true}
              />
            </div>
          )}

          {/* TAB 2: Recent Closed Sales List-Like Table */}
          {activeTab === 'sales' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 text-[11px] font-bold text-slate-400">
                <span>Recent Closed Orders</span>
                <button
                  onClick={onOpenStatement}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                >
                  Full Statement <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {recentSales.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No sales recorded yet. Click <strong>+ Record Sale</strong> to start.
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {sale.items?.[0]?.name || 'Device Sale'}
                        </span>
                        {sale.items_count > 1 && (
                          <span className="text-[9px] px-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            +{sale.items_count - 1}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                        <span>#{sale.order_number}</span>
                        <span>•</span>
                        <span>{sale.customer_name}</span>
                        <span>•</span>
                        <span>
                          {sale.order_date
                            ? new Date(sale.order_date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                        {sale.total_amount.toLocaleString()}{' '}
                        <span className="text-[9px] font-normal text-slate-400">ETB</span>
                      </div>
                      {sale.bonus_amount > 0 && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black dark:bg-black text-white border border-emerald-500/40">
                          +{sale.bonus_amount.toLocaleString()} Bonus
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: Leaderboard List-Like Table */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pb-1 text-[11px] font-bold text-slate-400">
                <span>Weekly Leaderboard Standings</span>
                <span>Real-Time</span>
              </div>

              {leaderboard.map((item) => {
                const isCurrentUser = item.user_id === user?.id;
                return (
                  <div
                    key={item.user_id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                      isCurrentUser
                        ? 'bg-slate-50 dark:bg-slate-800/60 border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/20'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold w-6 text-center shrink-0">
                        {getRankMedal(item.rank)}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                          <span>{item.name}</span>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.2 rounded bg-black dark:bg-black text-white border border-emerald-500/40 text-[9px] font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {item.week_count} sold this week
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                        {item.week_volume.toLocaleString()}{' '}
                        <span className="text-[9px] font-normal text-slate-400">ETB</span>
                      </div>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {item.bonus_tier}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: Tasks List-Like Table */}
          {activeTab === 'tasks' && (
            <div className="space-y-2">
              <form onSubmit={handleTaskSubmit} className="flex gap-1.5 mb-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Add customer follow-up or task..."
                  className="flex-1 h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2D] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                />
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2D] text-[11px] font-medium text-slate-700 dark:text-slate-300"
                >
                  <option value="normal">Normal</option>
                  <option value="high">Urgent</option>
                  <option value="low">Low</option>
                </select>
                <button
                  type="submit"
                  disabled={isAddingTask || !newTaskTitle.trim()}
                  className="h-9 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-50 flex items-center justify-center shrink-0"
                >
                  {isAddingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </form>

              <div className="space-y-1">
                {tasks.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No active tasks. Add a reminder above.
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                        task.is_completed
                          ? 'opacity-50 border-slate-100 dark:border-slate-800'
                          : 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => onToggleTask(task.id)}
                          className="text-slate-300 hover:text-emerald-500 transition-colors shrink-0"
                        >
                          {task.is_completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                        <span
                          className={`text-xs truncate ${
                            task.is_completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-900 dark:text-white font-medium'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {task.priority === 'high' && (
                          <span className="text-[8px] font-bold text-rose-500 uppercase px-1 rounded bg-rose-50 dark:bg-rose-950">
                            Urgent
                          </span>
                        )}
                        <button
                          onClick={() => onDeleteTask(task.id)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
