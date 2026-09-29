import React, { useState, useEffect, useMemo } from 'react';
import type { ProductCategory, Product, InventoryUnit } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Plus,
  Repeat,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react';

export interface ExchangeDevicePayload {
  variant_id: string;
  product_name: string;
  variant_label: string;
  trade_in_value: number;
  cash_payment?: number;
  imei_or_serial: string;
  condition: string;
  battery_health?: number | null;
  cycle_count?: number | null;
  sim_type?: 'physical' | 'esim' | 'dual' | 'na';
  location?: string;
  notes?: string;
}

interface ExchangeDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  products: Product[];
  availableUnits?: InventoryUnit[];
  outgoingUnitCost: number;
  outgoingUnitPrice?: number;
  currentPaidCash?: number;
  initialExchange?: ExchangeDevicePayload | null;
  onConfirmExchange: (payload: ExchangeDevicePayload) => void;
  onReloadProducts?: () => void;
}

export const ExchangeDeviceModal: React.FC<ExchangeDeviceModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  availableUnits = [],
  outgoingUnitCost = 0,
  outgoingUnitPrice = 0,
  currentPaidCash = 0,
  initialExchange,
  onConfirmExchange,
  onReloadProducts,
}) => {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  // Existing selection state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Valuation / Trade-in credit
  const [tradeInValue, setTradeInValue] = useState<string>('');
  const [isCustomValue, setIsCustomValue] = useState<boolean>(false);

  // Device inspection details
  const [imei, setImei] = useState<string>('');
  const [condition, setCondition] = useState<string>('used_clean');
  const [batteryHealth, setBatteryHealth] = useState<string>('85');
  const [simType, setSimType] = useState<'physical' | 'esim' | 'dual' | 'na'>('physical');
  const [notes, setNotes] = useState<string>('');

  // New product quick create inline
  const [newCatId, setNewCatId] = useState<string>('');
  const [newProductName, setNewProductName] = useState<string>('');
  const [newStorage, setNewStorage] = useState<string>('128GB');
  const [newColor, setNewColor] = useState<string>('Black');
  const [isCreatingNewProduct, setIsCreatingNewProduct] = useState(false);

  // Initialize or prefill
  useEffect(() => {
    if (!isOpen) return;

    if (initialExchange) {
      const vId = initialExchange.variant_id;
      setSelectedVariantId(vId);
      const prod = products.find((p) => p.variants.some((v) => v.id === vId));
      if (prod) {
        setSelectedProductId(prod.id);
        if (prod.category_id) {
          setSelectedCategoryId(prod.category_id);
        }
      }
      setTradeInValue(String(initialExchange.trade_in_value || ''));
      setIsCustomValue(true);
      setImei(initialExchange.imei_or_serial || '');
      setCondition(initialExchange.condition || 'used_clean');
      setBatteryHealth(initialExchange.battery_health ? String(initialExchange.battery_health) : '');
      setSimType(initialExchange.sim_type || 'physical');
      setNotes(initialExchange.notes || '');
      setMode('existing');
    } else {
      // Defaults
      if (categories.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(categories[0].id);
        setNewCatId(categories[0].id);
      }
      setTradeInValue('');
      setIsCustomValue(false);
      setImei('');
      setCondition('used_clean');
      setBatteryHealth('85');
      setSimType('physical');
      setNotes('');
    }
  }, [isOpen, initialExchange, categories, products]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return products;
    return products.filter((p) => {
      if (p.category_id) return p.category_id === selectedCategoryId;
      const cat = categories.find((c) => c.id === selectedCategoryId);
      return cat ? p.category === cat.slug : false;
    });
  }, [products, selectedCategoryId, categories]);

  // Selected Product & Variants
  const activeProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const activeVariants = useMemo(() => {
    return activeProduct?.variants || [];
  }, [activeProduct]);

  const activeVariant = useMemo(() => {
    return activeVariants.find((v) => v.id === selectedVariantId) || null;
  }, [activeVariants, selectedVariantId]);

  // Compute in-stock inventory cost of the selected trade-in variant
  const activeVariantCost = useMemo(() => {
    if (!activeVariant) return 0;
    const avgCost = Number(activeVariant.stock?.average_cost || 0);
    if (avgCost > 0) return avgCost;

    const fromAvail = (availableUnits || []).find(
      (u) => u.variant_id === activeVariant.id && Number(u.cost_basis || 0) > 0
    );
    if (fromAvail && Number(fromAvail.cost_basis) > 0) {
      return Number(fromAvail.cost_basis);
    }

    const fromUnits = (activeVariant.inventory_units || []).find(
      (u) => Number(u.cost_basis || 0) > 0
    );
    if (fromUnits && Number(fromUnits.cost_basis) > 0) {
      return Number(fromUnits.cost_basis);
    }

    return 0;
  }, [activeVariant, availableUnits]);

  // Auto-calculated intake value for the exchanged device
  const autoTradeInValue = useMemo(() => {
    if (activeVariantCost > 0) return activeVariantCost;
    if (outgoingUnitPrice > 0 && currentPaidCash > 0 && outgoingUnitPrice > currentPaidCash) {
      return outgoingUnitPrice - currentPaidCash;
    }
    const salePrice = Number(activeVariant?.default_selling_price || 0);
    if (salePrice > 0) return Math.round(salePrice * 0.65);
    return 0;
  }, [activeVariantCost, outgoingUnitPrice, currentPaidCash, activeVariant]);

  // Automatically fill tradeInValue with the catalog cost of the selected variant (unless user manually typed a custom value)
  useEffect(() => {
    if (!isOpen) return;
    if (!isCustomValue) {
      if (activeVariantCost > 0) {
        setTradeInValue(String(activeVariantCost));
      } else {
        const salePrice = Number(activeVariant?.default_selling_price || 0);
        if (salePrice > 0) {
          setTradeInValue(String(Math.round(salePrice * 0.65)));
        } else {
          setTradeInValue('');
        }
      }
    }
  }, [isOpen, activeVariantCost, activeVariant, isCustomValue]);

  const handleTradeInValueChange = (val: string) => {
    setTradeInValue(val);
    setIsCustomValue(true);
  };

  const tradeInValNum = useMemo(() => {
    const parsed = parseFloat(tradeInValue);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    if (activeVariantCost > 0) return activeVariantCost;
    return autoTradeInValue;
  }, [tradeInValue, activeVariantCost, autoTradeInValue]);

  // Auto-select first variant when product changes
  const handleSelectProduct = (pId: string) => {
    setSelectedProductId(pId);
    setIsCustomValue(false);
    const prod = products.find((p) => p.id === pId);
    if (prod && prod.variants.length > 0) {
      setSelectedVariantId(prod.variants[0].id);
    } else {
      setSelectedVariantId('');
    }
  };

  const handleSelectVariant = (vId: string) => {
    setSelectedVariantId(vId);
    setIsCustomValue(false);
  };

  // Inline Quick Creation of New Model
  const handleCreateNewModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      toast.error('Please enter the device name.');
      return;
    }
    const cat = categories.find((c) => c.id === newCatId) || categories[0];

    try {
      setIsCreatingNewProduct(true);
      const res = await api.createProduct({
        name: newProductName.trim(),
        category_id: cat?.id,
        category: cat?.slug || 'phones',
        has_serials: cat?.has_serials ?? true,
        variants: [
          {
            storage: newStorage.trim() || undefined,
            color: newColor.trim() || undefined,
          },
        ],
      });

      toast.success(`Created model: ${res.name}`);
      if (onReloadProducts) onReloadProducts();

      // Switch to existing mode with this newly created product selected
      setSelectedCategoryId(cat ? cat.id : '');
      setSelectedProductId(res.id);
      if (res.variants && res.variants.length > 0) {
        setSelectedVariantId(res.variants[0].id);
      }
      setMode('existing');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create new product model');
    } finally {
      setIsCreatingNewProduct(false);
    }
  };

  const isImeiAlreadyInStock = useMemo(() => {
    const trimmed = imei.trim().toLowerCase();
    if (!trimmed) return false;
    return availableUnits.some(
      (u) => u.imei_or_serial && u.imei_or_serial.trim().toLowerCase() === trimmed
    );
  }, [imei, availableUnits]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      toast.error('Please select the trade-in device model and variant.');
      return;
    }
    if (tradeInValNum <= 0) {
      toast.error('Please enter a valid trade-in valuation.');
      return;
    }
    if (!imei.trim()) {
      toast.error('Please enter the IMEI or Serial number of the traded-in device.');
      return;
    }
    if (isImeiAlreadyInStock) {
      toast.error(`IMEI/Serial '${imei.trim()}' is already present in your active shop inventory!`);
      return;
    }

    const prod = products.find((p) => p.variants.some((v) => v.id === selectedVariantId));
    const variant = prod?.variants.find((v) => v.id === selectedVariantId);

    const vLabel = [variant?.storage, variant?.color].filter(Boolean).join(' · ') || 'Standard';

    onConfirmExchange({
      variant_id: selectedVariantId,
      product_name: prod?.name || 'Device',
      variant_label: vLabel,
      trade_in_value: tradeInValNum,
      cash_payment: currentPaidCash > 0 ? currentPaidCash : (outgoingUnitPrice > 0 ? Math.max(0, outgoingUnitPrice - tradeInValNum) : undefined),
      imei_or_serial: imei.trim(),
      condition,
      battery_health: batteryHealth ? parseInt(batteryHealth, 10) : null,
      cycle_count: null,
      sim_type: simType,
      location: 'Shop Counter',
      notes: notes.trim() || undefined,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white dark:bg-[#131926] border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-bottom-sheet sm:animate-in pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Device Exchange / Trade-In
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          {/* Mode Switcher: Existing vs New Model */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'existing'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Select Existing Model
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                mode === 'new'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              New Model (Not in Stock)
            </button>
          </div>

          {mode === 'new' ? (
            /* Quick Add New Product Form */
            <form onSubmit={handleCreateNewModel} className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Register New Model in Catalog
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Category *
                  </label>
                  <select
                    value={newCatId}
                    onChange={(e) => setNewCatId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Device Model Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Google Pixel 5"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Storage
                  </label>
                  <input
                    type="text"
                    placeholder="128GB"
                    value={newStorage}
                    onChange={(e) => setNewStorage(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    placeholder="Black"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingNewProduct}
                className="w-full h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
              >
                {isCreatingNewProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Add & Select Model
              </button>
            </form>
          ) : (
            /* Existing Model Selection */
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categories.length > 1 && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Category
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => {
                        setSelectedCategoryId(e.target.value);
                        setSelectedProductId('');
                        setSelectedVariantId('');
                      }}
                      className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value="">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={categories.length <= 1 ? 'sm:col-span-2' : ''}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Select Model *
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    required
                  >
                    <option value="">— Select Model —</option>
                    {filteredProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Variant Selector */}
              {activeVariants.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Variant *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {activeVariants.map((v) => {
                      const isSel = selectedVariantId === v.id;
                      const label = [v.storage, v.color].filter(Boolean).join(' · ') || 'Standard';
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectVariant(v.id)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all ${
                            isSel
                              ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Intake Device Details */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            {/* Valuation & IMEI Row (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="flex items-center justify-between mb-1.5 h-4">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Trade-In Value (ETB) *
                  </label>
                  {activeVariantCost > 0 && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Cost: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{activeVariantCost.toLocaleString()}</strong>
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={tradeInValue}
                  onChange={(e) => handleTradeInValueChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 h-4">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    IMEI / Serial Number *
                  </label>
                  <span className="text-[10px] text-slate-400">Required</span>
                </div>
                <input
                  type="text"
                  placeholder="Enter 15-digit IMEI or Serial number..."
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  className={`w-full h-9 px-3 rounded-xl border font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                    isImeiAlreadyInStock
                      ? 'border-red-400 dark:border-red-600 bg-red-50/50 dark:bg-red-950/20 focus:ring-red-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:ring-purple-500/20 focus:border-purple-500'
                  }`}
                  required
                />
                {isImeiAlreadyInStock && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold mt-1">
                    ⚠️ This IMEI is already registered in active shop inventory.
                  </p>
                )}
              </div>
            </div>

            {/* Condition, Battery & SIM (3 Columns) */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 h-4">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="used_clean">Used Clean (A)</option>
                  <option value="used_like_new">Like New (A+)</option>
                  <option value="new">Brand New</option>
                  <option value="grade_b">Grade B</option>
                  <option value="backcrack">Back Crack</option>
                  <option value="fair">Fair</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 h-4">
                  Battery (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="85"
                  value={batteryHealth}
                  onChange={(e) => setBatteryHealth(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 h-4">
                  SIM Type
                </label>
                <select
                  value={simType}
                  onChange={(e) => setSimType(e.target.value as any)}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="physical">Physical SIM</option>
                  <option value="esim">eSIM Only</option>
                  <option value="dual">Dual SIM</option>
                </select>
              </div>
            </div>

            {/* Optional inspection notes */}
            <div>
              <input
                type="text"
                placeholder="Optional inspection notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* Minimal Warning if received value is below shop cost */}
          {outgoingUnitCost > 0 && currentPaidCash > 0 && (tradeInValNum + currentPaidCash < outgoingUnitCost) && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                Cash + trade-in is below shop cost by {(outgoingUnitCost - (tradeInValNum + currentPaidCash)).toLocaleString()} ETB
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                Loss Deal
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 px-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedVariantId || tradeInValNum <= 0 || !imei.trim() || isImeiAlreadyInStock}
            className="h-8 px-4 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            <Repeat className="w-3.5 h-3.5" />
            Attach Exchange Device
          </button>
        </div>
      </div>
    </div>
  );
};
