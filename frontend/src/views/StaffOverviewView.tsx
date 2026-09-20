import React, { useState, useEffect, useCallback } from 'react';
import type { User, LeaderboardItem, StaffTask } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  TrendingUp,
  Award,
  Sparkles,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ShoppingCart,
  Smartphone,
  Trophy,
  ArrowRight,
  Flame,
  Target,
  Loader2,
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
    <div className="space-y-6 animate-page-enter">
      {/* ── 1. Welcome & Quick Action Hero ── */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-[#1e293b] text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold tracking-wide uppercase border border-emerald-500/30">
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sales Dashboard & Counter Hub</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {user?.name || 'Staff'}!
          </h1>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Ready to close today's deals? Track your units sold, hit your monthly milestone targets, and manage your daily customer follow-ups.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigateTab('counter')}
            className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95"
          >
            <ShoppingCart className="w-4 h-4 text-slate-950" />
            <span>+ Record Sale</span>
          </button>
          <button
            onClick={() => onNavigateTab('inventory')}
            className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 flex items-center gap-1.5"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Check Stock</span>
          </button>
        </div>
      </div>

      {/* ── 2. Sales KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>This Week's Volume</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={userStats.week_volume} /> <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            {userStats.week_count} devices sold
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>This Month's Volume</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            <AnimatedNumber value={userStats.month_volume} /> <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            {userStats.month_count} devices sold
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Weekly Store Rank</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            #{userStats.rank}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            {userStats.rank === 1 ? '🥇 Leading the store!' : 'Top 5 seller'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Pending Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {pendingTasksCount}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            {tasks.length - pendingTasksCount} completed today
          </div>
        </div>
      </div>

      {/* ── 3. Target & Commission Progress Gamification ── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Commission Milestones & Target Tier
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Current Tier:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
              {userStats.bonus_tier}
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Progress to {nextTier.name} ({nextTier.threshold.toLocaleString()} ETB)
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {targetPct}%
            </span>
          </div>

          {/* Milestone Bar */}
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 rounded-full transition-all duration-700 ease-out shadow-xs"
              style={{ width: `${targetPct}%` }}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
            <span>
              {targetDiff > 0 ? (
                <>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{targetDiff.toLocaleString()} ETB</span> more to unlock{' '}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{nextTier.bonus.toLocaleString()} ETB</span> milestone bonus!
                </>
              ) : (
                <span className="text-emerald-500 font-bold">🎉 Maximum Champion Tier achieved this month!</span>
              )}
            </span>

            <div className="flex items-center gap-3">
              {tierTargets.slice(1).map((tier) => (
                <span
                  key={tier.name}
                  className={`flex items-center gap-1 ${
                    currentVolume >= tier.threshold
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-slate-400'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{tier.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Main Grid: Personal Checklist & Weekly Store Leaderboard ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Personal To-Do & Customer Follow-Up List */}
        <div className="lg:col-span-7 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  My Sales Tasks & Follow-ups
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium font-mono">
                {pendingTasksCount} remaining
              </span>
            </div>

            {/* Add Task Input Form */}
            <form onSubmit={handleAddTask} className="mb-4 flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add customer follow-up or device task..."
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
                className="h-9 px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                {isAddingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Add</span>
              </button>
            </form>

            {/* Task Items List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {tasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No tasks on your list yet. Add a reminder or customer follow-up above!
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 group ${
                      task.is_completed
                        ? 'bg-slate-50/60 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/40 text-slate-400'
                        : 'bg-white dark:bg-[#161d2b] border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0"
                      >
                        {task.is_completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>

                      <span
                        className={`text-xs font-medium truncate ${
                          task.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.priority === 'high' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50">
                          Urgent
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 transition-all p-1"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Keep your checklist updated daily</span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">HabeshaBiz OS</span>
          </div>
        </div>

        {/* Right Column: Weekly Store Leaderboard */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/80 mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Weekly Store Leaderboard
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Live Rankings
              </span>
            </div>

            <div className="space-y-2.5">
              {leaderboard.map((item) => {
                const isCurrentUser = item.user_id === user?.id;
                return (
                  <div
                    key={item.user_id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isCurrentUser
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-800/70 shadow-xs'
                        : 'bg-white dark:bg-[#161d2b] border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          item.rank === 1
                            ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 shadow-inner'
                            : item.rank === 2
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                      </div>

                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {isCurrentUser && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.week_count} devices sold
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="font-bold text-xs text-slate-900 dark:text-white">
                        {item.week_volume.toLocaleString()} ETB
                      </div>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-semibold">
                        {item.bonus_tier}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Rankings reset every Monday at 00:00.
            </span>
            <button
              onClick={() => onNavigateTab('sales')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              <span>View My Sales</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
