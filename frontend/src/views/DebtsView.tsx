import React, { useState, useEffect } from 'react';
import type { Debt, FinancialAccount } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Search, Loader2, ChevronRight, Plus, Pencil, Trash2, CalendarDays, AlertTriangle } from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DebtDrawer } from '../components/drawers/DebtDrawer';
import { RecordDebtModal } from '../components/debts/RecordDebtModal';
import { Pagination } from '../components/Pagination';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

interface DebtsViewProps {
  accounts: FinancialAccount[];
}

export const DebtsView: React.FC<DebtsViewProps> = ({ accounts }) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>('receivable');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected Debt for Workspace Drawer
  const [drawerDebt, setDrawerDebt] = useState<Debt | null>(null);

  // Record Debt Modal
  const [showRecordModal, setShowRecordModal] = useState(false);

  // Inline Edit State
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const openEdit = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDebt(debt);
    setEditNotes(debt.notes || '');
    setEditDueDate(debt.due_date ? debt.due_date.split('T')[0] : '');
    setEditAmount(String(debt.original_amount));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    try {
      setSaving(true);
      await api.updateDebt(editingDebt.id, {
        amount: parseFloat(editAmount) || undefined,
        due_date: editDueDate || null,
        notes: editNotes.trim() || null,
      });
      toast.success('Debt record updated');
      setEditingDebt(null);
      loadDebts();
    } catch (err: any) {
      toast.error('Failed to update', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (debt: Debt, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingDebt(debt);
  };

  const handleDelete = async () => {
    if (!deletingDebt) return;
    try {
      setDeleting(true);
      await api.deleteDebt(deletingDebt.id);
      toast.success('Debt record deleted');
      setDeletingDebt(null);
      loadDebts();
    } catch (err: any) {
      toast.error('Cannot delete', { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  // Gross sum of individual ledger records
  const grossTotal = debts.reduce((sum, d) => sum + parseFloat(String(d.remaining_amount)), 0);

  // Group contacts to calculate true bilateral netted collectible/payable position
  const contactsMap = new Map<string, { name: string; net_balance: number; open_receivable: number; open_payable: number }>();
  debts.forEach((d) => {
    if (d.contact && !contactsMap.has(d.contact.id)) {
      contactsMap.set(d.contact.id, {
        name: d.contact.name,
        net_balance: Number(d.contact.net_balance ?? 0),
        open_receivable: Number(d.contact.open_receivable ?? 0),
        open_payable: Number(d.contact.open_payable ?? 0),
      });
    }
  });

  const distinctContacts = Array.from(contactsMap.values());
  const distinctPartiesCount = distinctContacts.length;

  const netPosition = debtType === 'receivable'
    ? distinctContacts.reduce((sum, c) => sum + Math.max(0, c.net_balance), 0)
    : distinctContacts.reduce((sum, c) => sum + Math.max(0, -c.net_balance), 0);

  const totalOffsets = Math.max(0, grossTotal - netPosition);
  const hasOffsets = totalOffsets > 0.01;

  const formatDueDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    const isOverdue = d < now && d.toDateString() !== now.toDateString();
    return {
      label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      isOverdue,
    };
  };

  if (loading && debts.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Top Header & Type Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Segmented Control */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
          <button
            onClick={() => {
              setDebtType('receivable');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg transition-all ${
              debtType === 'receivable'
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Receivables
          </button>
          <button
            onClick={() => {
              setDebtType('payable');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg transition-all ${
              debtType === 'payable'
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Payables
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contact or notes..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 focus:border-slate-900 dark:focus:border-slate-700 shadow-xs placeholder:text-slate-400"
            />
          </form>

          {/* Record Button */}
          <button
            onClick={() => setShowRecordModal(true)}
            className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-[0.98] flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Record Entry</span>
          </button>
        </div>
      </div>

      {/* Summary Total Bar */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {debtType === 'receivable' ? 'Net Collectible Position' : 'Net Payable Due'}
            </span>
            {hasOffsets && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Bilaterally Netted
              </span>
            )}
          </div>
          <div
            className={`text-3xl font-extrabold font-mono tabular-nums tracking-tight mt-1 ${
              debtType === 'receivable' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            <AnimatedNumber value={netPosition} />{' '}
            <span className="text-sm font-normal text-slate-400 font-sans">ETB</span>
          </div>
          {hasOffsets && (
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Gross records: <span className="font-mono font-medium">{grossTotal.toLocaleString()} ETB</span></span>
              <span>·</span>
              <span>Offsetting {debtType === 'receivable' ? 'payables' : 'receivables'}: <span className="font-mono font-medium text-rose-600/80 dark:text-rose-400/80">−{totalOffsets.toLocaleString()} ETB</span></span>
            </div>
          )}
        </div>
        <div className="text-left sm:text-right text-xs text-slate-400">
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            {debts.length} active records across {distinctPartiesCount} {distinctPartiesCount === 1 ? 'party' : 'parties'}
          </div>
          <div className="text-[11px] text-slate-400">Click any row to open focused workspace or settle</div>
        </div>
      </div>

      {/* Debt Table with Click-to-Open Drawer */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-2xs">
        {/* Desktop Table (md and up) */}
        <div className="hidden md:block w-full overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Due Date</th>
                <th className="py-3 px-3.5 hidden xl:table-cell">Notes</th>
                <th className="py-3 px-3.5 text-right font-mono whitespace-nowrap hidden lg:table-cell">Original</th>
                <th className="py-3 px-3.5 text-right font-mono whitespace-nowrap hidden lg:table-cell">Paid</th>
                <th className="py-3 px-4 text-right font-mono whitespace-nowrap">Remaining Balance</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <CustomPageLoader mode="app" fullScreen={false} />
                  </td>
                </tr>
              ) : debts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 font-sans italic">
                    No outstanding {debtType} records found.
                  </td>
                </tr>
              ) : (
                debts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((debt) => {
                  const due = formatDueDate(debt.due_date);
                  const isManual = debt.reference_type === 'direct_credit';
                  const hasPayments = parseFloat(String(debt.paid_amount)) > 0;
                  const hasOffset = debt.contact && ((debt.contact.open_payable ?? 0) > 0 && (debt.contact.open_receivable ?? 0) > 0);

                  return (
                    <tr
                      key={debt.id}
                      onClick={() => setDrawerDebt(debt)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            debtType === 'receivable'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                          }`}>
                            {(debt.contact?.name || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-white text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                {debt.contact?.name}
                              </span>
                              {debt.reference_type === 'handover_holding' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                  Handover
                                </span>
                              )}
                              {debt.reference_type === 'vendor_return_refund' && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-400">
                                  Refund
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>{debt.contact?.phone || 'No phone'}</span>
                              {hasOffset && (
                                <span className="font-sans font-medium text-slate-500 dark:text-slate-400">
                                  · Net: {(debt.contact?.net_balance ?? 0) > 0 ? `+${Number(debt.contact?.net_balance).toLocaleString()} ETB` : `−${Math.abs(Number(debt.contact?.net_balance)).toLocaleString()} ETB`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {due ? (
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                              due.isOverdue
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {due.isOverdue ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            ) : (
                              <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span>{due.label}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-300 dark:text-slate-600 italic">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 max-w-[180px] truncate text-xs hidden xl:table-cell" title={debt.notes || ''}>
                        {debt.notes || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap hidden lg:table-cell">
                        {Number(debt.original_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-slate-400 font-sans ml-1">ETB</span>
                      </td>

                      <td className="py-3 px-3.5 text-right font-mono text-xs tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap hidden lg:table-cell">
                        {Number(debt.paid_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-slate-400 font-sans ml-1">ETB</span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-xs tabular-nums">
                          <span className={debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {Number(debt.remaining_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] font-sans font-normal text-slate-400 ml-1">ETB</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono lg:hidden mt-0.5">
                          {hasPayments ? (
                            <span>{Number(debt.paid_amount).toLocaleString()} paid / {Number(debt.original_amount).toLocaleString()} orig</span>
                          ) : (
                            <span>Orig: {Number(debt.original_amount).toLocaleString()}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            debt.status === 'settled'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : debt.status === 'partially_paid'
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                              : debtType === 'receivable'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            debt.status === 'settled'
                              ? 'bg-slate-400'
                              : debt.status === 'partially_paid'
                              ? 'bg-amber-500'
                              : debtType === 'receivable'
                              ? 'bg-emerald-500'
                              : 'bg-rose-500'
                          }`} />
                          {debt.status === 'settled' ? 'Settled' : debt.status === 'partially_paid' ? 'Partial' : 'Open'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Settle / Record Payment button */}
                          {parseFloat(String(debt.remaining_amount)) > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => handleOpenSettleModal(debt, e)}
                              className={`h-7 px-3 rounded-lg text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer inline-flex items-center justify-center ${
                                debtType === 'receivable'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-rose-600 hover:bg-rose-700 text-white'
                              }`}
                            >
                              {debtType === 'receivable' ? 'Collect' : 'Pay'}
                            </button>
                          ) : (
                            <span className="text-[11px] font-medium text-slate-400 px-2 py-1">
                              Settled
                            </span>
                          )}

                          {/* Edit — only for manual debts */}
                          {isManual && (
                            <button
                              type="button"
                              onClick={(e) => openEdit(debt, e)}
                              title="Edit record"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete — only if no payments have been made */}
                          {isManual && !hasPayments && (
                            <button
                              type="button"
                              onClick={(e) => confirmDelete(debt, e)}
                              title="Delete record"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all ml-0.5" />
                        </div>
                      </td>
                    </tr>
                  );
                })
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
          ) : debts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No outstanding {debtType} records found.
            </div>
          ) : (
            debts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((debt) => {
              const due = formatDueDate(debt.due_date);
              const isManual = debt.reference_type === 'direct_credit';
              const hasPayments = parseFloat(String(debt.paid_amount)) > 0;
              const hasOffset = debt.contact && ((debt.contact.open_payable ?? 0) > 0 && (debt.contact.open_receivable ?? 0) > 0);

              return (
                <div
                  key={debt.id}
                  onClick={() => setDrawerDebt(debt)}
                  className="p-4 space-y-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {debt.contact?.name}
                        </span>
                        {debt.reference_type === 'handover_holding' && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                            Handover
                          </span>
                        )}
                        {debt.reference_type === 'vendor_return_refund' && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/50">
                            Return Refund
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {debt.contact?.phone || 'No phone'}
                        {hasOffset && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
                            · Net: {(debt.contact?.net_balance ?? 0) > 0 ? `+${Number(debt.contact?.net_balance).toLocaleString()} ETB` : (debt.contact?.net_balance ?? 0) < 0 ? `−${Math.abs(Number(debt.contact?.net_balance)).toLocaleString()} ETB` : 'Settled'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-mono font-bold text-base ${debtType === 'receivable' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        {Number(debt.remaining_amount).toLocaleString()} <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                      </div>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize mt-1 ${
                          debt.status === 'settled'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            : debt.status === 'partially_paid'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                        }`}
                      >
                        {debt.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Due Date */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100/80 dark:border-slate-800/50">
                    <div className="min-w-0 truncate text-[11px]">
                      {debt.notes || <span className="italic text-slate-400">No notes</span>}
                    </div>
                    {due && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                          due.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        {due.isOverdue && <AlertTriangle className="w-3 h-3" />}
                        <CalendarDays className="w-3 h-3" />
                        {due.label}
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                      <span>Orig: {Number(debt.original_amount).toLocaleString()}</span>
                      {hasPayments && <span>• Paid: {Number(debt.paid_amount).toLocaleString()}</span>}
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isManual && (
                        <button
                          onClick={(e) => openEdit(debt, e)}
                          title="Edit"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isManual && !hasPayments && (
                        <button
                          onClick={(e) => confirmDelete(debt, e)}
                          title="Delete"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {parseFloat(String(debt.remaining_amount)) > 0 && (
                        <button
                          onClick={(e) => handleOpenSettleModal(debt, e)}
                          className="h-7 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 shadow-xs"
                        >
                          Settle
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-1" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="px-5 pb-4">
          <Pagination
            currentPage={currentPage}
            totalItems={debts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Debt Detail Workspace Drawer */}
      <DebtDrawer
        debt={drawerDebt}
        isOpen={drawerDebt !== null}
        onClose={() => setDrawerDebt(null)}
        accounts={accounts}
        onPaymentSettled={loadDebts}
        onDebtUpdated={loadDebts}
      />

      {/* Record Debt Modal */}
      <RecordDebtModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        accounts={accounts}
        onCreated={loadDebts}
        defaultType={debtType}
      />

      {/* Edit Debt Modal */}
      {editingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingDebt(null)} />
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Debt — {editingDebt.contact?.name}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Update amount, due date, or notes
              </p>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Amount ETB
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDebt(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeletingDebt(null)} />
          <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Debt Record?</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {deletingDebt.contact?.name} — {Number(deletingDebt.original_amount).toLocaleString()} ETB
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This will permanently remove this debt record. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingDebt(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-9 px-5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
