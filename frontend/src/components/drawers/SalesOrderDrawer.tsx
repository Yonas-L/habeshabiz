import React, { useState, useEffect, useMemo } from 'react';
import type { SalesOrder, User, FinancialAccount, InventoryUnit, Tenant } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Printer,
  Share2,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Lock,
  ArrowRightLeft,
  DollarSign,
  Loader2,
  X,
  Repeat,
  Undo2,
  ArrowLeftRight,
} from 'lucide-react';
import { SwapDeviceModal } from '../inventory/SwapDeviceModal';
import { downloadPdf } from '../../utils/downloadPdf';
import { SplitPaymentSelector, type PaymentSplitItem } from '../common/SplitPaymentSelector';

interface SalesOrderDrawerProps {
  order: SalesOrder | null;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  tenant?: Tenant | null;
  accounts?: FinancialAccount[];
  onPaymentCollected?: (updatedOrder: SalesOrder) => void;
  onInitiateReturn?: (order: SalesOrder) => void;
  onInitiateSwap?: (order: SalesOrder) => void;
}

export const SalesOrderDrawer: React.FC<SalesOrderDrawerProps> = ({
  order: initialOrder,
  isOpen,
  onClose,
  user,
  tenant,
  accounts,
  onPaymentCollected,
  onInitiateReturn,
  onInitiateSwap,
}) => {
  const [order, setOrder] = useState<SalesOrder | null>(initialOrder);
  const [internalAccounts, setInternalAccounts] = useState<FinancialAccount[]>(accounts || []);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedImei, setCopiedImei] = useState<string | null>(null);
  const [showInternalAudit, setShowInternalAudit] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Warranty Swap state
  const [swapUnitTarget, setSwapUnitTarget] = useState<InventoryUnit | null>(null);
  const [showMultiSwapPicker, setShowMultiSwapPicker] = useState(false);

  // Collection modal state
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectAccountId, setCollectAccountId] = useState('');
  const [isCollectSplit, setIsCollectSplit] = useState(false);
  const [collectSplits, setCollectSplits] = useState<PaymentSplitItem[]>([]);
  const [collectRef, setCollectRef] = useState('');
  const [collectNotes, setCollectNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      setInternalAccounts(accounts);
      const active = accounts.filter((a) => !a.is_custom_asset && a.is_active !== false);
      if (active.length > 0) {
        setCollectAccountId((prev) => prev || active[0].id);
      }
    } else if (isOpen) {
      api.getAccounts().then((res) => {
        const treasury = res.treasury_accounts || [];
        setInternalAccounts(treasury);
        const active = treasury.filter((a) => !a.is_custom_asset && a.is_active !== false);
        if (active.length > 0) {
          setCollectAccountId((prev) => prev || active[0].id);
        }
      }).catch(() => {});
    }
  }, [accounts, isOpen]);

  const isOwner = user?.role === 'owner';
  const canManageInv = isOwner || !!user?.can_manage_inventory || !!user?.permissions?.can_manage_inventory;

  const swappableUnits = useMemo(() => {
    if (!order) return [];
    return order.items
      .filter((item) => item.inventory_unit && item.inventory_unit.status === 'sold')
      .map((item) => {
        const u = item.inventory_unit!;
        return {
          ...u,
          variant_id: u.variant_id || item.variant_id,
          variant: u.variant || item.variant,
          cost_basis: u.cost_basis ?? (item.unit_cost !== undefined ? item.unit_cost : undefined),
          sales_order_item: {
            ...item,
            sales_order: order,
          },
        };
      });
  }, [order]);

  if (!order) return null;

  const canViewCost = user?.can_view_costs ?? false;

  const grossAmount = parseFloat(String(order.total_amount)) || 0;
  const discountAmount = parseFloat(String(order.discount_amount || '0')) || 0;
  const writeOffAmount = parseFloat(String(order.write_off_amount || '0')) || 0;
  const exchangeAllowance = parseFloat(String(order.exchange_allowance || '0')) || 0;
  const netPayable = Math.max(0, grossAmount - discountAmount - exchangeAllowance);
  const paidAmount = parseFloat(String(order.paid_amount)) || 0;
  const remainingDebt = Math.max(0, netPayable - paidAmount - writeOffAmount);
  const isRefunded = order.payment_status === 'refunded' || (order.items.length > 0 && order.items.every((i) => i.inventory_unit?.status === 'returned' || i.inventory_unit?.status === 'returned_to_vendor'));
  const isOffset = order.payment_method === 'debt_offset';
  const isB2B = isOffset || (order.customer?.roles?.some((r: string) => ['peer_vendor', 'vendor', 'supplier', 'partner'].includes(r)) ?? false);
  const isPaid = !isRefunded && (order.payment_status === 'paid' || remainingDebt === 0);
  const settledSaleValue = Math.max(0, netPayable - writeOffAmount);

  const sanitizeOrderNotes = (notes?: string | null) => {
    if (!notes) return null;
    return notes
      .replace(/\[unit_id:[a-zA-Z0-9_-]+\]/gi, '')
      .split('\n')
      .map((line) => {
        const segments = line.split('|').map((s) => s.trim()).filter(Boolean);
        return Array.from(new Set(segments)).join(' · ');
      })
      .filter(Boolean)
      .join('\n');
  };

  const itemProfit = order.items.reduce(
    (sum, i) => sum + parseFloat(String(i.profit || '0')),
    0
  );
  const totalProfit = itemProfit - discountAmount - writeOffAmount;

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
      bank_transfer: 'Bank Transfer',
      amole: 'Amole',
      credit: 'Customer Credit',
    };
    return map[method.toLowerCase()] || method.replace(/_/g, ' ').toUpperCase();
  };

  const formatCondition = (cond?: string) => {
    if (!cond) return null;
    const map: Record<string, string> = {
      new: 'Brand New',
      used_clean: 'Grade A Clean',
      used_like_new: 'Like New',
      grade_a: 'Grade A',
      grade_b: 'Grade B',
      refurbished: 'Refurbished',
      fair: 'Fair',
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

  const handleOpenCollect = () => {
    if (!order) return;
    const rem = Math.max(0, netPayable - paidAmount);
    setCollectAmount(rem > 0 ? rem.toString() : '');
    const activeAccounts = internalAccounts.filter((a) => !a.is_custom_asset && a.is_active !== false);
    if (activeAccounts.length > 0) {
      setCollectAccountId((prev) => (prev && activeAccounts.some((a) => a.id === prev) ? prev : activeAccounts[0].id));
    }
    setIsCollectSplit(false);
    setCollectSplits([]);
    setCollectRef('');
    setCollectNotes('');
    setShowCollectModal(true);
  };

  const handleConfirmCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const amt = parseFloat(collectAmount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid payment amount.');
      return;
    }

    if (isCollectSplit) {
      const totalAllocated = collectSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      if (Math.abs(totalAllocated - amt) > 0.01) {
        toast.error(`Split amounts (${totalAllocated.toLocaleString()} ETB) must equal total collection (${amt.toLocaleString()} ETB)`);
        return;
      }
      if (collectSplits.length === 0 || collectSplits.some((s) => !s.financial_account_id || s.amount <= 0)) {
        toast.error('All split accounts must have a valid account and amount greater than 0');
        return;
      }
    } else {
      if (!collectAccountId) {
        toast.error('Please select an account to deposit funds.');
        return;
      }
    }

    try {
      setSubmittingPayment(true);
      const res = await api.collectSalesPayment(order.id, {
        amount: amt,
        financial_account_id: isCollectSplit ? undefined : collectAccountId,
        payment_splits: isCollectSplit ? collectSplits : undefined,
        reference_number: collectRef.trim() || undefined,
        notes: collectNotes.trim() || undefined,
      });

      toast.success('Payment Collected', {
        description: `Successfully recorded ${amt.toLocaleString()} ETB for Order #${order.order_number}.`,
      });

      setOrder(res.data);
      setShowCollectModal(false);
      if (onPaymentCollected) onPaymentCollected(res.data);
    } catch (err: any) {
      toast.error('Failed to collect payment', { description: err.message });
    } finally {
      setSubmittingPayment(false);
    }
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
        const isExchanged = unit?.source_type === 'exchange' || Boolean(unit?.exchange_sales_order_id);
        const tagText = isExchanged ? ' - Exchanged' : '';
        const imeiText = unit?.imei_or_serial ? `\n   SN: ${unit.imei_or_serial}` : '';
        const batteryText = unit?.battery_health ? ` · ${unit.battery_health}% Batt` : '';
        const spec = [item.variant?.storage, item.variant?.color].filter(Boolean).join(' · ');
        const specText = spec ? ` - ${spec}` : '';
        const receiptUnitPrice = order.items.length === 1
          ? settledSaleValue / Math.max(1, Number(item.quantity || 1))
          : Number(item.unit_price);
        return `${index + 1}. ${item.quantity}x ${item.variant?.product?.name || 'Device'}${specText}${tagText}${imeiText}${batteryText}\n   ${receiptUnitPrice.toLocaleString()} ETB`;
      })
      .join('\n\n');

    const headerTitle = isB2B ? 'B2B TRADE & DEBT OFFSET VOUCHER' : 'OFFICIAL SALES INVOICE & RECEIPT';
    const customerLabel = isB2B ? 'Trade Partner' : 'Customer';
    const statusText = isRefunded
      ? 'REFUNDED / RETURNED'
      : isPaid && isOffset
      ? 'SETTLED VIA OFFSET'
      : isPaid
      ? 'PAID IN FULL'
      : 'CREDIT DUE';

    return `========================================
HABESHABIZ ELECTRONICS
Bole Medhanialem • Addis Ababa
Tel: +251 91 123 4567
========================================
${headerTitle}
Ref: ${order.order_number}
Date: ${formattedDate} ${formattedTime}
${customerLabel}: ${order.customer?.name || (isB2B ? 'Trade Partner' : 'Walk-in Customer')} ${order.customer?.phone ? `• ${order.customer.phone}` : ''}
Sales Attendant: ${order.salesperson?.name || 'Habeshabiz Sales Staff'}
Payment Method: ${formatPaymentMethod(order.payment_method)}
Status: ${statusText}
========================================
ITEMS TRANSACTED:
${itemsText}
========================================
Subtotal: ${grossAmount.toLocaleString()} ETB
${discountAmount > 0 ? `Discount: -${discountAmount.toLocaleString()} ETB\n` : ''}${writeOffAmount > 0 ? `Intentional Price Concession: -${writeOffAmount.toLocaleString()} ETB\n` : ''}${exchangeAllowance > 0 ? `Exchanged Device: ${exchangeAllowance.toLocaleString()} ETB\n` : ''}${exchangeAllowance > 0 ? 'Cash Difference to Pay' : 'Final Agreed Value'}: ${settledSaleValue.toLocaleString()} ETB
Amount Paid: ${paidAmount.toLocaleString()} ETB
${remainingDebt > 0 ? `Balance Due: ${remainingDebt.toLocaleString()} ETB\n` : ''}========================================
${isB2B ? `B2B SETTLEMENT NOTICE:
• Transacted as mutual partner trade / debt offset.
• Subject to standard bilateral trade & defect agreements.` : `WARRANTY & TERMS:
• 7 Days Testing Warranty on internal hardware.
• Valid receipt and matching IMEI required for warranty claims.
• Physical or water damage voids warranty.`}

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

  const handlePrint = async () => {
    if (!order?.id) return;
    const filename = `Invoice_${order.order_number}`;
    try {
      setIsDownloadingPdf(true);
      const blob = await api.downloadSalesInvoicePdf(order.id);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${filename}.pdf`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success('Vector Invoice PDF downloaded', {
        description: `Official document for #${order.order_number} saved.`,
      });
    } catch (err) {
      console.warn('Backend vector PDF download failed, falling back to client-side capture:', err);
      // Seamless client-side fallback
      await downloadPdf(
        'printable-invoice',
        filename,
        undefined,
        undefined,
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <>
      <SlideOverDrawer
        isOpen={isOpen}
        onClose={onClose}
        widthClass="sm:max-w-2xl"
        title={`Order #${order.order_number}`}
        subtitle={`${formattedDate}${formattedTime ? ` • ${formattedTime}` : ''}`}
        badge={
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              isRefunded
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                : writeOffAmount > 0
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                : isPaid && isOffset
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60'
                : isPaid
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
            }`}
          >
            {isRefunded ? (
              <Undo2 className="w-3 h-3 shrink-0" />
            ) : isPaid && isOffset ? (
              <ArrowLeftRight className="w-3 h-3 shrink-0" />
            ) : isPaid ? (
              <CheckCircle2 className="w-3 h-3 shrink-0" />
            ) : (
              <Clock className="w-3 h-3 shrink-0" />
            )}
            <span>
              {isRefunded
                ? 'Refunded / Returned'
                : writeOffAmount > 0
                ? 'Concession Settled'
                : isPaid && isOffset
                ? 'Settled (B2B Offset)'
                : isPaid
                ? 'Paid in Full'
                : 'Credit Due'}
            </span>
          </span>
        }
        headerActions={
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyReceipt}
              title="Copy Sharable Receipt"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copiedReceipt ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePrint}
              disabled={isDownloadingPdf}
              title="Download invoice as PDF"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            </button>
          </div>
        }
        footerActions={
          <div className="w-full">
            {/* Desktop Action Row (≥ sm): Clean aligned buttons */}
            <div className="hidden sm:flex sm:items-center sm:justify-between sm:w-full gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Share2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>{copiedReceipt ? 'Copied' : 'Share Receipt'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {canManageInv && swappableUnits.length > 0 && onInitiateReturn && (
                  <button
                    type="button"
                    onClick={() => {
                      if (order) onInitiateReturn(order);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                    title="Process customer return"
                  >
                    <Undo2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Return</span>
                  </button>
                )}

                {canManageInv && swappableUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onInitiateSwap && order) {
                        onInitiateSwap(order);
                      } else if (swappableUnits.length === 1) {
                        setSwapUnitTarget(swappableUnits[0]);
                      } else {
                        setShowMultiSwapPicker(true);
                      }
                    }}
                    className="h-9 px-3.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                    title="Warranty Swap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Warranty Swap</span>
                  </button>
                )}

                {!isPaid && (
                  <button
                    type="button"
                    onClick={handleOpenCollect}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <DollarSign className="w-3.5 h-3.5 shrink-0" />
                    <span>Collect Balance</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isDownloadingPdf}
                  className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0 disabled:opacity-60 whitespace-nowrap"
                >
                  {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Printer className="w-3.5 h-3.5 shrink-0" />}
                  <span>{isDownloadingPdf ? 'Generating…' : 'Download PDF'}</span>
                </button>
              </div>
            </div>

            {/* Mobile Action Rows (< sm): High contrast full-width primary + secondary */}
            <div className="flex sm:hidden flex-col gap-2 w-full">
              {/* Row 1: Primary Action */}
              {!isPaid ? (
                <button
                  type="button"
                  onClick={handleOpenCollect}
                  className="w-full h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span>Collect Balance ({remainingDebt.toLocaleString()} ETB)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isDownloadingPdf}
                  className="w-full h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap disabled:opacity-60"
                >
                  {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Printer className="w-3.5 h-3.5 shrink-0" />}
                  <span>{isDownloadingPdf ? 'Generating PDF…' : 'Download Invoice PDF'}</span>
                </button>
              )}

              {/* Row 2: Secondary Contextual Actions */}
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center whitespace-nowrap cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 whitespace-nowrap"
                >
                  {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Share2 className="w-3.5 h-3.5 shrink-0" />}
                  <span>{copiedReceipt ? 'Copied' : 'Share'}</span>
                </button>

                {canManageInv && swappableUnits.length > 0 && onInitiateReturn && (
                  <button
                    type="button"
                    onClick={() => {
                      if (order) onInitiateReturn(order);
                    }}
                    className="flex-1 h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1 active:scale-95 cursor-pointer whitespace-nowrap"
                    title="Process customer return"
                  >
                    <Undo2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Return</span>
                  </button>
                )}

                {canManageInv && swappableUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onInitiateSwap && order) {
                        onInitiateSwap(order);
                      } else if (swappableUnits.length === 1) {
                        setSwapUnitTarget(swappableUnits[0]);
                      } else {
                        setShowMultiSwapPicker(true);
                      }
                    }}
                    className="flex-1 h-9 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1 active:scale-95 cursor-pointer whitespace-nowrap"
                    title="Warranty Swap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Swap</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        }
      >
        <div id="printable-invoice" className="space-y-4">
          {/* ═══ SECTION 1: CLEAN TRANSACTION SUMMARY TILES ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Tile 1: Total Sale */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Agreed Sale
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
                {settledSaleValue.toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {order.items.reduce((s, i) => s + (i.quantity || 1), 0)} unit(s) in order
              </span>
            </div>

            {/* Tile 2: Amount Paid */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Amount Paid
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                {paidAmount.toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                {order.payment_splits && order.payment_splits.length > 1
                  ? `via Split Accounts (${order.payment_splits.length})`
                  : `via ${formatPaymentMethod(order.payment_method)}`}
              </span>
            </div>

            {/* Tile 3: Balance or Trade-in */}
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {remainingDebt > 0 ? 'Balance Outstanding' : exchangeAllowance > 0 ? 'Trade Allowance' : 'Settlement'}
              </span>
              <div
                className={`text-base sm:text-lg font-black font-mono tabular-nums mt-0.5 ${
                  remainingDebt > 0
                    ? 'text-amber-600 dark:text-amber-400'
                    : exchangeAllowance > 0
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {remainingDebt > 0
                  ? `${remainingDebt.toLocaleString()} ETB`
                  : exchangeAllowance > 0
                  ? `−${exchangeAllowance.toLocaleString()} ETB`
                  : 'Settled in Full'}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                {order.financial_account?.name || (isPaid ? 'Ledger verified' : 'Collection pending')}
              </span>
            </div>

            {/* Split Breakdown Details if present */}
            {order.payment_splits && order.payment_splits.length > 1 && (
              <div className="col-span-2 sm:col-span-3 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Deposit Accounts Split Breakdown
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {order.payment_splits.map((s, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {s.account_name || 'Account'}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(s.amount).toLocaleString()} ETB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ SECTION 2: CUSTOMER & ATtENDANT METADATA ═══ */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Customer / Partner */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {isB2B ? 'Trade Partner / Vendor' : 'Customer'}
                </span>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <span>{order.customer?.name || (isB2B ? 'Partner' : 'Walk-in Customer')}</span>
                  {isB2B && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
                      B2B Partner
                    </span>
                  )}
                </div>
                {order.customer?.phone && (
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    {order.customer.phone}
                  </div>
                )}
              </div>

              {/* Order Attendant & Date */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Sales Attendant & Date
                </span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {order.salesperson?.name || 'Store Sales Staff'}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {formattedDate} {formattedTime && `· ${formattedTime}`}
                </div>
              </div>
            </div>

            {/* Vendor Sourced Banner if applicable */}
            {(order.is_vendor_sourced || order.vendor || order.items.some((i) => i.sourcing_type === 'brokered_neighbour' || i.inventory_unit?.source_type === 'vendor_direct')) && (
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  Vendor Sourced: <strong className="font-bold text-slate-900 dark:text-white">{order.vendor?.name || order.items.find((i) => i.vendor_contact)?.vendor_contact?.name || 'Partner Vendor'}</strong>
                </span>
                {order.vendor_cost_basis != null && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Cost Basis: {Number(order.vendor_cost_basis).toLocaleString()} ETB ({order.vendor_payment_status || 'settled'})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ═══ SECTION 3: ITEMIZED PURCHASED ITEMS ═══ */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Purchased Items ({order.items.length})
              </h4>
              <button
                type="button"
                onClick={handleCopyOrderNumber}
                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 font-mono cursor-pointer"
                title="Copy order number"
              >
                <span>#{order.order_number}</span>
                {copiedId ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
            </div>

            {/* Desktop Table View (≥ md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2 px-1 w-6 text-center">#</th>
                    <th className="py-2 px-2">Item & Hardware</th>
                    <th className="py-2 px-2 text-center w-10">Qty</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap">Unit Price</th>
                    <th className="py-2 px-2 text-right whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {order.items.map((item, idx) => {
                    const unit = item.inventory_unit;
                    const specString = [item.variant?.storage, item.variant?.color].filter(Boolean).join(' · ');
                    const conditionStr = formatCondition(unit?.condition);
                    const simStr = formatSimType(unit?.sim_type);
                    const lineUnitPrice =
                      order.items.length === 1
                        ? settledSaleValue / Math.max(1, Number(item.quantity || 1))
                        : parseFloat(String(item.unit_price)) || 0;
                    const lineTotal = item.quantity * lineUnitPrice;

                    return (
                      <tr key={item.id || idx} className="align-top">
                        <td className="py-2.5 px-1 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-2 space-y-1">
                          <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center flex-wrap gap-1.5">
                            <span>{item.variant?.product?.name || 'Device'}</span>
                            {specString && <span className="font-normal text-slate-400">({specString})</span>}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400 font-mono">
                            {unit?.imei_or_serial && (
                              <button
                                type="button"
                                onClick={() => handleCopyImei(unit.imei_or_serial!)}
                                className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-100 transition-colors text-emerald-600 dark:text-emerald-400 font-bold"
                              >
                                <span>SN: {unit.imei_or_serial}</span>
                                {copiedImei === unit.imei_or_serial ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 opacity-60" />
                                )}
                              </button>
                            )}
                            {unit?.battery_health != null && <span>· {unit.battery_health}% Batt</span>}
                            {simStr && <span>· {simStr}</span>}
                            {conditionStr && <span>· {conditionStr}</span>}
                          </div>

                          {/* Swapped Defect History */}
                          {Boolean(unit?.swapped_from_unit || unit?.swapped_from_unit_id) && (
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/40 rounded-lg px-2 py-0.5 font-mono">
                              <ArrowLeftRight className="w-2.5 h-2.5 shrink-0" />
                              <span>
                                Warranty Replacement (Original: {unit?.swapped_from_unit?.imei_or_serial || 'Defective Unit'})
                              </span>
                            </div>
                          )}

                          {/* Customer Return History */}
                          {unit?.returned_at && (
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/40 rounded-lg px-2 py-0.5">
                              <Undo2 className="w-2.5 h-2.5 shrink-0" />
                              <span>Customer returned: {unit.return_reason || 'Defect reported'}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono text-slate-800 dark:text-slate-200 font-bold">{item.quantity}</td>

                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                            {lineUnitPrice.toLocaleString()} <span className="text-[9px] text-slate-400 font-sans">ETB</span>
                          </span>
                        </td>

                        <td className="py-2.5 px-2 text-right">
                          <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                            {lineTotal.toLocaleString()} <span className="text-[9px] text-slate-400 font-sans">ETB</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< md) */}
            <div className="md:hidden space-y-2.5">
              {order.items.map((item, idx) => {
                const unit = item.inventory_unit;
                const specString = [item.variant?.storage, item.variant?.color].filter(Boolean).join(' · ');
                const conditionStr = formatCondition(unit?.condition);
                const lineUnitPrice =
                  order.items.length === 1
                    ? settledSaleValue / Math.max(1, Number(item.quantity || 1))
                    : parseFloat(String(item.unit_price)) || 0;
                const lineTotal = item.quantity * lineUnitPrice;

                return (
                  <div
                    key={item.id || idx}
                    className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {item.variant?.product?.name || 'Device'}
                        </div>
                        {specString && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {specString}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {lineTotal.toLocaleString()} ETB
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.quantity}x @ {lineUnitPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Hardware info row with 1-tap IMEI copy */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/50 dark:border-slate-800/60 text-[10px] font-mono">
                      {unit?.imei_or_serial && (
                        <button
                          type="button"
                          onClick={() => handleCopyImei(unit.imei_or_serial!)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-bold active:scale-95"
                        >
                          <span>SN: {unit.imei_or_serial}</span>
                          {copiedImei === unit.imei_or_serial ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
                        </button>
                      )}
                      {unit?.battery_health != null && (
                        <span className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                          {unit.battery_health}% Batt
                        </span>
                      )}
                      {conditionStr && (
                        <span className="px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          {conditionStr}
                        </span>
                      )}
                    </div>

                    {/* Swapped Warranty History */}
                    {Boolean(unit?.swapped_from_unit || unit?.swapped_from_unit_id) && (
                      <div className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-900/40 rounded-lg p-2 font-mono flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3 h-3 shrink-0" />
                        <span>Replaced SN: {unit?.swapped_from_unit?.imei_or_serial || 'Defective unit'}</span>
                      </div>
                    )}

                    {/* Return History */}
                    {unit?.returned_at && (
                      <div className="text-[10px] text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/40 rounded-lg p-2 flex items-center gap-1.5">
                        <Undo2 className="w-3 h-3 shrink-0" />
                        <span>Returned: {unit.return_reason || 'Defect reported'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ SECTION 4: FINANCIAL SETTLEMENT BREAKDOWN ═══ */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Receipt & Settlement Summary
            </h4>

            {grossAmount !== netPayable && (
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Gross Subtotal</span>
                <span className="font-mono tabular-nums">{grossAmount.toLocaleString()} ETB</span>
              </div>
            )}

            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Discount Applied</span>
                <span className="font-mono tabular-nums">−{discountAmount.toLocaleString()} ETB</span>
              </div>
            )}

            {writeOffAmount > 0 && (
              <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                <span>Price Concession (Write-Off)</span>
                <span className="font-mono tabular-nums">−{writeOffAmount.toLocaleString()} ETB</span>
              </div>
            )}

            {exchangeAllowance > 0 && (
              <div className="flex justify-between text-purple-700 dark:text-purple-300 font-semibold bg-purple-50/70 dark:bg-purple-950/30 p-2 rounded-xl border border-purple-200/60 dark:border-purple-800/40">
                <span className="flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>
                    Trade-In Credit ({order.exchange_unit?.variant?.product?.name || 'Device'}
                    {order.exchange_unit?.imei_or_serial ? ` · ${order.exchange_unit.imei_or_serial}` : ''})
                  </span>
                </span>
                <span className="font-mono tabular-nums whitespace-nowrap">−{exchangeAllowance.toLocaleString()} ETB</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">
                {exchangeAllowance > 0 ? 'Cash Difference to Pay' : 'Final Agreed Sale Value'}
              </span>
              <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-black font-mono text-base text-slate-900 dark:text-white tabular-nums">
                {settledSaleValue.toLocaleString()}
                <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
              </span>
            </div>

            <div className="flex justify-between text-slate-600 dark:text-slate-300 pt-1">
              <span>Amount Paid</span>
              <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                +{paidAmount.toLocaleString()} ETB
              </span>
            </div>

            {remainingDebt > 0 ? (
              <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400 pt-1 border-t border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-xl">
                <span>Balance Due</span>
                <span className="font-mono tabular-nums">{remainingDebt.toLocaleString()} ETB</span>
              </div>
            ) : (
              <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
                <span>Payment Settlement</span>
                <span>{writeOffAmount > 0 ? 'Settled with agreed price concession' : 'Paid in Full'}</span>
              </div>
            )}
          </div>

          {/* ═══ SECTION 5: NOTES & SERVICE RECORD ═══ */}
          {order.notes && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Order Notes & Service History
              </span>
              <div className="text-slate-700 dark:text-slate-300 font-sans whitespace-pre-line leading-relaxed">
                {sanitizeOrderNotes(order.notes)}
              </div>
            </div>
          )}

          {/* ═══ SECTION 6: WARRANTY & TERMS NOTICE ═══ */}
          <div className="text-[10px] text-slate-400 space-y-0.5 px-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Warranty Coverage: </span>
            {tenant?.settings?.footer_note ||
              '7-day testing warranty on internal hardware. Valid receipt and matching serial number required for claims. Physical or liquid damage excluded.'}
          </div>

          {/* ═══ SECTION 7: INTERNAL MARGIN AUDIT (Owner Only) ═══ */}
          {canViewCost && (
            <div className="no-print border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={() => setShowInternalAudit(!showInternalAudit)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Internal Margin & Cost Basis</span>
                </span>
                <span className="flex items-center gap-2 font-mono text-emerald-600 dark:text-emerald-400">
                  {totalProfit >= 0 ? '+' : '−'}{Math.abs(totalProfit).toLocaleString()} ETB Net
                  {showInternalAudit ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </span>
              </button>

              {showInternalAudit && (
                <div className="px-4 pb-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-2 pt-3 animate-collapse-open">
                  {order.items.map((item, idx) => {
                    const isBrokered = item.sourcing_type === 'brokered_neighbour';
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                            {item.variant?.product?.name}
                          </span>
                          {isBrokered ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <ArrowRightLeft className="w-3 h-3" />
                              {item.vendor_contact?.name || 'Neighbour Vendor'}
                            </span>
                          ) : (item.inventory_unit?.source_type === 'exchange' || Boolean(item.inventory_unit?.exchange_sales_order_id)) ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                              Exchanged unit stock
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Shop counter stock</span>
                          )}
                        </div>
                        <div className="text-right font-mono shrink-0">
                          {item.unit_cost != null && (
                            <div className="text-[10px] text-slate-400">Cost: {Number(item.unit_cost).toLocaleString()} ETB</div>
                          )}
                          {item.bonus_amount != null && Number(item.bonus_amount) > 0 && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Agent bonus: +{Number(item.bonus_amount).toLocaleString()} ETB
                            </div>
                          )}
                          <div
                            className={`font-bold ${
                              Number(item.profit || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            +{Number(item.profit || 0).toLocaleString()} ETB
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </SlideOverDrawer>

      {/* Collect Balance Modal */}
      {showCollectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Collect Balance
                  </h3>
                  <p className="text-xs text-slate-400">
                    Order #{order.order_number} • {order.customer?.name || 'Walk-in Customer'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCollectModal(false)}
                disabled={submittingPayment}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmCollect} className="p-6 space-y-4">
              {/* Balance summary pill */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Outstanding</div>
                  <div className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                    {remainingDebt.toLocaleString()} <span className="text-xs font-bold font-sans">ETB</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Order</div>
                  <div className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                    {netPayable.toLocaleString()} ETB
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Collection Amount (ETB) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remainingDebt}
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full h-10 px-3.5 pr-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setCollectAmount(remainingDebt.toString())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Full
                  </button>
                </div>
              </div>

              {/* Financial Account Selector / Split */}
              <SplitPaymentSelector
                accounts={internalAccounts}
                targetAmount={parseFloat(collectAmount) || 0}
                singleAccountId={collectAccountId}
                onSingleAccountChange={setCollectAccountId}
                isSplit={isCollectSplit}
                onIsSplitChange={setIsCollectSplit}
                splits={collectSplits}
                onSplitsChange={setCollectSplits}
                direction="inflow"
                label="Deposit Account"
              />

              {/* Reference Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Transaction Reference <span className="text-slate-400 font-normal">Optional</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Telebirr TxID or CBE Transfer Ref"
                  value={collectRef}
                  onChange={(e) => setCollectRef(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Notes <span className="text-slate-400 font-normal">Optional</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Settled remaining balance"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  disabled={submittingPayment}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingPayment ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm Collection</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warranty Swap Modal */}
      <SwapDeviceModal
        isOpen={swapUnitTarget !== null}
        onClose={() => setSwapUnitTarget(null)}
        oldUnit={swapUnitTarget}
        order={order}
        onSwapSuccess={async () => {
          setSwapUnitTarget(null);
          if (order) {
            try {
              const res = await api.getSales({ search: order.order_number });
              const matching = res.find((o) => o.id === order.id);
              if (matching) {
                setOrder(matching);
                if (onPaymentCollected) onPaymentCollected(matching);
              }
            } catch {
              // ignore
            }
          }
        }}
      />

      {/* Multi-Device Swap Picker Modal (if order contains multiple sold serialized units) */}
      {showMultiSwapPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Select Device to Swap
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Order #{order.order_number} contains multiple devices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMultiSwapPicker(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Choose the device the customer is returning for a warranty swap:
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                {swappableUnits.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSwapUnitTarget(u);
                      setShowMultiSwapPicker(false);
                    }}
                    className="w-full p-3 text-left hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {u.variant?.product?.name || 'Device'}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                        SN: {u.imei_or_serial || 'Unrecorded'}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <span>Select</span>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowMultiSwapPicker(false)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
