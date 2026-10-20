import React, { useState, useEffect, useCallback } from 'react';
import type { User, Tenant, Contact, FinancialAccount, ProformaInvoice } from '../api/client';
import { api } from '../api/client';
import {
  FileText,
  Plus,
  Search,
  Download,
  Printer,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ProformaInvoiceModal } from '../components/proforma/ProformaInvoiceModal';
import { ProformaInvoiceDetailDrawer } from '../components/drawers/ProformaInvoiceDetailDrawer';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

interface ProformaInvoiceViewProps {
  user: User | null;
  tenant: Tenant | null;
  accounts?: FinancialAccount[];
  contacts?: Contact[];
}

export const ProformaInvoiceView: React.FC<ProformaInvoiceViewProps> = ({
  user,
  tenant,
  accounts = [],
  contacts = [],
}) => {
  const [invoices, setInvoices] = useState<ProformaInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<ProformaInvoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<ProformaInvoice | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<ProformaInvoice | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Fetch proforma invoices
  const fetchInvoices = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res: any = await api.getProformaInvoices(params);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setInvoices(list);
    } catch (err: any) {
      toast.error('Failed to load proforma invoices', { description: err.message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Handle Copy Number
  const handleCopyNumber = (e: React.MouseEvent, num: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(num);
    setCopiedId(id);
    toast.success(`Copied #${num}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle PDF Download
  const handleDownloadPdf = async (e: React.MouseEvent, invoice: ProformaInvoice) => {
    e.stopPropagation();
    setDownloadingId(invoice.id);
    try {
      const blob = await api.downloadProformaPdf(invoice.id, true);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Proforma_${invoice.proforma_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Vector PDF downloaded', { description: `Document #${invoice.proforma_number} ready.` });
    } catch (err: any) {
      toast.error('Download failed', { description: err.message || 'Could not generate PDF.' });
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Quick Print
  const handlePrint = (e: React.MouseEvent, invoice: ProformaInvoice) => {
    e.stopPropagation();
    const url = api.getProformaPdfUrl(invoice.id, false);
    const win = window.open(url, '_blank');
    if (win) win.focus();
    else toast.error('Please allow popups to open PDF document.');
  };

  // Handle Duplicate
  const handleDuplicate = async (e: React.MouseEvent, invoice: ProformaInvoice) => {
    e.stopPropagation();
    try {
      const res = await api.duplicateProformaInvoice(invoice.id);
      const clone = (res as any).data || res;
      toast.success(`Duplicated as #${clone.proforma_number}`);
      fetchInvoices(true);
    } catch (err: any) {
      toast.error('Duplication failed', { description: err.message });
    }
  };

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!deletingInvoice) return;
    setIsDeleting(true);
    try {
      await api.deleteProformaInvoice(deletingInvoice.id);
      toast.success(`Proforma #${deletingInvoice.proforma_number} deleted.`);
      setDeletingInvoice(null);
      fetchInvoices(true);
    } catch (err: any) {
      toast.error('Failed to delete invoice', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  // Status Badge Styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
      case 'sent':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
      case 'expired':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';
      case 'converted_to_sale':
        return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Performa Invoices
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              Official Quotations
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create, track, and generate executive PDF quotations with 15% VAT and 1.5% WHT deductions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchInvoices(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingInvoice(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Performa Invoice</span>
          </button>
        </div>
      </div>


      {/* Toolbar: Search & Status Pills */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#131926] p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by proforma #, customer name, phone, or RFQ..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All' },
            { id: 'draft', label: 'Draft' },
            { id: 'sent', label: 'Sent' },
            { id: 'accepted', label: 'Accepted' },
            { id: 'converted_to_sale', label: 'Converted' },
            { id: 'expired', label: 'Expired' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / Data Surface */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <CustomPageLoader mode="app" fullScreen={false} />
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No performa invoices found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'No invoices match your active filters. Try clearing your search.'
                : 'Create your first professional proforma quotation with automatic 15% VAT and 1.5% WHT calculations.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingInvoice(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Performa Invoice</span>
            </button>
          </div>
        ) : (
          <>
            {/* Mobile Native Card View (< sm: zero horizontal scrolling) */}
            <div className="block sm:hidden p-3 space-y-3">
              {invoices.map((inv) => {
                const isExpired = inv.valid_until && new Date(inv.valid_until) < new Date();
                const isDownloading = downloadingId === inv.id;

                return (
                  <div
                    key={inv.id}
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setIsDrawerOpen(true);
                    }}
                    className="p-3.5 bg-white dark:bg-[#131926] rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3 cursor-pointer active:scale-[0.99] transition-all"
                  >
                    {/* Header Row: Quotation # and Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white truncate">
                          #{inv.proforma_number}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyNumber(e, inv.proforma_number, inv.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
                          title="Copy number"
                        >
                          {copiedId === inv.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 border ${getStatusBadge(
                          inv.status
                        )}`}
                      >
                        {inv.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Customer & Reference */}
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {inv.customer_name}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {inv.customer_phone && <span>{inv.customer_phone}</span>}
                        {inv.customer_tin && <span>TIN: {inv.customer_tin}</span>}
                        {inv.reference_number && <span>Ref: {inv.reference_number}</span>}
                      </div>
                    </div>

                    {/* Dates & Validity */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                      <span>Issued: <strong className="text-slate-700 dark:text-slate-300 font-medium">{inv.issue_date}</strong></span>
                      {inv.valid_until ? (
                        <span
                          className={
                            isExpired && inv.status !== 'converted_to_sale'
                              ? 'text-rose-500 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {isExpired && inv.status !== 'converted_to_sale'
                            ? `Expired (${inv.valid_until})`
                            : `Valid to ${inv.valid_until}`}
                        </span>
                      ) : (
                        <span className="text-slate-400">No expiration</span>
                      )}
                    </div>

                    {/* Financial Strip */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                          Net Payable
                        </span>
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {Number(inv.net_payable).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{inv.currency}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">{inv.items?.length || 0} items</span>
                        {Number(inv.withholding_total) > 0 ? (
                          <span className="text-[10px] text-rose-500 font-mono font-medium">1.5% WHT applied</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Base: {Number(inv.taxable_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div
                      className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-slate-800/60"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handlePrint(e, inv)}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                          title="View / Print PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadPdf(e, inv)}
                          disabled={isDownloading}
                          className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                          title="Download PDF"
                        >
                          {isDownloading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          <span>PDF</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingInvoice(inv);
                            setIsModalOpen(true);
                          }}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDuplicate(e, inv)}
                          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Duplicate"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingInvoice(inv);
                          }}
                          className="p-2 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= sm: keeps desktop layout untouched) */}
            <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  <th className="py-3 px-4">Proforma #</th>
                  <th className="py-3 px-4">Customer Entity</th>
                  <th className="py-3 px-4">Dates & Validity</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Taxable Base</th>
                  <th className="py-3 px-4 text-right">Net Payable</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {invoices.map((inv) => {
                  const isExpired = inv.valid_until && new Date(inv.valid_until) < new Date();
                  const isDownloading = downloadingId === inv.id;

                  return (
                    <tr
                      key={inv.id}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setIsDrawerOpen(true);
                      }}
                      className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      {/* Number & Copy */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {inv.proforma_number}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyNumber(e, inv.proforma_number, inv.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            title="Copy number"
                          >
                            {copiedId === inv.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        {inv.reference_number && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Ref: {inv.reference_number}
                          </div>
                        )}
                      </td>

                      {/* Customer Entity */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {inv.customer_name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {inv.customer_phone || (inv.customer_tin ? `TIN: ${inv.customer_tin}` : 'No contact specified')}
                        </div>
                      </td>

                      {/* Dates & Validity */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          {inv.issue_date}
                        </div>
                        {inv.valid_until ? (
                          <div
                            className={`text-[10px] ${
                              isExpired && inv.status !== 'converted_to_sale'
                                ? 'text-rose-500 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            Valid to {inv.valid_until} {isExpired && inv.status !== 'converted_to_sale' ? '(Expired)' : ''}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">No expiration</div>
                        )}
                      </td>

                      {/* Items Count */}
                      <td className="py-3 px-4 text-center font-mono text-slate-600 dark:text-slate-400">
                        {inv.items?.length || 0}
                      </td>

                      {/* Taxable Base */}
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                        {Number(inv.taxable_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Net Payable */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {Number(inv.net_payable).toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{inv.currency}</span>
                        </div>
                        {Number(inv.withholding_total) > 0 && (
                          <div className="text-[10px] text-rose-500 font-mono font-medium">
                            w/ {Number(inv.withholding_rate)}% WHT
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadge(
                            inv.status
                          )}`}
                        >
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Quick Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handlePrint(e, inv)}
                            title="View / Print PDF"
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDownloadPdf(e, inv)}
                            disabled={isDownloading}
                            title="Download Vector PDF"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            {isDownloading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingInvoice(inv);
                              setIsModalOpen(true);
                            }}
                            title="Edit Proforma"
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(e, inv)}
                            title="Duplicate as new draft"
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingInvoice(inv);
                            }}
                            title="Delete Proforma"
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
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
          </>
        )}
      </div>

      {/* Proforma Creation & Edit Modal */}
      <ProformaInvoiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingInvoice(null);
        }}
        initialInvoice={editingInvoice}
        onSaved={() => {
          fetchInvoices(true);
        }}
        user={user}
        tenant={tenant}
        contacts={contacts}
        accounts={accounts}
      />

      {/* Proforma Inspection Drawer */}
      <ProformaInvoiceDetailDrawer
        proforma={selectedInvoice}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedInvoice(null);
        }}
        onEdit={(inv) => {
          setEditingInvoice(inv);
          setIsModalOpen(true);
        }}
        onDuplicate={(inv) => {
          handleDuplicate({ stopPropagation: () => {} } as any, inv);
        }}
        onDeleted={() => {
          fetchInvoices(true);
        }}
        onStatusUpdated={() => {
          fetchInvoices(true);
        }}
        user={user}
        tenant={tenant}
      />

      {/* Minimal Custom Delete Alert Modal */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={() => !isDeleting && setDeletingInvoice(null)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200/60 dark:border-rose-900/40">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Proforma Invoice?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to delete quotation <span className="font-mono font-bold text-slate-900 dark:text-white">#{deletingInvoice.proforma_number}</span> for <span className="font-semibold text-slate-800 dark:text-slate-200">{deletingInvoice.customer_name}</span>?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between items-center font-mono">
              <span>Total Value:</span>
              <span className="font-bold text-slate-900 dark:text-white text-xs">
                {Number(deletingInvoice.net_payable).toLocaleString(undefined, { minimumFractionDigits: 2 })} {deletingInvoice.currency}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingInvoice(null)}
                className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
