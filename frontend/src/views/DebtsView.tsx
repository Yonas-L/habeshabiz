import React, { useState, useEffect } from 'react';
import type { Debt, FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Search, Loader2, ChevronRight } from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DebtDrawer } from '../components/drawers/DebtDrawer';

interface DebtsViewProps {
  accounts: FinancialAccount[];
}

export const DebtsView: React.FC<DebtsViewProps> = ({ accounts }) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>('receivable');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected Debt for Workspace Drawer
  const [drawerDebt, setDrawerDebt] = useState<Debt | null>(null);

  useEffect(() => {
    loadDebts();
  }, [debtType]);

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

  const handleOpenSettleModal = (debt: Debt, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDrawerDebt(debt);
  };

  const totalOutstanding = debts.reduce((sum, d) => sum + parseFloat(String(d.remaining_amount)), 0);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Top Header & Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Segmented Control */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setDebtType('receivable')}
            className={`px-4 py-2 rounded-lg transition-all ${
              debtType === 'receivable'
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Who Owes Us (Receivables)
          </button>
          <button
            onClick={() => setDebtType('payable')}
            className={`px-4 py-2 rounded-lg transition-all ${
              debtType === 'payable'
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-700 shadow-xs placeholder:text-slate-400"
          />
        </form>
      </div>

      {/* Summary Total Bar */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Outstanding {debtType === 'receivable' ? 'Customer Receivables' : 'Supplier Payables'}
          </span>
          <div
            className={`text-3xl font-extrabold font-mono tabular-nums tracking-tight mt-1 ${
              debtType === 'receivable' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            <AnimatedNumber value={totalOutstanding} />{' '}
            <span className="text-sm font-normal text-slate-400 font-sans">ETB</span>
          </div>
        </div>
        <div className="text-left sm:text-right text-xs text-slate-400">
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{debts.length} active ledger records</div>
          <div className="text-[11px] text-slate-400">Click any row to open focused workspace</div>
        </div>
      </div>

      {/* Debt Table with Click-to-Open Drawer */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Contact Name</th>
                <th className="py-3 px-5">Original Debt</th>
                <th className="py-3 px-5">Already Paid</th>
                <th className="py-3 px-5">Remaining Balance</th>
                <th className="py-3 px-5">Context / Notes</th>
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Action</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                      <span>Loading ledger records...</span>
                    </div>
                  </td>
                </tr>
              ) : debts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    No outstanding {debtType} records found.
                  </td>
                </tr>
              ) : (
                debts.map((debt) => (
                  <tr
                    key={debt.id}
                    onClick={() => setDrawerDebt(debt)}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {debt.contact?.name}
                      </div>
                      <div className="text-[11px] text-slate-400">{debt.contact?.phone || 'No phone'}</div>
                    </td>

                    <td className="py-3.5 px-5 font-mono text-slate-500 dark:text-slate-400">
                      {Number(debt.original_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3.5 px-5 font-mono text-slate-400 dark:text-slate-500">
                      {Number(debt.paid_amount).toLocaleString()} ETB
                    </td>

                    <td className="py-3.5 px-5 font-mono font-bold text-sm">
                      <span className={debtType === 'receivable' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                        {Number(debt.remaining_amount).toLocaleString()} ETB
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {debt.notes || <span className="text-slate-400 italic">No notes</span>}
                    </td>

                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          debt.status === 'settled'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : debt.status === 'partially_paid'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                        }`}
                      >
                        {debt.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      {parseFloat(String(debt.remaining_amount)) > 0 && (
                        <button
                          onClick={(e) => handleOpenSettleModal(debt, e)}
                          className="h-8 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-[0.98]"
                        >
                          Record Payment
                        </button>
                      )}
                    </td>

                    <td className="py-3.5 px-2 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debt Detail Workspace Drawer */}
      <DebtDrawer
        debt={drawerDebt}
        isOpen={drawerDebt !== null}
        onClose={() => setDrawerDebt(null)}
        accounts={accounts}
        onPaymentSettled={loadDebts}
      />
    </div>
  );
};
