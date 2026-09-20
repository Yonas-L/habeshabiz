import React from 'react';
import type { NavTab } from './Sidebar';
import type { User } from '../api/client';
import { Menu, Plus, Calendar, Sun, Moon } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

interface TopbarProps {
  activeTab: NavTab;
  user: User | null;
  netCapital: number | null;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenMobileSidebar: () => void;
  onQuickAction?: () => void;
  onOpenProfile?: () => void;
}

const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
  overview: { title: 'Overview', subtitle: 'Capital, performance & obligations' },
  counter: { title: 'Sales', subtitle: 'Record a sale' },
  inventory: { title: 'Inventory', subtitle: 'Stock on hand' },
  sales: { title: 'Sales History', subtitle: 'Transactions & margins' },
  debts: { title: 'Debts & Credit', subtitle: 'Receivables & payables' },
  treasury: { title: 'Treasury', subtitle: 'Accounts & reserves' },
  expenses: { title: 'Expenses', subtitle: 'Costs & owner draws' },
  staff: { title: 'Staff & Team', subtitle: 'Manage team, accounts & audit log' },
};

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  user,
  netCapital,
  theme = 'light',
  onToggleTheme,
  onOpenMobileSidebar,
  onQuickAction,
  onOpenProfile,
}) => {
  const current = tabTitles[activeTab] || tabTitles.overview;

  return (
    <header className="h-16 px-4 lg:px-8 flex items-center justify-between transition-colors bg-transparent">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 shadow-xs"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
            {current.title}
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block mt-0.5 font-medium">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Right Header Area */}
      <div className="flex items-center gap-3">
        {/* Live Net Capital Readout Pill (Only visible to Owner) */}
        {netCapital !== null && user?.role === 'owner' && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-xs text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-950/60 animate-pulse" />
            <span className="text-slate-400 dark:text-slate-500 font-medium">Net Capital:</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">
              <AnimatedNumber value={netCapital} /> ETB
            </span>
          </div>
        )}

        {/* User Persona Pill (Clickable for Account Settings) */}
        {user && (
          <button
            onClick={onOpenProfile}
            title="Manage account details & password"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-xs text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                user.role === 'owner' ? 'bg-purple-500' : 'bg-emerald-500'
              }`}
            />
            <span>{user.name} ({user.role === 'owner' ? 'Owner' : 'Sales'})</span>
          </button>
        )}

        {/* Date Filter Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-xs text-xs text-slate-600 dark:text-slate-400 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>December 2025</span>
        </div>

        {/* Theme Toggle Button (Sun / Moon) */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-xs active:scale-95"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        )}

        {/* New Sale Button */}
        {onQuickAction && (
          <button
            onClick={onQuickAction}
            className="h-9 px-3.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            <span>+ Record Sale</span>
          </button>
        )}
      </div>
    </header>
  );
};
