import React from 'react';
import type { PartnerStatementData } from '../../api/client';
import { Printer, X, Link, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

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
  const [copiedLink, setCopiedLink] = React.useState(false);

  if (!isOpen) return null;

  const { contact, range, kpis, business, ledger } = data;
  const netTotal = kpis.range_closing_balance;
  const isReceivable = netTotal > 0;
  const isPayable = netTotal < 0;

  // Calculate strict column totals for the ledger table footer
  const totalPayableCol = ledger.reduce((acc, row) => acc + (row.payable || 0), 0);
  const totalReceivableCol = ledger.reduce((acc, row) => acc + (row.receivable || 0), 0);

  const today = new Date();
  const issuedDateSlash = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const handlePrint = () => {
    const originalTitle = document.title;
    const sanitizedContact = (contact.name || 'Partner').replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedRange = (range.formatted_range || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `Statement_${sanitizedContact}_${sanitizedRange}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
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
    const qs = params.toString();
    const url = `${origin}/statement/${contact.statement_token}${qs ? `?${qs}` : ''}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success('Public statement link copied to clipboard', {
      description: 'Vendor will see this exact statement for the selected period.',
    });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 pb-8 px-3 sm:px-6 bg-black/60 backdrop-blur-xs overflow-y-auto printable-modal-backdrop">
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-[#0f1422] rounded-md shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden printable-modal-card animate-modal-crisp"
        role="dialog"
        aria-modal="true"
      >
        {/* Action Bar (Hidden during window.print()) */}
        <div className="no-print px-5 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Statement Preview</span>
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-slate-500 font-mono text-[11px]">{range.formatted_range}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-8 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Copy public link to share with vendor"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              title="Print document or download as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print or Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Executive Statement Document */}
        <div id="printable-statement" className="p-6 sm:p-10 space-y-6 bg-white dark:bg-[#0f1422] text-slate-900 dark:text-slate-100 print:p-0 print:bg-white print:text-slate-900">
          {/* Header Branding & Corporate Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900 dark:border-slate-200 print:border-slate-900">
            <div className="flex items-start gap-3.5">
              {business.logo_url ? (
                <img
                  src={business.logo_url}
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
                                : row.type === 'sales_credit' || row.type === 'handover_holding' || row.type === 'manual_receivable'
                                ? 'bg-purple-50 dark:bg-purple-950/60 print:bg-purple-50 text-purple-700 dark:text-purple-300 print:text-purple-800'
                                : row.type === 'payout_advance'
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 print:bg-indigo-50 text-indigo-700 dark:text-indigo-400 print:text-indigo-800'
                                : row.type === 'payment_received'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 print:bg-emerald-50 text-emerald-700 dark:text-emerald-400 print:text-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 print:bg-slate-100 text-slate-600 dark:text-slate-300 print:text-slate-700'
                            }`}
                          >
                            {row.type_label}
                          </span>
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 font-sans text-xs font-semibold text-slate-900 dark:text-white print:text-slate-900 leading-snug">
                          <div>
                            {(row.context || '')
                              .replace(/wire\s+payout/gi, 'Transferred')
                              .replace(/(?:in|for|from)?\s*Order\s*#[A-Za-z0-9_-]+/gi, '')
                              .replace(/#ORD-[A-Za-z0-9_-]+/gi, '')
                              .replace(/\bORD-[A-Za-z0-9_-]+\b/gi, '')
                              .replace(/\s+by\s+[A-Za-z0-9\s]+$/gi, '')
                              .trim()}
                          </div>
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
          {business.bank_accounts && business.bank_accounts.length > 0 && isReceivable && (
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 print:border-slate-300 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 print:text-slate-600 block">
                Remittance Accounts
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {business.bank_accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3 rounded-md bg-slate-50/80 dark:bg-slate-900/40 print:bg-slate-50/40 border border-slate-200 dark:border-slate-800 print:border-slate-300 font-mono"
                  >
                    <span className="text-[10px] font-bold text-slate-400 print:text-slate-500 font-sans uppercase tracking-wider block">
                      {acc.name}
                    </span>
                    <span className="font-black text-sm text-slate-900 dark:text-white print:text-slate-900 block mt-0.5">
                      {acc.account_number || 'Cashier Desk'}
                    </span>
                    <span className="text-[10px] text-slate-400 print:text-slate-500 capitalize block mt-0.5 font-sans">
                      {acc.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
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
  );
};
