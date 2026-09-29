import React from 'react';
import type { NavTab } from '../Sidebar';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  CreditCard,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenDrawer?: () => void;
  openDebtsCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
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
      id: 'sales' as NavTab,
      label: 'Sales',
      icon: Receipt,
    },
    {
      id: 'debts' as NavTab,
      label: 'Debts',
      icon: CreditCard,
      badge: openDebtsCount,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#101622]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-2 pt-1.5 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] transition-colors select-none"
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
              className="relative flex flex-col items-center justify-center min-w-[56px] h-12 transition-all duration-150 active:scale-95 cursor-pointer group"
            >
              <div
                className={`relative w-10 h-7.5 rounded-[8px] transition-all duration-200 flex items-center justify-center ${
                  isActive
                    ? 'bg-slate-900 text-emerald-400 dark:bg-slate-800 dark:text-emerald-400 shadow-sm ring-1 ring-slate-900/10 dark:ring-white/10'
                    : 'bg-transparent text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-105 stroke-[2.25]' : 'stroke-[1.75]'
                  }`}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center leading-none shadow-xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 leading-none transition-colors ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
