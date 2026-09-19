import React, { useState, useEffect } from 'react';
import type { FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  Coins,
  DollarSign,
  Loader2,
  X,
  Landmark,
  Wallet,
  Smartphone,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { MiniSparkline, MiniBarHistogram } from '../components/Charts';
import { AnimatedNumber } from '../components/AnimatedNumber';

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

  const getAccountBadge = (acc: FinancialAccount) => {
    const lower = acc.name.toLowerCase();
    if (lower.includes('cbe') || lower.includes('commercial bank')) {
      return {
        icon: <Landmark className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
        bg: 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/50',
        tag: 'CBE',
      };
    }
    if (lower.includes('telebirr') || lower.includes('tele birr')) {
      return {
        icon: <Smartphone className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
        bg: 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border-sky-200/50 dark:border-sky-800/50',
        tag: 'TeleBirr',
      };
    }
    if (lower.includes('boa') || lower.includes('abyssinia')) {
      return {
        icon: <Landmark className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        bg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50',
        tag: 'BOA',
      };
    }
    if (lower.includes('awash')) {
      return {
        icon: <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
        bg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50',
        tag: 'Awash',
      };
    }
    if (lower.includes('cash') || acc.type === 'cash') {
      return {
        icon: <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        bg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50',
        tag: 'Cash Drawer',
      };
    }
    return {
      icon: <Landmark className="w-4 h-4 text-slate-600 dark:text-slate-400" />,
      bg: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/50 dark:border-slate-700',
      tag: 'Bank',
    };
  };

  if (loading && treasuryAccounts.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
        <span>Loading bank and treasury accounts...</span>
      </div>
    );
  }

  const selectedSource = treasuryAccounts.find((a) => a.id === sourceAccountId);
  const selectedDest = treasuryAccounts.find((a) => a.id === destAccountId);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
              Treasury & Liquidity Management
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
              <ShieldCheck className="w-3 h-3" />
              Multi-Account Real-Time
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Real balances across bank accounts, mobile money wallets, cash drawers, and gold/FX reserves
          </p>
        </div>

        <button
          onClick={() => handleOpenTransfer()}
          className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center gap-2 self-start sm:self-auto active:scale-[0.98]"
        >
          <ArrowRightLeft className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>Inter-Account Transfer</span>
        </button>
      </div>

      {/* Summary Matrix (3 Bold Cards with Embedded Micro-Charts) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Cash & Bank Treasury */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Cash & Bank Treasury
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight mt-2">
              <AnimatedNumber value={totalTreasury} />{' '}
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ETB</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Active liquid working cash</span>
            <MiniBarHistogram values={[25, 40, 32, 55, 48, 62, 70]} color="blue" />
          </div>
        </div>

        {/* 2. Store Asset Reserves */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Store Hedge Reserves
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 flex items-center justify-center">
                <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight mt-2">
              <AnimatedNumber value={totalAssets} />{' '}
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">ETB</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">18k/21k Gold & USD/USDT</span>
            <MiniSparkline values={[110, 115, 114, 120, 125, 128, 132]} color="amber" />
          </div>
        </div>

        {/* 3. Total Combined Capital */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Combined Liquid + Asset Holdings
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tracking-tight mt-2">
              <AnimatedNumber value={totalTreasury + totalAssets} />{' '}
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">ETB</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">Verified store balances</span>
            <MiniSparkline values={[220, 230, 225, 240, 255, 260, 275]} color="emerald" />
          </div>
        </div>
      </div>

      {/* 1. Cash & Bank Accounts Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Bank Accounts & Mobile Wallets
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {treasuryAccounts.length} Connected Accounts
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {treasuryAccounts.map((acc) => {
            const badge = getAccountBadge(acc);
            return (
              <div
                key={acc.id}
                className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                        {badge.icon}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          {acc.type.replace(/_/g, ' ')}
                        </span>
                        <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{acc.name}</div>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>

                  {acc.account_number && (
                    <div className="mt-3 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 inline-block font-mono text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      Acc: {acc.account_number}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Balance
                    </span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                      <AnimatedNumber value={Number(acc.current_balance)} decimals={2} />
                    </span>
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">ETB</span>
                  </div>

                  <button
                    onClick={() => handleOpenTransfer(acc.id)}
                    className="h-8 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Custom Store Assets (Gold & Foreign Currency) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Store Hedge Reserves (Gold & Forex)
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Wealth Preservation Assets
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {assetAccounts.map((acc) => {
            const isGold = acc.type === 'asset_gold';
            return (
              <div
                key={acc.id}
                className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                        isGold
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60'
                      }`}
                    >
                      {isGold ? <Coins className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{acc.name}</div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {isGold ? 'Physical Gold Holdings' : 'Foreign Currency & USDT'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isGold
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                    }`}
                  >
                    Hedge Asset
                  </span>
                </div>

                {acc.asset_details && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 divide-y divide-slate-200/40 dark:divide-slate-700/40">
                    {Object.entries(acc.asset_details).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1.5 first:pt-0 last:pb-0">
                        <span className="capitalize text-slate-400 dark:text-slate-500 font-sans font-medium text-[11px]">
                          {k.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Market Valuation</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                    <AnimatedNumber value={Number(acc.current_balance)} decimals={2} />{' '}
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">ETB</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                  Shift balances between CBE, BOA, TeleBirr, and Cash Drawer without false income/expense
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
                    {treasuryAccounts.map((a) => (
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
                    {treasuryAccounts
                      .filter((a) => a.id !== sourceAccountId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

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
                  Cancel (Esc)
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
