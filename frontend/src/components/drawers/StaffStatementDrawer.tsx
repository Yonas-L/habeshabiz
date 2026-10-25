import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  DollarSign,
  Smartphone,
  ShoppingBag,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Send,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { SlideOverDrawer } from './SlideOverDrawer';
import { api } from '../../api/client';
import type {
  StaffMember,
  StaffStatementData,
  FinancialAccount,
} from '../../api/client';

interface StaffStatementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  staffMember: StaffMember | null;
  onBonusSettled?: () => void;
}

export const StaffStatementDrawer: React.FC<StaffStatementDrawerProps> = ({
  isOpen,
  onClose,
  staffMember,
  onBonusSettled,
}) => {
  const [data, setData] = useState<StaffStatementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'bonus' | 'sales' | 'handovers'>('bonus');
  const [expandedBonusIds, setExpandedBonusIds] = useState<Record<string, boolean>>({});

  // Settle Bonus Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [referenceNumber, setReferenceNumber] = useState<string>('BONUS-PAYOUT');
  const [notes, setNotes] = useState<string>('');
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const loadStatement = useCallback(async () => {
    if (!staffMember) return;
    try {
      setLoading(true);
      const res = await api.getStaffStatement(staffMember.id);
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load staff statement', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [staffMember]);

  useEffect(() => {
    if (isOpen && staffMember) {
      loadStatement();
    } else {
      setData(null);
    }
  }, [isOpen, staffMember, loadStatement]);

  const loadAccounts = async () => {
    try {
      const res = await api.getAccounts();
      const valid = [...(res.treasury_accounts || []), ...(res.asset_accounts || [])].filter(
        (a) => a.type === 'bank' || a.type === 'cash' || a.type === 'mobile_money'
      );
      setAccounts(valid);
      if (valid.length > 0 && !selectedAccountId) {
        setSelectedAccountId(valid[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load accounts for bonus payout', err);
    }
  };

  const handleOpenSettleModal = () => {
    if (!data) return;
    const uncollected = data.summary.uncollected_bonus || 0;
    if (uncollected <= 0) {
      toast.info('This staff member has no uncollected bonuses to disburse.');
      return;
    }
    setSettleAmount(String(uncollected));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setReferenceNumber(`BONUS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    setNotes(`Commission bonus payout to ${data.staff.name}`);
    loadAccounts();
    setIsSettleModalOpen(true);
  };

  const handleSubmitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffMember || !data) return;

    const amountNum = parseFloat(settleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid payout amount.');
      return;
    }

    const uncollected = data.summary.uncollected_bonus || 0;
    if (amountNum > uncollected + 0.01) {
      toast.error(
        `Amount cannot exceed total uncollected bonus (${uncollected.toLocaleString()} ETB).`
      );
      return;
    }

    if (!selectedAccountId) {
      toast.error('Please select a payment account to disburse funds from.');
      return;
    }

    const chosenAccount = accounts.find((a) => a.id === selectedAccountId);
    if (chosenAccount && Number(chosenAccount.current_balance) < amountNum) {
      toast.error(
        `Insufficient funds in ${chosenAccount.name}. Available balance: ${Number(chosenAccount.current_balance).toLocaleString()} ETB.`
      );
      return;
    }

    try {
      setIsSubmittingSettle(true);
      await api.settleStaffBonus(staffMember.id, {
        amount: amountNum,
        financial_account_id: selectedAccountId,
        payment_date: paymentDate,
        reference_number: referenceNumber,
        notes: notes,
      });

      toast.success(
        `Successfully disbursed ${amountNum.toLocaleString()} ETB bonus to ${data.staff.name}!`
      );
      setIsSettleModalOpen(false);
      loadStatement();
      onBonusSettled?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disburse bonus.');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!staffMember || !data) return;
    try {
      setIsDownloadingPdf(true);
      const blob = await api.downloadStaffStatementPdf(staffMember.id, { download: true });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Staff_Statement_${data.staff.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Staff Statement PDF downloaded successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download statement PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const toggleBonusExpanded = (id: string) => {
    setExpandedBonusIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!staffMember) return null;

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={staffMember.name}
      subtitle={`Staff Statement & Activity Ledger · ${staffMember.phone || staffMember.email}`}
      widthClass="sm:max-w-4xl"
      badge={
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            staffMember.is_active
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              staffMember.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
            }`}
          />
          {staffMember.is_active ? 'Active' : 'Suspended'}
        </span>
      }
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || loading}
            title="Download corporate PDF statement"
            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isDownloadingPdf ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5 text-slate-500 dark:text-slate-400" />
            )}
            <span className="hidden sm:inline">PDF Statement</span>
          </button>

          {(data?.summary?.uncollected_bonus ?? 0) > 0 && (
            <button
              onClick={handleOpenSettleModal}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shadow-emerald-500/20 active:scale-98"
            >
              <CreditCard className="size-3.5" />
              <span>Settle Bonus</span>
            </button>
          )}
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Generating staff performance & bonus ledger...
            </p>
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Unable to load statement details.
          </div>
        ) : (
          <>
            {/* Financial & Performance Bento Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Uncollected Bonus (Net Owed) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/30 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Bonus Owed
                  </span>
                  <Sparkles className="size-4 text-emerald-500" />
                </div>
                <div className="my-2">
                  <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {(data.summary.uncollected_bonus || 0).toLocaleString()}
                    <span className="text-xs font-sans font-bold ml-1 text-emerald-700/70 dark:text-emerald-400/70">
                      ETB
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase mt-0.5 tracking-tight flex items-center gap-1">
                    <ShieldCheck className="size-3 text-emerald-500" />
                    <span>Protected Bonus</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Independent of custody handovers or trade debts.
                </p>
              </div>

              {/* Card 2: Total Bonus Earned */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Total Earned
                  </span>
                  <DollarSign className="size-4 text-slate-400" />
                </div>
                <div className="my-2">
                  <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {(data.summary.total_bonus_earned || 0).toLocaleString()}
                    <span className="text-xs font-sans font-semibold ml-1 text-slate-400">ETB</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    {(data.summary.collected_bonus || 0).toLocaleString()} ETB paid out
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Cumulative commission milestones achieved.
                </p>
              </div>

              {/* Card 3: Total Closed Sales */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Sales Volume
                  </span>
                  <ShoppingBag className="size-4 text-slate-400" />
                </div>
                <div className="my-2">
                  <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {(data.summary.total_sales_volume || 0).toLocaleString()}
                    <span className="text-xs font-sans font-semibold ml-1 text-slate-400">ETB</span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                    {data.summary.total_sales_count || 0} orders closed
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Point-of-sale customer checkouts credited.
                </p>
              </div>

              {/* Card 4: Devices in Custody */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    In Custody
                  </span>
                  <Smartphone className="size-4 text-slate-400" />
                </div>
                <div className="my-2">
                  <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {data.summary.active_handovers_count || 0}
                    <span className="text-xs font-sans font-semibold ml-1 text-slate-400">units</span>
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                    {(data.summary.active_handovers_value || 0).toLocaleString()} ETB value
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Devices loaned for demonstration or external sales.
                </p>
              </div>
            </div>

            {/* Special Bonus Rule Alert */}
            <div className="p-3.5 rounded-xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 dark:border-purple-800/30 flex items-start gap-3 text-xs text-purple-900 dark:text-purple-200">
              <ShieldCheck className="size-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Autonomous Bonus Protection: </span>
                Staff commission bonuses are strictly isolated from store trade debts and device loans.
                Temporary device handovers to this staff member will{' '}
                <span className="underline decoration-purple-400 font-bold">never auto-deduct</span> or
                diminish their earned commission bonus balance.
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
              <button
                onClick={() => setActiveTab('bonus')}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  activeTab === 'bonus'
                    ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>Bonus Ledger</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-200/60 dark:bg-purple-900/60 font-mono font-bold">
                  {data.bonus_ledger.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('sales')}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  activeTab === 'sales'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShoppingBag className="size-3.5" />
                <span>Sales Closed</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-200/60 dark:bg-emerald-900/60 font-mono font-bold">
                  {data.sales_orders.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('handovers')}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                  activeTab === 'handovers'
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Smartphone className="size-3.5" />
                <span>Device Custody</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-200/60 dark:bg-blue-900/60 font-mono font-bold">
                  {data.handovers.length}
                </span>
              </button>
            </div>

            {/* TAB 1: BONUS LEDGER */}
            {activeTab === 'bonus' && (
              <div className="space-y-3">
                {data.bonus_ledger.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No commission bonuses recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden bg-white dark:bg-[#131926]">
                    {data.bonus_ledger.map((entry) => {
                      const isExpanded = !!expandedBonusIds[entry.id];
                      const isSettled = entry.status === 'settled' || entry.remaining_amount <= 0;

                      return (
                        <div key={entry.id} className="p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Type Pill: Strictly "Bonus", NOT "Payable" */}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                                  <Sparkles className="size-3" />
                                  {entry.type_label || 'Bonus'}
                                </span>

                                {entry.order_number && (
                                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                    #{entry.order_number}
                                  </span>
                                )}

                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isSettled
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                      : entry.status === 'partially_paid'
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                                      : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                                  }`}
                                >
                                  {isSettled
                                    ? 'Settled'
                                    : entry.status === 'partially_paid'
                                    ? 'Partially Paid'
                                    : 'Bonus Earned'}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                {entry.description}
                              </p>

                              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                                <span>
                                  {entry.date
                                    ? new Date(entry.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })
                                    : '—'}
                                </span>
                                {entry.due_date && <span>· Due: {entry.due_date}</span>}
                              </div>
                            </div>

                            {/* Financial Values & Expansion Toggle */}
                            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                              <div className="text-left sm:text-right">
                                <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                  {entry.bonus_amount.toLocaleString()} ETB
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {isSettled ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                      Fully Disbursed
                                    </span>
                                  ) : (
                                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                                      {entry.remaining_amount.toLocaleString()} ETB uncollected
                                    </span>
                                  )}
                                </div>
                              </div>

                              {entry.payments && entry.payments.length > 0 && (
                                <button
                                  onClick={() => toggleBonusExpanded(entry.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                  title="View disbursement records"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Payout History Dropdown */}
                          {isExpanded && entry.payments && entry.payments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl space-y-2">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                <CreditCard className="size-3" />
                                <span>Disbursement Transactions</span>
                              </div>
                              <div className="space-y-1.5">
                                {entry.payments.map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center justify-between text-xs font-mono bg-white dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60"
                                  >
                                    <div>
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        -{p.amount.toLocaleString()} ETB
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400 ml-2">
                                        via {p.account_name || 'Treasury'}
                                      </span>
                                      {p.reference_number && (
                                        <span className="text-slate-400 ml-1.5">
                                          ({p.reference_number})
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                      {p.payment_date
                                        ? new Date(p.payment_date).toLocaleDateString()
                                        : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CLOSED SALES ORDERS */}
            {activeTab === 'sales' && (
              <div className="space-y-3">
                {data.sales_orders.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No customer sales orders closed yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden bg-white dark:bg-[#131926]">
                    {data.sales_orders.map((sale) => (
                      <div key={sale.id} className="p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                                #{sale.order_number}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                · {sale.customer_name}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  sale.payment_status === 'paid'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {sale.payment_status === 'paid' ? 'Paid' : 'Credit / Partial'}
                              </span>
                            </div>

                            {/* Sold Devices List */}
                            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 space-y-0.5">
                              {sale.items.map((it, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <span>{it.name}</span>
                                  {it.imei && (
                                    <span className="font-mono text-[10px] text-slate-400">
                                      (SN: {it.imei})
                                    </span>
                                  )}
                                  <span className="font-mono text-slate-400 ml-1">
                                    · {it.unit_price.toLocaleString()} ETB
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="text-[10px] text-slate-400 font-mono mt-1">
                              {sale.order_date
                                ? new Date(sale.order_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                              {sale.total_amount.toLocaleString()} ETB
                            </div>
                            {sale.bonus_amount > 0 && (
                              <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold mt-0.5 flex items-center gap-1 sm:justify-end">
                                <Sparkles className="size-3" />
                                <span>+{sale.bonus_amount.toLocaleString()} ETB Bonus</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DEVICE CUSTODY (HANDOVERS) */}
            {activeTab === 'handovers' && (
              <div className="space-y-3">
                {data.handovers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No devices currently out in staff custody.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden bg-white dark:bg-[#131926]">
                    {data.handovers.map((unit) => (
                      <div key={unit.id} className="p-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {unit.device_name}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  unit.status === 'out'
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                                    : unit.status === 'sold'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {unit.status === 'out'
                                  ? 'In Custody'
                                  : unit.status === 'sold'
                                  ? 'Sold by Staff'
                                  : unit.status}
                              </span>
                            </div>

                            {unit.imei_or_serial && (
                              <div className="text-[11px] font-mono text-slate-400">
                                SN/IMEI: {unit.imei_or_serial}
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                              <span>
                                Handed out:{' '}
                                {unit.handed_out_at
                                  ? new Date(unit.handed_out_at).toLocaleDateString()
                                  : '—'}
                              </span>
                              {unit.return_deadline && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  Return by: {unit.return_deadline}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            {unit.handover_payout > 0 && (
                              <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                Value: {unit.handover_payout.toLocaleString()} ETB
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400">
                              {unit.location || 'Staff custody'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Settle Bonus Modal */}
      {isSettleModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CreditCard className="size-4 text-emerald-600" />
                  <span>Settle Commission Bonus</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Disburse bonus payment to {data?.staff.name}
                </p>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitSettle} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Payout Amount (ETB)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={data?.summary?.uncollected_bonus || 9999999}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => setSettleAmount(String(data?.summary.uncollected_bonus || 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]"
                  >
                    Max
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Total uncollected balance: {(data?.summary.uncollected_bonus || 0).toLocaleString()} ETB
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Disburse From Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} · ({Number(acc.current_balance).toLocaleString()} ETB)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Reference #
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                    placeholder="e.g. CBE-TXN-123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  placeholder="Optional memo..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSubmittingSettle ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SlideOverDrawer>
  );
};
