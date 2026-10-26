import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, LeaderboardItem, StaffTask, StaffStatementData } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  TrendingUp,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ShoppingCart,
  Smartphone,
  Loader2,
  DollarSign,
  Award,
  FileText,
  Calendar,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { InteractiveSalesWaveChart, type DataPoint } from '../components/Charts';
import { MobileStaffOverview } from '../components/dashboard/MobileStaffOverview';
import { CommissionMilestones } from '../components/dashboard/CommissionMilestones';
import { StaffDetailView } from './StaffDetailView';

interface StaffOverviewViewProps {
  user: User | null;
  onNavigateTab: (tab: any) => void;
}

export const StaffOverviewView: React.FC<StaffOverviewViewProps> = ({
  user,
  onNavigateTab,
}) => {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [statement, setStatement] = useState<StaffStatementData | null>(null);
  const [loading, setLoading] = useState(true);

  // View Mode: 'overview' | 'statement' (Exact tabular ledger statement view)
  const [viewMode, setViewMode] = useState<'overview' | 'statement'>('overview');

  // Desktop active tab for lower tables: 'sales' | 'leaderboard' | 'tasks'
  const [activeTab, setActiveTab] = useState<'sales' | 'leaderboard' | 'tasks'>('sales');

  // New task input state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'normal' | 'high' | 'low'>('normal');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, lbRes, stmtRes] = await Promise.all([
        api.getTasks().catch(() => []),
        api.getLeaderboard().catch(() => ({ leaderboard: [], top_seller: null })),
        user?.id ? api.getStaffStatement(user.id).catch(() => null) : Promise.resolve(null),
      ]);
      setTasks(tasksRes);
      setLeaderboard(lbRes.leaderboard || []);
      setStatement(stmtRes);
    } catch (err: any) {
      console.error('Failed to load staff overview data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTask = async (title: string, priority: 'normal' | 'high' | 'low') => {
    if (!title.trim()) return;

    try {
      setIsAddingTask(true);
      const created = await api.createTask({
        title: title.trim(),
        priority,
      });
      setTasks((prev) => [created, ...prev]);
      toast.success('Task added to daily checklist');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add task');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleFormAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await handleAddTask(newTaskTitle, newTaskPriority);
    setNewTaskTitle('');
  };

  const handleToggleTask = async (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_completed: !t.is_completed } : t))
    );

    try {
      await api.toggleTask(id);
    } catch (err: any) {
      toast.error('Failed to update task');
      loadData();
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
      toast.success('Task removed');
    } catch (err: any) {
      toast.error('Failed to delete task');
      loadData();
    }
  };

  // Find user in leaderboard to get personal stats
  const userStats = useMemo(() => {
    return (
      leaderboard.find((item) => item.user_id === user?.id) || {
        rank: leaderboard.length + 1,
        user_id: user?.id || 0,
        name: user?.name || '',
        email: user?.email || '',
        week_count: 0,
        week_volume: 0,
        month_count: 0,
        month_volume: 0,
        bonus_tier: 'Starter',
        bonus_amount: 0,
        uncollected_bonus: 0,
        collected_bonus: 0,
        total_bonus_earned: 0,
      }
    );
  }, [leaderboard, user?.id, user?.name, user?.email]);

  const pendingTasksCount = tasks.filter((t) => !t.is_completed).length;
  const uncollectedBonus = statement?.summary?.uncollected_bonus ?? userStats.uncollected_bonus ?? 0;
  const activeHandoversCount = statement?.summary?.active_handovers_count || 0;
  const activeHandoversValue = statement?.summary?.active_handovers_value || 0;
  const recentSales = statement?.sales_orders || [];

  // 7-day Sales Wave Trajectory Chart Points
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

  if (loading) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  // ── SEPARATE IDENTICAL STATEMENT VIEW (Same exact table view as owner statement) ──
  if (viewMode === 'statement' && user) {
    return (
      <StaffDetailView
        staffId={user.id}
        user={user}
        onBack={() => {
          setViewMode('overview');
          loadData();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════════
          MOBILE NATIVE VIEW (< sm)
          Curved SVG Hero with Spline Wave Chart + Vitals + Interactive Tabbed Tables
         ═══════════════════════════════════════════════════════════════ */}
      <div className="sm:hidden">
        <MobileStaffOverview
          user={user}
          userStats={userStats}
          leaderboard={leaderboard}
          tasks={tasks}
          statement={statement}
          onNavigateTab={onNavigateTab}
          onOpenStatement={() => setViewMode('statement')}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          isAddingTask={isAddingTask}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          DESKTOP EXECUTIVE VIEW (>= sm)
          Interactive Sales Wave Chart + Bento Milestones + Fixed-Height Scrollable Tables
         ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden sm:block space-y-4">
        {/* ── 1. Top Executive Command Bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-black dark:bg-black border border-emerald-500/40 text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0">
              {user?.name?.charAt(0) || 'S'}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  Welcome back, {user?.name?.split(' ')[0] || 'Staff'}
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black dark:bg-black text-white border border-emerald-500/40">
                  {user?.role === 'salesperson' ? 'Sales Specialist' : 'Store Staff'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                  <span>{getRankMedal(userStats.rank)}</span>
                  <span>{userStats.rank === 1 ? 'Top Seller' : `Rank #${userStats.rank}`}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Shift Active</span>
                <span>•</span>
                <span>Tier: <strong className="text-emerald-500 dark:text-emerald-400 font-semibold">{userStats.bonus_tier}</strong></span>
                <span>•</span>
                <span>{userStats.month_count} sales completed this month</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('statement')}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>My Statement</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>Stock</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('counter')}
              className="h-9 px-4 rounded-xl bg-black dark:bg-black text-white border border-emerald-500/40 hover:bg-slate-950 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Record Sale</span>
            </button>
          </div>
        </div>

        {/* ── 2. Standalone 5-Card KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Week Sales */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Week Sales
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              <AnimatedNumber value={userStats.week_volume} />
              <span className="text-xs font-normal text-slate-400 ml-1 font-sans">ETB</span>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              {userStats.week_count} sold this week
            </div>
          </div>

          {/* Month Volume */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Month Volume
              </span>
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
              <AnimatedNumber value={userStats.month_volume} />
              <span className="text-xs font-normal text-slate-400 ml-1 font-sans">ETB</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              {userStats.month_count} orders closed
            </div>
          </div>

          {/* Store Rank */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Store Rank
              </span>
              <Award className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
              <span>#{userStats.rank}</span>
              <span className="text-base">{getRankMedal(userStats.rank)}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
              {userStats.rank === 1 ? 'Top Store Seller' : `Rank of ${leaderboard.length} staff`}
            </div>
          </div>

          {/* Bonus Due */}
          <button
            type="button"
            onClick={() => setViewMode('statement')}
            className="p-3.5 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-300 dark:hover:border-emerald-800 shadow-2xs text-left cursor-pointer transition-all active:scale-98"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Bonus Due
              </span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
              <AnimatedNumber value={uncollectedBonus} />
              <span className="text-xs font-normal text-slate-400 ml-1 font-sans">ETB</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
              <span>{uncollectedBonus > 0 ? 'Ready for payout' : 'Settled'}</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </div>
          </button>

          {/* Custody */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {activeHandoversCount > 0 ? 'Custody Held' : 'Tasks Pending'}
              </span>
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            </div>
            {activeHandoversCount > 0 ? (
              <>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {activeHandoversCount} <span className="text-xs font-sans text-slate-400 font-normal">units</span>
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  {activeHandoversValue.toLocaleString()} ETB value
                </div>
              </>
            ) : (
              <>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
                  {pendingTasksCount} <span className="text-xs font-sans text-slate-400 font-normal">tasks</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {tasks.length - pendingTasksCount} done today
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── 3. CHARTS ROW: THE PERFECT SALES WAVE CHART (7 cols) + COMMISSION MILESTONES (5 cols) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Left (7 cols): The Perfect Interactive Sales Wave Chart */}
          <div className="lg:col-span-7 bg-white dark:bg-[#111C2D] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 shadow-2xs flex flex-col justify-between">
            <InteractiveSalesWaveChart
              data={staffChartData}
              currency="ETB"
              totalRevenue={userStats.month_volume}
              totalProfit={userStats.bonus_amount || uncollectedBonus}
              canViewCost={true}
              heightClass="h-[200px] sm:h-[220px]"
            />

            {/* Bottom Trajectory Performance Summary Strip (Eliminates vertical empty gap) */}
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                  Avg Ticket
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {userStats.month_count > 0 ? Math.round(userStats.month_volume / userStats.month_count).toLocaleString() : '0'} <span className="text-[9px] font-sans text-slate-400">ETB</span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                  Orders Closed
                </span>
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                  {userStats.month_count} <span className="text-[9px] font-sans text-slate-400">{userStats.month_count === 1 ? 'sale' : 'sales'}</span>
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60">
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                  Bonus Tier
                </span>
                <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400 block mt-0.5 truncate">
                  {userStats.bonus_tier}
                </span>
              </div>
            </div>
          </div>

          {/* Right (5 cols): Commission Milestones Roadmap Bento */}
          <CommissionMilestones
            currentVolume={userStats.month_volume}
            currentTier={userStats.bonus_tier}
            className="lg:col-span-5"
          />
        </div>

        {/* ── 4. Fixed-Height Standalone Tabbed Tables with Internal Scroll (h-[360px]) ── */}
        <div className="rounded-2xl bg-white dark:bg-[#111C2D] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
          {/* Tab Selection Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('sales')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'sales'
                    ? 'bg-white dark:bg-[#111C2D] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Recent Sales ({recentSales.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('leaderboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'leaderboard'
                    ? 'bg-white dark:bg-[#111C2D] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Team Leaderboard ({leaderboard.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'tasks'
                    ? 'bg-white dark:bg-[#111C2D] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tasks & Reminders ({pendingTasksCount})
              </button>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('statement')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Full Statement Table</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fixed Height Container for Tab Content (360px with internal scroll) */}
          <div className="h-[360px] overflow-y-auto">
            {/* TAB 1: Recent Sales Table */}
            {activeTab === 'sales' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 z-10">
                  <tr>
                    <th className="py-2.5 px-4 whitespace-nowrap">Order #</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-4 min-w-[180px]">Device / Items</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Customer</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Total Sale</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Bonus Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400">
                        No closed sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          #{sale.order_number}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono whitespace-nowrap">
                          {sale.order_date
                            ? new Date(sale.order_date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                            {sale.items?.[0]?.name || 'Device'}
                            {sale.items_count > 1 && (
                              <span className="ml-1 text-[10px] text-slate-400 font-normal">
                                (+{sale.items_count - 1} more)
                              </span>
                            )}
                          </div>
                          {sale.items?.[0]?.imei && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              SN: {sale.items[0].imei}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {sale.customer_name}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {sale.total_amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal font-sans">ETB</span>
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {sale.bonus_amount > 0 ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-black dark:bg-black text-white border border-emerald-500/40 inline-flex items-center gap-1">
                              <Sparkles className="size-2.5 text-emerald-400" />
                              <span>+{sale.bonus_amount.toLocaleString()} ETB</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* TAB 2: Leaderboard Table */}
            {activeTab === 'leaderboard' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 z-10">
                  <tr>
                    <th className="py-2.5 px-4 whitespace-nowrap w-16">Rank</th>
                    <th className="py-2.5 px-4 min-w-[200px]">Staff Member</th>
                    <th className="py-2.5 px-4 text-center whitespace-nowrap">Items Sold</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Week Sales Volume</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Commission Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {leaderboard.map((item) => {
                    const isCurrentUser = item.user_id === user?.id;
                    return (
                      <tr
                        key={item.user_id}
                        className={`transition-colors ${
                          isCurrentUser
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 font-semibold'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-bold text-center">
                          {getRankMedal(item.rank)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.name}
                            </span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[9px] font-bold">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-600 dark:text-slate-300">
                          {item.week_count} sold
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {item.week_volume.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal font-sans">ETB</span>
                        </td>
                        <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400 font-bold">
                          {item.bonus_tier}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* TAB 3: Tasks Checklist Table */}
            {activeTab === 'tasks' && (
              <div className="p-4 space-y-3">
                <form onSubmit={handleFormAddTask} className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Add customer follow-up or task..."
                    className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2D] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111C2D] text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isAddingTask || !newTaskTitle.trim()}
                    className="h-9 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {isAddingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Add Task</span>
                  </button>
                </form>

                <div className="space-y-1 divide-y divide-slate-100 dark:divide-slate-800/80">
                  {tasks.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No active tasks. Add a customer reminder above.
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`py-2 px-2 rounded-lg flex items-center justify-between gap-3 ${
                          task.is_completed ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task.id)}
                            className="text-slate-300 hover:text-emerald-500 transition-colors shrink-0 cursor-pointer"
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

                        <div className="flex items-center gap-1.5 shrink-0">
                          {task.priority === 'high' && (
                            <span className="text-[8px] font-bold text-rose-500 uppercase px-1 rounded bg-rose-50 dark:bg-rose-950">
                              Urgent
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </div>
  );
};
