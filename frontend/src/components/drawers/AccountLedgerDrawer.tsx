import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { FinancialAccount, AccountActivitiesResponse } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { AccountLogo, PRESET_BANK_LOGOS, PRESET_RESERVE_LOGOS } from '../../utils/bankLogos';
import { AnimatedNumber } from '../AnimatedNumber';
import { toast } from 'sonner';
import { formatLocalDate } from '../../utils/dateUtils';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Search,
  Download,
  Copy,
  Check,
  Calendar,
  X,
  RefreshCw,
  Receipt,
  ChevronDown,
  ChevronUp,
  Layers,
  TrendingUp,
  Pencil,
  Plus,
  ImagePlus,
} from 'lucide-react';
import { LdrsSpinner } from '../loading/LdrsSpinner';

interface AccountLedgerDrawerProps {
  account: FinancialAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenTransfer?: (accountId: string) => void;
  onOpenAddBalance?: (account: FinancialAccount) => void;
  onAccountUpdated?: (account: FinancialAccount) => void;
}

type DatePreset = 'all' | 'today' | 'this_month' | 'last_30_days' | 'custom';

export const AccountLedgerDrawer: React.FC<AccountLedgerDrawerProps> = ({
  account,
  isOpen,
  onClose,
  onOpenTransfer,
  onOpenAddBalance,
  onAccountUpdated,
}) => {
  const [currentAccount, setCurrentAccount] = useState<FinancialAccount | null>(account);

  // Inline Account Editing State inside Drawer
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editType, setEditType] = useState('bank');
  const [editCurrency, setEditCurrency] = useState('ETB');
  const [editLogo, setEditLogo] = useState<string | null>(null);
  const [editFeeType, setEditFeeType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [editFeeAmount, setEditFeeAmount] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingDetails, setSavingDetails] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AccountActivitiesResponse | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI States
  const [copiedAccountNum, setCopiedAccountNum] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calculate dates based on preset
  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = formatLocalDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_month') {
      const firstDay = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const lastDay = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setStartDate(formatLocalDate(thirtyDaysAgo));
      setEndDate(formatLocalDate(now));
    }
  };

  // Sync local currentAccount when prop changes
  useEffect(() => {
    setCurrentAccount(account);
    setIsEditingDetails(false);
  }, [account]);

  const startEditingDetails = () => {
    if (!currentAccount) return;
    setEditName(currentAccount.name || '');
    setEditAccountNumber(currentAccount.account_number || '');
    setEditType(currentAccount.type || 'bank');
    setEditCurrency(currentAccount.currency || 'ETB');
    setEditLogo(currentAccount.logo || null);
    setEditFeeType(
      currentAccount.default_fee_type === 'percentage' || currentAccount.default_fee_type === 'fixed'
        ? currentAccount.default_fee_type
        : 'none'
    );
    setEditFeeAmount(
      currentAccount.default_fee_amount != null && Number(currentAccount.default_fee_amount) > 0
        ? String(Number(currentAccount.default_fee_amount))
        : ''
    );
    setEditIsActive(currentAccount.is_active !== false);
    setIsEditingDetails(true);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast.error('Logo too large', { description: 'Please use an image under 200KB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount) return;
    if (!editName.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    try {
      setSavingDetails(true);
      const parsedFee = editFeeType !== 'none' && editFeeAmount ? parseFloat(editFeeAmount) : 0;
      const res = await api.updateAccount(currentAccount.id, {
        name: editName.trim(),
        type: editType,
        account_number: editAccountNumber.trim() || null,
        currency: editCurrency || 'ETB',
        logo: editLogo ?? null,
        default_fee_type: editFeeType,
        default_fee_amount: parsedFee,
        is_active: editIsActive,
      });

      const updated = (res as any)?.data || {
        ...currentAccount,
        name: editName.trim(),
        type: editType,
        account_number: editAccountNumber.trim() || null,
        currency: editCurrency || 'ETB',
        logo: editLogo ?? null,
        default_fee_type: editFeeType,
        default_fee_amount: parsedFee,
        is_active: editIsActive,
      };

      setCurrentAccount(updated);
      setIsEditingDetails(false);
      toast.success('Account details updated successfully', { description: updated.name });
      if (onAccountUpdated) onAccountUpdated(updated);
    } catch (err: any) {
      toast.error('Failed to update account', { description: err.message });
    } finally {
      setSavingDetails(false);
    }
  };

  const fetchActivities = useCallback(async () => {
    if (!currentAccount) return;
    try {
      setLoading(true);
      const res = await api.getAccountActivities(currentAccount.id, {
        type: typeFilter !== 'all' ? typeFilter : undefined,
        search: search.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load account activities', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [currentAccount, typeFilter, search, startDate, endDate]);

  useEffect(() => {
    if (isOpen && currentAccount) {
      fetchActivities();
    } else {
      setData(null);
      setSearch('');
      setTypeFilter('all');
      setDatePreset('all');
      setStartDate('');
      setEndDate('');
      setExpandedId(null);
    }
  }, [isOpen, currentAccount]);

  // Debounced refetch on filter change
  useEffect(() => {
    if (!isOpen || !currentAccount) return;
    const timeout = setTimeout(() => {
      fetchActivities();
    }, 200);
    return () => clearTimeout(timeout);
  }, [fetchActivities, isOpen, currentAccount]);

  const handleCopyAccountNum = () => {
    if (!currentAccount?.account_number) return;
    navigator.clipboard.writeText(currentAccount.account_number);
    setCopiedAccountNum(true);
    toast.success('Account number copied to clipboard');
    setTimeout(() => setCopiedAccountNum(false), 2000);
  };

  const hasActiveFilters = Boolean(
    search.trim() || typeFilter !== 'all' || datePreset !== 'all' || startDate || endDate
  );

  const handleResetFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const exportToCSV = () => {
    if (!data || !data.activities.length) {
      toast.error('No activities to export');
      return;
    }

    const headers = [
      'Date',
      'Transaction Number',
      'Type',
      'Direction',
      'Counterparty',
      'Description',
      'Inflow (ETB)',
      'Outflow (ETB)',
      'Fee (ETB)',
      'Running Balance (ETB)',
      'Reference Number',
    ];

    const rows = data.activities.map((a) => [
      `"${new Date(a.date).toLocaleString()}"`,
      `"${a.transaction_number || ''}"`,
      `"${a.type_label}"`,
      `"${a.direction}"`,
      `"${(a.counterparty || '').replace(/"/g, '""')}"`,
      `"${(a.description || '').replace(/"/g, '""')}"`,
      a.inflow > 0 ? a.inflow.toFixed(2) : '0.00',
      a.outflow > 0 ? a.outflow.toFixed(2) : '0.00',
      a.fee > 0 ? a.fee.toFixed(2) : '0.00',
      a.balance_after.toFixed(2),
      `"${a.reference_number || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanAccountName = (currentAccount?.name || 'account').toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.setAttribute('download', `${cleanAccountName}-activity-ledger-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Activity ledger CSV downloaded');
  };

  if (!currentAccount) return null;

  const isAsset = Boolean(
    currentAccount.is_custom_asset ||
    ['asset_gold', 'asset_fx', 'custom'].includes(currentAccount.type || '')
  );

  const summary = data?.summary || {
    current_balance: Number(currentAccount.current_balance),
    total_inflow: 0,
    total_outflow: 0,
    net_flow: 0,
    filtered_inflow: 0,
    filtered_outflow: 0,
    filtered_net: 0,
    total_count: 0,
    filtered_count: 0,
  };

  const isInactive = currentAccount.is_active === false;

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      widthClass="sm:max-w-3xl lg:max-w-4xl"
      title={currentAccount.name}
      subtitle={
        currentAccount.account_number
          ? `Acc: ${currentAccount.account_number} · ${currentAccount.type.replace(/_/g, ' ')}`
          : `${currentAccount.type.replace(/_/g, ' ').toUpperCase()} Account`
      }
      badge={
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            isInactive
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
          {isInactive ? 'Inactive' : 'Live'}
        </span>
      }
      headerActions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportToCSV}
            disabled={!data || data.activities.length === 0}
            title="Export filtered activities to CSV"
            className="h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {onOpenTransfer && !isAsset && (
            <button
              onClick={() => onOpenTransfer(currentAccount.id)}
              className="h-8 px-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transfer</span>
            </button>
          )}

          {onOpenAddBalance && (
            <button
              onClick={() => onOpenAddBalance(currentAccount)}
              className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer"
              title="Add Balance"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Balance</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isEditingDetails) {
                setIsEditingDetails(false);
              } else {
                startEditingDetails();
              }
            }}
            title={isEditingDetails ? "Close Edit" : "Edit Account Details"}
            className={`h-8 px-2.5 rounded-xl border transition-all flex items-center gap-1.5 active:scale-95 shadow-xs cursor-pointer text-xs font-semibold ${
              isEditingDetails
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isEditingDetails ? 'Editing' : 'Edit Details'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Inline Edit Form Panel inside Drawer */}
        {isEditingDetails && (
          <form
            onSubmit={handleSaveDetails}
            className="rounded-2xl border border-emerald-500/40 dark:border-emerald-500/30 bg-slate-50/90 dark:bg-slate-900/90 p-4 sm:p-5 space-y-4 shadow-sm animate-page-enter"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Pencil className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {isAsset ? 'Edit Reserve Details' : 'Edit Account Details'}
                  </h4>
                  <p className="text-[10px] text-slate-400">Update name, number, logo, and fees directly</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingDetails(false)}
                  className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingDetails ? (
                    <>
                      <LdrsSpinner size="12" color="#ffffff" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              {/* Account Name */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Account / Reserve Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Commercial Bank of Ethiopia (Main)"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* Account Number (for bank / mobile / custom) */}
              {!isAsset && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Account Number / Wallet ID
                  </label>
                  <input
                    type="text"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    placeholder="e.g. 1000293848201"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                  />
                </div>
              )}

              {/* Account Type */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Category Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="bank">Bank Account</option>
                  <option value="mobile_money">Mobile Money (Telebirr, M-Pesa)</option>
                  <option value="cash">Cash Drawer / Safe</option>
                  <option value="asset_fx">Foreign Currency Reserve (USD, EUR, etc.)</option>
                  <option value="asset_gold">Gold Reserve (Physical Gold / Ingots)</option>
                  <option value="custom">Custom Asset Reserve</option>
                </select>
              </div>

              {/* Currency */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Currency
                </label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="ETB">ETB — Ethiopian Birr</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USDT">USDT — Tether</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="GOLD">GOLD — Physical Gold (g)</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="CAD">CAD — Canadian Dollar</option>
                </select>
              </div>

              {/* Outgoing Transaction Fee */}
              {!isAsset && (
                <div className="sm:col-span-2 grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-750">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Outgoing Fee Type
                    </label>
                    <select
                      value={editFeeType}
                      onChange={(e) => setEditFeeType(e.target.value as any)}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="none">No Outgoing Fee</option>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (ETB)</option>
                    </select>
                  </div>
                  {editFeeType !== 'none' && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Fee Rate / Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editFeeAmount}
                        onChange={(e) => setEditFeeAmount(e.target.value)}
                        placeholder={editFeeType === 'percentage' ? 'e.g. 1.5' : 'e.g. 10'}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Logo Selection Section */}
              <div className="sm:col-span-2 space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account Logo / Badge Preset
                </label>
                <div className="flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 custom-scrollbar">
                  {(isAsset ? PRESET_RESERVE_LOGOS : PRESET_BANK_LOGOS).map((p) => {
                    const isSelected = editLogo === p.dataUri;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditLogo(p.dataUri)}
                        className={`p-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800'
                        }`}
                        title={p.name}
                      >
                        <img src={p.dataUri} alt={p.shortCode} className="w-5 h-5 rounded-md object-cover" />
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                          {p.shortCode}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-slate-400" />
                    <span>Upload Custom Logo</span>
                  </button>
                  {editLogo && (
                    <button
                      type="button"
                      onClick={() => setEditLogo(null)}
                      className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      Clear Logo
                    </button>
                  )}
                </div>
              </div>

              {/* Active Status */}
              <div className="sm:col-span-2 pt-1 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Account Live Status</span>
                  <p className="text-[10px] text-slate-400">Inactive accounts are hidden from payment selectors</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </form>
        )}

        {/* Account Identity Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50/50 to-slate-100/50 dark:from-[#131926] dark:via-[#111723] dark:to-[#0d121c] p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <AccountLogo account={currentAccount} size="xl" className="shadow-md ring-2 ring-white dark:ring-slate-700" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{currentAccount.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {currentAccount.type.replace(/_/g, ' ')}
                  </span>
                  {currentAccount.default_fee_type && currentAccount.default_fee_type !== 'none' && Number(currentAccount.default_fee_amount) > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
                      Outgoing Fee: {Number(currentAccount.default_fee_amount)}{currentAccount.default_fee_type === 'percentage' ? '%' : ' ETB'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {currentAccount.account_number ? (
                    <button
                      onClick={handleCopyAccountNum}
                      className="group inline-flex items-center gap-1 font-mono hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                      title="Click to copy account number"
                    >
                      <span>{currentAccount.account_number}</span>
                      {copiedAccountNum ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                      )}
                    </button>
                  ) : (
                    <span>Internal Treasury Account</span>
                  )}
                  <span>·</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Currency: {currentAccount.currency || 'ETB'}</span>
                </div>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Current Live Balance
              </span>
              <div className="inline-flex items-baseline gap-1.5 font-mono text-2xl font-black text-slate-900 dark:text-white">
                <AnimatedNumber value={summary.current_balance} decimals={2} />
                <span className="text-xs font-semibold text-slate-400 font-sans">ETB</span>
              </div>
            </div>
          </div>

          {/* Asset details / holdings if reserve asset */}
          {currentAccount.asset_details && (
            (() => {
              const details = currentAccount.asset_details as Record<string, any>;
              const rawHoldings = Array.isArray(details.holdings) ? details.holdings : null;
              const curr = currentAccount.currency === 'GOLD' ? 'g' : (currentAccount.currency || details.currency || 'USD');
              const totalForeign = details.total_foreign_amount != null
                ? Number(details.total_foreign_amount)
                : rawHoldings
                  ? rawHoldings.reduce((s: number, h: any) => s + (Number(h.amount) || 0), 0)
                  : null;

              const extraEntries = Object.entries(details).filter(
                ([k, v]) =>
                  !['holdings', 'currency', 'total_foreign_amount', 'total_etb_value', 'logo'].includes(k) &&
                  typeof v !== 'object' &&
                  v !== null &&
                  v !== ''
              );

              if (!rawHoldings && totalForeign == null && extraEntries.length === 0) return null;

              return (
                <div className="mt-4 pt-3.5 border-t border-slate-200/60 dark:border-slate-800/70 space-y-2.5">
                  {/* Holdings Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Holdings Breakdown
                      </span>
                      {rawHoldings && rawHoldings.length > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/50 dark:border-emerald-800/40 shrink-0 whitespace-nowrap">
                          {rawHoldings.length} {rawHoldings.length === 1 ? 'Lot' : 'Lots'}
                        </span>
                      )}
                    </div>
                    {totalForeign != null && (
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {totalForeign.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                        <span className="text-[10px] font-sans text-slate-400 font-bold uppercase">{curr}</span>
                      </span>
                    )}
                  </div>

                  {/* Individual Lots List */}
                  {rawHoldings && rawHoldings.length > 0 && (
                    <div className="space-y-1.5">
                      {rawHoldings.map((h: any, idx: number) => {
                        const amount = Number(h.amount) || 0;
                        const rate = Number(h.rate) || 0;
                        const val = Number(h.etb_value) || (amount * rate);
                        return (
                          <div
                            key={h.id || idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 text-xs"
                          >
                            <div className="flex items-center gap-2 font-mono flex-wrap">
                              <span className="text-[10px] font-sans font-bold text-slate-400 uppercase">
                                Lot {idx + 1}
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {curr}
                              </span>
                              {rate > 0 && (
                                <span className="text-slate-400 text-[11px]">
                                  @ {rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white text-right shrink-0 whitespace-nowrap ml-2">
                              {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                              <span className="text-[10px] font-sans text-slate-400 font-normal">ETB</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Extra Primitive Metadata */}
                  {extraEntries.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      {extraEntries.map(([key, val]) => (
                        <div
                          key={key}
                          className="bg-slate-50/50 dark:bg-slate-900/30 rounded-lg p-2 border border-slate-200/40 dark:border-slate-800/40"
                        >
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                            {String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* 4 KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Total Inflows */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Inflows</span>
              <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400 truncate">
              +{Number(summary.filtered_inflow ?? summary.total_inflow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Sales & deposits</span>
          </div>

          {/* Total Outflows */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Outflows</span>
              <div className="w-5 h-5 rounded-md bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono font-black text-base text-rose-600 dark:text-rose-400 truncate">
              -{Number(summary.filtered_outflow ?? summary.total_outflow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Payouts & expenses</span>
          </div>

          {/* Net Flow */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Net Cashflow</span>
              <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div
              className={`font-mono font-black text-base truncate ${
                summary.filtered_net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {summary.filtered_net >= 0 ? '+' : ''}
              {Number(summary.filtered_net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Net activity</span>
          </div>

          {/* Total Transactions */}
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3.5 transition-all">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Activities</span>
              <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono font-black text-base text-slate-900 dark:text-white truncate">
              {summary.filtered_count}{' '}
              <span className="text-xs font-normal text-slate-400">of {summary.total_count}</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">Recorded items</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-3 shadow-xs">
          {/* Top row: Search input + Date Presets */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search transaction #, counterparty, description, ref..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/20 focus:border-slate-400 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Range Presets */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'last_30_days', label: 'Last 30D' },
                  { id: 'custom', label: 'Custom' },
                ] as const
              ).map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleDatePresetChange(preset.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    datePreset === preset.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs (shown only if custom selected) */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
              />
            </div>
          )}

          {/* Segmented Type Filter Pills */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All Activities' },
                { id: 'inflow', label: 'Inflows' },
                { id: 'outflow', label: 'Outflows' },
                { id: 'sale', label: 'Sales & Debt Collections' },
                { id: 'supplier_payment', label: 'Vendor Payouts' },
                { id: 'transfer', label: 'Transfers' },
                { id: 'expense', label: 'Expenses' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setTypeFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${
                    typeFilter === pill.id
                      ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline shrink-0 flex items-center gap-1 pl-2"
              >
                <X className="w-3 h-3" />
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Minimal Neat Activity Ledger Table */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Transaction Ledger
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {summary.filtered_count} records
              </span>
            </div>

            <button
              onClick={fetchActivities}
              disabled={loading}
              title="Refresh ledger"
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600' : ''}`} />
            </button>
          </div>

          {/* Loading Skeleton */}
          {loading && !data && (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-1.5">
                      <div className="w-28 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="w-40 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="w-20 h-3.5 bg-slate-200 dark:bg-slate-800 rounded ml-auto" />
                    <div className="w-24 h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State: No activities match filter */}
          {!loading && data && data.activities.length === 0 && (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/70 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No transactions found</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? 'No activity entries match your current search and filter settings.'
                  : 'There are no recorded transactions, collections, or transfers for this account yet.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {/* Activity Rows */}
          {data && data.activities.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 overflow-x-auto">
              {/* Column labels for desktop view */}
              <div className="hidden md:grid md:grid-cols-12 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="col-span-3">Date & Number</div>
                <div className="col-span-3">Type & Counterparty</div>
                <div className="col-span-2 text-right">Inflow</div>
                <div className="col-span-2 text-right">Outflow</div>
                <div className="col-span-2 text-right">Running Balance</div>
              </div>

              {data.activities.map((act) => {
                const isExpanded = expandedId === act.id;
                const isInflow = act.direction === 'inflow';
                const formattedDate = new Date(act.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = new Date(act.date).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={act.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    {/* Main Row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : act.id)}
                      className="px-5 py-3 cursor-pointer grid grid-cols-1 md:grid-cols-12 items-center gap-2"
                    >
                      {/* Date & Transaction Number */}
                      <div className="md:col-span-3 flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center ${
                            isInflow
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isInflow ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                           <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                            {formattedDate}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-mono">{act.transaction_number || '—'}</span>
                            <span>·</span>
                            <span>{formattedTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Type & Counterparty */}
                      <div className="md:col-span-3 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {act.counterparty || act.type_label}
                          </span>
                          {act.reference_number && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                              Ref: {act.reference_number}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {act.type_label}
                          {act.description ? ` · ${act.description}` : ''}
                        </div>
                      </div>

                      {/* Mobile Row Amounts View (visible on < md) */}
                      <div className="md:hidden flex items-center justify-between pt-1 border-t border-slate-100/50 dark:border-slate-800/50 mt-1">
                        <div className="text-xs">
                          {isInflow ? (
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              +{act.inflow.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                              -{act.outflow.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 mr-1">Bal:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {act.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                          </span>
                        </div>
                      </div>

                      {/* Desktop Columns */}
                      {/* Inflow */}
                      <div className="hidden md:block md:col-span-2 text-right">
                        {isInflow ? (
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            +{act.inflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 font-mono text-xs">—</span>
                        )}
                      </div>

                      {/* Outflow */}
                      <div className="hidden md:block md:col-span-2 text-right">
                        {!isInflow ? (
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                            -{act.outflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {act.fee > 0 && (
                              <span className="block text-[9px] text-slate-400 font-normal">
                                Fee: {act.fee.toFixed(2)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700 font-mono text-xs">—</span>
                        )}
                      </div>

                      {/* Running Balance */}
                      <div className="hidden md:flex md:col-span-2 items-center justify-end gap-2 text-right">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {act.balance_after.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <div className="text-slate-400 p-0.5">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800/80 text-xs space-y-2.5 animate-page-enter">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              Exact Timestamp
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                              {new Date(act.date).toLocaleString()}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              System Reference
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                              {act.reference_number || 'None'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              Recorded By
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 font-semibold">
                              {act.created_by || 'System Owner'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">
                              Transfer Fee
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                              {act.fee > 0 ? `${act.fee.toFixed(2)} ETB` : '0.00 ETB'}
                            </span>
                          </div>
                        </div>

                        {act.description && (
                          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                            <span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold block mb-0.5">
                              Description
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/40 dark:border-slate-700/40 text-xs">
                              {act.description}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SlideOverDrawer>
  );
};
