import React, { useState, useEffect } from 'react';
import type { Expense, FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { DollarSign, Plus, UserMinus, Car, Coffee, Home, Wrench } from 'lucide-react';

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

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const res = await api.getExpenses();
      setExpenses(res);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !accountId) return;

    try {
      setSubmitting(true);
      await api.recordExpense({
        financial_account_id: accountId,
        category,
        amount: parseFloat(amount),
        is_owner_draw: isOwnerDraw || category === 'personal_owner_draw',
        description,
      });

      setShowModal(false);
      setAmount('');
      setDescription('');
      loadExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense.');
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">Daily Expenses & Owner Draws</h2>
          <p className="text-xs text-slate-500">
            Clean segregation between shop operating costs and owner personal withdrawals
          </p>
        </div>

        <button
          onClick={() => {
            setShowModal(true);
            setAccountId(accounts[0]?.id || '');
          }}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Record Expense / Draw</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Business Operating Expenses</div>
          <div className="text-2xl font-semibold text-slate-900 font-mono tracking-tight mt-1">
            {operatingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs text-slate-500">ETB</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Directly impacts Net Operating Profit</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="text-xs text-purple-600 font-medium">Owner Personal Withdrawals (Draws)</div>
          <div className="text-2xl font-semibold text-purple-700 font-mono tracking-tight mt-1">
            {ownerDrawsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
            <span className="text-xs text-purple-600">ETB</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Personal cash out, does not distort store profit</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-medium">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Paid From Account</th>
                <th className="py-3 px-4 text-right">Amount (ETB)</th>
                <th className="py-3 px-4 text-center">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {new Date(exp.date).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/60 font-medium text-slate-800 capitalize">
                        {getCategoryIcon(exp.category)}
                        <span>{exp.category.replace(/_/g, ' ')}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-900 font-medium">
                      {exp.description}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {exp.financial_account?.name || 'Cash'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                      {Number(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
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

      {/* Record Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Record Expense or Draw</h3>
                <p className="text-[11px] text-slate-500">Record operational expense or owner withdrawal</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setCategory(cat);
                    setIsOwnerDraw(cat === 'personal_owner_draw');
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900"
                >
                  <option value="ride">RIDE / Transportation</option>
                  <option value="food">Food & Hospitality</option>
                  <option value="rent">Shop Rent & Utilities</option>
                  <option value="maintenance">Equipment & Device Repair</option>
                  <option value="salary">Staff Salary / Daily Pay</option>
                  <option value="personal_owner_draw">Personal Owner Draw (Yoni)</option>
                  <option value="other">Other Operational</option>
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
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Paid From Account</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900"
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Customer delivery ride to Bole"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs text-slate-900"
                  required
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <input
                  type="checkbox"
                  id="isOwnerDraw"
                  checked={isOwnerDraw}
                  onChange={(e) => setIsOwnerDraw(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="isOwnerDraw" className="text-xs text-slate-700">
                  This is an Owner Personal Draw (Does not reduce business profit)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
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
