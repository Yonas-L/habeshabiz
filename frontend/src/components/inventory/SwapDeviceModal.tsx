import React, { useState, useEffect, useMemo } from 'react';
import type { InventoryUnit, SalesOrder } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  X,
  Loader2,
  AlertTriangle,
  Wrench,
  Store,
  CheckCircle2,
  Battery,
  ShieldCheck,
} from 'lucide-react';

interface SwapDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldUnit: InventoryUnit | null;
  order?: SalesOrder | null;
  onSwapSuccess: (res: { old_unit: InventoryUnit; replacement_unit: InventoryUnit }) => void;
}

export const SwapDeviceModal: React.FC<SwapDeviceModalProps> = ({
  isOpen,
  onClose,
  oldUnit,
  order,
  onSwapSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [sameModelUnits, setSameModelUnits] = useState<InventoryUnit[]>([]);
  const [allStockUnits, setAllStockUnits] = useState<InventoryUnit[]>([]);
  const [filterMode, setFilterMode] = useState<'same_model' | 'all_stock'>('same_model');
  const [selectedReplacementId, setSelectedReplacementId] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [destination, setDestination] = useState<'repair' | 'in_stock'>('repair');
  const [condition, setCondition] = useState('inspection_needed');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Compute original unit cost basis
  const originalCost = useMemo(() => {
    if (!oldUnit) return 0;
    const directCost = Number(oldUnit.cost_basis || 0);
    if (directCost > 0) return directCost;
    const itemCost = Number(oldUnit.sales_order_item?.unit_cost || 0);
    return itemCost;
  }, [oldUnit]);

  useEffect(() => {
    if (!isOpen || !oldUnit) {
      setSameModelUnits([]);
      setAllStockUnits([]);
      setSelectedReplacementId('');
      setSwapReason('');
      setDestination('repair');
      setCondition('inspection_needed');
      setNotes('');
      setFilterMode('same_model');
      return;
    }

    const loadCandidates = async () => {
      try {
        setLoading(true);

        // Fetch all in-stock units
        const allInStock = await api.getInventoryUnits({
          status: 'in_stock',
        });

        const filteredAll = allInStock.filter((u) => u.id !== oldUnit.id);
        setAllStockUnits(filteredAll);

        // Filter for same model / variant
        const matching = filteredAll.filter((u) => {
          if (oldUnit.variant_id && u.variant_id === oldUnit.variant_id) return true;
          const oldProdId = oldUnit.variant?.product_id;
          const uProdId = u.variant?.product_id;
          if (oldProdId && uProdId && oldProdId === uProdId) return true;
          return false;
        });

        setSameModelUnits(matching);

        if (matching.length > 0) {
          setFilterMode('same_model');
          setSelectedReplacementId(matching[0].id);
        } else {
          // If no identical model units, automatically switch to all stock so user isn't stuck
          setFilterMode('all_stock');
          // Prefer one with matching cost if available
          const matchingCostUnit = filteredAll.find((u) => {
            const cCost = Number(u.cost_basis || 0);
            return originalCost > 0 && Math.abs(cCost - originalCost) < 0.01;
          });
          if (matchingCostUnit) {
            setSelectedReplacementId(matchingCostUnit.id);
          } else if (filteredAll.length > 0) {
            setSelectedReplacementId(filteredAll[0].id);
          }
        }
      } catch (err: any) {
        toast.error('Failed to load in-stock replacement devices', { description: err.message });
      } finally {
        setLoading(false);
      }
    };

    loadCandidates();
  }, [isOpen, oldUnit, originalCost]);

  if (!isOpen || !oldUnit) return null;

  const currentCandidates = filterMode === 'same_model' ? sameModelUnits : allStockUnits;
  const selectedReplacement = allStockUnits.find((r) => r.id === selectedReplacementId);
  const selectedCost = selectedReplacement ? Number(selectedReplacement.cost_basis || 0) : 0;

  // Determine if costs match
  const isCostMatch =
    selectedReplacement != null &&
    (originalCost === 0 ||
      selectedCost === 0 ||
      Math.abs(originalCost - selectedCost) < 0.01);

  const costDifference = selectedCost - originalCost;

  const productName = oldUnit.variant?.product?.name || 'Device';
  const specString = [oldUnit.variant?.storage, oldUnit.variant?.color].filter(Boolean).join(' · ');

  const quickReasons = [
    'Battery drains too fast',
    'Display / touch issue',
    'Face ID / Camera defect',
    'Audio / mic defect',
    'Overheating / rebooting',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReplacementId) {
      toast.error('Please select an in-stock replacement device.');
      return;
    }

    if (!isCostMatch) {
      toast.error('Cost mismatch: Swapping devices with different cost values is blocked to preserve profit and inventory valuation.');
      return;
    }

    if (!swapReason.trim()) {
      toast.error('Please specify the defect or reason for the swap.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.swapInventoryUnit(oldUnit.id, {
        replacement_unit_id: selectedReplacementId,
        swap_reason: swapReason.trim(),
        destination,
        condition,
        notes: notes.trim() || undefined,
      });

      toast.success('Device Warranty Swap Completed', {
        description: `Replacement IMEI issued to customer. Defective unit moved to ${
          destination === 'repair' ? 'Repair & Inspection' : 'Shop Counter'
        }.`,
      });

      onSwapSuccess(res);
      onClose();
    } catch (err: any) {
      toast.error('Failed to complete device swap', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-100 dark:border-slate-800 w-full max-w-lg p-5 space-y-4 shadow-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-bottom-sheet sm:animate-fade-in pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Device Warranty Swap
              </h3>
              <p className="text-[11px] text-slate-400">
                1-to-1 customer exchange with zero monetary leakage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-1 flex-1">
          {/* Defective Device Info Card */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Defective Device (Customer Returning)
              </span>
              {order && (
                <span className="font-mono text-[10px] text-slate-400">
                  Order #{order.order_number}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="font-bold text-slate-900 dark:text-white">
                {productName} {specString && <span className="font-normal text-slate-400">· {specString}</span>}
              </div>
              {originalCost > 0 && (
                <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                  Cost: {originalCost.toLocaleString()} ETB
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 flex items-center gap-2">
              <span>SN: <strong className="text-slate-800 dark:text-slate-200">{oldUnit.imei_or_serial || 'Bulk Item'}</strong></span>
              {oldUnit.battery_health != null && <span>· {oldUnit.battery_health}% Batt</span>}
              {oldUnit.condition && <span>· {oldUnit.condition}</span>}
            </div>
          </div>

          {/* Replacement Candidate Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Choose Replacement Device *
              </label>

              {/* View Toggle */}
              <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('same_model');
                    if (sameModelUnits.length > 0) {
                      setSelectedReplacementId(sameModelUnits[0].id);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    filterMode === 'same_model'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Same Model ({sameModelUnits.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('all_stock');
                    if (allStockUnits.length > 0 && !allStockUnits.some((u) => u.id === selectedReplacementId)) {
                      setSelectedReplacementId(allStockUnits[0].id);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    filterMode === 'all_stock'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  All In Stock ({allStockUnits.length})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-20 flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking available in-stock devices...</span>
              </div>
            ) : currentCandidates.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No replacement units found in this filter</span>
                </div>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  {filterMode === 'same_model'
                    ? 'No other units of this exact model are in stock. Switch to "All In Stock" above to select another equivalent device.'
                    : 'Your active counter stock has no available serialized devices. Intake new stock first.'}
                </p>
                {filterMode === 'same_model' && allStockUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('all_stock')}
                    className="mt-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 underline hover:no-underline"
                  >
                    View {allStockUnits.length} other in-stock devices →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 p-0.5">
                {currentCandidates.map((u) => {
                  const isSelected = u.id === selectedReplacementId;
                  const uCost = Number(u.cost_basis || 0);
                  const isUnitMatch =
                    originalCost === 0 || uCost === 0 || Math.abs(uCost - originalCost) < 0.01;
                  const uDiff = uCost - originalCost;
                  const pName = u.variant?.product?.name || 'Device';
                  const uSpec = [u.variant?.storage, u.variant?.color].filter(Boolean).join(' · ');

                  return (
                    <div
                      key={u.id}
                      onClick={() => setSelectedReplacementId(u.id)}
                      className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-500'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="min-w-0 pr-2 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                          <span className="truncate">{pName}</span>
                          {uSpec && <span className="font-normal text-slate-400 truncate">· {uSpec}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            SN: {u.imei_or_serial || 'Unrecorded'}
                          </span>
                          {u.battery_health != null && (
                            <span className="text-slate-500 flex items-center gap-0.5">
                              <Battery className="w-2.5 h-2.5" />
                              {u.battery_health}%
                            </span>
                          )}
                          <span className="text-slate-400 capitalize">· {u.condition}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {uCost > 0 ? (
                          <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {uCost.toLocaleString()} ETB
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[10px]">No cost basis</div>
                        )}

                        {originalCost > 0 && uCost > 0 && (
                          <div className="mt-0.5">
                            {isUnitMatch ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Exact Cost
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60">
                                Diff: {uDiff > 0 ? `+${uDiff.toLocaleString()}` : uDiff.toLocaleString()} ETB
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cost Matching Verification Box */}
          {selectedReplacement && originalCost > 0 && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                isCostMatch
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {isCostMatch ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold leading-tight">
                    {isCostMatch ? 'Cost Values Match (0 ETB Variance)' : 'Cost Value Mismatch'}
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5 font-mono">
                    Original: {originalCost.toLocaleString()} ETB ⟷ Replacement: {selectedCost.toLocaleString()} ETB
                  </div>
                </div>
              </div>

              {!isCostMatch && (
                <div className="font-bold text-[10px] text-rose-700 dark:text-rose-300 font-mono bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-md">
                  Diff: {costDifference > 0 ? `+${costDifference.toLocaleString()}` : costDifference.toLocaleString()} ETB
                </div>
              )}
            </div>
          )}

          {/* Swap Defect Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Defect / Swap Reason *
            </label>
            <input
              type="text"
              required
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              placeholder="e.g. Battery drains fast within 7-day warranty"
              className="w-full h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            {/* Quick Pills */}
            <div className="flex flex-wrap gap-1 mt-1">
              {quickReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSwapReason(r)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Defective Device Destination */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Defective Device Action
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer text-xs transition-all ${
                  destination === 'repair'
                    ? 'border-indigo-500/60 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="destination"
                  value="repair"
                  checked={destination === 'repair'}
                  onChange={() => setDestination('repair')}
                  className="sr-only"
                />
                <Wrench className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div>
                  <div className="text-[11px] leading-tight">Repair & Inspection Shelf</div>
                  <div className="text-[9px] text-slate-400 font-normal">Restock after fix</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer text-xs transition-all ${
                  destination === 'in_stock'
                    ? 'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="destination"
                  value="in_stock"
                  checked={destination === 'in_stock'}
                  onChange={() => setDestination('in_stock')}
                  className="sr-only"
                />
                <Store className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div>
                  <div className="text-[11px] leading-tight">Direct Back to Shelf</div>
                  <div className="text-[9px] text-slate-400 font-normal">If re-verified working</div>
                </div>
              </label>
            </div>
          </div>

          {/* Zero Financial Leakage Note */}
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              Customer already paid in full. Receipt IMEI updates automatically with zero financial distortion.
            </span>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                !selectedReplacementId ||
                !swapReason.trim() ||
                !isCostMatch
              }
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing Swap...</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Confirm Swap</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
