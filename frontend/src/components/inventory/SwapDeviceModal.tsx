import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { InventoryUnit, SalesOrder } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Battery,
  Wrench,
  Store,
  Smartphone,
} from 'lucide-react';

interface SwapDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldUnit: InventoryUnit | null;
  order?: SalesOrder | null;
  onSwapSuccess: (res: { old_unit: InventoryUnit; replacement_unit: InventoryUnit }) => void;
}

const SWAP_REASONS = [
  'Screen defect / touch issue',
  'Battery draining fast',
  'Camera / FaceID defect',
  'Audio / mic defect',
  'Overheating / rebooting',
  'Network / SIM failure',
  'Charging port fault',
  'Other hardware defect',
];

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
  const [swapReason, setSwapReason] = useState(SWAP_REASONS[0]);
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
      setSwapReason(SWAP_REASONS[0]);
      setDestination('repair');
      setCondition('inspection_needed');
      setNotes('');
      setFilterMode('same_model');
      return;
    }

    const loadCandidates = async () => {
      try {
        setLoading(true);

        const allInStock = await api.getInventoryUnits({
          status: 'in_stock',
        });

        const filteredAll = allInStock.filter((u) => u.id !== oldUnit.id);
        setAllStockUnits(filteredAll);

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
          setFilterMode('all_stock');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedReplacementId) {
      toast.error('Please select an in-stock replacement device.');
      return;
    }

    if (!isCostMatch) {
      toast.error('Cost mismatch: Swapping devices with different cost values is blocked.');
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
        description: `Replacement IMEI issued. Defective unit moved to ${
          destination === 'repair' ? 'Repair & Inspection' : 'Shop Shelf'
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

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs select-none animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 sm:border-slate-100 sm:dark:border-slate-800 w-full sm:max-w-lg p-5 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4 max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-bottom-sheet sm:animate-modal-enter shadow-2xl sm:shadow-xl">
        {/* Mobile Grab Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-1.5 sm:hidden shrink-0" />

        {/* Clean Header */}
        <div className="flex items-center justify-between pb-3.5 sm:pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-2">
            <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-sm tracking-tight">
                Warranty Swap
              </h3>
              <p className="text-xs sm:text-[11px] text-slate-400 font-medium sm:font-normal">
                {order ? `Order #${order.order_number} · Replace with in-stock unit` : 'Replace with in-stock unit'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form id="swap-device-form" onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-0.5 flex-1">
          {/* Returning Device Banner: Black background, white text, emerald icon */}
          <div className="p-3.5 sm:p-3 rounded-2xl sm:rounded-xl bg-black dark:bg-slate-950 border border-slate-800 text-white shrink-0 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
                <Smartphone className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white text-sm sm:text-xs truncate">
                  {productName} {specString && <span className="font-normal text-slate-300">({specString})</span>}
                </div>
                <div className="text-xs sm:text-[11px] font-mono text-slate-300 mt-0.5 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-semibold">SN:</span>
                  <span className="font-bold text-white">{oldUnit.imei_or_serial || 'Unrecorded'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Replacement Candidate Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm sm:text-xs font-bold sm:font-semibold text-slate-800 dark:text-slate-200">
                Replacement Device *
              </label>

              {/* View Toggle */}
              <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('same_model');
                    if (sameModelUnits.length > 0) {
                      setSelectedReplacementId(sameModelUnits[0].id);
                    }
                  }}
                  className={`px-2.5 py-1 sm:py-0.5 rounded-md transition-all cursor-pointer ${
                    filterMode === 'same_model'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
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
                  className={`px-2.5 py-1 sm:py-0.5 rounded-md transition-all cursor-pointer ${
                    filterMode === 'all_stock'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All In Stock ({allStockUnits.length})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-20 flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Checking available in-stock devices...</span>
              </div>
            ) : currentCandidates.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  No replacement units found in this filter
                </div>
                <p className="text-[11px] text-slate-400">
                  {filterMode === 'same_model'
                    ? 'No other units of this exact model are in stock. Switch to "All In Stock" above to select another unit.'
                    : 'No available devices in active counter stock.'}
                </p>
                {filterMode === 'same_model' && allStockUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterMode('all_stock')}
                    className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer block"
                  >
                    View {allStockUnits.length} other in-stock devices →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/80 p-0.5">
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
                          ? 'border-2 border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800/80 shadow-2xs'
                          : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 pr-2 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                          <span className="truncate">{pName}</span>
                          {uSpec && <span className="font-normal text-slate-400 truncate">({uSpec})</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            SN: {u.imei_or_serial || 'Unrecorded'}
                          </span>
                          {u.battery_health != null && (
                            <span className="flex items-center gap-0.5">
                              <Battery className="w-2.5 h-2.5" />
                              {u.battery_health}%
                            </span>
                          )}
                          {u.condition && <span className="capitalize">· {u.condition.replace(/_/g, ' ')}</span>}
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
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                Matched
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
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

          {/* Minimal Cost Status Notification */}
          {selectedReplacement && originalCost > 0 && (
            <div>
              {isCostMatch ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Cost values match (0 ETB variance)</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-semibold">
                      Cost Mismatch ({costDifference > 0 ? `+${costDifference.toLocaleString()}` : costDifference.toLocaleString()} ETB) — Please choose a matching cost unit
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reason for Swap Dropdown */}
          <div>
            <label className="block text-sm sm:text-xs font-bold sm:font-semibold text-slate-800 sm:text-slate-700 dark:text-slate-200 sm:dark:text-slate-300 mb-1.5 sm:mb-1">
              Reason for Swap *
            </label>
            <select
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              required
              className="w-full h-11 sm:h-10 px-3.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-700 sm:dark:border-slate-800 bg-white dark:bg-[#151b26] text-sm sm:text-xs font-semibold sm:font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs sm:shadow-none cursor-pointer"
            >
              {SWAP_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Defective Device Destination (Segment Control with Black BG, White Text, Emerald Icon when Selected) */}
          <div>
            <label className="block text-sm sm:text-xs font-bold sm:font-semibold text-slate-800 sm:text-slate-700 dark:text-slate-200 sm:dark:text-slate-300 mb-1.5 sm:mb-1">
              Defective Device Action
            </label>
            <div className="grid grid-cols-2 gap-2 p-1.5 sm:p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl sm:rounded-xl text-xs sm:text-xs font-bold sm:font-semibold">
              <button
                type="button"
                onClick={() => setDestination('repair')}
                className={`py-2.5 sm:py-2 px-3 rounded-xl sm:rounded-lg transition-all cursor-pointer text-left flex items-center gap-2.5 ${
                  destination === 'repair'
                    ? 'bg-black dark:bg-slate-950 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wrench className={`w-4 h-4 shrink-0 ${destination === 'repair' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <div className="truncate">Send to Repair</div>
                  <div className={`text-[11px] sm:text-[10px] font-normal truncate mt-0.5 ${destination === 'repair' ? 'text-slate-300' : 'opacity-75'}`}>
                    Repair shelf
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDestination('in_stock')}
                className={`py-2.5 sm:py-2 px-3 rounded-xl sm:rounded-lg transition-all cursor-pointer text-left flex items-center gap-2.5 ${
                  destination === 'in_stock'
                    ? 'bg-black dark:bg-slate-950 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Store className={`w-4 h-4 shrink-0 ${destination === 'in_stock' ? 'text-emerald-400' : 'text-slate-400'}`} />
                <div className="min-w-0">
                  <div className="truncate">Direct to Shelf</div>
                  <div className={`text-[11px] sm:text-[10px] font-normal truncate mt-0.5 ${destination === 'in_stock' ? 'text-slate-300' : 'opacity-75'}`}>
                    Shop counter
                  </div>
                </div>
              </button>
            </div>
          </div>
        </form>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 sm:gap-2 pt-3 sm:pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto h-11 sm:h-9 px-5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm sm:text-xs font-bold sm:font-semibold text-slate-700 sm:text-slate-600 dark:text-slate-300 sm:dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="swap-device-form"
            disabled={
              submitting ||
              !selectedReplacementId ||
              !swapReason.trim() ||
              !isCostMatch
            }
            className="w-full sm:w-auto h-11 sm:h-9 px-5 sm:px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm sm:text-xs font-bold sm:font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 sm:gap-1.5 cursor-pointer flex-1 sm:flex-initial shadow-xs"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ArrowLeftRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span className="sm:hidden">Swap</span>
                <span className="hidden sm:inline">Confirm Swap</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
