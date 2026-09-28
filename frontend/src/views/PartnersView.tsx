import React, { useState, useEffect, useMemo } from 'react';
import type { Contact, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Handshake,
  Search,
  Plus,
  Phone,
  Pencil,
  Trash2,
  Copy,
  Check,
  Loader2,
  ShoppingBag,
  ShieldAlert,
  LayoutGrid,
  List,
  X,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { PartnerFormModal } from '../components/partners/PartnerFormModal';
import { PartnerDetailView } from './PartnerDetailView';
import { Pagination } from '../components/Pagination';

interface PartnersViewProps {
  user?: User | null;
  onNavigateTab?: (tab: any) => void;
  onRefreshContacts?: () => void;
  initialSelectedPartnerId?: string | null;
  onClearInitialContext?: () => void;
}

type RoleFilter = 'all' | 'peer_vendor' | 'supplier' | 'partner' | 'customer';

export const PartnersView: React.FC<PartnersViewProps> = ({
  user: _user,
  onNavigateTab,
  onRefreshContacts,
  initialSelectedPartnerId,
  onClearInitialContext,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
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
      if (onRefreshContacts) {
        onRefreshContacts();
      }
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
      loadContacts();
    } catch (err: any) {
      toast.error('Failed to remove partner', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (contact: Contact) => {
    try {
      const updated = await api.updateContact(contact.id, { is_active: !contact.is_active });
      toast.success(`"${contact.name}" marked as ${updated.is_active ? 'active' : 'inactive'}`);
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, is_active: updated.is_active } : c)));
    } catch (err: any) {
      toast.error('Failed to update status', { description: err.message });
    }
  };

  // Filter and search
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (selectedRole !== 'all' && !c.roles.includes(selectedRole)) return false;
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
  }, [contacts, selectedRole, onlyActive, search]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = contacts.length;
    const brokers = contacts.filter((c) => c.roles.includes('peer_vendor')).length;
    const suppliers = contacts.filter((c) => c.roles.includes('supplier')).length;
    const partners = contacts.filter((c) => c.roles.includes('partner')).length;
    return { total, brokers, suppliers, partners };
  }, [contacts]);

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
    return (
      <div className="py-24 text-center text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-slate-700 dark:text-slate-300" />
        <span className="font-medium">Loading partners &amp; brokers network...</span>
      </div>
    );
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
    <div className="animate-page-enter space-y-4">

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
          {/* View toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenAddModal('peer_vendor')}
            className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
            Add Partner
          </button>
        </div>
      </div>

      {/* ─── Filter Row ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Role tabs */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold overflow-x-auto shrink-0">
          {[
            { id: 'all', label: `All`, count: stats.total },
            { id: 'peer_vendor', label: 'Brokers', count: stats.brokers },
            { id: 'supplier', label: 'Suppliers', count: stats.suppliers },
            { id: 'partner', label: 'Partners', count: stats.partners },
            { id: 'customer', label: 'Customers', count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedRole(tab.id as RoleFilter);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                selectedRole === tab.id
                  ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-[10px] font-mono leading-none px-1.5 py-0.5 rounded-md ${
                  selectedRole === tab.id
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    : 'text-slate-400 dark:text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search + Active toggle */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search name, phone…"
              className="h-9 w-52 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => {
                setOnlyActive(e.target.checked);
                setCurrentPage(1);
              }}
              className="rounded text-slate-900 focus:ring-slate-900 dark:bg-slate-900 dark:border-slate-800"
            />
            Active only
          </label>

          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0 tabular-nums">
            {filteredContacts.length} shown
          </span>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      {filteredContacts.length === 0 ? (
        /* ═══ EMPTY STATE ═══ */
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Handshake className="w-7 h-7 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {search ? 'No partners matched' : 'No partners yet'}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
            {search
              ? `No match for "${search}". Try clearing the search or adjusting filters.`
              : 'Add neighbouring shop merchants or wholesale suppliers to begin brokered sourcing.'}
          </p>
          {!search && (
            <button
              type="button"
              onClick={() => handleOpenAddModal('peer_vendor')}
              className="mt-5 h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Partner
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* ═══ GRID CARDS VIEW ═══ */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredContacts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((contact) => {
            const isBrokered = contact.roles.includes('peer_vendor');
            const initials = contact.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const isInactive = contact.is_active === false;

            return (
              <div
                key={contact.id}
                onClick={() => setSelectedPartnerId(contact.id)}
                className={`group rounded-2xl border flex flex-col overflow-hidden transition-all duration-150 cursor-pointer ${
                  isInactive
                    ? 'bg-slate-50/80 dark:bg-[#131926]/60 border-slate-200/50 dark:border-slate-800/40 opacity-60'
                    : 'bg-white dark:bg-[#131926] border-slate-200/80 dark:border-slate-800/80 hover:border-slate-400/80 dark:hover:border-slate-600 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)]'
                }`}
              >
                {/* ── Card Body ── */}
                <div className="p-5 flex-1 space-y-3.5">
                  {/* Header: Avatar + Name + Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        isBrokered
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60'
                      }`}>
                        {initials}
                      </div>

                      {/* Name + Inactive Flag */}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {contact.name}
                        </h3>
                        {isInactive && (
                          <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Role Badges */}
                    <div className="flex flex-wrap items-start justify-end gap-1 shrink-0 pt-0.5">
                      {contact.roles.map((r) => {
                        const badge = getRoleBadge(r);
                        return (
                          <span key={r} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${badge.classes}`}>
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center justify-between">
                    {contact.phone ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${contact.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] font-mono text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate"
                        >
                          {contact.phone}
                        </a>
                        {contact.alt_phone && (
                          <span className="text-[11px] font-mono text-slate-400 truncate">· {contact.alt_phone}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No phone on file</span>
                    )}

                    {contact.phone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyPhone(contact.phone!, contact.id);
                        }}
                        title="Copy phone number"
                        className="ml-2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                      >
                        {copiedId === contact.id
                          ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  {contact.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed">
                      {contact.notes}
                    </p>
                  )}

                  {/* Clean Financial Balance Row */}
                  {typeof contact.net_balance === 'number' && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-baseline justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        {contact.net_balance > 0 ? 'Receivable' : contact.net_balance < 0 ? 'Payable' : 'Balance'}
                      </span>
                      <span className={`font-mono font-bold text-xs ${
                        contact.net_balance > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : contact.net_balance < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-400'
                      }`}>
                        {contact.net_balance > 0
                          ? `+${contact.net_balance.toLocaleString()} ETB`
                          : contact.net_balance < 0
                          ? `−${Math.abs(contact.net_balance).toLocaleString()} ETB`
                          : '0.00 ETB'}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Card Footer ── */}
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/20 flex items-center justify-between">
                  {/* Left: Statement & Ledger indicator */}
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Statement and Ledger
                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {isBrokered && onNavigateTab && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateTab('counter');
                          toast.info(`Source from ${contact.name} in Sales`);
                        }}
                        title="Source in Sales"
                        className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/50 transition-colors"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(contact);
                      }}
                      title="Edit details"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingContact(contact);
                      }}
                      title="Remove partner"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredContacts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        /* ═══ TABLE VIEW ═══ */
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80">
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-900/40 whitespace-nowrap">
                    Partner
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-900/40 whitespace-nowrap">
                    Roles
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-900/40 whitespace-nowrap">
                    Phone
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-900/40 whitespace-nowrap hidden lg:table-cell">
                    Notes
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-900/40 text-center whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/70 dark:bg-slate-900/40 text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {filteredContacts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((contact) => {
                  const isBrokered = contact.roles.includes('peer_vendor');
                  const isInactive = contact.is_active === false;
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedPartnerId(contact.id)}
                      className={`group transition-colors cursor-pointer ${isInactive ? 'opacity-60' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'}`}
                    >
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white block leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            {contact.name}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-emerald-500 transition-all" />
                        </div>
                        {contact.email && (
                          <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">{contact.email}</span>
                        )}
                      </td>

                      {/* Roles */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {contact.roles.map((r) => {
                            const badge = getRoleBadge(r);
                            return (
                              <span key={r} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${badge.classes}`}>
                                {badge.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        {contact.phone ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${contact.phone}`}
                              className="text-[11px] font-mono text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                              {contact.phone}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(contact.phone!, contact.id)}
                              title="Copy phone"
                              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              {copiedId === contact.id
                                ? <Check className="w-3 h-3 text-emerald-500" />
                                : <Copy className="w-3 h-3" />
                              }
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      {/* Notes (hidden on smaller screens) */}
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate block">
                          {contact.notes || <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(contact)}
                          title={isInactive ? 'Mark active' : 'Mark inactive'}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                            !isInactive
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${!isInactive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {!isInactive ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedPartnerId(contact.id)}
                            title="Open Statement and Ledger"
                            className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                          >
                            Statement
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          {isBrokered && onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => { onNavigateTab('counter'); toast.info(`Switched to Sales for ${contact.name}`); }}
                              title="Source in Sales"
                              className="p-1.5 rounded-lg text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(contact)}
                            title="Edit"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingContact(contact)}
                            title="Remove"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination
              currentPage={currentPage}
              totalItems={filteredContacts.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* ─── Add / Edit Modal ─── */}
      <PartnerFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingContact(null);
        }}
        contactToEdit={editingContact}
        defaultRole={formDefaultRole}
        onSuccess={() => loadContacts()}
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
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98]"
              >
                {isDeleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
