import React from 'react';
import type { FinancialAccount } from '../../api/client';
import { AccountLogo } from '../../utils/bankLogos';
import { Split, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export interface PaymentSplitItem {
  financial_account_id: string;
  amount: number;
}

interface SplitPaymentSelectorProps {
  accounts: FinancialAccount[];
  targetAmount: number;
  singleAccountId: string;
  onSingleAccountChange: (id: string) => void;
  isSplit: boolean;
  onIsSplitChange: (isSplit: boolean) => void;
  splits: PaymentSplitItem[];
  onSplitsChange: (splits: PaymentSplitItem[]) => void;
  label?: string;
  direction?: 'inflow' | 'outflow';
  disabled?: boolean;
  className?: string;
}

export const SplitPaymentSelector: React.FC<SplitPaymentSelectorProps> = ({
  accounts,
  targetAmount,
  singleAccountId,
  onSingleAccountChange,
  isSplit,
  onIsSplitChange,
  splits,
  onSplitsChange,
  label,
  direction = 'outflow',
  disabled = false,
  className = '',
}) => {
  const eligibleAccounts = accounts.filter((a) => !a.is_custom_asset);

  const defaultLabel = direction === 'inflow' ? 'Deposit Into Account' : 'Debit From Account';
  const displayLabel = label || defaultLabel;

  // Total allocated across splits
  const totalAllocated = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const remainingToAllocate = Math.max(0, Math.round((targetAmount - totalAllocated) * 100) / 100);
  const isOverAllocated = totalAllocated > targetAmount + 0.01;
  const isExact = Math.abs(totalAllocated - targetAmount) <= 0.01 && targetAmount > 0;

  // Toggle split mode
  const handleToggleSplit = (enable: boolean) => {
    onIsSplitChange(enable);
    if (enable) {
      if (splits.length === 0) {
        // Initialize with primary account and second available account if present
        const firstId = singleAccountId || (eligibleAccounts[0]?.id ?? '');
        const secondAccount = eligibleAccounts.find((a) => a.id !== firstId);

        if (secondAccount) {
          const half = targetAmount > 0 ? Math.round((targetAmount / 2) * 100) / 100 : 0;
          const remainder = targetAmount > 0 ? Math.round((targetAmount - half) * 100) / 100 : 0;
          onSplitsChange([
            { financial_account_id: firstId, amount: half },
            { financial_account_id: secondAccount.id, amount: remainder },
          ]);
        } else {
          onSplitsChange([
            { financial_account_id: firstId, amount: targetAmount },
          ]);
        }
      }
    } else {
      // Revert to primary account from first split
      if (splits.length > 0 && splits[0].financial_account_id) {
        onSingleAccountChange(splits[0].financial_account_id);
      }
    }
  };

  const handleUpdateSplitAccount = (index: number, accountId: string) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], financial_account_id: accountId };
    onSplitsChange(updated);
  };

  const handleUpdateSplitAmount = (index: number, val: string) => {
    const parsed = parseFloat(val);
    const updated = [...splits];
    updated[index] = {
      ...updated[index],
      amount: isNaN(parsed) ? 0 : Math.max(0, parsed),
    };
    onSplitsChange(updated);
  };

  const handleAddSplitRow = () => {
    const selectedIds = new Set(splits.map((s) => s.financial_account_id));
    const nextAccount = eligibleAccounts.find((a) => !selectedIds.has(a.id)) || eligibleAccounts[0];
    if (!nextAccount) return;

    onSplitsChange([
      ...splits,
      {
        financial_account_id: nextAccount.id,
        amount: remainingToAllocate > 0 ? remainingToAllocate : 0,
      },
    ]);
  };

  const handleRemoveSplitRow = (index: number) => {
    if (splits.length <= 1) return;
    const updated = splits.filter((_, i) => i !== index);
    onSplitsChange(updated);
  };

  const handleAutoFillRemaining = (index?: number) => {
    if (remainingToAllocate <= 0) return;
    const targetIndex = index ?? (splits.length - 1);
    const updated = [...splits];
    if (updated[targetIndex]) {
      updated[targetIndex] = {
        ...updated[targetIndex],
        amount: Math.round(((updated[targetIndex].amount || 0) + remainingToAllocate) * 100) / 100,
      };
      onSplitsChange(updated);
    }
  };

  // Selected single account for icon
  const selectedSingleAccount = eligibleAccounts.find((a) => a.id === singleAccountId);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with Title & Split Toggle */}
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          {isSplit ? 'Split Across Multiple Accounts' : displayLabel}
        </label>

        {eligibleAccounts.length > 1 && !disabled && (
          <button
            type="button"
            onClick={() => handleToggleSplit(!isSplit)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer"
          >
            <Split className="w-3 h-3 rotate-90" />
            <span>{isSplit ? 'Single Account' : '+ Split across accounts'}</span>
          </button>
        )}
      </div>

      {/* Mode A: Single Account Selector */}
      {!isSplit && (
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={singleAccountId}
                onChange={(e) => onSingleAccountChange(e.target.value)}
                disabled={disabled}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 transition-colors"
              >
                {eligibleAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} • {Number(a.current_balance).toLocaleString()} ETB
                  </option>
                ))}
              </select>
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                {selectedSingleAccount ? (
                  <AccountLogo account={selectedSingleAccount} size="xs" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode B: Multi-Account Split Mode */}
      {isSplit && (
        <div className="space-y-2 p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
          {splits.map((split, idx) => {
            const acc = eligibleAccounts.find((a) => a.id === split.financial_account_id);
            return (
              <div key={idx} className="flex items-center gap-2">
                {/* Account Dropdown with Logo */}
                <div className="relative flex-1">
                  <select
                    value={split.financial_account_id}
                    onChange={(e) => handleUpdateSplitAccount(idx, e.target.value)}
                    disabled={disabled}
                    className="w-full h-8.5 pl-8 pr-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {eligibleAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    {acc && <AccountLogo account={acc} size="xs" />}
                  </div>
                </div>

                {/* Amount Input */}
                <div className="relative w-32 shrink-0">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={split.amount || ''}
                    placeholder="0.00"
                    onChange={(e) => handleUpdateSplitAmount(idx, e.target.value)}
                    disabled={disabled}
                    className="w-full h-8.5 px-2 text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono pointer-events-none">
                    ETB
                  </span>
                </div>

                {/* Remove Row Button */}
                {splits.length > 1 && !disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSplitRow(idx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                    title="Remove split account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Action & Status Row */}
          <div className="pt-1.5 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800 text-[11px]">
            {/* Add Row Button */}
            {splits.length < eligibleAccounts.length && !disabled ? (
              <button
                type="button"
                onClick={handleAddSplitRow}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Account</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400">All accounts added</span>
            )}

            {/* Live Balance / Remaining Status */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {totalAllocated.toLocaleString()} / {targetAmount.toLocaleString()} ETB
              </span>

              {isExact ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Exact</span>
                </span>
              ) : isOverAllocated ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                  <AlertCircle className="w-3 h-3" />
                  <span>+{(totalAllocated - targetAmount).toLocaleString()} over</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAutoFillRemaining()}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-100 transition-colors cursor-pointer"
                  title="Click to auto-allocate remaining balance"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>{remainingToAllocate.toLocaleString()} left (fill)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
