import React from 'react';
import type { NavTab } from './Sidebar';
import type { User } from '../api/client';
import { Menu, Plus, Calendar } from 'lucide-react';

interface TopbarProps {
  activeTab: NavTab;
  user: User | null;
  netCapital: number | null;
  onOpenMobileSidebar: () => void;
  onQuickAction?: () => void;
}

const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
  overview: { title: 'Executive Overview', subtitle: 'Master capital matrix, cashflow trajectory, and trading analytics' },
  counter: { title: 'Point of Sale (POS)', subtitle: 'Internal shop stock and brokered neighbour merchant sales' },
  inventory: { title: 'Inventory & Serialized Units', subtitle: 'IMEI tracking, battery health degradation, and stock valuations' },
  sales: { title: 'Sales Order History', subtitle: 'Every transaction with peer-sourcing attribution and booked margins' },
  debts: { title: 'Credit & Debts Ledger', subtitle: 'Customer receivables collection and peer vendor payable settlements' },
  treasury: { title: 'Treasury & Asset Reserves', subtitle: 'CBE, TeleBirr, Awash, 18k/21k gold holdings, and forex assets' },
  expenses: { title: 'Expenses & Personal Draws', subtitle: 'Operating cost segregation vs owner personal drawings' },
};

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  user,
  netCapital,
  onOpenMobileSidebar,
  onQuickAction,
}) => {
  const current = tabTitles[activeTab];

  return (
    <header className="h-16 px-4 lg:px-8 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
              {current.title}
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
              Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5 font-medium">
            {current.subtitle}
          </p>
        </div>
      </div>

      {/* Right Header Area */}
      <div className="flex items-center gap-3">
        {/* Live Net Capital Readout Pill */}
        {netCapital !== null && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/70 shadow-xs text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 animate-pulse" />
            <span className="text-slate-400 font-medium">Net Capital:</span>
            <span className="font-bold text-slate-900 font-mono">
              {netCapital.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ETB
            </span>
          </div>
        )}

        {/* User Persona Pill */}
        {user && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200/70 shadow-xs text-xs font-semibold text-slate-700">
            <span className={`w-1.5 h-1.5 rounded-full ${user.role === 'owner' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
            <span>{user.name} ({user.role === 'owner' ? 'Owner' : 'Sales'})</span>
          </div>
        )}

        {/* Date Filter Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/70 shadow-xs text-xs text-slate-600 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Active Period: Dec 2025 &bull; Live</span>
        </div>

        {/* New Sale Button */}
        {onQuickAction && (
          <button
            onClick={onQuickAction}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Quick Sale</span>
          </button>
        )}
      </div>
    </header>
  );
};
