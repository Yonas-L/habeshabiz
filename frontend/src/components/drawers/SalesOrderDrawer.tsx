import React, { useState } from 'react';
import type { SalesOrder, User } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Printer,
  Share2,
  CheckCircle2,
  Clock,
  Smartphone,
  Battery,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Lock,
  ArrowRightLeft,
  Download,
  ReceiptText,
} from 'lucide-react';

interface SalesOrderDrawerProps {
  order: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onCollectPayment?: (order: SalesOrder) => void;
}

export const SalesOrderDrawer: React.FC<SalesOrderDrawerProps> = ({
  order,
  isOpen,
  onClose,
  user,
  onCollectPayment,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedImei, setCopiedImei] = useState<string | null>(null);
  const [showInternalAudit, setShowInternalAudit] = useState(false);

  if (!order) return null;

  const canViewCost = user?.can_view_costs ?? false;

  const grossAmount = parseFloat(String(order.total_amount)) || 0;
  const discountAmount = parseFloat(String(order.discount_amount || '0')) || 0;
  const netPayable = Math.max(0, grossAmount - discountAmount);
  const paidAmount = parseFloat(String(order.paid_amount)) || 0;
  const remainingDebt = Math.max(0, netPayable - paidAmount);
  const isPaid = order.payment_status === 'paid' || remainingDebt === 0;

  const totalProfit = order.items.reduce(
    (sum, i) => sum + parseFloat(String(i.profit || '0')),
    0
  );

  // Date and time formatting
  const orderDateObj = new Date(order.order_date);
  const isValidDate = !isNaN(orderDateObj.getTime());
  const formattedDate = isValidDate
    ? orderDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : order.order_date;
  const formattedTime = isValidDate
    ? orderDateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const formatPaymentMethod = (method: string) => {
    const map: Record<string, string> = {
      telebirr: 'Telebirr',
      cbe_birr: 'CBE Birr',
      cash: 'Cash on Hand',
      bank_transfer: 'Bank Transfer (CBE/Awash)',
      amole: 'Amole',
      credit: 'Customer Credit',
    };
    return map[method.toLowerCase()] || method.replace(/_/g, ' ').toUpperCase();
  };

  const formatCondition = (cond?: string) => {
    if (!cond) return null;
    const map: Record<string, string> = {
      new: 'Brand New (Sealed)',
      used_like_new: 'Like New (Grade A+)',
      grade_a: 'Grade A',
      grade_b: 'Grade B',
      refurbished: 'Refurbished',
      fair: 'Fair Condition',
    };
    return map[cond.toLowerCase()] || cond.replace(/_/g, ' ');
  };

  const formatSimType = (sim?: string) => {
    if (!sim || sim === 'na') return null;
    const map: Record<string, string> = {
      physical: 'Physical SIM',
      esim: 'eSIM Only',
      dual: 'Dual SIM',
    };
    return map[sim.toLowerCase()] || sim;
  };

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    setCopiedId(true);
    toast.success('Order reference copied', { description: order.order_number });
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyImei = (imei: string) => {
    navigator.clipboard.writeText(imei);
    setCopiedImei(imei);
    toast.success('Hardware IMEI copied', { description: imei });
    setTimeout(() => setCopiedImei(null), 2000);
  };

  const generateReceiptText = () => {
    const itemsText = order.items
      .map((item, index) => {
        const unit = item.inventory_unit;
        const imeiText = unit?.imei_or_serial ? `\n   IMEI/Serial: ${unit.imei_or_serial}` : '';
        const batteryText = unit?.battery_health ? ` | Battery: ${unit.battery_health}%` : '';
        const spec = [item.variant?.storage, item.variant?.color].filter(Boolean).join(' • ');
        const specText = spec ? ` (${spec})` : '';
        return `${index + 1}. ${item.quantity}x ${item.variant?.product?.name || 'Device'}${specText}${imeiText}${batteryText}\n   Price: ${Number(item.unit_price).toLocaleString()} ETB`;
      })
      .join('\n\n');

    return `========================================
HABESHABIZ ELECTRONICS
Bole Medhanialem • Addis Ababa
Tel: +251 91 123 4567 / +251 90 987 6543
========================================
OFFICIAL SALES INVOICE & RECEIPT
Ref: ${order.order_number}
Date: ${formattedDate} ${formattedTime}
Customer: ${order.customer?.name || 'Walk-in Customer'} ${order.customer?.phone ? `(${order.customer.phone})` : ''}
Sales Attendant: ${order.salesperson?.name || 'Habeshabiz Sales Staff'}
Payment Method: ${formatPaymentMethod(order.payment_method)}
Status: ${isPaid ? 'PAID IN FULL' : 'CREDIT / UNPAID'}
========================================
ITEMS PURCHASED:
${itemsText}
========================================
Subtotal: ${grossAmount.toLocaleString()} ETB
${discountAmount > 0 ? `Discount: -${discountAmount.toLocaleString()} ETB\n` : ''}Total Net Amount: ${netPayable.toLocaleString()} ETB
Amount Paid: ${paidAmount.toLocaleString()} ETB
${remainingDebt > 0 ? `Balance Due: ${remainingDebt.toLocaleString()} ETB\n` : ''}========================================
WARRANTY & TERMS:
• 7 Days Testing Warranty on internal hardware.
• Valid receipt and matching IMEI required for warranty claims.
• Physical/water damage voids warranty.

Thank you for choosing Habeshabiz Electronics!
========================================`;
  };

  const handleCopyReceipt = () => {
    const text = generateReceiptText();
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    toast.success('Invoice & Receipt copied to clipboard', {
      description: 'Ready to share on Telegram, WhatsApp, or SMS.',
    });
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const handleDownloadReceipt = () => {
    const text = generateReceiptText();
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Habeshabiz-Receipt-${order.order_number}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('Receipt file downloaded', { description: `Habeshabiz-Receipt-${order.order_number}.txt` });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      widthClass="sm:max-w-2xl"
      title="Sales Invoice & Receipt"
      subtitle={`HABESHABIZ ELECTRONICS • Ref: ${order.order_number}`}
      badge={
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isPaid
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
          }`}
        >
          {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {isPaid ? 'Paid in Full' : 'Credit Unpaid'}
        </span>
      }
      headerActions={
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyReceipt}
            title="Copy Sharable Receipt"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {copiedReceipt ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handlePrint}
            title="Print Official Slip"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      }
      footerActions={
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedReceipt ? 'Receipt Copied!' : 'Share Receipt'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadReceipt}
              title="Download Slip Text"
              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isPaid && onCollectPayment && (
              <button
                type="button"
                onClick={() => onCollectPayment(order)}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
              >
                <span>Collect Balance ({remainingDebt.toLocaleString()} ETB)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </button>
          </div>
        </>
      }
    >
      {/* Printable Invoice & Receipt Document */}
      <div
        id="printable-invoice"
        className="p-6 sm:p-7 rounded-2xl bg-white dark:bg-[#101622] border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-6 animate-receipt"
      >
        {/* Company Header & Ref Stamp */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center text-white shadow-xs font-black text-sm tracking-tight">
                <ReceiptText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase font-sans">
                  HABESHABIZ ELECTRONICS
                </h1>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Bole Medhanialem • Addis Ababa
                </p>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium pl-11 pt-0.5 space-y-0.5">
              <div>Tel: +251 91 123 4567 • +251 90 987 6543</div>
              <div>Bole Sub-City, Commercial Hub • TIN: 0048291045</div>
            </div>
          </div>

          <div className="sm:text-right flex flex-col sm:items-end justify-between">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isPaid
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60'
              }`}
            >
              {isPaid ? 'Official Receipt & Invoice' : 'Credit Sales Invoice'}
            </span>

            <div className="mt-2 space-y-0.5">
              <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 dark:text-white">
                <span>Ref: {order.order_number}</span>
                <button
                  type="button"
                  onClick={handleCopyOrderNumber}
                  title="Copy Reference"
                  className="no-print p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Date: {formattedDate} {formattedTime && `• ${formattedTime}`}
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Billing Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-slate-50/90 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
              Billed To (Customer)
            </span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {order.customer?.name || 'Walk-in Customer'}
            </div>
            {order.customer?.phone && (
              <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                {order.customer.phone}
              </div>
            )}
            <div className="text-slate-400 text-[11px] mt-0.5">
              Addis Ababa, Ethiopia
            </div>
          </div>

          <div className="space-y-1.5 sm:text-right flex flex-col sm:items-end justify-center">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Payment Method:
              </span>
              <span className="ml-1.5 font-bold text-slate-800 dark:text-slate-200 uppercase font-mono">
                {formatPaymentMethod(order.payment_method)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Payment Status:
              </span>
              <span
                className={`ml-1.5 font-bold uppercase text-[11px] ${
                  isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {isPaid ? 'Paid in Full' : 'Outstanding Balance'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Sales Attendant:
              </span>
              <span className="ml-1.5 font-semibold text-slate-700 dark:text-slate-300">
                {order.salesperson?.name || 'Habeshabiz Sales Team'}
              </span>
            </div>
          </div>
        </div>

        {/* Itemized Invoice Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                <th className="py-2.5 px-2 w-8 text-center">#</th>
                <th className="py-2.5 px-2">Item & Description</th>
                <th className="py-2.5 px-2 text-center w-12">Qty</th>
                <th className="py-2.5 px-2 text-right">Unit Price</th>
                <th className="py-2.5 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {order.items.map((item, idx) => {
                const unit = item.inventory_unit;
                const specString = [item.variant?.storage, item.variant?.color]
                  .filter(Boolean)
                  .join(' • ');
                const conditionStr = formatCondition(unit?.condition);
                const simStr = formatSimType(unit?.sim_type);
                const lineTotal = item.quantity * (parseFloat(String(item.unit_price)) || 0);

                return (
                  <tr key={item.id || idx} className="align-top">
                    <td className="py-3 px-2 text-center text-slate-400 font-mono text-[11px]">
                      {String(idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-bold text-slate-900 dark:text-white text-xs">
                        {item.variant?.product?.name || 'Device'}
                      </div>

                      {specString && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {specString}
                        </div>
                      )}

                      {/* Hardware identifiers (IMEI, Battery, SIM, Condition) */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {unit?.imei_or_serial && (
                          <button
                            type="button"
                            onClick={() => handleCopyImei(unit.imei_or_serial!)}
                            title="Click to copy IMEI"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-200/60 dark:border-slate-700 hover:border-emerald-500 transition-colors"
                          >
                            <Smartphone className="w-3 h-3 text-slate-400" />
                            <span>IMEI: {unit.imei_or_serial}</span>
                            {copiedImei === unit.imei_or_serial ? (
                              <Check className="w-2.5 h-2.5 text-emerald-600 ml-0.5" />
                            ) : null}
                          </button>
                        )}

                        {unit?.battery_health !== null && unit?.battery_health !== undefined && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200/50 dark:border-emerald-800/40">
                            <Battery className="w-3 h-3 text-emerald-600" />
                            <span>Batt: {unit.battery_health}%</span>
                            {unit.cycle_count ? (
                              <span className="text-[9px] opacity-75">({unit.cycle_count}c)</span>
                            ) : null}
                          </span>
                        )}

                        {simStr && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                            {simStr}
                          </span>
                        )}

                        {conditionStr && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">
                            {conditionStr}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-2 text-center font-mono text-slate-700 dark:text-slate-300 font-bold">
                      {item.quantity}
                    </td>

                    <td className="py-3 px-2 text-right font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                      {Number(item.unit_price).toLocaleString()} ETB
                    </td>

                    <td className="py-3 px-2 text-right font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                      {lineTotal.toLocaleString()} ETB
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Invoice Summary & Official Verification Stamp */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-6 items-end">
          {/* Official Verification Seal & Signatures */}
          <div className="sm:col-span-6 space-y-3">
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-emerald-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5">
                  <span>Habeshabiz Verified</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                </div>
                <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                  Genuine Device Record • Bole Medhanialem
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 space-y-1 font-mono pt-1">
              <div>Authorized By: {order.salesperson?.name || 'Authorized Cashier'}</div>
              <div>Habeshabiz Digital Verification • Addis Ababa</div>
            </div>
          </div>

          {/* Financial Calculation Totals */}
          <div className="sm:col-span-6 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span className="font-medium">Subtotal</span>
              <span className="font-mono tabular-nums font-semibold">{grossAmount.toLocaleString()} ETB</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400">
                <span className="font-medium">Special Discount</span>
                <span className="font-mono tabular-nums font-semibold">
                  -{discountAmount.toLocaleString()} ETB
                </span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-baseline">
              <span className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                Total Net Amount
              </span>
              <span className="font-black font-mono text-base text-slate-900 dark:text-white tabular-nums">
                {netPayable.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
              </span>
            </div>

            <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1">
              <span className="font-medium">Amount Received</span>
              <span className="font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">
                {paidAmount.toLocaleString()} ETB
              </span>
            </div>

            <div className="flex justify-between pt-1 font-bold">
              <span className={remainingDebt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {remainingDebt > 0 ? 'Balance Remaining Due' : 'Balance Status'}
              </span>
              <span
                className={`font-mono tabular-nums ${
                  remainingDebt > 0
                    ? 'text-amber-700 dark:text-amber-400 text-sm font-black'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {remainingDebt > 0 ? `${remainingDebt.toLocaleString()} ETB` : '0 ETB (PAID IN FULL)'}
              </span>
            </div>
          </div>
        </div>

        {/* Warranty, Terms & Return Policy */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
          <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Store Warranty & Policy Terms</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            <li>
              <strong>7 Days Testing Warranty:</strong> Covers internal motherboard & factory hardware defects.
            </li>
            <li>
              <strong>Exclusions:</strong> Water exposure, physical drop damage, screen cracking, or unauthorized repairs void warranty.
            </li>
            <li>
              <strong>Requirements:</strong> Retain this official receipt and matching IMEI for any warranty or replacement requests.
            </li>
          </ul>
          <div className="text-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800/50 font-medium">
            Thank you for choosing Habeshabiz Electronics! • Bole Medhanialem, Addis Ababa
          </div>
        </div>
      </div>

      {/* Staff Only: Internal Cost, Profit & Sourcing Audit (Discreet Collapsible, Never Printed) */}
      {canViewCost && (
        <div className="no-print border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/60 dark:bg-slate-900/30 transition-all">
          <button
            type="button"
            onClick={() => setShowInternalAudit(!showInternalAudit)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Internal Management Audit (Staff Only)</span>
            </span>
            <span className="flex items-center gap-2 font-mono text-emerald-600 dark:text-emerald-400">
              <span>Gross Margin: +{totalProfit.toLocaleString()} ETB</span>
              {showInternalAudit ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </span>
          </button>

          {showInternalAudit && (
            <div className="p-4 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2.5 text-xs animate-collapse-open">
              <div className="text-[11px] text-slate-400 mb-2">
                This internal audit data is confidential and excluded from customer receipts and printable slips.
              </div>
              {order.items.map((item, idx) => {
                const isBrokered = item.sourcing_type === 'brokered_neighbour';
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-white dark:bg-[#131926] border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3 text-[11px]"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {item.variant?.product?.name}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                        {isBrokered ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <ArrowRightLeft className="w-3 h-3" />
                            Brokered from {item.vendor_contact?.name || 'Neighbour Shop'}
                          </span>
                        ) : (
                          <span className="text-slate-500">Shop Internal Stock</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      {item.unit_cost && (
                        <div className="text-slate-400 text-[10px]">
                          Cost: {Number(item.unit_cost).toLocaleString()} ETB
                        </div>
                      )}
                      {item.profit && (
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          Profit: +{Number(item.profit).toLocaleString()} ETB
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </SlideOverDrawer>
  );
};
