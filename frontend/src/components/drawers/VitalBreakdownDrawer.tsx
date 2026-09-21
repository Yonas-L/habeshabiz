import React from 'react';
import type { DashboardData, FinancialAccount, Debt } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { ProgressiveSection } from './ProgressiveSection';
import { AnimatedNumber } from '../AnimatedNumber';
import {
  Landmark,
  CreditCard,
  Smartphone,
  Coins,
  ArrowRight,
  Clock,
} from 'lucide-react';

export type VitalType = 'cash' | 'receivables' | 'inventory' | 'reserves' | 'payables';

interface VitalBreakdownDrawerProps {
  vitalType: VitalType | null;
  isOpen: boolean;
  onClose: () => void;
  data: DashboardData | null;
  accounts: FinancialAccount[];
  onNavigateTab: (tab: any) => void;
  onSelectDebt?: (debt: Debt) => void;
}

export const VitalBreakdownDrawer: React.FC<VitalBreakdownDrawerProps> = ({
  vitalType,
  isOpen,
  onClose,
  data,
  accounts,
  onNavigateTab,
  onSelectDebt,
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

  const liquidAccounts = accounts.filter((a) => !a.is_custom_asset);
  const reserveAccounts = accounts.filter((a) => a.is_custom_asset);

  return (
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
          <div className="space-y-2">
            {liquidAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{acc.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {acc.account_number || acc.type.replace(/_/g, ' ')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {Number(acc.current_balance).toLocaleString()} ETB
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Reconciled
                  </span>
                </div>
              </div>
            ))}
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
            {top_receivables.map((debt) => (
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white">{debt.contact?.name}</span>
                    {debt.reference_type === 'handover_holding' && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                        Handover Holding
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {debt.reference_type === 'handover_holding'
                      ? 'Vendor holding · Owes upon sale or returns device'
                      : (debt.notes || 'Customer credit balance')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    +{Number(debt.remaining_amount).toLocaleString()} ETB
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Click to collect &rarr;
                  </span>
                </div>
              </div>
            ))}
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
            {top_payables.map((debt) => (
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white">{debt.contact?.name}</span>
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
                    {debt.reference_type === 'consignment_sale'
                      ? 'Agreed vendor payout for sold consignment device'
                      : debt.reference_type === 'brokered_sourcing'
                      ? 'Peer shop sourced phone balance'
                      : (debt.notes || 'Supplier payable obligation')}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                    −{Number(debt.remaining_amount).toLocaleString()} ETB
                  </div>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                    Click to settle &rarr;
                  </span>
                </div>
              </div>
            ))}
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
          <div className="space-y-2">
            {reserveAccounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{acc.name}</div>
                  <div className="text-[11px] text-slate-400">
                    Hedge Asset &bull; {acc.currency}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {Number(acc.current_balance).toLocaleString()} ETB
                  </div>
                  <span className="text-[10px] text-amber-600 font-semibold">Store Reserve</span>
                </div>
              </div>
            ))}
          </div>
        </ProgressiveSection>
      )}
    </SlideOverDrawer>
  );
};
