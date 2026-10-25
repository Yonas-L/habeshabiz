import React, { useState, useMemo } from 'react';
import type { DashboardData, FinancialAccount, Debt } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { SlideOverDrawer } from './SlideOverDrawer';
import { ProgressiveSection } from './ProgressiveSection';
import { AnimatedNumber } from '../AnimatedNumber';
import { ManageAccountModal } from '../treasury/ManageAccountModal';
import { AddBalanceModal } from '../treasury/AddBalanceModal';
import { PartySettleModal } from '../debts/PartySettleModal';
import {
  Landmark,
  CreditCard,
  Smartphone,
  Coins,
  ArrowRight,
  Clock,
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AccountLogo } from '../../utils/bankLogos';

export type VitalType = 'cash' | 'receivables' | 'inventory' | 'reserves' | 'payables';

interface VitalBreakdownDrawerProps {
  vitalType: VitalType | null;
  focusedContactId?: string | null;
  onClearFocusedContact?: () => void;
  isOpen: boolean;
  onClose: () => void;
  data: DashboardData | null;
  accounts: FinancialAccount[];
  selectedMonth?: string;
  onNavigateTab: (tab: any) => void;
  onSelectDebt?: (debt: Debt) => void;
  onRefreshData?: () => void;
}

const formatMonthLabel = (mStr?: string) => {
  if (!mStr || !mStr.includes('-')) return '';
  const [y, m] = mStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1] || ''} ${y}`;
};

export const VitalBreakdownDrawer: React.FC<VitalBreakdownDrawerProps> = ({
  vitalType,
  focusedContactId,
  onClearFocusedContact,
  isOpen,
  onClose,
  data,
  accounts,
  selectedMonth,
  onNavigateTab,
  onSelectDebt,
  onRefreshData,
}) => {
  if (!vitalType || !data) return null;

  const { capital_overview, counts, top_receivables, top_payables } = data;

  const vitalConfig: Record<
    VitalType,
    {
      title: string;
      subtitle: string;
      amount: number;
      icon: React.FC<{ className?: string }>;
      targetTab: string;
      actionLabel: string;
    }
  > = {
    cash: {
      title: 'Liquid Cash & Bank',
      subtitle: 'Cash Drawer and Bank Accounts',
      amount: capital_overview.cash_and_banks,
      icon: Landmark,
      targetTab: 'treasury',
      actionLabel: 'Open Bank Accounts',
    },
    receivables: {
      title: 'Money Owed to You',
      subtitle: 'Customer Credit and Vendor Handover Holdings',
      amount: capital_overview.receivables,
      icon: CreditCard,
      targetTab: 'debts',
      actionLabel: 'Open Debt Ledger',
    },
    payables: {
      title: 'Money You Owe',
      subtitle: 'Supplier Debts and Consignment Payouts',
      amount: capital_overview.payables,
      icon: Clock,
      targetTab: 'debts',
      actionLabel: 'Open Debt Ledger',
    },
    inventory: {
      title: 'Shop Inventory',
      subtitle: 'Shop-owned devices on shelf (excludes consignment)',
      amount: capital_overview.stock_value,
      icon: Smartphone,
      targetTab: 'inventory',
      actionLabel: 'Open Inventory Catalog',
    },
    reserves: {
      title: 'Other Assets',
      subtitle: 'Physical gold, foreign currency, and custom assets',
      amount: capital_overview.custom_assets,
      icon: Coins,
      targetTab: 'treasury',
      actionLabel: 'Manage Other Assets',
    },
  };

  const current = vitalConfig[vitalType];
  const Icon = current.icon;

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountDefaultType, setAccountDefaultType] = useState('bank');
  const [deletingAccount, setDeletingAccount] = useState<FinancialAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [expandedParties, setExpandedParties] = useState<Record<string, boolean>>({});
  const [settlingParty, setSettlingParty] = useState<{
    id: string;
    name: string;
    phone?: string | null;
    totalRemaining: number;
    debtCount: number;
  } | null>(null);

  const toggleParty = (partyId: string) => {
    setExpandedParties((prev) => ({
      ...prev,
      [partyId]: !prev[partyId],
    }));
  };

  const groupedReceivables = useMemo(() => {
    const map = new Map<string, { contactId: string; name: string; phone: string | null; totalRemaining: number; netRemaining: number; offsetAmount: number; debts: Debt[]; openCount: number }>();
    top_receivables.forEach((debt) => {
      const cid = debt.contact?.id || debt.contact?.name || 'unassigned';
      if (!map.has(cid)) {
        map.set(cid, {
          contactId: cid,
          name: debt.contact?.name || 'Unassigned',
          phone: debt.contact?.phone || null,
          totalRemaining: 0,
          netRemaining: 0,
          offsetAmount: 0,
          debts: [],
          openCount: 0,
        });
      }
      const g = map.get(cid)!;
      g.debts.push(debt);
      const rem = parseFloat(String(debt.remaining_amount)) || 0;
      g.totalRemaining += rem;
      if (rem > 0.001) {
        g.openCount += 1;
      }
      if (debt.contact && debt.contact.net_balance !== undefined) {
        const netBal = Number(debt.contact.net_balance);
        g.netRemaining = Math.max(0, netBal);
        g.offsetAmount = Math.max(0, g.totalRemaining - g.netRemaining);
      } else {
        g.netRemaining = g.totalRemaining;
        g.offsetAmount = 0;
      }
    });
    map.forEach((g) => {
      const openDebts = g.debts.filter((d) => (Number(d.remaining_amount) || 0) > 0.001)
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      const settledDebts = g.debts.filter((d) => (Number(d.remaining_amount) || 0) <= 0.001)
        .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
        .slice(0, 2);

      let remainingOffset = g.offsetAmount;
      const enhancedOpenDebts = openDebts.map((d) => {
        const rem = Number(d.remaining_amount) || 0;
        const alloc = Math.min(rem, remainingOffset);
        const netRem = Math.max(0, rem - alloc);
        remainingOffset = Math.max(0, remainingOffset - alloc);
        return {
          ...d,
          allocatedOffset: alloc,
          effectiveRemaining: netRem,
        } as Debt;
      });

      const enhancedSettledDebts = settledDebts.map((d) => ({
        ...d,
        allocatedOffset: 0,
        effectiveRemaining: 0,
      } as Debt));

      g.debts = [...enhancedSettledDebts, ...enhancedOpenDebts];
    });
    return Array.from(map.values())
      .filter((g) => g.netRemaining > 0.001)
      .sort((a, b) => b.netRemaining - a.netRemaining);
  }, [top_receivables]);

  const groupedPayables = useMemo(() => {
    const map = new Map<string, {
      contactId: string;
      name: string;
      phone: string | null;
      totalRemaining: number;
      netRemaining: number;
      offsetAmount: number;
      debts: Debt[];
      openCount: number;
      isStaffBonus?: boolean;
    }>();

    (top_payables || []).forEach((debt) => {
      const isBonus = debt.reference_type === 'salesperson_bonus';
      const cid = debt.contact?.id || debt.contact?.name || 'unassigned';
      if (!map.has(cid)) {
        map.set(cid, {
          contactId: cid,
          name: debt.contact?.name || 'Unassigned',
          phone: debt.contact?.phone || null,
          totalRemaining: 0,
          netRemaining: 0,
          offsetAmount: 0,
          debts: [],
          openCount: 0,
          isStaffBonus: isBonus,
        });
      }
      const g = map.get(cid)!;
      g.debts.push(debt);
      const rem = parseFloat(String(debt.remaining_amount)) || 0;
      g.totalRemaining += rem;
      if (rem > 0.001) {
        g.openCount += 1;
      }
      if (isBonus) {
        g.isStaffBonus = true;
      }
    });

    map.forEach((g) => {
      if (g.isStaffBonus) {
        // Staff commission bonuses are NEVER offset against handovers or trade credit!
        g.offsetAmount = 0;
        g.netRemaining = g.totalRemaining;

        const openDebts = g.debts.filter((d) => (Number(d.remaining_amount) || 0) > 0.001)
          .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        const settledDebts = g.debts.filter((d) => (Number(d.remaining_amount) || 0) <= 0.001)
          .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
          .slice(0, 2);

        const enhancedOpenDebts = openDebts.map((d) => ({
          ...d,
          allocatedOffset: 0,
          effectiveRemaining: Number(d.remaining_amount) || 0,
        } as Debt));

        const enhancedSettledDebts = settledDebts.map((d) => ({
          ...d,
          allocatedOffset: 0,
          effectiveRemaining: 0,
        } as Debt));

        g.debts = [...enhancedSettledDebts, ...enhancedOpenDebts];
      } else {
        const firstDebt = g.debts[0];
        if (firstDebt?.contact && firstDebt.contact.net_balance !== undefined) {
          const netBal = Number(firstDebt.contact.net_balance);
          g.netRemaining = Math.max(0, -netBal);
          g.offsetAmount = Math.max(0, g.totalRemaining - g.netRemaining);
        } else {
          g.netRemaining = g.totalRemaining;
          g.offsetAmount = 0;
        }

        const openDebts = g.debts.filter((d) => (Number(d.remaining_amount) || 0) > 0.001)
          .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        const settledDebts = g.debts.filter((d) => (Number(d.remaining_amount) || 0) <= 0.001)
          .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())
          .slice(0, 2);

        let remainingOffset = g.offsetAmount;
        const enhancedOpenDebts = openDebts.map((d) => {
          const rem = Number(d.remaining_amount) || 0;
          const alloc = Math.min(rem, remainingOffset);
          const netRem = Math.max(0, rem - alloc);
          remainingOffset = Math.max(0, remainingOffset - alloc);
          return {
            ...d,
            allocatedOffset: alloc,
            effectiveRemaining: netRem,
          } as Debt;
        });

        const enhancedSettledDebts = settledDebts.map((d) => ({
          ...d,
          allocatedOffset: 0,
          effectiveRemaining: 0,
        } as Debt));

        g.debts = [...enhancedSettledDebts, ...enhancedOpenDebts];
      }
    });

    return Array.from(map.values())
      .filter((g) => g.netRemaining > 0.001)
      .sort((a, b) => b.netRemaining - a.netRemaining);
  }, [top_payables]);

  const [internalFocusedContactId, setInternalFocusedContactId] = useState<string | null>(null);

  React.useEffect(() => {
    setInternalFocusedContactId(focusedContactId || null);
  }, [focusedContactId, isOpen]);

  const activeFocusedContactId = internalFocusedContactId;

  const focusedReceivableGroup = useMemo(() => {
    if (!activeFocusedContactId) return null;
    return (
      groupedReceivables.find(
        (g) => g.contactId === activeFocusedContactId || g.name.toLowerCase() === activeFocusedContactId.toLowerCase()
      ) || null
    );
  }, [groupedReceivables, activeFocusedContactId]);

  const focusedPayableGroup = useMemo(() => {
    if (!activeFocusedContactId) return null;
    return (
      groupedPayables.find(
        (g) => g.contactId === activeFocusedContactId || g.name.toLowerCase() === activeFocusedContactId.toLowerCase()
      ) || null
    );
  }, [groupedPayables, activeFocusedContactId]);

  const focusedGroup = vitalType === 'receivables' ? focusedReceivableGroup : vitalType === 'payables' ? focusedPayableGroup : null;

  const drawerTitle = focusedGroup ? focusedGroup.name : current.title;
  const drawerSubtitle = focusedGroup
    ? `${focusedGroup.openCount} ${focusedGroup.openCount === 1 ? 'obligation' : 'obligations'} · ${
        vitalType === 'receivables'
          ? 'Customer / Partner Holdings'
          : (focusedGroup as any).isStaffBonus
            ? 'Staff Commission Bonus Ledger'
            : 'Supplier Debt Ledger'
      }${focusedGroup.phone ? ` · ${focusedGroup.phone}` : ''}`
    : current.subtitle;
  const drawerAmount = focusedGroup ? focusedGroup.netRemaining : current.amount;
  const valuationLabel = focusedGroup
    ? (selectedMonth ? `Net Position as of ${formatMonthLabel(selectedMonth)}` : 'Net Position')
    : (selectedMonth ? `Valuation as of ${formatMonthLabel(selectedMonth)}` : 'Total Valuation');

  const drawerBadge = focusedGroup ? (
    <div className="flex items-center gap-1.5">
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
        vitalType === 'receivables'
          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
          : (focusedGroup as any).isStaffBonus
            ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60'
            : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
      }`}>
        {vitalType === 'receivables'
          ? 'Party Receivable'
          : (focusedGroup as any).isStaffBonus
            ? 'Staff Bonus'
            : 'Party Payable'}
      </span>
      {selectedMonth && (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
          {formatMonthLabel(selectedMonth)}
        </span>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-1.5">
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
        Store Asset
      </span>
      {selectedMonth && (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 font-mono">
          {formatMonthLabel(selectedMonth)}
        </span>
      )}
    </div>
  );

  const [selectedAccountForBalance, setSelectedAccountForBalance] = useState<FinancialAccount | null>(null);

  const handleOpenAddBalance = (acc: FinancialAccount) => {
    setSelectedAccountForBalance(acc);
  };

  const handleOpenCreate = (type = 'bank') => {
    setEditingAccount(null);
    setAccountDefaultType(type);
    setShowAccountModal(true);
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;
    try {
      setDeleting(true);
      await api.deleteAccount(deletingAccount.id);
      toast.success('Account removed successfully', {
        description: `${deletingAccount.name} has been removed. All dependable historical records remain preserved.`,
      });
      setDeletingAccount(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      toast.error('Failed to remove account', { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  const liquidAccounts = accounts.filter((a) => !a.is_custom_asset);
  const reserveAccounts = accounts.filter((a) => a.is_custom_asset);

  const [reserveTab, setReserveTab] = useState<'all' | 'gold' | 'forex' | 'other'>('all');

  const getReserveCategory = (acc: FinancialAccount): 'gold' | 'forex' | 'other' => {
    const t = (acc.type || '').toLowerCase();
    const n = (acc.name || '').toLowerCase();
    if (t.includes('gold') || n.includes('gold')) return 'gold';
    if (t.includes('fx') || t.includes('currency') || n.includes('forex') || n.includes('usdt') || n.includes('usd')) return 'forex';
    return 'other';
  };

  const filteredReserveAccounts = reserveAccounts.filter((acc) => {
    if (reserveTab === 'all') return true;
    return getReserveCategory(acc) === reserveTab;
  });

  return (
    <>
      <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={drawerTitle}
      subtitle={drawerSubtitle}
      badge={drawerBadge}
      footerActions={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateTab(current.targetTab);
            }}
            className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <span>{focusedGroup ? `Open ${focusedGroup.name} in Debts` : current.actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </>
      }
    >
      {/* Hero Metric Card */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {valuationLabel}
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-1">
              <AnimatedNumber value={drawerAmount} />{' '}
              <span className="text-sm font-bold text-slate-400 font-sans">ETB</span>
            </div>
            {focusedGroup && focusedGroup.offsetAmount > 0.01 && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                Gross {focusedGroup.totalRemaining.toLocaleString()} ETB · Offset −{focusedGroup.offsetAmount.toLocaleString()} ETB
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {focusedGroup && (
              <button
                type="button"
                onClick={() => setSettlingParty({
                  id: focusedGroup.contactId,
                  name: focusedGroup.name,
                  phone: focusedGroup.phone,
                  totalRemaining: focusedGroup.netRemaining,
                  debtCount: focusedGroup.openCount,
                })}
                className="h-9 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <span>{vitalType === 'receivables' ? 'Collect All' : 'Pay All'}</span>
              </button>
            )}
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-xs">
              <Icon className="w-5 h-5" />
            </div>
          </div>
        </div>

        {focusedGroup && (
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setInternalFocusedContactId(null);
                if (onClearFocusedContact) onClearFocusedContact();
              }}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>← View all {vitalType === 'receivables' ? 'store receivables' : 'store payables'}</span>
            </button>
            {focusedGroup.phone && (
              <span className="text-[11px] text-slate-400 font-mono">{focusedGroup.phone}</span>
            )}
          </div>
        )}
      </div>

      {/* Conditional Content by Vital Type */}
      {vitalType === 'cash' && (
        <ProgressiveSection
          title="Liquid Accounts"
          icon={<Landmark className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Cash Drawers & Bank Accounts
              </span>
              <button
                type="button"
                onClick={() => handleOpenCreate('bank')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />
                <span>Add Account</span>
              </button>
            </div>

            {liquidAccounts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No active liquid accounts. Click "Add Account" to create one.
              </div>
            ) : (
              liquidAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <AccountLogo account={acc} size="sm" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{acc.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {acc.account_number || acc.type.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {Number(acc.current_balance).toLocaleString()} ETB
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                        {acc.type === 'bank' ? 'Bank Account' : acc.type === 'mobile_money' ? 'Mobile Wallet' : 'Cash Drawer'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 pl-1.5 border-l border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleOpenAddBalance(acc)}
                        title="Add Balance"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAccount(acc)}
                        title="Remove Account"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ProgressiveSection>
      )}

      {vitalType === 'receivables' && (
        <ProgressiveSection
          title={focusedGroup ? `${focusedGroup.name}'s Obligations` : 'Receivables & Handover Holdings'}
          icon={<CreditCard className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {(focusedGroup ? [focusedGroup] : groupedReceivables).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/90">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">No Open Receivables</div>
                <div className="text-[11px]">All customer and partner receivables are settled.</div>
              </div>
            ) : (
              (focusedGroup ? [focusedGroup] : groupedReceivables).map((group) => {
                const isExpanded = !!focusedGroup || !!expandedParties[group.contactId];
                return (
                  <div
                    key={group.contactId}
                    className="rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 overflow-hidden transition-all text-xs"
                  >
                    {/* Collapsed Header */}
                    <div
                      onClick={() => toggleParty(group.contactId)}
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <button
                          type="button"
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {group.name}
                            </span>
                            {!focusedGroup && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInternalFocusedContactId(group.contactId);
                                }}
                                title={`Focus on ${group.name}'s drawer`}
                                className="text-[10px] text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              >
                                Focus →
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {group.openCount} {group.openCount === 1 ? 'obligation' : 'obligations'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            +{group.netRemaining.toLocaleString()} ETB
                          </div>
                          {group.offsetAmount > 0.01 && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Offset −{group.offsetAmount.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div
                          className={`transition-all duration-300 ease-in-out transform ${
                            isExpanded
                              ? 'opacity-0 scale-90 pointer-events-none invisible w-0 overflow-hidden'
                              : 'opacity-100 scale-100 pointer-events-auto visible w-auto'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSettlingParty({
                              id: group.contactId,
                              name: group.name,
                              phone: group.phone,
                              totalRemaining: group.netRemaining,
                              debtCount: group.openCount,
                            })}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95 cursor-pointer ml-1 whitespace-nowrap"
                          >
                            Collect
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Inside List */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/30 p-2.5 space-y-1.5 max-h-52 overflow-y-auto animate-in fade-in duration-200">
                        {group.debts.map((debt) => {
                          const orig = Number(debt.original_amount) || 0;
                          const rem = Number(debt.remaining_amount) || 0;
                          const allocOffset = (debt as any).allocatedOffset || 0;
                          const effectiveRem = (debt as any).effectiveRemaining !== undefined ? (debt as any).effectiveRemaining : rem;

                          const isDbSettled = rem <= 0.001;
                          const isOffsetCovered = !isDbSettled && effectiveRem <= 0.001 && allocOffset > 0.01;
                          const isSettled = isDbSettled || isOffsetCovered;
                          const isPartial = !isSettled && (Number(debt.paid_amount) > 0 || allocOffset > 0.01);
                          const displayAmount = isSettled ? (isDbSettled ? orig : rem) : effectiveRem;

                          return (
                            <div
                              key={debt.id}
                              onClick={() => {
                                if (onSelectDebt) {
                                  onClose();
                                  onSelectDebt(debt);
                                }
                              }}
                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all ${
                                isSettled
                                  ? 'bg-slate-100/50 dark:bg-slate-900/20 border-slate-200/40 dark:border-slate-800/40 opacity-60'
                                  : 'bg-white dark:bg-[#131926] border-slate-200/60 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    isSettled
                                      ? 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {debt.reference_type === 'handover_holding' ? 'Handover' : debt.reference_type === 'vendor_return_refund' ? 'Refund' : 'Credit'}
                                  </span>
                                  {debt.created_at && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {new Date(debt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </span>
                                  )}
                                  {isSettled ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      Covered
                                    </span>
                                  ) : isPartial ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                      Partial
                                    </span>
                                  ) : null}
                                </div>
                                {!isSettled && allocOffset > 0.01 && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                    Gross {rem.toLocaleString()} · −{allocOffset.toLocaleString()} Trade Credit
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <div className={`font-mono font-bold text-xs ${
                                  isSettled ? 'text-slate-400 line-through' : 'text-emerald-600 dark:text-emerald-400'
                                }`}>
                                  +{displayAmount.toLocaleString()} ETB
                                </div>
                                {!isSettled ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSettlingParty({
                                        id: group.contactId,
                                        name: group.name,
                                        phone: group.phone,
                                        totalRemaining: effectiveRem,
                                        debtCount: 1,
                                      });
                                    }}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs active:scale-95 cursor-pointer"
                                  >
                                    Collect
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-medium text-slate-400 px-1 py-0.5">
                                    Complete
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {group.offsetAmount > 0.01 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs">
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                Trade Credit Applied
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                −{Number(group.offsetAmount).toLocaleString()} ETB absorbed by product received from {group.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                Net Collectable
                              </div>
                              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                                +{group.netRemaining.toLocaleString()} ETB
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ProgressiveSection>
      )}

      {vitalType === 'payables' && (
        <ProgressiveSection
          title={focusedGroup ? `${focusedGroup.name}'s Payables` : 'Outstanding Payables'}
          icon={<Clock className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {(focusedGroup ? [focusedGroup] : groupedPayables).length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/90">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">No Outstanding Payables Due</div>
                <div className="text-[11px]">All vendor debts are fully settled or offset by handovers & receivables.</div>
              </div>
            ) : (
              (focusedGroup ? [focusedGroup] : groupedPayables).map((group) => {
                const isExpanded = !!focusedGroup || !!expandedParties[group.contactId];
                return (
                  <div
                    key={group.contactId}
                    className="rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 overflow-hidden transition-all text-xs"
                  >
                    {/* Collapsed Header */}
                    <div
                      onClick={() => toggleParty(group.contactId)}
                      className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <button
                          type="button"
                          className="w-5 h-5 rounded flex items-center justify-center text-slate-400"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {group.name}
                            </span>
                            {(group as any).isStaffBonus && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                                Staff Bonus
                              </span>
                            )}
                            {!focusedGroup && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInternalFocusedContactId(group.contactId);
                                }}
                                title={`Focus on ${group.name}'s drawer`}
                                className="text-[10px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              >
                                Focus →
                              </button>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {group.openCount} {group.openCount === 1 ? 'obligation' : 'obligations'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                            −{group.netRemaining.toLocaleString()} ETB
                          </div>
                          {group.offsetAmount > 0.01 && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Offset −{group.offsetAmount.toLocaleString()}
                            </div>
                          )}
                        </div>
                        <div
                          className={`transition-all duration-300 ease-in-out transform ${
                            isExpanded
                              ? 'opacity-0 scale-90 pointer-events-none invisible w-0 overflow-hidden'
                              : 'opacity-100 scale-100 pointer-events-auto visible w-auto'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSettlingParty({
                              id: group.contactId,
                              name: group.name,
                              phone: group.phone,
                              totalRemaining: group.netRemaining,
                              debtCount: group.openCount,
                            })}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs active:scale-95 cursor-pointer ml-1 whitespace-nowrap"
                          >
                            Pay
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Inside List */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/30 p-2.5 space-y-1.5 max-h-52 overflow-y-auto animate-in fade-in duration-200">
                        {group.debts.map((debt) => {
                          const orig = Number(debt.original_amount) || 0;
                          const rem = Number(debt.remaining_amount) || 0;
                          const allocOffset = (debt as any).allocatedOffset || 0;
                          const effectiveRem = (debt as any).effectiveRemaining !== undefined ? (debt as any).effectiveRemaining : rem;

                          const isDbSettled = rem <= 0.001;
                          const isOffsetCovered = !isDbSettled && effectiveRem <= 0.001 && allocOffset > 0.01;
                          const isSettled = isDbSettled || isOffsetCovered;
                          const isPartial = !isSettled && (Number(debt.paid_amount) > 0 || allocOffset > 0.01);
                          const displayAmount = isSettled ? (isDbSettled ? orig : rem) : effectiveRem;

                          return (
                            <div
                              key={debt.id}
                              onClick={() => {
                                if (onSelectDebt) {
                                  onClose();
                                  onSelectDebt(debt);
                                }
                              }}
                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer transition-all ${
                                isSettled
                                  ? 'bg-slate-100/50 dark:bg-slate-900/20 border-slate-200/40 dark:border-slate-800/40 opacity-60'
                                  : 'bg-white dark:bg-[#131926] border-slate-200/60 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    isSettled
                                      ? 'bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {debt.reference_type === 'consignment_sale' ? 'Consignment' : debt.reference_type === 'brokered_sourcing' ? 'Sourcing' : debt.reference_type === 'salesperson_bonus' ? 'Bonus' : 'Payable'}
                                  </span>
                                  {debt.created_at && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {new Date(debt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </span>
                                  )}
                                  {isSettled ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                      Covered
                                    </span>
                                  ) : isPartial ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                      Partial
                                    </span>
                                  ) : null}
                                </div>
                                {!isSettled && allocOffset > 0.01 && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                                    Gross {rem.toLocaleString()} · +{allocOffset.toLocaleString()} Offset
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <div className={`font-mono font-bold text-xs ${
                                  isSettled ? 'text-slate-400 line-through' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  −{displayAmount.toLocaleString()} ETB
                                </div>
                                {!isSettled ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSettlingParty({
                                        id: group.contactId,
                                        name: group.name,
                                        phone: group.phone,
                                        totalRemaining: effectiveRem,
                                        debtCount: 1,
                                      });
                                    }}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-2xs active:scale-95 cursor-pointer"
                                  >
                                    Pay
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-medium text-slate-400 px-1 py-0.5">
                                    Complete
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {group.offsetAmount > 0.01 && (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs">
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                Trade Credit Applied
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                +{Number(group.offsetAmount).toLocaleString()} ETB deducted for devices held by {group.name}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                Net to Pay
                              </div>
                              <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs mt-0.5">
                                −{group.netRemaining.toLocaleString()} ETB
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ProgressiveSection>
      )}

      {vitalType === 'inventory' && (
        <ProgressiveSection
          title="Stock Snapshot"
          icon={<Smartphone className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 text-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-400">Shop-Owned Stock</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {counts.in_stock_phones} units
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Shop-Owned Valuation</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {capital_overview.stock_value.toLocaleString()} ETB
              </span>
            </div>

            {(counts.vendor_consignment_phones ?? 0) > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                  <span>Vendor Stock (Consignment)</span>
                  <span className="font-semibold font-mono text-xs text-amber-600 dark:text-amber-400">
                    {counts.vendor_consignment_phones} units
                  </span>
                </div>
                {capital_overview.vendor_stock_value !== undefined && capital_overview.vendor_stock_value > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Vendor Custody Value</span>
                    <span className="font-mono">
                      {capital_overview.vendor_stock_value.toLocaleString()} ETB
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </ProgressiveSection>
      )}

      {vitalType === 'reserves' && (
        <ProgressiveSection
          title="Reserve Assets"
          icon={<Coins className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Hedge Reserves
              </span>
              <button
                type="button"
                onClick={() => handleOpenCreate('asset_fx')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-900 text-emerald-400 border border-slate-800 text-[11px] font-bold hover:bg-slate-800 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                <span>Add Reserve</span>
              </button>
            </div>

            {reserveAccounts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No active reserve assets. Click "Add Asset Reserve" to store physical gold, crypto, or foreign currency hedges.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl text-[10px] font-semibold mb-2">
                  <button
                    type="button"
                    onClick={() => setReserveTab('all')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      reserveTab === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    All ({reserveAccounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReserveTab('gold')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      reserveTab === 'gold'
                        ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Gold
                  </button>
                  <button
                    type="button"
                    onClick={() => setReserveTab('forex')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      reserveTab === 'forex'
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Forex / USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setReserveTab('other')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      reserveTab === 'other'
                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Other
                  </button>
                </div>

                {filteredReserveAccounts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No matching reserve assets in this category.
                  </div>
                ) : (
                  filteredReserveAccounts.map((acc) => {
                    const cat = getReserveCategory(acc);
                    return (
                      <div
                        key={acc.id}
                        className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <AccountLogo account={acc} size="sm" />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate">{acc.name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{acc.type.replace(/_/g, ' ')}</span>
                              {acc.asset_details?.total_foreign_amount != null ? (
                                <>
                                  <span>&bull;</span>
                                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    {Number(acc.asset_details.total_foreign_amount).toLocaleString()} {acc.currency === 'GOLD' ? 'g' : (acc.currency || 'USD')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>&bull;</span>
                                  <span>{acc.currency}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                              {Number(acc.current_balance).toLocaleString()} ETB
                            </div>
                            {cat === 'gold' ? (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                                Physical Gold
                              </span>
                            ) : cat === 'forex' ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                                Forex & USD
                              </span>
                            ) : (
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold block">
                                Store Reserve
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 pl-1.5 border-l border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleOpenAddBalance(acc)}
                              title="Add Balance"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingAccount(acc)}
                              title="Remove Reserve Asset"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </ProgressiveSection>
      )}
    </SlideOverDrawer>

    {/* Account Management Modal (Create New) */}
    <ManageAccountModal
      isOpen={showAccountModal}
      onClose={() => {
        setShowAccountModal(false);
        setEditingAccount(null);
      }}
      onSaved={() => {
        setShowAccountModal(false);
        setEditingAccount(null);
        if (onRefreshData) onRefreshData();
      }}
      editAccount={editingAccount}
      defaultType={accountDefaultType}
    />

    {/* Dedicated Add Balance Modal */}
    <AddBalanceModal
      isOpen={selectedAccountForBalance !== null}
      onClose={() => setSelectedAccountForBalance(null)}
      onSaved={() => {
        setSelectedAccountForBalance(null);
        if (onRefreshData) onRefreshData();
      }}
      account={selectedAccountForBalance}
    />

    {/* Party Waterfall Settlement Modal */}
    <PartySettleModal
      isOpen={settlingParty !== null}
      onClose={() => setSettlingParty(null)}
      party={settlingParty}
      type={vitalType === 'receivables' ? 'receivable' : 'payable'}
      accounts={accounts}
      onSuccess={() => {
        if (onRefreshData) onRefreshData();
      }}
    />

    {/* Delete Confirmation Modal */}
    {deletingAccount && (
      <div className="fixed inset-0 z-[120] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeletingAccount(null)} />
        <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Remove Account?</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {deletingAccount.name} — {Number(deletingAccount.current_balance).toLocaleString()} ETB
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            This account will be removed from your active accounts list. All dependable historical transactions, sales, and expense records linked to it are preserved in your audit trail.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingAccount(null)}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="h-9 px-5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{deleting ? 'Removing...' : 'Remove'}</span>
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
};
