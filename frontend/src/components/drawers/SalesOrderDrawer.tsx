import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { SalesOrder, User, FinancialAccount, InventoryUnit, Tenant } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { toast } from 'sonner';
import {
  ArrowLeft,
  X,
  Download,
  Copy,
  Check,
  Share2,
  ShieldCheck,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Undo2,
  ArrowLeftRight,
  Repeat,
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
      api
        .getAccounts()
        .then((res) => {
          const treasury = res.treasury_accounts || [];
          setInternalAccounts(treasury);
          const active = treasury.filter((a) => !a.is_custom_asset && a.is_active !== false);
          if (active.length > 0) {
            setCollectAccountId((prev) => prev || active[0].id);
          }
        })
        .catch(() => {});
    }
  }, [accounts, isOpen]);

  const isOwner = user?.role === 'owner';
  const canManageInv =
    isOwner || !!user?.can_manage_inventory || !!user?.permissions?.can_manage_inventory;

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
  const isRefunded =
    order.payment_status === 'refunded' ||
    (order.items.length > 0 &&
      order.items.every(
        (i) =>
          i.inventory_unit?.status === 'returned' ||
          i.inventory_unit?.status === 'returned_to_vendor'
      ));
  const isOffset = order.payment_method === 'debt_offset';
  const isB2B =
    isOffset ||
    (order.customer?.roles?.some((r: string) =>
      ['peer_vendor', 'vendor', 'supplier', 'partner'].includes(r)
    ) ??
      false);
  const isPaid = !isRefunded && (order.payment_status === 'paid' || remainingDebt === 0);
  const settledSaleValue = Math.max(0, netPayable - writeOffAmount);
  const totalItemCount = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);

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

  const formatPaymentMethod = (method?: string) => {
    if (!method) return 'Cash Transfer';
    const map: Record<string, string> = {
      telebirr: 'Telebirr',
      cbe_birr: 'CBE Birr',
      cbe: 'CBE',
      cash: 'Cash Transfer',
      cash_transfer: 'Cash Transfer',
      bank_transfer: 'Bank Transfer',
      split: 'Split Payment',
      amole: 'Amole',
      credit: 'Customer Credit',
      debt_offset: 'Debt Offset',
    };
    return map[method.toLowerCase()] || method.replace(/_/g, ' ');
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
      setCollectAccountId((prev) =>
        prev && activeAccounts.some((a) => a.id === prev) ? prev : activeAccounts[0].id
      );
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
        toast.error(
          `Split amounts (${totalAllocated.toLocaleString()} ETB) must equal total collection (${amt.toLocaleString()} ETB)`
        );
        return;
      }
      if (
        collectSplits.length === 0 ||
        collectSplits.some((s) => !s.financial_account_id || s.amount <= 0)
      ) {
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
        const variant = unit?.variant || item.variant;
        const isExchanged = unit?.source_type === 'exchange' || Boolean(unit?.exchange_sales_order_id);
        const tagText = isExchanged ? ' - Exchanged' : '';
        const imeiText = unit?.imei_or_serial ? `\n   SN: ${unit.imei_or_serial}` : '';
        const batteryText = unit?.battery_health ? ` · ${unit.battery_health}% Batt` : '';
        const cycleText =
          unit?.cycle_count !== null && unit?.cycle_count !== undefined
            ? ` · ${unit.cycle_count} cycles`
            : '';
        const isAccessory = item.is_accessory || Boolean(item.accessory_name);
        const isVendoredAcc =
          isAccessory && (item.sourcing_type === 'brokered_neighbour' || Boolean(item.vendor_contact_id));
        const itemName =
          item.accessory_name ||
          (isVendoredAcc
            ? 'Vendored Accessory'
            : isAccessory
            ? 'Accessory'
            : variant?.product?.name || item.variant?.product?.name || 'Device');
        const tagPrefix = isVendoredAcc ? ' [Vendored Accessory]' : isAccessory ? ' [Accessory]' : '';
        const spec = [variant?.storage, variant?.color].filter(Boolean).join(' · ');
        const specText = spec && !isAccessory ? ` - ${spec}` : '';
        const receiptUnitPrice =
          order.items.length === 1
            ? settledSaleValue / Math.max(1, Number(item.quantity || 1))
            : Number(item.unit_price);
        const hardwareSpecs = !isAccessory ? `${tagText}${imeiText}${batteryText}${cycleText}` : '';
        return `${index + 1}. ${item.quantity}x ${itemName}${tagPrefix}${specText}${hardwareSpecs}\n   ${receiptUnitPrice.toLocaleString()} ETB`;
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
${
  isB2B
    ? `B2B SETTLEMENT NOTICE:
• Transacted as mutual partner trade / debt offset.
• Subject to standard bilateral trade & defect agreements.`
    : `WARRANTY & TERMS:
• 7 Days Testing Warranty on internal hardware.
• Valid receipt and matching IMEI required for warranty claims.
• Physical or water damage voids warranty.`
}

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
      await downloadPdf('printable-invoice', filename, undefined, undefined);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Determine settlement destination display
  const settlementDestination =
    order.payment_splits && order.payment_splits.length > 1
      ? `Split Accounts (${order.payment_splits.length})`
      : order.financial_account?.name || formatPaymentMethod(order.payment_method);

  return (
    <>
      <SlideOverDrawer
        isOpen={isOpen}
        onClose={onClose}
        widthClass="sm:max-w-2xl lg:max-w-[760px]"
        contentClassName="px-5 sm:px-8 py-5 space-y-6 overflow-x-hidden"
        customHeader={
          <div className="px-5 sm:px-8 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#111C2D]">
            {/* Top Navigation Row: Back to orders + Close X */}
            <div className="flex items-center justify-between mb-3.5">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back to orders</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Order Header Row: Order Number + Date/Status (Left) and Download PDF (Right) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-mono">
                    #{order.order_number}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCopyOrderNumber}
                    title="Copy Order Number"
                    className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-400/70" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span>
                    {formattedDate} • {formattedTime}
                  </span>
                  <span>•</span>
                  {/* Status indicator pill matching reference image: green dot + Paid in Full */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isRefunded
                          ? 'bg-rose-500'
                          : remainingDebt > 0
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    <span>
                      {isRefunded
                        ? 'Refunded'
                        : writeOffAmount > 0
                        ? 'Concession Settled'
                        : isPaid && isOffset
                        ? 'Settled (Offset)'
                        : isPaid
                        ? 'Paid in Full'
                        : 'Credit Due'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Top Primary Action: Download PDF */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isDownloadingPdf}
                  className="h-9 px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 active:scale-95 whitespace-nowrap"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        }
        footerActions={
          <div className="w-full flex items-center justify-between gap-2.5 flex-wrap">
            {/* Left: Secondary actions (Close, Share) */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 sm:px-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopyReceipt}
                className="h-9 px-3 sm:px-3.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                {copiedReceipt ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span>{copiedReceipt ? 'Copied' : 'Share Receipt'}</span>
              </button>
            </div>

            {/* Right: Contextual actions (Return, Swap) + Primary Download PDF */}
            <div className="flex items-center gap-2">
              {canManageInv && swappableUnits.length > 0 && onInitiateReturn && (
                <button
                  type="button"
                  onClick={() => {
                    if (order) onInitiateReturn(order);
                  }}
                  className="h-9 px-2.5 sm:px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                  title="Process customer return"
                >
                  <Undo2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
                  className="h-9 px-2.5 sm:px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                  title="Warranty Swap"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Warranty Swap</span>
                  <span className="sm:hidden">Swap</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                disabled={isDownloadingPdf}
                className="h-9 px-3.5 sm:px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60 whitespace-nowrap"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-emerald-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 shrink-0 text-emerald-400 dark:text-emerald-600" />
                )}
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        }
      >
        <div id="printable-invoice" className="space-y-6">
          {/* ═══════════════════════════════════════════════════════════════
              SECTION B: FINANCIAL SUMMARY (3-Column Layout, Flat, Subtle Divider)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-3 gap-2 sm:gap-6 pb-5 sm:pb-6 border-b border-slate-100 dark:border-slate-800">
            {/* Column 1: Total Amount */}
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                Total Amount
              </span>
              <div className="text-sm min-[390px]:text-base sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5 sm:mt-1 truncate">
                {settledSaleValue.toLocaleString()}{' '}
                <span className="text-[10px] sm:text-xs font-normal text-slate-400 font-sans">ETB</span>
              </div>
              <span className="text-[10px] sm:text-xs text-slate-400 block mt-0.5 truncate">
                {totalItemCount} unit{totalItemCount !== 1 ? 's' : ''} in order
              </span>
            </div>

            {/* Column 2: Amount Paid */}
            <div className="border-l border-slate-100 dark:border-slate-800 pl-2.5 sm:pl-6 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                Amount Paid
              </span>
              <div className="text-sm min-[390px]:text-base sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5 sm:mt-1 truncate">
                {paidAmount.toLocaleString()}{' '}
                <span className="text-[10px] sm:text-xs font-normal text-slate-400 font-sans">ETB</span>
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
                {isPaid ? 'Paid in Full' : `Balance Remaining: ${remainingDebt.toLocaleString()} ETB`}
              </span>
            </div>

            {/* Column 3: Settlement */}
            <div className="border-l border-slate-100 dark:border-slate-800 pl-2.5 sm:pl-6 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 block truncate">
                Settlement
              </span>
              <div className="text-xs min-[390px]:text-sm sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5 sm:mt-1 truncate">
                {remainingDebt > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-mono">
                    {remainingDebt.toLocaleString()} ETB Due
                  </span>
                ) : isRefunded ? (
                  <span className="text-rose-600 dark:text-rose-400">Refunded</span>
                ) : (
                  <span>Settled in Full</span>
                )}
              </div>
              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 block mt-0.5 truncate">
                {settlementDestination}
              </span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION C: CUSTOMER AND SALES ATTENDANT (2-Column Layout)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
            {/* Customer */}
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Customer
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                <span>{order.customer?.name || (isB2B ? 'Trade Partner' : 'Walk-in Customer')}</span>
                {isB2B && (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    (B2B Partner)
                  </span>
                )}
              </div>
              {order.customer?.phone && (
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  {order.customer.phone}
                </div>
              )}
            </div>

            {/* Sales Attendant & Date */}
            <div className="sm:border-l sm:border-slate-100 dark:sm:border-slate-800 sm:pl-6">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Sales Attendant & Date
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {order.salesperson?.name || 'Sales Staff'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {formattedDate} • {formattedTime}
              </div>
            </div>

            {/* Subtle Vendor Sourcing Row if applicable */}
            {(order.is_vendor_sourced ||
              order.vendor ||
              order.items.some((i) => i.sourcing_type === 'brokered_neighbour')) && (
              <div className="col-span-1 sm:col-span-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
                Vendor Sourced:{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-medium">
                  {order.vendor?.name ||
                    order.items.find((i) => i.vendor_contact)?.vendor_contact?.name ||
                    'Partner Vendor'}
                </strong>
                {order.vendor_cost_basis != null && (
                  <span className="font-mono ml-2">
                    (Cost Basis: {Number(order.vendor_cost_basis).toLocaleString()} ETB)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION D: PURCHASED ITEMS TABLE (Clean, Minimal, No Images)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-3 pb-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Purchased Items ({order.items.length})
            </h3>

            {/* Desktop Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-1.5 sm:px-2 w-6 sm:w-8 text-center font-mono">#</th>
                    <th className="py-2.5 px-2 sm:px-3">Item & Hardware</th>
                    <th className="py-2.5 px-2 sm:px-3 text-center w-10 sm:w-12">Qty</th>
                    <th className="hidden sm:table-cell py-2.5 px-3 text-right whitespace-nowrap">Unit Price</th>
                    <th className="py-2.5 px-2 sm:px-3 text-right whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {order.items.map((item, idx) => {
                    const unit = item.inventory_unit;
                    const variant = unit?.variant || item.variant;
                    const isAccessory = item.is_accessory || Boolean(item.accessory_name);
                    const isVendoredAcc =
                      isAccessory &&
                      (item.sourcing_type === 'brokered_neighbour' || Boolean(item.vendor_contact_id));
                    const specString = [variant?.storage, variant?.color].filter(Boolean).join(' · ');
                    const pName =
                      item.accessory_name ||
                      (isVendoredAcc
                        ? 'Vendored Accessory'
                        : isAccessory
                        ? 'Accessory'
                        : variant?.product?.name || item.variant?.product?.name || 'Device');
                    const conditionStr = formatCondition(unit?.condition);
                    const simStr = formatSimType(unit?.sim_type);
                    const lineUnitPrice =
                      order.items.length === 1
                        ? settledSaleValue / Math.max(1, Number(item.quantity || 1))
                        : parseFloat(String(item.unit_price)) || 0;
                    const lineTotal = item.quantity * lineUnitPrice;

                    return (
                      <tr key={item.id || idx} className="align-top">
                        <td className="py-3 px-1.5 sm:px-2 text-center text-slate-400 font-mono text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-2 sm:px-3 space-y-1">
                          <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                            <span>{pName}</span>
                            {specString && !isAccessory && (
                              <span className="font-normal text-slate-500 dark:text-slate-400 ml-1.5">
                                ({specString})
                              </span>
                            )}
                            {isAccessory && (
                              <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                                [Accessory]
                              </span>
                            )}
                          </div>

                          {/* Cost info if authorized */}
                          {canViewCost && item.unit_cost != null && Number(item.unit_cost) > 0 && (
                            <div className="text-[10.5px] text-slate-400 font-mono">
                              Cost: {Number(item.unit_cost).toLocaleString()} ETB
                            </div>
                          )}

                          {/* Hardware specifications */}
                          {!isAccessory && (
                            <div className="flex flex-wrap items-center gap-x-2 text-[10.5px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {unit?.imei_or_serial && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyImei(unit.imei_or_serial!)}
                                  className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                                  title="Click to copy serial number"
                                >
                                  <span>SN: {unit.imei_or_serial}</span>
                                  {copiedImei === unit.imei_or_serial ? (
                                    <Check className="w-2.5 h-2.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5 opacity-50" />
                                  )}
                                </button>
                              )}
                              {unit?.battery_health != null && <span>· {unit.battery_health}% Batt</span>}
                              {unit?.cycle_count != null && <span>· {unit.cycle_count} cycles</span>}
                              {simStr && <span>· {simStr}</span>}
                              {conditionStr && <span>· {conditionStr}</span>}
                            </div>
                          )}

                          {/* Replacement or Return Notice */}
                          {Boolean(unit?.swapped_from_unit || unit?.swapped_from_unit_id) && (
                            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                              <ArrowLeftRight className="w-3 h-3 text-slate-400" />
                              <span>Warranty Replacement</span>
                            </div>
                          )}
                          {unit?.returned_at && (
                            <div className="text-[10.5px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <Undo2 className="w-3 h-3" />
                              <span>Returned: {unit.return_reason || 'Defect reported'}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-2 sm:px-3 text-center font-mono text-slate-800 dark:text-slate-200">
                          {item.quantity}
                        </td>

                        <td className="hidden sm:table-cell py-3 px-3 text-right">
                          {lineUnitPrice === 0 ? (
                            <span className="text-slate-400 text-xs">Free Gift</span>
                          ) : (
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {lineUnitPrice.toLocaleString()}{' '}
                              <span className="text-[10px] text-slate-400 font-sans">ETB</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-2 sm:px-3 text-right">
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {lineTotal === 0 ? '0 ETB' : `${lineTotal.toLocaleString()} ETB`}
                          </span>
                          <div className="sm:hidden text-[10px] font-mono text-slate-400 mt-0.5">
                            {lineUnitPrice === 0 ? 'Free' : `@ ${lineUnitPrice.toLocaleString()} ETB`}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION E: RECEIPT & SETTLEMENT SUMMARY (Direct, Clean, Flat)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-3 pb-6 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              Receipt & Settlement Summary
            </h3>

            {/* Optional gross / discount lines if applied */}
            {(discountAmount > 0 || writeOffAmount > 0 || exchangeAllowance > 0) && (
              <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 pb-2">
                <div className="flex justify-between">
                  <span>Gross Subtotal</span>
                  <span className="font-mono">{grossAmount.toLocaleString()} ETB</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Discount Applied</span>
                    <span className="font-mono">−{discountAmount.toLocaleString()} ETB</span>
                  </div>
                )}
                {writeOffAmount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Price Concession</span>
                    <span className="font-mono">−{writeOffAmount.toLocaleString()} ETB</span>
                  </div>
                )}
                {exchangeAllowance > 0 && (
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <Repeat className="w-3 h-3 text-slate-400" />
                      <span>Trade-in Allowance</span>
                    </span>
                    <span className="font-mono">−{exchangeAllowance.toLocaleString()} ETB</span>
                  </div>
                )}
              </div>
            )}

            {/* 2-Column Summary matching reference image */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-1">
              {/* Final Agreed Sale Value */}
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Final Agreed Sale Value
                </span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                  {settledSaleValue.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
                </div>
              </div>

              {/* Amount Paid & Settlement Status */}
              <div className="sm:border-l sm:border-slate-100 dark:sm:border-slate-800 sm:pl-6">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">
                  Amount Paid
                </span>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums mt-1">
                  +{paidAmount.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                  <span>Payment Settlement</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {remainingDebt > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        {remainingDebt.toLocaleString()} ETB Due
                      </span>
                    ) : (
                      'Paid in Full'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* If balance is due, show a clean collection button */}
            {remainingDebt > 0 && (
              <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Outstanding Debt:{' '}
                  <strong className="text-amber-600 dark:text-amber-400 font-mono">
                    {remainingDebt.toLocaleString()} ETB
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={handleOpenCollect}
                  className="h-8 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Collect Balance
                </button>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION F: ORDER NOTES (if available)
             ═══════════════════════════════════════════════════════════════ */}
          {order.notes && (
            <div className="space-y-1 pb-6 border-b border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                Order Notes
              </span>
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {sanitizeOrderNotes(order.notes)}
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              SECTION G: WARRANTY COVERAGE (Subtle & Minimal)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="flex items-start gap-3 py-1 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Warranty Coverage
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">
                {tenant?.settings?.footer_note ||
                  'Thank you for your business. 7-day testing warranty on internal hardware.'}
              </p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION H: INTERNAL MARGIN AUDIT (Collapsible, Owner Only)
             ═══════════════════════════════════════════════════════════════ */}
          {canViewCost && (
            <div className="no-print pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowInternalAudit(!showInternalAudit)}
                className="w-full py-2 flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Internal Margin & Cost Basis</span>
                </span>
                <span className="flex items-center gap-2 font-mono text-slate-700 dark:text-slate-300">
                  <span
                    className={
                      totalProfit >= 0
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-rose-600 dark:text-rose-400 font-semibold'
                    }
                  >
                    {totalProfit >= 0 ? '+' : '−'}
                    {Math.abs(totalProfit).toLocaleString()} ETB Net
                  </span>
                  {showInternalAudit ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </span>
              </button>

              {showInternalAudit && (
                <div className="pt-3 pb-2 space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
                  {order.items.map((item, idx) => {
                    const pName =
                      item.accessory_name ||
                      item.inventory_unit?.variant?.product?.name ||
                      item.variant?.product?.name ||
                      'Device';
                    const itemProfitVal = Number(item.profit || 0);

                    return (
                      <div
                        key={idx}
                        className="pt-2 first:pt-0 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {pName}
                          </span>
                          {item.unit_cost != null && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              Cost: {Number(item.unit_cost).toLocaleString()} ETB
                            </div>
                          )}
                        </div>
                        <div className="text-right font-mono font-medium">
                          <span
                            className={
                              itemProfitVal >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            {itemProfitVal >= 0 ? '+' : '−'}
                            {Math.abs(itemProfitVal).toLocaleString()} ETB
                          </span>
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
      {showCollectModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div
              className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Collect Balance
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order #{order.order_number} • {order.customer?.name || 'Walk-in Customer'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  disabled={submittingPayment}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmCollect} className="p-6 space-y-4">
                {/* Balance summary */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Outstanding
                    </div>
                    <div className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 tabular-nums">
                      {remainingDebt.toLocaleString()}{' '}
                      <span className="text-xs font-bold font-sans">ETB</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Total Order
                    </div>
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
                    className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submittingPayment ? 'Recording...' : 'Confirm Collection'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
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

      {/* Multi-Device Swap Picker Modal */}
      {showMultiSwapPicker &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-[#131926] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Select Device to Swap
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Order #{order.order_number} contains multiple devices
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMultiSwapPicker(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Close
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
                      className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {u.variant?.product?.name || 'Device'}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                          SN: {u.imei_or_serial || 'Unrecorded'}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span>Select</span>
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
          </div>,
          document.body
        )}
    </>
  );
};
