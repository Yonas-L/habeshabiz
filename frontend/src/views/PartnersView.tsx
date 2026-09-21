import React, { useState, useEffect, useMemo } from 'react';
import type { Contact, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Handshake,
  Search,
  Plus,
  Phone,
  Building2,
  Pencil,
  Trash2,
  Copy,
  Check,
  Loader2,
  Package,
  ShoppingBag,
  ShieldAlert,
  LayoutGrid,
  List,
} from 'lucide-react';
import { PartnerFormModal } from '../components/partners/PartnerFormModal';

interface PartnersViewProps {
  user?: User | null;
  onNavigateTab?: (tab: any) => void;
  onRefreshContacts?: () => void;
}

type RoleFilter = 'all' | 'peer_vendor' | 'supplier' | 'partner' | 'customer';

export const PartnersView: React.FC<PartnersViewProps> = ({
  user: _user,
  onNavigateTab,
  onRefreshContacts,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [onlyActive, setOnlyActive] = useState(true);

  // Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formDefaultRole, setFormDefaultRole] = useState<'peer_vendor' | 'supplier' | 'partner' | 'customer'>('peer_vendor');

  // Safe Delete Modal State
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{ message: string; canDeactivate: boolean } | null>(null);

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
      setDeleteError(null);
      await api.deleteContact(deletingContact.id);
      toast.success(`Partner "${deletingContact.name}" removed`);
      setDeletingContact(null);
      loadContacts();
    } catch (err: any) {
      setDeleteError({
        message: err.message || 'Cannot delete partner',
        canDeactivate: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivateInstead = async () => {
    if (!deletingContact) return;
    try {
      setIsDeleting(true);
      await api.updateContact(deletingContact.id, { is_active: false });
      toast.success(`Partner "${deletingContact.name}" deactivated`);
      setDeletingContact(null);
      setDeleteError(null);
      loadContacts();
    } catch (err: any) {
      toast.error('Failed to deactivate partner', { description: err.message });
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
      // Role filter
      if (selectedRole !== 'all' && !c.roles.includes(selectedRole)) {
        return false;
      }
      // Active filter
      if (onlyActive && c.is_active === false) {
        return false;
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesAltPhone = c.alt_phone?.toLowerCase().includes(q);
        const matchesNotes = c.notes?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesAltPhone && !matchesNotes && !matchesEmail) {
          return false;
        }
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
        return {
          label: 'Sourcing Broker',
          classes: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60',
        };
      case 'supplier':
        return {
          label: 'Supplier / Importer',
          classes: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/80 dark:border-blue-800/60',
        };
      case 'partner':
        return {
          label: 'Strategic Partner',
          classes: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-800/60',
        };
      case 'customer':
        return {
          label: 'Customer',
          classes: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60',
        };
      default:
        return {
          label: role,
          classes: 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
        };
    }
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
        <span>Loading partners &amp; brokers network...</span>
      </div>
    );
  }

  return (
    <div className="animate-page-enter space-y-6">
      {/* ─── Header & Primary Action ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-sm">
            <Handshake className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
              Partners &amp; Brokers
            </h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
              Manage neighbour shop sourcing, wholesale importers &amp; peer network
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-800">
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

          {/* Add Partner Button */}
          <button
            type="button"
            onClick={() => handleOpenAddModal('peer_vendor')}
            className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-98"
          >
            <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Add Partner</span>
          </button>
        </div>
      </div>

      {/* ─── Vitals / Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Network */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Network
            </span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 tracking-tight">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Registered business contacts
          </div>
        </div>

        {/* Sourcing Brokers */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Sourcing Brokers
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-950/60 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2 tracking-tight">
            {stats.brokers}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Neighbour shops for POS sourcing
          </div>
        </div>

        {/* Wholesale Suppliers */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Wholesale Importers
            </span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2 tracking-tight">
            {stats.suppliers}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Bulk stock intake suppliers
          </div>
        </div>

        {/* Strategic Associates */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Business Partners
            </span>
            <Handshake className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2 tracking-tight">
            {stats.partners}
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Commercial trade associates
          </div>
        </div>
      </div>

      {/* ─── Search Bar & Role Filters ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        {/* Role Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All Network' },
            { id: 'peer_vendor', label: 'Sourcing Brokers' },
            { id: 'supplier', label: 'Suppliers' },
            { id: 'partner', label: 'Partners' },
            { id: 'customer', label: 'Customers' },
          ].map((tab) => {
            const isActive = selectedRole === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRole(tab.id as RoleFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Active Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner, phone, notes..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
            />
          </div>

          {/* Active only filter */}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="rounded text-slate-900 focus:ring-slate-900 dark:bg-slate-900 dark:border-slate-800"
            />
            <span>Active only</span>
          </label>
        </div>
      </div>

      {/* ─── Main Content Surface ─── */}
      {filteredContacts.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
          <Handshake className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No partners found</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            {search
              ? `No partner matched "${search}". Try clearing filters or searching with a different term.`
              : 'Add neighbouring shop merchants or wholesale suppliers to begin brokered sourcing.'}
          </p>
          <button
            type="button"
            onClick={() => handleOpenAddModal('peer_vendor')}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Partner</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ═══ GRID CARDS VIEW ═══ */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const isBrokered = contact.roles.includes('peer_vendor');
            const initials = contact.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={contact.id}
                className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] ${
                  contact.is_active === false
                    ? 'bg-slate-50/60 dark:bg-[#131926]/40 border-slate-200/50 dark:border-slate-800/50 opacity-70'
                    : 'bg-white dark:bg-[#131926] border-slate-200/80 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="p-5 space-y-3.5">
                  {/* Card Header: Avatar, Name, Status Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-xs shadow-xs shrink-0 ${
                          isBrokered
                            ? 'bg-gradient-to-tr from-amber-500 to-amber-600 text-white'
                            : 'bg-gradient-to-tr from-slate-800 to-slate-900 text-white dark:from-slate-700 dark:to-slate-800'
                        }`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">
                            {contact.name}
                          </h3>
                        </div>
                        {contact.is_active === false ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Partner
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Role Badges */}
                    <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                      {contact.roles.map((r) => {
                        const badge = getRoleBadge(r);
                        return (
                          <span
                            key={r}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${badge.classes}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Phone & Contact Links */}
                  <div className="space-y-1 text-xs">
                    {contact.phone ? (
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <a
                            href={`tel:${contact.phone}`}
                            className="hover:text-slate-900 dark:hover:text-white hover:underline"
                          >
                            {contact.phone}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(contact.phone!, contact.id)}
                          title="Copy phone"
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                          {copiedId === contact.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic">No phone registered</div>
                    )}

                    {contact.alt_phone && (
                      <div className="flex items-center gap-2 px-2.5 py-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>Alt: {contact.alt_phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes / Shop Location */}
                  {contact.notes && (
                    <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      <p className="line-clamp-2">{contact.notes}</p>
                    </div>
                  )}

                  {/* Activity Stats Chips */}
                  <div className="flex items-center gap-2 pt-1">
                    {(contact.brokered_items_count ?? 0) > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        {contact.brokered_items_count} Brokered Sales
                      </span>
                    )}
                    {(contact.supplied_units_count ?? 0) > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                        {contact.supplied_units_count} Supplied Units
                      </span>
                    )}
                    {(contact.debts_count ?? 0) > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                        {contact.debts_count} Receivables/Payables
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                  {/* Quick Shortcut to POS Brokered Sourcing */}
                  {isBrokered && onNavigateTab ? (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab('counter');
                        toast.info(`Switched to POS Counter to source from ${contact.name}`);
                      }}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Source in POS</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">Partner</span>
                  )}

                  <div className="flex items-center gap-1">
                    {/* Toggle Active button */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(contact)}
                      title={contact.is_active ? 'Deactivate' : 'Activate'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span
                        className={`block w-2 h-2 rounded-full ${
                          contact.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                      />
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(contact)}
                      title="Edit details"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingContact(contact);
                        setDeleteError(null);
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
      ) : (
        /* ═══ COMPACT TABLE VIEW ═══ */
        <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60 dark:bg-slate-900/40">
                  <th className="py-3 px-4">Partner / Merchant</th>
                  <th className="py-3 px-4">Roles</th>
                  <th className="py-3 px-4">Primary Phone</th>
                  <th className="py-3 px-4">Shop &amp; Notes</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredContacts.map((contact) => {
                  const isBrokered = contact.roles.includes('peer_vendor');
                  return (
                    <tr
                      key={contact.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {contact.name}
                        </div>
                        {contact.email && (
                          <div className="text-[10px] text-slate-400">{contact.email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {contact.roles.map((r) => {
                            const badge = getRoleBadge(r);
                            return (
                              <span
                                key={r}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.classes}`}
                              >
                                {badge.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {contact.phone ? (
                          <span className="flex items-center gap-1.5">
                            <a
                              href={`tel:${contact.phone}`}
                              className="hover:underline text-slate-700 dark:text-slate-300"
                            >
                              {contact.phone}
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(contact.phone!, contact.id)}
                              title="Copy"
                              className="text-slate-400 hover:text-slate-700"
                            >
                              {copiedId === contact.id ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">
                        {contact.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(contact)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            contact.is_active !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              contact.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {contact.is_active !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isBrokered && onNavigateTab && (
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateTab('counter');
                                toast.info(`Switched to POS for ${contact.name}`);
                              }}
                              title="Source in POS"
                              className="p-1 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(contact)}
                            title="Edit"
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingContact(contact);
                              setDeleteError(null);
                            }}
                            title="Remove"
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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

      {/* ─── Delete / Deactivate Confirmation Dialog ─── */}
      {deletingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => !isDeleting && setDeletingContact(null)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800/90 shadow-2xl p-6 overflow-hidden animate-modal-enter z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Remove Partner
                </h3>
                <p className="text-xs text-slate-400">
                  {deletingContact.name}
                </p>
              </div>
            </div>

            {deleteError ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-300 space-y-2 mb-5 leading-relaxed">
                <p>{deleteError.message}</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Tip: Deactivating will remove them from POS sourcing dropdowns without breaking transaction history.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
                Are you sure you want to remove <span className="font-bold text-slate-900 dark:text-white">"{deletingContact.name}"</span>?
                If they have associated brokered sales, debts, or inventory records, they can be deactivated instead.
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingContact(null)}
                disabled={isDeleting}
                className="h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              {deleteError ? (
                <button
                  type="button"
                  onClick={handleDeactivateInstead}
                  disabled={isDeleting}
                  className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Deactivate Partner Instead</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Confirm Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
