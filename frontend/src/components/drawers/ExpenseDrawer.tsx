import React from 'react';
import type { Expense } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { ProgressiveSection } from './ProgressiveSection';
import { AnimatedNumber } from '../AnimatedNumber';
import {
  Receipt,
  Car,
  Coffee,
  Home,
  Wrench,
  UserMinus,
  DollarSign,
  Landmark,
} from 'lucide-react';

interface ExpenseDrawerProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExpenseDrawer: React.FC<ExpenseDrawerProps> = ({
  expense,
  isOpen,
  onClose,
}) => {
  if (!expense) return null;

  const isOwnerDraw = expense.is_owner_draw;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'ride':
        return <Car className="w-4 h-4 text-slate-600 dark:text-slate-300" />;
      case 'food':
        return <Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'rent':
        return <Home className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'maintenance':
        return <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      case 'personal_owner_draw':
        return <UserMinus className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <DollarSign className="w-4 h-4 text-slate-600 dark:text-slate-300" />;
    }
  };

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={expense.description}
      subtitle={`Recorded on ${new Date(expense.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`}
      badge={
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isOwnerDraw
              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {isOwnerDraw ? <UserMinus className="w-3 h-3" /> : <Receipt className="w-3 h-3" />}
          {isOwnerDraw ? 'Owner Personal Draw' : 'Shop Overhead'}
        </span>
      }
      footerActions={
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-auto"
        >
          Close
        </button>
      }
    >
      {/* Hero Outflow Amount */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Outflow Amount
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-1">
            <AnimatedNumber value={parseFloat(String(expense.amount))} decimals={2} />{' '}
            <span className="text-sm font-bold text-slate-400 font-sans">ETB</span>
          </div>
        </div>

        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center">
          {getCategoryIcon(expense.category)}
        </div>
      </div>

      {/* Progressive Section 1: Classification & Accounting Rule */}
      <ProgressiveSection
        title="Ledger Segregation & Classification"
        icon={<Receipt className="w-4 h-4 text-purple-500" />}
        defaultOpen={true}
      >
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Ledger Classification</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {isOwnerDraw ? 'Owner Personal Draw' : 'Shop Operating Overhead'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Impact on Shop Profit</span>
            <span
              className={`font-semibold ${
                isOwnerDraw ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isOwnerDraw
                ? 'Neutral to Shop Margin'
                : 'Deducted from Net Operating Profit'}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-400">Paid from Account</span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
              <Landmark className="w-3.5 h-3.5 text-slate-400" />
              <span>{expense.financial_account?.name || 'Cash Drawer'}</span>
            </div>
          </div>
        </div>
      </ProgressiveSection>

      {/* Progressive Section 2: Details & Memo */}
      <ProgressiveSection
        title="Voucher Detail & Memo"
        icon={<Receipt className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Purpose
          </span>
          <p className="font-medium text-slate-900 dark:text-white leading-relaxed">
            {expense.description}
          </p>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Category: {expense.category.replace(/_/g, ' ')}</span>
            <span>Date: {new Date(expense.date).toLocaleDateString()}</span>
          </div>
        </div>
      </ProgressiveSection>
    </SlideOverDrawer>
  );
};
