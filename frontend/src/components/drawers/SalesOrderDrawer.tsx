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
  Download,
  DollarSign,
  Loader2,
  X,
  Repeat,
  Wrench,
  Undo2,
  ArrowLeftRight,
} from 'lucide-react';
import { AccountLogo } from '../../utils/bankLogos';
import { SwapDeviceModal } from '../inventory/SwapDeviceModal';

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

  // Warranty Swap state
  const [swapUnitTarget, setSwapUnitTarget] = useState<InventoryUnit | null>(null);
  const [showMultiSwapPicker, setShowMultiSwapPicker] = useState(false);

  // Collection modal state
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectAccountId, setCollectAccountId] = useState('');
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
  const exchangeAllowance = parseFloat(String(order.exchange_allowance || '0')) || 0;
  const netPayable = Math.max(0, grossAmount - discountAmount - exchangeAllowance);
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

    if (!collectAccountId) {
      toast.error('Please select an account to deposit funds.');
      return;
    }

    try {
      setSubmittingPayment(true);
      const res = await api.collectSalesPayment(order.id, {
        amount: amt,
        financial_account_id: collectAccountId,
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
        return `${index + 1}. ${item.quantity}x ${item.variant?.product?.name || 'Device'}${specText}${tagText}${imeiText}${batteryText}\n   ${Number(item.unit_price).toLocaleString()} ETB`;
      })
      .join('\n\n');

    return `========================================
HABESHABIZ ELECTRONICS
Bole Medhanialem • Addis Ababa
Tel: +251 91 123 4567
========================================
OFFICIAL SALES INVOICE & RECEIPT
Ref: ${order.order_number}
Date: ${formattedDate} ${formattedTime}
Customer: ${order.customer?.name || 'Walk-in Customer'} ${order.customer?.phone ? `• ${order.customer.phone}` : ''}
Sales Attendant: ${order.salesperson?.name || 'Habeshabiz Sales Staff'}
Payment Method: ${formatPaymentMethod(order.payment_method)}
Status: ${isPaid ? 'PAID IN FULL' : 'CREDIT DUE'}
========================================
ITEMS PURCHASED:
${itemsText}
========================================
Subtotal: ${grossAmount.toLocaleString()} ETB
${discountAmount > 0 ? `Discount: -${discountAmount.toLocaleString()} ETB\n` : ''}${exchangeAllowance > 0 ? `Exchanged Device: ${exchangeAllowance.toLocaleString()} ETB\n` : ''}${exchangeAllowance > 0 ? 'Cash Difference to Pay' : 'Total Net Amount'}: ${netPayable.toLocaleString()} ETB
Amount Paid: ${paidAmount.toLocaleString()} ETB
${remainingDebt > 0 ? `Balance Due: ${remainingDebt.toLocaleString()} ETB\n` : ''}========================================
WARRANTY & TERMS:
• 7 Days Testing Warranty on internal hardware.
• Valid receipt and matching IMEI required for warranty claims.
• Physical or water damage voids warranty.

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
    <>
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
          <div className="w-full">
            {/* Desktop Action Row (≥ sm): Preserves original single-row layout */}
            <div className="hidden sm:flex sm:items-center sm:justify-between sm:w-full gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedReceipt ? 'Receipt Copied' : 'Share Receipt'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  title="Download Slip Text"
                  className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {canManageInv && swappableUnits.length > 0 && onInitiateReturn && (
                  <button
                    type="button"
                    onClick={() => {
                      if (order) onInitiateReturn(order);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                    title="Process customer return"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
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
                    className="h-9 px-3.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                    title="Warranty Swap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Warranty Swap</span>
                  </button>
                )}

                {!isPaid && (
                  <button
                    type="button"
                    onClick={handleOpenCollect}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Collect Balance</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
              </div>
            </div>

            {/* Mobile Action Rows (< sm): Clean actions without redundant Print Slip (print icon is in the header) */}
            <div className="flex sm:hidden flex-col gap-2 w-full">
              {/* Primary Action (Only when balance remains to collect) */}
              {!isPaid && (
                <div className="flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleOpenCollect}
                    className="w-full h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5 shrink-0" />
                    <span>Collect Balance</span>
                  </button>
                </div>
              )}

              {/* Secondary Actions Row */}
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                >
                  {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Share2 className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{copiedReceipt ? 'Copied' : 'Share Receipt'}</span>
                </button>

                {canManageInv && swappableUnits.length > 0 && onInitiateReturn && (
                  <button
                    type="button"
                    onClick={() => {
                      if (order) onInitiateReturn(order);
                    }}
                    className="flex-1 h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    title="Process customer return"
                  >
                    <Undo2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Return</span>
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
                    className="flex-1 h-9 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                    title="Warranty Swap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Warranty Swap</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  title="Download Slip Text"
                  className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        }
    >
      {/* Printable Invoice & Receipt Document */}
      <div
        id="printable-invoice"
        className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[#101622] border border-slate-200/90 dark:border-slate-800 space-y-5 animate-receipt"
      >
        {/* Header: Company + Ref */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            {tenant?.settings?.logo_url && (
              <img
                src={tenant.settings.logo_url}
                alt={tenant.name}
                className="w-10 h-10 object-contain rounded-lg border border-slate-200 dark:border-slate-700 p-0.5"
              />
            )}
            <div>
              <div className="font-black text-sm tracking-tight text-slate-900 dark:text-white uppercase">
                {tenant?.name || 'HABESHABIZ ELECTRONICS'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {[
                  tenant?.settings?.address || 'Bole Medhanialem',
                  tenant?.settings?.city || 'Addis Ababa',
                  tenant?.phone || '+251 91 123 4567',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 dark:text-white">
              <span>{order.order_number}</span>
              <button
                type="button"
                onClick={handleCopyOrderNumber}
                title="Copy Reference"
                className="no-print p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {formattedDate}{formattedTime && ` · ${formattedTime}`}
            </div>
          </div>
        </div>

        {/* Customer + Transaction Meta — flat, no card */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Customer</span>
            <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
              {order.customer?.name || 'Walk-in'}
            </div>
            {order.customer?.phone && (
              <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{order.customer.phone}</div>
            )}
          </div>
          <div className="sm:text-right">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment</span>
            <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono text-[11px]">
              {formatPaymentMethod(order.payment_method)}
            </div>
            <div className={`text-[11px] font-bold mt-0.5 ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {isPaid ? 'Paid in Full' : 'Credit Unpaid'}
            </div>
          </div>
          <div className="col-span-2 mt-0.5">
            <span className="text-[10px] text-slate-400">Served by </span>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{order.salesperson?.name || 'Sales Staff'}</span>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2 px-1 w-6 text-center">#</th>
                <th className="py-2 px-2">Item</th>
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
                const lineTotal = item.quantity * (parseFloat(String(item.unit_price)) || 0);

                return (
                  <tr key={item.id || idx} className="align-top">
                    <td className="py-2.5 px-1 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2.5 px-2">
                      <div className="font-semibold text-slate-900 dark:text-white text-xs flex items-center flex-wrap gap-1">
                        <span>{item.variant?.product?.name || 'Device'}</span>
                        {specString && <span className="font-normal text-slate-400">· {specString}</span>}
                        {(unit?.source_type === 'exchange' || Boolean(unit?.exchange_sales_order_id)) && (
                          <span className="text-[10px] font-medium text-slate-400 font-sans">
                            Exchanged
                          </span>
                        )}
                        {(unit?.is_repaired || (unit?.maintenance_records && unit.maintenance_records.length > 0)) && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50">
                            <Wrench className="w-2.5 h-2.5" />
                            Repaired
                          </span>
                        )}
                        {Boolean(unit?.swapped_from_unit_id) && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                            <ArrowLeftRight className="w-2.5 h-2.5" />
                            Swapped Replacement
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 font-mono">
                        {unit?.imei_or_serial && (
                          <button
                            type="button"
                            onClick={() => handleCopyImei(unit.imei_or_serial!)}
                            title="Copy Serial Number"
                            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          >
                            <span>SN: {unit.imei_or_serial}</span>
                            {copiedImei === unit.imei_or_serial && <Check className="w-2.5 h-2.5 text-emerald-600" />}
                          </button>
                        )}
                        {unit?.battery_health != null && (
                          <span>· {unit.battery_health}% Batt</span>
                        )}
                        {simStr && simStr !== 'Physical SIM' && <span>· {simStr}</span>}
                        {conditionStr && <span>· {conditionStr}</span>}
                      </div>

                      {Boolean(unit?.swapped_from_unit || unit?.swapped_from_unit_id) && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-900/40 rounded-lg px-2 py-0.5 font-mono">
                          <ArrowLeftRight className="w-2.5 h-2.5 shrink-0" />
                          <span>
                            Replaced defective SN: <strong>{unit?.swapped_from_unit?.imei_or_serial || 'Original Unit'}</strong>
                            {unit?.swapped_at ? ` on ${new Date(unit.swapped_at).toLocaleDateString()}` : ''}
                          </span>
                        </div>
                      )}

                      {unit?.returned_at && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-900/40 rounded-lg px-2 py-1">
                          <Undo2 className="w-3 h-3 shrink-0" />
                          <span>
                            Customer returned on {new Date(unit.returned_at).toLocaleDateString()}
                            {unit.return_reason ? ` • ${unit.return_reason}` : ''}
                            {unit.status === 'in_stock' ? ' — Restocked in Inventory' : unit.status === 'fixed' ? ' — Repaired & Ready' : ' — Under Repair'}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center font-mono text-slate-700 dark:text-slate-300 font-bold">{item.quantity}</td>

                    <td className="py-2.5 px-2 text-right">
                      <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                        {Number(item.unit_price).toLocaleString()}
                        <span className="text-[9px] text-slate-400 font-sans">ETB</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-2 text-right">
                      <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                        {lineTotal.toLocaleString()}
                        <span className="text-[9px] text-slate-400 font-sans">ETB</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
          {grossAmount !== netPayable && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{grossAmount.toLocaleString()} ETB</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-rose-600 dark:text-rose-400">
              <span>Discount</span>
              <span className="font-mono tabular-nums">−{discountAmount.toLocaleString()} ETB</span>
            </div>
          )}
          {exchangeAllowance > 0 && (
            <div className="flex justify-between text-purple-700 dark:text-purple-300 font-semibold bg-purple-50/70 dark:bg-purple-950/30 px-2 py-1 rounded-lg border border-purple-200/60 dark:border-purple-800/40">
              <span className="flex items-center gap-1 text-[11px]">
                <Repeat className="w-3 h-3 text-purple-500" />
                Exchanged Device • {order.exchange_unit?.variant?.product?.name || 'Device'}
                {order.exchange_unit?.imei_or_serial ? ` · ${order.exchange_unit.imei_or_serial}` : ''}
              </span>
              <span className="font-mono tabular-nums whitespace-nowrap">{exchangeAllowance.toLocaleString()} ETB</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="font-bold text-slate-900 dark:text-white">
              {exchangeAllowance > 0 ? 'Cash Difference to Pay' : 'Total'}
            </span>
            <span className="inline-flex items-baseline gap-1 whitespace-nowrap font-black font-mono text-base text-slate-900 dark:text-white tabular-nums">
              {netPayable.toLocaleString()}
              <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
            </span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Amount Paid</span>
            <span className="font-mono tabular-nums font-semibold">{paidAmount.toLocaleString()} ETB</span>
          </div>
          {remainingDebt > 0 && (
            <div className="flex justify-between font-bold text-amber-600 dark:text-amber-400">
              <span>Balance Due</span>
              <span className="font-mono tabular-nums">{remainingDebt.toLocaleString()} ETB</span>
            </div>
          )}
          {!remainingDebt && (
            <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Balance</span>
              <span>Paid in Full</span>
            </div>
          )}
        </div>

        {/* Notes & Service History */}
        {order.notes && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Notes & Service History
            </span>
            <div className="text-slate-700 dark:text-slate-300 font-sans text-xs whitespace-pre-line bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60 leading-relaxed">
              {order.notes}
            </div>
          </div>
        )}

        {/* Warranty & Terms Notice */}
        <div className="text-[10px] text-slate-400 space-y-0.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Notice: </span>
          {tenant?.settings?.footer_note ||
            '7-day hardware defect coverage. Keep this receipt with serial number for claims. Physical or water damage excluded.'}
        </div>
      </div>

      {/* Internal Audit (Owner only, never printed) */}
      {canViewCost && (
        <div className="no-print border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/60 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={() => setShowInternalAudit(!showInternalAudit)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Internal Audit
            </span>
            <span className="flex items-center gap-2 font-mono text-emerald-600 dark:text-emerald-400">
              +{totalProfit.toLocaleString()} ETB margin
              {showInternalAudit ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            </span>
          </button>

          {showInternalAudit && (
            <div className="px-4 pb-4 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1.5 pt-3 animate-collapse-open">
              {order.items.map((item, idx) => {
                const isBrokered = item.sourcing_type === 'brokered_neighbour';
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 text-xs py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                        {item.variant?.product?.name}
                      </span>
                      {isBrokered ? (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <ArrowRightLeft className="w-3 h-3" />
                          {item.vendor_contact?.name || 'Neighbour'}
                        </span>
                      ) : (item.inventory_unit?.source_type === 'exchange' || Boolean(item.inventory_unit?.exchange_sales_order_id)) ? (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          Exchanged unit stock
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Shop stock</span>
                      )}
                    </div>
                    <div className="text-right font-mono shrink-0">
                      {item.unit_cost != null && <div className="text-[10px] text-slate-400">Cost: {Number(item.unit_cost).toLocaleString()} ETB</div>}
                      {item.bonus_amount != null && Number(item.bonus_amount) > 0 && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Agent bonus: +{Number(item.bonus_amount).toLocaleString()} ETB</div>
                      )}
                      <div className={`font-bold ${Number(item.profit || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
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

              {/* Financial Account Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Deposit Account <span className="text-rose-500">*</span>
                  </label>
                  {(() => {
                    const sel = internalAccounts.find((a) => a.id === collectAccountId);
                    return sel ? <AccountLogo account={sel} size="xs" /> : null;
                  })()}
                </div>
                <select
                  value={collectAccountId}
                  onChange={(e) => setCollectAccountId(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                >
                  {internalAccounts
                    .filter((a) => !a.is_custom_asset && a.is_active !== false)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} • {Number(acc.current_balance).toLocaleString()} ETB
                      </option>
                    ))}
                </select>
              </div>

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
