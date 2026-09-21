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
  Search,
  Users,
  Settings,
  Handshake,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'counter'
  | 'inventory'
  | 'sales'
  | 'partners'
  | 'debts'
  | 'treasury'
  | 'expenses'
  | 'staff';

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
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChangeTab,
  user,
  tenant,
  openDebtsCount,
  onLogout,
  onQuickSwitchUser,
  isOpenMobile,
  onCloseMobile,
  onOpenProfile,
}) => {
  const isOwner = user?.role === 'owner';

  const mainNav: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    shortcut?: string;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, shortcut: '⌘1' },
    { id: 'counter', label: 'Sales', icon: ShoppingCart, shortcut: '⌘2' },
    { id: 'inventory', label: 'Inventory', icon: Smartphone, shortcut: '⌘3' },
    { id: 'sales', label: 'Sales History', icon: Receipt, shortcut: '⌘4' },
    { id: 'partners', label: 'Partners & Brokers', icon: Handshake, shortcut: '⌘5' },
    ...(isOwner
      ? [{ id: 'staff' as NavTab, label: 'Staff & Team', icon: Users, shortcut: '⌘9' }]
      : []),
  ];

  const financeNav: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    shortcut?: string;
  }[] = [
    { id: 'debts', label: 'Debts & Credit', icon: CreditCard, badge: openDebtsCount, shortcut: '⌘6' },
    { id: 'treasury', label: 'Treasury & Cash', icon: Landmark, shortcut: '⌘7' },
    { id: 'expenses', label: 'Expenses & Draws', icon: DollarSign, shortcut: '⌘8' },
  ];

  const sidebarInner = (
    <aside className="w-64 h-full bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between select-none p-3.5 transition-colors">
      <div>
        {/* Brand Header */}
        <div className="px-2 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm tracking-tight">
              HB
            </div>
            <div className="leading-tight">
              <div className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                {tenant?.name || 'HabeshaBiz'}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Business OS</div>
            </div>
          </div>

          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950/60 animate-pulse" />
        </div>

        {/* Quick Search Trigger */}
        <div className="my-3 px-1">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px]">Quick search...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-[10px] font-mono border border-slate-200 dark:border-slate-700 text-slate-500 shadow-xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Navigation Group 1: MAIN MENU */}
        <div className="space-y-0.5">
          <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
            Main Menu
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onChangeTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                <span className={`text-[10px] font-mono ${isActive ? 'text-slate-400 dark:text-slate-600' : 'text-slate-300 dark:text-slate-600'}`}>
                  {item.shortcut}
                </span>
              </button>
            );
          })}
        </div>

        {/* Navigation Group 2: FINANCE & LEDGERS (Owner only) */}
        {isOwner && (
          <div className="space-y-0.5 mt-3 pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
            <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
              Treasury & Ledger
            </div>
            {financeNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onChangeTab(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400 dark:text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                          isActive
                            ? 'bg-emerald-500 dark:bg-emerald-600 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <span className={`text-[10px] font-mono ${isActive ? 'text-slate-400 dark:text-slate-600' : 'text-slate-300 dark:text-slate-600'}`}>
                      {item.shortcut}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Persona & Switcher */}
      <div className="pt-3 border-t border-slate-100/80 dark:border-slate-800/80">
        {/* Quick Role Switcher */}
        <div className="mb-2.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl grid grid-cols-2 gap-1 text-[11px] font-medium">
          <button
            onClick={() => onQuickSwitchUser('yoni@boletech.et')}
            className={`py-1 rounded-lg transition-all ${
              user?.role === 'owner'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Yoni (Owner)
          </button>
          <button
            onClick={() => onQuickSwitchUser('husa@boletech.et')}
            className={`py-1 rounded-lg transition-all ${
              user?.role === 'salesperson'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Husa (Sales)
          </button>
        </div>

        {/* Current User Card */}
        <div className="flex items-center justify-between px-1">
          <div
            onClick={onOpenProfile}
            title="Click to manage account settings & change password"
            className="flex items-center gap-2 cursor-pointer group flex-1 mr-2"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center text-xs font-bold uppercase shadow-xs group-hover:bg-slate-800 transition-colors">
              {user?.name?.slice(0, 2) || 'HB'}
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {user?.name}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium capitalize">
                {user?.role === 'owner' ? 'Owner' : 'Sales Staff'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenProfile && (
              <button
                onClick={onOpenProfile}
                title="Account Settings"
                className="w-7 h-7 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onLogout}
              title="Sign out"
              className="w-7 h-7 rounded-lg border border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0 w-64 h-[calc(100vh-2rem)] sticky top-4 my-4 ml-4">
        {sidebarInner}
      </div>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex p-3">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-64 h-full shadow-2xl animate-modal-enter">
            {sidebarInner}
          </div>
        </div>
      )}
    </>
  );
};
