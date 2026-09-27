import React from 'react';
import type { PartnerStatementData } from '../../api/client';
import { Printer, X, Copy, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface VendorStatementPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PartnerStatementData;
}

export const VendorStatementPrintModal: React.FC<VendorStatementPrintModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const { contact, range, kpis, business, ledger } = data;
  const netTotal = kpis.range_closing_balance;
  const isReceivable = netTotal > 0;
  const isPayable = netTotal < 0;

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = () => {
    const text = [
      `${business.name} — Vendor Account Statement`,
      `Partner: ${contact.name} (${contact.phone || 'No phone'})`,
      `Statement Range: ${range.formatted_range}`,
      `Date Generated: ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
      `----------------------------------------`,
      `NET TOTAL: ${Math.abs(netTotal).toLocaleString()} ETB ${isReceivable ? '(You owe us)' : isPayable ? '(We owe you)' : '(Settled)'}`,
      `----------------------------------------`,
      ...ledger.map(
        (row) =>
          `${row.formatted_date} | ${row.type_label} | ${row.context} | Bal: ${row.running_balance.toLocaleString()} ETB`
      ),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Statement summary copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-3xl bg-white dark:bg-[#101622] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-800 my-auto overflow-hidden animate-receipt"
        role="dialog"
        aria-modal="true"
      >
        {/* Action Bar (Hidden during window.print()) */}
        <div className="no-print px-6 py-3.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Statement Preview</span>
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-slate-500 font-mono text-[11px]">{range.formatted_range}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-3.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Statement Document */}
        <div id="printable-statement" className="p-6 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100">
          {/* Header Branding */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="font-black text-base sm:text-lg tracking-tight uppercase text-slate-900 dark:text-white">
                {business.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {business.branch} · {business.phone}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {business.email}
              </div>
            </div>

            <div className="sm:text-right">
              <div className="inline-block px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 tracking-wider uppercase">
                Account Statement
              </div>
              <div className="text-[11px] text-slate-400 mt-1.5">
                Generated {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Statement Meta Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Contact</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate">
                {contact.name}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Phone</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">
                {contact.phone || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Statement Range</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">
                {range.formatted_range}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status</span>
              <span
                className={`font-bold mt-0.5 inline-block ${
                  isReceivable
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isPayable
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500'
                }`}
              >
                {isReceivable ? 'Receivable Claim' : isPayable ? 'Payable Balance' : 'Settled In Full'}
              </span>
            </div>
          </div>

          {/* Net Total Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isReceivable
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60'
                : isPayable
                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/60'
                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                NET TOTAL (STATEMENT RANGE)
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {isReceivable
                  ? `Payment reminder: Total outstanding amount to be settled to ${business.name}`
                  : isPayable
                  ? `Amount payable by ${business.name} to ${contact.name}`
                  : `All accounts and mutual transactions are settled for this period.`}
              </p>
            </div>
            <div className="sm:text-right font-mono">
              <div
                className={`text-2xl font-black tabular-nums ${
                  isReceivable
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isPayable
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {isReceivable ? '+' : isPayable ? '−' : ''}
                {Math.abs(netTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-sans ml-1.5">ETB</span>
              </div>
            </div>
          </div>

          {/* Transaction Breakdown Table */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Transaction Breakdown</span>
              <span className="font-mono text-[10px] text-slate-400 font-normal">
                {ledger.length} entries
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200/90 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Context / Agreement</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Payable</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Receivable</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans italic">
                        No transactions recorded for this partner within the selected period.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((row) => {
                      const isOpening = row.type === 'opening_balance';
                      return (
                        <tr
                          key={row.id}
                          className={isOpening ? 'bg-slate-50/50 dark:bg-slate-900/20 font-semibold' : ''}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {row.formatted_date}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                row.type === 'consignment_sale' || row.type === 'brokered_sourcing' || row.type === 'manual_payable'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                  : row.type === 'payment_sent'
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                                  : row.type === 'repair_offset'
                                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400'
                                  : row.type === 'repair_claim'
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                                  : row.type === 'sales_credit' || row.type === 'handover_holding' || row.type === 'manual_receivable'
                                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                  : row.type === 'payout_advance'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                                  : row.type === 'payment_received'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {row.type_label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-xs font-semibold text-slate-900 dark:text-white">
                            {row.context}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {row.payable !== 0 ? (
                              <span className={row.payable < 0 ? 'text-blue-600 dark:text-blue-400' : ''}>
                                {row.payable > 0 ? row.payable.toLocaleString(undefined, { minimumFractionDigits: 2 }) : `(${Math.abs(row.payable).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                            {row.receivable !== 0 ? (
                              <span className={row.receivable < 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                                {row.receivable > 0 ? row.receivable.toLocaleString(undefined, { minimumFractionDigits: 2 }) : `(${Math.abs(row.receivable).toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums">
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

          {/* Payment Remittance Instructions */}
          {business.bank_accounts && business.bank_accounts.length > 0 && isReceivable && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Payment Remittance Details
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Please transfer the outstanding balance to any of our official store accounts below and share the confirmation screenshot or reference:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                {business.bank_accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700"
                  >
                    <span className="text-[10px] font-bold text-slate-400 font-sans uppercase block">{acc.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                      {acc.account_number || 'Contact Cashier'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Signature & Notes */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-xs text-slate-400">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Official Financial Statement</span>
              </div>
              <p className="text-[10px] text-slate-400 max-w-sm">
                Generated automatically by HabeshaBiz Electronics ERP. Confidential partner accounting statement.
              </p>
            </div>

            <div className="sm:text-right space-y-4">
              <div className="w-48 border-b border-slate-300 dark:border-slate-700 pb-1 text-center font-mono text-[10px] text-slate-400">
                Authorized Signature / Stamp
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
