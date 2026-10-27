import React, { useState, useEffect, useCallback } from 'react';
import type { Debt, FinancialAccount, StaffMember } from '../../api/client';
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
  Sparkles,
} from 'lucide-react';
import { AccountLogo } from '../../utils/bankLogos';
import { SplitPaymentSelector, type PaymentSplitItem } from '../common/SplitPaymentSelector';

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
  const [isSplit, setIsSplit] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitItem[]>([]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [deletingDrawer, setDeletingDrawer] = useState(false);

  // Bonus Offset for Receivables
  const [settleMethod, setSettleMethod] = useState<'account' | 'staff_bonus'>('account');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [loadingStaff, setLoadingStaff] = useState(false);

  const loadStaffWithBonus = useCallback(async () => {
    try {
      setLoadingStaff(true);
      const list = await api.getStaff();
      const withBonus = (list || []).filter((s) => (s.stats?.uncollected_bonus || 0) > 0);
      setStaffList(withBonus);
      if (withBonus.length > 0 && !selectedStaffId) {
        setSelectedStaffId(String(withBonus[0].id));
      }
    } catch (err: any) {
      console.error('Failed to load staff for bonus offset', err);
    } finally {
      setLoadingStaff(false);
    }
  }, [selectedStaffId]);

  useEffect(() => {
    if (showPayForm && settleMethod === 'staff_bonus') {
      loadStaffWithBonus();
    }
  }, [showPayForm, settleMethod, loadStaffWithBonus]);

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
      const effective = (debt as any).effectiveRemaining !== undefined ? (debt as any).effectiveRemaining : debt.remaining_amount;
      setPaymentAmount(String(effective));
      const defaultAcc = accounts.find((a) => a.type === 'bank' || a.type === 'mobile_money') || accounts[0];
      setPaymentAccountId(defaultAcc ? defaultAcc.id : '');
      setIsSplit(false);
      setPaymentSplits([]);
      setReferenceNumber('');
      setNotes('');
      setSettleMethod('account');
      setShowPayForm(false);
    }
  }, [debt, accounts]);

  if (!debt) return null;

  const isReceivable = debt.type === 'receivable';
  const original = parseFloat(String(debt.original_amount)) || 1;
  const paid = parseFloat(String(debt.paid_amount)) || 0;
  const remaining = parseFloat(String(debt.remaining_amount)) || 0;
  const allocOffset = (debt as any).allocatedOffset || 0;
  const effectiveRemaining = (debt as any).effectiveRemaining !== undefined ? (debt as any).effectiveRemaining : remaining;
  const percentPaid = Math.min(100, Math.round(((paid + allocOffset) / original) * 100));

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt || !paymentAmount) return;
    const numAmount = parseFloat(paymentAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (isReceivable && settleMethod === 'staff_bonus') {
      if (!selectedStaffId) {
        toast.error('Please select a staff member whose bonus to apply');
        return;
      }
      try {
        setSettling(true);
        await api.settleDebtPayment(debt.id, {
          amount: numAmount,
          payment_method: 'staff_bonus',
          staff_id: Number(selectedStaffId),
          reference_number: referenceNumber || undefined,
          notes: notes || undefined,
        });

        toast.success('Receivable payment offset against staff bonus', {
          description: `${numAmount.toLocaleString()} ETB applied from staff bonus for ${debt.contact?.name}`,
        });

        setShowPayForm(false);
        if (onPaymentSettled) onPaymentSettled();
        onClose();
      } catch (err: any) {
        toast.error('Failed to record bonus offset', { description: err.message });
      } finally {
        setSettling(false);
      }
      return;
    }

    if (isSplit) {
      const totalAllocated = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      if (Math.abs(totalAllocated - numAmount) > 0.01) {
        toast.error(`Split amounts (${totalAllocated.toLocaleString()} ETB) must equal total payment (${numAmount.toLocaleString()} ETB)`);
        return;
      }
      if (paymentSplits.length === 0 || paymentSplits.some((s) => !s.financial_account_id || s.amount <= 0)) {
        toast.error('All split accounts must have a valid account and amount greater than 0');
        return;
      }
    } else {
      if (!paymentAccountId) {
        toast.error('Please select an account');
        return;
      }
    }

    try {
      setSettling(true);
      await api.settleDebtPayment(debt.id, {
        amount: numAmount,
        financial_account_id: isSplit ? undefined : paymentAccountId,
        payment_splits: isSplit ? paymentSplits : undefined,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
      });

      toast.success(
        isReceivable ? 'Receivable payment collected' : 'Payable settled',
        {
          description: `${numAmount.toLocaleString()} ETB processed with ${debt.contact?.name}`,
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
      title={debt.contact?.name || (isReceivable ? 'Receivable Entry' : 'Payable Entry')}
      subtitle={
        debt.reference_type === 'salesperson_bonus'
          ? 'Sales Agent Upsell Bonus Payout'
          : debt.reference_type === 'handover_holding'
          ? 'Handover Stock Holding'
          : isReceivable
          ? 'Receivable'
          : 'Payable'
      }
      badge={
        <div className="flex items-center gap-1.5">
          {debt.reference_type === 'salesperson_bonus' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80">
              Sales Bonus
            </span>
          )}
          {debt.reference_type === 'handover_holding' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80">
              Handover Stock
            </span>
          )}
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
        </div>
      }
      footerActions={
        <div className="w-full">
          {/* Desktop Action Row (≥ sm) */}
          <div className="hidden sm:flex sm:items-center sm:justify-between sm:w-full gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {/* Delete — only for manual debts with no payments */}
              {debt.reference_type === 'direct_credit' && paid === 0 && (
                <button
                  type="button"
                  onClick={handleDrawerDelete}
                  disabled={deletingDrawer}
                  className="h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0 whitespace-nowrap"
                >
                  {deletingDrawer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Delete</span>
                </button>
              )}

              {effectiveRemaining > 0 && !showPayForm && (
                <button
                  type="button"
                  onClick={() => setShowPayForm(true)}
                  className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>
                    {debt.reference_type === 'salesperson_bonus'
                      ? 'Pay Sales Bonus Now'
                      : isReceivable
                      ? 'Collect Payment Now'
                      : 'Pay Sourcing Partner'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Action Row (< sm) */}
          <div className="flex sm:hidden flex-col gap-2 w-full">
            {effectiveRemaining > 0 && !showPayForm && (
              <button
                type="button"
                onClick={() => setShowPayForm(true)}
                className="w-full h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {debt.reference_type === 'salesperson_bonus'
                    ? 'Pay Sales Bonus'
                    : isReceivable
                    ? 'Collect Payment'
                    : 'Pay Sourcing Partner'}
                </span>
              </button>
            )}

            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center whitespace-nowrap"
              >
                Close
              </button>

              {debt.reference_type === 'direct_credit' && paid === 0 && (
                <button
                  type="button"
                  onClick={handleDrawerDelete}
                  disabled={deletingDrawer}
                  className="flex-1 h-9 px-3 rounded-xl border border-rose-200 dark:border-rose-800/60 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                >
                  {deletingDrawer ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Trash2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
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
          <AnimatedNumber value={effectiveRemaining} />{' '}
          <span className="text-sm font-bold text-slate-400 font-sans">ETB</span>
        </div>

        {allocOffset > 0.01 && (
          <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 font-mono">
            Trade credit applied: −{allocOffset.toLocaleString()} ETB (Gross remaining: {remaining.toLocaleString()} ETB)
          </div>
        )}

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

      {/* Handover Device Holding Context Banner */}
      {debt.reference_type === 'handover_holding' && (
        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 flex items-start gap-2.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-900 dark:text-amber-200 block text-[11px]">
              Handover Device Obligation
            </span>
            <p className="text-amber-800/90 dark:text-amber-300/90 text-[11px] mt-0.5 leading-relaxed">
              Collecting payment here automatically marks the device as sold, logs the sale in your sales history, and realizes your gross profit in reports.
            </p>
          </div>
        </div>
      )}

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

          {isReceivable && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSettleMethod('account')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  settleMethod === 'account'
                    ? 'bg-white dark:bg-[#151b26] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Treasury Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettleMethod('staff_bonus');
                  loadStaffWithBonus();
                }}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  settleMethod === 'staff_bonus'
                    ? 'bg-white dark:bg-[#151b26] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="size-3 text-emerald-500" />
                <span>Staff Bonus Offset</span>
              </button>
            </div>
          )}

          {isReceivable && settleMethod === 'staff_bonus' ? (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Staff Member (with Uncollected Bonus)
              </label>
              {loadingStaff ? (
                <div className="py-2.5 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading staff members...</span>
                </div>
              ) : staffList.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-xs">
                  No staff members currently have uncollected bonuses to offset against.
                </div>
              ) : (
                <select
                  value={selectedStaffId}
                  onChange={(e) => {
                    setSelectedStaffId(e.target.value);
                    const staff = staffList.find((s) => String(s.id) === e.target.value);
                    if (staff) {
                      const maxVal = Math.min(
                        effectiveRemaining,
                        Number(staff.stats?.uncollected_bonus || 0)
                      );
                      setPaymentAmount(String(maxVal));
                    }
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {(s.stats?.uncollected_bonus || 0).toLocaleString()} ETB available bonus
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <SplitPaymentSelector
              accounts={accounts}
              targetAmount={parseFloat(paymentAmount) || 0}
              singleAccountId={paymentAccountId}
              onSingleAccountChange={setPaymentAccountId}
              isSplit={isSplit}
              onIsSplitChange={setIsSplit}
              splits={paymentSplits}
              onSplitsChange={setPaymentSplits}
              direction={isReceivable ? 'inflow' : 'outflow'}
            />
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Payment Amount (ETB)
              </label>
              {isReceivable && settleMethod === 'staff_bonus' && selectedStaffId && (
                <button
                  type="button"
                  onClick={() => {
                    const staff = staffList.find((s) => String(s.id) === selectedStaffId);
                    const maxVal = Math.min(
                      effectiveRemaining,
                      Number(staff?.stats?.uncollected_bonus || 0)
                    );
                    setPaymentAmount(String(maxVal));
                  }}
                  className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Use Max Available
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              max={
                isReceivable && settleMethod === 'staff_bonus' && selectedStaffId
                  ? Math.min(
                      effectiveRemaining,
                      Number(staffList.find((s) => String(s.id) === selectedStaffId)?.stats?.uncollected_bonus || 9999999)
                    )
                  : effectiveRemaining
              }
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transaction Reference
            </label>
            <input
              type="text"
              placeholder={isReceivable && settleMethod === 'staff_bonus' ? 'e.g. BONUS-OFFSET or memo' : 'e.g. CBE-FT-82914 or TeleBirr TxID'}
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes
            </label>
            <input
              type="text"
              placeholder="Optional memo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
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
              <span>
                {settling
                  ? 'Processing...'
                  : isReceivable && settleMethod === 'staff_bonus'
                  ? 'Confirm Bonus Offset'
                  : 'Confirm Payment'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Progressive Section 1: Party Profile */}
      <ProgressiveSection
        title="Party Profile"
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

          {debt.contact && ((debt.contact.open_payable ?? 0) > 0 || (debt.contact.open_receivable ?? 0) > 0) && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Overall Net Position</span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Rec: {Number(debt.contact.open_receivable || 0).toLocaleString()} · Pay: {Number(debt.contact.open_payable || 0).toLocaleString()}
                </span>
              </div>
              <span
                className={`font-mono font-bold text-sm ${
                  (debt.contact.net_balance ?? 0) > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : (debt.contact.net_balance ?? 0) < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500'
                }`}
              >
                {(debt.contact.net_balance ?? 0) > 0 ? '+' : ''}
                {Number(debt.contact.net_balance ?? 0).toLocaleString()} ETB
              </span>
            </div>
          )}
        </div>
      </ProgressiveSection>

      {/* Progressive Section 2: Context & Notes */}
      <ProgressiveSection
        title="Transaction Details"
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

          {/* Settlement / Cancellation Resolution Details */}
          {debt.status === 'settled' || remaining <= 0.009 ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                Settlement Resolution
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5 text-xs leading-relaxed">
                {debt.payments && debt.payments.length > 0 ? (
                  debt.payments.length === 1 ? (
                    `Fully settled on ${new Date(debt.payments[0].payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} via ${debt.payments[0].financial_account?.name || debt.payments[0].reference_number || 'Cash'}${debt.payments[0].notes ? ` (${debt.payments[0].notes})` : ''}`
                  ) : (
                    `Fully settled across ${debt.payments.length} payments (${Number(debt.paid_amount).toLocaleString()} ETB total), final payment on ${new Date(debt.payments[debt.payments.length - 1].payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} via ${debt.payments[debt.payments.length - 1].financial_account?.name || 'Cash'}`
                  )
                ) : (
                  'Fully covered via mutual counterparty offset against opposing obligations'
                )}
              </p>
            </div>
          ) : debt.status === 'cancelled' ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                Cancellation Resolution
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5 text-xs">
                {debt.reference_type === 'handover_holding'
                  ? 'Cancelled via device return back to inventory shelf'
                  : 'Obligation cancelled and voided without cash movement'}
              </p>
            </div>
          ) : debt.status === 'partially_paid' || paid > 0 || allocOffset > 0.01 ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                Settlement Progress
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5 text-xs">
                {Number(debt.paid_amount).toLocaleString()} ETB settled {allocOffset > 0.01 ? `+ ${allocOffset.toLocaleString()} ETB trade credit ` : ''}({percentPaid}% covered). Net remaining: {Number(effectiveRemaining).toLocaleString()} ETB
              </p>
            </div>
          ) : null}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>Reference: {debt.reference_type === 'salesperson_bonus' ? 'Salesperson Upsell Bonus' : debt.reference_type}</span>
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
                  {new Date(debt.due_date) < new Date() && ' • Overdue'}
                </span>
              </div>
            )}
          </div>
        </div>
      </ProgressiveSection>

      {/* Progressive Section 3: Previous Payment History */}
      {debt.payments && debt.payments.length > 0 && (
        <ProgressiveSection
          title="Payment Log"
          icon={<History className="w-4 h-4" />}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {debt.payments.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  {p.financial_account && <AccountLogo account={p.financial_account} size="xs" />}
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white font-mono">
                      {Number(p.amount).toLocaleString()} ETB
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {new Date(p.payment_date).toLocaleDateString()} &bull; {p.financial_account?.name || p.reference_number || 'Cash'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.split_group_id && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/50 dark:border-blue-800/50">
                      Split
                    </span>
                  )}
                  {p.reference_number?.includes('OFFSET-STAFF-BONUS') || p.reference_number?.includes('BONUS-OFFSET') ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/50 dark:border-emerald-800/50 inline-flex items-center gap-1">
                      <Sparkles className="size-2.5 text-emerald-500" />
                      Bonus Offset
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      Cleared
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ProgressiveSection>
      )}
    </SlideOverDrawer>
  );
};
