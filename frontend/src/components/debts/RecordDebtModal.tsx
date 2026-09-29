import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Contact, FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  UserPlus,
  Wallet,
  CalendarDays,
  FileText,
} from 'lucide-react';

interface RecordDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: FinancialAccount[];
  onCreated?: () => void;
  onSuccess?: () => void;
  defaultType?: 'receivable' | 'payable';
}

export const RecordDebtModal: React.FC<RecordDebtModalProps> = ({
  isOpen,
  onClose,
  accounts,
  onCreated,
  onSuccess,
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

  const treasuryAccounts = accounts.filter((a) => !a.is_custom_asset);

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
      setDisburseAccountId(treasuryAccounts[0]?.id || '');
      setCashMovement(false);
      loadContacts();
    }
  }, [isOpen, defaultType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

      if (onCreated) onCreated();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to record', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-8 pt-0 sm:pt-24 pb-0 sm:pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-100 dark:border-slate-800 overflow-hidden animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[88vh] sm:max-h-[85vh] my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                Record Debt
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Log customer credit, peer vendor payout, or loan entry
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Type Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Transaction Direction
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDebtType('receivable')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  debtType === 'receivable'
                    ? 'border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    debtType === 'receivable'
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Someone Owes Me</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Customer credit · Receivable</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDebtType('payable')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  debtType === 'payable'
                    ? 'border-rose-500/60 bg-rose-50/60 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    debtType === 'payable'
                      ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">I Owe Someone</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">Vendor or Loan · Payable</div>
                </div>
              </button>
            </div>
          </div>

          {/* Contact */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Contact
            </label>
            {/* Mode toggle */}
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setContactMode('new')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                  className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                  required
                />
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                />
              </div>
            ) : (
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
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
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Amount ETB *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                <CalendarDays className="w-3 h-3 inline mr-1 text-slate-400" />
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              <FileText className="w-3 h-3 inline mr-1 text-slate-400" />
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Credit for accessories, shop loan, or supply payout"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
            />
          </div>

          {/* Cash Movement Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={cashMovement}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCashMovement(checked);
                  if (checked && !disburseAccountId && treasuryAccounts.length > 0) {
                    setDisburseAccountId(treasuryAccounts[0].id);
                  }
                }}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 dark:border-slate-600 text-slate-900 focus:ring-slate-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-slate-400" />
                  {debtType === 'receivable'
                    ? 'Disburse cash now'
                    : 'Receive cash now'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {debtType === 'receivable'
                    ? 'Money leaves your account immediately'
                    : 'Borrowed funds deposited into your account'}
                </span>
              </div>
            </label>

            {cashMovement && (
              <select
                value={disburseAccountId}
                onChange={(e) => setDisburseAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-600"
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
        <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131926] shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-10 px-5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] flex items-center gap-1.5 disabled:opacity-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 cursor-pointer"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : debtType === 'receivable' ? (
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            ) : (
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-400 dark:text-rose-600" />
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

  return createPortal(modalContent, document.body);
};

