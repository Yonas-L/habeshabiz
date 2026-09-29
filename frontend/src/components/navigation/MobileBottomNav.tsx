import React from 'react';
import type { NavTab } from '../Sidebar';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  CreditCard,
  Menu,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenDrawer: () => void;
  openDebtsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenDrawer,
  openDebtsCount = 0,
}) => {
  const tabs = [
    {
      id: 'overview' as NavTab,
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'counter' as NavTab,
      label: 'Sell',
      icon: ShoppingCart,
    },
    {
      id: 'inventory' as NavTab,
      label: 'Stock',
      icon: Package,
    },
    {
      id: 'debts' as NavTab,
      label: 'Debts',
      icon: CreditCard,
      badge: openDebtsCount,
    },
  ];

  const isMoreActive = ![
    'overview',
    'counter',
    'inventory',
    'debts',
  ].includes(activeTab);

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#101622]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-2 pt-1 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] transition-colors select-none"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center min-w-[60px] h-12 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
                isActive
                  ? 'text-slate-900 dark:text-white font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'
                  }`}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center leading-none shadow-xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-1 leading-none">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-slate-900 dark:bg-white" />
              )}
            </button>
          );
        })}

        {/* More / Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className={`relative flex flex-col items-center justify-center min-w-[60px] h-12 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
            isMoreActive
              ? 'text-slate-900 dark:text-white font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
          }`}
        >
          <div className="relative">
            <Menu
              className={`w-5 h-5 transition-transform ${
                isMoreActive ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'
              }`}
            />
            {isMoreActive && (
              <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#101622]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">
            Menu
          </span>
          {isMoreActive && (
            <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-slate-900 dark:bg-white" />
          )}
        </button>
      </div>
    </nav>
  );
};
