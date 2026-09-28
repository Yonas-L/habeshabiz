import React, { useState, useEffect } from 'react';
import type { InventoryUnit, User, Contact, SalesOrder } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { AnimatedNumber } from '../AnimatedNumber';
import { toast } from 'sonner';
import { formatPurchaseAge } from '../../utils/dateUtils';
import { formatCurrencyInput, parseFormattedNumber } from '../../utils/numberUtils';
import {
  Battery,
  RotateCcw,
  MapPin,
  DollarSign,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  UserCheck,
  Undo2,
  Wrench,
  Clock,
  Handshake,
  Edit3,
  X,
  ArrowLeftRight,
  Repeat,
  Receipt,
  ExternalLink,
} from 'lucide-react';

interface InventoryUnitDrawerProps {
  unit: InventoryUnit | null;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onRestockSuccess?: () => void;
  onSelectForSale?: (unit: InventoryUnit) => void;
  onOpenHandover?: (unit: InventoryUnit) => void;
  onOpenCustomerReturn?: (unit: InventoryUnit) => void;
  onOpenRepairedRestock?: (unit: InventoryUnit) => void;
  onOpenSwap?: (unit: InventoryUnit) => void;
  onOpenReceiveFixed?: (unit: InventoryUnit) => void;
  onOpenVendorSwap?: (unit: InventoryUnit) => void;
  onOpenMarkSold?: (unit: InventoryUnit) => void;
  onUnitUpdated?: (updatedUnit: InventoryUnit) => void;
  onViewSalesOrder?: (order: SalesOrder) => void;
}

const formatPaymentMethod = (method?: string) => {
  if (!method) return 'Cash';
  const map: Record<string, string> = {
    telebirr: 'Telebirr',
    cbe_birr: 'CBE Birr',
    cbe: 'Commercial Bank of Ethiopia (CBE)',
    cash: 'Cash on Hand',
    bank_transfer: 'Bank Transfer',
    amole: 'Amole',
    credit: 'Customer Credit',
  };
  return map[method.toLowerCase()] || method.replace(/_/g, ' ');
};

export const InventoryUnitDrawer: React.FC<InventoryUnitDrawerProps> = ({
  unit,
  isOpen,
  onClose,
  user,
  onRestockSuccess,
  onSelectForSale,
  onOpenHandover,
  onOpenCustomerReturn,
  onOpenRepairedRestock,
  onOpenSwap,
  onOpenReceiveFixed,
  onOpenVendorSwap,
  onOpenMarkSold,
  onUnitUpdated,
  onViewSalesOrder,
}) => {
  const [currentUnit, setCurrentUnit] = useState<InventoryUnit | null>(unit);
  const [copiedImei, setCopiedImei] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Editable form fields
  const [imei, setImei] = useState('');
  const [condition, setCondition] = useState('new');
  const [costBasis, setCostBasis] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [batteryHealth, setBatteryHealth] = useState('');
  const [cycleCount, setCycleCount] = useState('');
  const [simType, setSimType] = useState('physical');
  const [location, setLocation] = useState('Shop Counter');
  const [notes, setNotes] = useState('');
  const [supplierContactId, setSupplierContactId] = useState('');

  const canViewCost = user?.can_view_costs ?? false;
  const isOwner = user?.role === 'owner';

  const initForm = (u: InventoryUnit) => {
    setImei(u.imei_or_serial || '');
    setCondition(u.condition || 'new');
    setCostBasis(u.cost_basis !== undefined && u.cost_basis !== null ? formatCurrencyInput(u.cost_basis) : '');
    setSellingPrice(u.selling_price ? formatCurrencyInput(u.selling_price) : '');
    setBatteryHealth(u.battery_health !== null && u.battery_health !== undefined ? String(u.battery_health) : '');
    setCycleCount(u.cycle_count !== null && u.cycle_count !== undefined ? String(u.cycle_count) : '');
    setSimType(u.sim_type || 'physical');
    setLocation(u.location || 'Shop Counter');
    setNotes(u.notes || '');
    setSupplierContactId(u.supplier_contact_id || '');
  };

  useEffect(() => {
    setCurrentUnit(unit);
    setIsEditing(false);
    if (unit) {
      initForm(unit);
    }
  }, [unit]);

  useEffect(() => {
    if (isEditing && contacts.length === 0) {
      api.getContacts({ is_active: true }).then((data) => setContacts(data)).catch(() => {});
    }
  }, [isEditing]);

  if (!currentUnit) return null;

  // Margin calculation for edit mode & view mode
  const numCost = parseFormattedNumber(costBasis);
  const numSelling =
    parseFormattedNumber(sellingPrice) ??
    (currentUnit.variant?.default_selling_price ? Number(currentUnit.variant.default_selling_price) : null);
  const hasMargin = numCost !== null && numSelling !== null && numCost >= 0 && numSelling >= 0;
  const profit = hasMargin ? numSelling! - numCost! : null;
  const marginPercent = hasMargin && numSelling! > 0 ? ((profit! / numSelling!) * 100).toFixed(1) : null;

  const isInStock = currentUnit.status === 'in_stock';
  const isOut = currentUnit.status === 'out';
  const isSold = currentUnit.status === 'sold';
  const isReturned = currentUnit.status === 'returned';

  const productName = currentUnit.variant?.product?.name || 'Electronic Item';
  const specText = [currentUnit.variant?.storage, currentUnit.variant?.color].filter(Boolean).join(' • ');

  const handleCopyImei = () => {
    if (!currentUnit.imei_or_serial) return;
    navigator.clipboard.writeText(currentUnit.imei_or_serial);
    setCopiedImei(true);
    toast.success('Serial number copied', { description: currentUnit.imei_or_serial });
    setTimeout(() => setCopiedImei(false), 2000);
  };

  const handleRestockOut = async () => {
    try {
      setRestocking(true);
      await api.restockInventoryUnit(currentUnit.id);
      toast.success('Item Restocked to Shelf', {
        description: `${productName} (${currentUnit.imei_or_serial || 'Unit'}) is now back in stock.`,
      });
      if (onRestockSuccess) onRestockSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to restock item', { description: err.message });
    } finally {
      setRestocking(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUnit) return;

    try {
      setSaving(true);
      const payload: any = {
        imei_or_serial: imei.trim() || null,
        condition,
        sim_type: simType,
        location: location.trim() || 'Shop Counter',
        notes: notes.trim() || null,
        supplier_contact_id: supplierContactId || null,
      };

      const parsedCost = parseFormattedNumber(costBasis);
      if (parsedCost !== null) {
        payload.cost_basis = parsedCost;
      }

      const parsedSelling = parseFormattedNumber(sellingPrice);
      if (parsedSelling !== null) {
        payload.selling_price = parsedSelling;
      } else {
        payload.selling_price = null;
      }

      if (batteryHealth !== '') {
        payload.battery_health = parseInt(batteryHealth, 10);
      } else {
        payload.battery_health = null;
      }
      if (cycleCount !== '') {
        payload.cycle_count = parseInt(cycleCount, 10);
      } else {
        payload.cycle_count = null;
      }

      const res = await api.updateInventoryUnit(currentUnit.id, payload);
      const updatedUnit: InventoryUnit = (res as any)?.data ?? res;
      setCurrentUnit(updatedUnit);
      setIsEditing(false);
      toast.success('Device Details Updated', {
        description: `${productName} (${updatedUnit.imei_or_serial || 'Unit'}) information successfully updated.`,
      });
      if (onUnitUpdated) {
        onUnitUpdated(updatedUnit);
      }
    } catch (err: any) {
      toast.error('Failed to update device', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    if (isEditing) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
          <Edit3 className="w-3 h-3" />
          EDITING MODE
        </span>
      );
    }

    if (isInStock && currentUnit.source_type === 'consignment') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
          <Handshake className="w-3 h-3" />
          VENDOR STOCK
        </span>
      );
    }
    if (currentUnit.status === 'returned_to_vendor') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
          currentUnit.customer_waiting
            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200/60 dark:border-slate-700/60'
        }`}>
          {currentUnit.customer_waiting ? <Clock className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
          {currentUnit.customer_waiting ? 'WITH VENDOR • WAITING' : 'WITH VENDOR'}
        </span>
      );
    }
    if (isInStock) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
          <CheckCircle2 className="w-3 h-3" />
          IN STOCK
        </span>
      );
    }
    if (isOut) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
          <Clock className="w-3 h-3" />
          OUT FOR SALE
        </span>
      );
    }
    if (currentUnit.is_swapped && currentUnit.status === 'returned') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
          <ArrowLeftRight className="w-3 h-3" />
          SWAPPED
        </span>
      );
    }
    if (isSold) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
          <CheckCircle2 className="w-3 h-3" />
          SOLD
        </span>
      );
    }
    if (currentUnit.status === 'fixed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
          <CheckCircle2 className="w-3 h-3" />
          REPAIRED & FIXED
        </span>
      );
    }
    if (isReturned) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
          <AlertCircle className="w-3 h-3" />
          CUSTOMER RETURN
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
        {currentUnit.status.toUpperCase()}
      </span>
    );
  };

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Device • ${productName}` : productName}
      subtitle={specText || 'Hardware Specification'}
      badge={getStatusBadge()}
      headerActions={
        <div className="flex items-center gap-1.5">
          {currentUnit.imei_or_serial && !isEditing && (
            <button
              onClick={handleCopyImei}
              title="Copy Serial Number"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {copiedImei ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  initForm(currentUnit);
                  setIsEditing(false);
                } else {
                  initForm(currentUnit);
                  setIsEditing(true);
                }
              }}
              title={isEditing ? 'Cancel Edit' : 'Edit Device Information'}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isEditing
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/60'
              }`}
            >
              {isEditing ? <X className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span>{isEditing ? 'Cancel' : 'Edit'}</span>
            </button>
          )}
        </div>
      }
      footerActions={
        isEditing ? (
          <>
            <button
              type="button"
              onClick={() => {
                initForm(currentUnit);
                setIsEditing(false);
              }}
              disabled={saving}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save Changes</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {/* Edit Details Button in footer for fast access */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    initForm(currentUnit);
                    setIsEditing(true);
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  title="Edit device serial, condition, cost basis, or diagnostics"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Edit</span>
                </button>
              )}

              {/* IN STOCK: Handover (Owner Only) or Sell (Everyone) */}
              {isInStock && (
                <>
                  {isOwner && onOpenHandover && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenHandover(currentUnit);
                        onClose();
                      }}
                      className="h-9 px-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Handover</span>
                    </button>
                  )}

                  {onSelectForSale && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectForSale(currentUnit);
                        onClose();
                      }}
                      className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Sell at Counter</span>
                    </button>
                  )}
                </>
              )}

              {/* OUT FOR SALE: Mark Sold or Restock to Shelf (Owner Only) */}
              {isOut && isOwner && (
                <div className="flex items-center gap-2">
                  {onOpenMarkSold && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMarkSold(currentUnit);
                        onClose();
                      }}
                      className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Sold</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={restocking}
                    onClick={handleRestockOut}
                    className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    {restocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>Restock Unsold</span>
                  </button>
                </div>
              )}

              {/* SOLD: Warranty Swap & Customer Return */}
              {isSold && onOpenSwap && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSwap(currentUnit);
                    onClose();
                  }}
                  className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Warranty Swap</span>
                </button>
              )}

              {isSold && isOwner && onOpenCustomerReturn && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenCustomerReturn(currentUnit);
                    onClose();
                  }}
                  className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Process Customer Return</span>
                </button>
              )}

              {/* RETURNED / FIXED: Repaired & Restock (Owner Only) */}
              {(isReturned || currentUnit.status === 'fixed') && isOwner && onOpenRepairedRestock && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenRepairedRestock(currentUnit);
                    onClose();
                  }}
                  className={`h-9 px-4 rounded-xl text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 ${
                    currentUnit.status === 'fixed' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Restock Repaired Device</span>
                </button>
              )}

              {/* WITH VENDOR: Receive Fixed & Vendor Swap (Owner Only) */}
              {currentUnit.status === 'returned_to_vendor' && isOwner && (
                <>
                  {onOpenReceiveFixed && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenReceiveFixed(currentUnit);
                        onClose();
                      }}
                      className="h-9 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Receive Fixed</span>
                    </button>
                  )}
                  {onOpenVendorSwap && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenVendorSwap(currentUnit);
                        onClose();
                      }}
                      className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Vendor Swap</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )
      }
    >
      {/* -------------------- EDIT MODE FORM -------------------- */}
      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Modify device serial, condition, cost basis, or diagnostics</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60">
              Live Edit
            </span>
          </div>

          {/* Section 1: Identification & Condition */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 space-y-3 shadow-2xs">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Serial Number & Condition
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  placeholder="e.g. 2345678654399"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white capitalize focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                >
                  <option value="new">Brand New</option>
                  <option value="used_clean">Used Clean</option>
                  <option value="scratched">Scratched</option>
                  <option value="backcrack">Back Crack</option>
                  <option value="screen_blemish">Screen Blemish</option>
                  <option value="defective">Defective</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Valuation */}
          {(canViewCost || isOwner) && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 space-y-3 shadow-2xs">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Cost Basis & Retail Valuation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cost Basis ETB
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={costBasis}
                    onChange={(e) => setCostBasis(formatCurrencyInput(e.target.value))}
                    placeholder="e.g. 50,000"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Capital purchase cost for this specific device
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Selling Price ETB
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(formatCurrencyInput(e.target.value))}
                    placeholder={
                      currentUnit.variant?.default_selling_price
                        ? `Default: ${Number(currentUnit.variant.default_selling_price).toLocaleString()} ETB`
                        : 'e.g. 80,000'
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Unit price override. Leave empty for catalog price.
                  </span>
                </div>

                {/* Minimal Projected Margin Indicator */}
                {hasMargin && profit !== null && (
                  <div className="sm:col-span-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Projected Gross Margin:
                      {sellingPrice === '' && currentUnit.variant?.default_selling_price && (
                        <span className="text-[10px] text-slate-400 ml-1">• Catalog default</span>
                      )}
                    </span>
                    <div className="flex items-center gap-2 font-mono font-bold">
                      <span className={profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {profit >= 0 ? `+${profit.toLocaleString()}` : profit.toLocaleString()} ETB
                      </span>
                      <span
                        className={`text-[10px] font-sans px-2 py-0.5 rounded-full font-bold ${
                          profit >= 0
                            ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            : 'bg-rose-100/80 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                        }`}
                      >
                        {marginPercent}% margin
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Hardware & Diagnostics */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 space-y-3 shadow-2xs">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Hardware & Diagnostics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Battery Health
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={batteryHealth}
                    onChange={(e) => setBatteryHealth(e.target.value)}
                    placeholder="100"
                    className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 pointer-events-none">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cycle Count
                </label>
                <input
                  type="number"
                  min="0"
                  value={cycleCount}
                  onChange={(e) => setCycleCount(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SIM Configuration
                </label>
                <select
                  value={simType}
                  onChange={(e) => setSimType(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                >
                  <option value="physical">Physical SIM</option>
                  <option value="esim">eSIM Only</option>
                  <option value="dual">Dual SIM</option>
                  <option value="na">Not Applicable</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Location, Sourcing & Notes */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-100 dark:border-slate-800 space-y-3 shadow-2xs">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Shop Location & Intake Details
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Shop Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Shop Counter"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {['Shop Counter', 'Display Cabinet', 'Safe Backroom', 'Warehouse'].map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(loc)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        location === loc
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Contact
                </label>
                <select
                  value={supplierContactId}
                  onChange={(e) => setSupplierContactId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                >
                  <option value="">No Supplier Assigned</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `• ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Intake Notes & Inspection Details
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Clean intake unit, standard store inspection verified."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* -------------------- VIEW MODE -------------------- */
        <>
          {/* Handover Notice Banner if OUT */}
          {isOut && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Currently Out with Staff</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 font-semibold">
                  Handover
                </span>
              </div>

              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Handed out to: <strong className="font-semibold">{currentUnit.handover_to || 'Sales Staff'}</strong>
                {currentUnit.handed_out_at && ` • Since ${new Date(currentUnit.handed_out_at).toLocaleDateString()}`}
              </p>

              {(currentUnit.handover_payout || currentUnit.return_deadline) && (
                <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                  {currentUnit.handover_payout && (
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Agreed Payout:</span>
                      <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">
                        {Number(currentUnit.handover_payout).toLocaleString()} ETB
                      </div>
                    </div>
                  )}
                  {currentUnit.return_deadline && (
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Return Window:</span>
                      <div className="text-xs font-bold mt-0.5">
                        {new Date(currentUnit.return_deadline) < new Date() ? (
                          <span className="text-rose-600 dark:text-rose-400">Return Overdue</span>
                        ) : (
                          <span className="text-amber-800 dark:text-amber-300">
                            By {new Date(currentUnit.return_deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Customer Return Notice Banner if RETURNED */}
          {isReturned && (
            <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-xs text-rose-900 dark:text-rose-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Customer Return Under Inspection</span>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-300">
                Reason: <strong className="font-semibold">{currentUnit.return_reason || 'Defect reported'}</strong>
                {currentUnit.returned_at && ` • ${new Date(currentUnit.returned_at).toLocaleDateString()}`}
              </p>
            </div>
          )}

          {/* Fixed & Ready Notice Banner if FIXED */}
          {currentUnit.status === 'fixed' && (
            <div className="p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 text-xs text-teal-900 dark:text-teal-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>Repairs Completed — Ready to Restock</span>
              </div>
              <p className="text-[11px] text-teal-700 dark:text-teal-300">
                Maintenance expense recorded. Click Restock below to capitalize repair costs and return device to active shelf stock.
              </p>
            </div>
          )}

          {/* With Vendor Notice Banner if RETURNED_TO_VENDOR */}
          {currentUnit.status === 'returned_to_vendor' && (
            <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              currentUnit.customer_waiting
                ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200'
            }`}>
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {currentUnit.customer_waiting ? (
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <RotateCcw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  )}
                  <span>
                    {currentUnit.customer_waiting
                      ? 'With Vendor for Repair • Customer Waiting'
                      : 'Returned to Vendor'}
                  </span>
                </div>
                {currentUnit.customer_waiting && currentUnit.sales_order_item?.sales_order?.order_number && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                    Order #{currentUnit.sales_order_item.sales_order.order_number}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed">
                {currentUnit.return_reason ? (
                  <>Issue: <strong className="font-semibold">{currentUnit.return_reason}</strong></>
                ) : (
                  'Device sent to vendor for resolution.'
                )}
                {currentUnit.customer_waiting_at && ` • Sent ${new Date(currentUnit.customer_waiting_at).toLocaleDateString()}`}
              </p>
              {currentUnit.customer_waiting && currentUnit.sales_order_item?.sales_order?.customer && (
                <div className="text-[11px] pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between">
                  <span>Customer: <strong className="font-semibold">{currentUnit.sales_order_item.sales_order.customer.name}</strong></span>
                  {currentUnit.sales_order_item.sales_order.customer.phone && (
                    <span className="font-mono text-slate-500">{currentUnit.sales_order_item.sales_order.customer.phone}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Vendor Consignment Notice Banner */}
          {currentUnit.source_type === 'consignment' && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Handshake className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Vendor Consignment Stock</span>
                </div>
                {currentUnit.supplier && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                    {currentUnit.supplier.name}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] pt-1">
                {currentUnit.cost_basis && (
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Agreed Vendor Cut:</span>
                    <div className="font-mono font-bold text-amber-900 dark:text-amber-200 text-xs mt-0.5">
                      {Number(currentUnit.cost_basis).toLocaleString()} ETB
                    </div>
                  </div>
                )}
                {(currentUnit.selling_price || currentUnit.variant?.default_selling_price) && (
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Retail Price:
                    </span>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                      {Number(currentUnit.selling_price || currentUnit.variant?.default_selling_price).toLocaleString()} ETB
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Partner Net Position & Effective Payout Required */}
              {currentUnit.supplier && typeof currentUnit.supplier.net_balance === 'number' && (
                <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-600 dark:text-slate-400">
                      Partner Rolling Balance:
                    </span>
                    <span className={`font-mono font-bold text-xs ${
                      currentUnit.supplier.net_balance > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : currentUnit.supplier.net_balance < 0
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}>
                      {currentUnit.supplier.net_balance > 0
                        ? `+${currentUnit.supplier.net_balance.toLocaleString()} ETB • Owes us`
                        : currentUnit.supplier.net_balance < 0
                        ? `${currentUnit.supplier.net_balance.toLocaleString()} ETB • We owe`
                        : '0.00 ETB • Settled'}
                    </span>
                  </div>

                  {/* Effective Cash Payout Required */}
                  <div className="flex items-center justify-between text-[11px] bg-amber-100/60 dark:bg-amber-900/40 p-2 rounded-lg">
                    <span className="text-amber-950 dark:text-amber-100 font-medium">
                      Net Payout Due on Partner:
                    </span>
                    <span className="font-mono font-bold text-amber-900 dark:text-amber-100">
                      {currentUnit.supplier.net_balance >= 0
                        ? '0 ETB • Covered by handovers'
                        : `${Math.min(Math.abs(currentUnit.supplier.net_balance), Number(currentUnit.cost_basis)).toLocaleString()} ETB${
                            Math.abs(currentUnit.supplier.net_balance) < Number(currentUnit.cost_basis)
                              ? ' • Reduced by handover offsets'
                              : ''
                          }`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Customer Exchange Notice Banner */}
          {currentUnit.source_type === 'exchange' && (
            <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 space-y-2">
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Customer Exchange Item</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px] pt-1">
                {currentUnit.cost_basis && (
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Exchanged Value:</span>
                    <div className="font-mono font-bold text-purple-900 dark:text-purple-200 text-xs mt-0.5">
                      {Number(currentUnit.cost_basis).toLocaleString()} ETB
                    </div>
                  </div>
                )}
                {(currentUnit.selling_price || currentUnit.variant?.default_selling_price) && (
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      Retail Price:
                    </span>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                      {Number(currentUnit.selling_price || currentUnit.variant?.default_selling_price).toLocaleString()} ETB
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sold Device Notice Banner */}
          {isSold && (
            <div className="p-3.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 space-y-2">
              <div className="font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Sold Device Record</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200/60 dark:bg-purple-800/50 text-purple-800 dark:text-purple-300 font-semibold font-mono">
                  {formatPurchaseAge(currentUnit.created_at)} since purchase
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Date Sold:</span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {currentUnit.sold_at
                      ? new Date(currentUnit.sold_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Recorded as Sold'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Date Purchased:</span>
                  <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {currentUnit.created_at
                      ? new Date(currentUnit.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </div>
                </div>

                {currentUnit.sales_order_item?.sales_order && (
                  <>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Sales Order:</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono font-bold text-purple-700 dark:text-purple-300">
                          #{currentUnit.sales_order_item.sales_order.order_number}
                        </span>
                        {onViewSalesOrder && (
                          <button
                            type="button"
                            onClick={() => onViewSalesOrder(currentUnit.sales_order_item!.sales_order!)}
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                            title="View Sales Order Receipt"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>View</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Customer:</span>
                      <div className="font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                        {currentUnit.sales_order_item.sales_order.customer?.name || 'Walk-in Customer'}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Final Sale Price:</span>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {Number(currentUnit.sales_order_item.unit_price).toLocaleString()} ETB
                      </div>
                    </div>

                    {currentUnit.sales_order_item.sales_order.salesperson && (
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Salesperson:</span>
                        <div className="font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                          {currentUnit.sales_order_item.sales_order.salesperson.name}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Trade-In and Settlement Details */}
              {currentUnit.sales_order_item?.sales_order && (() => {
                const so = currentUnit.sales_order_item.sales_order;
                const exchangeAllowance = Number(so.exchange_allowance || 0);
                const hasExchange = exchangeAllowance > 0 || Boolean(so.exchange_unit_id) || Boolean(so.exchange_unit);
                const exUnit = so.exchange_unit;
                const paidCash = Number(so.paid_amount || 0);
                const totalOrderPrice = Number(so.total_amount || currentUnit.sales_order_item.unit_price || 0);
                const isPaid = so.payment_status === 'paid' || (hasExchange && (paidCash + exchangeAllowance >= totalOrderPrice));

                return (
                  <div className="pt-2.5 border-t border-purple-200/70 dark:border-purple-800/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1">
                        {hasExchange ? <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400" /> : <Receipt className="w-3 h-3 text-purple-600 dark:text-purple-400" />}
                        {hasExchange ? 'Trade-In Settlement Breakdown' : 'Payment Method & Settlement'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                        {isPaid ? 'Settled in Full' : 'Credit Balance Due'}
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-2.5 border border-purple-200/50 dark:border-purple-800/40 space-y-2 text-[11px]">
                      {hasExchange && (
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">Customer Traded-In Device:</span>
                            <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1 flex-wrap">
                              <span>{exUnit?.variant?.product?.name || 'Customer Trade-in Device'}</span>
                              {[exUnit?.variant?.storage, exUnit?.variant?.color].filter(Boolean).length > 0 && (
                                <span className="font-normal text-slate-500 text-[10px]">
                                  ({[exUnit?.variant?.storage, exUnit?.variant?.color].filter(Boolean).join(' • ')})
                                </span>
                              )}
                            </div>
                            {exUnit?.imei_or_serial && (
                              <div className="font-mono text-[10px] text-purple-700 dark:text-purple-400 mt-0.5">
                                SN: {exUnit.imei_or_serial}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-purple-700 dark:text-purple-300 text-xs">
                              −{exchangeAllowance.toLocaleString()} ETB
                            </div>
                            <span className="text-[9px] text-purple-600 dark:text-purple-400 font-medium">Trade Allowance</span>
                          </div>
                        </div>
                      )}

                      <div className={`flex items-start justify-between gap-2 ${hasExchange ? 'pt-2 border-t border-slate-100 dark:border-slate-800' : ''}`}>
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                            {hasExchange ? 'Cash / Transfer Settlement:' : 'Direct Payment:'}
                          </span>
                          <div className="font-semibold text-slate-900 dark:text-white mt-0.5">
                            {formatPaymentMethod(so.payment_method)}
                          </div>
                          {so.financial_account?.name && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Account: {so.financial_account.name}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            +{paidCash.toLocaleString()} ETB
                          </div>
                          <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                            {hasExchange ? 'Cash Difference' : 'Amount Paid'}
                          </span>
                        </div>
                      </div>

                      {hasExchange && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-purple-100 dark:border-purple-800/40 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                          <span>Settlement Formula:</span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {exchangeAllowance.toLocaleString()} trade + {paidCash.toLocaleString()} cash = {(exchangeAllowance + paidCash).toLocaleString()} ETB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Warranty Swap Record Card */}
          {(currentUnit.is_swapped || currentUnit.swapped_from_unit || currentUnit.swapped_replacement_unit) && (
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>
                    {currentUnit.swapped_from_unit
                      ? 'Warranty Replacement Unit'
                      : 'Warranty Swapped Defective Device'}
                  </span>
                </div>
                {currentUnit.swapped_at && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono bg-amber-100/80 dark:bg-amber-900/40 px-2 py-0.5 rounded-full font-semibold">
                    {new Date(currentUnit.swapped_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40 text-[11px]">
                {/* Counterpart device */}
                {currentUnit.swapped_replacement_unit && (
                  <div>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium block">
                      Replacement Device:
                    </span>
                    <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {currentUnit.swapped_replacement_unit.imei_or_serial || 'Serialized Unit'}
                    </div>
                    {currentUnit.swapped_replacement_unit.variant?.product?.name && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {currentUnit.swapped_replacement_unit.variant.product.name}
                      </div>
                    )}
                  </div>
                )}

                {currentUnit.swapped_from_unit && (
                  <div>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium block">
                      Replaced Defective Unit:
                    </span>
                    <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {currentUnit.swapped_from_unit.imei_or_serial || 'Serialized Unit'}
                    </div>
                    {currentUnit.swapped_from_unit.variant?.product?.name && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {currentUnit.swapped_from_unit.variant.product.name}
                      </div>
                    )}
                  </div>
                )}

                {/* Associated Sales Order */}
                {(currentUnit.swapped_sales_order || currentUnit.sales_order_item?.sales_order) && (
                  <div>
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium block">
                      Sales Order:
                    </span>
                    <div className="font-mono font-bold text-purple-700 dark:text-purple-300 mt-0.5">
                      #{currentUnit.swapped_sales_order?.order_number || currentUnit.sales_order_item?.sales_order?.order_number}
                    </div>
                  </div>
                )}

                {/* Defect reason */}
                {currentUnit.return_reason && (
                  <div className="col-span-2">
                    <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium block">
                      Reported Defect:
                    </span>
                    <div className="font-medium text-amber-950 dark:text-amber-100 mt-0.5">
                      {currentUnit.return_reason.replace(/^\[Warranty Swap\]\s*/, '')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clean Device Overview Block */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Serial Number
              </span>
              <div
                onClick={handleCopyImei}
                className="flex items-center gap-2 cursor-pointer group select-all"
                title="Click to copy IMEI"
              >
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 group-hover:underline">
                  {currentUnit.imei_or_serial || 'Bulk Item'}
                </span>
                {copiedImei ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Condition:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                  {currentUnit.condition.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {canViewCost && currentUnit.cost_basis && (
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cost Basis
                </span>
                <div className="text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  <AnimatedNumber value={parseFloat(String(currentUnit.cost_basis))} />{' '}
                  <span className="text-xs font-normal text-slate-400 font-sans">ETB</span>
                </div>
                {currentUnit.selling_price && (
                  <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Retail: {Number(currentUnit.selling_price).toLocaleString()} ETB
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Maintenance & Capitalized Cost History Card */}
          {currentUnit.maintenance_records && currentUnit.maintenance_records.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <span>Maintenance & Capitalized Value</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                  {currentUnit.maintenance_records.length} {currentUnit.maintenance_records.length === 1 ? 'Expense' : 'Expenses'}
                </span>
              </div>

              {/* Cost and Value Breakdown */}
              {(() => {
                const currentCost = Number(currentUnit.cost_basis || 0);
                const shopMaintenance = currentUnit.maintenance_records
                  .filter((r) => r.billing_type !== 'vendor_deduct' && r.billing_type !== 'vendor_reimburse')
                  .reduce((acc, r) => acc + Number(r.cost), 0);
                const vendorMaintenance = currentUnit.maintenance_records
                  .filter((r) => r.billing_type === 'vendor_deduct' || r.billing_type === 'vendor_reimburse')
                  .reduce((acc, r) => acc + Number(r.cost), 0);
                const totalMaintenance = shopMaintenance + vendorMaintenance;
                const retailPrice = Number(currentUnit.selling_price || currentUnit.variant?.default_selling_price || 0);
                const margin = retailPrice > 0 && currentCost > 0 ? retailPrice - currentCost : undefined;

                return (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white dark:bg-[#151b26] border border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total Repair Investment:</span>
                        <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                          +{totalMaintenance.toLocaleString()} ETB
                        </span>
                        {vendorMaintenance > 0 && (
                          <span className="text-[9px] text-blue-600 dark:text-blue-400 block font-medium">
                            • {vendorMaintenance.toLocaleString()} ETB vendor covered
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Adjusted Unit Cost:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {currentCost.toLocaleString()} ETB
                        </span>
                      </div>
                      {retailPrice > 0 && (
                        <div>
                          <span className="text-[10px] text-slate-400 block">
                            {currentUnit.selling_price ? 'Target Unit Sale Value:' : 'Variant Retail Value:'}
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {retailPrice.toLocaleString()} ETB
                          </span>
                        </div>
                      )}
                      {margin !== undefined && (
                        <div>
                          <span className="text-[10px] text-slate-400 block">Projected Profit:</span>
                          <span className={`font-mono font-bold text-xs ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                            {margin.toLocaleString()} ETB
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Maintenance Expense Log
                      </span>
                      {currentUnit.maintenance_records.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-2 rounded-xl bg-white/80 dark:bg-[#151b26]/80 border border-slate-200/40 dark:border-slate-800/60 flex items-center justify-between text-[11px]"
                        >
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {rec.description}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {new Date(rec.date).toLocaleDateString()} {rec.financial_account?.name ? `• ${rec.financial_account.name}` : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                              +{Number(rec.cost).toLocaleString()} ETB
                            </div>
                            <span className={`text-[9px] font-semibold ${
                              rec.billing_type === 'vendor_deduct' || rec.billing_type === 'vendor_reimburse'
                                ? 'text-blue-600 dark:text-blue-400'
                                : rec.is_capitalized
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-500'
                            }`}>
                              {rec.billing_type === 'vendor_deduct'
                                ? 'Vendor Deducted'
                                : rec.billing_type === 'vendor_reimburse'
                                ? 'Vendor Reimbursement'
                                : rec.is_capitalized
                                ? 'Capitalized'
                                : 'Pending Restock'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Clean Unified Hardware & Device Details Grid */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Hardware & Diagnostics
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
              {/* Battery Health */}
              {currentUnit.battery_health !== null && currentUnit.battery_health !== undefined && (
                <div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Battery Health</span>
                  <div className="text-sm font-bold font-mono text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                    <Battery className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{currentUnit.battery_health}%</span>
                    {currentUnit.cycle_count ? (
                      <span className="text-[10px] font-normal text-slate-400 font-sans">
                        • {currentUnit.cycle_count} cycles
                      </span>
                    ) : null}
                  </div>
                </div>
              )}

              {/* SIM Configuration */}
              <div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">SIM Configuration</span>
                <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {currentUnit.sim_type === 'physical'
                    ? 'Physical SIM'
                    : currentUnit.sim_type === 'esim'
                    ? 'eSIM Only'
                    : currentUnit.sim_type === 'dual'
                    ? 'Dual SIM'
                    : 'Not Applicable'}
                </div>
              </div>

              {/* Shop Location */}
              <div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Shop Location</span>
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{currentUnit.location || 'Display Counter'}</span>
                </div>
              </div>

              {/* Cosmetic Grade */}
              <div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Cosmetic Grade</span>
                <div className="text-sm font-semibold capitalize text-slate-900 dark:text-white mt-0.5">
                  {currentUnit.condition.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          </div>

          {/* Intake Notes & History Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Intake & Sourcing Details
              </h4>
              {currentUnit.created_at && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Received {new Date(currentUnit.created_at).toLocaleDateString()} • {formatPurchaseAge(currentUnit.created_at)} ago
                </span>
              )}
            </div>
            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 text-xs text-slate-700 dark:text-slate-300 font-normal leading-relaxed space-y-1.5">
              {currentUnit.supplier && (
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <span className="text-slate-400">Supplier:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{currentUnit.supplier.name}</span>
                </div>
              )}
              <div>{currentUnit.notes || 'Clean intake unit, standard store inspection verified.'}</div>
            </div>
          </div>
        </>
      )}
    </SlideOverDrawer>
  );
};
