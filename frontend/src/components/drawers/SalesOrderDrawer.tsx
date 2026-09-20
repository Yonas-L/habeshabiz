import React, { useState } from 'react';
import type { SalesOrder, User } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { ProgressiveSection } from './ProgressiveSection';
import { AnimatedNumber } from '../AnimatedNumber';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Printer,
  ShoppingBag,
  ArrowRightLeft,
  CreditCard,
  UserCheck,
  FileText,
  Battery,
  Smartphone,
  Share2,
  CheckCircle2,
  Clock,
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
  const canViewCost = user?.can_view_costs ?? false;

  if (!order) return null;

  const totalProfit = order.items.reduce(
    (sum, i) => sum + parseFloat(String(i.profit || '0')),
    0
  );
  const isPaid = order.payment_status === 'paid';
  const remainingDebt = Math.max(
    0,
    parseFloat(String(order.total_amount)) - parseFloat(String(order.paid_amount))
  );

  const handleCopyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number);
    setCopiedId(true);
    toast.success('Order number copied to clipboard', { description: order.order_number });
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopySmsReceipt = () => {
    const itemsText = order.items
      .map((i) => `• ${i.quantity}x ${i.variant?.product?.name || 'Device'} (${i.variant?.storage || ''}) - ${Number(i.unit_price).toLocaleString()} ETB`)
      .join('\n');

    const receiptText = `HABESHABIZ / BOLE TECH RECEIPT
Order: ${order.order_number}
Date: ${new Date(order.order_date).toLocaleDateString()}
Customer: ${order.customer?.name || 'Walk-in Customer'}
----------------------
${itemsText}
----------------------
Total: ${Number(order.total_amount).toLocaleString()} ETB
Paid: ${Number(order.paid_amount).toLocaleString()} ETB
${remainingDebt > 0 ? `Remaining Due: ${remainingDebt.toLocaleString()} ETB\n` : ''}Payment Method: ${order.payment_method.toUpperCase()}
Status: ${isPaid ? 'PAID IN FULL' : 'CREDIT / UNPAID'}
Thank you for your business!`;

    navigator.clipboard.writeText(receiptText);
    setCopiedReceipt(true);
    toast.success('Customer receipt text copied', { description: 'Ready to paste in Telegram or SMS.' });
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={order.order_number}
      subtitle={`Recorded on ${new Date(order.order_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`}
      badge={
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isPaid
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
          }`}
        >
          {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {isPaid ? 'Fully Paid' : 'Credit Unpaid'}
        </span>
      }
      headerActions={
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopyOrderNumber}
            title="Copy Order #"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {copiedId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handlePrint}
            title="Print Receipt Voucher"
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
              onClick={handleCopySmsReceipt}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedReceipt ? 'Copied' : 'Share Voucher'}</span>
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
      {/* Hero Financial Amount Spotlight */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Total Selling Value
          </span>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight mt-1">
            <AnimatedNumber value={parseFloat(String(order.total_amount))} />{' '}
            <span className="text-sm font-bold text-slate-400 font-sans">ETB</span>
          </div>
        </div>

        <div className="text-right">
          {canViewCost && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Gross Profit
              </span>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                +<AnimatedNumber value={totalProfit} /> ETB
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progressive Section 1: Line Items Breakdown */}
      <ProgressiveSection
        title={`Line Items (${order.items.length})`}
        icon={<ShoppingBag className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          {order.items.map((item, idx) => {
            const isBrokered = item.sourcing_type === 'brokered_neighbour';
            const unit = item.inventory_unit;

            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      {item.quantity}x {item.variant?.product?.name || 'Device'}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                      {[item.variant?.storage, item.variant?.color].filter(Boolean).join(' • ') || 'Standard Spec'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-xs">
                      {Number(item.unit_price).toLocaleString()} ETB
                    </div>
                    {canViewCost && item.profit && (
                      <div className="font-mono tabular-nums text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        +{Number(item.profit).toLocaleString()} ETB
                      </div>
                    )}
                  </div>
                </div>

                {/* Hardware Attributes (IMEI, Battery, SIM) */}
                {(unit?.imei_or_serial || unit?.battery_health) && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-2 gap-2 text-[11px]">
                    {unit.imei_or_serial && (
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono">
                        <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{unit.imei_or_serial}</span>
                      </div>
                    )}

                    {unit.battery_health !== null && unit.battery_health !== undefined && (
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Battery className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Battery: <strong className="font-mono">{unit.battery_health}%</strong></span>
                        {unit.cycle_count ? <span className="text-[10px] text-slate-400">({unit.cycle_count}c)</span> : null}
                      </div>
                    )}
                  </div>
                )}

                {/* Sourcing Channel Badge */}
                <div className="flex items-center justify-between text-[11px]">
                  {isBrokered ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                      <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                      <span>Brokered from {item.vendor_contact?.name || 'Neighbour Shop'}</span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      Shop Stock
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ProgressiveSection>

      {/* Progressive Section 2: Settlement Trail & Financial Account */}
      <ProgressiveSection
        title="Payment & Settlement Trail"
        icon={<CreditCard className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
              Payment Method
            </span>
            <span className="font-bold text-slate-900 dark:text-white capitalize mt-0.5 block">
              {order.payment_method.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
              Amount Paid Upfront
            </span>
            <span className="font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
              {Number(order.paid_amount).toLocaleString()} ETB
            </span>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
              Customer Profile
            </span>
            <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
              {order.customer?.name || 'Walk-in Customer'}
            </span>
            {order.customer?.phone && (
              <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                {order.customer.phone}
              </span>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
              Sales Representative
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900 dark:text-white">
                {order.salesperson?.name || 'Shop Staff'}
              </span>
            </div>
          </div>
        </div>

        {remainingDebt > 0 && (
          <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 flex items-center justify-between text-xs">
            <span className="text-amber-800 dark:text-amber-300 font-medium">Remaining Customer Debt:</span>
            <span className="font-bold font-mono text-amber-900 dark:text-amber-200">
              {remainingDebt.toLocaleString()} ETB
            </span>
          </div>
        )}
      </ProgressiveSection>

      {/* Progressive Section 3: Digital Receipt Voucher */}
      <ProgressiveSection
        title="Thermal Receipt Voucher"
        icon={<FileText className="w-4 h-4" />}
        defaultOpen={false}
      >
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-dashed border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 space-y-3 animate-receipt">
          <div className="text-center border-b border-dashed border-slate-200 dark:border-slate-700 pb-2">
            <div className="font-black text-sm text-slate-900 dark:text-white">HABESHABIZ ELECTRONICS</div>
            <div className="text-[10px] text-slate-400">Bole Medhanialem • Addis Ababa</div>
            <div className="text-[10px] text-slate-400">Ref: {order.order_number}</div>
          </div>

          <div className="space-y-1 text-[11px]">
            {order.items.map((i, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{i.quantity}x {i.variant?.product?.name}</span>
                <span>{Number(i.unit_price).toLocaleString()} ETB</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span>{Number(order.total_amount).toLocaleString()} ETB</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>PAID</span>
              <span>{Number(order.paid_amount).toLocaleString()} ETB</span>
            </div>
            {remainingDebt > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>BALANCE DUE</span>
                <span>{remainingDebt.toLocaleString()} ETB</span>
              </div>
            )}
          </div>

          <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
            Official Merchant Record • Verified
          </div>
        </div>
      </ProgressiveSection>
    </SlideOverDrawer>
  );
};
