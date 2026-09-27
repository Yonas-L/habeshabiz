import React, { useState, useEffect, useCallback } from 'react';
import type { User, LeaderboardItem, StaffTask } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ShoppingCart,
  Smartphone,
  Trophy,
  ArrowRight,
  Target,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';

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
  const [loading, setLoading] = useState(true);

  // New task input state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'normal' | 'high' | 'low'>('normal');
  const [isAddingTask, setIsAddingTask] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksRes, lbRes] = await Promise.all([
        api.getTasks(),
        api.getLeaderboard(),
      ]);
      setTasks(tasksRes);
      setLeaderboard(lbRes.leaderboard || []);
    } catch (err: any) {
      console.error('Failed to load staff overview data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setIsAddingTask(true);
      const created = await api.createTask({
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle('');
      toast.success('Task added to your daily checklist');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add task');
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleToggleTask = async (id: string) => {
    // Optimistic toggle
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_completed: !t.is_completed } : t))
    );

    try {
      await api.toggleTask(id);
    } catch (err: any) {
      toast.error('Failed to update task');
      loadData(); // Revert
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

  // Find user in leaderboard to get their personal stats
  const userStats = leaderboard.find((item) => item.user_id === user?.id) || {
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
  };

  // Gamified commission targets
  const tierTargets = [
    { name: 'Starter', threshold: 0, bonus: 0 },
    { name: 'Bronze', threshold: 100000, bonus: 1000 },
    { name: 'Silver', threshold: 250000, bonus: 2500 },
    { name: 'Gold Champion', threshold: 500000, bonus: 6000 },
  ];

  const currentVolume = userStats.month_volume;
  let nextTier = tierTargets[1];
  let currentTier = tierTargets[0];

  for (let i = 0; i < tierTargets.length; i++) {
    if (currentVolume >= tierTargets[i].threshold) {
      currentTier = tierTargets[i];
      nextTier = tierTargets[i + 1] || tierTargets[i];
    }
  }

  const targetDiff = Math.max(0, nextTier.threshold - currentVolume);
  const targetPct =
    nextTier.threshold > currentTier.threshold
      ? Math.min(
          100,
          Math.round(
            ((currentVolume - currentTier.threshold) /
              (nextTier.threshold - currentTier.threshold)) *
              100
          )
        )
      : 100;

  const pendingTasksCount = tasks.filter((t) => !t.is_completed).length;

  if (loading) {
    return (
      <div className="space-y-4 animate-page-enter">
        <div className="h-28 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
          ))}
        </div>
        <div className="h-32 rounded-2xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-page-enter">

      {/* ── 1. Quick Action Bar ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {user?.name?.split(' ')[0] || 'Staff'}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {userStats.bonus_tier} · Rank #{userStats.rank} this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('inventory')}
            className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5 hover:border-slate-300 dark:hover:border-slate-700"
          >
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            Stock
          </button>
          <button
            onClick={() => onNavigateTab('counter')}
            className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-[0.98]"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            Record Sale
          </button>
        </div>
      </div>

      {/* ── 2. KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Week</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={userStats.week_volume} />
            <span className="text-[10px] font-medium text-slate-400 ml-1 font-sans">ETB</span>
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">{userStats.week_count} sold</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Month</span>
            <Award className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={userStats.month_volume} />
            <span className="text-[10px] font-medium text-slate-400 ml-1 font-sans">ETB</span>
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">{userStats.month_count} sold</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rank</span>
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
            #{userStats.rank}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
            {userStats.rank === 1 ? '🥇 Top seller' : 'Store ranking'}
          </div>
        </div>

        {/* ── Uncollected Bonus Card ── */}
        <div className={`p-4 rounded-xl border ${(userStats.uncollected_bonus ?? 0) > 0
          ? 'bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/30 border-purple-200/80 dark:border-purple-800/60'
          : 'bg-white dark:bg-[#131926] border-slate-200/80 dark:border-slate-800/80'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Bonus</span>
            <DollarSign className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className={`text-xl font-bold font-mono ${(userStats.uncollected_bonus ?? 0) > 0 ? 'text-purple-700 dark:text-purple-300' : 'text-slate-900 dark:text-white'}`}>
            <AnimatedNumber value={userStats.uncollected_bonus ?? 0} />
            <span className="text-[10px] font-medium text-slate-400 ml-1 font-sans">ETB</span>
          </div>
          <div className="text-[10px] mt-0.5">
            {(userStats.uncollected_bonus ?? 0) > 0 ? (
              <span className="text-purple-600 dark:text-purple-400 font-semibold">Uncollected · ask owner</span>
            ) : (
              <span className="text-slate-400">{(userStats.collected_bonus ?? 0) > 0 ? `${(userStats.collected_bonus ?? 0).toLocaleString()} collected` : 'No bonuses yet'}</span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tasks</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">{pendingTasksCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{tasks.length - pendingTasksCount} done</div>
        </div>
      </div>

      {/* ── 3. Commission Progress ── */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">Commission Tier</span>
          </div>
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{userStats.bonus_tier}</span>
        </div>

        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
            style={{ width: `${targetPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
          <span>
            {targetDiff > 0 ? (
              <>
                <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{targetDiff.toLocaleString()} ETB</span>
                {' '}to {nextTier.name} · <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+{nextTier.bonus.toLocaleString()} ETB bonus</span>
              </>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">🎉 Max tier achieved!</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {tierTargets.slice(1).map((tier) => (
              <span key={tier.name} className={`font-semibold ${currentVolume >= tier.threshold ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`}>
                {tier.name.split(' ')[0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. Tasks & Leaderboard ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Tasks */}
        <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white">Tasks & Follow-ups</span>
            <span className="text-[10px] text-slate-400 font-mono">{pendingTasksCount} pending</span>
          </div>

          <form onSubmit={handleAddTask} className="mb-3 flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add customer follow-up or task..."
              className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white"
            />
            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value as any)}
              className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#182030] text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="normal">Normal</option>
              <option value="high">Urgent</option>
              <option value="low">Low</option>
            </select>
            <button
              type="submit"
              disabled={isAddingTask || !newTaskTitle.trim()}
              className="h-9 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1 disabled:opacity-50"
            >
              {isAddingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </form>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5 flex-1">
            {tasks.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No tasks yet — add a reminder above
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center justify-between gap-3 py-2 px-2 rounded-lg group transition-colors ${
                    task.is_completed
                      ? 'opacity-50'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      className="text-slate-300 hover:text-emerald-500 transition-colors shrink-0"
                    >
                      {task.is_completed
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <Circle className="w-4 h-4" />}
                    </button>
                    <span className={`text-xs font-medium truncate ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {task.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.priority === 'high' && (
                      <span className="text-[9px] font-bold text-rose-500 uppercase">Urgent</span>
                    )}
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-4 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">This Week</span>
            </div>
            <button
              onClick={() => onNavigateTab('sales')}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
            >
              My Sales <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1 flex-1">
            {leaderboard.map((item) => {
              const isCurrentUser = item.user_id === user?.id;
              return (
                <div
                  key={item.user_id}
                  className={`flex items-center justify-between py-2 px-2 rounded-lg ${
                    isCurrentUser
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 text-center text-sm">
                      {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                        {item.name}
                        {isCurrentUser && <span className="text-[10px] text-emerald-600 dark:text-emerald-400">(You)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{item.week_count} sold</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                      {item.week_volume.toLocaleString()}
                      <span className="text-[10px] font-medium text-slate-400 ml-0.5">ETB</span>
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400">{item.bonus_tier}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
