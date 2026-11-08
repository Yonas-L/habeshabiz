import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { SalesOrder, User, FinancialAccount, InventoryUnit, Tenant } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { toast } from 'sonner';
import {
  X,
  Download,
  Copy,
  Check,
  Share2,
  Lock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
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
  tenant: _tenant,
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

  const getItemProfit = (item: any): number => {
    if (item.unit_cost !== null && item.unit_cost !== undefined) {
      return (
        (Number(item.unit_price || 0) - Number(item.unit_cost || 0)) *
          (item.quantity || 1) -
        Number(item.bonus_amount || 0)
      );
    }
    return parseFloat(String(item.profit || '0'));
  };

  const itemProfit = order.items.reduce(
    (sum, i) => sum + getItemProfit(i),
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
${discountAmount > 0 ? `Discount: -${discountAmount.toLocaleString()} ETB\n` : ''}${writeOffAmount > 0 ? `Intentional Price Concession: -${writeOffAmount.toLocaleString()} ETB\n` : ''}${exchangeAllowance > 0 ? `Exchanged Device Trade-In: -${exchangeAllowance.toLocaleString()} ETB\n` : ''}${exchangeAllowance > 0 ? 'Cash Difference to Pay' : 'Final Agreed Value'}: ${settledSaleValue.toLocaleString()} ETB
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

  // Derive primary item / headline model for drawer title
  const firstItem = order.items?.[0];
  const firstUnit = firstItem?.inventory_unit;
  const firstVariant = firstUnit?.variant || firstItem?.variant;
  const isFirstAcc = firstItem?.is_accessory || Boolean(firstItem?.accessory_name);
  const firstModelName =
    firstItem?.accessory_name ||
    (isFirstAcc
      ? 'Accessory'
      : firstVariant?.product?.name || firstItem?.variant?.product?.name || 'Device');
  const firstSpecs = [firstVariant?.storage, firstVariant?.color].filter(Boolean).join(' · ');
  const headlineModel = firstSpecs && !isFirstAcc ? `${firstModelName} (${firstSpecs})` : firstModelName;
  const extraItemsCount = order.items.length - 1;
  const drawerTitle = extraItemsCount > 0 ? `${headlineModel} +${extraItemsCount} more` : headlineModel;

  const totalQuantity = order.items.reduce((sum, i) => sum + i.quantity, 0);

  const statusBadgeInfo = (() => {
    if (isRefunded) {
      return {
        label: 'Refunded',
        shortLabel: 'Refunded',
        className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      };
    }
    if (writeOffAmount > 0) {
      return {
        label: 'Concession Settled',
        shortLabel: 'Concession',
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    }
    if (isPaid && isOffset) {
      return {
        label: 'Settled (Offset)',
        shortLabel: 'Offset',
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    }
    if (isPaid) {
      return {
        label: 'Paid in Full',
        shortLabel: 'Paid in Full',
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    }
    return {
      label: 'Credit Due',
      shortLabel: 'Credit Due',
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  })();

  return (
    <>
      <SlideOverDrawer
        isOpen={isOpen}
        onClose={onClose}
        widthClass="sm:max-w-md"
        contentClassName="px-4 sm:px-6 py-4 sm:py-5 space-y-5"
        customHeader={
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white/80 dark:bg-[#131926]/80 backdrop-blur-sm shrink-0">
            {/* Desktop Header (>= sm) - Identical to established desktop layout */}
            <div className="hidden sm:flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                    {drawerTitle}
                  </h2>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyOrderNumber}
                      title="Copy Order Number"
                      className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5 cursor-pointer"
                    >
                      {copiedId ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-60" />
                      )}
                    </button>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 ${statusBadgeInfo.className}`}
                    >
                      {statusBadgeInfo.label}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                  #{order.order_number} • Recorded on {formattedDate} • {formattedTime}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile Header (< sm) - Native feeling, spacious, perfectly styled */}
            <div className="sm:hidden space-y-2">
              {/* Native Sheet Top Drag Handle */}
              <div className="w-9 h-1 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto mb-1" />

              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-snug line-clamp-2">
                    {drawerTitle}
                  </h2>
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1 text-sm sm:text-xs">
                    <span className="font-mono font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      #{order.order_number}
                      <button
                        type="button"
                        onClick={handleCopyOrderNumber}
                        className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-0.5 cursor-pointer"
                        title="Copy Order Number"
                      >
                        {copiedId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-60" />
                        )}
                      </button>
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs sm:text-[11px]">
                      {formattedDate} {formattedTime ? `• ${formattedTime}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <span
                    className={`inline-flex items-center px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-md text-xs sm:text-[11px] font-semibold whitespace-nowrap shrink-0 ${statusBadgeInfo.className}`}
                  >
                    {statusBadgeInfo.shortLabel}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 cursor-pointer"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
        footerActions={
          <div className="w-full">
            {/* Desktop Footer (>= sm) - Identical to established desktop layout */}
            <div className="hidden sm:flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="h-9 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedReceipt ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>{copiedReceipt ? 'Copied' : 'Share'}</span>
                </button>

                {canManageInv && swappableUnits.length > 0 && onInitiateReturn && (
                  <button
                    type="button"
                    onClick={() => {
                      if (order) onInitiateReturn(order);
                    }}
                    className="h-9 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
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
                    className="h-9 px-3 rounded-xl border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Warranty Swap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>Swap</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isDownloadingPdf}
                  className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 shrink-0 text-emerald-400 dark:text-emerald-600" />
                  )}
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Mobile Footer (< sm) - Zero overflow, generous touch targets */}
            <div className="flex flex-col w-full gap-2 sm:hidden">
              {/* Management Action Row (Return / Swap) if units are swappable */}
              {canManageInv && swappableUnits.length > 0 && (onInitiateReturn || onInitiateSwap) && (
                <div className="grid grid-cols-2 gap-2 w-full">
                  {onInitiateReturn && (
                    <button
                      type="button"
                      onClick={() => {
                        if (order) onInitiateReturn(order);
                      }}
                      className="h-10 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                    >
                      <Undo2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Return Item</span>
                    </button>
                  )}
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
                    className="h-10 px-3 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Warranty Swap</span>
                  </button>
                </div>
              )}

              {/* Main Action Row: Close + Share + Download PDF */}
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-3.5 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-[13px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer shrink-0 active:scale-[0.98]"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="h-10 px-3 flex-1 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-[13px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  {copiedReceipt ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  )}
                  <span>{copiedReceipt ? 'Copied' : 'Share'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isDownloadingPdf}
                  className="h-10 px-4 flex-1 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 active:scale-[0.98]"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
                  ) : (
                    <Download className="w-4 h-4 shrink-0 text-emerald-400 dark:text-emerald-600" />
                  )}
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        }
      >
        <div id="printable-invoice" className="space-y-5">
          {/* ═══════════════════════════════════════════════════════════════
              SECTION 1: TRANSACTION DETAILS (Matches ExpenseDrawer structure)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-4 sm:space-y-3.5 text-sm sm:text-xs">
            {/* 1. What has been sold (with crisp divider below) */}
            <div className="space-y-3 pb-3.5 border-b border-slate-200/90 dark:border-slate-800">
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

                const specsList = [
                  unit?.battery_health != null ? `${unit.battery_health}% Batt` : null,
                  unit?.cycle_count != null && unit.cycle_count > 0 ? `${unit.cycle_count} cycles` : null,
                  simStr,
                  conditionStr,
                ].filter(Boolean);

                return (
                  <div key={item.id || idx} className="flex items-start justify-between gap-4">
                    <span className="text-slate-400 dark:text-slate-500 shrink-0">
                      {order.items.length > 1 ? `Sold Item (${idx + 1})` : 'Sold Item'}
                    </span>
                    <div className="text-right">
                      <div className="text-[15px] sm:text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                        {pName} {specString && !isAccessory ? `(${specString})` : ''}
                        {isAccessory && <span className="text-xs sm:text-[10px] text-slate-400 font-normal ml-1">[Accessory]</span>}
                      </div>
                      {!isAccessory && (unit?.imei_or_serial || specsList.length > 0) && (
                        <div className="text-xs sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-end gap-1.5 mt-1 sm:mt-0.5 flex-wrap">
                          {unit?.imei_or_serial && (
                            <button
                              type="button"
                              onClick={() => handleCopyImei(unit.imei_or_serial!)}
                              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                              title="Click to copy serial number"
                            >
                              <span>SN: {unit.imei_or_serial}</span>
                              {copiedImei === unit.imei_or_serial ? (
                                <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              ) : (
                                <Copy className="w-2.5 h-2.5 opacity-50 shrink-0" />
                              )}
                            </button>
                          )}
                          {unit?.imei_or_serial && specsList.length > 0 && <span>•</span>}
                          {specsList.length > 0 && <span>{specsList.join(' · ')}</span>}
                        </div>
                      )}
                      {Boolean(unit?.swapped_from_unit || unit?.swapped_from_unit_id) && (
                        <div className="text-xs sm:text-[10.5px] text-slate-500 dark:text-slate-400 font-mono flex items-center justify-end gap-1 mt-1 sm:mt-0.5">
                          <ArrowLeftRight className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-slate-400" />
                          <span>Warranty Replacement</span>
                        </div>
                      )}
                      {unit?.returned_at && (
                        <div className="text-xs sm:text-[10.5px] text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1 mt-1 sm:mt-0.5">
                          <Undo2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          <span>Returned: {unit.return_reason || 'Defect reported'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Customer */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Customer</span>
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>{order.customer?.name || (isB2B ? 'Trade Partner' : 'Walk-in Customer')}</span>
                {isB2B && (
                  <span className="text-xs sm:text-[10px] font-bold px-1.5 py-0.5 sm:py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                    B2B
                  </span>
                )}
                {order.customer?.phone && (
                  <span className="text-slate-400 font-mono text-xs sm:text-[11px]">({order.customer.phone})</span>
                )}
              </span>
            </div>

            {/* 3. Sold By */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Sold By</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {order.salesperson?.name || 'Sales Staff'}
              </span>
            </div>

            {/* Vendor (if applicable) */}
            {(order.vendor?.name || order.items.find((i) => i.vendor_contact)?.vendor_contact?.name) && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-500">Vendor</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {order.vendor?.name || order.items.find((i) => i.vendor_contact)?.vendor_contact?.name}
                </span>
              </div>
            )}

            {/* Paid Via */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Paid Via</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {settlementDestination}
              </span>
            </div>

            {/* Date */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Date</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formattedDate} • {formattedTime}
              </span>
            </div>
          </div>

          {/* Description / Notes (if any) */}
          {order.notes && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-xs sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5 sm:mb-1">
                Description / Notes
              </span>
              <p className="text-sm sm:text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {sanitizeOrderNotes(order.notes)}
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              SECTION 2: SEPARATE PRICE CALCULATION & PAYMENT SECTION
             ═══════════════════════════════════════════════════════════════ */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3.5 sm:space-y-3 text-sm sm:text-xs">
            {/* Quantity inside numbers section */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 dark:text-slate-500">Quantity</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {totalQuantity} {totalQuantity === 1 ? 'unit' : 'units'}
              </span>
            </div>

            {/* Price calculation lines (if any trade-in / discount / concession) */}
            {(discountAmount > 0 || writeOffAmount > 0 || exchangeAllowance > 0) && (
              <div className="space-y-2 pt-1 border-t border-dashed border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500">Gross Subtotal</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {grossAmount.toLocaleString()} ETB
                  </span>
                </div>
                {exchangeAllowance > 0 && order.exchange_unit && (
                  <div className="flex items-center justify-between text-purple-700 dark:text-purple-300">
                    <span>Trade-in ({order.exchange_unit.variant?.product?.name || 'Device'})</span>
                    <span className="font-mono font-medium">−{exchangeAllowance.toLocaleString()} ETB</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                    <span>Discount</span>
                    <span className="font-mono font-medium">−{discountAmount.toLocaleString()} ETB</span>
                  </div>
                )}
                {writeOffAmount > 0 && (
                  <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                    <span>Price Concession</span>
                    <span className="font-mono font-medium">−{writeOffAmount.toLocaleString()} ETB</span>
                  </div>
                )}
              </div>
            )}

            {/* Total: Normal bold font */}
            <div className="flex items-center justify-between text-base sm:text-sm pt-1">
              <span className="font-bold text-slate-900 dark:text-white">
                Total
              </span>
              <span className="font-bold font-mono text-slate-900 dark:text-white">
                {settledSaleValue.toLocaleString()} ETB
              </span>
            </div>

            {/* Paid: Green and big size, right side under the total */}
            <div className="pt-2 flex flex-col items-end">
              <span className="text-xs sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Amount Paid
              </span>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight mt-0.5">
                +{paidAmount.toLocaleString()}{' '}
                <span className="text-base sm:text-sm font-semibold font-sans">ETB</span>
              </div>
            </div>

            {/* Remaining debt / Balance due if any */}
            {remainingDebt > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                <div>
                  <span className="text-xs sm:text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                    Balance Due
                  </span>
                  <span className="text-xl sm:text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                    {remainingDebt.toLocaleString()} ETB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCollect}
                  className="h-9 sm:h-8 px-3.5 sm:px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Collect Balance
                </button>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SECTION H: INTERNAL MARGIN AUDIT (Collapsible, Owner Only)
             ═══════════════════════════════════════════════════════════════ */}
          {canViewCost && (
            <div className="no-print pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowInternalAudit(!showInternalAudit)}
                className="w-full py-2 sm:py-1.5 flex items-center justify-between gap-2 text-sm sm:text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 font-medium min-w-0">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Internal Margin & Cost Basis</span>
                </span>
                <span className="flex items-center gap-1.5 font-mono shrink-0 whitespace-nowrap">
                  <span
                    className={
                      totalProfit > 0
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : totalProfit < 0
                        ? 'text-rose-600 dark:text-rose-400 font-semibold'
                        : 'text-slate-500 font-medium'
                    }
                  >
                    {totalProfit > 0 ? '+' : totalProfit < 0 ? '−' : ''}
                    {Math.abs(totalProfit).toLocaleString()} ETB Net
                    {totalProfit < 0 && (
                      <span className="ml-1 text-[10px] sm:text-[9.5px] font-sans font-bold px-1.5 py-0.5 sm:py-0.2 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50 whitespace-nowrap">
                        Loss
                      </span>
                    )}
                  </span>
                  {showInternalAudit ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                </span>
              </button>

              {showInternalAudit && (
                <div className="pt-2 pb-1 space-y-2 sm:space-y-1.5 text-sm sm:text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
                  {order.items.map((item, idx) => {
                    const pName =
                      item.accessory_name ||
                      item.inventory_unit?.variant?.product?.name ||
                      item.variant?.product?.name ||
                      'Device';
                    const itemProfitVal = getItemProfit(item);

                    return (
                      <div
                        key={idx}
                        className="pt-2 sm:pt-1.5 first:pt-0 flex items-center justify-between text-sm sm:text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {pName}
                            </span>
                            {itemProfitVal < 0 && (
                              <span className="text-[10px] sm:text-[9px] font-sans font-bold px-1.5 sm:px-1 py-0.5 sm:py-0.2 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                                Loss
                              </span>
                            )}
                          </div>
                          {item.unit_cost != null && (
                            <div className="text-xs sm:text-[11px] text-slate-400 font-mono">
                              Cost: {Number(item.unit_cost).toLocaleString()} ETB
                            </div>
                          )}
                        </div>
                        <div className="text-right font-mono font-medium">
                          <span
                            className={
                              itemProfitVal > 0
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : itemProfitVal < 0
                                ? 'text-rose-600 dark:text-rose-400 font-medium'
                                : 'text-slate-500'
                            }
                          >
                            {itemProfitVal > 0 ? '+' : itemProfitVal < 0 ? '−' : ''}
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

      {/* Multi-Device Swap Picker Modal (Responsive Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {showMultiSwapPicker &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs select-none animate-fade-in">
            <div
              className="fixed inset-0"
              onClick={() => setShowMultiSwapPicker(false)}
            />
            <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl sm:shadow-xl border-t sm:border border-slate-200 dark:border-slate-800 sm:border-slate-100 sm:dark:border-slate-800 p-5 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4 max-h-[85vh] sm:max-h-none overflow-y-auto animate-bottom-sheet sm:animate-modal-enter flex flex-col">
              {/* Mobile Grab Handle */}
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

              <div className="flex items-center justify-between pb-3.5 sm:pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-2 text-slate-800 dark:text-slate-200">
                  <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-sm tracking-tight">
                      Select Device to Swap
                    </h3>
                    <p className="text-xs sm:text-[11px] text-slate-400 font-medium sm:font-normal">
                      Order #{order.order_number} contains multiple devices
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMultiSwapPicker(false)}
                  className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5 sm:space-y-2 flex-1">
                <p className="text-xs sm:text-xs font-bold sm:font-normal text-slate-600 dark:text-slate-400">
                  Choose the device the customer is returning for a warranty swap:
                </p>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-xl overflow-hidden">
                  {swappableUnits.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSwapUnitTarget(u);
                        setShowMultiSwapPicker(false);
                      }}
                      className="w-full p-3.5 sm:p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {u.variant?.product?.name || 'Device'}
                        </div>
                        <div className="text-xs sm:text-[11px] font-mono font-semibold sm:font-normal text-emerald-600 dark:text-emerald-400 mt-0.5">
                          SN: {u.imei_or_serial || 'Unrecorded'}
                        </div>
                      </div>
                      <span className="text-xs sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span>Select</span>
                        <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3 sm:pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMultiSwapPicker(false)}
                  className="w-full sm:w-auto h-11 sm:h-9 px-5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm sm:text-xs font-bold sm:font-semibold text-slate-700 sm:text-slate-600 dark:text-slate-300 sm:dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
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
