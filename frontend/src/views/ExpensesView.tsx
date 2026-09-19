import React, { useState, useEffect } from 'react';
import type { Expense, FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { DollarSign, Plus, UserMinus, Car, Coffee, Home, Wrench, Loader2, X } from 'lucide-react';

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

      toast.success(isDraw ? 'Owner personal draw recorded' : 'Operating expense recorded', {
        description: `${parseFloat(amount).toLocaleString()} ETB &bull; ${description}`,
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
        return <Car className="w-3.5 h-3.5 text-slate-500" />;
      case 'food':
        return <Coffee className="w-3.5 h-3.5 text-amber-600" />;
      case 'rent':
        return <Home className="w-3.5 h-3.5 text-blue-600" />;
      case 'maintenance':
        return <Wrench className="w-3.5 h-3.5 text-indigo-600" />;
      case 'personal_owner_draw':
        return <UserMinus className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <DollarSign className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900 text-base">Operating Expenses & Owner Drawings</h2>
          <p className="text-xs text-slate-400">
            Strict segregation between store operational costs and owner personal withdrawals
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setAccountId(accounts[0]?.id || '');
          }}
          className="h-8 px-3 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Expense / Draw</span>
        </button>
      </div>

      {/* Summary Matrix (Squarish, clean un-nested cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Shop Operating Expenses
          </span>
          <div className="text-2xl font-semibold text-slate-900 font-mono tracking-tight mt-0.5">
            {operatingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-slate-400">ETB</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Deducted directly from Net Operating Profit
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-purple-600">
            Owner Personal Drawings (Draws)
          </span>
          <div className="text-2xl font-semibold text-purple-700 font-mono tracking-tight mt-0.5">
            {ownerDrawsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-purple-400">ETB</span>
          </div>
          <span className="text-[11px] text-purple-400 mt-1 block">
            Personal drawings that do not distort store operating margins
          </span>
        </div>
      </div>

      {/* Expense History Table (Clean, no card in card) */}
      <div className="bg-white rounded-lg border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-medium">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Description / Detail</th>
                <th className="py-2.5 px-4">Paid From Account</th>
                <th className="py-2.5 px-4 text-right">Amount (ETB)</th>
                <th className="py-2.5 px-4 text-center">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                      <span>Loading expense ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 border border-slate-200/70 text-slate-800 capitalize">
                        {getCategoryIcon(exp.category)}
                        <span>{exp.category.replace(/_/g, ' ')}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-900 font-medium">
                      {exp.description}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {exp.financial_account?.name || 'Cash'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                      {Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          exp.is_owner_draw
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/50'
                            : 'bg-slate-100 text-slate-600'
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
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowModal(false)}
          />

          <div className="relative z-10 bg-white rounded-lg border border-slate-200 shadow-2xl ring-1 ring-black/5 max-w-md w-full p-5 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Record Expense or Personal Draw</h3>
                <p className="text-[11px] text-slate-400">Accurately track operational outflows and owner draws</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setCategory(cat);
                    setIsOwnerDraw(cat === 'personal_owner_draw');
                  }}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
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

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Amount (ETB)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 350"
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Paid From Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Description / Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Customer delivery ride to Bole Medhanialem"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-100">
                <input
                  type="checkbox"
                  id="isOwnerDraw"
                  checked={isOwnerDraw}
                  onChange={(e) => setIsOwnerDraw(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="isOwnerDraw" className="text-xs text-slate-700 select-none">
                  Mark as Owner Personal Draw (Does not reduce shop profit)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-8 px-3 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-8 px-4 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs active:scale-[0.98]"
                >
                  {submitting ? 'Recording...' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
