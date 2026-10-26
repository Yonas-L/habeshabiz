import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { StaffStatementData, FinancialAccount, User, StaffMember } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Check,
  Printer,
  Phone,
  Pencil,
  Package,
  ArrowRightLeft,
  Receipt,
  Search,
  CreditCard,
  Send,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { formatLocalDate } from '../utils/dateUtils';
import { SplitPaymentSelector, type PaymentSplitItem } from '../components/common/SplitPaymentSelector';

interface StaffDetailViewProps {
  staffId: number;
  user?: User | null;
  onBack: () => void;
  onEditStaff?: (member: StaffMember) => void;
  onStaffUpdated?: () => void;
}

type DateRangeFilter = 'all' | 'this_month' | 'last_month' | 'last_30_days' | 'custom';
type DashboardTab = 'statement' | 'sales' | 'handovers';

interface FlattenedLedgerRow {
  id: string;
  rawDate: string;
  formatted_date: string;
  type: 'bonus' | 'payment_sent';
  type_label: string;
  context: string;
  order_number?: string | null;
  payable: number;
  receivable: number;
  running_balance: number;
}

export const StaffDetailView: React.FC<StaffDetailViewProps> = ({
  staffId,
  user: _user,
  onBack,
  onEditStaff,
  onStaffUpdated,
}) => {
  const [statementData, setStatementData] = useState<StaffStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('statement');

  // Date filtering
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Search filter inside ledger
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Modals & Copy
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Settle Bonus Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<PaymentSplitItem[]>([]);
  const [paymentDate, setPaymentDate] = useState<string>(formatLocalDate(new Date()));
  const [referenceNumber, setReferenceNumber] = useState<string>('BONUS-PAYOUT');
  const [notes, setNotes] = useState<string>('');
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  const isOwner = _user?.role === 'owner';

  const loadStatement = useCallback(async () => {
    try {
      setLoading(true);
      let startDate: string | undefined;
      let endDate: string | undefined;

      const now = new Date();
      if (dateFilter === 'this_month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = formatLocalDate(firstDay);
        endDate = formatLocalDate(now);
      } else if (dateFilter === 'last_month') {
        const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
        startDate = formatLocalDate(firstDayPrev);
        endDate = formatLocalDate(lastDayPrev);
      } else if (dateFilter === 'last_30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = formatLocalDate(thirtyDaysAgo);
        endDate = formatLocalDate(now);
      } else if (dateFilter === 'custom') {
        if (customStartDate) startDate = customStartDate;
        if (customEndDate) endDate = customEndDate;
      }

      const res = await api.getStaffStatement(staffId, {
        start_date: startDate,
        end_date: endDate,
      });

      setStatementData(res);
    } catch (err: any) {
      toast.error('Failed to load staff statement', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [staffId, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    loadStatement();
  }, [loadStatement]);

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
    if (!statementData) return;
    const uncollected = statementData.summary.uncollected_bonus || 0;
    if (uncollected <= 0) {
      toast.info('This staff member has no uncollected bonuses to disburse.');
      return;
    }
    setSettleAmount(String(uncollected));
    setIsSplit(false);
    setSplits([]);
    setPaymentDate(formatLocalDate(new Date()));
    setReferenceNumber(`BONUS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    setNotes(`Commission bonus payout to ${statementData.staff.name}`);
    loadAccounts();
    setIsSettleModalOpen(true);
  };

  const handleSubmitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementData) return;

    const amountNum = parseFloat(settleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid payout amount.');
      return;
    }

    const uncollected = statementData.summary.uncollected_bonus || 0;
    if (amountNum > uncollected + 0.01) {
      toast.error(`Amount cannot exceed total uncollected bonus (${uncollected.toLocaleString()} ETB).`);
      return;
    }

    if (isSplit) {
      const sumSplits = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      if (Math.abs(sumSplits - amountNum) > 0.01) {
        toast.error(`Split allocation total (${sumSplits.toLocaleString()} ETB) must match payout (${amountNum.toLocaleString()} ETB).`);
        return;
      }
      if (splits.some((s) => !s.financial_account_id || Number(s.amount) <= 0)) {
        toast.error('Each split entry must have an account and amount greater than 0.');
        return;
      }
    } else {
      if (!selectedAccountId) {
        toast.error('Please select an account to disburse funds from.');
        return;
      }

      const chosenAccount = accounts.find((a) => a.id === selectedAccountId);
      if (chosenAccount && Number(chosenAccount.current_balance) < amountNum) {
        toast.error(
          `Insufficient funds in ${chosenAccount.name}. Available balance: ${Number(chosenAccount.current_balance).toLocaleString()} ETB.`
        );
        return;
      }
    }

    try {
      setIsSubmittingSettle(true);
      await api.settleStaffBonus(staffId, {
        amount: amountNum,
        financial_account_id: isSplit ? undefined : selectedAccountId,
        payment_splits: isSplit ? splits : undefined,
        payment_date: paymentDate,
        reference_number: referenceNumber,
        notes: notes,
      });

      toast.success(`Successfully disbursed ${amountNum.toLocaleString()} ETB bonus to ${statementData.staff.name}!`);
      setIsSettleModalOpen(false);
      loadStatement();
      onStaffUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disburse bonus.');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!statementData) return;
    try {
      setIsDownloadingPdf(true);
      const blob = await api.downloadStaffStatementPdf(staffId, { download: true });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Staff_Statement_${statementData.staff.name.replace(/\s+/g, '_')}_${formatLocalDate(new Date())}.pdf`;
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

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Build a true running-balance chronological ledger matching the partner statement structure
  const chronologicalLedger = useMemo(() => {
    if (!statementData) return [];

    const rawEvents: Array<{
      id: string;
      date: string;
      type: 'bonus' | 'payment_sent';
      type_label: string;
      context: string;
      order_number?: string | null;
      payable: number;
      receivable: number;
    }> = [];

    // Add each bonus entry
    statementData.bonus_ledger.forEach((b) => {
      rawEvents.push({
        id: `bonus-${b.id}`,
        date: b.date || '',
        type: 'bonus',
        type_label: 'Bonus',
        context: b.description,
        order_number: b.order_number,
        payable: b.bonus_amount,
        receivable: 0,
      });

      // Add each payout associated with this bonus
      (b.payments || []).forEach((p) => {
        rawEvents.push({
          id: `payout-${p.id}`,
          date: p.payment_date || b.date || '',
          type: 'payment_sent',
          type_label: 'Bonus Payout',
          context: `Disbursed to ${statementData.staff.name}${p.account_name ? ` via ${p.account_name}` : ''}${p.reference_number ? ` (${p.reference_number})` : ''}`,
          order_number: b.order_number,
          payable: 0,
          receivable: -p.amount,
        });
      });
    });

    // Sort ascending by date to compute accurate running balance
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    const rowsWithBalance: FlattenedLedgerRow[] = rawEvents.map((ev) => {
      // In staff bonus ledger: payable adds to what store owes staff, receivable (payout) settles it down
      if (ev.type === 'bonus') {
        running += ev.payable;
      } else {
        running -= Math.abs(ev.receivable);
      }

      const d = ev.date ? new Date(ev.date) : new Date();
      const formattedDate = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return {
        id: ev.id,
        rawDate: ev.date,
        formatted_date: formattedDate,
        type: ev.type,
        type_label: ev.type_label,
        context: ev.context,
        order_number: ev.order_number,
        payable: ev.payable,
        receivable: ev.receivable,
        running_balance: running,
      };
    });

    // For display, present newest first (or chronological)
    return rowsWithBalance.reverse();
  }, [statementData]);

  // Filter ledger rows by search
  const filteredLedger = useMemo(() => {
    if (!ledgerSearch.trim()) return chronologicalLedger;
    const term = ledgerSearch.toLowerCase();
    return chronologicalLedger.filter((r) => {
      return (
        r.context.toLowerCase().includes(term) ||
        r.type_label.toLowerCase().includes(term) ||
        (r.order_number && r.order_number.toLowerCase().includes(term))
      );
    });
  }, [chronologicalLedger, ledgerSearch]);

  if (loading && !statementData) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  if (!statementData) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-500 text-sm">Staff member records could not be loaded.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          Return to Staff List
        </button>
      </div>
    );
  }

  const { staff, summary, sales_orders, handovers } = statementData;
  const uncollectedBonus = summary.uncollected_bonus || 0;
  const hasUncollected = uncollectedBonus > 0;

  const rangeLabel =
    dateFilter === 'all'
      ? 'All Historical Records'
      : dateFilter === 'this_month'
      ? 'This Month'
      : dateFilter === 'last_month'
      ? 'Last Month'
      : dateFilter === 'last_30_days'
      ? 'Last 30 Days'
      : `${customStartDate || 'Start'} to ${customEndDate || 'End'}`;

  return (
    <div className="space-y-5 animate-page-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Back to Staff List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-center font-black text-sm shadow-xs uppercase">
              {staff.name.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {staff.name}
                </h1>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    staff.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                {staff.phone && (
                  <button
                    onClick={() => handleCopyPhone(staff.phone!)}
                    className="inline-flex items-center gap-1 font-mono hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{staff.phone}</span>
                    {copiedPhone ? (
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                )}
                <span>·</span>
                <span className="capitalize">{staff.role}</span>
                {staff.email && (
                  <>
                    <span>·</span>
                    <span className="text-slate-400">{staff.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onEditStaff && (
            <button
              type="button"
              onClick={() =>
                onEditStaff({
                  id: staff.id,
                  name: staff.name,
                  email: staff.email,
                  phone: staff.phone,
                  role: staff.role,
                  is_active: staff.is_active,
                  created_at: staff.created_at || '',
                  stats: {
                    sales_count_week: 0,
                    sales_volume_week: 0,
                    sales_count_month: summary.total_sales_count,
                    sales_volume_month: summary.total_sales_volume,
                    uncollected_bonus: summary.uncollected_bonus,
                    collected_bonus: summary.collected_bonus,
                    total_bonus_earned: summary.total_bonus_earned,
                    last_sale_at: null,
                  },
                })
              }
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Edit Staff Member"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit</span>
            </button>
          )}

          {hasUncollected && isOwner && (
            <button
              type="button"
              onClick={handleOpenSettleModal}
              className="h-9 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-rose-600/20"
              title="Disburse earned commission bonus"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Settle Bonus</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            title="Download corporate PDF statement"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* ── Date Range Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('this_month')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'this_month'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateFilter('last_month')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'last_month'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setDateFilter('last_30_days')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'last_30_days'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateFilter('custom')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'custom'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Custom Range
          </button>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* ── Financial Position: Matching Bilateral Net Balance Hero Card (Desktop >= sm) ── */}
      <div
        className={`hidden sm:block rounded-2xl border p-5 sm:p-6 shadow-xs transition-all ${
          hasUncollected
            ? 'bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 dark:from-rose-950/30 dark:via-[#131926] dark:to-[#131926] border-rose-200/90 dark:border-rose-900/60'
            : 'bg-white dark:bg-[#131926] border-slate-200/80 dark:border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Left Column: Focused Net Balance */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Commission Bonus Position
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  hasUncollected
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                    : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hasUncollected ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                {hasUncollected ? 'Store Owes Staff' : 'Settled In Full'}
              </span>
            </div>

            <div
              className={`text-3xl sm:text-4xl font-black font-mono tracking-tight tabular-nums flex items-baseline gap-1.5 ${
                hasUncollected
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              <span>{hasUncollected ? '−' : ''}</span>
              <AnimatedNumber value={uncollectedBonus} />
              <span className="text-xs font-semibold font-sans text-slate-400 dark:text-slate-500">
                ETB
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
              <span className={hasUncollected ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}>
                {hasUncollected
                  ? `Your shop owes this commission bonus to ${staff.name}.`
                  : `All earned bonuses with ${staff.name} are fully disbursed.`}
              </span>
              <span>·</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {rangeLabel}
              </span>
            </div>

            <div className="pt-1 flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Autonomous Bonus Protection: Isolated from custody handovers & trade debts.</span>
            </div>
          </div>

          {/* Right Column: Micro-Stats Boxes */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200/70 dark:border-slate-800/80 md:pl-5 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-center min-w-[95px] shadow-2xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                Bonus Paid
              </span>
              <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {(summary.collected_bonus || 0).toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">ETB</span>
              </span>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-center min-w-[95px] shadow-2xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                Total Sales
              </span>
              <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {(summary.total_sales_volume || 0).toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">ETB</span>
              </span>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-center min-w-[95px] shadow-2xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                Held Handover
              </span>
              <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {(summary.active_handovers_value || 0).toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-400">ETB</span>
              </span>
              <span className="text-[9px] text-slate-400 block">
                {summary.active_handovers_count || 0} {summary.active_handovers_count === 1 ? 'unit' : 'units'} in custody
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Minimal Amount on Top Strip (< sm) ── */}
      <div className="sm:hidden flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131926] shadow-2xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Bonus Payable
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className={`text-2xl font-black font-mono tracking-tight tabular-nums ${
                hasUncollected
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {hasUncollected ? '−' : ''}
              <AnimatedNumber value={uncollectedBonus} />
            </span>
            <span className="text-[10px] font-semibold text-slate-400">ETB</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-flex items-center gap-1.5 ${
              hasUncollected
                ? 'bg-black text-white border border-rose-500/40'
                : 'bg-black text-white border border-emerald-500/40'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasUncollected ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span>{hasUncollected ? 'Store Owes Staff' : 'Settled In Full'}</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Paid: {(summary.collected_bonus || 0).toLocaleString()} ETB
          </span>
        </div>
      </div>

      {/* ── Sub-Tabs Navigation Strip ── */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('statement')}
          className={`pb-2.5 px-3.5 transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'statement'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Statement & Ledger</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'statement'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {chronologicalLedger.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-2.5 px-3.5 transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'sales'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Sales Closed</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'sales'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {sales_orders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('handovers')}
          className={`pb-2.5 px-3.5 transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'handovers'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Handovers Out</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'handovers'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            {handovers.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: STATEMENT & LEDGER BREAKDOWN ── */}
      {activeTab === 'statement' && (
        <div className="space-y-3">
          {/* Quick Search */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search transactions, reference..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              Showing {filteredLedger.length} of {chronologicalLedger.length} entries
            </span>
          </div>

          {/* Table View matching ReportsView (Desktop & Mobile) */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926] shadow-2xs">
            <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Statement & Ledger Breakdown
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Showing {filteredLedger.length} of {chronologicalLedger.length} entries
              </span>
            </div>

            <div className="h-[420px] overflow-y-auto overflow-x-hidden sm:overflow-x-auto">
              {/* Desktop Table View (>= sm) */}
              <table className="hidden sm:table w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3.5 min-w-[200px]">Description</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Payable</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Receivable</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Running Bal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans italic">
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {row.formatted_date}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              row.type === 'bonus'
                                ? 'bg-black dark:bg-black text-white border border-emerald-500/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
                            }`}
                          >
                            {row.type_label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 font-sans text-xs font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{row.context}</span>
                            {row.order_number && (
                              <span className="text-[10px] font-mono text-slate-400 font-bold">
                                #{row.order_number}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {row.payable !== 0 ? (
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {row.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {row.receivable !== 0 ? (
                            <span className="text-emerald-500 dark:text-emerald-400 font-bold">
                              -{Math.abs(row.receivable).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums font-bold">
                          <span className={row.running_balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}>
                            {row.running_balance > 0 ? '−' : ''}{row.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Mobile List-Like Table View (< sm): 100% Width, Zero Horizontal Scroll */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {filteredLedger.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic">
                    No transactions found matching your criteria.
                  </div>
                ) : (
                  filteredLedger.map((row) => (
                    <div
                      key={row.id}
                      className="py-2.5 px-3 flex items-start justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-mono">{row.formatted_date}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                              row.type === 'bonus'
                                ? 'bg-black dark:bg-black text-white border border-emerald-500/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {row.type_label}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1 break-words">
                          {row.context}
                          {row.order_number && (
                            <span className="text-[10px] font-mono text-slate-400 font-bold ml-1">
                              #{row.order_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        {row.payable !== 0 ? (
                          <div className="font-bold text-slate-900 dark:text-white">
                            +{row.payable.toLocaleString()} ETB
                          </div>
                        ) : row.receivable !== 0 ? (
                          <div className="font-bold text-emerald-500 dark:text-emerald-400">
                            -{Math.abs(row.receivable).toLocaleString()} ETB
                          </div>
                        ) : (
                          <div className="text-slate-400">—</div>
                        )}
                        <div
                          className={`text-[10px] font-semibold mt-0.5 ${
                            row.running_balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                          }`}
                        >
                          Bal: {row.running_balance > 0 ? '−' : ''}{row.running_balance.toLocaleString()} ETB
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: CLOSED SALES ORDERS ── */}
      {activeTab === 'sales' && (
        <div className="space-y-3">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926] shadow-2xs">
            <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Sales Orders Closed
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {sales_orders.length} orders
              </span>
            </div>

            <div className="h-[420px] overflow-y-auto overflow-x-hidden sm:overflow-x-auto">
              {/* Desktop Table View (>= sm) */}
              <table className="hidden sm:table w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Order #</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Customer</th>
                    <th className="py-2.5 px-3.5 min-w-[200px]">Items Sold</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Total Amount</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Bonus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {sales_orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans italic">
                        No sales orders closed by this staff member yet.
                      </td>
                    </tr>
                  ) : (
                    sales_orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          #{order.order_number}
                        </td>
                        <td className="py-2.5 px-3.5 font-sans text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {order.customer_name}
                        </td>
                        <td className="py-2.5 px-3.5 font-sans text-slate-800 dark:text-slate-200">
                          <div className="space-y-0.5">
                            {order.items.map((it, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span>{it.name}</span>
                                {it.imei && <span className="font-mono text-[10px] text-slate-400">(SN: {it.imei})</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {order.total_amount.toLocaleString()} ETB
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              order.payment_status === 'paid'
                                ? 'bg-black dark:bg-black text-white border border-emerald-500/40'
                                : 'bg-black dark:bg-black text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {order.payment_status === 'paid' ? 'Paid' : 'Credit / Partial'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-emerald-500 dark:text-emerald-400 whitespace-nowrap">
                          {order.bonus_amount > 0 ? (
                            <span className="inline-flex items-center justify-end gap-1 px-2 py-0.5 rounded-md bg-black dark:bg-black text-white border border-emerald-500/40">
                              <Sparkles className="size-2.5 text-emerald-400" />
                              <span>+{order.bonus_amount.toLocaleString()} ETB</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Mobile View (< sm): 100% Width, Zero Horizontal Scroll */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {sales_orders.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic">
                    No sales orders closed by this staff member yet.
                  </div>
                ) : (
                  sales_orders.map((order) => (
                    <div
                      key={order.id}
                      className="py-2.5 px-3 flex items-start justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white">#{order.order_number}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate mt-0.5">
                          {order.customer_name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {order.items.map((it) => it.name).join(', ')}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold font-mono text-slate-900 dark:text-white">
                          {order.total_amount.toLocaleString()} ETB
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              order.payment_status === 'paid'
                                ? 'bg-black text-white border border-emerald-500/40'
                                : 'bg-black text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {order.payment_status === 'paid' ? 'Paid' : 'Credit'}
                          </span>
                          {order.bonus_amount > 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-black text-white border border-emerald-500/40 inline-flex items-center gap-0.5">
                              <Sparkles className="size-2 text-emerald-400" />
                              <span>+{order.bonus_amount.toLocaleString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: HANDOVERS OUT ── */}
      {activeTab === 'handovers' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300">
            <ShieldCheck className="size-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Custody Separation: </span>
              Devices handed out to {staff.name} for outside demonstration or sales are tracked here.
              Handing over devices will <span className="underline font-bold">never reduce</span> their earned commission bonuses.
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926] shadow-2xs">
            <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Custody Handovers Out
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {handovers.length} units
              </span>
            </div>

            <div className="h-[420px] overflow-y-auto overflow-x-hidden sm:overflow-x-auto">
              {/* Desktop Table View (>= sm) */}
              <table className="hidden sm:table w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Handout Date</th>
                    <th className="py-2.5 px-3.5 min-w-[200px]">Device & Model</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Serial / IMEI</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Agreed Value</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Return Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {handovers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans italic">
                        No devices currently handed out to {staff.name}.
                      </td>
                    </tr>
                  ) : (
                    handovers.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {unit.handed_out_at ? new Date(unit.handed_out_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900 dark:text-white">
                          {unit.device_name}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {unit.imei_or_serial || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              unit.status === 'out'
                                ? 'bg-black dark:bg-black text-amber-400 border border-amber-500/40'
                                : unit.status === 'sold'
                                ? 'bg-black dark:bg-black text-white border border-emerald-500/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {unit.status === 'out'
                              ? 'In Custody'
                              : unit.status === 'sold'
                              ? 'Sold by Staff'
                              : unit.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {unit.handover_payout > 0 ? `${unit.handover_payout.toLocaleString()} ETB` : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-slate-500 whitespace-nowrap">
                          {unit.return_deadline || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Mobile View (< sm): 100% Width, Zero Horizontal Scroll */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {handovers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic">
                    No devices currently handed out to {staff.name}.
                  </div>
                ) : (
                  handovers.map((unit) => (
                    <div
                      key={unit.id}
                      className="py-2.5 px-3 flex items-start justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {unit.device_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>SN: {unit.imei_or_serial || '—'}</span>
                          <span>•</span>
                          <span>{unit.handed_out_at ? new Date(unit.handed_out_at).toLocaleDateString() : '—'}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-bold font-mono text-slate-900 dark:text-white">
                          {unit.handover_payout > 0 ? `${unit.handover_payout.toLocaleString()} ETB` : '—'}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              unit.status === 'out'
                                ? 'bg-black text-amber-400 border border-amber-500/40'
                                : unit.status === 'sold'
                                ? 'bg-black text-white border border-emerald-500/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {unit.status === 'out' ? 'In Custody' : unit.status === 'sold' ? 'Sold' : unit.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settle Bonus Modal ── */}
      {isSettleModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CreditCard className="size-4 text-emerald-600" />
                  <span>Settle Commission Bonus</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Disburse bonus payout to {staff.name}
                </p>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
                    max={summary.uncollected_bonus || 9999999}
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => setSettleAmount(String(summary.uncollected_bonus || 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-black dark:bg-black text-white border border-emerald-500/40 font-bold text-[10px] cursor-pointer"
                  >
                    Max
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Total uncollected balance: {(summary.uncollected_bonus || 0).toLocaleString()} ETB
                </p>
              </div>

              <div>
                <SplitPaymentSelector
                  accounts={accounts}
                  targetAmount={parseFloat(settleAmount) || 0}
                  singleAccountId={selectedAccountId}
                  onSingleAccountChange={setSelectedAccountId}
                  isSplit={isSplit}
                  onIsSplitChange={setIsSplit}
                  splits={splits}
                  onSplitsChange={setSplits}
                  label="Disburse From Account"
                  direction="outflow"
                />
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
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSettle}
                  className="px-4 py-2 rounded-xl bg-black dark:bg-black text-white border border-emerald-500/40 hover:bg-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingSettle ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5 text-emerald-400" />
                  )}
                  <span>Confirm Payout</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
