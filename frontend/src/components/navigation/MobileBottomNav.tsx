import React, { useState, useEffect } from 'react';
import type { NavTab } from '../Sidebar';
import {
  ShoppingCart,
  Package,
  CreditCard,
  ArrowDownLeft,
  PackagePlus,
  ArrowLeftRight,
  Receipt,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onOpenDrawer?: () => void;
  openDebtsCount?: number;
  onNewSale?: () => void;
  onRecordExpense?: () => void;
  onStockIntake?: () => void;
  onRecordDebt?: () => void;
  isOwner?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChangeTab,
  openDebtsCount = 0,
  onNewSale,
  onRecordExpense,
  onStockIntake,
  onRecordDebt,
  isOwner = true,
}) => {
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [screenWidth, setScreenWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth || 390;
    }
    return 390;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setScreenWidth(window.innerWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSpeedDial = () => setIsSpeedDialOpen((prev) => !prev);
  const closeSpeedDial = () => setIsSpeedDialOpen(false);

  const handleActionClick = (fn?: () => void, fallbackTab?: NavTab) => {
    closeSpeedDial();
    if (fn) {
      fn();
    } else if (fallbackTab) {
      onChangeTab(fallbackTab);
    }
  };

  /* ─── Exact mathematical inward bended scoop cradle path for edge-to-edge navbar ─── */
  const center = screenWidth / 2;
  const pathD = `
    M 0 50
    A 30 30 0 0 1 30 20
    L ${center - 56} 20
    C ${center - 42} 20, ${center - 36} 26, ${center - 30} 38
    C ${center - 24} 52, ${center - 14} 55, ${center} 55
    C ${center + 14} 55, ${center + 24} 52, ${center + 30} 38
    C ${center + 36} 26, ${center + 42} 20, ${center + 56} 20
    L ${screenWidth - 30} 20
    A 30 30 0 0 1 ${screenWidth} 50
    L ${screenWidth} 150
    L 0 150
    Z
  `;

  return (
    <>
      {/* Semi-transparent Backdrop for Speed Dial */}
      {isSpeedDialOpen && (
        <div
          onClick={closeSpeedDial}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs md:hidden animate-fade-in transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Speed Dial Menu Popover directly above Center Button */}
      {isSpeedDialOpen && (
        <div className="fixed bottom-[calc(5.4rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 md:hidden flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-150 select-none">
          <div className="bg-white/95 dark:bg-[#111C2D]/95 backdrop-blur-md p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl flex flex-col gap-1.5 min-w-[210px]">
            {/* Record Sale */}
            <button
              type="button"
              onClick={() => handleActionClick(onNewSale, 'counter')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-98 transition-all cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span>Record Sale</span>
            </button>

            {/* Add Stock */}
            <button
              type="button"
              onClick={() => handleActionClick(onStockIntake, 'inventory')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-98 transition-all cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <PackagePlus className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span>Add Stock Intake</span>
            </button>

            {/* Record Expense (if owner) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => handleActionClick(onRecordExpense, 'expenses')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-98 transition-all cursor-pointer text-left"
              >
                <span className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
                </span>
                <span>Record Expense</span>
              </button>
            )}

            {/* Record Debt (if owner) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => handleActionClick(onRecordDebt, 'debts')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-98 transition-all cursor-pointer text-left"
              >
                <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-4 h-4 stroke-[2.2]" />
                </span>
                <span>Record Debt</span>
              </button>
            )}

            {/* Sales History */}
            <button
              type="button"
              onClick={() => handleActionClick(undefined, 'sales')}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-98 transition-all cursor-pointer text-left"
            >
              <span className="w-8 h-8 rounded-lg bg-slate-500/15 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4 stroke-[2.2]" />
              </span>
              <span>Sales History</span>
            </button>
          </div>
        </div>
      )}

      {/* Edge-to-Edge Mobile Navigation Bar with Inward Bended Scoop Cradle */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 w-full select-none"
      >
        {/* SVG Responsive Curved Background with Inward Bended Scoop */}
        <div className="absolute inset-0 pointer-events-none w-full h-[150px] -top-[20px] overflow-visible">
          <svg
            viewBox={`0 0 ${screenWidth} 150`}
            width={screenWidth}
            height="150"
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="mNavShadow" x="-5%" y="-15%" width="110%" height="130%">
                <feDropShadow dx="0" dy="-4" stdDeviation="6" floodColor="#000000" floodOpacity="0.06" />
              </filter>
            </defs>
            <path
              d={pathD}
              className="fill-white dark:fill-[#111C2D] stroke-slate-200/90 dark:stroke-slate-800/90"
              strokeWidth="1.2"
              filter="url(#mNavShadow)"
            />
          </svg>
        </div>

        {/* Center Floating Elevated Action Button — Absolutely Centered */}
        <button
          type="button"
          onClick={toggleSpeedDial}
          aria-expanded={isSpeedDialOpen}
          aria-label="Quick Actions Hub"
          className={`absolute left-1/2 -translate-x-1/2 -top-[31px] z-20 size-[58px] rounded-full bg-gradient-to-br from-[#0c4436] via-[#073228] to-[#032019] text-white shadow-xl shadow-emerald-950/40 flex items-center justify-center border border-emerald-400/40 ring-[4px] ring-white dark:ring-[#111C2D] active:scale-90 transition-all cursor-pointer ${
            isSpeedDialOpen ? 'rotate-45' : 'hover:scale-105'
          }`}
        >
          <div className="grid grid-cols-2 gap-1.5 w-6 h-6 place-items-center pointer-events-none">
            <span className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
            <span className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
            <span className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
            <span className="w-2.5 h-2.5 rounded-[3px] bg-white shadow-xs" />
          </div>
        </button>

        {/* Content Row: Symmetrical left & right tab groups */}
        <div className="relative z-10 flex items-center w-full h-[64px] pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))]">
          {/* Left Group (Home, Sell) */}
          <div className="flex-1 flex items-center justify-around pr-6 sm:pr-8 pl-1 sm:pl-2">
            {/* 1. Home Tab */}
            {activeTab === 'overview' ? (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('overview');
                }}
                className="flex flex-col items-center justify-center bg-gradient-to-b from-[#094838] to-[#042d23] text-white rounded-[22px] px-4 py-1.5 min-w-[74px] h-[52px] shadow-sm border border-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.5L2.5 11.2c-.3.3-.5.7-.5 1.1 0 .9.7 1.7 1.7 1.7H5v7c0 .6.4 1 1 1h4v-5h4v5h4c.6 0 1-.4 1-1v-7h1.3c.9 0 1.7-.7 1.7-1.7 0-.4-.2-.8-.5-1.1L12 2.5z" />
                </svg>
                <span className="text-[11px] font-semibold text-white tracking-tight leading-none mt-1">
                  Home
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('overview');
                }}
                className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 active:scale-95 transition-all cursor-pointer min-w-[46px]"
              >
                <svg
                  className="w-[26px] h-[26px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5z" />
                  <path d="M9 21V12h6v9" />
                </svg>
                <span className="text-[11px] font-medium mt-1 leading-none">Home</span>
              </button>
            )}

            {/* 2. Sell Tab */}
            {activeTab === 'counter' ? (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('counter');
                }}
                className="flex flex-col items-center justify-center bg-gradient-to-b from-[#094838] to-[#042d23] text-white rounded-[22px] px-4 py-1.5 min-w-[74px] h-[52px] shadow-sm border border-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <ShoppingCart className="w-6 h-6 stroke-[2.2]" />
                <span className="text-[11px] font-semibold text-white tracking-tight leading-none mt-1">
                  Sell
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('counter');
                }}
                className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 active:scale-95 transition-all cursor-pointer min-w-[46px]"
              >
                <ShoppingCart className="w-[26px] h-[26px] stroke-[1.9]" />
                <span className="text-[11px] font-medium mt-1 leading-none">Sell</span>
              </button>
            )}
          </div>

          {/* Center Spacer to keep gap clear for the 58px button */}
          <div className="w-[58px] shrink-0 pointer-events-none" aria-hidden="true" />

          {/* Right Group (Stock, Sales, Debts) */}
          <div className="flex-1 flex items-center justify-around pl-6 sm:pl-8 pr-1 sm:pr-2">
            {/* 3. Stock Tab */}
            {activeTab === 'inventory' ? (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('inventory');
                }}
                className="flex flex-col items-center justify-center bg-gradient-to-b from-[#094838] to-[#042d23] text-white rounded-[22px] px-4 py-1.5 min-w-[74px] h-[52px] shadow-sm border border-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <Package className="w-6 h-6 stroke-[2.2]" />
                <span className="text-[11px] font-semibold text-white tracking-tight leading-none mt-1">
                  Stock
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('inventory');
                }}
                className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 active:scale-95 transition-all cursor-pointer min-w-[46px]"
              >
                <Package className="w-[26px] h-[26px] stroke-[1.9]" />
                <span className="text-[11px] font-medium mt-1 leading-none">Stock</span>
              </button>
            )}

            {/* 4. Sales Tab */}
            {activeTab === 'sales' ? (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('sales');
                }}
                className="flex flex-col items-center justify-center bg-gradient-to-b from-[#094838] to-[#042d23] text-white rounded-[22px] px-4 py-1.5 min-w-[74px] h-[52px] shadow-sm border border-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="3" width="14" height="18" rx="3" />
                  <path d="M12 17v-4" />
                  <path d="M12 13c-1.5-2-3-1-3 0 0 1.5 2 2 3 2" />
                  <path d="M12 13c1.5-2 3-1 3 0 0 1.5-2 2-3 2" />
                </svg>
                <span className="text-[11px] font-semibold text-white tracking-tight leading-none mt-1">
                  Sales
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('sales');
                }}
                className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 active:scale-95 transition-all cursor-pointer min-w-[46px]"
              >
                <svg
                  className="w-[26px] h-[26px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="3" width="14" height="18" rx="3" />
                  <path d="M12 17v-4" />
                  <path d="M12 13c-1.5-2-3-1-3 0 0 1.5 2 2 3 2" />
                  <path d="M12 13c1.5-2 3-1 3 0 0 1.5-2 2-3 2" />
                </svg>
                <span className="text-[11px] font-medium mt-1 leading-none">Sales</span>
              </button>
            )}

            {/* 5. Debts Tab (with Red Notification Badge) */}
            {activeTab === 'debts' ? (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('debts');
                }}
                className="relative flex flex-col items-center justify-center bg-gradient-to-b from-[#094838] to-[#042d23] text-white rounded-[22px] px-4 py-1.5 min-w-[74px] h-[52px] shadow-sm border border-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <div className="relative">
                  <CreditCard className="w-6 h-6 stroke-[2.2]" />
                  {openDebtsCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white font-mono text-[9px] font-bold flex items-center justify-center leading-none shadow-xs border border-white dark:border-[#111C2D]">
                      {openDebtsCount > 99 ? '99+' : openDebtsCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-white tracking-tight leading-none mt-1">
                  Debts
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeSpeedDial();
                  onChangeTab('debts');
                }}
                className="relative flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 active:scale-95 transition-all cursor-pointer min-w-[46px]"
              >
                <div className="relative">
                  <CreditCard className="w-[26px] h-[26px] stroke-[1.9]" />
                  {openDebtsCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white font-mono text-[9px] font-bold flex items-center justify-center leading-none shadow-xs border border-white dark:border-[#111C2D]">
                      {openDebtsCount > 99 ? '99+' : openDebtsCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium mt-1 leading-none">Debts</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};
