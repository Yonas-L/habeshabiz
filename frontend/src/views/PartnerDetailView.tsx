import React, { useState, useEffect } from 'react';
import type { Contact, PartnerStatementData, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Check,
  Printer,
  Share2,
  Phone,
  Pencil,
  Package,
  Wrench,
  ArrowRightLeft,
  Receipt,
  Search,
} from 'lucide-react';
import { LdrsSpinner } from '../components/loading/LdrsSpinner';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { VendorStatementPrintModal } from '../components/partners/VendorStatementPrintModal';
import { PartnerFormModal } from '../components/partners/PartnerFormModal';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { formatLocalDate } from '../utils/dateUtils';

interface PartnerDetailViewProps {
  contactId: string;
  user?: User | null;
  onBack: () => void;
  onEditContact?: (contact: Contact) => void;
}

type DateRangeFilter = 'all' | 'this_month' | 'last_month' | 'last_30_days' | 'custom';
type DashboardTab = 'statement' | 'inventory' | 'handovers' | 'repairs';

export const PartnerDetailView: React.FC<PartnerDetailViewProps> = ({
  contactId,
  user: _user,
  onBack,
  onEditContact,
}) => {
  const [statementData, setStatementData] = useState<PartnerStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('statement');

  // Edit Partner Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isFetchingContact, setIsFetchingContact] = useState(false);

  // Date filtering
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Search filter inside ledger
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Modals
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const loadStatement = async () => {
    try {
      setLoading(true);
      let startDate: string | undefined;
      let endDate: string | undefined;

      const now = new Date();
      if (dateFilter === 'this_month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = formatLocalDate(firstDay);
        endDate = formatLocalDate(now);
      } else if (dateFilter === 'last_month') {
        const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
        startDate = formatLocalDate(firstDayPrev);
        endDate = formatLocalDate(lastDayPrev);
      } else if (dateFilter === 'last_30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        startDate = formatLocalDate(thirtyDaysAgo);
        endDate = formatLocalDate(now);
      } else if (dateFilter === 'custom') {
        if (customStartDate) startDate = customStartDate;
        if (customEndDate) endDate = customEndDate;
      }

      const res = await api.getPartnerStatement(contactId, {
        start_date: startDate,
        end_date: endDate,
      });

      setStatementData(res);
    } catch (err: any) {
      toast.error('Failed to load partner statement', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatement();
  }, [contactId, dateFilter, customStartDate, customEndDate]);

  const handleCopyPublicLink = () => {
    if (!statementData?.contact.statement_token) return;
    const origin = window.location.origin;
    const params = new URLSearchParams();
    if (statementData.range.start_date) params.set('start_date', statementData.range.start_date);
    if (statementData.range.end_date) params.set('end_date', statementData.range.end_date);
    const qs = params.toString();
    const url = `${origin}/statement/${statementData.contact.statement_token}${qs ? `?${qs}` : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('Public statement link copied to clipboard', {
      description: 'Vendor will see this exact statement for the selected period.',
    });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success(`Copied ${phone}`);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleOpenEditModal = async () => {
    try {
      setIsFetchingContact(true);
      const fullContact = await api.getContact(contactId);
      setEditingContact(fullContact);
      setIsEditModalOpen(true);
    } catch {
      // Fallback to statement contact data
      if (statementData) {
        setEditingContact({
          id: statementData.contact.id,
          name: statementData.contact.name,
          phone: statementData.contact.phone,
          alt_phone: statementData.contact.alt_phone,
          email: statementData.contact.email,
          roles: statementData.contact.roles as any,
          is_active: true,
        });
        setIsEditModalOpen(true);
      }
    } finally {
      setIsFetchingContact(false);
    }
  };

  if (loading && !statementData) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  if (!statementData) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-slate-500 text-sm">Partner records could not be loaded.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
        >
          Return to Partners Network
        </button>
      </div>
    );
  }

  const { contact, range, kpis, ledger, supplied_units, handed_out_units, vendor_return_units } = statementData;
  const netBalance = kpis.range_closing_balance;
  const isReceivable = netBalance > 0;
  const isPayable = netBalance < 0;

  // Filter ledger rows by search
  const filteredLedger = ledger.filter((r) => {
    if (!ledgerSearch.trim()) return true;
    const term = ledgerSearch.toLowerCase();
    return (
      r.context.toLowerCase().includes(term) ||
      r.type_label.toLowerCase().includes(term) ||
      (r.reference_number && r.reference_number.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-5 animate-page-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to Network"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white flex items-center justify-center font-black text-sm shadow-xs">
              {contact.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {contact.name}
                </h1>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                {contact.phone && (
                  <button
                    onClick={() => handleCopyPhone(contact.phone!)}
                    className="inline-flex items-center gap-1 font-mono hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{contact.phone}</span>
                    {copiedPhone ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  </button>
                )}
                {contact.roles && contact.roles.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="capitalize">{contact.roles.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleOpenEditModal}
            disabled={isFetchingContact}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            title="Edit Partner Details"
          >
            {isFetchingContact ? (
              <LdrsSpinner size={14} color="#64748b" stroke={2.5} />
            ) : (
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPublicLink}
            className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Copy shareable public read-only link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedLink ? 'Link Copied!' : 'Share Public Statement'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span>Print Statement</span>
          </button>
        </div>
      </div>

      {/* ── Date Range Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 shadow-2xs">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'all'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setDateFilter('this_month')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'this_month'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateFilter('last_month')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'last_month'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Last Month
          </button>
          <button
            onClick={() => setDateFilter('last_30_days')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'last_30_days'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => setDateFilter('custom')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              dateFilter === 'custom'
                ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 border border-slate-800 shadow-xs font-bold ring-1 ring-emerald-500/20'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Custom Range
          </button>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* ── Financial Position: Clean, Focused Net Balance ── */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 shadow-xs transition-all ${
          isPayable
            ? 'bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 dark:from-rose-950/30 dark:via-[#131926] dark:to-[#131926] border-rose-200/90 dark:border-rose-900/60'
            : isReceivable
            ? 'bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-[#131926] dark:to-[#131926] border-emerald-200/90 dark:border-emerald-900/60'
            : 'bg-white dark:bg-[#131926] border-slate-200/80 dark:border-slate-800'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Left Column: Focused Net Balance */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Bilateral Net Balance
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  isPayable
                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                    : isReceivable
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isPayable
                      ? 'bg-rose-500'
                      : isReceivable
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                />
                {isPayable ? 'We Owe Vendor' : isReceivable ? 'Vendor Owes Us' : 'Settled In Full'}
              </span>
            </div>

            <div
              className={`text-3xl sm:text-4xl font-black font-mono tracking-tight tabular-nums flex items-baseline gap-1.5 ${
                isPayable
                  ? 'text-rose-600 dark:text-rose-400'
                  : isReceivable
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              <span>{isPayable ? '−' : isReceivable ? '+' : ''}</span>
              <AnimatedNumber value={Math.abs(netBalance)} />
              <span className="text-xs font-semibold font-sans text-slate-400 dark:text-slate-500">
                ETB
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>
                {isPayable
                  ? `Your shop owes this net balance to ${contact.name}.`
                  : isReceivable
                  ? `${contact.name} owes this net balance to your shop.`
                  : `All accounts with ${contact.name} are fully balanced.`}
              </span>
              <span>·</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {range.formatted_range}
              </span>
            </div>
          </div>

          {/* Right Column: Compact Operational Micro-Stats (Inventory & Activity Scope) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200/70 dark:border-slate-800/80 md:pl-5 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-center min-w-[95px] shadow-2xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                Stock On Shelf
              </span>
              <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {kpis.supplied_in_stock_count} <span className="text-[10px] font-sans font-normal text-slate-400">units</span>
              </span>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-center min-w-[95px] shadow-2xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                On Handover
              </span>
              <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {kpis.handed_out_count} <span className="text-[10px] font-sans font-normal text-slate-400">units</span>
              </span>
            </div>

            <div className="px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-center min-w-[95px] shadow-2xs">
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 block">
                Ledger Entries
              </span>
              <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {ledger.length} <span className="text-[10px] font-sans font-normal text-slate-400">records</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Tabs Navigation Strip ── */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('statement')}
          className={`pb-2.5 px-3.5 transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'statement'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Statement & Ledger</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'statement' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {ledger.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-2.5 px-3.5 transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Supplied Stock</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'inventory' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {supplied_units.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('handovers')}
          className={`pb-2.5 px-3.5 transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'handovers'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Handovers Out</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'handovers' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {handed_out_units.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('repairs')}
          className={`pb-2.5 px-3.5 transition-colors flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
            activeTab === 'repairs'
              ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Repairs & Returns</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'repairs' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            {vendor_return_units.length}
          </span>
        </button>
      </div>

      {/* ── Tab Content ── */}

      {/* TAB 1: STATEMENT & LEDGER BREAKDOWN */}
      {activeTab === 'statement' && (
        <div className="space-y-3">
          {/* Quick Search */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search transactions, reference..."
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <span className="text-[11px] text-slate-400 font-mono">
              Showing {filteredLedger.length} of {ledger.length} entries
            </span>
          </div>

          {/* Desktop Table View (≥ sm) */}
          <div className="hidden sm:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3.5 min-w-[220px]">Description</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Payable</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Receivable</th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans italic">
                        No transactions found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((row) => {
                      const isOpening = row.type === 'opening_balance';
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors ${
                            isOpening ? 'bg-slate-50/40 dark:bg-slate-900/20 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {row.formatted_date}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap font-sans">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.type === 'consignment_sale' || row.type === 'brokered_sourcing' || row.type === 'manual_payable'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                                  : row.type === 'device_offset' || row.type === 'bilateral_offset'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                                  : row.type === 'payment_sent'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50'
                                  : row.type === 'repair_offset'
                                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200/50'
                                  : row.type === 'repair_claim'
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50'
                                  : row.type === 'sales_credit' || row.type === 'handover_holding' || row.type === 'manual_receivable' || row.type === 'customer_purchase'
                                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50'
                                  : row.type === 'payout_advance'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50'
                                  : row.type === 'handover_return' || row.type === 'vendor_return' || row.type === 'vendor_return_refund'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                                  : row.type === 'payment_received'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {row.type_label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-sans text-xs font-semibold text-slate-900 dark:text-white">
                            <div>{row.context}</div>
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {row.payable !== 0 ? (
                              <span className={row.payable < 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>
                                {row.payable > 0
                                  ? row.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                  : `-${Math.abs(row.payable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {row.receivable !== 0 ? (
                              <span className={row.receivable < 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}>
                                {row.receivable > 0
                                  ? row.receivable.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                  : `-${Math.abs(row.receivable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-bold tabular-nums">
                            <span
                              className={
                                row.running_balance > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : row.running_balance < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500'
                              }
                            >
                              {row.running_balance > 0 ? '+' : ''}
                              {row.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Ledger List (< sm): Native cards without horizontal scrolling */}
          <div className="sm:hidden space-y-2.5">
            {filteredLedger.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-sans italic text-xs bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800">
                No transactions found matching your criteria.
              </div>
            ) : (
              filteredLedger.map((row) => (
                <div
                  key={row.id}
                  className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        row.type === 'consignment_sale' || row.type === 'brokered_sourcing' || row.type === 'manual_payable'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                          : row.type === 'device_offset' || row.type === 'bilateral_offset'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                          : row.type === 'payment_sent'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50'
                          : row.type === 'repair_offset'
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200/50'
                          : row.type === 'repair_claim'
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50'
                          : row.type === 'sales_credit' || row.type === 'handover_holding' || row.type === 'manual_receivable' || row.type === 'customer_purchase'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50'
                          : row.type === 'payout_advance'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50'
                          : row.type === 'handover_return' || row.type === 'vendor_return' || row.type === 'vendor_return_refund'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                          : row.type === 'payment_received'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {row.type_label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {row.formatted_date}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                    {row.context}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <div>
                      {row.payable !== 0 && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                          Payable: {row.payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      )}
                      {row.receivable !== 0 && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Receivable: +{row.receivable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block font-sans uppercase font-bold">Balance</span>
                      <span
                        className={`font-bold tabular-nums ${
                          row.running_balance > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : row.running_balance < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {row.running_balance > 0 ? '+' : ''}
                        {row.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIED INVENTORY UNITS */}
      {activeTab === 'inventory' && (
        <div>
          {/* Desktop Table View (≥ sm) */}
          <div className="hidden sm:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5">Device Model</th>
                    <th className="py-2.5 px-3.5">Serial Number</th>
                    <th className="py-2.5 px-3.5 text-right">Cost</th>
                    <th className="py-2.5 px-3.5 text-right">Selling Price</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Sold Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {supplied_units.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans italic">
                        No inventory units supplied by this partner.
                      </td>
                    </tr>
                  ) : (
                    supplied_units.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900 dark:text-white">
                          <div>{unit.model}</div>
                          {unit.specs.length > 0 && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              {unit.specs.join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300">
                          {unit.imei_or_serial || <span className="text-slate-400 italic font-sans">—</span>}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
                          {unit.cost_basis.toLocaleString()} ETB
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          {unit.selling_price > 0 ? `${unit.selling_price.toLocaleString()} ETB` : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              unit.status === 'in_stock'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : unit.status === 'sold'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                                : unit.status === 'returned_to_vendor'
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {unit.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500 font-sans text-[11px]">
                          {unit.order_number ? (
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              {unit.order_number}
                            </span>
                          ) : unit.sold_at ? (
                            new Date(unit.sold_at).toLocaleDateString()
                          ) : (
                            'Active in Shop'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Supplied Stock List (< sm) */}
          <div className="sm:hidden space-y-2.5">
            {supplied_units.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-sans italic text-xs bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800">
                No inventory units supplied by this partner.
              </div>
            ) : (
              supplied_units.map((unit) => (
                <div
                  key={unit.id}
                  className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {unit.model}
                      </h4>
                      {unit.specs.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {unit.specs.join(' · ')}
                        </p>
                      )}
                      {unit.imei_or_serial && (
                        <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                          SN: {unit.imei_or_serial}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        unit.status === 'in_stock'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : unit.status === 'sold'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                          : unit.status === 'returned_to_vendor'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {unit.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Cost</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {unit.cost_basis.toLocaleString()} ETB
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">
                        {unit.order_number ? 'Sold In' : unit.sold_at ? 'Sold' : 'Status'}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {unit.order_number || (unit.sold_at ? new Date(unit.sold_at).toLocaleDateString() : 'Active in Shop')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: HANDOVERS */}
      {activeTab === 'handovers' && (
        <div>
          {/* Desktop Table View (≥ sm) */}
          <div className="hidden sm:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5">Device Model</th>
                    <th className="py-2.5 px-3.5">Serial Number</th>
                    <th className="py-2.5 px-3.5 text-right">Holding Value</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Handed Out Date</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {handed_out_units.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-sans italic">
                        No devices currently out on handover with this partner.
                      </td>
                    </tr>
                  ) : (
                    handed_out_units.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900 dark:text-white">
                          {unit.model}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300">
                          {unit.imei_or_serial || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-800 dark:text-slate-200 font-bold">
                          {unit.handover_payout > 0 ? `${unit.handover_payout.toLocaleString()} ETB` : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 font-sans text-slate-500 text-[11px]">
                          <div>{unit.handed_out_at ? new Date(unit.handed_out_at).toLocaleDateString() : '—'}</div>
                          {unit.returned_at && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                              Ret: {new Date(unit.returned_at).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-sans">
                          {unit.status === 'returned' || unit.is_returned ? (
                            <span
                              className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700"
                              title={unit.return_reason || undefined}
                            >
                              Returned to Shop
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50">
                              Out with Partner
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Handovers List (< sm) */}
          <div className="sm:hidden space-y-2.5">
            {handed_out_units.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-sans italic text-xs bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800">
                No devices currently out on handover with this partner.
              </div>
            ) : (
              handed_out_units.map((unit) => (
                <div
                  key={unit.id}
                  className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {unit.model}
                      </h4>
                      {unit.imei_or_serial && (
                        <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                          SN: {unit.imei_or_serial}
                        </p>
                      )}
                    </div>
                    {unit.status === 'returned' || unit.is_returned ? (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 shrink-0">
                        Returned to Shop
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 shrink-0">
                        Out with Partner
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Holding Value</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {unit.handover_payout > 0 ? `${unit.handover_payout.toLocaleString()} ETB` : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Date</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {unit.handed_out_at ? new Date(unit.handed_out_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REPAIRS & DEFECT RETURNS */}
      {activeTab === 'repairs' && (
        <div>
          {/* Desktop Table View (≥ sm) */}
          <div className="hidden sm:block bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3.5">Device Model</th>
                    <th className="py-2.5 px-3.5">Serial Number</th>
                    <th className="py-2.5 px-3.5">Reason</th>
                    <th className="py-2.5 px-3.5 text-right">Maintenance Cost</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">Returned Date</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-xs">
                  {vendor_return_units.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans italic">
                        No warranty/defect units currently returned to this vendor.
                      </td>
                    </tr>
                  ) : (
                    vendor_return_units.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900 dark:text-white">
                          {unit.model}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300">
                          {unit.imei_or_serial || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 font-sans text-rose-600 dark:text-rose-400 font-medium">
                          {unit.return_reason || 'Defect repair'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-800 dark:text-slate-200 font-bold">
                          {unit.maintenance_cost > 0 ? `${unit.maintenance_cost.toLocaleString()} ETB` : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 font-sans text-slate-500 text-[11px]">
                          {unit.returned_at ? new Date(unit.returned_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              unit.status === 'fixed'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50'
                                : unit.status === 'returned' || unit.is_returned
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                            }`}
                          >
                            {unit.status === 'fixed'
                              ? 'Fixed'
                              : unit.status === 'returned' || unit.is_returned
                              ? 'Returned to Shop'
                              : 'With Vendor'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Repairs List (< sm) */}
          <div className="sm:hidden space-y-2.5">
            {vendor_return_units.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-sans italic text-xs bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800">
                No warranty/defect units currently returned to this vendor.
              </div>
            ) : (
              vendor_return_units.map((unit) => (
                <div
                  key={unit.id}
                  className="bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight">
                        {unit.model}
                      </h4>
                      {unit.imei_or_serial && (
                        <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                          SN: {unit.imei_or_serial}
                        </p>
                      )}
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
                        Reason: {unit.return_reason || 'Defect repair'}
                      </p>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        unit.status === 'fixed'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50'
                          : unit.status === 'returned' || unit.is_returned
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                      }`}
                    >
                      {unit.status === 'fixed'
                        ? 'Fixed'
                        : unit.status === 'returned' || unit.is_returned
                        ? 'Returned to Shop'
                        : 'With Vendor'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Maintenance Cost</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {unit.maintenance_cost > 0 ? `${unit.maintenance_cost.toLocaleString()} ETB` : '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Returned</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {unit.returned_at ? new Date(unit.returned_at).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Statement Printable PDF Modal ── */}
      <VendorStatementPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        data={statementData}
      />

      {/* ── Edit Partner Modal ── */}
      {isEditModalOpen && (
        <PartnerFormModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingContact(null);
          }}
          contactToEdit={editingContact}
          onSuccess={async (savedContact) => {
            setIsEditModalOpen(false);
            setEditingContact(null);
            toast.success(`Partner "${savedContact.name}" updated successfully`);
            await loadStatement();
            if (onEditContact) {
              onEditContact(savedContact);
            }
          }}
        />
      )}
    </div>
  );
};
