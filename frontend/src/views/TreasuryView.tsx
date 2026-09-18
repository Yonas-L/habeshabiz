import React, { useState, useEffect } from 'react';
import type { FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { ArrowRightLeft, Coins, DollarSign, Loader2 } from 'lucide-react';

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

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.getAccounts();
      setTreasuryAccounts(res.treasury_accounts);
      setAssetAccounts(res.asset_accounts);
      setTotalTreasury(res.total_treasury);
      setTotalAssets(res.total_assets);
    } catch (err) {
      console.error('Failed to load accounts:', err);
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

      setShowTransferModal(false);
      setTransferAmount('');
      setTransferFee('0');
      setTransferDesc('');
      loadAccounts();
    } catch (err: any) {
      alert(err.message || 'Transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

  if (loading && treasuryAccounts.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
        <span>Loading bank and treasury accounts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">Financial Treasury & Accounts</h2>
          <p className="text-xs text-slate-500">
            Real-time balances across CBE, BOA, Awash, TeleBirr, Cash Drawer, Gold, and Forex
          </p>
        </div>

        <button
          onClick={() => setShowTransferModal(true)}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Transfer Between Accounts</span>
        </button>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Liquid Cash & Bank Holdings</div>
          <div className="text-2xl font-semibold text-slate-900 font-mono tracking-tight mt-1">
            {totalTreasury.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-xs text-slate-500">ETB</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ready working capital</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Custom Asset Reserves (Gold & FX)</div>
          <div className="text-2xl font-semibold text-slate-900 font-mono tracking-tight mt-1">
            {totalAssets.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-xs text-slate-500">ETB</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Wealth preservation hedges</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Combined Money Total</div>
          <div className="text-2xl font-semibold text-emerald-700 font-mono tracking-tight mt-1">
            {(totalTreasury + totalAssets).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-xs text-emerald-600">ETB</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Zero commingled distortions</div>
        </div>
      </div>

      {/* 1. Liquid Accounts Grid */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Bank Accounts & Digital Wallets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {treasuryAccounts.map((acc) => (
            <div key={acc.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 capitalize">{acc.type.replace('_', ' ')}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <div className="font-semibold text-slate-900 text-sm mt-1">{acc.name}</div>
                {acc.account_number && (
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{acc.account_number}</div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Balance</span>
                <span className="text-lg font-semibold text-slate-900 font-mono">
                  {Number(acc.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Custom Assets (Gold & FX) */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Custom Store Assets (Gold & Foreign Currency)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {assetAccounts.map((acc) => (
            <div key={acc.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  {acc.type === 'asset_gold' ? <Coins className="w-4 h-4 text-amber-600" /> : <DollarSign className="w-4 h-4 text-emerald-600" />}
                  <span>{acc.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  Custom Asset
                </span>
              </div>

              {acc.asset_details && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-mono text-slate-600">
                  {Object.entries(acc.asset_details).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-0.5">
                      <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span className="font-semibold text-slate-900">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400">Total Valuation</span>
                <span className="text-base font-semibold text-slate-900 font-mono">
                  {Number(acc.current_balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Inter-Account Fund Transfer</h3>
                <p className="text-[11px] text-slate-500">Move money between accounts without false income or expense</p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Source Account (Deduct from)</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900"
                  required
                >
                  <option value="">-- Choose Source Account --</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Destination Account (Deposit to)</label>
                <select
                  value={destAccountId}
                  onChange={(e) => setDestAccountId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900"
                  required
                >
                  <option value="">-- Choose Destination Account --</option>
                  {treasuryAccounts.filter((a) => a.id !== sourceAccountId).map((a) => (
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
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900"
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
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Cash drawer replenishment from CBE"
                  value={transferDesc}
                  onChange={(e) => setTransferDesc(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {transferring ? 'Executing Transfer...' : 'Complete Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
