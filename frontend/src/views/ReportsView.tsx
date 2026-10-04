import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { BusinessReportData, Tenant } from '../api/client';
import { api, resolveImageUrl } from '../api/client';
import { downloadPdf } from '../utils/downloadPdf';
import {
  Download,
  Loader2,
  RefreshCw,
  ShieldAlert,
  DollarSign,
  Package,
  Users,
  Store,
  Wrench,
  Landmark,
  Scale,
  CheckCircle2,
  ChevronDown,
  FileDown,
} from 'lucide-react';

interface ReportsViewProps {
  tenant: Tenant | null;
  selectedMonth?: string;
}

type DatePreset = 'this_month' | 'last_month' | 'last_30' | 'last_7' | 'ytd' | 'custom';

const formatMoney = (amount: number) => `${Math.round(amount).toLocaleString()} ETB`;

const asDateInput = (date: Date) => date.toISOString().slice(0, 10);

const getMonthStart = (offset = 0) => {
  const date = new Date();
  date.setMonth(date.getMonth() + offset, 1);
  return asDateInput(date);
};

const getMonthRange = (month?: string): [string, string] => {
  const now = new Date();
  const [year, monthIndex] = (month || '').split('-').map(Number);
  const date = year && monthIndex ? new Date(year, monthIndex - 1, 1) : now;
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const isCurrentMonth = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

  return [
    asDateInput(date),
    isCurrentMonth ? asDateInput(now) : asDateInput(end),
  ];
};

const PdfBrandHeader: React.FC<{ tenant: Tenant | null; title: string }> = ({ tenant, title }) => {
  const logo = resolveImageUrl(tenant?.settings?.logo_url);

  return (
    <div data-pdf-brand className="hidden items-center justify-center gap-3 border-b border-slate-200 px-4 py-5 text-center">
      {logo && <img src={logo} alt="" className="h-10 w-10 rounded-lg object-contain" crossOrigin="anonymous" />}
      <div>
        <div className="text-base font-bold text-slate-950">{tenant?.name || 'HabeshaBiz'}</div>
        <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">{title}</div>
        <div className="mt-1 text-[10px] text-slate-400">Prepared {new Date().toLocaleDateString()}</div>
      </div>
    </div>
  );
};

const TableDownloadButton: React.FC<{ label: string; loading: boolean; onClick: () => void }> = ({ label, loading, onClick }) => (
  <button
    type="button"
    data-pdf-control
    aria-label={`Download ${label} PDF`}
    title={`Download ${label} PDF`}
    onClick={onClick}
    disabled={loading}
    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-slate-800 dark:hover:text-slate-200"
  >
    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
  </button>
);

export const ReportsView: React.FC<ReportsViewProps> = ({ tenant, selectedMonth }) => {
  const initialRange = getMonthRange(selectedMonth);
  const [from, setFrom] = useState(initialRange[0]);
  const [to, setTo] = useState(initialRange[1]);
  const [activePreset, setActivePreset] = useState<DatePreset>('this_month');
  const [report, setReport] = useState<BusinessReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingTable, setDownloadingTable] = useState<string | null>(null);
  const [lossDetailsOpen, setLossDetailsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const loadReport = useCallback(async (fromDate = from, toDate = to) => {
    if (fromDate > toDate) {
      setError('The start date must be before or equal to the end date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.getBusinessReport(fromDate, toDate);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'The financial report could not be generated.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const [monthFrom, monthTo] = getMonthRange(selectedMonth);
    setFrom(monthFrom);
    setTo(monthTo);
    setActivePreset('this_month');
    void loadReport(monthFrom, monthTo);
  }, [selectedMonth]);

  const downloadTable = async (elementId: string, label: string) => {
    setDownloadingTable(elementId);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await downloadPdf(
      elementId,
      `${tenant?.name || 'Business'}_${label}_${from}_to_${to}`.replace(/\s+/g, '_'),
      undefined,
      () => setDownloadingTable(null),
      { revealTableBranding: true, expandScrollAreas: true },
      () => setError('The table PDF could not be generated. Please try again.'),
    );
  };

  const handleApplyPreset = (preset: DatePreset) => {
    setActivePreset(preset);
    const now = new Date();
    let newFrom = from;
    let newTo = asDateInput(now);

    if (preset === 'this_month') {
      newFrom = getMonthStart(0);
      newTo = asDateInput(now);
    } else if (preset === 'last_month') {
      newFrom = asDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      newTo = asDateInput(new Date(now.getFullYear(), now.getMonth(), 0));
    } else if (preset === 'last_30') {
      const start = new Date();
      start.setDate(now.getDate() - 29);
      newFrom = asDateInput(start);
      newTo = asDateInput(now);
    } else if (preset === 'last_7') {
      const start = new Date();
      start.setDate(now.getDate() - 6);
      newFrom = asDateInput(start);
      newTo = asDateInput(now);
    } else if (preset === 'ytd') {
      newFrom = asDateInput(new Date(now.getFullYear(), 0, 1));
      newTo = asDateInput(now);
    }

    setFrom(newFrom);
    setTo(newTo);
    void loadReport(newFrom, newTo);
  };

  const handleCustomDateChange = (newFrom: string, newTo: string) => {
    setFrom(newFrom);
    setTo(newTo);
    setActivePreset('custom');
  };

  const filename = useMemo(() => `Business_Report_${from}_to_${to}`, [from, to]);
  const summary = report?.summary;

  // Staff totals
  const staffTotals = useMemo(() => {
    const list = report?.staff_performance || [];
    return {
      orders: list.reduce((acc, s) => acc + s.orders, 0),
      units: list.reduce((acc, s) => acc + s.units, 0),
      revenue: list.reduce((acc, s) => acc + s.revenue, 0),
      profit: list.reduce((acc, s) => acc + s.profit, 0),
    };
  }, [report?.staff_performance]);

  // Vendor totals
  const vendorTotals = useMemo(() => {
    const list = report?.vendor_activity.vendors || [];
    return {
      received: list.reduce((acc, v) => acc + v.received_units, 0),
      returned: list.reduce((acc, v) => acc + v.returned_units, 0),
      sold: list.reduce((acc, v) => acc + v.units_sold, 0),
      revenue: list.reduce((acc, v) => acc + v.revenue, 0),
    };
  }, [report?.vendor_activity.vendors]);

  const totalLiquidAndCustomAssets = report?.cash_position.total_liquidity_and_assets ?? (
    (report?.cash_position.cash_and_bank || 0) + (report?.cash_position.custom_assets || 0)
  );
  const netCapitalPosition = (report?.stock_position.owned_value || 0) + totalLiquidAndCustomAssets;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-16 animate-page-enter">
      {/* ─── Header & Actions ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Financial Report
            </h1>
            {summary && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-tight ${
                  summary.net_profit > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                    : summary.net_profit < 0
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-500/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    summary.net_profit > 0
                      ? 'bg-emerald-500 animate-pulse'
                      : summary.net_profit < 0
                      ? 'bg-rose-500 animate-pulse'
                      : 'bg-slate-400'
                  }`}
                />
                {summary.net_profit > 0
                  ? `In Profit: +${formatMoney(summary.net_profit)}`
                  : summary.net_profit < 0
                  ? `In Loss: −${formatMoney(Math.abs(summary.net_profit))}`
                  : 'Break-Even (0 ETB)'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {report?.period.label || 'Verified statements'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 print:hidden shrink-0">
          <button
            type="button"
            onClick={() => void loadReport(from, to)}
            disabled={loading}
            title="Refresh Report Data"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() =>
              void downloadPdf(
                'business-report-print',
                filename,
                () => setIsDownloading(true),
                () => setIsDownloading(false),
                { revealBranding: true, revealTableBranding: false, expandScrollAreas: true, paginateSections: false },
                () => setError('The report PDF could not be generated. Please try again.')
              )
            }
            disabled={!report || isDownloading || loading}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white px-3.5 text-xs font-bold text-white dark:text-slate-900 shadow-2xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isDownloading ? 'Downloading…' : 'Download Report'}</span>
          </button>
        </div>
      </div>

      {/* ─── Compact Range Selector Strip ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2 border-b border-slate-200/80 dark:border-slate-800/80 print:hidden text-xs">
        {/* Presets */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="font-semibold text-slate-400 dark:text-slate-500 mr-1.5 shrink-0">
            Period:
          </span>
          {(
            [
              ['this_month', 'This Month'],
              ['last_month', 'Last Month'],
              ['last_30', 'Last 30 Days'],
              ['last_7', 'Last 7 Days'],
              ['ytd', 'Year to Date'],
            ] as const
          ).map(([presetKey, label]) => {
            const isActive = activePreset === presetKey;
            return (
              <button
                key={presetKey}
                type="button"
                onClick={() => handleApplyPreset(presetKey)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Custom Pickers */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">From:</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => handleCustomDateChange(e.target.value, to)}
              className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131926] px-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>
          <span className="text-slate-400">→</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 uppercase font-semibold">To:</span>
            <input
              type="date"
              value={to}
              min={from}
              max={asDateInput(new Date())}
              onChange={(e) => handleCustomDateChange(from, e.target.value)}
              className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131926] px-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void loadReport(from, to)}
            disabled={loading}
            className="h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Run
          </button>
        </div>
      </div>

      {/* ─── Error Alert ─── */}
      {error && (
        <div className="flex items-center gap-2 border-y border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Loading Skeletons ─── */}
      {loading && !report ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="h-72 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
          <div className="h-72 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
          <div className="h-64 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
          <div className="h-64 rounded-xl bg-slate-200/60 dark:bg-slate-800/50 animate-skeleton" />
        </div>
      ) : report && summary ? (
        <article id="business-report-print" className="space-y-8 pt-1 print:space-y-6 print:bg-white print:text-slate-950">
          {/* Printable Formal Header */}
          <header data-pdf-header className="hidden border-b-2 border-slate-900 pb-4 print:block">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {resolveImageUrl(tenant?.settings?.logo_url) && (
                  <img src={resolveImageUrl(tenant?.settings?.logo_url) || undefined} alt="" className="h-12 w-12 rounded-lg object-contain" crossOrigin="anonymous" />
                )}
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-tight text-slate-950">
                    {tenant?.name || 'HabeshaBiz'} · Financial Performance Report
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Report Period: {report.period.label} ({report.period.from} to {report.period.to})
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>Generated: {new Date().toLocaleString()}</p>
                <div className="mt-1 flex items-center justify-end gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    summary.net_profit > 0
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : summary.net_profit < 0
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}>
                    {summary.net_profit > 0 ? 'Operating in Profit' : summary.net_profit < 0 ? 'Operating in Loss' : 'Break-Even'} ({formatMoney(summary.net_profit)})
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* ══════════════════════════════════════════════════════════════
              ROW 1: Sales Report & Capital Position (2 Columns)
             ══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 1. Sales Report */}
            <div id="report-sales-table" data-pdf-section className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926]">
              <PdfBrandHeader tenant={tenant} title="Sales & Revenue Report" />
              {/* Section Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Sales & Revenue Report
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.period.label}
                </span>
                <TableDownloadButton label="Sales and Revenue" loading={downloadingTable === 'report-sales-table'} onClick={() => void downloadTable('report-sales-table', 'Sales_and_Revenue')} />
              </div>

              {/* Table */}
              <div data-report-scroll className="h-[400px] overflow-auto print:h-auto print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-2 px-4">Line Item / Metric</th>
                    <th className="py-2 px-4 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Sales orders closed</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {summary.orders}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Units sold from inventory</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {summary.units_sold} units
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Average order value (AOV)</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(summary.average_order_value)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300 font-medium">Gross sales revenue</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(summary.revenue)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Customer receipts recorded</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(summary.customer_receipts)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Customer discounts allowed</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      {summary.discounts > 0 ? `−${formatMoney(summary.discounts)}` : '0 ETB'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Intentional price concessions / write-offs</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      {(summary.write_offs || 0) > 0 ? `−${formatMoney(summary.write_offs || 0)}` : '0 ETB'}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-700 dark:text-slate-200 font-semibold">Net sales after discounts and write-offs</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(summary.net_revenue ?? (summary.revenue - summary.discounts - (summary.write_offs || 0)))}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Profit after stock cost</td>
                    <td className={`py-2 px-4 text-right font-mono font-bold tabular-nums ${summary.gross_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {formatMoney(summary.gross_profit)}
                    </td>
                  </tr>
                  {summary.loss_making_items > 0 && (
                    <>
                      <tr className="bg-rose-50/50 dark:bg-rose-950/20">
                        <td colSpan={2} className="p-0">
                          <button
                            type="button"
                            onClick={() => setLossDetailsOpen((open) => !open)}
                            aria-expanded={lossDetailsOpen}
                            className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-rose-100/60 dark:hover:bg-rose-950/40"
                          >
                            <span className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${lossDetailsOpen ? 'rotate-180' : ''}`} />
                              <span>Below-cost units sold</span>
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                              {summary.loss_making_items} units · −{formatMoney(summary.loss_amount)}
                            </span>
                          </button>
                        </td>
                      </tr>
                      {lossDetailsOpen && summary.loss_items.map((item) => (
                        <tr key={item.id} className="bg-rose-50/30 text-[11px] dark:bg-rose-950/10">
                          <td className="py-2 pl-10 pr-4 text-rose-900 dark:text-rose-100">
                            <div className="font-medium">{item.product}</div>
                            <div className="mt-0.5 text-rose-700/70 dark:text-rose-300/70">
                              {item.imei_or_serial || item.order_number || 'Sale item'}{item.order_date ? ` · ${item.order_date}` : ''}
                            </div>
                          </td>
                          <td className="py-2 pl-2 pr-4 text-right font-mono tabular-nums text-rose-700 dark:text-rose-300">
                            <div>−{formatMoney(item.loss)}</div>
                            <div className="mt-0.5 text-[10px] text-rose-700/70 dark:text-rose-300/70">
                              {formatMoney(item.unit_price)} sale · {formatMoney(item.unit_cost)} cost
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Operating overhead expenses</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      {summary.operating_expenses > 0 ? `−${formatMoney(summary.operating_expenses)}` : '0 ETB'}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Transaction & gateway fees</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                      {summary.transaction_fees > 0 ? `−${formatMoney(summary.transaction_fees)}` : '0 ETB'}
                    </td>
                  </tr>
                </tbody>
                {/* Total Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-900 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/80 font-bold">
                    <td className="py-3 px-4 text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Net Operating Profit
                    </td>
                    <td className={`py-3 px-4 text-right font-mono text-sm tabular-nums ${
                      summary.net_profit >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatMoney(summary.net_profit)}
                    </td>
                  </tr>
                  {summary.owner_draws > 0 && (
                    <tr className="border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 bg-slate-50/30 dark:bg-slate-900/30">
                      <td className="py-2 px-4 italic">Separate: Owner equity drawings</td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                        {formatMoney(summary.owner_draws)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
              </div>
            </div>

            {/* 2. Capital & Inventory Position Report */}
            <div id="report-capital-table" data-pdf-section className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926]">
              <PdfBrandHeader tenant={tenant} title="Capital & Inventory Report" />
              {/* Section Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Capital & Inventory Report
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  As of {report.period.to}
                </span>
                <TableDownloadButton label="Capital and Inventory" loading={downloadingTable === 'report-capital-table'} onClick={() => void downloadTable('report-capital-table', 'Capital_and_Inventory')} />
              </div>

              {/* Table */}
              <div data-report-scroll className="h-[400px] overflow-auto print:h-auto print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-2 px-4">Position / Asset Area</th>
                    <th className="py-2 px-4 text-right">Current Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Shop-owned stock on shelf</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.stock_position.owned_units} devices
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300 font-medium">Shop-owned stock at cost</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(report.stock_position.owned_value)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Vendor consignment in custody</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.stock_position.vendor_units} devices
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Vendor consignment value</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                      {formatMoney(report.stock_position.vendor_value)}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300 font-medium">Cash + bank liquid holdings</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {formatMoney(report.cash_position.cash_and_bank)}
                    </td>
                  </tr>
                  {(report.cash_position.custom_assets || 0) > 0 && (
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-4 text-slate-600 dark:text-slate-300 font-medium">Custom assets (Gold / Forex)</td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                        {formatMoney(report.cash_position.custom_assets || 0)}
                      </td>
                    </tr>
                  )}
                  {/* Account specifics */}
                  {report.cash_position.accounts && report.cash_position.accounts.length > 0 ? (
                    report.cash_position.accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 text-[11px] text-slate-500">
                        <td className="py-1.5 px-4 pl-8">↳ {acc.name} ({acc.type.replace('_', ' ')})</td>
                        <td className="py-1.5 px-4 text-right font-mono tabular-nums">
                          {formatMoney(acc.balance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="text-[11px] text-slate-400 italic">
                      <td colSpan={2} className="py-2 px-4 pl-8">No bank or cash assets deposited in this period (0 ETB)</td>
                    </tr>
                  )}
                </tbody>
                {/* Total Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-900 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/80 font-bold">
                    <td className="py-3 px-4 text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Net Working Capital (Owned)
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatMoney(netCapitalPosition)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              ROW 2: Staff Performance & Vendor Activity (2 Columns)
             ══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 3. Staff Report */}
            <div id="report-staff-table" data-pdf-section className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926]">
              <PdfBrandHeader tenant={tenant} title="Staff Sales Report" />
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Staff Sales Report
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.staff_performance.length} sellers
                </span>
                <TableDownloadButton label="Staff Sales" loading={downloadingTable === 'report-staff-table'} onClick={() => void downloadTable('report-staff-table', 'Staff_Sales')} />
              </div>

              {/* Table */}
              <div data-report-scroll className="h-[360px] overflow-auto print:h-auto print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-2 px-4">Salesperson</th>
                    <th className="py-2 px-2 text-center">Orders</th>
                    <th className="py-2 px-2 text-center">Units</th>
                    <th className="py-2 px-3 text-right">Revenue</th>
                    <th className="py-2 px-4 text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {report.staff_performance.length > 0 ? (
                    report.staff_performance.map((staff) => (
                      <tr key={String(staff.user_id || staff.name)} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                          {staff.name}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {staff.orders}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {staff.units}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatMoney(staff.revenue)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatMoney(staff.profit)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                        No staff sales recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Total Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-900 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/80 font-bold">
                    <td className="py-2.5 px-4 text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                      Total Staff Production
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-900 dark:text-white">
                      {staffTotals.orders}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-900 dark:text-white">
                      {staffTotals.units}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatMoney(staffTotals.revenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatMoney(staffTotals.profit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>

            {/* 4. Vendor Activity Report */}
            <div id="report-vendor-table" data-pdf-section className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926]">
              <PdfBrandHeader tenant={tenant} title="Vendor Consignment Report" />
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Vendor Consignment Report
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.vendor_activity.vendors.length} vendors
                </span>
                <TableDownloadButton label="Vendor Consignment" loading={downloadingTable === 'report-vendor-table'} onClick={() => void downloadTable('report-vendor-table', 'Vendor_Consignment')} />
              </div>

              {/* Table */}
              <div data-report-scroll className="h-[360px] overflow-auto print:h-auto print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-2 px-4">Vendor Partner</th>
                    <th className="py-2 px-2 text-center">Inflow</th>
                    <th className="py-2 px-2 text-center">Returned</th>
                    <th className="py-2 px-2 text-center">Sold</th>
                    <th className="py-2 px-4 text-right">Realized Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {report.vendor_activity.vendors.length > 0 ? (
                    report.vendor_activity.vendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                          {vendor.name}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          {vendor.received_units}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono tabular-nums text-rose-600 dark:text-rose-400">
                          {vendor.returned_units}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                          {vendor.units_sold}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                          {formatMoney(vendor.revenue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                        No vendor consignment movement recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Total Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-900 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/80 font-bold">
                    <td className="py-2.5 px-4 text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                      Total Vendor Movement
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-slate-900 dark:text-white">
                      {vendorTotals.received}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-rose-600 dark:text-rose-400">
                      {vendorTotals.returned}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {vendorTotals.sold}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatMoney(vendorTotals.revenue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════════════════════════
              ROW 3: Repairs & Accounts Ledger (2 Columns)
             ══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* 5. Repair Report */}
            <div id="report-repair-table" data-pdf-section className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926]">
              <PdfBrandHeader tenant={tenant} title="Repair & Maintenance Report" />
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Repair & Maintenance Report
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.period.label}
                </span>
                <TableDownloadButton label="Repair and Maintenance" loading={downloadingTable === 'report-repair-table'} onClick={() => void downloadTable('report-repair-table', 'Repair_and_Maintenance')} />
              </div>

              {/* Table */}
              <div data-report-scroll className="h-[300px] overflow-auto print:h-auto print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-2 px-4">Maintenance Area</th>
                    <th className="py-2 px-4 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Defects / customer returns reported</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.repairs.reported_count} units
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Serviced repair jobs completed</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {report.repairs.repaired_count} units
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-300">Resolution fulfillment rate</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                      {report.repairs.reported_count > 0
                        ? `${Math.round((report.repairs.repaired_count / report.repairs.reported_count) * 100)}%`
                        : '100% (No defects)'}
                    </td>
                  </tr>
                </tbody>
                {/* Total Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-900 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/80 font-bold">
                    <td className="py-3 px-4 text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Total Repair Expenditure
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                      {formatMoney(report.repairs.repair_expense)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>

            {/* 6. Cash & Account Holdings Ledger */}
            <div id="report-accounts-table" data-pdf-section className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926]">
              <PdfBrandHeader tenant={tenant} title="Accounts & Liquidity Ledger" />
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Accounts & Liquidity Ledger
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {report.cash_position.accounts?.length || 0} ledgers
                </span>
                <TableDownloadButton label="Accounts and Liquidity" loading={downloadingTable === 'report-accounts-table'} onClick={() => void downloadTable('report-accounts-table', 'Accounts_and_Liquidity')} />
              </div>

              {/* Table */}
              <div data-report-scroll className="h-[360px] overflow-auto print:h-auto print:overflow-visible">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                    <th className="py-2 px-4">Financial Account</th>
                    <th className="py-2 px-2">Account Type</th>
                    <th className="py-2 px-4 text-right">Reconciled Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {/* Liquid accounts (cash, bank, mobile_money) */}
                  {(() => {
                    const liquidAccs = report.cash_position.accounts?.filter(a => !a.is_custom_asset) || [];
                    const customAccs = report.cash_position.accounts?.filter(a => a.is_custom_asset) || [];
                    return (
                      <>
                        {liquidAccs.length > 0 ? liquidAccs.map((acc) => (
                          <tr key={acc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                            <td className="py-2 px-4 font-medium text-slate-900 dark:text-white">{acc.name}</td>
                            <td className="py-2 px-2 text-[10px] uppercase font-bold text-slate-400">{acc.type.replace('_', ' ')}</td>
                            <td className="py-2 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">{formatMoney(acc.balance)}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={3} className="py-4 text-center text-slate-400 italic text-[11px]">
                              No liquid accounts in this period
                            </td>
                          </tr>
                        )}
                        {/* Subtotal: Liquid */}
                        <tr className="border-t border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                          <td colSpan={2} className="py-2 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Subtotal Cash + Bank</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">{formatMoney(report.cash_position.cash_and_bank)}</td>
                        </tr>
                        {/* Custom asset accounts */}
                        {customAccs.length > 0 && (
                          <>
                            {customAccs.map((acc) => (
                              <tr key={acc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                                <td className="py-2 px-4 font-medium text-amber-700 dark:text-amber-400">{acc.name}</td>
                                <td className="py-2 px-2 text-[10px] uppercase font-bold text-amber-500/70">{acc.type.replace('_', ' ')}</td>
                                <td className="py-2 px-4 text-right font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">{formatMoney(acc.balance)}</td>
                              </tr>
                            ))}
                            <tr className="border-t border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                              <td colSpan={2} className="py-2 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Subtotal Custom Assets</td>
                              <td className="py-2 px-4 text-right font-mono font-bold text-amber-700 dark:text-amber-400 tabular-nums">{formatMoney(report.cash_position.custom_assets || 0)}</td>
                            </tr>
                          </>
                        )}
                      </>
                    );
                  })()}
                </tbody>
                {/* Grand Total Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-900 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/80 font-bold">
                    <td colSpan={2} className="py-3 px-4 text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                      Total Holdings (Liquid + Assets)
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatMoney(report.cash_position.total_liquidity_and_assets ?? report.cash_position.cash_and_bank)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              </div>
            </div>
          </section>

          {/* ─── Assets, Liabilities & Net Position ─── */}
          {report.financial_position && (
            <section data-pdf-section className="max-w-4xl mx-auto w-full pt-6 print:pt-8">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926] shadow-2xs">
                <PdfBrandHeader tenant={tenant} title="Financial Position" />
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Financial Position</h2>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Assets minus currently unpaid obligations as of {report.period.to}.</p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Balance sheet view</span>
                </div>
                <div className="grid gap-5 p-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Assets</p>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      <div className="flex justify-between gap-4 py-2 text-xs"><span className="text-slate-600 dark:text-slate-300">Cash and bank</span><span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{formatMoney(report.financial_position.assets.cash_and_bank)}</span></div>
                      <div className="flex justify-between gap-4 py-2 text-xs"><span className="text-slate-600 dark:text-slate-300">Owned inventory</span><span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{formatMoney(report.financial_position.assets.owned_stock)}</span></div>
                      <div className="flex justify-between gap-4 py-2 text-xs"><span className="text-slate-600 dark:text-slate-300">Customer receivables</span><span className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(report.financial_position.assets.customer_receivables)}</span></div>
                      <div className="flex justify-between gap-4 border-t border-slate-200 py-2.5 text-xs font-bold dark:border-slate-700"><span className="text-slate-900 dark:text-white">Total assets</span><span className="font-mono tabular-nums text-slate-900 dark:text-white">{formatMoney(report.financial_position.assets.total)}</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Liabilities</p>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      <div className="flex justify-between gap-4 py-2 text-xs"><span className="text-slate-600 dark:text-slate-300">Open payables</span><span className="font-mono font-semibold tabular-nums text-rose-700 dark:text-rose-400">{formatMoney(report.financial_position.liabilities.open_payables)}</span></div>
                      <div className="flex justify-between gap-4 py-2 text-xs"><span className="text-slate-600 dark:text-slate-300">Payable records</span><span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{report.financial_position.liabilities.open_payable_count}</span></div>
                      <div className="flex justify-between gap-4 border-t border-slate-200 py-2.5 text-xs font-bold dark:border-slate-700"><span className="text-slate-900 dark:text-white">Net position</span><span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoney(report.financial_position.net_position)}</span></div>
                    </div>
                  </div>
                </div>
                {report.financial_position.liabilities.payables.length > 0 && (
                  <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Outstanding obligations</p>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {report.financial_position.liabilities.payables.map((payable) => (
                        <div key={payable.id} className="flex items-center justify-between gap-4 py-2 text-xs"><span className="min-w-0 truncate text-slate-600 dark:text-slate-300">{payable.contact} · {payable.reference_type.replaceAll('_', ' ')}</span><span className="shrink-0 font-mono font-semibold tabular-nums text-rose-700 dark:text-rose-400">{formatMoney(payable.remaining_amount)}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">{report.financial_position.consignment_note}</p>
              </div>
            </section>
          )}

          {/* ─── Bottom Cash & Financial Balance Reconciliation Table ─── */}
          {report.reconciliation && (
            <div data-pdf-section className="max-w-3xl mx-auto w-full pt-4 print:pt-6">
              <div id="report-reconciliation-table" className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#131926] shadow-2xs">
                <PdfBrandHeader tenant={tenant} title="Balance Reconciliation Ledger" />
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Balance Reconciliation Ledger
                    </h2>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    report.reconciliation.is_reconciled
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/20'
                      : 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-500/20'
                  }`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${report.reconciliation.is_reconciled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
                    {report.reconciliation.is_reconciled
                      ? `Cash Ledger Reconciled (${formatMoney(report.reconciliation.variance)} variance)`
                      : `Discrepancy: ${formatMoney(Math.abs(report.reconciliation.variance))}`}
                  </span>
                  <TableDownloadButton label="Balance Reconciliation" loading={downloadingTable === 'report-reconciliation-table'} onClick={() => void downloadTable('report-reconciliation-table', 'Balance_Reconciliation')} />
                </div>

                {/* Table */}
                <div data-report-scroll className="h-[420px] overflow-auto print:h-auto print:overflow-visible">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/40">
                      <th className="py-2 px-4">Financial Flow / Reconciliation Item</th>
                      <th className="py-2 px-3 text-center">Effect</th>
                      <th className="py-2 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {/* Opening Balance */}
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                        Opening balance (start of period)
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-400">
                        Base
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatMoney(report.reconciliation.opening_balance)}
                      </td>
                    </tr>

                    {/* Capital deposits */}
                    {report.reconciliation.capital_deposits > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                          Capital deposits / opening bank deposits
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-emerald-600 font-bold">
                          + Inflow
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{formatMoney(report.reconciliation.capital_deposits)}
                        </td>
                      </tr>
                    )}

                    {/* Customer collections */}
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                        Sales receipts & customer collections
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-[10px] text-emerald-600 font-bold">
                        + Inflow
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{formatMoney(report.reconciliation.customer_collections)}
                      </td>
                    </tr>

                    {/* Borrowed funds */}
                    {report.reconciliation.borrowed_funds > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                          External debt / borrowed capital receipts
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-emerald-600 font-bold">
                          + Inflow
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{formatMoney(report.reconciliation.borrowed_funds)}
                        </td>
                      </tr>
                    )}

                    {/* Other direct income */}
                    {report.reconciliation.other_income > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                          Other direct income
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-emerald-600 font-bold">
                          + Inflow
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{formatMoney(report.reconciliation.other_income)}
                        </td>
                      </tr>
                    )}

                    {/* Supplier payments */}
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                        Supplier payments & inventory disbursements
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-[10px] text-rose-600 font-bold">
                        − Outflow
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        −{formatMoney(report.reconciliation.supplier_payments)}
                      </td>
                    </tr>

                    {/* Operating expenses */}
                    {report.reconciliation.operating_expenses > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                          Operating overhead expenses
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-rose-600 font-bold">
                          − Outflow
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                          −{formatMoney(report.reconciliation.operating_expenses)}
                        </td>
                      </tr>
                    )}

                    {/* Owner draws */}
                    {report.reconciliation.owner_draws > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                          Owner equity drawings (withdrawals)
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-amber-600 font-bold">
                          − Outflow
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                          −{formatMoney(report.reconciliation.owner_draws)}
                        </td>
                      </tr>
                    )}

                    {/* Loan disbursements */}
                    {report.reconciliation.loan_disbursements > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                          Loan disbursements / extended receivables
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-rose-600 font-bold">
                          − Outflow
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                          −{formatMoney(report.reconciliation.loan_disbursements)}
                        </td>
                      </tr>
                    )}

                    {/* Transaction fees */}
                    {report.reconciliation.transaction_fees > 0 && (
                      <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-4 text-slate-600 dark:text-slate-300">
                          Transaction & gateway banking fees
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[10px] text-rose-600 font-bold">
                          − Outflow
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                          −{formatMoney(report.reconciliation.transaction_fees)}
                        </td>
                      </tr>
                    )}

                    {/* Closing Balance */}
                    <tr className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 bg-slate-50/40 dark:bg-slate-900/40">
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                        Closing liquid balance (end of period)
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-400">
                        Actual
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {formatMoney(report.reconciliation.closing_balance)}
                      </td>
                    </tr>
                  </tbody>

                  {/* Total Reconciliation Row */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-900 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/80 font-bold">
                      <td colSpan={2} className="py-3 px-4 text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        Reconciliation Difference (Opening + Inflows − Outflows − Closing)
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatMoney(report.reconciliation.variance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                </div>
              </div>
            </div>
          )}

          {/* Printable Signature & Endorsement Block */}
          <footer data-pdf-footer className="hidden pt-12 border-t-2 border-slate-900 print:block">
            <div className="grid grid-cols-2 gap-12 text-xs">
              <div>
                <p className="font-bold text-slate-900">Prepared & Approved By:</p>
                <div className="mt-8 border-b border-slate-400 w-48" />
                <p className="mt-1 text-slate-600 font-semibold">{tenant?.name || 'HabeshaBiz'} Management</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">Official Stamp / Date:</p>
                <div className="mt-8 border-b border-slate-400 w-48 ml-auto" />
                <p className="mt-1 text-slate-600">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </footer>
        </article>
      ) : null}
    </div>
  );
};
