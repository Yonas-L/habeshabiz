import React from 'react';
import type { Expense } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { AnimatedNumber } from '../AnimatedNumber';
import { Trash2 } from 'lucide-react';

interface ExpenseDrawerProps {
  expense: Expense | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (expense: Expense) => void;
  canDelete?: boolean;
}

export const ExpenseDrawer: React.FC<ExpenseDrawerProps> = ({
  expense,
  isOpen,
  onClose,
  onDelete,
  canDelete = true,
}) => {
  if (!expense) return null;

  const isOwnerDraw = Boolean(expense.is_owner_draw);

  const getCategoryLabel = (cat: string) => {
    if (isOwnerDraw || cat === 'personal_owner_draw' || cat === 'personal') return 'Personal Draw';
    switch (cat) {
      case 'ride': return 'Ride';
      case 'food': return 'Food';
      case 'rent': return 'Rent';
      case 'maintenance': return 'Maintenance';
      case 'salary': return 'Staff Bonus';
      case 'vendor_payout': return 'Vendor Settlement';
      case 'bank_fee': return 'Bank Fee';
      case 'other': return 'Other';
      default: return cat ? cat.replace(/_/g, ' ') : 'Expense';
    }
  };

  const formattedDate = new Date(expense.date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      widthClass="sm:max-w-md"
      title={expense.description || getCategoryLabel(expense.category)}
      subtitle={`Recorded on ${formattedDate}`}
      badge={
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
            isOwnerDraw
              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          {isOwnerDraw ? 'Personal Draw' : 'Expense'}
        </span>
      }
      footerActions={
        <div className="flex items-center justify-between w-full gap-2">
          {canDelete && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(expense)}
              className="h-9 px-3.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Expense</span>
            </button>
          ) : <div />}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Outflow Amount (clean, prominent, no card-on-card, no border-on-border) */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Amount
          </span>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-1">
            −<AnimatedNumber value={parseFloat(String(expense.amount))} decimals={2} />{' '}
            <span className="text-sm font-semibold text-slate-400 font-sans">ETB</span>
          </div>
        </div>

        {/* Clean Property Details List */}
        <div className="space-y-3.5 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 dark:text-slate-500">Category</span>
            <span className="font-semibold text-slate-900 dark:text-white capitalize">
              {getCategoryLabel(expense.category)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 dark:text-slate-500">Paid From</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {expense.financial_account?.name || 'Cash Drawer'}
            </span>
          </div>

          {expense.vendor_contact && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Vendor / Contact</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {expense.vendor_contact.name}{' '}
                {expense.vendor_contact.phone ? (
                  <span className="text-slate-400 font-mono text-[11px]">({expense.vendor_contact.phone})</span>
                ) : null}
              </span>
            </div>
          )}

          {expense.inventory_unit && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Device</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {expense.inventory_unit.variant?.product?.name || 'Device'}{' '}
                {expense.inventory_unit.imei_or_serial ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    • {expense.inventory_unit.imei_or_serial}
                  </span>
                ) : null}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-slate-400 dark:text-slate-500">Date</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">
              {formattedDate}
            </span>
          </div>
        </div>

        {/* Payment Splits (if multiple accounts used) */}
        {expense.payment_splits && expense.payment_splits.length > 1 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
            <span className="text-xs font-semibold text-slate-900 dark:text-white block">
              Split Funding ({expense.payment_splits.length} Accounts)
            </span>
            <div className="space-y-1.5">
              {expense.payment_splits.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                >
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {s.account_name || 'Account'}
                  </span>
                  <div className="text-right font-mono font-bold text-slate-900 dark:text-white">
                    {Number(s.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    {Number(s.fee || 0) > 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 block font-normal">
                        +{Number(s.fee).toLocaleString()} fee
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description / Memo */}
        {expense.description && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
              Description
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {expense.description}
            </p>
          </div>
        )}
      </div>
    </SlideOverDrawer>
  );
};
