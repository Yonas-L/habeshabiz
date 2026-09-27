import React, { useState } from 'react';
import type { DashboardData, FinancialAccount, Debt } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { SlideOverDrawer } from './SlideOverDrawer';
import { ProgressiveSection } from './ProgressiveSection';
import { AnimatedNumber } from '../AnimatedNumber';
import { ManageAccountModal } from '../treasury/ManageAccountModal';
import {
  Landmark,
  CreditCard,
  Smartphone,
  Coins,
  ArrowRight,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { AccountLogo } from '../../utils/bankLogos';

export type VitalType = 'cash' | 'receivables' | 'inventory' | 'reserves' | 'payables';

interface VitalBreakdownDrawerProps {
  vitalType: VitalType | null;
  isOpen: boolean;
  onClose: () => void;
  data: DashboardData | null;
  accounts: FinancialAccount[];
  onNavigateTab: (tab: any) => void;
  onSelectDebt?: (debt: Debt) => void;
  onRefreshData?: () => void;
}

export const VitalBreakdownDrawer: React.FC<VitalBreakdownDrawerProps> = ({
  vitalType,
  isOpen,
  onClose,
  data,
  accounts,
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
      title: 'Available Liquid Cash',
      subtitle: 'Cash Drawer & Verified Bank Accounts',
      amount: capital_overview.cash_and_banks,
      icon: Landmark,
      targetTab: 'treasury',
      actionLabel: 'Open Treasury Workspace',
    },
    receivables: {
      title: 'Money Owed to You (Receivables)',
      subtitle: 'Customer Credit, Vendor Handover Holdings & Inflows',
      amount: capital_overview.receivables,
      icon: CreditCard,
      targetTab: 'debts',
      actionLabel: 'Open Receivable & Payable Ledger',
    },
    payables: {
      title: 'Money You Owe (Payables)',
      subtitle: 'Supplier Debts, Broker Cuts & Consignment Payouts',
      amount: capital_overview.payables,
      icon: Clock,
      targetTab: 'debts',
      actionLabel: 'Open Receivable & Payable Ledger',
    },
    inventory: {
      title: 'Physical Shop Inventory',
      subtitle: 'Phones, Consoles & Electronics on Shelf',
      amount: capital_overview.stock_value,
      icon: Smartphone,
      targetTab: 'inventory',
      actionLabel: 'Open Inventory Catalog',
    },
    reserves: {
      title: 'Store Gold & FX Reserves',
      subtitle: 'Physical Gold Bars & Crypto/USDT Hedge',
      amount: capital_overview.custom_assets,
      icon: Coins,
      targetTab: 'treasury',
      actionLabel: 'Manage Asset Reserves',
    },
  };

  const current = vitalConfig[vitalType];
  const Icon = current.icon;

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountDefaultType, setAccountDefaultType] = useState('bank');
  const [deletingAccount, setDeletingAccount] = useState<FinancialAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenCreate = (type = 'bank') => {
    setEditingAccount(null);
    setAccountDefaultType(type);
    setShowAccountModal(true);
  };

  const handleOpenEdit = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setAccountDefaultType(acc.type);
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

  return (
    <>
      <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={current.title}
      subtitle={current.subtitle}
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          Store Asset
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

          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigateTab(current.targetTab);
            }}
            className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <span>{current.actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </>
      }
    >
      {/* Hero Metric Card */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Total Valuation
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-1">
            <AnimatedNumber value={current.amount} />{' '}
            <span className="text-sm font-bold text-slate-400 font-sans">ETB</span>
          </div>
        </div>

        <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-xs">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {/* Conditional Content by Vital Type */}
      {vitalType === 'cash' && (
        <ProgressiveSection
          title={`Liquid Accounts (${liquidAccounts.length})`}
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
                        Reconciled
                      </span>
                    </div>

                    <div className="flex items-center gap-1 pl-1.5 border-l border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(acc)}
                        title="Edit Account"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
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
          title={`Receivables & Handover Holdings (${counts.open_receivables} pending)`}
          icon={<CreditCard className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {top_receivables.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/90">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">No Open Receivables</div>
                <div className="text-[11px]">All customer and partner receivables are settled.</div>
              </div>
            ) : (
              top_receivables.map((debt) => (
                <div
                  key={debt.id}
                  onClick={() => {
                    if (onSelectDebt) {
                      onClose();
                      onSelectDebt(debt);
                    }
                  }}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white">{debt.contact?.name}</span>
                      {debt.reference_type === 'handover_holding' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                          Handover
                        </span>
                      )}
                      {debt.reference_type === 'vendor_return_refund' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                          Return Refund
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {debt.reference_type === 'handover_holding'
                        ? 'Vendor holding · Owes upon sale or returns device'
                        : debt.reference_type === 'vendor_return_refund'
                        ? 'Refund owed by vendor for returned device'
                        : (debt.notes || 'Customer credit balance')}
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                      +{Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    {debt.contact && (debt.contact.open_payable ?? 0) > 0 ? (
                      <div className="text-[10px] text-slate-400 font-mono">
                        Net: <span className="font-bold text-emerald-600 dark:text-emerald-400">+{(debt.contact.net_balance ?? 0).toLocaleString()} ETB</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Click to collect &rarr;
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ProgressiveSection>
      )}

      {vitalType === 'payables' && (
        <ProgressiveSection
          title={`Outstanding Payables (${counts.open_payables} pending)`}
          icon={<Clock className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {top_payables.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/90">
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">No Outstanding Payables Due</div>
                <div className="text-[11px]">All vendor debts are fully settled or offset by handovers & receivables.</div>
              </div>
            ) : (
              top_payables.map((debt) => (
                <div
                  key={debt.id}
                  onClick={() => {
                    if (onSelectDebt) {
                      onClose();
                      onSelectDebt(debt);
                    }
                  }}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white">{debt.contact?.name}</span>
                      {debt.reference_type === 'salesperson_bonus' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300">
                          Sales Bonus
                        </span>
                      )}
                      {debt.reference_type === 'consignment_sale' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                          Consignment Cut
                        </span>
                      )}
                      {debt.reference_type === 'brokered_sourcing' && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                          Peer Sourcing
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {debt.reference_type === 'salesperson_bonus'
                        ? 'Earned agent bonus for selling above set price'
                        : debt.reference_type === 'consignment_sale'
                        ? 'Agreed vendor payout for sold consignment device'
                        : debt.reference_type === 'brokered_sourcing'
                        ? 'Peer shop sourced phone balance'
                        : (debt.notes || 'Supplier payable obligation')}
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                      −{Number(debt.remaining_amount).toLocaleString()} ETB
                    </div>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                      Click to settle &rarr;
                    </span>
                  </div>
                </div>
              ))
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
              <span className="text-slate-400">Total Units in Stock</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {counts.in_stock_phones} units
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Valuation</span>
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {capital_overview.stock_value.toLocaleString()} ETB
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
              Real-time cost valuation across smartphones, PlayStation consoles, TVs, and shop accessories.
            </p>
          </div>
        </ProgressiveSection>
      )}

      {vitalType === 'reserves' && (
        <ProgressiveSection
          title={`Reserve Assets (${reserveAccounts.length})`}
          icon={<Coins className="w-4 h-4" />}
          defaultOpen={true}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Store Hedge Reserves (Gold & Forex)
              </span>
              <button
                type="button"
                onClick={() => handleOpenCreate('asset_gold')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-amber-400 dark:text-amber-600" />
                <span>Add Asset Reserve</span>
              </button>
            </div>

            {reserveAccounts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No active reserve assets. Click "Add Asset Reserve" to store physical gold, crypto, or forex hedges.
              </div>
            ) : (
              reserveAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <AccountLogo account={acc} size="sm" />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{acc.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {acc.type.replace(/_/g, ' ')} &bull; {acc.currency}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {Number(acc.current_balance).toLocaleString()} ETB
                      </div>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                        Store Reserve
                      </span>
                    </div>

                    <div className="flex items-center gap-1 pl-1.5 border-l border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(acc)}
                        title="Edit Reserve Asset"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
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
              ))
            )}
          </div>
        </ProgressiveSection>
      )}
    </SlideOverDrawer>

    {/* Account Management Modal */}
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

    {/* Delete Confirmation Modal */}
    {deletingAccount && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
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
