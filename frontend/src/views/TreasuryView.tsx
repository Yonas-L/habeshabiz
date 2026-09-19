import React, { useState, useEffect } from 'react';
import type { FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { ArrowRightLeft, Coins, DollarSign, Loader2, X } from 'lucide-react';

export const TreasuryView: React.FC = () => {
  const [treasuryAccounts, setTreasuryAccounts] = useState<FinancialAccount[]>([]);
  const [assetAccounts, setAssetAccounts] = useState<FinancialAccount[]>([]);
  const [totalTreasury, setTotalTreasury] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);
  const [loading, setLoading] = useState(true);

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destAccountId, setDestAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFee, setTransferFee] = useState('0');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showTransferModal) {
        setShowTransferModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showTransferModal]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.getAccounts();
      setTreasuryAccounts(res.treasury_accounts);
      setAssetAccounts(res.asset_accounts);
      setTotalTreasury(res.total_treasury);
      setTotalAssets(res.total_assets);
    } catch (err: any) {
      toast.error('Failed to load financial accounts', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAccountId || !destAccountId || !transferAmount) return;

    try {
      setTransferring(true);
      await api.transferFunds({
        source_account_id: sourceAccountId,
        destination_account_id: destAccountId,
        amount: parseFloat(transferAmount),
        fee: parseFloat(transferFee || '0'),
        description: transferDesc || undefined,
      });

      toast.success('Funds transferred successfully', {
        description: `${parseFloat(transferAmount).toLocaleString()} ETB moved between accounts.`,
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

  if (loading && treasuryAccounts.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
        <span>Loading bank and treasury accounts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 text-base">Treasury & Multi-Account Liquidity</h2>
          <p className="text-xs text-slate-400">
            Real balances across CBE, BOA, Awash, TeleBirr, Cash Drawer, Gold, and Forex
          </p>
        </div>

        <button
          onClick={() => setShowTransferModal(true)}
          className="h-8 px-3 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto active:scale-[0.98]"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Inter-Account Transfer</span>
        </button>
      </div>

      {/* Summary Matrix Strip (Crisp squarish cells) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Cash & Bank Treasury
          </span>
          <div className="text-2xl font-semibold text-slate-900 font-mono tracking-tight mt-0.5">
            {totalTreasury.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active working liquidity</span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Store Asset Reserves (Gold & FX)
          </span>
          <div className="text-2xl font-semibold text-slate-900 font-mono tracking-tight mt-0.5">
            {totalAssets.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">18k/21k Gold & USD/USDT</span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Combined Money Total
          </span>
          <div className="text-2xl font-semibold text-emerald-700 font-mono tracking-tight mt-0.5">
            {(totalTreasury + totalAssets).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-xs font-normal text-emerald-600">ETB</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Uncommingled balance check</span>
        </div>
      </div>

      {/* 1. Cash & Bank Accounts Grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
          Bank Accounts & Mobile Money
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {treasuryAccounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-400 capitalize">
                    {acc.type.replace(/_/g, ' ')}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-0.5">{acc.name}</div>
                {acc.account_number && (
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{acc.account_number}</div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Current Balance</span>
                <span className="text-base font-semibold text-slate-900 font-mono">
                  {Number(acc.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Custom Store Assets (Gold & FX) */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
          Store Asset Holdings (Gold & Foreign Currency)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assetAccounts.map((acc) => (
            <div
              key={acc.id}
              className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  {acc.type === 'asset_gold' ? (
                    <Coins className="w-4 h-4 text-amber-600" />
                  ) : (
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>{acc.name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                  Hedge Asset
                </span>
              </div>

              {acc.asset_details && (
                <div className="mt-2.5 p-2 rounded-md bg-slate-50 border border-slate-100 text-xs font-mono text-slate-600">
                  {Object.entries(acc.asset_details).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-0.5">
                      <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span className="font-semibold text-slate-900">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Valuation</span>
                <span className="text-base font-semibold text-slate-900 font-mono">
                  {Number(acc.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tactile Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowTransferModal(false)}
          />

          <div className="relative z-10 bg-white rounded-lg border border-slate-200 shadow-2xl ring-1 ring-black/5 max-w-md w-full p-5 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Inter-Account Transfer</h3>
                <p className="text-[11px] text-slate-400">Shift funds between accounts without false income or expense</p>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Source Account (Debit)</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                >
                  <option value="">-- Select Source Account --</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Destination Account (Credit)</label>
                <select
                  value={destAccountId}
                  onChange={(e) => setDestAccountId(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                >
                  <option value="">-- Select Destination Account --</option>
                  {treasuryAccounts
                    .filter((a) => a.id !== sourceAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Transfer Amount (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Bank Fee (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferFee}
                    onChange={(e) => setTransferFee(e.target.value)}
                    placeholder="e.g. 15"
                    className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Replenish cash drawer from CBE"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="h-8 px-3 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="h-8 px-4 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs active:scale-[0.98]"
                >
                  {transferring ? 'Transferring...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
