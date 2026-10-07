import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, FinancialAccount, User, BankFeeItem } from '../api/client';
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
  Receipt,
  TrendingDown,
  ChevronRight,
  Landmark,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { ExpenseDrawer } from '../components/drawers/ExpenseDrawer';
import { RecordExpenseModal } from '../components/RecordExpenseModal';
import { Pagination } from '../components/Pagination';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

interface ExpensesViewProps {
  accounts: FinancialAccount[];
  user?: User | null;
  initialShowRecordExpense?: boolean;
  onClearInitialContext?: () => void;
}

type ExpenseTabFilter = 'all' | 'bills' | 'fees' | 'draws';

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  accounts,
  user,
  initialShowRecordExpense,
  onClearInitialContext,
}) => {
  const isOwner = !user || user.role === 'owner';
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankFees, setBankFees] = useState<BankFeeItem[]>([]);
  const [totalBankFees, setTotalBankFees] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ExpenseTabFilter>('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

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
        setTotalBankFees(res.total_bank_fees || 0);
      } else if (Array.isArray(res)) {
        setExpenses(res);
        setBankFees([]);
        setTotalBankFees(0);
      }
      setCurrentPage(1);
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

  const totalDeductible = useMemo(
    () => operatingTotal + totalBankFees,
    [operatingTotal, totalBankFees]
  );

  // Unified items list for table based on active tab
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

    if (activeTab === 'all' || activeTab === 'bills' || activeTab === 'draws') {
      expenses.forEach((exp) => {
        if (activeTab === 'bills' && exp.is_owner_draw) return;
        if (activeTab === 'draws' && !exp.is_owner_draw) return;

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
    }

    if (activeTab === 'all' || activeTab === 'fees') {
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
    }

    // Sort descending by date
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, bankFees, activeTab]);

  const pagedItems = useMemo(() => {
    return unifiedItems.slice((currentPage - 1) * 8, currentPage * 8);
  }, [unifiedItems, currentPage]);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'bank_fee':
        return <Landmark className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'ride':
        return <Car className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />;
      case 'food':
        return <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'rent':
        return <Home className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'maintenance':
        return <Wrench className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
      case 'personal_owner_draw':
        return <UserMinus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      default:
        return <DollarSign className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />;
    }
  };

  if (loading && expenses.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
              Operating Expenses & Owner Draws
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
              Segregated Ledgers
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
            Strict segregation between shop operational costs and owner personal withdrawals
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

      {/* Desktop Summary Matrix (sm and up) */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Shop Bills */}
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Shop Bills & Vouchers
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center">
              <Receipt className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-white mt-2">
            <AnimatedNumber value={operatingTotal} decimals={2} />{' '}
            <span className="text-[11px] font-medium text-slate-400 font-sans">ETB</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">Rent, rides, utilities, salary</span>
        </div>

        {/* 2. Bank & Transfer Fees */}
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Bank & Transfer Fees
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center">
              <Landmark className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono tracking-tight text-blue-600 dark:text-blue-400 mt-2">
            <AnimatedNumber value={totalBankFees} decimals={2} />{' '}
            <span className="text-[11px] font-medium text-slate-400 font-sans">ETB</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">Automated wallet & bank charges</span>
        </div>

        {/* 3. Total Deductions */}
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600/80 dark:text-rose-400/80">
              Total Deductions
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono tracking-tight text-rose-600 dark:text-rose-400 mt-2">
            {totalDeductible > 0 ? '−' : ''}<AnimatedNumber value={totalDeductible} decimals={2} />{' '}
            <span className="text-[11px] font-medium text-rose-400/80 font-sans">ETB</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">Deducted from gross profit</span>
        </div>

        {/* 4. Owner Draws */}
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/70 dark:border-slate-800/80 p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600/80 dark:text-purple-400/80">
              Owner Draws
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 flex items-center justify-center">
              <UserMinus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-xl font-bold font-mono tracking-tight text-purple-600 dark:text-purple-400 mt-2">
            <AnimatedNumber value={ownerDrawsTotal} decimals={2} />{' '}
            <span className="text-[11px] font-medium text-slate-400 font-sans">ETB</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 block">Personal drawings</span>
        </div>
      </div>

      {/* Mobile Summary Matrix (< sm) */}
      <div className="sm:hidden grid grid-cols-2 gap-2.5">
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shop Bills</div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
            <AnimatedNumber value={operatingTotal} decimals={0} /> <span className="text-[9px] text-slate-400 font-sans">ETB</span>
          </div>
        </div>
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Bank Fees</div>
          <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            <AnimatedNumber value={totalBankFees} decimals={0} /> <span className="text-[9px] text-slate-400 font-sans">ETB</span>
          </div>
        </div>
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Total Deductions</div>
          <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {totalDeductible > 0 ? '−' : ''}<AnimatedNumber value={totalDeductible} decimals={0} /> <span className="text-[9px] text-slate-400 font-sans">ETB</span>
          </div>
        </div>
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-3 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Owner Draws</div>
          <div className="text-sm font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            <AnimatedNumber value={ownerDrawsTotal} decimals={0} /> <span className="text-[9px] text-slate-400 font-sans">ETB</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & History Table */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/70 dark:border-slate-800/80 overflow-hidden shadow-xs">
        {/* Filter Tabs Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-0.5 bg-slate-200/60 dark:bg-slate-800/80 rounded-lg text-xs font-semibold">
            <button
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({expenses.length + bankFees.length})
            </button>
            <button
              onClick={() => { setActiveTab('bills'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'bills'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Shop Bills ({operatingExpenses.length})
            </button>
            <button
              onClick={() => { setActiveTab('fees'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'fees'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Bank Fees ({bankFees.length})
            </button>
            <button
              onClick={() => { setActiveTab('draws'); setCurrentPage(1); }}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'draws'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Owner Draws ({ownerDraws.length})
            </button>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {unifiedItems.length} records in view
          </span>
        </div>

        {/* Desktop Table (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Type / Category</th>
                <th className="py-3 px-5">Description</th>
                <th className="py-3 px-5">Account</th>
                <th className="py-3 px-5 text-right">Amount ETB</th>
                <th className="py-3 px-5 text-center">Classification</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <CustomPageLoader mode="app" fullScreen={false} />
                  </td>
                </tr>
              ) : unifiedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    No expense or fee records found for this filter.
                  </td>
                </tr>
              ) : (
                pagedItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      if (item.rawExpense) setSelectedExpense(item.rawExpense);
                    }}
                    className={`transition-colors group ${
                      item.rawExpense ? 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40 cursor-pointer' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                    }`}
                  >
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(item.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        item.isFee
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      } capitalize`}>
                        {getCategoryIcon(item.category)}
                        <span>{item.isFee ? 'Bank Fee' : item.category.replace(/_/g, ' ')}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="text-slate-900 dark:text-white font-bold text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {item.description}
                      </div>
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

                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.isFee
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50'
                            : item.isOwnerDraw
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.isFee ? 'Bank Fee' : item.isOwnerDraw ? 'Owner Draw' : 'Business Expense'}
                      </span>
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

        {/* Mobile Native Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="py-6 text-center">
              <CustomPageLoader mode="app" fullScreen={false} />
            </div>
          ) : unifiedItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No records found for this filter.
            </div>
          ) : (
            pagedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.rawExpense) setSelectedExpense(item.rawExpense);
                }}
                className={`p-3.5 space-y-2 transition-colors ${
                  item.rawExpense ? 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30 cursor-pointer active:bg-slate-100' : ''
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                    item.isFee
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  } capitalize`}>
                    {getCategoryIcon(item.category)}
                    <span>{item.isFee ? 'Bank Fee' : item.category.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                      {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <div className="text-slate-900 dark:text-white font-bold text-xs">
                    {item.description}
                  </div>
                  {item.rawExpense?.inventory_unit && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      <span>{item.rawExpense.inventory_unit.variant?.product?.name || 'Device'}</span>
                      {item.rawExpense.inventory_unit.imei_or_serial && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          • {item.rawExpense.inventory_unit.imei_or_serial}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 dark:border-slate-800/50 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-slate-600 dark:text-slate-300 font-medium truncate max-w-[120px]">
                      {item.accountName}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(item.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                        item.isFee
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : item.isOwnerDraw
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {item.isFee ? 'Bank Fee' : item.isOwnerDraw ? 'Owner Draw' : 'Business'}
                    </span>
                    {item.rawExpense && isOwner && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpenseToDelete(item.rawExpense!);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {unifiedItems.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/60">
            <Pagination
              currentPage={currentPage}
              totalItems={unifiedItems.length}
              pageSize={8}
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
