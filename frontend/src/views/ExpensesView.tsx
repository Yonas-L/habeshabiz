import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, FinancialAccount, User, BankFeeItem } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Receipt,
  Plus,
  ChevronRight,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ExpenseDrawer } from '../components/drawers/ExpenseDrawer';
import { RecordExpenseModal } from '../components/RecordExpenseModal';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

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
  const isOwner = !user || user.role === 'owner';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankFees, setBankFees] = useState<BankFeeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Expense for Workspace Drawer
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  // Record Expense Modal
  const [showModal, setShowModal] = useState(false);

  // Delete Expense Confirmation
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      if (res && typeof res === 'object' && 'expenses' in res) {
        setExpenses(res.expenses || []);
        setBankFees(res.bank_fees || []);
      } else if (Array.isArray(res)) {
        setExpenses(res);
        setBankFees([]);
      }
    } catch (err: any) {
      toast.error('Failed to load expenses', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteExpense(expenseToDelete.id);
      toast.success('Expense deleted and balance refunded', {
        description: `${Number(expenseToDelete.amount).toLocaleString()} ETB refunded to ${expenseToDelete.financial_account?.name || 'account'}`,
      });
      const deletedId = expenseToDelete.id;
      setExpenseToDelete(null);
      if (selectedExpense?.id === deletedId) {
        setSelectedExpense(null);
      }
      await loadExpenses();
    } catch (err: any) {
      toast.error('Failed to delete expense', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Unified items list
  interface UnifiedExpenseItem {
    id: string;
    isFee: boolean;
    date: string;
    category: string;
    description: string;
    accountName: string;
    amount: number;
    isOwnerDraw: boolean;
    rawExpense?: Expense;
    rawFee?: BankFeeItem;
  }

  const unifiedItems: UnifiedExpenseItem[] = useMemo(() => {
    const list: UnifiedExpenseItem[] = [];

    expenses.forEach((exp) => {
      list.push({
        id: `exp-${exp.id}`,
        isFee: false,
        date: exp.date,
        category: exp.category,
        description: exp.description,
        accountName: exp.financial_account?.name || 'Cash Drawer',
        amount: Number(exp.amount),
        isOwnerDraw: Boolean(exp.is_owner_draw),
        rawExpense: exp,
      });
    });

    bankFees.forEach((fee) => {
      list.push({
        id: `fee-${fee.id}`,
        isFee: true,
        date: fee.date,
        category: 'bank_fee',
        description: fee.description,
        accountName: fee.source_account?.name || 'Bank Account',
        amount: Number(fee.fee),
        isOwnerDraw: false,
        rawFee: fee,
      });
    });

    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, bankFees]);

  const getCategoryLabel = (item: UnifiedExpenseItem) => {
    if (item.isFee) return 'Bank Fee';
    if (item.isOwnerDraw || item.category === 'personal_owner_draw' || item.category === 'personal') return 'Personal Draw';
    switch (item.category) {
      case 'ride': return 'Ride';
      case 'food': return 'Food';
      case 'rent': return 'Rent';
      case 'maintenance': return 'Maintenance';
      case 'salary': return 'Staff Bonus';
      case 'vendor_payout': return 'Vendor Settlement';
      case 'other': return 'Other';
      default: return item.category ? item.category.replace(/_/g, ' ') : 'Expense';
    }
  };

  if (loading && expenses.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  return (
    <div className="space-y-3.5 sm:space-y-6 animate-page-enter flex-1 flex flex-col min-h-0">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
            Expenses
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Store operational costs and outflows
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="h-9 sm:h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center justify-center gap-2 w-full sm:w-auto active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* ─── MOBILE VIEW (< md) — Cardless, Edge-to-Edge Matching Vendors Page ─── */}
      <div className="md:hidden flex-1 overflow-y-auto h-[calc(100vh-210px)] min-h-[380px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 px-0.5">
        {loading ? (
          <div className="py-16 text-center">
            <CustomPageLoader mode="app" fullScreen={false} />
          </div>
        ) : unifiedItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
              No expense records found
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Store operational costs and bank fees will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y-0 pb-12">
            {/* 3-Column Header: Type | Account | Amount */}
            <div className="sticky top-0 z-10 bg-slate-50/95 dark:bg-[#0b0f19]/95 backdrop-blur-xs grid grid-cols-[1fr_95px_110px] items-center px-1.5 py-2.5 border-b border-slate-200/80 dark:border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none shadow-2xs">
              <div>Type</div>
              <div className="text-center">Account</div>
              <div className="text-right">Amount</div>
            </div>

            {unifiedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.rawExpense) setSelectedExpense(item.rawExpense);
                }}
                className={`w-full grid grid-cols-[1fr_95px_110px] items-center px-1.5 py-3 border-b border-slate-200/50 dark:border-slate-800/50 text-left active:opacity-60 transition-opacity min-w-0 ${
                  item.rawExpense ? 'cursor-pointer' : 'cursor-default'
                }`}
                title={`${getCategoryLabel(item)} (${item.accountName}): ${item.amount.toLocaleString()} ETB`}
              >
                {/* Col 1: Type (Clean text, no icon box or outline) */}
                <div className="min-w-0 pr-1">
                  <span className="text-[13px] font-bold text-slate-900 dark:text-white truncate block capitalize">
                    {getCategoryLabel(item)}
                  </span>
                </div>

                {/* Col 2: Account (Payment Source) */}
                <div className="text-center truncate px-1">
                  <span className="inline-block max-w-full truncate px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/70 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                    {item.accountName}
                  </span>
                </div>

                {/* Col 3: Amount */}
                <div
                  className="text-right font-mono font-bold text-[13px] text-rose-600 dark:text-rose-400 tabular-nums shrink-0"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  −{item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </div>
              </button>
            ))}

            {/* Footer count indicator */}
            <div className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>All {unifiedItems.length} expenses loaded</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── DESKTOP VIEW (≥ md) — Fixed-height Inside Scroll History Table ─── */}
      <div className="hidden md:flex bg-white dark:bg-[#131926] rounded-2xl overflow-hidden shadow-xs flex-1 flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto h-[calc(100vh-210px)] sm:h-[calc(100vh-190px)] min-h-[440px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#131926]/95 backdrop-blur-xs border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] shadow-2xs">
              <tr>
                <th className="py-3 px-5 whitespace-nowrap">Type / Category</th>
                <th className="py-3 px-5 whitespace-nowrap">Description</th>
                <th className="py-3 px-5 whitespace-nowrap">Account</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">Amount ETB</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    <CustomPageLoader mode="app" fullScreen={false} />
                  </td>
                </tr>
              ) : unifiedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    No expense or fee records found.
                  </td>
                </tr>
              ) : (
                unifiedItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (item.rawExpense) setSelectedExpense(item.rawExpense);
                    }}
                    className={`transition-colors group ${
                      item.rawExpense ? 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40 cursor-pointer' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                    }`}
                  >
                    <td className="py-3.5 px-5">
                      <span className="font-semibold text-xs sm:text-[13px] text-slate-900 dark:text-white capitalize">
                        {getCategoryLabel(item)}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="text-slate-900 dark:text-white font-bold text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {item.description}
                      </div>
                      {item.rawExpense?.vendor_contact && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                          <span>• {item.rawExpense.vendor_contact.name}</span>
                          {item.rawExpense.vendor_contact.phone && (
                            <span className="text-slate-400 font-mono text-[10px]">({item.rawExpense.vendor_contact.phone})</span>
                          )}
                        </div>
                      )}
                      {item.rawExpense?.inventory_unit && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <span>{item.rawExpense.inventory_unit.variant?.product?.name || 'Device'}</span>
                          {item.rawExpense.inventory_unit.imei_or_serial && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              • IMEI: {item.rawExpense.inventory_unit.imei_or_serial}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-slate-600 dark:text-slate-400 font-medium">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {item.accountName}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white text-xs">
                      {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.rawExpense && isOwner && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpenseToDelete(item.rawExpense!);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.rawExpense && (
                          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Detail Workspace Drawer */}
      <ExpenseDrawer
        expense={selectedExpense}
        isOpen={selectedExpense !== null}
        onClose={() => setSelectedExpense(null)}
        onDelete={(exp) => setExpenseToDelete(exp)}
        canDelete={isOwner}
      />

      {/* Tactile Record Expense Modal */}
      <RecordExpenseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        accounts={accounts}
        onSuccess={loadExpenses}
      />

      {/* Delete Expense Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => !isDeleting && setExpenseToDelete(null)}
          />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4 animate-modal-enter">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete Expense Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Are you sure you want to delete this expense? This will refund the money back to the account.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Description:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {expenseToDelete.description}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Refund Amount:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  +{Number(expenseToDelete.amount).toLocaleString()} ETB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Refund Account:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {expenseToDelete.financial_account?.name || 'Account'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-2.5">
              ⚠️ If this expense was paid toward a vendor debt or advance, the debt payment will be reversed and the vendor debt reopened.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setExpenseToDelete(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteExpense}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{isDeleting ? 'Deleting...' : 'Delete & Refund'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
