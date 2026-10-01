import React, { useState, useEffect } from 'react';
import type { PartnerStatementData } from '../api/client';
import { api, resolveImageUrl } from '../api/client';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import {
  Printer,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface PublicStatementViewProps {
  token: string;
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

export const PublicStatementView: React.FC<PublicStatementViewProps> = ({ token }) => {
  const [data, setData] = useState<PartnerStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatement = async () => {
    try {
      setLoading(true);
      setError(null);
      const searchParams = new URLSearchParams(window.location.search);
      const startDate = searchParams.get('start_date') || undefined;
      const endDate = searchParams.get('end_date') || undefined;

      const res = await api.getPublicStatement(token, {
        start_date: startDate,
        end_date: endDate,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load statement. Link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadStatement();
    }
  }, [token]);

  if (loading && !data) {
    return <CustomPageLoader mode="app" fullScreen={true} />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-xl bg-white border border-slate-200 text-center space-y-3 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to Load Statement</h2>
          <p className="text-xs text-slate-500">
            {error || 'The statement token could not be verified. Please request a new statement link from the store manager.'}
          </p>
        </div>
      </div>
    );
  }

  const { contact, range, kpis, business, ledger } = data;
  const netTotal = kpis.range_closing_balance;
  const isReceivable = netTotal > 0;
  const isPayable = netTotal < 0;

  // Calculate strict column totals for the ledger table footer
  const totalPayableCol = ledger.reduce((acc, row) => acc + (row.payable || 0), 0);
  const totalReceivableCol = ledger.reduce((acc, row) => acc + (row.receivable || 0), 0);

  const today = new Date();
  const issuedDateSlash = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-6 sm:py-10 px-4 sm:px-8 lg:px-14 print:p-0 print:bg-white print:text-slate-900">
      <div className="w-full max-w-7xl mx-auto space-y-8">
        {/* Floating Controls Bar (No-print) */}
        <div className="no-print pb-4 border-b border-slate-200/90 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs" />
            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">
              Verified Partner Statement Portal
            </span>
          </div>

          <button
            onClick={() => {
              const orig = document.title;
              const sanitizedContact = (contact.name || 'Partner').replace(/[^a-zA-Z0-9_-]/g, '_');
              const sanitizedRange = (range.formatted_range || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
              document.title = `Statement_${sanitizedContact}_${sanitizedRange}`;
              window.print();
              setTimeout(() => {
                document.title = orig;
              }, 1000);
            }}
            className="h-9 px-4 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-[0.98]"
            title="Print document or download as PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Print or Download PDF</span>
          </button>
        </div>

        {/* The Printable Uncontained Statement Document */}
        <div id="printable-statement" className="w-full space-y-8 print:p-0 print:bg-white print:text-slate-900">
          {/* Header Branding & Corporate Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-900">
            <div className="flex items-start gap-5">
              {business.logo_url ? (
                <img
                  src={resolveImageUrl(business.logo_url) || business.logo_url}
                  alt={business.name}
                  className="h-20 sm:h-24 w-auto max-w-[280px] object-contain rounded-2xl shadow-xs shrink-0"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-3xl sm:text-4xl tracking-tight shrink-0 shadow-xs print:bg-slate-900 print:text-white">
                  {(business.name || 'H').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <h1 className="font-black text-2xl sm:text-3xl tracking-tight uppercase text-slate-900 leading-tight">
                  {business.name}
                </h1>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-medium">
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

            <div className="sm:text-right shrink-0 space-y-1">
              <div className="text-sm font-black uppercase tracking-wider text-slate-900">
                Vendor Statement
              </div>
              <div className="font-mono text-sm font-bold text-slate-600">
                {formatSlashRange(range.start_date, range.end_date, range.formatted_range)}
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Issued: {issuedDateSlash}
              </div>
            </div>
          </div>

          {/* Unified Partner Voucher & Financial Position Strip */}
          <div className="p-5 sm:p-6 rounded-xl border border-slate-200/90 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6 print:border-slate-300 print:bg-slate-50/40">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                Vendor Account
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                {contact.name}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-600">
                {contact.phone && <span>{contact.phone}</span>}
                {contact.alt_phone && <span>· {contact.alt_phone}</span>}
                {contact.roles && contact.roles.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-sans text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {contact.roles.map(r => r.replace(/_/g, ' ')).join(', ')}
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right font-mono shrink-0 space-y-1">
              <div className="flex items-center sm:justify-end gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${isReceivable ? 'bg-emerald-500' : isPayable ? 'bg-rose-500' : 'bg-slate-400'}`} />
                <span className={`text-xs font-black uppercase tracking-wider ${
                  isReceivable
                    ? 'text-emerald-700'
                    : isPayable
                    ? 'text-rose-700'
                    : 'text-slate-600'
                }`}>
                  {isReceivable ? 'Vendor Owes Us' : isPayable ? 'We Owe Vendor' : 'Settled In Full'}
                </span>
              </div>
              <div
                className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                  isReceivable
                    ? 'text-emerald-700'
                    : isPayable
                    ? 'text-rose-700'
                    : 'text-slate-900'
                }`}
              >
                {isReceivable ? '+' : isPayable ? '−' : ''}
                {Math.abs(netTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-bold text-slate-400 font-sans ml-1.5">ETB</span>
              </div>
            </div>
          </div>

          {/* Transaction Activity Breakdown Table */}
          <div className="space-y-3">
            <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1">
              <span>Transaction Activity Breakdown</span>
              <span className="font-mono text-xs font-normal text-slate-500">{ledger.length} entries</span>
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
                  <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/80 print:bg-transparent">
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap">Date</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap">Type</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 min-w-[180px] print:min-w-0">Description</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 text-right whitespace-nowrap">Payable (ETB)</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 text-right whitespace-nowrap">Receivable (ETB)</th>
                    <th className="py-3 px-3 print:py-1.5 print:px-1.5 text-right whitespace-nowrap">Balance (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-900 print:divide-slate-200">
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
                        className="hover:bg-slate-50/60 print:hover:bg-transparent transition-colors"
                      >
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap text-slate-600 print:text-slate-800 font-mono text-[11px]">
                          {formatSlashDate(row.date)}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 whitespace-nowrap font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              row.type === 'consignment_sale' || row.type === 'brokered_sourcing' || row.type === 'manual_payable'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                : row.type === 'payment_sent'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200/60'
                                : row.type === 'repair_offset'
                                ? 'bg-sky-50 text-sky-800 border border-sky-200/60'
                                : row.type === 'repair_claim'
                                ? 'bg-rose-50 text-rose-800 border border-rose-200/60'
                                : row.type === 'sales_credit' || row.type === 'handover_holding' || row.type === 'manual_receivable'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200/60'
                                : row.type === 'payout_advance'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200/60'
                                : row.type === 'payment_received'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {row.type_label}
                          </span>
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 font-sans text-xs font-semibold text-slate-900 leading-snug">
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
                            <div className="font-mono text-[10px] text-slate-500 font-normal mt-0.5">
                              Ref: {row.reference_number}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right tabular-nums text-slate-900 font-medium">
                          {row.payable !== 0 ? (
                            <span className={row.payable < 0 ? 'text-blue-700 font-bold' : ''}>
                              {row.payable > 0 ? row.payable.toLocaleString(undefined, { minimumFractionDigits: 2 }) : `-${Math.abs(row.payable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right tabular-nums text-slate-900 font-medium">
                          {row.receivable !== 0 ? (
                            <span className={row.receivable < 0 ? 'text-emerald-700 font-bold' : ''}>
                              {row.receivable > 0 ? row.receivable.toLocaleString(undefined, { minimumFractionDigits: 2 }) : `-${Math.abs(row.receivable).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 print:py-1.5 print:px-1.5 text-right font-bold tabular-nums">
                          <span
                            className={
                              row.running_balance > 0
                                ? 'text-emerald-700 font-black'
                                : row.running_balance < 0
                                ? 'text-rose-700 font-black'
                                : 'text-slate-600'
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
                    <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900 print:bg-slate-50/60">
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
                        <span className={kpis.range_closing_balance > 0 ? 'text-emerald-700' : kpis.range_closing_balance < 0 ? 'text-rose-700' : 'text-slate-900'}>
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
            <div className="pt-5 border-t border-slate-200 space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 block">
                Remittance Accounts
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {business.bank_accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs font-mono"
                  >
                    <span className="text-[10px] font-bold text-slate-500 font-sans uppercase tracking-wider block">
                      {acc.name}
                    </span>
                    <span className="font-black text-sm text-slate-900 block mt-0.5">
                      {acc.account_number || 'Cashier Desk'}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize block mt-0.5 font-sans">
                      {acc.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official Verification Seal & Signatures */}
          <div className="pt-6 border-t-2 border-slate-900 flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>OFFICIAL FINANCIAL STATEMENT</span>
              </div>
              <p className="text-[10px] text-slate-500 max-w-sm">
                {(business.footer_note || `Official accounting statement generated by ${business.name}. All ledger entries are verified and preserved.`).replace(/\bERP\b/gi, '').replace(/\s+/g, ' ').trim()}
              </p>
            </div>

            <div className="sm:text-right space-y-4">
              <div className="w-52 border-b-2 border-slate-900 pb-1 text-center font-mono text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                Authorized Signature
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
