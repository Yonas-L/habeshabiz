import React, { useState, useEffect } from 'react';
import type { Expense, FinancialAccount } from '../api/client';
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
  X,
  Receipt,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import { MiniSparkline, MiniBarHistogram } from '../components/Charts';
import { AnimatedNumber } from '../components/AnimatedNumber';

interface ExpensesViewProps {
  accounts: FinancialAccount[];
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ accounts }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Record Expense Modal
  const [showModal, setShowModal] = useState(false);
  const [category, setCategory] = useState('ride');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [accountId, setAccountId] = useState('');
  const [isOwnerDraw, setIsOwnerDraw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const res = await api.getExpenses();
      setExpenses(res);
    } catch (err: any) {
      toast.error('Failed to load expenses', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId) return;

    try {
      setSubmitting(true);
      const isDraw = isOwnerDraw || category === 'personal_owner_draw';
      await api.recordExpense({
        financial_account_id: accountId,
        category,
        amount: parseFloat(amount),
        is_owner_draw: isDraw,
        description,
      });

      toast.success(isDraw ? 'Owner Personal Draw Recorded' : 'Operating Expense Recorded', {
        description: `${parseFloat(amount).toLocaleString()} ETB • ${description}`,
      });

      setShowModal(false);
      setAmount('');
      setDescription('');
      loadExpenses();
    } catch (err: any) {
      toast.error('Failed to record expense', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const operatingTotal = expenses
    .filter((e) => !e.is_owner_draw)
    .reduce((sum, e) => sum + parseFloat(String(e.amount)), 0);

  const ownerDrawsTotal = expenses
    .filter((e) => e.is_owner_draw)
    .reduce((sum, e) => sum + parseFloat(String(e.amount)), 0);

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
        return <UserMinus className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
              <Sparkles className="w-3 h-3" />
              Uncommingled Ledgers
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict segregation between shop operational costs and owner personal withdrawals
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setAccountId(accounts[0]?.id || '');
          }}
          className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-2 self-start sm:self-auto active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>Record Expense / Draw</span>
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
              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-2">
              <AnimatedNumber value={operatingTotal} decimals={2} />{' '}
              <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Deducted from Net Profit</span>
            <MiniBarHistogram values={[12, 18, 15, 24, 20, 28, 30]} color="indigo" />
          </div>
        </div>

        {/* 2. Owner Draws */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Owner Personal Draws (Yoni)
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/60 flex items-center justify-center">
                <UserMinus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-400 font-mono tabular-nums tracking-tight mt-2">
              <AnimatedNumber value={ownerDrawsTotal} decimals={2} />{' '}
              <span className="text-xs font-bold text-purple-400 font-sans">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-purple-500 dark:text-purple-400 font-medium">Does not distort shop margins</span>
            <MiniSparkline values={[20, 22, 25, 24, 30, 32, 35]} color="purple" />
          </div>
        </div>

        {/* 3. Total Outflows Handled */}
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Cash Outflows
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-2">
              <AnimatedNumber value={operatingTotal + ownerDrawsTotal} decimals={2} />{' '}
              <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">{expenses.length} Records In Ledger</span>
            <MiniSparkline values={[32, 40, 40, 48, 50, 60, 65]} color="amber" />
          </div>
        </div>
      </div>

      {/* Expense History Table */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5">Description / Detail</th>
                <th className="py-3 px-5">Paid From Account</th>
                <th className="py-3 px-5 text-right">Amount (ETB)</th>
                <th className="py-3 px-5 text-center">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                      <span>Loading expense ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    No expense or drawing records found.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(exp.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700 text-slate-800 dark:text-slate-200 capitalize">
                        {getCategoryIcon(exp.category)}
                        <span>{exp.category.replace(/_/g, ' ')}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-slate-900 dark:text-white font-bold text-sm">
                      {exp.description}
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
                            ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {exp.is_owner_draw ? 'Owner Draw' : 'Business Expense'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tactile Record Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowModal(false)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 max-w-lg w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Record Expense or Personal Draw</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Segregate shop overhead from personal withdrawals to preserve accurate accounting
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Expense Category
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setCategory(cat);
                    setIsOwnerDraw(cat === 'personal_owner_draw');
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                >
                  <option value="ride">RIDE / Transportation & Delivery</option>
                  <option value="food">Food & Hospitality</option>
                  <option value="rent">Shop Rent & Utilities</option>
                  <option value="maintenance">Device Maintenance & Tooling</option>
                  <option value="salary">Staff Daily Pay / Commission</option>
                  <option value="personal_owner_draw">Personal Owner Draw (Yoni)</option>
                  <option value="other">Other Operational Expense</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Amount (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Paid From Account
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                    required
                  >
                    {accounts
                      .filter((a) => !a.is_custom_asset)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Customer delivery ride to Bole Medhanialem"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                  required
                />
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <input
                  type="checkbox"
                  id="isOwnerDraw"
                  checked={isOwnerDraw}
                  onChange={(e) => setIsOwnerDraw(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
                <label htmlFor="isOwnerDraw" className="text-xs text-slate-700 dark:text-slate-300 font-medium select-none">
                  Mark as Owner Personal Draw (Does not reduce shop profit)
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs active:scale-[0.98]"
                >
                  {submitting ? 'Recording...' : 'Record Outflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
