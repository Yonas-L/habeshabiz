import React, { useState, useEffect, useMemo } from 'react';
import type { Debt, FinancialAccount, Contact } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Search,
  Loader2,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { DebtDrawer } from '../components/drawers/DebtDrawer';
import { RecordDebtModal } from '../components/debts/RecordDebtModal';
import { PartySettleModal } from '../components/debts/PartySettleModal';
import { Pagination } from '../components/Pagination';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

interface DebtsViewProps {
  accounts: FinancialAccount[];
}

interface PartyDebtGroup {
  contactId: string;
  contact: Contact | null;
  name: string;
  phone: string | null;
  debts: Debt[];
  totalOriginal: number;
  totalPaid: number;
  totalRemaining: number;
  openCount: number;
  settledCount: number;
  percentSettled: number;
}

const getOriginLabel = (refType?: string) => {
  switch (refType) {
    case 'handover_holding':
      return 'Handover';
    case 'vendor_return_refund':
      return 'Refund';
    case 'direct_credit':
      return 'Credit';
    case 'sales_order':
      return 'Sale';
    case 'consignment_sale':
      return 'Consignment';
    case 'brokered_sourcing':
      return 'Sourcing';
    case 'salesperson_bonus':
      return 'Bonus';
    default:
      return 'Direct';
  }
};

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

export const DebtsView: React.FC<DebtsViewProps> = ({ accounts }) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>('receivable');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'settled'>('active');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Expanded party cards state
  const [expandedParties, setExpandedParties] = useState<Record<string, boolean>>({});

  // Drawer / Modals State
  const [drawerDebt, setDrawerDebt] = useState<Debt | null>(null);
  const [settlingParty, setSettlingParty] = useState<PartyDebtGroup | null>(null);
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
      toast.error('Failed to load obligations', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDebts();
  };

  const toggleParty = (partyId: string) => {
    setExpandedParties((prev) => ({
      ...prev,
      [partyId]: !prev[partyId],
    }));
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
      toast.success('Record updated');
      setEditingDebt(null);
      loadDebts();
    } catch (err: any) {
      toast.error('Update failed', { description: err.message });
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
      toast.success('Record deleted');
      setDeletingDebt(null);
      loadDebts();
    } catch (err: any) {
      toast.error('Cannot delete', { description: err.message });
    } finally {
      setDeleting(false);
    }
  };

  // Group debts by party (contact)
  const partyGroups = useMemo(() => {
    const map = new Map<string, PartyDebtGroup>();

    debts.forEach((debt) => {
      const cid = debt.contact?.id || 'unassigned';
      if (!map.has(cid)) {
        map.set(cid, {
          contactId: cid,
          contact: debt.contact || null,
          name: debt.contact?.name || 'Unassigned',
          phone: debt.contact?.phone || null,
          debts: [],
          totalOriginal: 0,
          totalPaid: 0,
          totalRemaining: 0,
          openCount: 0,
          settledCount: 0,
          percentSettled: 0,
        });
      }
      const group = map.get(cid)!;
      group.debts.push(debt);
      const orig = parseFloat(String(debt.original_amount)) || 0;
      const paid = parseFloat(String(debt.paid_amount)) || 0;
      const rem = parseFloat(String(debt.remaining_amount)) || 0;
      group.totalOriginal += orig;
      group.totalPaid += paid;
      group.totalRemaining += rem;
      if (rem > 0.001) {
        group.openCount += 1;
      } else {
        group.settledCount += 1;
      }
    });

    // Sort debts inside each party by created_at ASC (FIFO chronological order)
    map.forEach((g) => {
      g.debts.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      g.percentSettled = g.totalOriginal > 0 ? Math.min(100, Math.round((g.totalPaid / g.totalOriginal) * 100)) : 0;
    });

    let list = Array.from(map.values());

    // Apply status filter
    if (statusFilter === 'active') {
      list = list.filter((g) => g.totalRemaining > 0.001);
    } else if (statusFilter === 'settled') {
      list = list.filter((g) => g.totalRemaining <= 0.001);
    }

    // Sort: open obligations first (highest balance), then settled
    return list.sort((a, b) => {
      if (a.totalRemaining > 0 && b.totalRemaining <= 0) return -1;
      if (b.totalRemaining > 0 && a.totalRemaining <= 0) return 1;
      return b.totalRemaining - a.totalRemaining;
    });
  }, [debts, statusFilter]);

  // Overall Totals
  const grossTotal = debts.reduce((sum, d) => sum + parseFloat(String(d.remaining_amount)), 0);

  const contactsMap = new Map<string, { net_balance: number }>();
  debts.forEach((d) => {
    if (d.contact && !contactsMap.has(d.contact.id)) {
      contactsMap.set(d.contact.id, {
        net_balance: Number(d.contact.net_balance ?? 0),
      });
    }
  });

  const distinctContacts = Array.from(contactsMap.values());
  const netPosition = debtType === 'receivable'
    ? distinctContacts.reduce((sum, c) => sum + Math.max(0, c.net_balance), 0)
    : distinctContacts.reduce((sum, c) => sum + Math.max(0, -c.net_balance), 0);

  const totalOffsets = Math.max(0, grossTotal - netPosition);
  const hasOffsets = totalOffsets > 0.01;

  if (loading && debts.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  const paginatedParties = partyGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Type Switcher */}
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

        {/* Filter Pills & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-[11px] font-semibold">
            <button
              onClick={() => {
                setStatusFilter('active');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setStatusFilter('settled');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'settled'
                  ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Settled
            </button>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contact..."
              className="w-full h-9 pl-8.5 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 shadow-xs placeholder:text-slate-400"
            />
          </form>

          <button
            onClick={() => setShowRecordModal(true)}
            className="h-9 px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Entry</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {debtType === 'receivable' ? 'Total Collectible Balance' : 'Total Payable Balance'}
          </span>
          <div
            className={`text-3xl font-extrabold font-mono tabular-nums tracking-tight mt-1 ${
              debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <AnimatedNumber value={netPosition} />{' '}
            <span className="text-sm font-normal text-slate-400 font-sans">ETB</span>
          </div>
          {hasOffsets && (
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Gross: <span className="font-mono font-medium">{grossTotal.toLocaleString()} ETB</span></span>
              <span>·</span>
              <span>Offset: <span className="font-mono font-medium text-rose-500">−{totalOffsets.toLocaleString()} ETB</span></span>
            </div>
          )}
        </div>
        <div className="text-left sm:text-right text-xs text-slate-400">
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            {partyGroups.length} {partyGroups.length === 1 ? 'party' : 'parties'} · {debts.length} total records
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Click any party to expand individual obligations</div>
        </div>
      </div>

      {/* Party Collapsible Accordion List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <CustomPageLoader mode="app" fullScreen={false} />
          </div>
        ) : paginatedParties.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs italic bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800">
            No {debtType} records found.
          </div>
        ) : (
          paginatedParties.map((group) => {
            const isExpanded = !!expandedParties[group.contactId];
            const isSettled = group.totalRemaining <= 0.001;

            return (
              <div
                key={group.contactId}
                className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-2xs transition-all"
              >
                {/* Collapsed Header Row */}
                <div
                  onClick={() => toggleParty(group.contactId)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      aria-label="Toggle party obligations"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        debtType === 'receivable'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {group.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {group.name}
                        </span>
                        {isSettled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Complete
                          </span>
                        ) : group.percentSettled > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            {group.percentSettled}% Settled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Open
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                        <span>{group.phone || 'No phone'}</span>
                        <span>·</span>
                        <span>{group.openCount} open of {group.debts.length} records</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Balance and Primary Action Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-10 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                    <div className="text-left sm:text-right">
                      <div
                        className={`font-mono font-bold text-base tabular-nums ${
                          isSettled
                            ? 'text-slate-400 dark:text-slate-500'
                            : debtType === 'receivable'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {group.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-[11px] font-sans font-normal text-slate-400 ml-1">ETB</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Paid: {group.totalPaid.toLocaleString()} of {group.totalOriginal.toLocaleString()}
                      </div>
                    </div>

                    {/* Waterfall Action Button */}
                    {!isSettled ? (
                      <button
                        type="button"
                        onClick={() => setSettlingParty(group)}
                        className={`h-8 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap ${
                          debtType === 'receivable'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-rose-600 hover:bg-rose-700'
                        }`}
                      >
                        {debtType === 'receivable' ? 'Collect' : 'Pay'}
                      </button>
                    ) : (
                      <span className="h-8 px-3 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-400 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded Inside List (Fixed height scrollable) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-2 flex items-center justify-between">
                      <span>Hierarchical obligations (Oldest settled first)</span>
                      <span>{group.debts.length} entries</span>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y-0">
                      {group.debts.map((debt, index) => {
                        const due = formatDueDate(debt.due_date);
                        const isManual = debt.reference_type === 'direct_credit';
                        const orig = parseFloat(String(debt.original_amount)) || 0;
                        const paid = parseFloat(String(debt.paid_amount)) || 0;
                        const rem = parseFloat(String(debt.remaining_amount)) || 0;
                        const pct = orig > 0 ? Math.min(100, Math.round((paid / orig) * 100)) : 0;
                        const isDebtSettled = rem <= 0.001;
                        const isPartial = paid > 0 && rem > 0.001;

                        const originLabel = getOriginLabel(debt.reference_type);

                        return (
                          <div
                            key={debt.id}
                            onClick={() => setDrawerDebt(debt)}
                            className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer group"
                          >
                            {/* Left Meta */}
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[11px] text-slate-400">
                                  #{index + 1}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {originLabel}
                                </span>
                                {debt.created_at && (
                                  <span className="text-[11px] text-slate-400">
                                    {new Date(debt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                                {due && (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                                      due.isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                                    }`}
                                  >
                                    {due.isOverdue && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                                    <span>Due {due.label}</span>
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-md">
                                {debt.notes || 'Recorded obligation'}
                              </div>

                              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                <span>Orig: {orig.toLocaleString()}</span>
                                <span>·</span>
                                <span>Paid: {paid.toLocaleString()} ({pct}% settled)</span>
                              </div>
                            </div>

                            {/* Right Status & Actions */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <div className="text-left sm:text-right">
                                <div
                                  className={`font-mono font-bold text-sm tabular-nums ${
                                    isDebtSettled
                                      ? 'text-slate-400'
                                      : debtType === 'receivable'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {rem.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  <span className="text-[10px] font-sans font-normal text-slate-400 ml-1">ETB</span>
                                </div>
                                <span
                                  className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                                    isDebtSettled
                                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                      : isPartial
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                      : debtType === 'receivable'
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                                  }`}
                                >
                                  {isDebtSettled ? 'Complete' : isPartial ? 'Partial' : 'Open'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {!isDebtSettled ? (
                                  <button
                                    type="button"
                                    onClick={() => setDrawerDebt(debt)}
                                    className={`h-7 px-3 rounded-lg text-[11px] font-bold text-white transition-all shadow-2xs active:scale-95 cursor-pointer ${
                                      debtType === 'receivable'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-rose-600 hover:bg-rose-700'
                                    }`}
                                  >
                                    {debtType === 'receivable' ? 'Collect' : 'Pay'}
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-medium text-slate-400 px-2 py-1">
                                    Complete
                                  </span>
                                )}

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

                                {isManual && paid <= 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => confirmDelete(debt, e)}
                                    title="Delete record"
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pagination */}
        {partyGroups.length > pageSize && (
          <div className="pt-2">
            <Pagination
              currentPage={currentPage}
              totalItems={partyGroups.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
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

      {/* Party Waterfall Settlement Modal */}
      <PartySettleModal
        isOpen={settlingParty !== null}
        onClose={() => setSettlingParty(null)}
        party={
          settlingParty
            ? {
                id: settlingParty.contactId,
                name: settlingParty.name,
                phone: settlingParty.phone,
                totalRemaining: settlingParty.totalRemaining,
                debtCount: settlingParty.openCount,
              }
            : null
        }
        type={debtType}
        accounts={accounts}
        onSuccess={loadDebts}
      />

      {/* Edit Debt Modal */}
      {editingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setEditingDebt(null)} />
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Record — {editingDebt.contact?.name}
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
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
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
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10 resize-none"
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setDeletingDebt(null)} />
          <div className="relative w-full max-w-sm mx-4 bg-white dark:bg-[#0f1522] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-page-enter p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Record?</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {deletingDebt.contact?.name} — {Number(deletingDebt.original_amount).toLocaleString()} ETB
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This will permanently remove this record.
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
