import React, { useState, useRef, useEffect } from 'react';
import type { NavTab } from './Sidebar';
import type { User } from '../api/client';
import { Menu, Plus, Calendar, Sun, Moon, ChevronLeft, ChevronRight, Check } from 'lucide-react';
 
interface TopbarProps {
  activeTab: NavTab;
  user: User | null;
  selectedMonth?: string; // Format: "YYYY-MM"
  onMonthChange?: (month: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenMobileSidebar: () => void;
  onQuickAction?: () => void;
  onOpenProfile?: () => void;
}

const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
  overview: { title: 'Dashboard', subtitle: 'Capital overview and store performance' },
  counter: { title: 'Sales Counter', subtitle: 'Point of sale checkout' },
  inventory: { title: 'Inventory', subtitle: 'Active store devices and catalog' },
  sales: { title: 'Sales History', subtitle: 'Transactions and store profit' },
  partners: { title: 'Vendors', subtitle: 'Suppliers and partner stores' },
  debts: { title: 'Receivable and Payable', subtitle: 'Customer credit and vendor balances' },
  treasury: { title: 'Bank Accounts', subtitle: 'Bank accounts and mobile wallets' },
  expenses: { title: 'Expenses', subtitle: 'Store operational costs and withdrawals' },
  staff: { title: 'Staff', subtitle: 'Team members and access permissions' },
  logs: { title: 'Audit Logs', subtitle: 'System security and audit records' },
  settings: { title: 'Settings', subtitle: 'Business profile and credentials' },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  user,
  selectedMonth = getCurrentMonth(),
  onMonthChange,
  theme = 'light',
  onToggleTheme,
  onOpenMobileSidebar,
  onQuickAction,
  onOpenProfile,
}) => {
  const current = tabTitles[activeTab] || tabTitles.overview;
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Parse current selected year and month
  const [selectedYear, selectedMonthIndex] = (() => {
    const parts = (selectedMonth || getCurrentMonth()).split('-');
    const now = new Date();
    const y = parseInt(parts[0], 10) || now.getFullYear();
    const m = parts[1] !== undefined ? (parseInt(parts[1], 10) || (now.getMonth() + 1)) - 1 : now.getMonth();
    return [y, m];
  })();

  const [viewYear, setViewYear] = useState<number>(selectedYear);

  // Sync viewYear when selectedMonth prop changes externally
  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  // Click outside listener to dismiss popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    if (isMonthPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMonthPickerOpen]);

  const handleSelectMonth = (monthIdx: number) => {
    const formatted = `${viewYear}-${String(monthIdx + 1).padStart(2, '0')}`;
    if (onMonthChange) {
      onMonthChange(formatted);
    }
    setIsMonthPickerOpen(false);
  };

  const handleResetToCurrent = () => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (onMonthChange) {
      onMonthChange(currentMonthStr);
    }
    setViewYear(now.getFullYear());
    setIsMonthPickerOpen(false);
  };

  const displayLabel = `${MONTH_NAMES[selectedMonthIndex]} ${selectedYear}`;

  return (
    <header className="sticky top-0 z-40 h-16 px-4 lg:px-8 flex items-center justify-between bg-[#f6f8fa]/95 dark:bg-[#0b0f17]/95 backdrop-blur-md transition-colors border-b border-slate-200/60 dark:border-slate-800/60 animate-fluid-topbar">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          type="button"
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
        {/* User Persona Pill (Clickable for Account Settings) */}
        {user && (
          <button
            type="button"
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

        {/* Interactive Month Selector Popover */}
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setIsMonthPickerOpen((prev) => !prev)}
            title="Filter by month"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131926] border text-xs font-medium shadow-xs transition-all cursor-pointer ${
              isMonthPickerOpen
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                : 'border-slate-200/80 dark:border-slate-800/90 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${isMonthPickerOpen ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span>{displayLabel}</span>
          </button>

          {/* Month Picker Dropdown */}
          {isMonthPickerOpen && (
            <div className="absolute right-0 mt-2 w-72 p-3.5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
              {/* Year Selector Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y - 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Previous Year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  {viewYear}
                </span>
                <button
                  type="button"
                  onClick={() => setViewYear((y) => y + 1)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Next Year"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-3 gap-1.5 py-3">
                {MONTH_NAMES.map((name, idx) => {
                  const isSelected = selectedYear === viewYear && selectedMonthIndex === idx;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectMonth(idx)}
                      className={`py-2 px-1 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-95'
                      }`}
                    >
                      <span>{name.slice(0, 3)}</span>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>

              {/* Popover Footer (Quick shortcuts) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={handleResetToCurrent}
                  className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
                >
                  This Month (Current)
                </button>
                <button
                  type="button"
                  onClick={() => setIsMonthPickerOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button (Sun / Moon) */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors shadow-xs active:scale-95 cursor-pointer"
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
            type="button"
            onClick={onQuickAction}
            className="h-9 px-3.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            <span>Record Sale</span>
          </button>
        )}
      </div>
    </header>
  );
};

