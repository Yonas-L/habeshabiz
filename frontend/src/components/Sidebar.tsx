import React from 'react';
import type { User, Tenant } from '../api/client';
import {
  LayoutDashboard,
  ShoppingCart,
  Smartphone,
  Receipt,
  CreditCard,
  Landmark,
  DollarSign,
  LogOut,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'counter'
  | 'inventory'
  | 'sales'
  | 'debts'
  | 'treasury'
  | 'expenses';

interface SidebarProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  user: User | null;
  tenant: Tenant | null;
  netCapital: number | null;
  openDebtsCount: number;
  onLogout: () => void;
  onQuickSwitchUser: (email: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  user,
  tenant,
  netCapital,
  openDebtsCount,
  onLogout,
  onQuickSwitchUser,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    shortcut?: string;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortcut: '⌘1' },
    { id: 'counter', label: 'Counter POS', icon: ShoppingCart, shortcut: '⌘2' },
    { id: 'inventory', label: 'Inventory & IMEIs', icon: Smartphone, shortcut: '⌘3' },
    { id: 'sales', label: 'Sales History', icon: Receipt, shortcut: '⌘4' },
    { id: 'debts', label: 'Debts & Credit', icon: CreditCard, badge: openDebtsCount, shortcut: '⌘5' },
    { id: 'treasury', label: 'Treasury & Accounts', icon: Landmark, shortcut: '⌘6' },
    { id: 'expenses', label: 'Daily Expenses', icon: DollarSign, shortcut: '⌘7' },
  ];

  const sidebarContent = (
    <aside className="w-64 h-full bg-white border-r border-slate-200/80 flex flex-col justify-between select-none">
      {/* Top: Brand & Workspace */}
      <div>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-semibold text-xs tracking-tight shadow-xs">
              HB
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-slate-900 text-xs tracking-tight">
                {tenant?.name || 'HabeshaBiz'}
              </div>
              <div className="text-[10px] text-slate-400 font-normal">Addis Ababa Retail OS</div>
            </div>
          </div>

          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live</span>
          </span>
        </div>

        {/* Live Net Capital Readout in Sidebar */}
        {netCapital !== null && (
          <div className="mx-3 my-3 p-2.5 rounded-md bg-slate-50 border border-slate-100/90 text-xs">
            <div className="text-[10px] uppercase font-medium tracking-wider text-slate-400">Total Net Capital</div>
            <div className="text-sm font-semibold text-slate-900 font-mono mt-0.5">
              {netCapital.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-[11px] font-normal text-slate-500">ETB</span>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="px-2 py-1 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold leading-none ${
                        isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <span className={`text-[10px] font-mono ${isActive ? 'text-slate-400' : 'text-slate-300'}`}>
                    {item.shortcut}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: User Persona & Switcher */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        {/* Quick Role Switcher for Partner Testing */}
        <div className="mb-2.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1 px-1">
            Test Persona View
          </div>
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-200/60 rounded-md">
            <button
              onClick={() => onQuickSwitchUser('yoni@boletech.et')}
              className={`py-1 text-[11px] font-medium rounded transition-all ${
                user?.role === 'owner' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Yoni (Owner)
            </button>
            <button
              onClick={() => onQuickSwitchUser('husa@boletech.et')}
              className={`py-1 text-[11px] font-medium rounded transition-all ${
                user?.role === 'salesperson' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Husa (Sales)
            </button>
          </div>
        </div>

        {/* Current User Card */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold uppercase">
              {user?.name?.slice(0, 2) || 'HB'}
            </div>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-slate-900 truncate max-w-[110px]">{user?.name}</div>
              <div className="text-[10px] text-slate-400 capitalize">{user?.role}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign out"
            className="w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-white flex items-center justify-center transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0 w-64 h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile Backdrop & Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl animate-modal-enter">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
