import React from 'react';
import type { NavTab } from './Sidebar';
import { Menu, Plus } from 'lucide-react';

interface TopbarProps {
  activeTab: NavTab;
  onOpenMobileSidebar: () => void;
  onQuickAction?: () => void;
  isSyncing?: boolean;
}

const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
  overview: { title: 'Business Overview', subtitle: 'Master capital equation, cashflow, and KPIs' },
  counter: { title: 'Counter POS', subtitle: 'Rapid checkout, internal stock, and brokered neighbour sourcing' },
  inventory: { title: 'Inventory & IMEIs', subtitle: 'Serialized tracking, battery health, and stock valuation' },
  sales: { title: 'Sales History', subtitle: 'All completed orders and peer sourcing attribution' },
  debts: { title: 'Debts & Payables', subtitle: 'Receivables from customers and payables owed to peer shops' },
  treasury: { title: 'Treasury & Accounts', subtitle: 'Bank accounts, mobile money, and wealth preservation assets' },
  expenses: { title: 'Daily Expenses', subtitle: 'Operating costs and owner personal withdrawals' },
};

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  onOpenMobileSidebar,
  onQuickAction,
  isSyncing,
}) => {
  const current = tabTitles[activeTab];

  return (
    <header className="sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 lg:px-8 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-1.5 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div>
          <h1 className="text-sm font-semibold text-slate-900 tracking-tight leading-none">
            {current.title}
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5 font-normal">
            {current.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Sync status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-slate-500 bg-slate-50 border border-slate-200/70 font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
          <span>{isSyncing ? 'Syncing...' : 'PostgreSQL 17'}</span>
        </div>

        {/* Dynamic Context Action Button */}
        {onQuickAction && (
          <button
            onClick={onQuickAction}
            className="h-8 px-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Transaction</span>
            <span className="sm:hidden">New</span>
          </button>
        )}
      </div>
    </header>
  );
};
