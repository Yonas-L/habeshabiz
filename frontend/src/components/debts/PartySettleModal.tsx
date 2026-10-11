import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { X, Loader2, Check } from 'lucide-react';
import { SplitPaymentSelector, type PaymentSplitItem } from '../common/SplitPaymentSelector';

interface PartySettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: {
    id: string;
    name: string;
    phone?: string | null;
    totalRemaining: number;
    debtCount: number;
  } | null;
  type: 'receivable' | 'payable';
  accounts: FinancialAccount[];
  onSuccess: () => void;
}

export const PartySettleModal: React.FC<PartySettleModalProps> = ({
  isOpen,
  onClose,
  party,
  type,
  accounts,
  onSuccess,
}) => {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<PaymentSplitItem[]>([]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && party) {
      setAmount(String(party.totalRemaining));
      const defaultAcc = accounts.find((a) => !a.is_custom_asset && (a.type === 'bank' || a.type === 'mobile_money')) || accounts[0];
      setAccountId(defaultAcc ? defaultAcc.id : '');
      setIsSplit(false);
      setSplits([]);
      setReferenceNumber('');
      setNotes('');
    }
  }, [isOpen, party, accounts]);

  if (!isOpen || !party) return null;

  const isReceivable = type === 'receivable';
  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }

    if (numAmount > party.totalRemaining + 0.01) {
      toast.error(`Amount cannot exceed total open balance of ${party.totalRemaining.toLocaleString()} ETB`);
      return;
    }

    if (isSplit) {
      const sumSplits = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      if (Math.abs(sumSplits - numAmount) > 0.01) {
        toast.error(`Split allocation total (${sumSplits.toLocaleString()} ETB) must match payment (${numAmount.toLocaleString()} ETB)`);
        return;
      }
      if (splits.some((s) => !s.financial_account_id || Number(s.amount) <= 0)) {
        toast.error('Each split entry must have an account and amount');
        return;
      }
    } else if (!accountId) {
      toast.error('Please select an account');
      return;
    }

    try {
      setLoading(true);
      const res = await api.settlePartyWaterfall({
        contact_id: party.id,
        type,
        amount: numAmount,
        financial_account_id: isSplit ? undefined : accountId,
        payment_splits: isSplit ? splits : undefined,
        reference_number: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      const settledCount = res.debts.filter((d) => d.status === 'settled').length;
      toast.success(
        isReceivable
          ? `Collected ${numAmount.toLocaleString()} ETB from ${party.name}`
          : `Paid ${numAmount.toLocaleString()} ETB to ${party.name}`,
        {
          description: settledCount > 0
            ? `${settledCount} obligation fully cleared; balances updated.`
            : 'Balance updated across obligations.',
        }
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Settlement failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-[#131926] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isReceivable ? 'Collect Payment' : 'Record Payout'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {party.name} · {party.debtCount} open obligations ({party.totalRemaining.toLocaleString()} ETB)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Payment Amount
              </label>
              <button
                type="button"
                onClick={() => setAmount(String(party.totalRemaining))}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
              >
                Pay Full ({party.totalRemaining.toLocaleString()} ETB)
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={party.totalRemaining}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] font-mono text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
              />
              <span className="absolute right-3.5 top-3 text-xs font-semibold text-slate-400">
                ETB
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Clears oldest obligation first. Excess automatically covers subsequent obligations.
            </p>
          </div>

          {/* Account or Split */}
          <SplitPaymentSelector
            accounts={accounts}
            targetAmount={numAmount}
            singleAccountId={accountId}
            onSingleAccountChange={setAccountId}
            isSplit={isSplit}
            onIsSplitChange={setIsSplit}
            splits={splits}
            onSplitsChange={setSplits}
            direction={isReceivable ? 'inflow' : 'outflow'}
            label={isReceivable ? 'Deposit Into' : 'Disburse From'}
          />

          {/* Reference Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reference (Optional)
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. TXN-12345, Cheque #, Bank slip"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 placeholder:text-slate-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Settlement remarks"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 placeholder:text-slate-400"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`h-9 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center gap-1.5 ${
                isReceivable
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Settling...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isReceivable ? 'Confirm Collection' : 'Confirm Payout'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
