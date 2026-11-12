import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Plus,
  Sliders,
  Trash2,
  Loader2,
} from 'lucide-react';
import { AccountLogo } from '../../utils/bankLogos';
import { formatCurrencyInput, parseFormattedNumber } from '../../utils/numberUtils';

interface AddBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  account: FinancialAccount | null;
}

export interface ReserveHoldingRow {
  id: string;
  name?: string;
  amount: string;
  rate: string;
}

export const AddBalanceModal: React.FC<AddBalanceModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  account,
}) => {
  const [submitting, setSubmitting] = useState(false);

  // Mode for standard liquid accounts: 'add' (deposit amount) vs 'set' (exact new balance)
  const [balanceMode, setBalanceMode] = useState<'add' | 'set'>('add');
  const [amountToAdd, setAmountToAdd] = useState('');
  const [directBalance, setDirectBalance] = useState('');

  // Reserve holdings state
  const [reserveMode, setReserveMode] = useState<'add_lot' | 'all_lots'>('add_lot');
  const [newLotName, setNewLotName] = useState('');
  const [newLotAmount, setNewLotAmount] = useState('');
  const [newLotRate, setNewLotRate] = useState('');
  const [holdings, setHoldings] = useState<ReserveHoldingRow[]>([]);

  const addInputRef = useRef<HTMLInputElement>(null);

  const isAsset = Boolean(
    account?.is_custom_asset ||
    ['asset_gold', 'asset_fx', 'custom'].includes(account?.type || '')
  );

  const currentBalanceNum = Number(account?.current_balance || 0);

  useEffect(() => {
    if (isOpen && account) {
      setBalanceMode('add');
      setAmountToAdd('');
      setDirectBalance(formatCurrencyInput(currentBalanceNum));
      setReserveMode('add_lot');
      setNewLotName('');
      setNewLotAmount('');

      // Auto-populate last exchange rate if available
      const details = account.asset_details as any;
      if (details && Array.isArray(details.holdings) && details.holdings.length > 0) {
        setHoldings(
          details.holdings.map((h: any, idx: number) => ({
            id: String(h.id || idx + 1),
            name: h.name || '',
            amount: h.amount != null ? formatCurrencyInput(h.amount) : '',
            rate: h.rate != null ? formatCurrencyInput(h.rate) : '',
          }))
        );
        const lastRate = details.holdings[details.holdings.length - 1]?.rate;
        setNewLotRate(lastRate != null ? formatCurrencyInput(lastRate) : '');
      } else if (details && details.total_foreign_amount != null) {
        const fAmt = Number(details.total_foreign_amount);
        const avgRate = fAmt > 0 ? (currentBalanceNum / fAmt).toFixed(2) : '';
        setHoldings([
          {
            id: '1',
            name: '',
            amount: formatCurrencyInput(fAmt),
            rate: formatCurrencyInput(avgRate),
          },
        ]);
        setNewLotRate(formatCurrencyInput(avgRate));
      } else {
        setHoldings([{ id: '1', name: '', amount: '', rate: '' }]);
        setNewLotRate('');
      }

      setTimeout(() => {
        addInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, account]);

  if (!isOpen || !account) return null;

  // Standard Account Calculations
  const parsedAddAmt = parseFormattedNumber(amountToAdd) || 0;
  const parsedDirectBal = parseFormattedNumber(directBalance) || 0;
  const targetStandardBalance =
    balanceMode === 'add'
      ? Math.max(0, currentBalanceNum + parsedAddAmt)
      : Math.max(0, parsedDirectBal);
  const netChange = targetStandardBalance - currentBalanceNum;

  // Quick addition chips
  const QUICK_ADD_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000];

  const handleQuickAdd = (chipAmount: number) => {
    const currentEntered = parseFormattedNumber(amountToAdd) || 0;
    const nextVal = currentEntered + chipAmount;
    setAmountToAdd(formatCurrencyInput(nextVal));
  };

  // Reserve Calculations
  const assetCurrency = account.currency === 'GOLD' ? 'g' : (account.currency || 'USD');
  const details = account.asset_details as any;
  const currentForeignTotal = details?.total_foreign_amount != null
    ? Number(details.total_foreign_amount)
    : holdings.reduce((sum, h) => sum + (parseFormattedNumber(h.amount) || 0), 0);

  const parsedNewLotAmt = parseFormattedNumber(newLotAmount) || 0;
  const parsedNewLotRate = parseFormattedNumber(newLotRate) || 0;
  const newLotEtbValue = parsedNewLotAmt * parsedNewLotRate;

  // Total for 'all_lots' mode
  const allLotsForeignTotal = holdings.reduce(
    (sum, h) => sum + (parseFormattedNumber(h.amount) || 0),
    0
  );
  const allLotsEtbTotal = holdings.reduce((sum, h) => {
    const amt = parseFormattedNumber(h.amount) || 0;
    const rate = parseFormattedNumber(h.rate) || 0;
    return sum + amt * rate;
  }, 0);

  // Resulting Reserve totals
  const resultingForeignTotal =
    reserveMode === 'add_lot'
      ? currentForeignTotal + parsedNewLotAmt
      : allLotsForeignTotal;

  const resultingEtbTotal =
    reserveMode === 'add_lot'
      ? currentBalanceNum + newLotEtbValue
      : allLotsEtbTotal;

  const handleAddHoldingRow = () => {
    const lastRate = holdings.length > 0 ? holdings[holdings.length - 1].rate : '';
    setHoldings((prev) => [
      ...prev,
      { id: Date.now().toString(), name: '', amount: '', rate: lastRate },
    ]);
  };

  const handleRemoveHoldingRow = (id: string) => {
    if (holdings.length <= 1) {
      setHoldings([{ id: '1', name: '', amount: '', rate: '' }]);
      return;
    }
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  const handleUpdateHoldingRow = (id: string, field: 'amount' | 'rate' | 'name', val: string) => {
    const formatted = field === 'name' ? val : formatCurrencyInput(val);
    setHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [field]: formatted } : h))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      if (isAsset) {
        // Reserve balance submission
        let updatedHoldings = [];

        if (reserveMode === 'add_lot') {
          if (parsedNewLotAmt <= 0) {
            toast.error('Please enter an amount to add');
            return;
          }
          if (parsedNewLotRate <= 0) {
            toast.error('Please enter a valid exchange rate');
            return;
          }

          // Existing valid holdings + new lot
          const existingValid = (details?.holdings || []).map((h: any, idx: number) => ({
            id: String(h.id || idx + 1),
            name: h.name || undefined,
            amount: Number(h.amount) || 0,
            rate: Number(h.rate) || 0,
            etb_value: Number(h.etb_value) || (Number(h.amount) || 0) * (Number(h.rate) || 0),
          }));

          const newLot = {
            id: String(Date.now()),
            name: newLotName.trim() || undefined,
            amount: parsedNewLotAmt,
            rate: parsedNewLotRate,
            etb_value: newLotEtbValue,
          };

          updatedHoldings = [...existingValid, newLot];
        } else {
          // All lots mode
          updatedHoldings = holdings
            .filter((h) => {
              const amt = parseFormattedNumber(h.amount);
              return amt !== null && amt > 0;
            })
            .map((h, idx) => {
              const amt = parseFormattedNumber(h.amount) || 0;
              const rate = parseFormattedNumber(h.rate) || 0;
              return {
                id: String(h.id || idx + 1),
                name: h.name?.trim() || undefined,
                amount: amt,
                rate: rate,
                etb_value: amt * rate,
              };
            });
        }

        const finalForeign = updatedHoldings.reduce((sum, h) => sum + h.amount, 0);
        const finalEtb = updatedHoldings.reduce((sum, h) => sum + h.etb_value, 0);

        await api.updateAccount(account.id, {
          current_balance: finalEtb,
          asset_details: {
            currency: account.currency || 'USD',
            total_foreign_amount: finalForeign,
            total_etb_value: finalEtb,
            holdings: updatedHoldings,
          },
        });

        toast.success('Reserve balance updated successfully', {
          description: `${account.name} · Added to reserve. New total: ${finalForeign.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${assetCurrency} (= ${finalEtb.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB)`,
        });
      } else {
        // Standard liquid account submission
        if (balanceMode === 'add' && parsedAddAmt <= 0) {
          toast.error('Please enter an amount to add');
          return;
        }

        await api.updateAccount(account.id, {
          current_balance: targetStandardBalance,
        });

        const changeStr =
          netChange >= 0
            ? `+${netChange.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`
            : `−${Math.abs(netChange).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`;

        toast.success('Account balance updated', {
          description: `${account.name} · ${changeStr} (New balance: ${targetStandardBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB)`,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Failed to update balance', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" style={{ isolation: 'isolate' }}>
      <div className="fixed inset-0 bg-slate-950/45 dark:bg-black/70 animate-backdrop-enter" onClick={onClose} />

      <div
        className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-100 dark:border-slate-800 overflow-hidden animate-modal-smooth flex flex-col max-h-[88vh] sm:max-h-[85vh] my-0 sm:my-auto"
        style={{
          contain: 'layout paint',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-none">
                {isAsset ? 'Add Reserve Balance' : 'Add Balance'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isAsset
                  ? `Add foreign currency or gold holdings to ${account.name}`
                  : `Add money value or adjust balance for ${account.name}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form id="add-balance-form" onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
          {/* Account Identity & Current Balance Banner */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <AccountLogo account={account} size="md" />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                  {account.name}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                  {account.account_number ? (
                    <span className="truncate">{account.account_number}</span>
                  ) : (
                    <span className="capitalize">{account.type.replace(/_/g, ' ')}</span>
                  )}
                  <span>·</span>
                  <span className="uppercase">{account.currency || 'ETB'}</span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Current Balance
              </span>
              <div className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white tabular-nums">
                {currentBalanceNum.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-[10px] font-sans font-medium text-slate-400">ETB</span>
              </div>
              {isAsset && currentForeignTotal > 0 && (
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  {currentForeignTotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {assetCurrency}
                </div>
              )}
            </div>
          </div>

          {/* ══════════ STANDARD LIQUID ACCOUNTS (BANK / MOBILE / CASH) ══════════ */}
          {!isAsset && (
            <div className="space-y-4">
              {/* Mode Selector */}
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setBalanceMode('add')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    balanceMode === 'add'
                      ? 'bg-white dark:bg-[#131926] text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to Balance
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceMode('set')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    balanceMode === 'set'
                      ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Set Exact Balance
                </button>
              </div>

              {balanceMode === 'add' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Amount to Add (ETB)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">+</span>
                      </div>
                      <input
                        ref={addInputRef}
                        type="text"
                        inputMode="decimal"
                        value={amountToAdd}
                        onChange={(e) => setAmountToAdd(formatCurrencyInput(e.target.value))}
                        placeholder="0.00"
                        className="w-full h-10 pl-8 pr-12 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-xs font-bold text-slate-400">ETB</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Addition Chips */}
                  <div>
                    <span className="text-[10px] font-medium text-slate-400 block mb-1.5">Quick Add:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_ADD_AMOUNTS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleQuickAdd(amt)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-emerald-950/40 text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 text-[11px] font-mono font-bold transition-all border border-slate-200/50 dark:border-slate-700/60 cursor-pointer active:scale-95"
                        >
                          +{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Result Calculation Preview */}
                  {parsedAddAmt > 0 && (
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1.5 animate-page-enter">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>Current Balance:</span>
                        <span className="font-mono">{currentBalanceNum.toLocaleString()} ETB</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Amount to Add:</span>
                        <span className="font-mono">+{parsedAddAmt.toLocaleString()} ETB</span>
                      </div>
                      <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        <span>New Total Balance:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">
                          {targetStandardBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      New Total Balance (ETB)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={directBalance}
                        onChange={(e) => setDirectBalance(formatCurrencyInput(e.target.value))}
                        placeholder="0.00"
                        className="w-full h-10 px-3 pr-12 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white"
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-xs font-bold text-slate-400">ETB</span>
                      </div>
                    </div>
                  </div>

                  {netChange !== 0 && (
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-xs flex items-center justify-between font-mono">
                      <span className="text-slate-500">Adjustment:</span>
                      <span className={netChange > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                        {netChange > 0 ? `+${netChange.toLocaleString()} ETB` : `−${Math.abs(netChange).toLocaleString()} ETB`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════ HEDGE RESERVES (GOLD / USD / FOREX) ══════════ */}
          {isAsset && (
            <div className="space-y-4">
              {/* Reserve Mode Selector */}
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReserveMode('add_lot')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    reserveMode === 'add_lot'
                      ? 'bg-white dark:bg-[#131926] text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Holdings Lot
                </button>
                <button
                  type="button"
                  onClick={() => setReserveMode('all_lots')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    reserveMode === 'all_lots'
                      ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Manage All Lots ({holdings.length})
                </button>
              </div>

              {reserveMode === 'add_lot' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                      Lot Name / Item Description <span className="normal-case font-normal text-slate-400">(e.g. Necklace, Ring, 100g Ingot)</span>
                    </label>
                    <input
                      type="text"
                      value={newLotName}
                      onChange={(e) => setNewLotName(e.target.value)}
                      placeholder={account.currency === 'GOLD' ? 'e.g. Necklace, Ring, 21k Bracelet' : 'e.g. Vault Deposit, Exchange Lot'}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Amount to Add ({assetCurrency})
                      </label>
                      <input
                        ref={addInputRef}
                        type="text"
                        inputMode="decimal"
                        value={newLotAmount}
                        onChange={(e) => setNewLotAmount(formatCurrencyInput(e.target.value))}
                        placeholder="e.g. 1,000"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                        Exchange Rate (ETB / {assetCurrency})
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={newLotRate}
                        onChange={(e) => setNewLotRate(formatCurrencyInput(e.target.value))}
                        placeholder="e.g. 135"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white"
                      />
                    </div>
                  </div>

                  {/* Live ETB value for new lot */}
                  {parsedNewLotAmt > 0 && parsedNewLotRate > 0 && (
                    <div className="p-3.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1.5 animate-page-enter">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>New Lot Value:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{newLotEtbValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        <span>Updated Total Valuation:</span>
                        <div className="text-right">
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm sm:text-base block">
                            {resultingEtbTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block font-normal">
                            ({resultingForeignTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {assetCurrency})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <span className="w-5 text-center shrink-0">#</span>
                    <span className="w-28 sm:w-32 shrink-0">Item / Lot Name</span>
                    <span className="flex-1">Amount</span>
                    <span className="w-20 sm:w-24 shrink-0">Rate</span>
                    <span className="w-7 shrink-0"></span>
                  </div>
                  <div className="space-y-2">
                    {holdings.map((h, idx) => (
                      <div key={h.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400 w-5 text-center shrink-0">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={h.name || ''}
                          onChange={(e) => handleUpdateHoldingRow(h.id, 'name', e.target.value)}
                          placeholder="Item (e.g. Ring)"
                          className="w-28 sm:w-32 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white shrink-0"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={h.amount}
                          onChange={(e) => handleUpdateHoldingRow(h.id, 'amount', e.target.value)}
                          placeholder={`Amount (${assetCurrency})`}
                          className="flex-1 min-w-[70px] h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={h.rate}
                          onChange={(e) => handleUpdateHoldingRow(h.id, 'rate', e.target.value)}
                          placeholder="Rate (ETB)"
                          className="w-20 sm:w-24 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white focus:ring-1 focus:ring-inset focus:ring-slate-900 dark:focus:ring-white shrink-0"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveHoldingRow(h.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddHoldingRow}
                    className="w-full h-9 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Lot</span>
                  </button>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500">Total Reserve:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {allLotsForeignTotal.toLocaleString()} {assetCurrency} = {allLotsEtbTotal.toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </form>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131926] shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-balance-form"
            disabled={submitting}
            className="h-10 px-5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-all shadow-xs active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>{isAsset ? 'Confirm & Add Holdings' : 'Add to Balance'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
