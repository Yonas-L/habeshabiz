import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Landmark,
  Wallet,
  Smartphone,
  Coins,
  DollarSign,
  Plus,
  Globe,
  ImagePlus,
  Trash2,
} from 'lucide-react';
import { PRESET_BANK_LOGOS, PRESET_RESERVE_LOGOS } from '../../utils/bankLogos';
import { formatCurrencyInput, parseFormattedNumber } from '../../utils/numberUtils';
import { LdrsSpinner } from '../loading/LdrsSpinner';

interface ManageAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editAccount?: FinancialAccount | null;
  defaultType?: string;
}

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank Account', icon: Landmark, color: 'purple', isAsset: false },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone, color: 'sky', isAsset: false },
  { value: 'cash', label: 'Cash Drawer', icon: Wallet, color: 'emerald', isAsset: false },
  { value: 'asset_fx', label: 'Foreign Currency', icon: DollarSign, color: 'green', isAsset: true },
  { value: 'asset_gold', label: 'Gold Reserve', icon: Coins, color: 'amber', isAsset: true },
  { value: 'custom', label: 'Custom Asset', icon: Globe, color: 'slate', isAsset: true },
];

export interface ReserveHoldingRow {
  id: string;
  amount: string; // foreign amount input, e.g. "13,000"
  rate: string;   // exchange rate input in ETB, e.g. "135"
}

const PRESET_RESERVE_CURRENCIES = [
  { code: 'USD', label: 'USD ($)', symbol: '$', presetId: 'usd' },
  { code: 'USDT', label: 'USDT (₮)', symbol: '₮', presetId: 'usdt' },
  { code: 'GOLD', label: 'Gold (g)', symbol: 'g', presetId: 'gold' },
  { code: 'EUR', label: 'EUR (€)', symbol: '€', presetId: 'eur' },
  { code: 'GBP', label: 'GBP (£)', symbol: '£', presetId: 'gbp' },
  { code: 'AED', label: 'AED (د.إ)', symbol: 'د.إ', presetId: 'aed' },
  { code: 'SAR', label: 'SAR (SR)', symbol: 'SR', presetId: 'vault' },
  { code: 'CAD', label: 'CAD (C$)', symbol: 'C$', presetId: 'vault' },
];

export const ManageAccountModal: React.FC<ManageAccountModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editAccount,
  defaultType,
}) => {
  const isEditing = !!editAccount;

  // General state
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState(defaultType || 'bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [isCustomCurrency, setIsCustomCurrency] = useState(false);
  const [customCurrencyCode, setCustomCurrencyCode] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Bank / Cash specific state
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceAdjustment, setBalanceAdjustment] = useState('');
  const [feeType, setFeeType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [feeAmount, setFeeAmount] = useState('');

  // Reserve Asset Holdings state
  const [holdings, setHoldings] = useState<ReserveHoldingRow[]>([
    { id: '1', amount: '', rate: '' },
  ]);
  const rowInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusIdRef = useRef<string | null>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast.error('Logo too large', { description: 'Please use an image under 200KB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Determine if this is a Reserve Asset
  const isAssetType = isEditing
    ? Boolean(
        editAccount?.is_custom_asset ||
        ['asset_gold', 'asset_fx', 'custom'].includes(editAccount?.type || '')
      )
    : ['asset_gold', 'asset_fx', 'custom'].includes(accountType);

  useEffect(() => {
    if (isOpen) {
      if (editAccount) {
        setName(editAccount.name || '');
        setAccountType(editAccount.type || 'bank');
        setAccountNumber(editAccount.account_number || '');
        setLogo(editAccount.logo || null);

        const isAsset = Boolean(
          editAccount.is_custom_asset ||
          ['asset_gold', 'asset_fx', 'custom'].includes(editAccount.type)
        );

        if (isAsset) {
          const accCurrency = editAccount.currency || (editAccount.asset_details as any)?.currency || 'USD';
          const isPresetCurr = PRESET_RESERVE_CURRENCIES.some((c) => c.code === accCurrency);

          if (isPresetCurr) {
            setCurrency(accCurrency);
            setIsCustomCurrency(false);
            setCustomCurrencyCode('');
          } else {
            setCurrency('CUSTOM');
            setIsCustomCurrency(true);
            setCustomCurrencyCode(accCurrency);
          }

          // Restore dynamic holdings
          const details = editAccount.asset_details as any;
          if (details && Array.isArray(details.holdings) && details.holdings.length > 0) {
            setHoldings(
              details.holdings.map((h: any, idx: number) => ({
                id: String(h.id || idx + 1),
                amount: h.amount != null ? formatCurrencyInput(h.amount) : '',
                rate: h.rate != null ? formatCurrencyInput(h.rate) : '',
              }))
            );
          } else if (details && details.total_foreign_amount != null) {
            const fAmt = Number(details.total_foreign_amount);
            const curBal = Number(editAccount.current_balance || details.total_etb_value || 0);
            const avgRate = fAmt > 0 ? (curBal / fAmt).toFixed(2) : '';
            setHoldings([
              {
                id: '1',
                amount: formatCurrencyInput(fAmt),
                rate: formatCurrencyInput(avgRate),
              },
            ]);
          } else if (editAccount.current_balance != null && Number(editAccount.current_balance) > 0) {
            setHoldings([
              {
                id: '1',
                amount: formatCurrencyInput(editAccount.current_balance),
                rate: '1',
              },
            ]);
          } else {
            setHoldings([{ id: '1', amount: '', rate: '' }]);
          }
        } else {
          // Normal bank/cash account
          setCurrency(editAccount.currency || 'ETB');
          setIsCustomCurrency(false);
          setOpeningBalance(
            editAccount.current_balance != null ? String(editAccount.current_balance) : '0'
          );
          setBalanceAdjustment(
            editAccount.current_balance != null ? String(editAccount.current_balance) : '0'
          );
          setFeeType(
            editAccount.default_fee_type === 'percentage' || editAccount.default_fee_type === 'fixed'
              ? editAccount.default_fee_type
              : 'none'
          );
          setFeeAmount(
            editAccount.default_fee_amount != null && Number(editAccount.default_fee_amount) > 0
              ? String(Number(editAccount.default_fee_amount))
              : ''
          );
        }
      } else {
        // Creating new account
        setName('');
        const initialType = defaultType || 'bank';
        setAccountType(initialType);
        setAccountNumber('');
        setIsCustomCurrency(false);
        setCustomCurrencyCode('');

        const isAsset = ['asset_gold', 'asset_fx', 'custom'].includes(initialType);
        if (isAsset) {
          const initCurr = initialType === 'asset_gold' ? 'GOLD' : 'USD';
          setCurrency(initCurr);
          // Set matching preset reserve logo
          const matchingPreset = PRESET_RESERVE_LOGOS.find((p) => p.currency === initCurr) || PRESET_RESERVE_LOGOS[0];
          setLogo(matchingPreset.dataUri);
          setHoldings([{ id: '1', amount: '', rate: '' }]);
        } else {
          setCurrency('ETB');
          setLogo(null);
          setOpeningBalance('');
          setBalanceAdjustment('');
          setFeeType('none');
          setFeeAmount('');
        }
      }
    }
  }, [isOpen, editAccount, defaultType]);

  // Holdings manipulation with auto-focus and auto-scroll
  const addHoldingRow = () => {
    const lastRate = holdings.length > 0 ? holdings[holdings.length - 1].rate : '';
    const newId = Date.now().toString();
    pendingFocusIdRef.current = newId;
    setHoldings((prev) => [
      ...prev,
      { id: newId, amount: '', rate: lastRate },
    ]);
  };

  useEffect(() => {
    if (pendingFocusIdRef.current) {
      const targetId = pendingFocusIdRef.current;
      pendingFocusIdRef.current = null;
      setTimeout(() => {
        const el = rowInputRefs.current[targetId];
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }, [holdings]);

  const removeHoldingRow = (id: string) => {
    if (holdings.length <= 1) {
      setHoldings([{ id: '1', amount: '', rate: '' }]);
      return;
    }
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  const updateHoldingAmount = (id: string, rawVal: string) => {
    const formatted = formatCurrencyInput(rawVal);
    setHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, amount: formatted } : h))
    );
  };

  const updateHoldingRate = (id: string, rawVal: string) => {
    const formatted = formatCurrencyInput(rawVal);
    setHoldings((prev) =>
      prev.map((h) => (h.id === id ? { ...h, rate: formatted } : h))
    );
  };

  // Currency selection handler for reserves
  const handleSelectReserveCurrency = (code: string) => {
    if (code === 'CUSTOM') {
      setIsCustomCurrency(true);
      setCurrency('CUSTOM');
      return;
    }

    setIsCustomCurrency(false);
    setCurrency(code);

    // If logo is null or matches one of the preset reserve logos, auto-switch to corresponding preset logo
    const isPresetCurrentLogo = !logo || PRESET_RESERVE_LOGOS.some((p) => p.dataUri === logo);
    if (isPresetCurrentLogo) {
      const match = PRESET_RESERVE_LOGOS.find((p) => p.currency === code);
      if (match) {
        setLogo(match.dataUri);
      }
    }
  };

  // Live totals calculation for reserve assets
  const effectiveCurrency = isCustomCurrency
    ? (customCurrencyCode.trim().toUpperCase() || 'CUSTOM')
    : currency;

  const totalForeignAmount = holdings.reduce((sum, h) => {
    const amt = parseFormattedNumber(h.amount) || 0;
    return sum + amt;
  }, 0);

  const totalEtbValue = holdings.reduce((sum, h) => {
    const amt = parseFormattedNumber(h.amount) || 0;
    const rate = parseFormattedNumber(h.rate) || 0;
    return sum + amt * rate;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(isAssetType ? 'Please enter a reserve name' : 'Please enter an account name');
      return;
    }

    try {
      setSubmitting(true);

      if (isAssetType) {
        // Reserve Asset submission flow
        const validHoldings = holdings
          .filter((h) => {
            const amt = parseFormattedNumber(h.amount);
            return amt !== null && amt > 0;
          })
          .map((h, idx) => {
            const amt = parseFormattedNumber(h.amount) || 0;
            const rate = parseFormattedNumber(h.rate) || 0;
            return {
              id: String(h.id || idx + 1),
              amount: amt,
              rate: rate,
              etb_value: amt * rate,
            };
          });

        const computedForeignTotal = validHoldings.reduce((sum, h) => sum + h.amount, 0);
        const computedEtbTotal = validHoldings.reduce((sum, h) => sum + h.etb_value, 0);

        const reserveType =
          effectiveCurrency === 'GOLD'
            ? 'asset_gold'
            : ['USD', 'USDT', 'EUR', 'GBP', 'AED', 'SAR', 'CAD'].includes(effectiveCurrency)
            ? 'asset_fx'
            : 'custom';

        const assetDetailsPayload = {
          currency: effectiveCurrency,
          total_foreign_amount: computedForeignTotal,
          total_etb_value: computedEtbTotal,
          holdings: validHoldings,
        };

        if (isEditing && editAccount) {
          await api.updateAccount(editAccount.id, {
            name: name.trim(),
            type: reserveType,
            currency: effectiveCurrency,
            logo: logo ?? null,
            current_balance: computedEtbTotal,
            is_custom_asset: true,
            asset_details: assetDetailsPayload,
          });
          toast.success('Reserve updated successfully', {
            description: `${name.trim()} · ${computedForeignTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${effectiveCurrency} (= ${computedEtbTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB)`,
          });
        } else {
          await api.createAccount({
            name: name.trim(),
            type: reserveType,
            currency: effectiveCurrency,
            logo: logo ?? undefined,
            opening_balance: computedEtbTotal,
            is_custom_asset: true,
            asset_details: assetDetailsPayload,
          });
          toast.success('Reserve created successfully', {
            description: `${name.trim()} · ${computedForeignTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${effectiveCurrency} (= ${computedEtbTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB)`,
          });
        }
      } else {
        // Standard Liquid Account (Bank/Mobile/Cash) submission flow
        const parsedFee = feeType !== 'none' && feeAmount ? parseFloat(feeAmount) : 0;

        if (isEditing && editAccount) {
          await api.updateAccount(editAccount.id, {
            name: name.trim(),
            type: accountType,
            account_number: accountNumber.trim() || null,
            currency: currency || 'ETB',
            logo: logo ?? null,
            default_fee_type: feeType,
            default_fee_amount: parsedFee,
            ...(balanceAdjustment !== '' ? { current_balance: parseFloat(balanceAdjustment) } : {}),
          });
          toast.success('Account updated', { description: name });
        } else {
          await api.createAccount({
            name: name.trim(),
            type: accountType,
            account_number: accountNumber.trim() || undefined,
            currency: currency || 'ETB',
            opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
            default_fee_type: feeType,
            default_fee_amount: parsedFee,
            is_custom_asset: false,
            logo: logo ?? undefined,
          });
          toast.success('Account created', { description: name });
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Failed to save account', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const colorMap: Record<string, string> = {
    purple: 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30',
    sky: 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/30',
    emerald: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30',
    amber: 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30',
    green: 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30',
    slate: 'border-slate-500 bg-slate-50/50 dark:bg-slate-950/30',
  };

  const inactiveStyle =
    'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60';

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl mx-0 sm:mx-4 bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden max-sm:animate-bottom-sheet sm:animate-modal-enter max-h-[90vh] sm:max-h-[88vh] flex flex-col my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              {isAssetType ? <Coins className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {isEditing
                  ? isAssetType
                    ? 'Edit Reserve'
                    : 'Edit Account'
                  : isAssetType
                  ? 'Add Reserve'
                  : 'Add Account'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isAssetType
                  ? 'Hedge asset with live ETB conversion'
                  : 'Bank, mobile wallet, or cash drawer'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          {/* Account Category Selector */}
          {!isEditing && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Category
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {ACCOUNT_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = accountType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setAccountType(t.value);
                        if (t.isAsset) {
                          const newCurr = t.value === 'asset_gold' ? 'GOLD' : 'USD';
                          setCurrency(newCurr);
                          setIsCustomCurrency(false);
                          const match = PRESET_RESERVE_LOGOS.find((p) => p.currency === newCurr);
                          if (match) setLogo(match.dataUri);
                        } else {
                          setCurrency('ETB');
                          setIsCustomCurrency(false);
                          setLogo(null);
                        }
                      }}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-center cursor-pointer ${
                        isSelected
                          ? colorMap[t.color] || 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                          : inactiveStyle
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400'
                        }`}
                      />
                      <span
                        className={`text-[9px] font-bold leading-tight ${
                          isSelected
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RESERVE ASSET FLOW: Minimal & Flat UI                                    */}
          {/* ========================================================================= */}
          {isAssetType ? (
            <div className="space-y-4">
              {/* 1. CHOOSE ICON */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Icon
                </label>

                {/* Preset Reserve Icon Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-2">
                  {PRESET_RESERVE_LOGOS.map((preset) => {
                    const isSelected = logo === preset.dataUri;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setLogo(preset.dataUri)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-950/20 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40'
                        }`}
                        title={preset.name}
                      >
                        <img
                          src={preset.dataUri}
                          alt={preset.shortCode}
                          className="w-7 h-7 rounded-lg object-cover"
                        />
                        <span
                          className={`text-[9px] font-bold leading-tight ${
                            isSelected
                              ? 'text-emerald-500 dark:text-emerald-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {preset.shortCode}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Minimal Custom File Button */}
                <div className="flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="h-6 px-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ImagePlus className="w-3 h-3 text-slate-400" />
                    <span>Upload Custom</span>
                  </button>
                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo(null)}
                      className="text-[10px] text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* 2. RESERVE NAME */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    currency === 'GOLD'
                      ? 'e.g. Dubai 24K Gold Bar, 21K Ingot Reserve'
                      : currency === 'USDT'
                      ? 'e.g. Bybit USDT, Binance Cold Wallet'
                      : 'e.g. USD Safe Vault, Commercial FX Reserve'
                  }
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* 3. CHOOSE CURRENCY */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Currency
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_RESERVE_CURRENCIES.map((c) => {
                    const isSelected = !isCustomCurrency && currency === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleSelectReserveCurrency(c.code)}
                        className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 border-slate-800 shadow-xs ring-1 ring-emerald-500/30'
                            : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleSelectReserveCurrency('CUSTOM')}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      isCustomCurrency
                        ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 border-slate-800 shadow-xs ring-1 ring-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {isCustomCurrency && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={customCurrencyCode}
                      onChange={(e) => setCustomCurrencyCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AUD, CHF, QAR, SAR"
                      maxLength={8}
                      className="w-32 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold uppercase text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    />
                    <span className="text-[10px] text-slate-400">
                      Enter currency code
                    </span>
                  </div>
                )}
              </div>

              {/* 4. DYNAMIC HOLDINGS & LIVE CONVERSION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Holdings & Rate
                  </label>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap">
                    {holdings.length} {holdings.length === 1 ? 'Lot' : 'Lots'}
                  </span>
                </div>

                {/* Column header labels */}
                <div className="grid grid-cols-[1fr_auto_1fr_auto_minmax(90px,1.2fr)_auto] gap-1.5 sm:gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <div>Amount ({effectiveCurrency})</div>
                  <div className="w-3 text-center invisible">×</div>
                  <div>ETB Price</div>
                  <div className="w-3 text-center invisible">=</div>
                  <div className="text-right">ETB Value</div>
                  <div className="w-7 invisible"></div>
                </div>

                {/* Scrollable list of entries */}
                <div className="max-h-52 sm:max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {holdings.map((row) => {
                    const rowAmt = parseFormattedNumber(row.amount) || 0;
                    const rowRate = parseFormattedNumber(row.rate) || 0;
                    const rowEtb = rowAmt * rowRate;
                    const rowEtbFormatted = rowEtb.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    });

                    return (
                      <div
                        key={row.id}
                        className="grid grid-cols-[1fr_auto_1fr_auto_minmax(90px,1.2fr)_auto] gap-1.5 sm:gap-2 items-center"
                      >
                        {/* Left: Amount input with auto-focus ref */}
                        <div className="relative">
                          <input
                            ref={(el) => {
                              rowInputRefs.current[row.id] = el;
                            }}
                            type="text"
                            inputMode="decimal"
                            value={row.amount}
                            onChange={(e) => updateHoldingAmount(row.id, e.target.value)}
                            placeholder="0.00"
                            className="w-full h-8.5 pl-2.5 pr-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                            {effectiveCurrency === 'GOLD' ? 'g' : effectiveCurrency}
                          </span>
                        </div>

                        {/* Multiplication Symbol */}
                        <span className="text-slate-400 font-bold text-xs select-none px-0.5">
                          ×
                        </span>

                        {/* Right: ETB Price / Exchange Rate */}
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.rate}
                            onChange={(e) => updateHoldingRate(row.id, e.target.value)}
                            placeholder="Rate"
                            className="w-full h-8.5 pl-2.5 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none">
                            ETB
                          </span>
                        </div>

                        {/* Equal Symbol */}
                        <span className="text-slate-400 font-bold text-xs select-none px-0.5">
                          =
                        </span>

                        {/* Clean ETB Value text output (No nested double-border box) */}
                        <div className="text-right font-mono font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 tabular-nums truncate px-1">
                          <span>{rowEtbFormatted}</span>
                          <span className="text-[10px] text-slate-400 font-sans font-medium ml-1">
                            ETB
                          </span>
                        </div>

                        {/* Row Delete Button */}
                        {holdings.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeHoldingRow(row.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="w-7 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Minimal Add Entry Button */}
                <button
                  type="button"
                  onClick={addHoldingRow}
                  className="h-8 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 hover:border-emerald-500 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all w-full cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Add Entry</span>
                </button>
              </div>

              {/* 5. MINIMAL SUMMARY FOOTER (No heavy nested card box) */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Owned ({effectiveCurrency})
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white tabular-nums">
                    {totalForeignAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-[10px] font-sans font-bold text-slate-400">
                      {effectiveCurrency === 'GOLD' ? 'g' : effectiveCurrency}
                    </span>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Valuation
                  </span>
                  <span className="text-sm sm:text-base font-black font-mono text-emerald-500 dark:text-emerald-400 tabular-nums">
                    {totalEtbValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-[10px] font-sans font-bold text-emerald-500/70">
                      ETB
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* STANDARD LIQUID ACCOUNT FLOW: Bank, Mobile Money, Cash Drawer            */
            /* ========================================================================= */
            <div className="space-y-4">
              {/* Account Name & Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      accountType === 'bank'
                        ? 'e.g. CBE Savings'
                        : accountType === 'mobile_money'
                        ? 'e.g. TeleBirr'
                        : 'e.g. Shop Cash Drawer'
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 1000xxxxxxxx"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Bank Logo Presets */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Bank / Account Logo (optional)
                </label>

                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {PRESET_BANK_LOGOS.map((preset) => {
                    const isSelected = logo === preset.dataUri;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setLogo(preset.dataUri)}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-xs'
                            : 'border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                        title={preset.name}
                      >
                        <img
                          src={preset.dataUri}
                          alt={preset.shortCode}
                          className="w-7 h-7 rounded-md object-cover"
                        />
                        <span
                          className={`text-[8px] font-bold leading-tight ${
                            isSelected
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {preset.shortCode}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="h-6 px-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ImagePlus className="w-3 h-3 text-slate-400" />
                    <span>Upload Custom</span>
                  </button>
                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo(null)}
                      className="text-[10px] text-rose-500 hover:text-rose-700 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Currency & Opening Balance / Balance Adjustment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  >
                    <option value="ETB">ETB — Ethiopian Birr</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="USDT">USDT — Tether</option>
                    <option value="GBP">GBP — British Pound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    {isEditing ? 'Current Balance' : 'Opening Balance'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={isEditing ? balanceAdjustment : openingBalance}
                    onChange={(e) =>
                      isEditing
                        ? setBalanceAdjustment(e.target.value)
                        : setOpeningBalance(e.target.value)
                    }
                    placeholder="0.00"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  />
                  {isEditing && (
                    <p className="text-[10px] text-slate-400 mt-1">Direct balance adjustment</p>
                  )}
                </div>
              </div>

              {/* Outgoing Transaction Fee (Optional) */}
              <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-850 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 block">
                      Outgoing Transaction Fee (Optional)
                    </span>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Auto-deducted on transfers & payouts to match carrier/bank charges.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  {/* Fee Type Pill Selector */}
                  <div className="col-span-12 sm:col-span-6 flex rounded-xl bg-white dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        setFeeType('none');
                        setFeeAmount('');
                      }}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        feeType === 'none'
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      No Fee
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeeType('percentage')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        feeType === 'percentage'
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeeType('fixed')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        feeType === 'fixed'
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Fixed ETB
                    </button>
                  </div>

                  {/* Fee Value Input */}
                  {feeType !== 'none' ? (
                    <div className="col-span-12 sm:col-span-6 relative">
                      <input
                        type="number"
                        step={feeType === 'percentage' ? '0.01' : '1'}
                        min="0"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        placeholder={feeType === 'percentage' ? 'e.g. 1.5' : 'e.g. 10'}
                        className="w-full h-8 pl-2.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase pointer-events-none">
                        {feeType === 'percentage' ? '%' : currency}
                      </span>
                    </div>
                  ) : (
                    <div className="col-span-12 sm:col-span-6 flex items-center text-[10px] text-slate-400 px-2 italic">
                      0 fee per transaction
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-9 px-5 rounded-xl bg-slate-900 dark:bg-slate-900 text-emerald-400 border border-slate-800 hover:bg-slate-800 hover:text-emerald-300 text-xs font-bold transition-all shadow-xs active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <>
                <LdrsSpinner variant="ring2" size={14} color="#34d399" />
                <span>Saving...</span>
              </>
            ) : (
              <span>
                {isEditing
                  ? 'Save Changes'
                  : isAssetType
                  ? 'Create Reserve'
                  : 'Create Account'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
