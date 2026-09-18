import React from 'react';
import { LayoutDashboard, ShoppingCart, Smartphone, Receipt, CreditCard, Landmark, DollarSign } from 'lucide-react';

export type NavTab = 'overview' | 'counter' | 'inventory' | 'sales' | 'debts' | 'treasury' | 'expenses';

interface NavigationProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  openReceivablesCount?: number;
  openPayablesCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  openReceivablesCount = 0,
  openPayablesCount = 0,
}) => {
  const tabs: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'counter', label: 'Counter POS', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory & IMEIs', icon: Smartphone },
    { id: 'sales', label: 'Sales History', icon: Receipt },
    { id: 'debts', label: 'Debts & Credit', icon: CreditCard, badge: openReceivablesCount + openPayablesCount },
    { id: 'treasury', label: 'Treasury & Accounts', icon: Landmark },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
  ];

  return (
    <nav className="border-b border-slate-200/80 bg-white px-4 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto scrollbar-none py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${
                    isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
