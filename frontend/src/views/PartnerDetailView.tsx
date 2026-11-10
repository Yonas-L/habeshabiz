import React, { useState, useEffect } from 'react';
import type { Contact, PartnerStatementData, User, InventoryUnit } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { InlineEditablePrice } from '../components/common/InlineEditablePrice';
import { InventoryUnitDrawer } from '../components/drawers/InventoryUnitDrawer';
import {
  ArrowLeft,
  Copy,
  Check,
  ArrowDownToLine,
  Share2,
  Phone,
  Pencil,
  Package,
  Wrench,
  ArrowRightLeft,
  Receipt,
  X,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { LdrsSpinner } from '../components/loading/LdrsSpinner';
import { PartnerFormModal } from '../components/partners/PartnerFormModal';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { formatLocalDate } from '../utils/dateUtils';
import {
  getCustomStatementDescriptions,
  saveCustomStatementDescription,
  clearCustomStatementDescription,
} from '../utils/statementOverrides';

interface PartnerDetailViewProps {
  contactId: string;
  user?: User | null;
  onBack: () => void;
  onEditContact?: (contact: Contact) => void;
}

type DateRangeFilter = 'all' | 'this_month' | 'last_month' | 'last_30_days' | 'custom';
type DashboardTab = 'statement' | 'inventory' | 'handovers' | 'repairs';

const getLedgerBadgeClass = (type: string) => {
  switch (type) {
    case 'consignment_sale':
    case 'brokered_sourcing':
    case 'manual_payable':
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50';
    case 'paid_by_device':
    case 'device_offset':
    case 'bilateral_offset':
    case 'payment_received':
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50';
    case 'payment_sent':
      return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50';
    case 'repair_offset':
      return 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border border-sky-200/50';
    case 'repair_claim':
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50';
    case 'sales_credit':
    case 'handover_holding':
    case 'manual_receivable':
    case 'customer_purchase':
      return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50';
    case 'payout_advance':
      return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50';
    case 'handover_return':
    case 'vendor_return':
    case 'vendor_return_refund':
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
  }
};

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

  // Modals & Actions
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Inline editing state for statement descriptions
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Inventory Unit Drawer State
  const [drawerUnit, setDrawerUnit] = useState<InventoryUnit | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenUnitDrawer = async (unitId: string) => {
    const tId = toast.loading('Loading device details...');
    try {
      const unitData = await api.getInventoryUnit(unitId);
      setDrawerUnit(unitData);
      setIsDrawerOpen(true);
      toast.dismiss(tId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load device details', { id: tId });
    }
  };

  const handleDownloadStatement = async () => {
    if (!statementData) return;
    try {
      setIsDownloadingPdf(true);
      const { contact, range } = statementData;
      const sanitizedContact = (contact.name || 'Partner').replace(/[^a-zA-Z0-9_-]/g, '_');
      const sanitizedRange = (range.formatted_range || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Statement_${sanitizedContact}_${sanitizedRange}.pdf`;

      const blob = await api.downloadPartnerStatementPdf(contactId, {
        start_date: range.start_date || undefined,
        end_date: range.end_date || undefined,
        custom_descriptions: customDescriptions,
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success('Statement PDF downloaded');
    } catch (err) {
      console.error('Failed to download partner statement PDF:', err);
      toast.error('Failed to download statement PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  useEffect(() => {
    if (contactId) {
      setCustomDescriptions(
        getCustomStatementDescriptions(contactId, statementData?.contact?.statement_overrides)
      );
    }
  }, [contactId, statementData?.contact?.statement_overrides]);

  const cleanContext = (ctx: string | null | undefined): string => {
    return (ctx || '')
      .replace(/Returned:\s*Transaction entry/gi, 'Device returned to vendor')
      .replace(/Transaction entry/gi, 'Device')
      .replace(/wire\s+payout/gi, 'Transferred')
      .replace(/(?:in|for|from)?\s*Order\s*#[A-Za-z0-9_-]+/gi, '')
      .replace(/#ORD-[A-Za-z0-9_-]+/gi, '')
      .replace(/\bORD-[A-Za-z0-9_-]+\b/gi, '')
      .replace(/\s+by\s+[A-Za-z0-9\s]+$/gi, '')
      .trim();
  };

  const handleStartEdit = (rowId: string, currentText: string) => {
    setEditingRowId(rowId);
    setEditingText(customDescriptions[rowId] ?? currentText);
  };

  const handleSaveEdit = async (rowId: string) => {
    const updated = saveCustomStatementDescription(contactId, rowId, editingText);
    setCustomDescriptions(updated);
    setEditingRowId(null);
    toast.success('Description updated');

    if (rowId.startsWith('debt-')) {
      const rawDebtId = rowId.replace('debt-', '');
      try {
        await api.updateDebt(rawDebtId, { notes: editingText.trim() });
      } catch (e) {
        console.warn('Could not sync note to backend debt record:', e);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditingText('');
  };

  const handleResetEdit = (rowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = clearCustomStatementDescription(contactId, rowId);
    setCustomDescriptions(updated);
    if (editingRowId === rowId) {
      setEditingRowId(null);
    }
    toast.success('Description reset to default');
  };

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

  const { contact, kpis, ledger, supplied_units, handed_out_units, vendor_return_units } = statementData;
  const isDateFiltered = dateFilter !== 'all' || Boolean(customStartDate || customEndDate);
  const netBalance = isDateFiltered ? kpis.range_closing_balance : kpis.current_net_balance;

  const filteredLedger = ledger;

  return (
    <div className="space-y-5 animate-page-enter">
      {/* ── Top Navigation & Header ── */}
      <div className="space-y-3.5 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        {/* Row 1: Back Button + Name + Action Buttons */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              title="Back to Network"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {contact.name}
              </h1>
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
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
                  <span className="inline-flex items-center gap-1.5">
                    {contact.phone && <span>·</span>}
                    <span className="capitalize">{contact.roles.join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Edit, Share, PDF (Mobile only < sm) */}
          <div className="sm:hidden flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleOpenEditModal}
              disabled={isFetchingContact}
              className="h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
              title="Edit Partner Details"
            >
              {isFetchingContact ? (
                <LdrsSpinner size={13} color="#64748b" stroke={2.5} />
              ) : (
                <Pencil className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={handleCopyPublicLink}
              className="h-8 px-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
              title="Copy shareable public read-only link"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadStatement}
              disabled={isDownloadingPdf}
              className="h-8 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Download Statement as PDF"
            >
              {isDownloadingPdf ? (
                <>
                  <LdrsSpinner size={13} color="#34d399" stroke={2.5} />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                  <span>PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Desktop Right Cluster (≥ sm): Balance + Divider + Actions */}
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block leading-tight">
                {netBalance > 0 ? 'Vendor Owes Us' : netBalance < 0 ? 'We Owe Vendor' : 'Net Balance'}
              </span>
              <div
                className={`text-2xl lg:text-3xl font-black font-mono tracking-tight tabular-nums flex items-baseline justify-end gap-1.5 ${
                  netBalance > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : netBalance < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                <span>
                  {netBalance > 0
                    ? `+${netBalance.toLocaleString()}`
                    : netBalance < 0
                    ? `−${Math.abs(netBalance).toLocaleString()}`
                    : '0.00'}
                </span>
                <span className="text-xs font-sans font-bold text-slate-400 dark:text-slate-500">
                  ETB
                </span>
              </div>
            </div>

            <div className="h-9 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenEditModal}
                disabled={isFetchingContact}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                title="Edit Partner Details"
              >
                {isFetchingContact ? (
                  <LdrsSpinner size={13} color="#64748b" stroke={2.5} />
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
                <span>{copiedLink ? 'Copied' : 'Share Statement'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadStatement}
                disabled={isDownloadingPdf}
                className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Download Statement as PDF"
              >
                {isDownloadingPdf ? (
                  <>
                    <LdrsSpinner size={13} color="#34d399" stroke={2.5} />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PDF Statement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Large Total Amount on Left + Minimal Period Dropdown on Right (Mobile only < sm) */}
        <div className="sm:hidden flex items-end justify-between gap-3 pt-1">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
              {netBalance > 0 ? 'Vendor Owes Us' : netBalance < 0 ? 'We Owe Vendor' : 'Net Balance'}
            </span>
            <div
              className={`text-2xl font-black font-mono tracking-tight tabular-nums flex items-baseline gap-1.5 ${
                netBalance > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : netBalance < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              <span>
                {netBalance > 0
                  ? `+${netBalance.toLocaleString()}`
                  : netBalance < 0
                  ? `−${Math.abs(netBalance).toLocaleString()}`
                  : '0.00'}
              </span>
              <span className="text-xs font-sans font-bold text-slate-400 dark:text-slate-500">
                ETB
              </span>
            </div>
          </div>

          {/* Right (Mobile only < sm): Minimal native Period dropdown without nested cards */}
          <div className="flex items-center shrink-0 pb-0.5">
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateRangeFilter)}
                className="h-8 pl-2.5 pr-6 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer appearance-none shadow-2xs"
              >
                <option value="all">All Time</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="custom">Custom</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Custom Range Date Pickers on Mobile (< sm) */}
        {dateFilter === 'custom' && (
          <div className="sm:hidden flex items-center gap-2 text-xs pt-1">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-7.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white flex-1"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-7.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white flex-1"
            />
          </div>
        )}
      </div>

      {/* ── Desktop Date Range Controls (≥ sm) ── */}
      <div className="hidden sm:flex items-center justify-between gap-2.5 p-2 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 shadow-2xs">
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
          {/* Table View: Cardless & Horizontally Scrollable on Mobile, Carded on Desktop */}
          <div className="bg-transparent sm:bg-white sm:dark:bg-[#131926] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
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
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${getLedgerBadgeClass(row.type)}`}
                            >
                              {row.type_label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 font-sans text-xs font-semibold text-slate-900 dark:text-white">
                            {editingRowId === row.id ? (
                              <div className="flex items-center gap-1.5 w-full max-w-sm">
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEdit(row.id);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      handleCancelEdit();
                                    }
                                  }}
                                  autoFocus
                                  className="flex-1 px-2 py-1 text-xs font-medium rounded border border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
                                  placeholder="Edit description..."
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(row.id)}
                                  className="p-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer transition-colors shadow-2xs"
                                  title="Save (Enter)"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                  title="Cancel (Esc)"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="group relative flex items-center justify-between gap-2">
                                <div
                                  onClick={() => handleStartEdit(row.id, cleanContext(row.context))}
                                  className="cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-1"
                                  title="Click to edit description"
                                >
                                  {customDescriptions[row.id] ?? cleanContext(row.context)}
                                </div>
                                <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                  {customDescriptions[row.id] && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleResetEdit(row.id, e)}
                                      className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition-colors cursor-pointer"
                                      title="Reset to default description"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(row.id, cleanContext(row.context))}
                                    className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                    title="Edit description"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
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
                  {filteredLedger.length > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium font-sans"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {filteredLedger.length} transactions loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIED INVENTORY UNITS */}
      {activeTab === 'inventory' && (
        <div>
          {/* Table View: Cardless & Horizontally Scrollable on Mobile, Carded on Desktop */}
          <div className="bg-transparent sm:bg-white sm:dark:bg-[#131926] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
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
                      <tr
                        key={unit.id}
                        onClick={() => handleOpenUnitDrawer(unit.id)}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                      >
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
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-800 dark:text-slate-200" onClick={(e) => e.stopPropagation()}>
                          <InlineEditablePrice
                            value={unit.cost_basis || 0}
                            unitId={unit.id}
                            field="cost_basis"
                            disabled={unit.status === 'sold'}
                            onSaved={() => loadStatement()}
                          />
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          {unit.selling_price > 0 ? `${unit.selling_price.toLocaleString()} ETB` : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-sans">
                          <div className="flex flex-col items-center gap-0.5">
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
                            {(unit.source_type === 'paid_by_device' || unit.funding_source === 'debtor_offset') && (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Paid by Device
                              </span>
                            )}
                          </div>
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
                  {supplied_units.length > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium font-sans"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {supplied_units.length} units loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HANDOVERS */}
      {activeTab === 'handovers' && (
        <div>
          {/* Table View: Cardless & Horizontally Scrollable on Mobile, Carded on Desktop */}
          <div className="bg-transparent sm:bg-white sm:dark:bg-[#131926] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
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
                      <tr
                        key={unit.id}
                        onClick={() => handleOpenUnitDrawer(unit.id)}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3.5 font-sans font-bold text-slate-900 dark:text-white">
                          {unit.model}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-700 dark:text-slate-300">
                          {unit.imei_or_serial || '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-800 dark:text-slate-200 font-bold" onClick={(e) => e.stopPropagation()}>
                          <InlineEditablePrice
                            value={unit.handover_payout || 0}
                            costBasis={unit.cost_basis}
                            unitId={unit.id}
                            field="handover_payout"
                            onSaved={() => loadStatement()}
                          />
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
                  {handed_out_units.length > 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium font-sans"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {handed_out_units.length} handover items loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REPAIRS & DEFECT RETURNS */}
      {activeTab === 'repairs' && (
        <div>
          {/* Table View: Cardless & Horizontally Scrollable on Mobile, Carded on Desktop */}
          <div className="bg-transparent sm:bg-white sm:dark:bg-[#131926] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:dark:border-slate-800 sm:shadow-2xs overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[640px]">
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
                              unit.is_reacquired
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50'
                                : unit.status === 'fixed'
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/50'
                                : unit.status === 'returned_to_vendor'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
                                : unit.status === 'returned' || unit.is_returned
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                            }`}
                          >
                            {unit.is_reacquired
                              ? 'Restocked in Shop'
                              : unit.status === 'fixed'
                              ? 'Fixed'
                              : unit.status === 'returned_to_vendor'
                              ? 'Returned to Vendor'
                              : unit.status === 'returned' || unit.is_returned
                              ? 'Returned to Shop'
                              : 'With Vendor'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                  {vendor_return_units.length > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium font-sans"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {vendor_return_units.length} warranty units loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Inventory Unit Drawer ── */}
      <InventoryUnitDrawer
        unit={drawerUnit}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setDrawerUnit(null);
        }}
        user={_user || null}
        onUnitUpdated={() => {
          loadStatement();
        }}
        onRestockSuccess={() => {
          loadStatement();
        }}
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
