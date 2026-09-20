import React, { useState, useEffect } from 'react';
import type { FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Loader2,
  Landmark,
  Wallet,
  Smartphone,
  Coins,
  DollarSign,
  Plus,
  Globe,
} from 'lucide-react';

interface ManageAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editAccount?: FinancialAccount | null;
}

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank Account', icon: Landmark, color: 'purple', isAsset: false },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone, color: 'sky', isAsset: false },
  { value: 'cash', label: 'Cash Drawer', icon: Wallet, color: 'emerald', isAsset: false },
  { value: 'asset_gold', label: 'Gold Reserve', icon: Coins, color: 'amber', isAsset: true },
  { value: 'asset_fx', label: 'Foreign Currency', icon: DollarSign, color: 'green', isAsset: true },
  { value: 'custom', label: 'Custom Asset', icon: Globe, color: 'slate', isAsset: true },
];

export const ManageAccountModal: React.FC<ManageAccountModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editAccount,
}) => {
  const isEditing = !!editAccount;

  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('ETB');
  const [openingBalance, setOpeningBalance] = useState('');
  const [balanceAdjustment, setBalanceAdjustment] = useState('');
  const [assetDetails, setAssetDetails] = useState<{ key: string; value: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editAccount) {
        setName(editAccount.name);
        setAccountType(editAccount.type);
        setAccountNumber(editAccount.account_number || '');
        setCurrency(editAccount.currency || 'ETB');
        setOpeningBalance('');
        setBalanceAdjustment('');
        if (editAccount.asset_details && typeof editAccount.asset_details === 'object') {
          setAssetDetails(
            Object.entries(editAccount.asset_details).map(([key, value]) => ({
              key,
              value: String(value),
            }))
          );
        } else {
          setAssetDetails([]);
        }
      } else {
        setName('');
        setAccountType('bank');
        setAccountNumber('');
        setCurrency('ETB');
        setOpeningBalance('');
        setBalanceAdjustment('');
        setAssetDetails([]);
      }
    }
  }, [isOpen, editAccount]);

  const selectedType = ACCOUNT_TYPES.find((t) => t.value === accountType);
  const isAssetType = selectedType?.isAsset ?? false;

  const addAssetDetailRow = () => {
    setAssetDetails([...assetDetails, { key: '', value: '' }]);
  };

  const removeAssetDetailRow = (index: number) => {
    setAssetDetails(assetDetails.filter((_, i) => i !== index));
  };

  const updateAssetDetail = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...assetDetails];
    updated[index][field] = val;
    setAssetDetails(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter an account name');
      return;
    }

    try {
      setSubmitting(true);

      // Build asset_details object from key/value pairs
      const details: Record<string, any> = {};
      assetDetails.forEach(({ key, value }) => {
        if (key.trim()) {
          // Try to parse numbers
          const num = Number(value);
          details[key.trim()] = !isNaN(num) && value.trim() !== '' ? num : value;
        }
      });

      if (isEditing && editAccount) {
        await api.updateAccount(editAccount.id, {
          name: name.trim(),
          type: accountType,
          account_number: accountNumber.trim() || null,
          currency: currency || 'ETB',
          asset_details: Object.keys(details).length > 0 ? details : null,
          ...(balanceAdjustment ? { balance_adjustment: parseFloat(balanceAdjustment) } : {}),
        });
        toast.success('Account updated', { description: name });
      } else {
        await api.createAccount({
          name: name.trim(),
          type: accountType,
          account_number: accountNumber.trim() || undefined,
          currency: currency || 'ETB',
          opening_balance: openingBalance ? parseFloat(openingBalance) : 0,
          is_custom_asset: isAssetType,
          asset_details: Object.keys(details).length > 0 ? details : undefined,
        });
        toast.success('Account created', { description: name });
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
    green: 'border-green-500 bg-green-50/50 dark:bg-green-950/30',
    slate: 'border-slate-500 bg-slate-50/50 dark:bg-slate-950/30',
  };

  const inactiveStyle = 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEditing ? 'Edit Account' : 'Add New Account'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isEditing ? 'Update account details or adjust balance' : 'Add a bank, wallet, cash drawer, or asset reserve'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Account Type Selector */}
          {!isEditing && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Account Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_TYPES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = accountType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAccountType(t.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                        isSelected ? colorMap[t.color] || inactiveStyle : inactiveStyle
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-bold leading-tight ${
                          isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
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

          {/* Name + Account Number */}
          <div className="grid grid-cols-2 gap-3">
            <div className={isAssetType ? 'col-span-2' : ''}>
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
                    : accountType === 'cash'
                    ? 'e.g. Shop Cash Drawer'
                    : accountType === 'asset_gold'
                    ? 'e.g. 21K Gold Reserve'
                    : 'e.g. USD Holdings'
                }
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                required
              />
            </div>
            {!isAssetType && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Account Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1000xxxxxxxx"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
            )}
          </div>

          {/* Currency + Opening Balance / Balance Adjustment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
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
                {isEditing ? 'Balance Adjustment' : 'Opening Balance'}
              </label>
              <input
                type="number"
                step="0.01"
                value={isEditing ? balanceAdjustment : openingBalance}
                onChange={(e) =>
                  isEditing ? setBalanceAdjustment(e.target.value) : setOpeningBalance(e.target.value)
                }
                placeholder={isEditing ? '+500 or -200' : '0.00'}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
              {isEditing && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Positive adds, negative subtracts from current balance
                </p>
              )}
            </div>
          </div>

          {/* Asset Details (for gold/fx/custom) */}
          {isAssetType && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Asset Details
                </label>
                <button
                  type="button"
                  onClick={addAssetDetailRow}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Field
                </button>
              </div>

              {assetDetails.length === 0 && (
                <p className="text-[11px] text-slate-400 italic py-2">
                  {accountType === 'asset_gold'
                    ? 'e.g. grams → 40, karat → 21, purchase_price → 180000'
                    : 'e.g. amount → 500, rate → 131.5'}
                </p>
              )}

              <div className="space-y-2">
                {assetDetails.map((detail, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={detail.key}
                      onChange={(e) => updateAssetDetail(i, 'key', e.target.value)}
                      placeholder="Field name"
                      className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={detail.value}
                      onChange={(e) => updateAssetDetail(i, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeAssetDetailRow(i)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-9 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Account'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
