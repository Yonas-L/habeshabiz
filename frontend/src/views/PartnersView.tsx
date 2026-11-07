import React, { useState, useEffect, useMemo } from 'react';
import type { Contact, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Handshake,
  Search,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  X,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { LdrsSpinner } from '../components/loading/LdrsSpinner';
import { PartnerFormModal } from '../components/partners/PartnerFormModal';
import { PartnerDetailView } from './PartnerDetailView';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

interface PartnersViewProps {
  user?: User | null;
  onNavigateTab?: (tab: any) => void;
  onRefreshContacts?: () => void;
  initialSelectedPartnerId?: string | null;
  onClearInitialContext?: () => void;
}

type BalanceFilter = 'all' | 'payable' | 'receivable';

export const PartnersView: React.FC<PartnersViewProps> = ({
  user: _user,
  onNavigateTab: _onNavigateTab,
  onRefreshContacts,
  initialSelectedPartnerId,
  onClearInitialContext,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<BalanceFilter>('all');
  const [onlyActive, setOnlyActive] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelectedPartnerId) {
      setSelectedPartnerId(initialSelectedPartnerId);
      onClearInitialContext?.();
    }
  }, [initialSelectedPartnerId, onClearInitialContext]);

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formDefaultRole, setFormDefaultRole] = useState<'peer_vendor' | 'supplier' | 'partner' | 'customer'>('peer_vendor');

  // Safe Delete Modal State
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copied state indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const res = await api.getContacts();
      setContacts(res);
    } catch (err: any) {
      toast.error('Failed to load partners network', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCopyPhone = (phone: string, id: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    toast.success(`Copied ${phone} to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenAddModal = (defaultRole: 'peer_vendor' | 'supplier' | 'partner' | 'customer' = 'peer_vendor') => {
    setEditingContact(null);
    setFormDefaultRole(defaultRole);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setIsFormModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingContact) return;
    try {
      setIsDeleting(true);
      await api.deleteContact(deletingContact.id);
      toast.success(`Partner "${deletingContact.name}" removed`, {
        description: 'All historical transactions, debts, and inventory records are preserved.',
      });
      setDeletingContact(null);
      await loadContacts();
      onRefreshContacts?.();
    } catch (err: any) {
      toast.error('Failed to remove partner', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter and search
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Exclude purely internal staff contacts from the external vendor/partner directory
      const isPureStaff = Array.isArray(c.roles) && c.roles.length > 0 && c.roles.every((r) => r === 'staff' || r === 'salesperson');
      if (isPureStaff) return false;

      const bal = c.net_balance ?? 0;
      if (selectedFilter === 'payable' && bal >= 0) return false;
      if (selectedFilter === 'receivable' && bal <= 0) return false;

      if (onlyActive && c.is_active === false) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesAltPhone = c.alt_phone?.toLowerCase().includes(q);
        const matchesNotes = c.notes?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesAltPhone && !matchesNotes && !matchesEmail) return false;
      }
      return true;
    });
  }, [contacts, selectedFilter, onlyActive, search]);

  // Statistics calculation for All, Payable, Receivable
  const stats = useMemo(() => {
    const tradeContacts = contacts.filter((c) => !(Array.isArray(c.roles) && c.roles.length > 0 && c.roles.every((r) => r === 'staff' || r === 'salesperson')));
    const total = tradeContacts.length;
    const payable = tradeContacts.filter((c) => (c.net_balance ?? 0) < 0).length;
    const receivable = tradeContacts.filter((c) => (c.net_balance ?? 0) > 0).length;
    return { total, payable, receivable };
  }, [contacts]);

  // Sorting: "all filters must show the highest ammount to lowest decending"
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      const balA = a.net_balance ?? 0;
      const balB = b.net_balance ?? 0;
      if (selectedFilter === 'receivable') {
        return balB - balA;
      }
      if (selectedFilter === 'payable') {
        return Math.abs(balB) - Math.abs(balA);
      }
      // 'all': highest magnitude balance first down to 0
      const magDiff = Math.abs(balB) - Math.abs(balA);
      if (magDiff !== 0) return magDiff;
      return a.name.localeCompare(b.name);
    });
  }, [filteredContacts, selectedFilter]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'peer_vendor':
        return { label: 'Broker', classes: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50' };
      case 'supplier':
        return { label: 'Supplier', classes: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50' };
      case 'partner':
        return { label: 'Partner', classes: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/50' };
      case 'customer':
        return { label: 'Customer', classes: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50' };
      default:
        return { label: role, classes: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent' };
    }
  };

  if (loading && contacts.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  if (selectedPartnerId) {
    return (
      <PartnerDetailView
        contactId={selectedPartnerId}
        user={_user}
        onBack={() => {
          setSelectedPartnerId(null);
          loadContacts();
        }}
        onEditContact={handleOpenEditModal}
      />
    );
  }

  return (
    <div className="space-y-3 animate-page-enter flex-1 flex flex-col min-h-0">

      {/* ─── Page Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
            Vendor Network
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
            Brokers, suppliers, strategic partners &amp; wholesale customers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenAddModal('peer_vendor')}
            className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-2 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            Add Partner
          </button>
        </div>
      </div>

      {/* ─── Filter Row (All, Payable, Receivable) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter tabs: All, Payable, Receivable */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold shadow-2xs overflow-x-auto max-w-full no-scrollbar shrink-0">
          {[
            { id: 'all', label: `All`, count: stats.total },
            { id: 'payable', label: 'Payable', count: stats.payable },
            { id: 'receivable', label: 'Receivable', count: stats.receivable },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFilter(tab.id as BalanceFilter)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                selectedFilter === tab.id
                  ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-[10px] font-mono leading-none px-1.5 py-0.5 rounded-md ${
                  selectedFilter === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + Active toggle */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone…"
              className="h-9 w-full pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 shadow-2xs transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="rounded text-slate-900 focus:ring-slate-900 dark:bg-slate-900 dark:border-slate-800"
            />
            Active only
          </label>

          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0 tabular-nums">
            {sortedContacts.length} shown
          </span>
        </div>
      </div>

      {/* ─── MOBILE VIEW (< sm) — Cardless, Edge-to-Edge Matching Mobile Overview ─── */}
      <div className="sm:hidden flex-1 overflow-y-auto h-[calc(100vh-235px)] min-h-[380px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 px-0.5">
        {sortedContacts.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Handshake className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-400 text-xs">
              {search ? 'No partners matched' : 'No partners yet'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {search ? `No match for "${search}".` : 'Add neighbouring shop merchants or wholesale suppliers.'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={() => handleOpenAddModal('peer_vendor')}
                className="mt-4 h-8 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Partner
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y-0 pb-12">
            {sortedContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => setSelectedPartnerId(contact.id)}
                className="w-full flex items-center justify-between py-2.5 border-b border-slate-200/50 dark:border-slate-800/50 text-left active:opacity-60 transition-opacity cursor-pointer min-w-0 group"
                title={`${contact.name}: ${contact.net_balance ? `${contact.net_balance.toLocaleString()} ETB` : '0 ETB'}`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[13px] min-[390px]:text-sm font-bold text-slate-900 dark:text-white truncate leading-snug">
                      {contact.name}
                    </span>
                    {contact.roles.map((r) => {
                      const badge = getRoleBadge(r);
                      return (
                        <span
                          key={r}
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded leading-none shrink-0 ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })}
                  </div>
                  {contact.phone && (
                    <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                      {contact.phone}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[13px] min-[390px]:text-sm font-black font-mono tracking-tight text-right leading-snug ${
                      (contact.net_balance || 0) > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : (contact.net_balance || 0) < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {typeof contact.net_balance === 'number' && contact.net_balance !== 0 ? (
                      contact.net_balance > 0
                        ? `+${contact.net_balance.toLocaleString()} ETB`
                        : `−${Math.abs(contact.net_balance).toLocaleString()} ETB`
                    ) : (
                      '0.00 ETB'
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
                </div>
              </button>
            ))}

            {/* Footer count indicator */}
            <div className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>All {sortedContacts.length} partners loaded</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── DESKTOP VIEW (≥ sm) — Fixed-height Inside Scroll Ledger Matching Sales ─── */}
      <div className="hidden sm:flex bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-2xs flex-1 flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto h-[calc(100vh-235px)] sm:h-[calc(100vh-190px)] min-h-[440px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#131926]/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] shadow-2xs">
              <tr>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Partner / Vendor</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Roles</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Balance</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Actions</th>
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {sortedContacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400">
                    <Handshake className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">
                      {search ? 'No partners matched' : 'No partners yet'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {search
                        ? `No match for "${search}". Try clearing search or filters.`
                        : 'Add neighbouring shop merchants or wholesale suppliers.'}
                    </p>
                    {!search && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal('peer_vendor')}
                        className="mt-4 h-8 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add First Partner
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {sortedContacts.map((contact) => {
                    const isBrokered = contact.roles.includes('peer_vendor');
                    const initials = contact.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const isInactive = contact.is_active === false;

                    return (
                      <tr
                        key={contact.id}
                        onClick={() => setSelectedPartnerId(contact.id)}
                        className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group select-none ${
                          isInactive ? 'opacity-60' : ''
                        }`}
                      >
                        {/* Col 1: Partner / Vendor (Avatar + Name + Phone) */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-[11px] shrink-0 ${
                                isBrokered
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
                              }`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[180px] sm:max-w-[240px] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {contact.name}
                              </div>
                              {contact.phone ? (
                                <div className="flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <a
                                    href={`tel:${contact.phone}`}
                                    className="text-[10px] font-mono text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                  >
                                    {contact.phone}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPhone(contact.phone!, contact.id)}
                                    title="Copy phone"
                                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                  >
                                    {copiedId === contact.id ? (
                                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No phone</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Col 2: Roles */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {contact.roles.map((r) => {
                              const badge = getRoleBadge(r);
                              return (
                                <span
                                  key={r}
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${badge.classes}`}
                                >
                                  {badge.label}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* Col 3: Balance */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {typeof contact.net_balance === 'number' && contact.net_balance !== 0 ? (
                            <span
                              className={`font-mono font-bold text-xs ${
                                contact.net_balance > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {contact.net_balance > 0
                                ? `+${contact.net_balance.toLocaleString()} ETB`
                                : `−${Math.abs(contact.net_balance).toLocaleString()} ETB`}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400 text-xs">0.00 ETB</span>
                          )}
                        </td>

                        {/* Col 4: Actions (Edit, Delete) */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(contact)}
                              title="Edit"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingContact(contact)}
                              title="Remove"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Col 5: Chevron */}
                        <td className="py-2.5 px-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                        </td>
                      </tr>
                    );
                  })}

                  {/* All caught up footer banner */}
                  {sortedContacts.length > 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {sortedContacts.length} partners loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add / Edit Modal ─── */}
      <PartnerFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingContact(null);
        }}
        contactToEdit={editingContact}
        defaultRole={formDefaultRole}
        onSuccess={() => {
          loadContacts();
          onRefreshContacts?.();
        }}
      />

      {/* ─── Delete Confirmation Dialog ─── */}
      {deletingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => !isDeleting && setDeletingContact(null)}
          />

          <div className="relative w-full max-w-sm bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xl overflow-hidden animate-modal-enter z-10">
            {/* Dialog Header */}
            <div className="px-6 pt-6 pb-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Remove Partner
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                  {deletingContact.name}
                </p>
              </div>
            </div>

            {/* Dialog Body */}
            <div className="px-6 pb-5">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                This will remove{' '}
                <span className="font-bold text-slate-900 dark:text-white">"{deletingContact.name}"</span>{' '}
                from your active partners list. All historical transactions, brokered sales, debts, and inventory records are preserved in your audit trail.
              </p>
            </div>

            {/* Dialog Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingContact(null)}
                disabled={isDeleting}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
              >
                {isDeleting
                  ? <LdrsSpinner size={14} color="#ffffff" stroke={2.5} />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
                <span>{isDeleting ? 'Removing…' : 'Remove Partner'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
