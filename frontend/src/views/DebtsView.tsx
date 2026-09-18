import React, { useState, useEffect } from 'react';
import type { Debt, FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { Search } from 'lucide-react';

interface DebtsViewProps {
  accounts: FinancialAccount[];
}

export const DebtsView: React.FC<DebtsViewProps> = ({ accounts }) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>('receivable');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Settle Payment Modal
  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    loadDebts();
  }, [debtType]);

  const loadDebts = async () => {
    try {
      setLoading(true);
      const res = await api.getDebts({ type: debtType, search });
      setDebts(res);
    } catch (err) {
      console.error('Failed to load debts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDebts();
  };

  const handleOpenSettleModal = (debt: Debt) => {
    setActiveDebt(debt);
    setPaymentAmount(String(debt.remaining_amount));
    // Default account to CBE or TeleBirr
    const defaultAcc = accounts.find((a) => a.type === 'bank' || a.type === 'mobile_money');
    setPaymentAccountId(defaultAcc ? defaultAcc.id : accounts[0]?.id || '');
    setReferenceNumber('');
    setNotes('');
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDebt || !paymentAmount || !paymentAccountId) return;

    try {
      setSettling(true);
      await api.settleDebtPayment(activeDebt.id, {
        amount: parseFloat(paymentAmount),
        financial_account_id: paymentAccountId,
        reference_number: referenceNumber || undefined,
        notes: notes || undefined,
      });

      setActiveDebt(null);
      loadDebts();
    } catch (err: any) {
      alert(err.message || 'Failed to settle debt payment.');
    } finally {
      setSettling(false);
    }
  };

  const totalOutstanding = debts.reduce((sum, d) => sum + parseFloat(String(d.remaining_amount)), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">
            {debtType === 'receivable' ? 'Customer Receivables Ledger' : 'Supplier & Peer Payables Ledger'}
          </h2>
          <p className="text-xs text-slate-500">
            {debtType === 'receivable'
              ? 'Track who owes the business money with audit-trailed partial payments'
              : 'Track what you owe to peer merchants (Mekdi, Yenus) and suppliers'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented control */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs">
            <button
              onClick={() => setDebtType('receivable')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                debtType === 'receivable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Who Owes Us (Receivables)
            </button>
            <button
              onClick={() => setDebtType('payable')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                debtType === 'payable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Who We Owe (Payables)
            </button>
          </div>
        </div>
      </div>

      {/* Banner Total & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center justify-between shadow-xs">
          <div>
            <div className="text-xs text-slate-400 font-medium">
              Total Outstanding {debtType === 'receivable' ? 'Receivables' : 'Payables'}
            </div>
            <div
              className={`text-2xl font-semibold font-mono tracking-tight mt-0.5 ${
                debtType === 'receivable' ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-xs font-normal text-slate-500">ETB</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 text-right">
            <div>{debts.length} active parties</div>
            <div className="text-[11px] text-slate-400">Atomic bank ledger reconciliation</div>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contact name or notes..."
              className="w-full h-full min-h-12 pl-9 pr-3 rounded-2xl border border-slate-200/80 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 shadow-xs"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-4 rounded-2xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Debt Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-medium">
              <tr>
                <th className="py-3 px-4">Person / Contact</th>
                <th className="py-3 px-4">Original Obligation</th>
                <th className="py-3 px-4">Already Settled</th>
                <th className="py-3 px-4">Remaining Balance</th>
                <th className="py-3 px-4">Notes & Context</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading ledger records...
                  </td>
                </tr>
              ) : debts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No outstanding {debtType} records found.
                  </td>
                </tr>
              ) : (
                debts.map((debt) => (
                  <tr key={debt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{debt.contact?.name}</div>
                      <div className="text-[11px] text-slate-400">{debt.contact?.phone || 'No phone'}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {Number(debt.original_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {Number(debt.paid_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3.5 px-4 font-mono font-semibold">
                      <span className={debtType === 'receivable' ? 'text-emerald-700' : 'text-rose-700'}>
                        {Number(debt.remaining_amount).toLocaleString()} ETB
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {debt.notes || <span className="text-slate-400 italic font-normal">No notes</span>}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                          debt.status === 'settled'
                            ? 'bg-slate-100 text-slate-600'
                            : debt.status === 'partially_paid'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                        }`}
                      >
                        {debt.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {parseFloat(String(debt.remaining_amount)) > 0 && (
                        <button
                          onClick={() => handleOpenSettleModal(debt)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
                        >
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Payment Modal */}
      {activeDebt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  {activeDebt.type === 'receivable' ? 'Collect Customer Payment' : 'Pay Supplier / Peer Merchant'}
                </h3>
                <p className="text-[11px] text-slate-500">Party: {activeDebt.contact?.name}</p>
              </div>
              <button onClick={() => setActiveDebt(null)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Remaining Balance:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {Number(activeDebt.remaining_amount).toLocaleString()} ETB
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Amount to Record (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={Number(activeDebt.remaining_amount)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {activeDebt.type === 'receivable' ? 'Destination Account (Money in)' : 'Source Account (Money out)'}
                </label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  required
                >
                  {accounts.filter((a) => !a.is_custom_asset).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bank Reference Number / SMS Confirmation
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBE-FT-82914 or TeleBirr Ref"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Partial cash handover"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveDebt(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 shadow-xs"
                >
                  {settling ? 'Updating Ledger...' : 'Confirm & Update Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
