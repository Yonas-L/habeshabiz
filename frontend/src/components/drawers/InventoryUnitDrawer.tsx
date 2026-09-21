import React, { useState } from 'react';
import type { InventoryUnit, User } from '../../api/client';
import { api } from '../../api/client';
import { SlideOverDrawer } from './SlideOverDrawer';
import { ProgressiveSection } from './ProgressiveSection';
import { AnimatedNumber } from '../AnimatedNumber';
import { toast } from 'sonner';
import {
  Battery,
  RotateCcw,
  Tag,
  MapPin,
  DollarSign,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Cpu,
  UserCheck,
  Undo2,
  Wrench,
  Clock,
  Handshake,
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
}

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
}) => {
  const [copiedImei, setCopiedImei] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const canViewCost = user?.can_view_costs ?? false;
  const isOwner = user?.role === 'owner';

  if (!unit) return null;

  const isInStock = unit.status === 'in_stock';
  const isOut = unit.status === 'out';
  const isSold = unit.status === 'sold';
  const isReturned = unit.status === 'returned';

  const productName = unit.variant?.product?.name || 'Electronic Item';
  const specText = [unit.variant?.storage, unit.variant?.color].filter(Boolean).join(' • ');

  const handleCopyImei = () => {
    if (!unit.imei_or_serial) return;
    navigator.clipboard.writeText(unit.imei_or_serial);
    setCopiedImei(true);
    toast.success('Serial/IMEI copied', { description: unit.imei_or_serial });
    setTimeout(() => setCopiedImei(false), 2000);
  };

  const handleRestockOut = async () => {
    try {
      setRestocking(true);
      await api.restockInventoryUnit(unit.id);
      toast.success('Item Restocked to Shelf', {
        description: `${productName} (${unit.imei_or_serial || 'Unit'}) is now back in stock.`,
      });
      if (onRestockSuccess) onRestockSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to restock item', { description: err.message });
    } finally {
      setRestocking(false);
    }
  };

  const getStatusBadge = () => {
    if (isInStock && unit.source_type === 'consignment') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
          <Handshake className="w-3 h-3" />
          VENDOR STOCK
        </span>
      );
    }
    if (unit.status === 'returned_to_vendor') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
          <RotateCcw className="w-3 h-3" />
          RETURNED TO BROKER
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
    if (isSold) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60">
          <CheckCircle2 className="w-3 h-3" />
          SOLD
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
        {unit.status.toUpperCase()}
      </span>
    );
  };

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={productName}
      subtitle={specText || 'Hardware Specification'}
      badge={getStatusBadge()}
      headerActions={
        unit.imei_or_serial ? (
          <button
            onClick={handleCopyImei}
            title="Copy Serial/IMEI"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {copiedImei ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        ) : null
      }
      footerActions={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Close (Esc)
          </button>

          <div className="flex items-center gap-2">
            {/* IN STOCK: Handover (Owner Only) or Sell (Everyone) */}
            {isInStock && (
              <>
                {isOwner && onOpenHandover && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenHandover(unit);
                      onClose();
                    }}
                    className="h-9 px-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Handover / Mark Out</span>
                  </button>
                )}

                {onSelectForSale && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectForSale(unit);
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

            {/* OUT FOR SALE: Restock to Shelf (Owner Only) */}
            {isOut && isOwner && (
              <button
                type="button"
                disabled={restocking}
                onClick={handleRestockOut}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                {restocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restock Unsold to Shelf</span>
              </button>
            )}

            {/* SOLD: Customer Return ONLY (Owner Only) */}
            {isSold && isOwner && onOpenCustomerReturn && (
              <button
                type="button"
                onClick={() => {
                  onOpenCustomerReturn(unit);
                  onClose();
                }}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Process Customer Return</span>
              </button>
            )}

            {/* RETURNED: Repaired & Restock (Owner Only) */}
            {isReturned && isOwner && onOpenRepairedRestock && (
              <button
                type="button"
                onClick={() => {
                  onOpenRepairedRestock(unit);
                  onClose();
                }}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Repaired & Restock to Shelf</span>
              </button>
            )}
          </div>
        </>
      }
    >
      {/* Handover Notice Banner if OUT */}
      {isOut && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <div className="font-bold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Currently Out with Staff / Broker</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 font-semibold">
              Handover Agreement
            </span>
          </div>

          <p className="text-[11px] text-amber-700 dark:text-amber-300">
            Handed out to: <strong className="font-semibold">{unit.handover_to || 'Sales Staff'}</strong>
            {unit.handed_out_at && ` • Since ${new Date(unit.handed_out_at).toLocaleDateString()}`}
          </p>

          <div className="grid grid-cols-2 gap-2.5 text-[11px] pt-1">
            {unit.handover_payout && (
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-800/30">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Agreed Vendor Payout:</span>
                <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs mt-0.5">
                  {Number(unit.handover_payout).toLocaleString()} ETB
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">Receivable holding in Debt Collector</span>
              </div>
            )}
            {unit.return_deadline && (
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-800/30">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Return Window:</span>
                <div className="text-xs font-bold mt-0.5">
                  {new Date(unit.return_deadline) < new Date() ? (
                    <span className="text-rose-600 dark:text-rose-400">Return Overdue</span>
                  ) : (
                    <span className="text-amber-800 dark:text-amber-300">
                      By {new Date(unit.return_deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {new Date(unit.return_deadline) < new Date()
                    ? 'Expired deadline'
                    : `${Math.max(0, Math.ceil((new Date(unit.return_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left`}
                </span>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight pt-1">
            When the vendor sells and pays you, settle the payment through Debt Collector to automatically mark this device as sold. If returned unsold, restock below to cancel the holding.
          </p>
        </div>
      )}

      {/* Customer Return Notice Banner if RETURNED */}
      {isReturned && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-900 dark:text-rose-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Customer Return Under Inspection / Repair</span>
          </div>
          <p className="text-[11px] text-rose-700 dark:text-rose-300">
            Return Reason: <strong className="font-semibold">{unit.return_reason || 'Defect reported'}</strong>
            {unit.returned_at && ` • Returned on ${new Date(unit.returned_at).toLocaleDateString()}`}
          </p>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
            Once repaired and tested, click "Repaired & Restock to Shelf" to place back into stock.
          </p>
        </div>
      )}

      {/* Vendor Consignment Notice Banner */}
      {unit.source_type === 'consignment' && (
        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
          <div className="font-bold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Vendor Consignment Stock</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 font-semibold">
              Broker Agreement
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-[11px] pt-1">
            {unit.cost_basis && (
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-800/30">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Agreed Vendor Payout:</span>
                <div className="font-mono font-bold text-amber-900 dark:text-amber-200 text-xs mt-0.5">
                  {Number(unit.cost_basis).toLocaleString()} ETB
                </div>
              </div>
            )}
            {unit.variant?.default_selling_price && (
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-800/30">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Retail Price:</span>
                <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">
                  {Number(unit.variant.default_selling_price).toLocaleString()} ETB
                </div>
              </div>
            )}
          </div>
          {unit.return_deadline && (
            <div className="pt-1 text-[11px] font-medium">
              {new Date(unit.return_deadline) < new Date() ? (
                <span className="text-rose-600 dark:text-rose-400 font-bold">
                  ⚠ Return deadline passed · {new Date(unit.return_deadline).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-300">
                  Return deadline: {new Date(unit.return_deadline).toLocaleDateString()} (
                  {Math.max(0, Math.ceil((new Date(unit.return_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}{' '}
                  days left)
                </span>
              )}
            </div>
          )}
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
            When sold, payment tops up shop balance and creates a payable debt to the vendor for their cut.
          </p>
        </div>
      )}

      {/* Hero Serial & Valuation Strip */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Device Serial / IMEI
          </span>
          <div className="text-sm font-black font-mono tracking-tight text-slate-900 dark:text-white mt-0.5">
            {unit.imei_or_serial || 'NO_SERIAL_RECORDED'}
          </div>
          <div className="text-xs text-slate-400 capitalize mt-1">
            Condition: <strong className="text-slate-700 dark:text-slate-300">{unit.condition.replace(/_/g, ' ')}</strong>
          </div>
        </div>

        {canViewCost && unit.cost_basis && (
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Cost Basis
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
              <AnimatedNumber value={parseFloat(String(unit.cost_basis))} />{' '}
              <span className="text-xs font-bold text-slate-400 font-sans">ETB</span>
            </div>
          </div>
        )}
      </div>

      {/* Progressive Section 1: Device Diagnostics & Hardware Health */}
      <ProgressiveSection
        title="Hardware Health & Diagnostics"
        icon={<Cpu className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Battery Health */}
          {unit.battery_health !== null && unit.battery_health !== undefined && (
            <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Battery Health
                </span>
                <Battery className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {unit.battery_health}%
              </div>
              {unit.cycle_count ? (
                <div className="text-[10px] text-slate-400">
                  {unit.cycle_count} Charge Cycles
                </div>
              ) : null}
            </div>
          )}

          {/* SIM Type */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              SIM Configuration
            </span>
            <div className="text-sm font-bold capitalize text-slate-900 dark:text-white">
              {unit.sim_type === 'physical'
                ? 'Physical SIM'
                : unit.sim_type === 'esim'
                ? 'eSIM Only'
                : unit.sim_type === 'dual'
                ? 'Dual SIM'
                : 'Not Applicable'}
            </div>
            <div className="text-[10px] text-slate-400">Network Unlocked</div>
          </div>

          {/* Location */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Shop Location
              </span>
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {unit.location || 'Display Counter'}
            </div>
          </div>

          {/* Condition */}
          <div className="p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Cosmetic Grade
            </span>
            <div className="text-sm font-bold capitalize text-slate-900 dark:text-white">
              {unit.condition.replace(/_/g, ' ')}
            </div>
            <div className="text-[10px] text-slate-400">Verified Inspection</div>
          </div>
        </div>
      </ProgressiveSection>

      {/* Progressive Section 2: Merchant Notes */}
      <ProgressiveSection
        title="Intake Notes & Source"
        icon={<Tag className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/70 dark:border-slate-800/90 text-xs text-slate-700 dark:text-slate-300">
          <p className="font-medium leading-relaxed">
            {unit.notes || 'Clean intake unit, standard store inspection verified.'}
          </p>
        </div>
      </ProgressiveSection>
    </SlideOverDrawer>
  );
};
