import React, { useState, useEffect, useMemo } from 'react';
import type { ProductCategory, Product, Contact } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Plus,
  Barcode,
  BatteryCharging,
  Loader2,
  ChevronDown,
} from 'lucide-react';

interface StockIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  products: Product[];
  contacts: Contact[];
  onIntakeSuccess: () => void;
  onOpenCategoryManager?: () => void;
}

export const StockIntakeModal: React.FC<StockIntakeModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  contacts,
  onIntakeSuccess,
}) => {
  // Category & Product Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Quick Inline Product Creation
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductStorage, setNewProductStorage] = useState('');
  const [newProductColor, setNewProductColor] = useState('');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Intake Parameters
  const [bulkMode, setBulkMode] = useState(false);
  const [singleImei, setSingleImei] = useState('');
  const [bulkImeisText, setBulkImeisText] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('new');
  const [batteryHealth, setBatteryHealth] = useState('100');
  const [cycleCount, setCycleCount] = useState('0');
  const [simType, setSimType] = useState<'physical' | 'esim' | 'dual' | 'na'>('physical');
  const [costBasis, setCostBasis] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [location, setLocation] = useState('Shop Counter');
  const [notes, setNotes] = useState('');
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false);

  // Initialize selected category
  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || categories[0];
  }, [categories, selectedCategoryId]);

  const hasSerials = activeCategory ? activeCategory.has_serials : true;

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return products;
    return products.filter(
      (p) =>
        p.category_id === selectedCategoryId ||
        p.category === activeCategory?.slug ||
        p.category === activeCategory?.name.toLowerCase()
    );
  }, [products, selectedCategoryId, activeCategory]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // When product changes, auto-select first variant
  useEffect(() => {
    if (selectedProduct && selectedProduct.variants.length > 0) {
      if (!selectedProduct.variants.some((v) => v.id === selectedVariantId)) {
        setSelectedVariantId(selectedProduct.variants[0].id);
      }
    }
  }, [selectedProduct]);

  // Parse bulk IMEIs
  const parsedImeis = useMemo(() => {
    if (!bulkImeisText.trim()) return [];
    return bulkImeisText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [bulkImeisText]);

  // Total units and cost calculations
  const totalUnitsToReceive = useMemo(() => {
    if (hasSerials) {
      return bulkMode ? parsedImeis.length : singleImei.trim() ? 1 : 0;
    }
    const q = parseInt(quantity, 10);
    return isNaN(q) || q <= 0 ? 0 : q;
  }, [hasSerials, bulkMode, parsedImeis.length, singleImei, quantity]);

  const totalInvestmentCost = useMemo(() => {
    const cost = parseFloat(costBasis);
    if (isNaN(cost) || cost <= 0) return 0;
    return totalUnitsToReceive * cost;
  }, [costBasis, totalUnitsToReceive]);

  const isPhone = useMemo(() => {
    const catSlug = activeCategory?.slug || '';
    const prodName = (selectedProduct?.name || '').toLowerCase();
    return (
      catSlug.includes('phone') ||
      catSlug.includes('smartphone') ||
      prodName.includes('iphone') ||
      prodName.includes('galaxy') ||
      prodName.includes('pixel')
    );
  }, [activeCategory, selectedProduct]);

  if (!isOpen) return null;

  // Handle Quick Product Creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      toast.error('Please enter a product name');
      return;
    }

    try {
      setIsSubmittingProduct(true);
      const res = await api.createProduct({
        name: newProductName.trim(),
        category: activeCategory?.slug || 'other',
        category_id: activeCategory?.id,
        has_serials: activeCategory?.has_serials ?? true,
        variants: [
          {
            storage: newProductStorage.trim() || undefined,
            color: newProductColor.trim() || undefined,
          },
        ],
      });

      toast.success('Product model created', { description: `${res.name} added to catalog.` });
      setIsCreatingProduct(false);
      setNewProductName('');
      setNewProductStorage('');
      setNewProductColor('');

      onIntakeSuccess();
      setSelectedProductId(res.id);
      if (res.variants?.[0]?.id) {
        setSelectedVariantId(res.variants[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product model');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Submit Stock Intake
  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVariantId) {
      toast.error('Please select a product and specification');
      return;
    }

    const costNum = parseFloat(costBasis);
    if (isNaN(costNum) || costNum < 0) {
      toast.error('Please enter a valid purchase cost per unit');
      return;
    }

    if (hasSerials) {
      if (bulkMode && parsedImeis.length === 0) {
        toast.error('Please enter at least one Serial number or IMEI');
        return;
      }
      if (!bulkMode && !singleImei.trim()) {
        toast.error('Please enter the device Serial number or IMEI');
        return;
      }
    } else {
      const q = parseInt(quantity, 10);
      if (isNaN(q) || q <= 0) {
        toast.error('Please enter a valid batch quantity (minimum 1)');
        return;
      }
    }

    try {
      setIsSubmittingIntake(true);
      const payload: any = {
        variant_id: selectedVariantId,
        cost_basis: costNum,
        condition,
        location: location || 'Shop Counter',
        notes: notes.trim() || null,
        supplier_contact_id: supplierId || null,
        selling_price: sellingPrice ? parseFloat(sellingPrice) : undefined,
      };

      if (hasSerials) {
        if (bulkMode) {
          payload.imeis = parsedImeis;
        } else {
          payload.imei_or_serial = singleImei.trim();
        }
        if (isPhone) {
          payload.battery_health = batteryHealth ? parseInt(batteryHealth, 10) : null;
          payload.cycle_count = cycleCount ? parseInt(cycleCount, 10) : null;
          payload.sim_type = simType;
        }
      } else {
        payload.quantity = parseInt(quantity, 10) || 1;
      }

      await api.intakeInventoryUnit(payload);

      toast.success('Stock intake recorded successfully', {
        description: `Added ${totalUnitsToReceive} unit(s) • Total: ${totalInvestmentCost.toLocaleString()} ETB`,
      });

      // Reset fields
      setSingleImei('');
      setBulkImeisText('');
      setQuantity('1');
      setCostBasis('');
      setSellingPrice('');
      setNotes('');
      onIntakeSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record stock intake');
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Main Dialog Card */}
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Stock Intake
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Receive serialized electronics or batch accessories into inventory
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* ── SECTION 1: PRODUCT & VARIANT ── */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Item & Specification
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingProduct(!isCreatingProduct)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCreatingProduct ? 'Select Existing' : '+ New Model'}</span>
              </button>
            </div>

            {/* Quick Add Model Form */}
            {isCreatingProduct ? (
              <form onSubmit={handleCreateProduct} className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Model / Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PlayStation 5 Pro, iPhone 16 Pro, 65-inch OLED"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Storage / Spec (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 256GB, 1TB, 65-inch"
                      value={newProductStorage}
                      onChange={(e) => setNewProductStorage(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Color / Edition (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Space Black, White, Disc Edition"
                      value={newProductColor}
                      onChange={(e) => setNewProductColor(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProduct(false)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingProduct}
                    className="h-8 px-4 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isSubmittingProduct ? 'Saving...' : 'Save & Select Model'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2.5">
                {/* Category Dropdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => {
                          setSelectedCategoryId(e.target.value);
                          setSelectedProductId('');
                          setSelectedVariantId('');
                        }}
                        className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-semibold text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.has_serials ? '(Serial Tracked)' : '(Batch Stock)'}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                    </div>
                  </div>

                  {/* Product Model Dropdown */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Product Model *
                    </label>
                    <div className="relative">
                      <select
                        value={selectedProductId}
                        onChange={(e) => {
                          setSelectedProductId(e.target.value);
                          setSelectedVariantId('');
                        }}
                        className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-semibold text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      >
                        <option value="">-- Choose Model --</option>
                        {filteredProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Variant / Specs Dropdown */}
                {selectedProduct && selectedProduct.variants.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Variant Specification
                    </label>
                    <div className="relative">
                      <select
                        value={selectedVariantId}
                        onChange={(e) => setSelectedVariantId(e.target.value)}
                        className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      >
                        {selectedProduct.variants.map((v) => {
                          const specValues = v.specs ? Object.values(v.specs).map(String) : [];
                          const label =
                            [v.storage, v.ram ? `${v.ram} RAM` : null, v.color, ...specValues]
                              .filter(Boolean)
                              .join(' • ') || 'Standard Variant';
                          return (
                            <option key={v.id} value={v.id}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION 2: SERIAL / QUANTITY & CONDITION ── */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {hasSerials ? 'Serial Number & Hardware' : 'Batch Quantity & Condition'}
              </span>

              {/* Single vs Bulk Toggle for Serialized Items */}
              {hasSerials && (
                <div className="p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-lg flex text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      !bulkMode
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Single Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode(true)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      bulkMode
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Bulk Paste
                  </button>
                </div>
              )}
            </div>

            {hasSerials ? (
              bulkMode ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Paste IMEIs / Serial Numbers (One per line or comma separated) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={bulkImeisText}
                    onChange={(e) => setBulkImeisText(e.target.value)}
                    placeholder="359871109911111&#10;359871109922222&#10;359871109933333"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    {parsedImeis.length} device serials detected.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {isPhone ? 'IMEI / Serial #' : 'Serial #'} *
                    </label>
                    <div className="relative">
                      <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={singleImei}
                        onChange={(e) => setSingleImei(e.target.value)}
                        placeholder={isPhone ? 'e.g. 359871109988776' : 'e.g. S01-F329482'}
                        className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Physical Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="new">Brand New (Sealed)</option>
                      <option value="used_clean">Used Clean (Grade A)</option>
                      <option value="used_minor_scratches">Used Minor Scratches</option>
                      <option value="refurbished">Refurbished</option>
                    </select>
                  </div>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity Received (Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batch Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="new">Brand New</option>
                    <option value="used_clean">Pre-owned Clean</option>
                  </select>
                </div>
              </div>
            )}

            {/* Phone Specific Battery & SIM */}
            {hasSerials && isPhone && (
              <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                    <BatteryCharging className="w-3 h-3 text-emerald-500" />
                    <span>Battery %</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batteryHealth}
                    onChange={(e) => setBatteryHealth(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Cycle Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cycleCount}
                    onChange={(e) => setCycleCount(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    SIM Type
                  </label>
                  <select
                    value={simType}
                    onChange={(e) => setSimType(e.target.value as any)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-semibold"
                  >
                    <option value="physical">Physical SIM</option>
                    <option value="esim">eSIM Only</option>
                    <option value="dual">Dual SIM</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 3: COST, PRICING & LOCATION ── */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              Financial Cost Basis & Storage
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cost Basis per Unit (ETB) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 85000"
                  value={costBasis}
                  onChange={(e) => setCostBasis(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Selling Price (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 95000"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Storage Location
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="Shop Counter">Shop Counter</option>
                  <option value="Display Showcase">Display Showcase</option>
                  <option value="Backroom Safe">Backroom Safe</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier / Sourced From (Optional)
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                >
                  <option value="">-- Direct / Walk-in / Self --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Imported batch, sealed box"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <div className="text-xs">
            <span className="text-slate-400">Total: </span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">
              {totalUnitsToReceive} unit(s)
            </span>
            {totalInvestmentCost > 0 && (
              <span className="ml-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                • {totalInvestmentCost.toLocaleString()} ETB
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitIntake}
              disabled={isSubmittingIntake || !selectedVariantId || !costBasis || totalUnitsToReceive === 0}
              className="h-9 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.98]"
            >
              {isSubmittingIntake ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <span>Add Item to Stock</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
