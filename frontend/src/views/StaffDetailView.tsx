import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { StaffStatementData, FinancialAccount, User, StaffMember, Debt } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Check,
  ArrowDownToLine,
  ChevronDown,
  CheckCircle2,
  Phone,
  Pencil,
  Package,
  ArrowRightLeft,
  Receipt,
  CreditCard,
  Loader2,
  Send,
  UserX,
  UserCheck,
  KeyRound,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { formatLocalDate } from '../utils/dateUtils';
import { SplitPaymentSelector, type PaymentSplitItem } from '../components/common/SplitPaymentSelector';
import { EditStaffBottomSheet } from '../components/staff/EditStaffBottomSheet';

interface StaffDetailViewProps {
  staffId: number;
  user?: User | null;
  onBack: () => void;
  onEditStaff?: (member: StaffMember) => void;
  onStaffUpdated?: () => void;
}

type DateRangeFilter = 'all' | 'this_month' | 'last_month' | 'last_30_days' | 'custom';
type DashboardTab = 'statement' | 'sales' | 'handovers';

const getLedgerBadgeClass = (type: string, isDebtOffset?: boolean) => {
  if (type === 'bonus') {
    return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50';
  }
  if (isDebtOffset) {
    return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50';
  }
  return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50';
};

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
  is_debt_offset?: boolean;
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

  // Modals & Copy
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Settle Bonus Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleMode, setSettleMode] = useState<'payout' | 'debt_offset'>('payout');
  const [receivables, setReceivables] = useState<Debt[]>([]);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>('');
  const [loadingReceivables, setLoadingReceivables] = useState(false);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<PaymentSplitItem[]>([]);
  const [paymentDate, setPaymentDate] = useState<string>(formatLocalDate(new Date()));
  const [referenceNumber, setReferenceNumber] = useState<string>('BONUS-PAYOUT');
  const [notes, setNotes] = useState<string>('');
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Staff Edit & Account Management States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [shareCredentials, setShareCredentials] = useState<{
    name: string;
    login: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

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

  const loadReceivables = useCallback(async () => {
    try {
      setLoadingReceivables(true);
      const res = await api.getDebts({ type: 'receivable', status: 'open' });
      const openRecs = (res || []).filter(
        (d: Debt) => Number(d.remaining_amount) > 0
      );

      // Prioritize debts belonging to this staff member first!
      const staffName = statementData?.staff?.name?.trim().toLowerCase();
      const staffPhone = statementData?.staff?.phone?.trim();

      openRecs.sort((a, b) => {
        const aName = (a.contact?.name || '').toLowerCase();
        const bName = (b.contact?.name || '').toLowerCase();
        const aPhone = (a.contact?.phone || '').trim();
        const bPhone = (b.contact?.phone || '').trim();

        const aMatches = (staffName && aName.includes(staffName)) || (staffPhone && aPhone === staffPhone);
        const bMatches = (staffName && bName.includes(staffName)) || (staffPhone && bPhone === staffPhone);

        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return Number(b.remaining_amount) - Number(a.remaining_amount);
      });

      setReceivables(openRecs);

      if (openRecs.length > 0) {
        const targetDebt = (!selectedReceivableId || !openRecs.some((d) => String(d.id) === selectedReceivableId))
          ? openRecs[0]
          : openRecs.find((d) => String(d.id) === selectedReceivableId) || openRecs[0];

        setSelectedReceivableId(String(targetDebt.id));

        const maxPossible = Math.min(
          statementData?.summary?.uncollected_bonus || 0,
          Number(targetDebt.remaining_amount || 0)
        );
        setSettleAmount(String(maxPossible));
      }
    } catch (err: any) {
      console.error('Failed to load receivables for debt offset', err);
    } finally {
      setLoadingReceivables(false);
    }
  }, [selectedReceivableId, statementData]);

  useEffect(() => {
    if (isSettleModalOpen && settleMode === 'debt_offset') {
      loadReceivables();
    }
  }, [isSettleModalOpen, settleMode, loadReceivables]);

  const handleOpenSettleModal = () => {
    if (!statementData) return;
    const uncollected = statementData.summary.uncollected_bonus || 0;
    if (uncollected <= 0) {
      toast.info('This staff member has no uncollected bonuses to disburse.');
      return;
    }
    setSettleMode('payout');
    setSettleAmount(String(uncollected));
    setIsSplit(false);
    setSplits([]);
    setPaymentDate(formatLocalDate(new Date()));
    setReferenceNumber(`BONUS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    setNotes('');
    loadAccounts();
    setIsSettleModalOpen(true);
  };

  const handleSubmitSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementData) return;

    const amountNum = parseFloat(settleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    const uncollected = statementData.summary.uncollected_bonus || 0;
    if (amountNum > uncollected + 0.01) {
      toast.error(`Amount cannot exceed total uncollected bonus (${uncollected.toLocaleString()} ETB).`);
      return;
    }

    if (settleMode === 'debt_offset') {
      if (!selectedReceivableId) {
        toast.error('Please select a receivable debt to offset.');
        return;
      }
      try {
        setIsSubmittingSettle(true);
        await api.offsetStaffBonusDebt(staffId, {
          amount: amountNum,
          receivable_debt_id: selectedReceivableId,
          payment_date: paymentDate,
          reference_number: referenceNumber,
          notes: notes,
        });

        toast.success(`Bonus of ${amountNum.toLocaleString()} ETB successfully applied to receivable debt!`);
        setIsSettleModalOpen(false);
        loadStatement();
        onStaffUpdated?.();
      } catch (err: any) {
        toast.error(err.message || 'Failed to offset debt with bonus.');
      } finally {
        setIsSubmittingSettle(false);
      }
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
      is_debt_offset?: boolean;
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
        is_debt_offset: false,
      });

      // Add each payout associated with this bonus
      (b.payments || []).forEach((p, pIdx) => {
        const isOffset = Boolean(
          p.is_debt_offset ||
          (p.reference_number && p.reference_number.includes('BONUS-OFFSET')) ||
          (p.notes && p.notes.toLowerCase().includes('used for debt'))
        );

        let payoutDesc = '';
        if (isOffset) {
          const clean = (p.notes || '')
            .replace(/^Used for debt:\s*/i, '')
            .replace(/\s*\(#[^)]+\)/g, '')
            .replace(/Commission bonus payout to [^|]+/i, '')
            .replace(/\|\s*$/g, '')
            .trim();
          payoutDesc = clean || 'Offset against customer debt';
        } else {
          payoutDesc = `Disbursed via ${p.account_name || 'Cash in Safe'}`;
        }

        // Guarantee payout timestamp is chronologically sequenced after the bonus that created it
        let payoutDate = p.created_at || p.payment_date || b.date || '';
        if (b.date && (!payoutDate || new Date(payoutDate).getTime() <= new Date(b.date).getTime())) {
          payoutDate = new Date(new Date(b.date).getTime() + (pIdx + 1) * 1000).toISOString();
        }

        rawEvents.push({
          id: `payout-${p.id}`,
          date: payoutDate,
          type: 'payment_sent',
          type_label: isOffset ? 'Used for Debt' : 'Bonus Payout',
          context: payoutDesc,
          order_number: null,
          payable: 0,
          receivable: -p.amount,
          is_debt_offset: isOffset,
        });
      });
    });

    // Sort ascending by date so running balance flows chronologically.
    // If timestamps are identical, earned bonus comes before payment payout.
    rawEvents.sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.type === 'bonus' && b.type !== 'bonus') return -1;
      if (a.type !== 'bonus' && b.type === 'bonus') return 1;
      return 0;
    });

    let running = 0;
    const rowsWithBalance: FlattenedLedgerRow[] = rawEvents.map((ev) => {
      // In staff bonus ledger: payable adds to what store owes staff, receivable (payout/offset) settles it down
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
        is_debt_offset: ev.is_debt_offset,
      };
    });

    // Chronological order: earliest at top, latest/last at bottom
    return rowsWithBalance;
  }, [statementData]);

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
  const isSelf = _user?.id === staff.id;

  const handleOpenEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleToggleStatus = async () => {
    if (!statementData) return;
    try {
      await api.toggleStaffStatus(statementData.staff.id);
      toast.success(
        `${statementData.staff.name} has been ${statementData.staff.is_active ? 'suspended' : 'activated'}`
      );
      await loadStatement();
      onStaffUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update staff status');
    }
  };

  const handleResetPassword = async () => {
    if (!statementData) return;
    try {
      setIsResetting(true);
      const res = await api.resetStaffPassword(statementData.staff.id);
      toast.success(`Password reset for ${statementData.staff.name}`);
      setIsResetConfirmOpen(false);
      setShareCredentials({
        name: statementData.staff.name,
        login: statementData.staff.email || statementData.staff.phone || '',
        temporaryPassword: res.temporary_password,
      });
      await loadStatement();
      onStaffUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!statementData) return;
    try {
      setIsRemoving(true);
      await api.deleteStaff(statementData.staff.id);
      toast.success(`Staff account ${statementData.staff.name} removed successfully.`);
      setIsRemoveConfirmOpen(false);
      onStaffUpdated?.();
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove staff account');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!shareCredentials) return;
    const shareText = `👋 Welcome to Bole Tech Business OS!\n\nLogin: ${shareCredentials.login}\nPassword: ${shareCredentials.temporaryPassword}\nURL: ${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}\n\nPlease sign in and update your password.`;
    navigator.clipboard.writeText(shareText);
    setCopiedCredentials(true);
    toast.success('Login credentials copied to clipboard');
    setTimeout(() => setCopiedCredentials(false), 3000);
  };

  return (
    <div className="space-y-5 animate-page-enter">
      {/* ── Top Navigation & Header ── */}
      <div className="space-y-3.5 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        {/* Row 1: Back Button + Name + Action Buttons */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              title="Back to Staff List"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {staff.name}
              </h1>
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                {staff.phone && (
                  <button
                    onClick={() => handleCopyPhone(staff.phone!)}
                    className="inline-flex items-center gap-1 font-mono hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{staff.phone}</span>
                    {copiedPhone ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                )}
                <span className="inline-flex items-center gap-1.5">
                  {staff.phone && <span>·</span>}
                  <span className="capitalize">{staff.role}</span>
                </span>
                {staff.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <span>·</span>
                    <span className="text-slate-400">{staff.email}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Edit, Settle Bonus, PDF (Mobile only < sm) */}
          <div className="sm:hidden flex items-center gap-1.5 shrink-0">
            {isOwner && (
              <button
                type="button"
                onClick={handleOpenEdit}
                className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
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
                className="h-8 px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                title="Settle Bonus"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Settle</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="h-8 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Download Statement as PDF"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Desktop Right Cluster (≥ sm): Balance + Divider + Actions */}
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
                {hasUncollected ? 'We Owe Staff' : 'Settled In Full'}
              </span>
              <div
                className={`text-2xl lg:text-3xl font-black font-mono tracking-tight tabular-nums flex items-baseline justify-end gap-1.5 ${
                  hasUncollected
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                <span>
                  {hasUncollected
                    ? `−${uncollectedBonus.toLocaleString()}`
                    : '0.00'}
                </span>
                <span className="text-xs font-sans font-bold text-slate-400 dark:text-slate-500">
                  ETB
                </span>
              </div>
            </div>

            <div className="h-9 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

            <div className="flex items-center gap-2">
              {isOwner && (
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Edit Staff Member"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit</span>
                </button>
              )}

              {isOwner && !isSelf && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    className={`h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                      staff.is_active
                        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                    }`}
                    title={staff.is_active ? 'Suspend staff' : 'Activate staff'}
                  >
                    {staff.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    <span>{staff.is_active ? 'Suspend' : 'Activate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Reset Temporary Password"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset PW</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRemoveConfirmOpen(true)}
                    className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                    title="Remove Staff Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
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
                className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Download Statement as PDF"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PDF Statement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Large Total Amount on Left + Minimal Period Dropdown on Right (Mobile only < sm) */}
        <div className="sm:hidden flex items-end justify-between gap-3 pt-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              {hasUncollected ? 'We Owe Staff' : 'Settled In Full'}
            </span>
            <div
              className={`text-2xl font-black font-mono tracking-tight tabular-nums flex items-baseline gap-1.5 ${
                hasUncollected
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              <span>
                {hasUncollected
                  ? `−${uncollectedBonus.toLocaleString()}`
                  : '0.00'}
              </span>
              <span className="text-xs font-sans font-bold text-slate-400 dark:text-slate-500">
                ETB
              </span>
            </div>
          </div>

          {/* Right (Mobile only < sm): Minimal native Period dropdown without nested cards */}
          <div className="flex items-center shrink-0 pb-0.5">
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
                className="h-8 pl-2.5 pr-6 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer appearance-none shadow-2xs"
              >
                <option value="all">All Time</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="custom">Custom</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Custom Range Date Pickers on Mobile (< sm) */}
        {dateFilter === 'custom' && (
          <div className="sm:hidden flex items-center gap-2 text-xs pt-1">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-7.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white flex-1"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-7.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white flex-1"
            />
          </div>
        )}
      </div>

      {/* ── Desktop Date Range Controls (≥ sm) ── */}
      <div className="hidden sm:flex items-center justify-between gap-2.5 p-2 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 shadow-2xs">
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
          <span>Sales Orders</span>
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

      {/* ── Tab Content ── */}

      {/* TAB 1: STATEMENT & LEDGER BREAKDOWN */}
      {activeTab === 'statement' && (
        <div className="space-y-3">
          {/* Table View: Cardless & Horizontally Scrollable on Mobile, Carded on Desktop */}
          <div className="bg-transparent sm:bg-white sm:dark:bg-[#131926] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3.5 min-w-[220px]">Description</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Bonus Earned</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Disbursed / Offset</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {chronologicalLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans italic">
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    chronologicalLedger.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {row.formatted_date}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getLedgerBadgeClass(row.type, row.is_debt_offset)}`}
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
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              -{Math.abs(row.receivable).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums font-bold">
                          <span
                            className={
                              row.running_balance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-400'
                            }
                          >
                            {row.running_balance > 0 ? '−' : ''}
                            {row.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                  {chronologicalLedger.length > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium font-sans"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {chronologicalLedger.length} transactions loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLOSED SALES ORDERS */}
      {activeTab === 'sales' && (
        <div>
          {/* Table View: Cardless & Horizontally Scrollable on Mobile, Carded on Desktop */}
          <div className="bg-transparent sm:bg-white sm:dark:bg-[#131926] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Order #</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Customer</th>
                    <th className="py-2.5 px-3.5 min-w-[200px]">Items Sold</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Total Amount</th>
                    <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Payment</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Bonus Earned</th>
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
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              order.payment_status === 'paid'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                            }`}
                          >
                            {order.payment_status === 'paid' ? 'Paid' : 'Credit / Partial'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {order.bonus_amount > 0 ? (
                            <span>+{order.bonus_amount.toLocaleString()} ETB</span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                  {sales_orders.length > 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium font-sans"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {sales_orders.length} sales orders loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HANDOVERS OUT */}
      {activeTab === 'handovers' && (
        <div>
          {/* Table View: Cardless & Horizontally Scrollable on Mobile, Carded on Desktop */}
          <div className="bg-transparent sm:bg-white sm:dark:bg-[#131926] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5">Device Model</th>
                    <th className="py-2.5 px-3.5">Serial / IMEI</th>
                    <th className="py-2.5 px-3.5 text-right">Agreed Value</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Handout Date</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {handovers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-sans italic">
                        No devices currently handed out to {staff.name}.
                      </td>
                    </tr>
                  ) : (
                    handovers.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900 dark:text-white">
                          {unit.device_name}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300">
                          {unit.imei_or_serial || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 dark:text-white">
                          {unit.handover_payout > 0 ? `${unit.handover_payout.toLocaleString()} ETB` : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap font-sans text-slate-500 text-[11px]">
                          {unit.handed_out_at ? new Date(unit.handed_out_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              unit.status === 'out'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                                : unit.status === 'sold'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {unit.status === 'out' ? 'In Custody' : unit.status === 'sold' ? 'Sold by Staff' : unit.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                  {handovers.length > 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium font-sans"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {handovers.length} handover items loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                  Disburse bonus payout or offset against customer receivable debt for {staff.name}
                </p>
              </div>
              <button
                onClick={() => setIsSettleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSettleMode('payout')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  settleMode === 'payout'
                    ? 'bg-white dark:bg-[#151b26] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Cash Payout
              </button>
              <button
                type="button"
                onClick={() => setSettleMode('debt_offset')}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  settleMode === 'debt_offset'
                    ? 'bg-white dark:bg-[#151b26] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Settle Receivable Debt
              </button>
            </div>

            <form onSubmit={handleSubmitSettle} className="space-y-3.5">
              {settleMode === 'debt_offset' ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Select Target Receivable Debt
                  </label>
                  {loadingReceivables ? (
                    <div className="py-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Loading open customer debts...</span>
                    </div>
                  ) : receivables.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 text-xs">
                      No open receivable debts found to offset against.
                    </div>
                  ) : (
                    <select
                      value={selectedReceivableId}
                      onChange={(e) => {
                        setSelectedReceivableId(e.target.value);
                        const recDebt = receivables.find((d) => d.id === e.target.value);
                        if (recDebt) {
                          const maxPossible = Math.min(
                            summary.uncollected_bonus || 0,
                            Number(recDebt.remaining_amount)
                          );
                          setSettleAmount(String(maxPossible));
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    >
                      {receivables.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.contact?.name || 'Customer'} ({d.contact?.phone || 'No phone'}) — {Number(d.remaining_amount).toLocaleString()} ETB remaining
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedReceivableId && (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Receivable Balance:{' '}
                        <strong className="text-slate-700 dark:text-slate-300 font-mono">
                          {Number(
                            receivables.find((d) => d.id === selectedReceivableId)?.remaining_amount || 0
                          ).toLocaleString()}{' '}
                          ETB
                        </strong>
                      </span>
                      <span>
                        Available Bonus:{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                          {(summary.uncollected_bonus || 0).toLocaleString()} ETB
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              ) : null}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {settleMode === 'debt_offset' ? 'Offset Amount (ETB)' : 'Payout Amount (ETB)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={
                      settleMode === 'debt_offset' && selectedReceivableId
                        ? Math.min(
                            summary.uncollected_bonus || 9999999,
                            Number(receivables.find((d) => d.id === selectedReceivableId)?.remaining_amount || 9999999)
                          )
                        : summary.uncollected_bonus || 9999999
                    }
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (settleMode === 'debt_offset' && selectedReceivableId) {
                        const recDebt = receivables.find((d) => d.id === selectedReceivableId);
                        const maxVal = Math.min(
                          summary.uncollected_bonus || 0,
                          Number(recDebt?.remaining_amount || 0)
                        );
                        setSettleAmount(String(maxVal));
                      } else {
                        setSettleAmount(String(summary.uncollected_bonus || 0));
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-black dark:bg-black text-white border border-emerald-500/40 font-bold text-[10px] cursor-pointer"
                  >
                    Max
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {settleMode === 'debt_offset'
                    ? 'Amount will directly pay down the chosen receivable debt without affecting cash accounts.'
                    : `Total uncollected balance: ${(summary.uncollected_bonus || 0).toLocaleString()} ETB`}
                </p>
              </div>

              {settleMode === 'payout' && (
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
              )}

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
                    placeholder={settleMode === 'debt_offset' ? 'Auto-generated or custom ref' : 'e.g. CBE-TXN-123'}
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
                  placeholder={settleMode === 'debt_offset' ? 'e.g. Offsetting customer credit balance...' : 'Optional memo...'}
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
                  <span>{settleMode === 'debt_offset' ? 'Confirm Debt Offset' : 'Confirm Payout'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Edit Staff Bottom Sheet ── */}
      {isEditModalOpen && statementData && (
        <EditStaffBottomSheet
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          staff={statementData.staff}
          onSuccess={async (updatedStaff) => {
            await loadStatement();
            onStaffUpdated?.();
            if (onEditStaff) {
              onEditStaff(updatedStaff);
            }
          }}
        />
      )}

      {/* ── Confirm Reset Password ── */}
      {isResetConfirmOpen && statementData && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => setIsResetConfirmOpen(false)}
          />

          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-5 sm:p-6 text-center my-auto">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/50 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Reset Password for {statementData.staff.name}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              A new temporary password will be generated for this worker. Their previous password will no longer work.
            </p>

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 h-9 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isResetting}
                className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
              >
                {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>Reset Now</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Confirm Remove Staff ── */}
      {isRemoveConfirmOpen && statementData && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => !isRemoving && setIsRemoveConfirmOpen(false)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-5 sm:p-6 my-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Remove Staff Account
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {statementData.staff.name} ({statementData.staff.email || statementData.staff.phone})
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0c1017] p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2 mb-5 leading-relaxed">
              <p>
                Removing this staff account will revoke their login access and permanently remove them from your active staff list.
              </p>
              <div className="flex items-start gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
                <span>All past sales orders, bonuses, and audit logs recorded by {statementData.staff.name} remain safely preserved for your financial records.</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => setIsRemoveConfirmOpen(false)}
                disabled={isRemoving}
                className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                className="flex-1 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/25 disabled:opacity-50 cursor-pointer"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Staff</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Shareable Temporary Credentials Card ── */}
      {shareCredentials && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => setShareCredentials(null)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] text-slate-900 dark:text-white rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter p-5 sm:p-6 my-auto">
            <div className="text-center pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 mx-auto flex items-center justify-center mb-2.5">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                New Credentials Ready
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Share with <span className="font-bold text-slate-900 dark:text-white">{shareCredentials.name}</span>
              </p>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">Login</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{shareCredentials.login}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-slate-400">Password</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm tracking-wider">{shareCredentials.temporaryPassword}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1017] border border-slate-200/80 dark:border-slate-800/80 text-[11px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-4">
              {`👋 Welcome to Bole Tech Business OS!\n\nLogin: ${shareCredentials.login}\nPassword: ${shareCredentials.temporaryPassword}\nURL: ${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}\n\nPlease sign in and update your password.`}
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={handleCopyCredentials}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/25 active:scale-[0.98] cursor-pointer"
              >
                {copiedCredentials ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCredentials ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
              </button>
              <button
                onClick={() => setShareCredentials(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
