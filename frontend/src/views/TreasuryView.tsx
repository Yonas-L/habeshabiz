import React, { useState, useEffect } from 'react';
import type { FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  Coins,
  Loader2,
  X,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Landmark,
} from 'lucide-react';
import { MiniSparkline, MiniBarHistogram } from '../components/Charts';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { ManageAccountModal } from '../components/treasury/ManageAccountModal';
import { AccountLedgerDrawer } from '../components/drawers/AccountLedgerDrawer';
import { AccountLogo } from '../utils/bankLogos';

interface TreasuryViewProps {
  initialSelectedAccount?: FinancialAccount | null;
  onClearInitialContext?: () => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({
  initialSelectedAccount,
  onClearInitialContext,
}) => {
  const [treasuryAccounts, setTreasuryAccounts] = useState<FinancialAccount[]>([]);
  const [assetAccounts, setAssetAccounts] = useState<FinancialAccount[]>([]);
  const [totalTreasury, setTotalTreasury] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [loading, setLoading] = useState(true);

  // Dedicated Ledger Drawer
  const [selectedAccountForLedger, setSelectedAccountForLedger] = useState<FinancialAccount | null>(null);

  useEffect(() => {
    if (initialSelectedAccount) {
      setSelectedAccountForLedger(initialSelectedAccount);
      onClearInitialContext?.();
    }
  }, [initialSelectedAccount, onClearInitialContext]);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destAccountId, setDestAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFee, setTransferFee] = useState('0');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Account Management Modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [accountDefaultType, setAccountDefaultType] = useState('bank');

  // Delete Confirmation
  const [deletingAccount, setDeletingAccount] = useState<FinancialAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showTransferModal) setShowTransferModal(false);
        if (deletingAccount) setDeletingAccount(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTransferModal, deletingAccount]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.getAccounts();
      setTreasuryAccounts(res.treasury_accounts);
      setAssetAccounts(res.asset_accounts);
      setTotalTreasury(res.total_treasury);
      setTotalAssets(res.total_assets);
      setSelectedAccountForLedger((prev) => {
        if (!prev) return null;
        const all = [...res.treasury_accounts, ...res.asset_accounts];
        return all.find((a) => a.id === prev.id) || prev;
      });
    } catch (err: any) {
      toast.error('Failed to load financial accounts', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTransfer = (preselectedSourceId?: string) => {
    if (preselectedSourceId) {
      setSourceAccountId(preselectedSourceId);
      const other = treasuryAccounts.find((a) => a.id !== preselectedSourceId);
      if (other) setDestAccountId(other.id);
    } else if (treasuryAccounts.length >= 2) {
      setSourceAccountId(treasuryAccounts[0].id);
      setDestAccountId(treasuryAccounts[1].id);
    }
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAccountId || !destAccountId || !transferAmount) return;

    if (sourceAccountId === destAccountId) {
      toast.error('Invalid Transfer', { description: 'Source and destination accounts must be different.' });
      return;
    }

    try {
      setTransferring(true);
      await api.transferFunds({
        source_account_id: sourceAccountId,
        destination_account_id: destAccountId,
        amount: parseFloat(transferAmount),
        fee: parseFloat(transferFee || '0'),
        description: transferDesc || undefined,
      });

      const srcAcc = treasuryAccounts.find((a) => a.id === sourceAccountId)?.name || 'Source';
      const dstAcc = treasuryAccounts.find((a) => a.id === destAccountId)?.name || 'Destination';

      toast.success('Funds Transferred Successfully', {
        description: `${parseFloat(transferAmount).toLocaleString()} ETB moved from ${srcAcc} to ${dstAcc}.`,
      });

      setShowTransferModal(false);
      setTransferAmount('');
      setTransferFee('0');
      setTransferDesc('');
      loadAccounts();
    } catch (err: any) {
      toast.error('Transfer failed', { description: err.message });
    } finally {
      setTransferring(false);
    }
  };

  const handleOpenEdit = (acc: FinancialAccount) => {
    setEditingAccount(acc);
    setAccountDefaultType(acc.type);
    setShowAccountModal(true);
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
      loadAccounts();
    } catch (err: any) {
      toast.error('Failed to remove account', { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  if (loading && treasuryAccounts.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
        <span>Loading bank and treasury accounts...</span>
      </div>
    );
  }

  const allAccounts = [...treasuryAccounts, ...assetAccounts];
  const selectedSource = allAccounts.find((a) => a.id === sourceAccountId);
  const selectedDest = allAccounts.find((a) => a.id === destAccountId);

  return (
    <div className="space-y-5 animate-page-enter">
      {/* Header actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => handleOpenCreate()}
          className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center gap-2 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
        <button
          onClick={() => handleOpenTransfer()}
          className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-[0.98]"
        >
          <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
          Transfer
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/90 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cash & Banks</span>
            <Landmark className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            <AnimatedNumber value={totalTreasury} />
            <span className="text-[10px] font-medium text-slate-400 ml-1 font-sans">ETB</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
            <span className="text-[10px] text-slate-400">Liquid working cash</span>
            <MiniBarHistogram values={[25, 40, 32, 55, 48, 62, 70]} color="blue" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/90 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hedge Reserves</span>
            <Coins className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            <AnimatedNumber value={totalAssets} />
            <span className="text-[10px] font-medium text-slate-400 ml-1 font-sans">ETB</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
            <span className="text-[10px] text-slate-400">Gold & Forex</span>
            <MiniSparkline values={[110, 115, 114, 120, 125, 128, 132]} color="amber" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/90 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total</span>
            <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tracking-tight">
            <AnimatedNumber value={totalTreasury + totalAssets} />
            <span className="text-[10px] font-medium text-emerald-500 ml-1 font-sans">ETB</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
            <span className="text-[10px] text-slate-400">All balances combined</span>
            <MiniSparkline values={[220, 230, 225, 240, 255, 260, 275]} color="emerald" />
          </div>
        </div>
      </div>

      {/* Bank Accounts & Wallets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Bank Accounts & Wallets
          </span>
          <span className="text-[10px] text-slate-400">{treasuryAccounts.length} accounts</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {treasuryAccounts.map((acc) => {
            const isInactive = acc.is_active === false;
            return (
              <div
                key={acc.id}
                onClick={() => setSelectedAccountForLedger(acc)}
                className={`bg-white dark:bg-[#131926] rounded-xl border p-4 transition-all flex flex-col justify-between cursor-pointer group hover:shadow-md ${
                  isInactive
                    ? 'border-slate-200/50 dark:border-slate-800/50 opacity-60'
                    : 'border-slate-200/80 dark:border-slate-800/90 hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <AccountLogo account={acc} size="md" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{acc.name}</div>
                        <span className="text-[10px] text-slate-400 capitalize">{acc.type.replace(/_/g, ' ')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                        isInactive ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
                        {isInactive ? 'Inactive' : 'Live'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ml-0.5 hidden group-hover:inline-flex items-center">
                        Ledger &rarr;
                      </span>
                    </div>
                  </div>

                  {acc.account_number && (
                    <div className="mt-2 font-mono text-[11px] text-slate-400 dark:text-slate-500">
                      {acc.account_number}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Balance</span>
                    <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                      <AnimatedNumber value={Number(acc.current_balance)} decimals={2} />
                      <span className="text-[10px] font-medium text-slate-400 font-sans">ETB</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(acc);
                      }}
                      title="Edit account"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingAccount(acc);
                      }}
                      title="Remove account"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTransfer(acc.id);
                      }}
                      className="h-7 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                      Transfer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Asset Reserves */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Hedge Reserves (Gold & Forex)
          </span>
          <button
            onClick={() => handleOpenCreate('asset_gold')}
            className="h-7 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Reserve
          </button>
        </div>

        {assetAccounts.length === 0 ? (
          <div className="bg-white dark:bg-[#131926] rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
            <Coins className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No asset reserves yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Add gold, USD, USDT, or other hedge assets</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assetAccounts.map((acc) => {
              const isGold = acc.type === 'asset_gold';
              const isInactive = acc.is_active === false;
              return (
                <div
                  key={acc.id}
                  onClick={() => setSelectedAccountForLedger(acc)}
                  className={`bg-white dark:bg-[#131926] rounded-xl border p-4 transition-all cursor-pointer group hover:shadow-md ${
                    isInactive
                      ? 'border-slate-200/50 dark:border-slate-800/50 opacity-60'
                      : 'border-slate-200/80 dark:border-slate-800/90 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <AccountLogo account={acc} size="md" />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{acc.name}</div>
                        <span className="text-[10px] text-slate-400">
                          {isGold ? 'Gold' : acc.type === 'custom' ? 'Custom' : 'Forex / USDT'}
                          {isInactive ? ' · Inactive' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(acc); }} title="Edit" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingAccount(acc); }} title="Remove" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {acc.asset_details && (
                    <div className="mt-3 space-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {Object.entries(acc.asset_details).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="capitalize text-slate-400 font-sans text-[11px]">{k.replace(/_/g, ' ')}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                    <span className="text-[10px] text-slate-400">Valuation</span>
                    <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                      <AnimatedNumber value={Number(acc.current_balance)} decimals={2} />
                      <span className="text-[10px] font-medium text-slate-400 font-sans">ETB</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account Management Modal */}
      <ManageAccountModal
        isOpen={showAccountModal}
        onClose={() => {
          setShowAccountModal(false);
          setEditingAccount(null);
        }}
        onSaved={loadAccounts}
        editAccount={editingAccount}
        defaultType={accountDefaultType}
      />

      {/* Dedicated Account Activity Ledger Drawer */}
      <AccountLedgerDrawer
        account={selectedAccountForLedger}
        isOpen={selectedAccountForLedger !== null}
        onClose={() => setSelectedAccountForLedger(null)}
        onOpenTransfer={(accountId) => {
          handleOpenTransfer(accountId);
        }}
        onOpenEdit={(acc) => {
          handleOpenEdit(acc);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
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
                onClick={() => setDeletingAccount(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-9 px-5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Removing...' : 'Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tactile Elevated Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowTransferModal(false)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Inter-Account Transfer</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Shift balances between accounts without false income/expense
                </p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Source Account (From)
                  </label>
                  <select
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  >
                    <option value="">-- Choose Source --</option>
                    {allAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Destination Account (To)
                  </label>
                  <select
                    value={destAccountId}
                    onChange={(e) => setDestAccountId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  >
                    <option value="">-- Choose Destination --</option>
                    {allAccounts
                      .filter((a) => a.id !== sourceAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {selectedSource && selectedDest && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <AccountLogo account={selectedSource} size="sm" />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">{selectedSource.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{Number(selectedSource.current_balance).toLocaleString()} ETB</span>
                    </div>
                  </div>
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500 shrink-0 mx-2" />
                  <div className="flex items-center gap-2 text-right min-w-0 justify-end">
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white block truncate">{selectedDest.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{Number(selectedDest.current_balance).toLocaleString()} ETB</span>
                    </div>
                    <AccountLogo account={selectedDest} size="sm" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Transfer Amount (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Bank Fee (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferFee}
                    onChange={(e) => setTransferFee(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Memo / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Replenish cash drawer from CBE account"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              {/* Transfer Preview Card */}
              {selectedSource && selectedDest && transferAmount && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{selectedSource.name}</span>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-900 dark:text-white">{selectedDest.name}</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {parseFloat(transferAmount || '0').toLocaleString()} ETB
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || !sourceAccountId || !destAccountId || !transferAmount}
                  className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm active:scale-[0.98]"
                >
                  {transferring ? 'Executing...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
