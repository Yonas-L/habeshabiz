import React, { useState, useEffect } from 'react';
import type { Contact, FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  UserPlus,
  Wallet,
  CalendarDays,
  FileText,
} from 'lucide-react';

interface RecordDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  onCreated: () => void;
  defaultType?: 'receivable' | 'payable';
}

export const RecordDebtModal: React.FC<RecordDebtModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onCreated,
  defaultType = 'receivable',
}) => {
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>(defaultType);
  const [contactMode, setContactMode] = useState<'existing' | 'new'>('new');
  const [contactId, setContactId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [disburseAccountId, setDisburseAccountId] = useState('');
  const [cashMovement, setCashMovement] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDebtType(defaultType);
      setContactMode('new');
      setContactId('');
      setContactName('');
      setContactPhone('');
      setAmount('');
      setDueDate('');
      setNotes('');
      setDisburseAccountId('');
      setCashMovement(false);
      loadContacts();
    }
  }, [isOpen, defaultType]);

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const res = await api.getContacts();
      setContacts(res);
    } catch {
      // ignore
    } finally {
      setLoadingContacts(false);
    }
  };

  const treasuryAccounts = accounts.filter((a) => !a.is_custom_asset);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (contactMode === 'existing' && !contactId) {
      toast.error('Please select a contact');
      return;
    }
    if (contactMode === 'new' && !contactName.trim()) {
      toast.error('Please enter a contact name');
      return;
    }

    try {
      setSubmitting(true);
      await api.createDebt({
        type: debtType,
        ...(contactMode === 'existing'
          ? { contact_id: contactId }
          : { contact_name: contactName.trim(), contact_phone: contactPhone.trim() || undefined }),
        amount: parseFloat(amount),
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
        disburse_account_id: cashMovement && disburseAccountId ? disburseAccountId : undefined,
      });

      toast.success(
        debtType === 'receivable' ? 'Receivable recorded' : 'Payable recorded',
        {
          description: `${parseFloat(amount).toLocaleString()} ETB — ${
            contactMode === 'existing'
              ? contacts.find((c) => c.id === contactId)?.name
              : contactName
          }`,
        }
      );

      onCreated();
      onClose();
    } catch (err: any) {
      toast.error('Failed to record', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Record Receivable / Payable</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Log customer credit, peer vendor payout, or loan entry</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Type Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDebtType('receivable')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                  debtType === 'receivable'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <ArrowDownLeft
                  className={`w-4 h-4 ${
                    debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div
                    className={`text-xs font-bold ${
                      debtType === 'receivable' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Someone Owes Me
                  </div>
                  <div className="text-[10px] text-slate-400">Receivable</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDebtType('payable')}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                  debtType === 'payable'
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <ArrowUpRight
                  className={`w-4 h-4 ${
                    debtType === 'payable' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                  }`}
                />
                <div>
                  <div
                    className={`text-xs font-bold ${
                      debtType === 'payable' ? 'text-rose-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    I Owe Someone
                  </div>
                  <div className="text-[10px] text-slate-400">Payable</div>
                </div>
              </button>
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Contact
            </label>
            {/* Mode toggle */}
            <div className="flex gap-2 mb-2.5">
              <button
                type="button"
                onClick={() => setContactMode('new')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  contactMode === 'new'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <UserPlus className="w-3 h-3" />
                New Contact
              </button>
              <button
                type="button"
                onClick={() => setContactMode('existing')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  contactMode === 'existing'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Existing Contact
              </button>
            </div>

            {contactMode === 'new' ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Full Name *"
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                  required
                />
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
            ) : (
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                required
              >
                <option value="">
                  {loadingContacts ? 'Loading contacts...' : '— Select a contact —'}
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Amount (ETB) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                <CalendarDays className="w-3 h-3 inline mr-1" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <FileText className="w-3 h-3 inline mr-1" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason, context, or reference..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 resize-none"
            />
          </div>

          {/* Cash Movement Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cashMovement}
                onChange={(e) => setCashMovement(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-slate-500" />
                  {debtType === 'receivable'
                    ? 'Cash was disbursed from an account'
                    : 'Cash was received into an account'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {debtType === 'receivable'
                    ? 'The money has already left your bank — deduct the balance now'
                    : 'The borrowed money was deposited — increase the balance now'}
                </span>
              </div>
            </label>

            {cashMovement && (
              <select
                value={disburseAccountId}
                onChange={(e) => setDisburseAccountId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                required
              >
                <option value="">— Select Account —</option>
                {treasuryAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                  </option>
                ))}
              </select>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`h-9 px-5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50 ${
              debtType === 'receivable'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : debtType === 'receivable' ? (
              <ArrowDownLeft className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5" />
            )}
            <span>
              {submitting
                ? 'Recording...'
                : debtType === 'receivable'
                ? 'Record Receivable'
                : 'Record Payable'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
