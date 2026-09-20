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
} from 'lucide-react';

interface InventoryUnitDrawerProps {
  unit: InventoryUnit | null;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onRestockSuccess?: () => void;
  onSelectForSale?: (unit: InventoryUnit) => void;
}

export const InventoryUnitDrawer: React.FC<InventoryUnitDrawerProps> = ({
  unit,
  isOpen,
  onClose,
  user,
  onRestockSuccess,
  onSelectForSale,
}) => {
  const [copiedImei, setCopiedImei] = useState(false);
  const [restocking, setRestocking] = useState(false);
  const canViewCost = user?.can_view_costs ?? false;

  if (!unit) return null;

  const isInStock = unit.status === 'in_stock';
  const productName = unit.variant?.product?.name || 'Electronic Item';
  const specText = [unit.variant?.storage, unit.variant?.color].filter(Boolean).join(' • ');

  const handleCopyImei = () => {
    if (!unit.imei_or_serial) return;
    navigator.clipboard.writeText(unit.imei_or_serial);
    setCopiedImei(true);
    toast.success('Serial/IMEI copied', { description: unit.imei_or_serial });
    setTimeout(() => setCopiedImei(false), 2000);
  };

  const handleRestock = async () => {
    try {
      setRestocking(true);
      await api.restockInventoryUnit(unit.id);
      toast.success('Item Restocked to Shelf', {
        description: `${productName} (${unit.imei_or_serial || 'Unit'}) is now back In Stock.`,
      });
      if (onRestockSuccess) onRestockSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to restock item', { description: err.message });
    } finally {
      setRestocking(false);
    }
  };

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={productName}
      subtitle={specText || 'Hardware Specification'}
      badge={
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isInStock
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          {isInStock ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
          {unit.status.replace(/_/g, ' ').toUpperCase()}
        </span>
      }
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
            {!isInStock && (
              <button
                type="button"
                disabled={restocking}
                onClick={handleRestock}
                className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                {restocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                <span>Restock to Shelf</span>
              </button>
            )}

            {isInStock && onSelectForSale && (
              <button
                type="button"
                onClick={() => {
                  onSelectForSale(unit);
                  onClose();
                }}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Sell Unit at Counter</span>
              </button>
            )}
          </div>
        </>
      }
    >
      {/* Hero Serial & Valuation Strip */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Serial / IMEI Number
          </span>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight mt-0.5">
            {unit.imei_or_serial || 'Unserialized accessory'}
          </div>
          <div className="text-xs text-slate-400 capitalize mt-1">
            Condition: <strong className="text-slate-700 dark:text-slate-300">{unit.condition}</strong>
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
