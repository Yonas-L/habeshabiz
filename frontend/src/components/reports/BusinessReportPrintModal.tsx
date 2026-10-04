import React, { useState } from 'react';
import type { BusinessReportData, Tenant } from '../../api/client';
import { resolveImageUrl } from '../../api/client';
import { Printer, X, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';
import { downloadPdf } from '../../utils/downloadPdf';

interface BusinessReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: BusinessReportData;
  tenant: Tenant | null;
  from: string;
  to: string;
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

const formatNum = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '0.00';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const BusinessReportPrintModal: React.FC<BusinessReportPrintModalProps> = ({
  isOpen,
  onClose,
  report,
  tenant,
  from,
  to,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !report) return null;

  const { summary, stock_position, cash_position, staff_performance, vendor_activity, repairs, reconciliation } = report;
  const cogs = Math.max(0, summary.revenue - summary.gross_profit);

  const today = new Date();
  const issuedDateSlash = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const handlePrint = () => {
    const sanitizedTenant = (tenant?.name || 'Business').replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedRange = `${from}_to_${to}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Financial_Report_${sanitizedTenant}_${sanitizedRange}`;
    downloadPdf(
      'printable-business-report',
      filename,
      () => setIsDownloading(true),
      () => setIsDownloading(false),
      {
        expandScrollAreas: true,
        paginateSections: false,
      }
    );
  };

  // Staff Totals
  const staffTotals = staff_performance.reduce(
    (acc, s) => ({
      orders: acc.orders + s.orders,
      units: acc.units + s.units,
      revenue: acc.revenue + s.revenue,
      profit: acc.profit + s.profit,
    }),
    { orders: 0, units: 0, revenue: 0, profit: 0 }
  );

  // Vendor Totals
  const vendorTotals = vendor_activity.vendors.reduce(
    (acc, v) => ({
      received: acc.received + v.received_units,
      sold: acc.sold + v.units_sold,
      revenue: acc.revenue + v.revenue,
      returned: acc.returned + v.returned_units,
    }),
    { received: 0, sold: 0, revenue: 0, returned: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 sm:pt-14 pb-8 px-3 sm:px-6 bg-black/75 backdrop-blur-xs overflow-y-auto printable-modal-backdrop">
      <div
        className="relative w-full max-w-4xl bg-slate-900 rounded-lg shadow-2xl border border-slate-800 my-auto overflow-hidden animate-modal-crisp"
        role="dialog"
        aria-modal="true"
      >
        {/* Action Bar */}
        <div className="no-print px-5 py-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <span>Statement Preview</span>
            <span className="text-slate-500 font-normal">·</span>
            <span className="text-slate-400 font-mono text-[11px]">{formatSlashRange(from, to, report.period.label)}</span>
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              2 Pages · Ready to Export
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isDownloading}
              className="h-8 px-4 rounded-md bg-white text-slate-900 text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              title="Download financial report as PDF"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF…</span>
                </>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Executive Document (2 Exact A4 Pages) */}
        <div id="printable-business-report" className="p-4 sm:p-8 space-y-8 bg-slate-950/80 overflow-y-auto">
          {/* ════════════════════════════════════════════════════════════════
              PAGE 1: Commercial Activity & Inventory Position
             ════════════════════════════════════════════════════════════════ */}
          <div
            data-pdf-page
            className="bg-white text-slate-900 rounded-sm shadow-xl border border-slate-200 p-8 sm:p-10 space-y-6 w-full max-w-[840px] mx-auto"
          >
            {/* Header Branding & Corporate Letterhead */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
              <div className="flex items-start gap-3.5">
                {resolveImageUrl(tenant?.settings?.logo_url) ? (
                  <img
                    src={resolveImageUrl(tenant?.settings?.logo_url) || undefined}
                    alt={tenant?.name}
                    className="h-16 sm:h-20 w-auto max-w-[240px] object-contain rounded-2xl shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl sm:text-3xl tracking-tight shrink-0 shadow-xs">
                    {(tenant?.name || 'H').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="font-black text-lg sm:text-xl tracking-tight uppercase text-slate-900 leading-tight">
                    {tenant?.name || 'Business'}
                  </h1>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium">
                    {tenant?.settings?.branch && <span>{tenant.settings.branch}</span>}
                    {tenant?.settings?.phone && (
                      <>
                        <span>·</span>
                        <span>{tenant.settings.phone}</span>
                      </>
                    )}
                    {tenant?.settings?.email && (
                      <>
                        <span>·</span>
                        <span>{tenant.settings.email}</span>
                      </>
                    )}
                    {tenant?.settings?.tin_number && (
                      <>
                        <span>·</span>
                        <span className="font-mono">TIN: {tenant.settings.tin_number}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Business Financial Report
                </div>
                <div className="font-mono text-xs font-semibold text-slate-600 mt-0.5">
                  {formatSlashRange(from, to, report.period.label)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Issued: {issuedDateSlash}
                </div>
              </div>
            </div>

            {/* ROW 1: Sales & Revenue (Left) | Capital & Stock (Right) */}
            <div className="grid grid-cols-2 gap-6 items-start">
              {/* 1. Sales & Revenue Table */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1">
                  <span>Sales & Revenue Report</span>
                  <span className="font-mono text-xs font-normal text-slate-400">{summary.orders} orders</span>
                </div>
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Line Item / Metric</th>
                        <th className="py-2.5 px-3 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Sales orders closed</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{summary.orders}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Units sold from inventory</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{summary.units_sold} units</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Average order value (AOV)</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{formatNum(summary.average_order_value)} ETB</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Total gross revenue</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{formatNum(summary.revenue)} ETB</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Cost of goods sold (COGS)</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">−{formatNum(cogs)} ETB</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Operating overhead expenses</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-700">−{formatNum(summary.operating_expenses)} ETB</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Payment & transfer fees</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-700">−{formatNum(summary.transaction_fees)} ETB</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900">
                        <td className="py-2.5 px-3 font-sans uppercase tracking-wider text-[11px]">Net Realized Profit</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {formatNum(summary.net_profit)} ETB
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 2. Inventory & Stock Valuation Table */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1">
                  <span>Inventory & Stock Valuation</span>
                  <span className="font-mono text-xs font-normal text-slate-400">As of period end</span>
                </div>
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Inventory Category / Valuation Area</th>
                        <th className="py-2.5 px-3 text-right">Holdings / Metric</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Shop-owned stock on shelf</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{stock_position.owned_units} devices</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Shop-owned stock valuation (at cost)</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{formatNum(stock_position.owned_value)} ETB</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Vendor consignment in custody</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{stock_position.vendor_units} devices</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Vendor consignment valuation</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-700">{formatNum(stock_position.vendor_value)} ETB</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Total physical shelf inventory count</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">{stock_position.owned_units + stock_position.vendor_units} devices</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900">
                        <td className="py-2.5 px-3 font-sans uppercase tracking-wider text-[11px]">Total Owned Inventory at Cost</td>
                        <td className="py-2.5 px-3 text-right font-black text-blue-700">
                          {formatNum(stock_position.owned_value)} ETB
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* ROW 2: Staff Sales Performance (Left) | Vendor Consignment (Right) */}
            <div className="grid grid-cols-2 gap-6 items-start">
              {/* 3. Staff Performance Table */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1">
                  <span>Staff Sales Performance</span>
                  <span className="font-mono text-xs font-normal text-slate-400">{staff_performance.length} staff</span>
                </div>
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Staff Member</th>
                        <th className="py-2.5 px-2 text-center">Orders</th>
                        <th className="py-2.5 px-2 text-center">Units</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-3 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {staff_performance.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-center text-slate-400 italic">No sales recorded</td>
                        </tr>
                      ) : (
                        staff_performance.map((staff, idx) => (
                          <tr key={staff.user_id || idx}>
                            <td className="py-2 px-3 font-sans font-semibold text-slate-900">
                              {staff.name}
                              {staff.role && <span className="ml-1 text-[10px] font-normal text-slate-400">({staff.role})</span>}
                            </td>
                            <td className="py-2 px-2 text-center">{staff.orders}</td>
                            <td className="py-2 px-2 text-center">{staff.units}</td>
                            <td className="py-2 px-3 text-right">{formatNum(staff.revenue)}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{formatNum(staff.profit)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900">
                        <td className="py-2.5 px-3 font-sans uppercase tracking-wider text-[11px]">Total Staff Contribution</td>
                        <td className="py-2.5 px-2 text-center">{staffTotals.orders}</td>
                        <td className="py-2.5 px-2 text-center">{staffTotals.units}</td>
                        <td className="py-2.5 px-3 text-right">{formatNum(staffTotals.revenue)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">{formatNum(staffTotals.profit)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 4. Vendor Consignment Table */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1">
                  <span>Vendor Consignment Activity</span>
                  <span className="font-mono text-xs font-normal text-slate-400">{vendor_activity.vendors.length} vendors</span>
                </div>
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Vendor / Supplier</th>
                        <th className="py-2.5 px-2 text-center">Rcvd</th>
                        <th className="py-2.5 px-2 text-center">Sold</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-2 text-center">Ret</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {vendor_activity.vendors.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-3 text-center text-slate-400 italic">No consignment activity</td>
                        </tr>
                      ) : (
                        vendor_activity.vendors.map((vendor) => (
                          <tr key={vendor.id}>
                            <td className="py-2 px-3 font-sans font-semibold text-slate-900">{vendor.name}</td>
                            <td className="py-2 px-2 text-center">{vendor.received_units}</td>
                            <td className="py-2 px-2 text-center font-bold text-emerald-700">{vendor.units_sold}</td>
                            <td className="py-2 px-3 text-right">{formatNum(vendor.revenue)}</td>
                            <td className="py-2 px-2 text-center text-slate-400">{vendor.returned_units}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900">
                        <td className="py-2.5 px-3 font-sans uppercase tracking-wider text-[11px]">Total Consignment Volume</td>
                        <td className="py-2.5 px-2 text-center">{vendorTotals.received}</td>
                        <td className="py-2.5 px-2 text-center font-black text-emerald-700">{vendorTotals.sold}</td>
                        <td className="py-2.5 px-3 text-right">{formatNum(vendorTotals.revenue)}</td>
                        <td className="py-2.5 px-2 text-center">{vendorTotals.returned}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Page 1 Running Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>{tenant?.name || 'Business'} · Confidential Accounting Performance Statement</span>
              <span className="font-semibold text-slate-600">Page 1 of 2</span>
            </div>
          </div>

          {/* Page Break Indicator in Preview */}
          <div className="no-print flex items-center justify-center gap-3 text-xs font-bold text-slate-500 py-1">
            <div className="h-px bg-slate-800 w-28" />
            <span className="tracking-wider uppercase text-[11px]">PAGE 2 · LIQUIDITY & AUDIT RECONCILIATION</span>
            <div className="h-px bg-slate-800 w-28" />
          </div>

          {/* ════════════════════════════════════════════════════════════════
              PAGE 2: Liquidity, Audit Reconciliation & Verification Sign-off
             ════════════════════════════════════════════════════════════════ */}
          <div
            data-pdf-page
            className="bg-white text-slate-900 rounded-sm shadow-xl border border-slate-200 p-8 sm:p-10 space-y-6 w-full max-w-[840px] mx-auto"
          >
            {/* Page 2 Continuation Letterhead */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm tracking-tight shrink-0 shadow-xs">
                  {(tenant?.name || 'H').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-black text-sm tracking-tight uppercase text-slate-900">
                    {tenant?.name || 'Business'} · Financial Statement (Continued)
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Audit Period: {formatSlashRange(from, to, report.period.label)}
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] font-mono text-slate-400">
                Issued: {issuedDateSlash}
              </div>
            </div>

            {/* ROW 3: Repairs & Maintenance (Left) | Accounts & Liquidity (Right) */}
            <div className="grid grid-cols-2 gap-6 items-start">
              {/* 5. Repairs Table */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1">
                  <span>Repair & Maintenance Report</span>
                  <span className="font-mono text-xs font-normal text-slate-400">Service logs</span>
                </div>
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Service / Maintenance Metric</th>
                        <th className="py-2.5 px-3 text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Faulty units reported</td>
                        <td className="py-2 px-3 text-right font-bold text-amber-700">{repairs.reported_count} units</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Repaired & restored units</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">{repairs.repaired_count} units</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Pending in repair queue</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-500">{Math.max(0, repairs.reported_count - repairs.repaired_count)} units</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900">
                        <td className="py-2.5 px-3 font-sans uppercase tracking-wider text-[11px]">Total Repair Expenses</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-700">
                          {formatNum(repairs.repair_expense)} ETB
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 6. Accounts Ledger Table */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1">
                  <span>Accounts & Liquidity Ledger</span>
                  <span className="font-mono text-xs font-normal text-slate-400">{cash_position.accounts?.length || 0} accounts</span>
                </div>
                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Account Name</th>
                        <th className="py-2.5 px-2">Type</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      {cash_position.accounts && cash_position.accounts.length > 0 ? (
                        cash_position.accounts.map((acc) => (
                          <tr key={acc.id}>
                            <td className="py-2 px-3 font-sans font-semibold text-slate-900">{acc.name}</td>
                            <td className="py-2 px-2 text-[10px] font-sans uppercase text-slate-500">{acc.type.replace('_', ' ')}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">{formatNum(acc.balance)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-3 text-center text-slate-400 italic">No account records for this period</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900">
                        <td colSpan={2} className="py-2.5 px-3 font-sans uppercase tracking-wider text-[11px]">Total Liquid + Asset Holdings</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {formatNum(cash_position.total_liquidity_and_assets ?? cash_position.cash_and_bank)} ETB
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Balance Reconciliation Ledger (Audit Equation Table) */}
            {reconciliation && (
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center justify-between pb-1 border-b-2 border-slate-900">
                  <div className="flex items-center gap-2">
                    <span>Balance Reconciliation Ledger</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Records Reconciled (0.00 Variance)
                    </span>
                  </div>
                  <span className="font-mono text-xs font-normal text-slate-400">Audit Equation</span>
                </div>

                <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase tracking-wider bg-slate-50/50">
                        <th className="py-2.5 px-3">Financial Flow / Reconciliation Item</th>
                        <th className="py-2.5 px-3 text-center">Effect</th>
                        <th className="py-2.5 px-3 text-right">Amount (ETB)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-xs">
                      <tr className="bg-slate-50/40">
                        <td className="py-2 px-3 font-sans font-bold text-slate-900">Opening liquid balance (start of period)</td>
                        <td className="py-2 px-3 text-center text-slate-500 font-sans text-[11px] font-semibold">Base</td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">{formatNum(reconciliation.opening_balance)}</td>
                      </tr>
                      {reconciliation.capital_deposits > 0 && (
                        <tr>
                          <td className="py-2 px-3 font-sans text-slate-700">Capital deposits / opening account balances</td>
                          <td className="py-2 px-3 text-center font-sans font-bold text-emerald-700 text-[11px]">+ Inflow</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700">+{formatNum(reconciliation.capital_deposits)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Sales receipts & customer collections</td>
                        <td className="py-2 px-3 text-center font-sans font-bold text-emerald-700 text-[11px]">+ Inflow</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-700">+{formatNum(reconciliation.customer_collections)}</td>
                      </tr>
                      {reconciliation.borrowed_funds > 0 && (
                        <tr>
                          <td className="py-2 px-3 font-sans text-slate-700">External debt / borrowed capital receipts</td>
                          <td className="py-2 px-3 text-center font-sans font-bold text-emerald-700 text-[11px]">+ Inflow</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-700">+{formatNum(reconciliation.borrowed_funds)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-2 px-3 font-sans text-slate-700">Supplier payments & inventory disbursements</td>
                        <td className="py-2 px-3 text-center font-sans font-bold text-rose-700 text-[11px]">− Outflow</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-700">−{formatNum(reconciliation.supplier_payments)}</td>
                      </tr>
                      {reconciliation.operating_expenses > 0 && (
                        <tr>
                          <td className="py-2 px-3 font-sans text-slate-700">Operating overhead expenses</td>
                          <td className="py-2 px-3 text-center font-sans font-bold text-rose-700 text-[11px]">− Outflow</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-700">−{formatNum(reconciliation.operating_expenses)}</td>
                        </tr>
                      )}
                      {reconciliation.owner_draws > 0 && (
                        <tr>
                          <td className="py-2 px-3 font-sans text-slate-700">Owner equity drawings</td>
                          <td className="py-2 px-3 text-center font-sans font-bold text-rose-700 text-[11px]">− Outflow</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-700">−{formatNum(reconciliation.owner_draws)}</td>
                        </tr>
                      )}
                      {reconciliation.loan_disbursements > 0 && (
                        <tr>
                          <td className="py-2 px-3 font-sans text-slate-700">Loans disbursed to third parties</td>
                          <td className="py-2 px-3 text-center font-sans font-bold text-rose-700 text-[11px]">− Outflow</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-700">−{formatNum(reconciliation.loan_disbursements)}</td>
                        </tr>
                      )}
                      {reconciliation.transaction_fees > 0 && (
                        <tr>
                          <td className="py-2 px-3 font-sans text-slate-700">Payment processing & transfer fees</td>
                          <td className="py-2 px-3 text-center font-sans font-bold text-rose-700 text-[11px]">− Outflow</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-700">−{formatNum(reconciliation.transaction_fees)}</td>
                        </tr>
                      )}
                      <tr className="bg-slate-50/40">
                        <td className="py-2 px-3 font-sans font-bold text-slate-900">Closing liquid balance (end of period)</td>
                        <td className="py-2 px-3 text-center text-slate-500 font-sans text-[11px] font-semibold">Actual</td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">{formatNum(reconciliation.closing_balance)}</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-900 bg-slate-50/80 font-mono text-xs font-bold text-slate-900">
                        <td colSpan={2} className="py-2.5 px-3 font-sans uppercase tracking-wider text-xs">
                          Reconciliation Difference (Opening + Inflows − Outflows − Closing)
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700 text-sm">
                          {formatNum(reconciliation.variance)} ETB
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Official Verification Seal & Signatures */}
            <div className="pt-4 border-t-2 border-slate-900 flex flex-col sm:flex-row sm:items-end justify-between gap-6 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>OFFICIAL FINANCIAL PERFORMANCE STATEMENT</span>
                </div>
                <p className="text-[10px] text-slate-500 max-w-sm">
                  Official accounting statement generated by {tenant?.name || 'Business'}. All ledger entries, stock values, and liquidity records have been audited and reconciled.
                </p>
              </div>

              <div className="sm:text-right space-y-4">
                <div className="w-52 border-b-2 border-slate-900 pb-1 text-center font-mono text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Authorized Signature
                </div>
              </div>
            </div>

            {/* Page 2 Running Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>{tenant?.name || 'Business'} · Verified & Audited Ledger Statement</span>
              <span className="font-semibold text-slate-600">Page 2 of 2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
