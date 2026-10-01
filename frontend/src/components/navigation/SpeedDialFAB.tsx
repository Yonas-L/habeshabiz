import React, { useState } from 'react';
import {
  Plus,
  ShoppingCart,
  ArrowDownLeft,
  PackagePlus,
  X,
} from 'lucide-react';

interface SpeedDialFABProps {
  onNewSale: () => void;
  onRecordExpense: () => void;
  onStockIntake: () => void;
  isOwner?: boolean;
}

export const SpeedDialFAB: React.FC<SpeedDialFABProps> = ({
  onNewSale,
  onRecordExpense,
  onStockIntake,
  isOwner = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen((prev) => !prev);
  const handleClose = () => setIsOpen(false);

  const actions = [
    {
      id: 'sale',
      label: 'Record Sale',
      icon: ShoppingCart,
      onClick: () => {
        handleClose();
        onNewSale();
      },
      colorClass: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900',
    },
    ...(isOwner
      ? [
          {
            id: 'expense',
            label: 'Record Expense',
            icon: ArrowDownLeft,
            onClick: () => {
              handleClose();
              onRecordExpense();
            },
            colorClass: 'bg-rose-600 text-white',
          },
        ]
      : []),
    {
      id: 'intake',
      label: 'Stock Intake',
      icon: PackagePlus,
      onClick: () => {
        handleClose();
        onStockIntake();
      },
      colorClass: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <>
      {/* Semi-transparent Backdrop for outside taps */}
      {isOpen && (
        <div
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-2xs md:hidden animate-fade-in transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Floating Action Button & Speed-Dial Container */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 md:hidden flex flex-col items-end gap-3 select-none">
        {/* Speed-Dial Sub-Actions */}
        {isOpen && (
          <div className="flex flex-col items-end gap-2.5 animate-speed-dial">
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.onClick}
                  aria-label={act.label}
                  className="flex items-center gap-2.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <span className="px-2.5 py-1 rounded-lg bg-white/95 dark:bg-[#131926]/95 border border-slate-200/80 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-md">
                    {act.label}
                  </span>
                  <span
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg ${act.colorClass}`}
                  >
                    <Icon className="w-5 h-5 stroke-[2]" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Primary FAB Trigger Button */}
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={isOpen}
          aria-label="Quick Actions Hub"
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 cursor-pointer active:scale-90 ${
            isOpen
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 rotate-90 scale-95'
              : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:scale-105'
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6 stroke-[2.25]" />
          ) : (
            <Plus className="w-7 h-7 stroke-[2.25]" />
          )}
        </button>
      </div>
    </>
  );
};
