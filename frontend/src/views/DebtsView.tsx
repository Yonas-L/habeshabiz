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
    <div className="space-y-5">
      {/* Top Header & Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Segmented Control */}
        <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200/60 text-xs">
          <button
            onClick={() => setDebtType('receivable')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              debtType === 'receivable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Who Owes Us (Receivables)
          </button>
          <button
            onClick={() => setDebtType('payable')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              debtType === 'payable' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Who We Owe (Payables)
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contact or notes..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </form>
      </div>

      {/* Summary Total Bar (Clean, un-nested) */}
      <div className="bg-white rounded-lg border border-slate-200/80 p-4 flex items-center justify-between shadow-xs">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Total Outstanding {debtType === 'receivable' ? 'Receivables' : 'Payables'}
          </span>
          <div
            className={`text-2xl font-semibold font-mono tracking-tight mt-0.5 ${
              debtType === 'receivable' ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
            <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div className="font-medium text-slate-700">{debts.length} active ledger obligations</div>
          <div className="text-[11px]">Reconciled with treasury accounts</div>
        </div>
      </div>

      {/* Debt Table */}
      <div className="bg-white rounded-lg border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-medium">
              <tr>
                <th className="py-2.5 px-4">Contact / Shop Name</th>
                <th className="py-2.5 px-4">Original Amount</th>
                <th className="py-2.5 px-4">Already Paid</th>
                <th className="py-2.5 px-4">Remaining Balance</th>
                <th className="py-2.5 px-4">Context / Notes</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
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
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{debt.contact?.name}</div>
                      <div className="text-[11px] text-slate-400">{debt.contact?.phone || 'No phone'}</div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500">
                      {Number(debt.original_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400">
                      {Number(debt.paid_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold">
                      <span className={debtType === 'receivable' ? 'text-emerald-700' : 'text-rose-700'}>
                        {Number(debt.remaining_amount).toLocaleString()} ETB
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {debt.notes || <span className="text-slate-400 italic">No notes</span>}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
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

                    <td className="py-3 px-4 text-right">
                      {parseFloat(String(debt.remaining_amount)) > 0 && (
                        <button
                          onClick={() => handleOpenSettleModal(debt)}
                          className="h-7 px-2.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all shadow-xs active:scale-[0.98]"
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

          <div className="relative z-10 bg-white rounded-lg border border-slate-200 shadow-2xl ring-1 ring-black/5 max-w-md w-full p-5 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  {activeDebt.type === 'receivable' ? 'Collect Customer Payment' : 'Pay Sourcing Partner'}
                </h3>
                <p className="text-[11px] text-slate-400">Party: {activeDebt.contact?.name}</p>
              </div>
              <button
                onClick={() => setActiveDebt(null)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-3.5">
              <div className="p-2.5 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Remaining Obligation:</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {Number(activeDebt.remaining_amount).toLocaleString()} ETB
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Amount to Process (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  max={Number(activeDebt.remaining_amount)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {activeDebt.type === 'receivable' ? 'Deposit Into Account (Money In)' : 'Debit From Account (Money Out)'}
                </label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
                  Bank Reference Number / SMS Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. CBE-FT-82914 or TeleBirr TxID"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes / Ledger Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Partial cash settlement"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveDebt(null)}
                  className="h-8 px-3 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="h-8 px-4 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs active:scale-[0.98]"
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
