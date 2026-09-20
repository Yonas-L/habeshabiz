import React, { useState } from 'react';
import type { Debt, FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { ProgressiveSection } from './ProgressiveSection';
import { AnimatedNumber } from '../AnimatedNumber';
import { toast } from 'sonner';
import {
  User,
  Calendar,
  DollarSign,
  Loader2,
  CheckCircle2,
  Clock,
  Send,
  History,
  Trash2,
} from 'lucide-react';

interface DebtDrawerProps {
  debt: Debt | null;
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  onPaymentSettled?: () => void;
  onDebtUpdated?: () => void;
}

export const DebtDrawer: React.FC<DebtDrawerProps> = ({
  debt,
  isOpen,
  onClose,
  accounts,
  onPaymentSettled,
  onDebtUpdated,
}) => {
  const [showPayForm, setShowPayForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [deletingDrawer, setDeletingDrawer] = useState(false);

  const handleDrawerDelete = async () => {
    if (!debt) return;
    try {
      setDeletingDrawer(true);
      await api.deleteDebt(debt.id);
      toast.success('Debt record deleted');
      if (onDebtUpdated) onDebtUpdated();
      onClose();
    } catch (err: any) {
      toast.error('Cannot delete', { description: err.message });
    } finally {
      setDeletingDrawer(false);
    }
  };

  // Initialize payment form when opened
  React.useEffect(() => {
    if (debt) {
      setPaymentAmount(String(debt.remaining_amount));
      const defaultAcc = accounts.find((a) => a.type === 'bank' || a.type === 'mobile_money') || accounts[0];
      setPaymentAccountId(defaultAcc ? defaultAcc.id : '');
      setReferenceNumber('');
      setNotes('');
      setShowPayForm(false);
    }
  }, [debt, accounts]);

  if (!debt) return null;

  const isReceivable = debt.type === 'receivable';
  const original = parseFloat(String(debt.original_amount)) || 1;
  const paid = parseFloat(String(debt.paid_amount)) || 0;
  const remaining = parseFloat(String(debt.remaining_amount)) || 0;
  const percentPaid = Math.min(100, Math.round((paid / original) * 100));

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt || !paymentAmount || !paymentAccountId) return;

    try {
      setSettling(true);
      await api.settleDebtPayment(debt.id, {
        amount: parseFloat(paymentAmount),
        financial_account_id: paymentAccountId,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
      });

      toast.success(
        isReceivable ? 'Customer debt collected' : 'Peer payable settled',
        {
          description: `${parseFloat(paymentAmount).toLocaleString()} ETB processed with ${debt.contact?.name}`,
        }
      );

      setShowPayForm(false);
      if (onPaymentSettled) onPaymentSettled();
      onClose();
    } catch (err: any) {
      toast.error('Failed to record payment', { description: err.message });
    } finally {
      setSettling(false);
    }
  };

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={debt.contact?.name || 'Party Debt'}
      subtitle={isReceivable ? 'Customer Receivable (Money In)' : 'Supplier Payable (Money Out)'}
      badge={
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            debt.status === 'settled'
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              : isReceivable
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
          }`}
        >
          {debt.status === 'settled' ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Clock className="w-3 h-3" />
          )}
          {debt.status.replace(/_/g, ' ').toUpperCase()}
        </span>
      }
      footerActions={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close (Esc)
          </button>

          {/* Delete — only for manual debts with no payments */}
          {debt.reference_type === 'direct_credit' && paid === 0 && (
            <button
              type="button"
              onClick={handleDrawerDelete}
              disabled={deletingDrawer}
              className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {deletingDrawer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete</span>
            </button>
          )}

          {remaining > 0 && !showPayForm && (
            <button
              type="button"
              onClick={() => setShowPayForm(true)}
              className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{isReceivable ? 'Collect Payment Now' : 'Pay Sourcing Partner'}</span>
            </button>
          )}
        </>
      }
    >
      {/* Hero Remaining Obligation Card */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Remaining Obligation
          </span>
          <span className="text-xs font-semibold text-slate-400">{percentPaid}% Settled</span>
        </div>

        <div
          className={`text-3xl font-black font-mono tabular-nums tracking-tight ${
            isReceivable ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
          }`}
        >
          <AnimatedNumber value={remaining} />{' '}
          <span className="text-sm font-bold text-slate-400 font-sans">ETB</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isReceivable ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
            style={{ width: `${percentPaid}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-1">
          <span>Already Paid: {paid.toLocaleString()} ETB</span>
          <span>Original: {original.toLocaleString()} ETB</span>
        </div>
      </div>

      {/* Interactive In-Drawer Settlement Form */}
      {showPayForm && (
        <form
          onSubmit={handleSettle}
          className="p-4 rounded-2xl bg-white dark:bg-[#131926] border-2 border-slate-900 dark:border-slate-100 shadow-md space-y-3.5 animate-collapse-open"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {isReceivable ? 'Collect Customer Payment' : 'Pay Sourcing Partner'}
            </span>
            <button
              type="button"
              onClick={() => setShowPayForm(false)}
              className="text-xs text-slate-400 hover:underline"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Amount (ETB)
            </label>
            <input
              type="number"
              step="0.01"
              max={remaining}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isReceivable ? 'Deposit Into Account (Money In)' : 'Debit From Account (Money Out)'}
            </label>
            <select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
              required
            >
              {accounts.filter((a) => !a.is_custom_asset).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bank Reference / SMS TxID
            </label>
            <input
              type="text"
              placeholder="e.g. CBE-FT-82914 or TeleBirr TxID"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPayForm(false)}
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={settling}
              className="h-8 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5"
            >
              {settling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{settling ? 'Processing...' : 'Confirm Payment'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Progressive Section 1: Party Profile */}
      <ProgressiveSection
        title="Party Profile & Contact"
        icon={<User className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between">
            <span className="text-slate-400">Full Name</span>
            <span className="font-bold text-slate-900 dark:text-white">{debt.contact?.name}</span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between">
            <span className="text-slate-400">Phone Number</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              {debt.contact?.phone || 'No phone recorded'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between">
            <span className="text-slate-400">Ledger Role</span>
            <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
              {debt.contact?.roles?.join(', ') || 'Customer'}
            </span>
          </div>
        </div>
      </ProgressiveSection>

      {/* Progressive Section 2: Context & Notes */}
      <ProgressiveSection
        title="Transaction Context & Memo"
        icon={<Calendar className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 space-y-2 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Originating Note
            </span>
            <p className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">
              {debt.notes || 'Recorded via sales counter credit purchase'}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Reference Type: {debt.reference_type}</span>
              <span>Created: {new Date(debt.created_at).toLocaleDateString()}</span>
            </div>
            {debt.due_date && (
              <div className="flex justify-between">
                <span>Due Date:</span>
                <span
                  className={
                    new Date(debt.due_date) < new Date()
                      ? 'text-rose-600 dark:text-rose-400 font-bold'
                      : 'text-slate-600 dark:text-slate-300 font-semibold'
                  }
                >
                  {new Date(debt.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {new Date(debt.due_date) < new Date() && ' (Overdue)'}
                </span>
              </div>
            )}
          </div>
        </div>
      </ProgressiveSection>

      {/* Progressive Section 3: Previous Payment History */}
      {debt.payments && debt.payments.length > 0 && (
        <ProgressiveSection
          title={`Payment Log (${debt.payments.length})`}
          icon={<History className="w-4 h-4" />}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {debt.payments.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white font-mono">
                    {Number(p.amount).toLocaleString()} ETB
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {new Date(p.payment_date).toLocaleDateString()} &bull; {p.reference_number || 'Cash'}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  Cleared
                </span>
              </div>
            ))}
          </div>
        </ProgressiveSection>
      )}
    </SlideOverDrawer>
  );
};
