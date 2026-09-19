import React, { useState, useEffect } from 'react';
import type { Debt, FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Search, Loader2, X } from 'lucide-react';

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeDebt) {
        setActiveDebt(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDebt]);

  const loadDebts = async () => {
    try {
      setLoading(true);
      const res = await api.getDebts({ type: debtType, search });
      setDebts(res);
    } catch (err: any) {
      toast.error('Failed to load debts ledger', { description: err.message });
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

      toast.success(
        activeDebt.type === 'receivable' ? 'Customer debt collected' : 'Peer payable settled',
        {
          description: `${parseFloat(paymentAmount).toLocaleString()} ETB processed with party ${activeDebt.contact?.name}`,
        }
      );

      setActiveDebt(null);
      loadDebts();
    } catch (err: any) {
      toast.error('Failed to settle payment', { description: err.message });
    } finally {
      setSettling(false);
    }
  };

  const totalOutstanding = debts.reduce((sum, d) => sum + parseFloat(String(d.remaining_amount)), 0);

  return (
    <div className="space-y-6">
      {/* Top Header & Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Segmented Control */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setDebtType('receivable')}
            className={`px-4 py-2 rounded-lg transition-all ${
              debtType === 'receivable'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Who Owes Us (Receivables)
          </button>
          <button
            onClick={() => setDebtType('payable')}
            className={`px-4 py-2 rounded-lg transition-all ${
              debtType === 'payable'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Who We Owe (Payables)
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contact or notes..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 shadow-xs"
          />
        </form>
      </div>

      {/* Summary Total Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center justify-between shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Outstanding {debtType === 'receivable' ? 'Customer Receivables' : 'Supplier Payables'}
          </span>
          <div
            className={`text-3xl font-extrabold font-mono tracking-tight mt-1 ${
              debtType === 'receivable' ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-sm font-normal text-slate-400 font-sans">ETB</span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div className="font-bold text-slate-800 text-sm">{debts.length} active ledger records</div>
          <div className="text-[11px]">Directly synced with cash & bank accounts</div>
        </div>
      </div>

      {/* Debt Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Contact Name</th>
                <th className="py-3 px-5">Original Debt</th>
                <th className="py-3 px-5">Already Paid</th>
                <th className="py-3 px-5">Remaining Balance</th>
                <th className="py-3 px-5">Context / Notes</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                      <span>Loading ledger records...</span>
                    </div>
                  </td>
                </tr>
              ) : debts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    No outstanding {debtType} records found.
                  </td>
                </tr>
              ) : (
                debts.map((debt) => (
                  <tr key={debt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 text-sm">{debt.contact?.name}</div>
                      <div className="text-[11px] text-slate-400">{debt.contact?.phone || 'No phone'}</div>
                    </td>

                    <td className="py-3.5 px-5 font-mono text-slate-500">
                      {Number(debt.original_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3.5 px-5 font-mono text-slate-400">
                      {Number(debt.paid_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3.5 px-5 font-mono font-bold text-sm">
                      <span className={debtType === 'receivable' ? 'text-emerald-700' : 'text-rose-700'}>
                        {Number(debt.remaining_amount).toLocaleString()} ETB
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-slate-600 max-w-xs truncate">
                      {debt.notes || <span className="text-slate-400 italic">No notes</span>}
                    </td>

                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          debt.status === 'settled'
                            ? 'bg-slate-100 text-slate-600'
                            : debt.status === 'partially_paid'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                        }`}
                      >
                        {debt.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      {parseFloat(String(debt.remaining_amount)) > 0 && (
                        <button
                          onClick={() => handleOpenSettleModal(debt)}
                          className="h-8 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all shadow-xs active:scale-[0.98]"
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

      {/* Tactile Settle Payment Modal */}
      {activeDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setActiveDebt(null)}
          />

          <div className="relative z-10 bg-white rounded-2xl border border-slate-100 shadow-2xl ring-1 ring-black/5 max-w-md w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {activeDebt.type === 'receivable' ? 'Collect Customer Payment' : 'Pay Sourcing Partner'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Party: {activeDebt.contact?.name}</p>
              </div>
              <button
                onClick={() => setActiveDebt(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Remaining Obligation:</span>
                <span className="font-extrabold text-slate-900 font-mono text-sm">
                  {Number(activeDebt.remaining_amount).toLocaleString()} ETB
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Payment Amount to Process (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={Number(activeDebt.remaining_amount)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {activeDebt.type === 'receivable' ? 'Deposit Into Account (Money In)' : 'Debit From Account (Money Out)'}
                </label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bank Reference Number / SMS Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBE-FT-82914 or TeleBirr TxID"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes / Ledger Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Partial cash settlement"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveDebt(null)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="h-10 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs active:scale-[0.98]"
                >
                  {settling ? 'Updating Ledger...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
