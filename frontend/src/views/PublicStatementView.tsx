import React, { useState, useEffect } from 'react';
import type { PartnerStatementData } from '../api/client';
import { api } from '../api/client';
import {
  Printer,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface PublicStatementViewProps {
  token: string;
}

type DateRangeOption = 'all' | 'this_month' | 'last_month' | 'last_30_days';

export const PublicStatementView: React.FC<PublicStatementViewProps> = ({ token }) => {
  const [data, setData] = useState<PartnerStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateOption, setDateOption] = useState<DateRangeOption>('all');

  const loadStatement = async () => {
    try {
      setLoading(true);
      setError(null);
      let startDate: string | undefined;
      let endDate: string | undefined;

      const now = new Date();
      if (dateOption === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (dateOption === 'last_month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      } else if (dateOption === 'last_30_days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      }

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
  }, [token, dateOption]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
          <p className="text-xs text-slate-500 font-medium">Loading official partner statement...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Unable to Load Statement</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
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

  return (
    <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Floating Controls Bar (No-print) */}
        <div className="no-print p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Official Partner Statement
            </span>
            <span className="text-[11px] text-slate-400">· Read-Only Portal</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setDateOption('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  dateOption === 'all'
                    ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                All Time
              </button>
              <button
                onClick={() => setDateOption('this_month')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  dateOption === 'this_month'
                    ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setDateOption('last_month')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  dateOption === 'last_month'
                    ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Last Month
              </button>
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
              className="h-8 px-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Print document or download as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print or Download PDF</span>
            </button>
          </div>
        </div>

        {/* The Printable Paper Document */}
        <div id="printable-statement" className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-[#111724] border border-slate-200/90 dark:border-slate-800 shadow-xl space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain border border-slate-200/80 dark:border-slate-800 p-1 bg-white shrink-0 shadow-2xs"
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-lg sm:text-xl shrink-0 shadow-2xs">
                  {(business.name || 'H').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-black text-lg tracking-tight uppercase text-slate-900 dark:text-white leading-tight">
                  {business.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {business.branch} · {business.phone}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                  <span>{business.email}</span>
                  {business.tin_number && (
                    <>
                      <span>·</span>
                      <span>TIN: {business.tin_number}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:text-right">
              <div className="inline-block px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider uppercase">
                Account Statement
              </div>
              <div className="text-xs text-slate-400 mt-1.5">
                Date: {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Contact & Scope */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Statement For</span>
              <span className="font-bold text-slate-900 dark:text-white mt-0.5 block truncate text-sm">
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
            className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              isReceivable
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60'
                : isPayable
                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-800/60'
                : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                NET TOTAL (STATEMENT RANGE)
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md">
                {isReceivable
                  ? `Payment Reminder: You have an outstanding balance to be settled with ${business.name}.`
                  : isPayable
                  ? `We currently have a payable balance owed to you.`
                  : `All transactions are currently settled for this statement period.`}
              </p>
            </div>
            <div className="sm:text-right font-mono">
              <div
                className={`text-3xl font-black tabular-nums tracking-tight ${
                  isReceivable
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isPayable
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {isReceivable ? '+' : isPayable ? '−' : ''}
                {Math.abs(netTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-bold text-slate-400 font-sans ml-1.5">ETB</span>
              </div>
            </div>
          </div>

          {/* Transaction Breakdown Table */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Transaction Breakdown</span>
              <span className="font-mono text-[10px] text-slate-400 font-normal">
                {ledger.length} entries
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200/90 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Context / Description</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Payable</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Receivable</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans italic">
                        No transactions recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((row) => (
                      <tr key={row.id}>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Remittance Details */}
          {business.bank_accounts && business.bank_accounts.length > 0 && isReceivable && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Store Wire / Remittance Accounts
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Please transfer your settlement to any of our official accounts and forward the transaction reference:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                {business.bank_accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700"
                  >
                    <span className="text-[10px] font-bold text-slate-400 font-sans uppercase block">{acc.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white block mt-0.5">
                      {acc.account_number || 'Direct Transfer'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Badge */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Official Statement · Generated by {business.name} ERP</span>
              </div>
              {business.footer_note && (
                <p className="text-[10px] text-slate-400 max-w-sm">
                  {business.footer_note}
                </p>
              )}
            </div>
            <div className="font-mono text-[10px]">
              {business.phone}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
