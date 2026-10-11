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
  Users,
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

export const DebtsView: React.FC<DebtsViewProps> = ({ accounts }) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>('receivable');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'settled'>('active');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Expanded party rows state
  const [expandedPartyIds, setExpandedPartyIds] = useState<Set<string>>(new Set());

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

  const toggleExpand = (partyId: string) => {
    setExpandedPartyIds((prev) => {
      const next = new Set(prev);
      if (next.has(partyId)) {
        next.delete(partyId);
      } else {
        next.add(partyId);
      }
      return next;
    });
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

  // Group debts by contact (party)
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

    // Sort debts inside each party by created_at ASC (chronological FIFO)
    map.forEach((g) => {
      g.debts.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      g.percentSettled = g.totalOriginal > 0 ? Math.min(100, Math.round((g.totalPaid / g.totalOriginal) * 100)) : 0;
    });

    let list = Array.from(map.values());

    if (statusFilter === 'active') {
      list = list.filter((g) => g.totalRemaining > 0.001);
    } else if (statusFilter === 'settled') {
      list = list.filter((g) => g.totalRemaining <= 0.001);
    }

    // Sort: parties with open balance first (highest balance descending), then settled
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

        {/* Filter Pills, Search & Record */}
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
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
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
          <div className="text-[11px] text-slate-400 mt-0.5">Click any row to view individual obligations</div>
        </div>
      </div>

      {/* Main Single Card Container (Matching Inventory View design - NO nested border on border) */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-2xs">
        {/* Desktop Table (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Contact</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap font-mono">Obligations</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono">Original ETB</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono">Paid ETB</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono">Remaining ETB</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Action</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center">
                    <CustomPageLoader mode="app" fullScreen={false} />
                  </td>
                </tr>
              ) : paginatedParties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No {debtType} records found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Use "Record Entry" to record a new receivable or payable obligation.</p>
                  </td>
                </tr>
              ) : (
                paginatedParties.map((group) => {
                  const isExpanded = expandedPartyIds.has(group.contactId);
                  const isSettled = group.totalRemaining <= 0.001;

                  return (
                    <React.Fragment key={group.contactId}>
                      {/* Parent Contact Row (Collapsible) */}
                      <tr
                        onClick={() => toggleExpand(group.contactId)}
                        className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group select-none ${
                          isExpanded ? 'bg-slate-50/60 dark:bg-slate-900/40' : ''
                        }`}
                      >
                        {/* Col 1: Chevron + Initials Icon + Name & Phone */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex items-center justify-center text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors shrink-0">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                            <div
                              className={`w-7 h-7 rounded-lg border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 font-bold text-[10px] ${
                                debtType === 'receivable'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {group.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{group.name}</span>
                                {isSettled ? (
                                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                    Complete
                                  </span>
                                ) : group.percentSettled > 0 ? (
                                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                                    {group.percentSettled}% settled
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {group.phone || 'No phone'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Col 2: Obligations Count */}
                        <td className="py-2.5 px-3.5 font-mono font-bold text-xs whitespace-nowrap">
                          <span className={isSettled ? 'text-slate-400' : debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {group.openCount}
                          </span>
                          <span className="text-slate-400 font-normal ml-1">of {group.debts.length}</span>
                        </td>

                        {/* Col 3: Original Amount */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {Number(group.totalOriginal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Col 4: Paid Amount */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-400 dark:text-slate-500">
                          {Number(group.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Col 5: Remaining Balance */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-xs">
                          <span className={isSettled ? 'text-slate-400' : debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {Number(group.totalRemaining).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Col 6: Action */}
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="inline-flex items-center justify-end min-h-[28px]" onClick={(e) => e.stopPropagation()}>
                            {!isSettled ? (
                              <div
                                className={`transition-all duration-300 ease-in-out transform ${
                                  isExpanded
                                    ? 'opacity-0 scale-90 pointer-events-none invisible w-0 overflow-hidden'
                                    : 'opacity-100 scale-100 pointer-events-auto visible w-auto'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSettlingParty(group)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white transition-all shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap ${
                                    debtType === 'receivable'
                                      ? 'bg-emerald-600 hover:bg-emerald-700'
                                      : 'bg-rose-600 hover:bg-rose-700'
                                  }`}
                                >
                                  {debtType === 'receivable' ? 'Collect' : 'Pay'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 px-2.5 py-1">
                                Complete
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Col 7: Chevron */}
                        <td className="py-2.5 px-2 text-right">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                          )}
                        </td>
                      </tr>

                      {/* Child Obligation Rows (When expanded) */}
                      {isExpanded && group.debts.map((debt) => {
                        const orig = parseFloat(String(debt.original_amount)) || 0;
                        const paid = parseFloat(String(debt.paid_amount)) || 0;
                        const rem = parseFloat(String(debt.remaining_amount)) || 0;
                        const isDebtSettled = rem <= 0.001;
                        const isPartial = paid > 0 && !isDebtSettled;
                        const isManual = debt.reference_type === 'direct_credit';
                        const originLabel = getOriginLabel(debt.reference_type);
                        const dateFormatted = debt.created_at
                          ? new Date(debt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—';

                        return (
                          <tr
                            key={debt.id}
                            onClick={() => setDrawerDebt(debt)}
                            className="bg-slate-50/40 dark:bg-slate-900/25 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                          >
                            {/* Col 1: Indented tree symbol + Origin Tag + Date */}
                            <td className="py-2.5 px-3.5 pl-8">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-slate-400 dark:text-slate-600 font-mono text-xs select-none">↳</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs shrink-0">
                                  {originLabel}
                                </span>
                                <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
                                <span className="font-mono text-slate-400 text-[11px] shrink-0">
                                  {dateFormatted}
                                </span>
                                {isPartial && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0">
                                    Partial
                                  </span>
                                )}
                                {isDebtSettled && (
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                                    Complete
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Col 2: Obligation Unit Indicator */}
                            <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-xs text-slate-400 font-bold">
                              1
                            </td>

                            {/* Col 3: Original Amount */}
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-400 dark:text-slate-500">
                              {orig.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>

                            {/* Col 4: Paid Amount */}
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono text-xs text-slate-400 dark:text-slate-500">
                              {paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>

                            {/* Col 5: Remaining Amount */}
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-xs">
                              <span className={isDebtSettled ? 'text-slate-400' : debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {rem.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </td>

                            {/* Col 6: Action */}
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {!isDebtSettled ? (
                                  <button
                                    type="button"
                                    onClick={() => setDrawerDebt(debt)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white transition-colors shadow-2xs active:scale-95 cursor-pointer ${
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
                            </td>

                            {/* Col 7: Chevron */}
                            <td className="py-2.5 px-2 text-right">
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
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
          ) : paginatedParties.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">No {debtType} records found</p>
            </div>
          ) : (
            paginatedParties.map((group) => {
              const isExpanded = expandedPartyIds.has(group.contactId);
              const isSettled = group.totalRemaining <= 0.001;

              return (
                <div key={group.contactId} className="p-4 space-y-3">
                  {/* Top Row: Click to toggle expand */}
                  <div
                    onClick={() => toggleExpand(group.contactId)}
                    className="flex items-start justify-between gap-3 cursor-pointer active:opacity-70 select-none"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs ${
                          debtType === 'receivable'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {group.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          <span className={isSettled ? 'text-slate-400' : debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                            {group.openCount} open
                          </span>
                          <span className="text-slate-400 ml-1">of {group.debts.length} records</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono font-bold text-sm ${
                          isSettled ? 'text-slate-400' : debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {Number(group.totalRemaining).toLocaleString()} ETB
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 mt-1">
                        <span>{isExpanded ? 'Hide' : 'Records'}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Header (smoothly hidden when expanded) */}
                  {!isSettled && (
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out transform ${
                        isExpanded
                          ? 'max-h-0 opacity-0 pointer-events-none -translate-y-1'
                          : 'max-h-16 opacity-100 pointer-events-auto translate-y-0 pt-1 border-t border-slate-100/80 dark:border-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-mono">
                          Paid: {Number(group.totalPaid).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSettlingParty(group)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white shadow-2xs active:scale-95 cursor-pointer ${
                            debtType === 'receivable'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                        >
                          {debtType === 'receivable' ? 'Collect' : 'Pay'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Obligations Sub-List */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 animate-in fade-in duration-200">
                      {group.debts.map((debt) => {
                        const rem = parseFloat(String(debt.remaining_amount)) || 0;
                        const isDebtSettled = rem <= 0.001;
                        const isPartial = parseFloat(String(debt.paid_amount)) > 0 && !isDebtSettled;
                        const originLabel = getOriginLabel(debt.reference_type);
                        const dateFormatted = debt.created_at
                          ? new Date(debt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                          : '—';

                        return (
                          <div
                            key={debt.id}
                            onClick={() => setDrawerDebt(debt)}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                  {originLabel}
                                </span>
                                <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
                                <span className="font-mono text-slate-400 text-[11px]">
                                  {dateFormatted}
                                </span>
                                {isPartial && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                    Partial
                                  </span>
                                )}
                                {isDebtSettled && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                                    Complete
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <div
                                className={`font-mono font-bold text-xs ${
                                  isDebtSettled ? 'text-slate-400' : debtType === 'receivable' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {rem.toLocaleString()} ETB
                              </div>
                              {!isDebtSettled ? (
                                <button
                                  type="button"
                                  onClick={() => setDrawerDebt(debt)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold text-white shadow-2xs active:scale-95 cursor-pointer ${
                                    debtType === 'receivable'
                                      ? 'bg-emerald-600 hover:bg-emerald-700'
                                      : 'bg-rose-600 hover:bg-rose-700'
                                  }`}
                                >
                                  {debtType === 'receivable' ? 'Collect' : 'Pay'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">Complete</span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {partyGroups.length > pageSize && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/80">
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
