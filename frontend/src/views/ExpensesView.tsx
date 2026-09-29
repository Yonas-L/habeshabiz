import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, FinancialAccount, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  DollarSign,
  Plus,
  UserMinus,
  Car,
  Coffee,
  Home,
  Wrench,
  Loader2,
  Receipt,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { MiniSparkline, MiniBarHistogram } from '../components/Charts';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { ExpenseDrawer } from '../components/drawers/ExpenseDrawer';
import { RecordExpenseModal } from '../components/RecordExpenseModal';
import { Pagination } from '../components/Pagination';

interface ExpensesViewProps {
  accounts: FinancialAccount[];
  user?: User | null;
  initialShowRecordExpense?: boolean;
  onClearInitialContext?: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  accounts,
  user,
  initialShowRecordExpense,
  onClearInitialContext,
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected Expense for Workspace Drawer
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Record Expense Modal
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    if (initialShowRecordExpense) {
      setShowModal(true);
      onClearInitialContext?.();
    }
  }, [initialShowRecordExpense, onClearInitialContext]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const res = await api.getExpenses();
      setExpenses(res);
      setCurrentPage(1);
    } catch (err: any) {
      toast.error('Failed to load expenses', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const pagedExpenses = expenses.slice((currentPage - 1) * 6, currentPage * 6);

  const operatingExpenses = useMemo(() => expenses.filter((e) => !e.is_owner_draw), [expenses]);
  const ownerDraws = useMemo(() => expenses.filter((e) => e.is_owner_draw), [expenses]);

  const operatingTotal = useMemo(
    () => operatingExpenses.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0),
    [operatingExpenses]
  );

  const ownerDrawsTotal = useMemo(
    () => ownerDraws.reduce((sum, e) => sum + parseFloat(String(e.amount)), 0),
    [ownerDraws]
  );

  const operatingTrend = useMemo(() => {
    if (operatingExpenses.length === 0) return [0, 0, 0, 0, 0];
    const vals = operatingExpenses.slice(0, 7).map((e) => Number(e.amount)).reverse();
    return vals.length >= 2 ? vals : [0, ...vals];
  }, [operatingExpenses]);

  const drawsTrend = useMemo(() => {
    if (ownerDraws.length === 0) return [0, 0, 0, 0, 0];
    const vals = ownerDraws.slice(0, 7).map((e) => Number(e.amount)).reverse();
    return vals.length >= 2 ? vals : [0, ...vals];
  }, [ownerDraws]);

  const outflowTrend = useMemo(() => {
    if (expenses.length === 0) return [0, 0, 0, 0, 0];
    const vals = expenses.slice(0, 7).map((e) => Number(e.amount)).reverse();
    return vals.length >= 2 ? vals : [0, ...vals];
  }, [expenses]);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'ride':
        return <Car className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />;
      case 'food':
        return <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'rent':
        return <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'maintenance':
        return <Wrench className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      case 'personal_owner_draw':
        return <UserMinus className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />;
      default:
        return <DollarSign className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />;
    }
  };

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
              Operating Expenses & Owner Draws
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
              Segregated Ledgers
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict segregation between shop operational costs and owner personal withdrawals
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-2 self-start sm:self-auto active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* Summary Matrix (3 Bold Cards with Embedded Micro-Charts) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Operating Expenses */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Shop Operating Expenses
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-2">
              <AnimatedNumber value={operatingTotal} decimals={2} />{' '}
              <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Deducted from Net Profit</span>
            <MiniBarHistogram values={operatingTrend} color="rose" />
          </div>
        </div>

        {/* 2. Owner Draws */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Owner Personal Draws{user?.name ? ` (${user.name})` : ''}
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center">
                <UserMinus className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-2">
              <AnimatedNumber value={ownerDrawsTotal} decimals={2} />{' '}
              <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Does not distort shop margins</span>
            <MiniSparkline values={drawsTrend} color="rose" />
          </div>
        </div>

        {/* 3. Total Outflows Handled */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Cash Outflows
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-2">
              <AnimatedNumber value={operatingTotal + ownerDrawsTotal} decimals={2} />{' '}
              <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">{expenses.length} Records In Ledger</span>
            <MiniSparkline values={outflowTrend} color="rose" />
          </div>
        </div>
      </div>

      {/* Expense History Table with Click-to-Open Drawer */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        {/* Desktop Table (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5">Description</th>
                <th className="py-3 px-5">Paid From Account</th>
                <th className="py-3 px-5 text-right">Amount ETB</th>
                <th className="py-3 px-5 text-center">Classification</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                      <span>Loading expense ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    No expense or drawing records found.
                  </td>
                </tr>
              ) : (
                pagedExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    onClick={() => setSelectedExpense(exp)}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(exp.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-200 capitalize group-hover:scale-105 transition-transform">
                        {getCategoryIcon(exp.category)}
                        <span>{exp.category.replace(/_/g, ' ')}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="text-slate-900 dark:text-white font-bold text-sm group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {exp.description}
                      </div>
                      {exp.inventory_unit && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {exp.inventory_unit.variant?.product?.name || 'Device'}
                          </span>
                          {exp.inventory_unit.imei_or_serial && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              • IMEI: {exp.inventory_unit.imei_or_serial}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400 font-medium">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {exp.financial_account?.name || 'Cash Drawer'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                      {Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    </td>

                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          exp.is_owner_draw
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {exp.is_owner_draw ? 'Owner Draw' : 'Business Expense'}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Native Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                <span>Loading expense ledger...</span>
              </div>
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No expense or drawing records found.
            </div>
          ) : (
            pagedExpenses.map((exp) => (
              <div
                key={exp.id}
                onClick={() => setSelectedExpense(exp)}
                className="p-4 space-y-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-800/50"
              >
                {/* Header row: category + amount */}
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-200 capitalize">
                    {getCategoryIcon(exp.category)}
                    <span>{exp.category.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-base text-slate-900 dark:text-white">
                      {Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <div className="text-slate-900 dark:text-white font-bold text-sm">
                    {exp.description}
                  </div>
                  {exp.inventory_unit && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>{exp.inventory_unit.variant?.product?.name || 'Device'}</span>
                      {exp.inventory_unit.imei_or_serial && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          • {exp.inventory_unit.imei_or_serial}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer details: Account, Date, Classification, Chevron */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 dark:border-slate-800/50 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                      {exp.financial_account?.name || 'Cash Drawer'}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(exp.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        exp.is_owner_draw
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {exp.is_owner_draw ? 'Owner Draw' : 'Business Expense'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {expenses.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination
              currentPage={currentPage}
              totalItems={expenses.length}
              pageSize={6}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Expense Detail Workspace Drawer */}
      <ExpenseDrawer
        expense={selectedExpense}
        isOpen={selectedExpense !== null}
        onClose={() => setSelectedExpense(null)}
      />

      {/* Tactile Record Expense Modal */}
      <RecordExpenseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        accounts={accounts}
        onSuccess={loadExpenses}
      />
    </div>
  );
};
