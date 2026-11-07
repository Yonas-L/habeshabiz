import React, { useState, useEffect } from 'react';
import type { PartnerStatementData } from '../../api/client';
import { api, resolveImageUrl } from '../../api/client';
import {
  Receipt,
  Printer,
  X,
  Link,
  Check,
  ShieldCheck,
  Pencil,
  RotateCcw,
  ArrowDownToLine,
} from 'lucide-react';
import { LdrsSpinner } from '../loading/LdrsSpinner';
import { toast } from 'sonner';
import { downloadPdf } from '../../utils/downloadPdf';
import {
  getCustomStatementDescriptions,
  saveCustomStatementDescription,
  clearCustomStatementDescription,
} from '../../utils/statementOverrides';

interface VendorStatementPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PartnerStatementData;
}

const formatSlashDate = (dateVal: string | null | undefined): string => {
  if (!dateVal) return '—';
  const parts = dateVal.split('T')[0].split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return dateVal;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatSlashRange = (start: string | null | undefined, end: string | null | undefined, fallback: string): string => {
  if (start && end) {
    return `${formatSlashDate(start)} - ${formatSlashDate(end)}`;
  }
  return fallback || 'All Historical Records';
};

export const VendorStatementPrintModal: React.FC<VendorStatementPrintModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() =>
    (data.business.bank_accounts || []).map((a) => a.id)
  );
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const { contact, range, kpis, business, ledger } = data;

  useEffect(() => {
    if (contact?.id) {
      setCustomDescriptions(
        getCustomStatementDescriptions(contact.id, contact.statement_overrides)
      );
    }
  }, [contact?.id, contact?.statement_overrides, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingRowId) {
          setEditingRowId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingRowId, onClose]);

  const cleanContext = (ctx: string | null | undefined): string => {
    return (ctx || '')
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
    const updated = saveCustomStatementDescription(contact.id, rowId, editingText);
    setCustomDescriptions(updated);
    setEditingRowId(null);
    toast.success('Statement description updated');

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
    const updated = clearCustomStatementDescription(contact.id, rowId);
    setCustomDescriptions(updated);
    if (editingRowId === rowId) {
      setEditingRowId(null);
    }
    toast.success('Description reset to default');
  };

  if (!isOpen) return null;

  const netTotal = kpis.range_closing_balance;
  const isReceivable = netTotal > 0;
  const isPayable = netTotal < 0;

  // Calculate strict column totals for the ledger table footer
  const totalPayableCol = ledger.reduce((acc, row) => acc + (row.payable || 0), 0);
  const totalReceivableCol = ledger.reduce((acc, row) => acc + (row.receivable || 0), 0);

  const today = new Date();
  const issuedDateSlash = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const handlePrint = async () => {
    setIsDownloading(true);
    const sanitizedContact = (contact.name || 'Partner').replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedRange = (range.formatted_range || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Statement_${sanitizedContact}_${sanitizedRange}`;

    try {
      const accountsParam =
        selectedAccountIds.length === (business.bank_accounts || []).length
          ? undefined
          : selectedAccountIds.length === 0
          ? 'none'
          : selectedAccountIds.join(',');

      const blob = await api.downloadPartnerStatementPdf(contact.id, {
        start_date: range.start_date || undefined,
        end_date: range.end_date || undefined,
        accounts: accountsParam,
        custom_descriptions: customDescriptions,
      });

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${filename}.pdf`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success('Vector Statement PDF downloaded');
    } catch (err) {
      console.warn('Backend PDF download failed, falling back to client-side capture:', err);
      // Seamless client-side fallback
      await downloadPdf(
        'printable-statement',
        filename,
        undefined,
        undefined,
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    if (!contact.statement_token) {
      toast.error('Public statement link is not available');
      return;
    }
    const origin = window.location.origin;
    const params = new URLSearchParams();
    if (range.start_date) params.set('start_date', range.start_date);
    if (range.end_date) params.set('end_date', range.end_date);
    if (selectedAccountIds.length === 0) {
      params.set('accounts', 'none');
    } else if (selectedAccountIds.length < (business.bank_accounts || []).length) {
      params.set('accounts', selectedAccountIds.join(','));
    }
    if (Object.keys(customDescriptions).length > 0) {
      params.set('custom_descriptions', JSON.stringify(customDescriptions));
    }
    const qs = params.toString();
    const url = `${origin}/statement/${contact.statement_token}${qs ? `?${qs}` : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('Public statement link copied to clipboard', {
      description: 'Vendor will see this exact statement with your custom notes for the selected period.',
    });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-hidden animate-fade-in printable-modal-backdrop">
      <div
        className="relative w-full max-w-5xl h-[94vh] max-h-[920px] bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 flex flex-col overflow-hidden printable-modal-card ring-1 ring-white/10"
        role="dialog"
        aria-modal="true"
      >
        {/* Action Bar (Hidden during window.print()) */}
        <div className="no-print px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight truncate">Statement Preview</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Live Document
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-200 truncate">{contact.name}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-[11px] text-slate-400">{range.formatted_range}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-8.5 px-3 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-750 hover:border-slate-600 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              title="Copy public link to share with vendor"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedLink ? 'Link Copied' : 'Copy Public Link'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:inline-flex h-8.5 px-3 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-750 hover:border-slate-600 text-slate-200 text-xs font-semibold transition-all items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              title="Print statement"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isDownloading}
              className="h-8.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              title="Download statement as PDF"
            >
              {isDownloading ? (
                <>
                  <LdrsSpinner size={13} color="#ffffff" stroke={2.5} />
                  <span>Generating…</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
            <div className="h-5 w-[1px] bg-slate-800 mx-1" />
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Remittance Accounts Selector Toolbar (No Print) */}
        {business.bank_accounts && business.bank_accounts.length > 0 && isReceivable && (
          <div className="no-print px-5 py-2.5 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs shrink-0">
            <span className="text-[11px] font-semibold text-slate-400">Include Accounts:</span>
            {business.bank_accounts.map((acc) => {
              const isChecked = selectedAccountIds.includes(acc.id);
              return (
                <label
                  key={acc.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors border ${
                    isChecked
                      ? 'bg-slate-800 border-slate-600 text-white shadow-2xs'
                      : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAccountIds([...selectedAccountIds, acc.id]);
                      } else {
                        setSelectedAccountIds(selectedAccountIds.filter((id) => id !== acc.id));
                      }
                    }}
                    className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>{acc.name}</span>
                </label>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setSelectedAccountIds(
                  selectedAccountIds.length === business.bank_accounts.length ? [] : business.bank_accounts.map((a) => a.id)
                )
              }
              className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-auto cursor-pointer"
            >
              {selectedAccountIds.length === business.bank_accounts.length ? 'Clear all' : 'Select all'}
            </button>
          </div>
        )}

        {/* Document Viewing Canvas (Desk) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950/40 dark:bg-black/60 flex justify-center custom-scrollbar">
          {/* Printable Executive Statement Document Sheet */}
          <div
            id="printable-statement"
            className="w-full max-w-4xl bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200/90 p-8 sm:p-12 space-y-6 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full print:bg-white"
          >
          {/* Header Branding & Corporate Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900 dark:border-slate-200 print:border-slate-900">
            <div className="flex items-start gap-3.5">
              {business.logo_url ? (
                <img
                  src={resolveImageUrl(business.logo_url) || business.logo_url}
                  alt={business.name}
                  className="h-16 sm:h-20 w-auto max-w-[240px] object-contain rounded-2xl shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-2xl sm:text-3xl tracking-tight shrink-0 shadow-xs print:bg-slate-900 print:text-white">
                  {(business.name || 'H').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="font-black text-lg sm:text-xl tracking-tight uppercase text-slate-900 dark:text-white print:text-slate-900 leading-tight">
                  {business.name}
                </h1>
                <div className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
                  {business.branch && <span>{business.branch}</span>}
                  {business.phone && (
                    <>
                      <span>·</span>
                      <span>{business.phone}</span>
                    </>
                  )}
                  {business.email && (
                    <>
                      <span>·</span>
                      <span>{business.email}</span>
                    </>
                  )}
                  {business.tin_number && (
                    <>
                      <span>·</span>
                      <span className="font-mono">TIN: {business.tin_number}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white print:text-slate-900">
                Vendor Statement
              </div>
              <div className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 print:text-slate-600 mt-0.5">
                {formatSlashRange(range.start_date, range.end_date, range.formatted_range)}
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-500 mt-0.5 font-mono">
                Issued: {issuedDateSlash}
              </div>
            </div>
          </div>

          {/* Unified Partner Voucher & Financial Position Strip */}
          <div className="p-4 sm:p-5 rounded-md border border-slate-200 dark:border-slate-800 print:border-slate-300 bg-slate-50/70 dark:bg-slate-900/50 print:bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 print:text-slate-500 block">
                Vendor Account
              </span>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white print:text-slate-900 tracking-tight leading-tight">
                {contact.name}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400 print:text-slate-600">
                {contact.phone && <span>{contact.phone}</span>}
                {contact.alt_phone && <span>· {contact.alt_phone}</span>}
                {contact.roles && contact.roles.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 print:bg-slate-200 text-slate-700 dark:text-slate-300 print:text-slate-800">
                    {contact.roles.map(r => r.replace(/_/g, ' ')).join(', ')}
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right font-mono shrink-0 space-y-0.5">
              <div className="flex items-center sm:justify-end gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isReceivable ? 'bg-emerald-500' : isPayable ? 'bg-rose-500' : 'bg-slate-400'}`} />
                <span className={`text-xs font-black uppercase tracking-wider ${
                  isReceivable
                    ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700'
                    : isPayable
                    ? 'text-rose-600 dark:text-rose-400 print:text-rose-700'
                    : 'text-slate-500 print:text-slate-600'
                }`}>
                  {isReceivable ? 'Vendor Owes Us' : isPayable ? 'We Owe Vendor' : 'Settled In Full'}
                </span>
              </div>
              <div
                className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                  isReceivable
                    ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700'
                    : isPayable
                    ? 'text-rose-600 dark:text-rose-400 print:text-rose-700'
                    : 'text-slate-800 dark:text-slate-200 print:text-slate-900'
                }`}
              >
                {isReceivable ? '+' : isPayable ? '−' : ''}
                {Math.abs(netTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-bold text-slate-400 print:text-slate-500 font-sans ml-1.5">ETB</span>
              </div>
            </div>
          </div>

          {/* Transaction Activity Breakdown Table */}
          <div className="space-y-3">
            <div className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white print:text-slate-900 flex items-center justify-between pb-1">
              <span>Transaction Activity Breakdown</span>
              <span className="font-mono text-xs font-normal text-slate-400 print:text-slate-500">{ledger.length} entries</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse print:table-fixed">
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[16%]" />
                  <col className="w-[35%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-slate-900 dark:border-slate-200 print:border-slate-900 text-slate-900 dark:text-white print:text-slate-900 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap">Date</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap">Type</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 min-w-[180px] print:min-w-0">Description</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 text-right whitespace-nowrap">Payable (ETB)</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 text-right whitespace-nowrap">Receivable (ETB)</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 text-right whitespace-nowrap">Balance (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 print:divide-slate-200 font-mono text-xs">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-sans italic text-sm">
                        No transactions recorded for this partner within the selected period.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20 print:hover:bg-transparent transition-colors"
                      >
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300 print:text-slate-700 font-mono text-[11px]">
                          {formatSlashDate(row.date)}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              row.type === 'consignment_sale' || row.type === 'brokered_sourcing' || row.type === 'manual_payable'
                                ? 'bg-amber-50 dark:bg-amber-950/60 print:bg-amber-50 text-amber-700 dark:text-amber-400 print:text-amber-800'
                                : row.type === 'payment_sent'
                                ? 'bg-blue-50 dark:bg-blue-950/60 print:bg-blue-50 text-blue-700 dark:text-blue-400 print:text-blue-800'
                                : row.type === 'repair_offset'
                                ? 'bg-sky-50 dark:bg-sky-950/60 print:bg-sky-50 text-sky-700 dark:text-sky-400 print:text-sky-800'
                                : row.type === 'repair_claim'
                                ? 'bg-rose-50 dark:bg-rose-950/60 print:bg-rose-50 text-rose-700 dark:text-rose-400 print:text-rose-800'
                                : row.type === 'sales_credit' || row.type === 'handover_holding' || row.type === 'manual_receivable' || row.type === 'customer_purchase'
                                ? 'bg-purple-50 dark:bg-purple-950/60 print:bg-purple-50 text-purple-700 dark:text-purple-300 print:text-purple-800'
                                : row.type === 'payout_advance'
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 print:bg-indigo-50 text-indigo-700 dark:text-indigo-400 print:text-indigo-800'
                                : row.type === 'payment_received' || row.type === 'paid_by_device' || row.type === 'device_offset' || row.type === 'bilateral_offset'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 print:bg-emerald-50 text-emerald-700 dark:text-emerald-400 print:text-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 print:bg-slate-100 text-slate-600 dark:text-slate-300 print:text-slate-700'
                            }`}
                          >
                            {row.type_label}
                          </span>
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 font-sans text-xs font-semibold text-slate-900 dark:text-white print:text-slate-900 leading-snug">
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
                          {row.reference_number && !row.reference_number.startsWith('ORD-') && (
                            <div className="font-mono text-[10px] text-slate-400 print:text-slate-500 font-normal mt-0.5">
                              Ref: {row.reference_number}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-900 font-medium">
                          {row.payable !== 0 ? (
                            <span className={row.payable < 0 ? 'text-blue-600 dark:text-blue-400 print:text-blue-700 font-bold' : ''}>
                              {row.payable > 0 ? row.payable.toLocaleString(undefined, { minimumFractionDigits: 2 }) : `-${Math.abs(row.payable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 print:text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right tabular-nums text-slate-900 dark:text-slate-100 print:text-slate-900 font-medium">
                          {row.receivable !== 0 ? (
                            <span className={row.receivable < 0 ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700 font-bold' : ''}>
                              {row.receivable > 0 ? row.receivable.toLocaleString(undefined, { minimumFractionDigits: 2 }) : `-${Math.abs(row.receivable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600 print:text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right font-bold tabular-nums">
                          <span
                            className={
                              row.running_balance > 0
                                ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700 font-black'
                                : row.running_balance < 0
                                ? 'text-rose-600 dark:text-rose-400 print:text-rose-700 font-black'
                                : 'text-slate-500 print:text-slate-600'
                            }
                          >
                            {row.running_balance > 0 ? '+' : ''}
                            {row.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {ledger.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-900 dark:border-slate-200 print:border-slate-900 bg-slate-50/70 dark:bg-slate-900/40 print:bg-slate-50/60 font-mono text-xs font-bold text-slate-900 dark:text-white print:text-slate-900">
                      <td colSpan={3} className="py-3 px-3 print:py-1.5 print:px-1.5 font-sans text-xs uppercase tracking-wider">
                        Statement Period Totals
                      </td>
                      <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right tabular-nums">
                        {totalPayableCol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right tabular-nums">
                        {totalReceivableCol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right tabular-nums font-black">
                        <span className={kpis.range_closing_balance > 0 ? 'text-emerald-600 dark:text-emerald-400 print:text-emerald-700' : kpis.range_closing_balance < 0 ? 'text-rose-600 dark:text-rose-400 print:text-rose-700' : ''}>
                          {kpis.range_closing_balance > 0 ? '+' : ''}
                          {kpis.range_closing_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Payment Remittance Accounts */}
          {business.bank_accounts && business.bank_accounts.length > 0 && isReceivable && selectedAccountIds.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-600 block">
                Remittance Accounts
              </span>
              <div className="rounded border border-slate-200 dark:border-slate-800 print:border-slate-300 overflow-hidden bg-slate-50/40 dark:bg-slate-900/30 print:bg-white">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200 text-xs">
                    {business.bank_accounts
                      .filter((acc) => selectedAccountIds.includes(acc.id))
                      .map((acc) => (
                        <tr key={acc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 w-8 align-middle">
                            {acc.logo ? (
                              <img src={resolveImageUrl(acc.logo) || acc.logo} alt="" className="w-5 h-5 rounded object-contain inline-block" />
                            ) : (
                              <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                {acc.name.charAt(0)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 align-middle font-semibold text-slate-900 dark:text-white print:text-slate-900 text-xs">
                            {acc.name}
                            <span className="ml-2 text-[10px] text-slate-400 print:text-slate-500 font-normal capitalize">
                              ({acc.type.replace(/_/g, ' ')})
                            </span>
                          </td>
                          <td className="py-2 px-3 align-middle text-right font-mono font-bold text-xs text-slate-900 dark:text-white print:text-slate-900">
                            {acc.account_number || 'Cashier Desk'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Official Verification Seal & Signatures */}
          <div className="pt-6 border-t-2 border-slate-900 dark:border-slate-200 print:border-slate-900 flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white print:text-slate-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 print:text-emerald-700" />
                <span>OFFICIAL FINANCIAL STATEMENT</span>
              </div>
              <p className="text-[10px] text-slate-400 print:text-slate-500 max-w-sm">
                {(business.footer_note || `Official accounting statement generated by ${business.name}. All ledger entries are verified and preserved.`).replace(/\bERP\b/gi, '').replace(/\s+/g, ' ').trim()}
              </p>
            </div>

            <div className="sm:text-right space-y-4">
              <div className="w-52 border-b-2 border-slate-900 dark:border-slate-400 print:border-slate-900 pb-1 text-center font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 print:text-slate-700 uppercase tracking-wider">
                Authorized Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
