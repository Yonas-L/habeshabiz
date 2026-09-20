import React, { useState, useEffect, useMemo } from 'react';
import type { ProductCategory, Product, Contact } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { getCategoryIcon } from './CategoryManagementModal';
import {
  X,
  Plus,
  Barcode,
  Boxes,
  Check,
  Search,
  BatteryCharging,
  DollarSign,
  Layers,
  Loader2,
} from 'lucide-react';

interface StockIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  products: Product[];
  contacts: Contact[];
  onIntakeSuccess: () => void;
  onOpenCategoryManager: () => void;
}

export const StockIntakeModal: React.FC<StockIntakeModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  contacts,
  onIntakeSuccess,
  onOpenCategoryManager,
}) => {
  // Step/Category Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // New Product Inline Form
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('');
  const [newProductStorage, setNewProductStorage] = useState('');
  const [newProductColor, setNewProductColor] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductSpecs, setNewProductSpecs] = useState<Record<string, string>>({});
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // New Variant Inline Form
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [newVarStorage, setNewVarStorage] = useState('');
  const [newVarColor, setNewVarColor] = useState('');
  const [newVarPrice, setNewVarPrice] = useState('');
  const [newVarCustomSpec, setNewVarCustomSpec] = useState('');
  const [isSubmittingVariant, setIsSubmittingVariant] = useState(false);

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

  // Set default category when categories load
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
    return products.filter((p) => {
      const matchCat =
        !selectedCategoryId ||
        p.category_id === selectedCategoryId ||
        p.category === activeCategory?.slug;
      const matchSearch =
        !productSearch ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(productSearch.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategoryId, activeCategory, productSearch]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const selectedVariant = useMemo(() => {
    if (!selectedProduct) return null;
    return selectedProduct.variants.find((v) => v.id === selectedVariantId) || null;
  }, [selectedProduct, selectedVariantId]);

  // When variant changes, prefill selling price
  useEffect(() => {
    if (selectedVariant?.default_selling_price) {
      setSellingPrice(String(selectedVariant.default_selling_price));
    }
  }, [selectedVariant]);

  // Auto-detect phone category for battery specs
  const isPhoneOrLaptop = useMemo(() => {
    const slug = activeCategory?.slug || '';
    return slug.includes('phone') || slug.includes('laptop') || slug.includes('smartphones');
  }, [activeCategory]);

  // Bulk parsed IMEIs
  const parsedImeis = useMemo(() => {
    return bulkImeisText
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [bulkImeisText]);

  const totalUnitsToReceive = useMemo(() => {
    if (!hasSerials) {
      const q = parseInt(quantity, 10);
      return isNaN(q) || q < 1 ? 1 : q;
    }
    if (bulkMode) {
      return parsedImeis.length > 0 ? parsedImeis.length : 1;
    }
    return 1;
  }, [hasSerials, bulkMode, parsedImeis, quantity]);

  const totalInvestmentCost = useMemo(() => {
    const cost = parseFloat(costBasis) || 0;
    return cost * totalUnitsToReceive;
  }, [costBasis, totalUnitsToReceive]);

  const totalProjectedRevenue = useMemo(() => {
    const price = parseFloat(sellingPrice) || 0;
    return price * totalUnitsToReceive;
  }, [sellingPrice, totalUnitsToReceive]);

  const suppliersList = useMemo(() => {
    return contacts.filter((c) => c.roles.includes('supplier') || c.roles.includes('peer_vendor'));
  }, [contacts]);

  if (!isOpen) return null;

  // Handle Quick Inline Product Creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      toast.error('Please enter product name');
      return;
    }

    try {
      setIsSubmittingProduct(true);
      const created = await api.createProduct({
        name: newProductName.trim(),
        brand: newProductBrand.trim() || undefined,
        category_id: selectedCategoryId,
        category: activeCategory?.slug,
        has_serials: hasSerials,
        variants: [
          {
            storage: newProductStorage.trim() || undefined,
            color: newProductColor.trim() || undefined,
            specs: Object.keys(newProductSpecs).length > 0 ? newProductSpecs : undefined,
            default_selling_price: newProductPrice ? parseFloat(newProductPrice) : undefined,
          },
        ],
      });

      toast.success(`Product '${created.name}' created!`);
      setIsCreatingProduct(false);
      setNewProductName('');
      setNewProductBrand('');
      setNewProductStorage('');
      setNewProductColor('');
      setNewProductPrice('');
      setNewProductSpecs({});

      onIntakeSuccess();
      setSelectedProductId(created.id);
      if (created.variants && created.variants.length > 0) {
        setSelectedVariantId(created.variants[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Handle Quick Inline Variant Creation
  const handleCreateVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    try {
      setIsSubmittingVariant(true);
      const created = await api.addVariant(selectedProductId, {
        storage: newVarStorage.trim() || undefined,
        color: newVarColor.trim() || undefined,
        specs: newVarCustomSpec ? { spec: newVarCustomSpec.trim() } : undefined,
        default_selling_price: newVarPrice ? parseFloat(newVarPrice) : undefined,
      });

      toast.success(`Variant '${created.display_name}' added!`);
      setIsCreatingVariant(false);
      setNewVarStorage('');
      setNewVarColor('');
      setNewVarPrice('');
      setNewVarCustomSpec('');

      onIntakeSuccess();
      setSelectedVariantId(created.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add variant');
    } finally {
      setIsSubmittingVariant(false);
    }
  };

  // Handle Main Intake Submission
  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      toast.error('Please select a product variant');
      return;
    }

    const cost = parseFloat(costBasis);
    if (isNaN(cost) || cost <= 0) {
      toast.error('Please enter a valid cost basis in ETB');
      return;
    }

    if (hasSerials && !bulkMode && !singleImei.trim()) {
      toast.error('Please provide IMEI or Serial Number for this device');
      return;
    }

    if (hasSerials && bulkMode && parsedImeis.length === 0) {
      toast.error('Please enter at least one Serial / IMEI');
      return;
    }

    try {
      setIsSubmittingIntake(true);

      const payload: any = {
        variant_id: selectedVariantId,
        cost_basis: cost,
        condition,
        selling_price: sellingPrice ? parseFloat(sellingPrice) : undefined,
        supplier_contact_id: supplierId || null,
        location: location || 'Shop Counter',
        notes: notes.trim() || null,
      };

      if (isPhoneOrLaptop) {
        payload.battery_health = batteryHealth ? parseInt(batteryHealth, 10) : null;
        payload.cycle_count = cycleCount ? parseInt(cycleCount, 10) : null;
        payload.sim_type = simType;
      }

      if (hasSerials) {
        if (bulkMode) {
          payload.imeis = parsedImeis;
        } else {
          payload.imei_or_serial = singleImei.trim();
        }
      } else {
        payload.quantity = parseInt(quantity, 10) || 1;
      }

      await api.intakeInventoryUnit(payload);

      toast.success('Stock intake recorded successfully!', {
        description: `Added ${totalUnitsToReceive} unit(s) • Total Investment: ${totalInvestmentCost.toLocaleString()} ETB`,
      });

      // Reset form
      setSingleImei('');
      setBulkImeisText('');
      setQuantity('1');
      setCostBasis('');
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
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Main Dialog Card */}
      <div className="relative z-10 w-full max-w-4xl bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Stock Intake Workspace
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                  Owner Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Receive new inventory, assign condition, record capital cost basis & sync inventory stock.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCategoryManager}
              className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Manage Categories</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* ── STEP 1: CATEGORY SELECTION TABS ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                1. Select Category
              </label>
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>+ Custom Category</span>
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedProductId('');
                      setSelectedVariantId('');
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all border shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                        : 'bg-white dark:bg-[#151b26] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span>{getCategoryIcon(cat.icon, 'w-3.5 h-3.5')}</span>
                    <span>{cat.name}</span>
                    {cat.has_serials ? (
                      <span className="text-[9px] opacity-60 font-mono">Serial</span>
                    ) : (
                      <span className="text-[9px] text-emerald-500 font-mono">Batch</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── STEP 2: PRODUCT / MODEL SELECTION ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                2. Product / Model in {activeCategory?.name || 'Category'}
              </label>
              {!isCreatingProduct && (
                <button
                  type="button"
                  onClick={() => setIsCreatingProduct(true)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ New Product / Model</span>
                </button>
              )}
            </div>

            {/* Inline Product Creator Form */}
            {isCreatingProduct ? (
              <form
                onSubmit={handleCreateProduct}
                className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-3 animate-fadeIn"
              >
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 dark:border-emerald-900/40">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                    Create New Model in {activeCategory?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingProduct(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Model / Device Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sony Bravia 65-inch 4K OLED or PS5 Slim"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      placeholder="Apple, Samsung, Sony, LG, Anker..."
                      value={newProductBrand}
                      onChange={(e) => setNewProductBrand(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Storage / Size
                    </label>
                    <input
                      type="text"
                      placeholder="256GB, 1TB, 65-inch..."
                      value={newProductStorage}
                      onChange={(e) => setNewProductStorage(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Color / Edition
                    </label>
                    <input
                      type="text"
                      placeholder="Space Black, White, Disc Edition..."
                      value={newProductColor}
                      onChange={(e) => setNewProductColor(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Selling Price (ETB)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 145000"
                      value={newProductPrice}
                      onChange={(e) => setNewProductPrice(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProduct(false)}
                    className="px-3 h-8 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingProduct}
                    className="px-4 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    {isSubmittingProduct ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    <span>Save & Select Model</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={`Search ${activeCategory?.name || 'models'}...`}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No products found under <span className="font-semibold">{activeCategory?.name}</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreatingProduct(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create First {activeCategory?.name} Model</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-40 overflow-y-auto pr-1">
                    {filteredProducts.map((p) => {
                      const isSelected = p.id === selectedProductId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProductId(p.id);
                            if (p.variants && p.variants.length > 0) {
                              setSelectedVariantId(p.variants[0].id);
                            } else {
                              setSelectedVariantId('');
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs'
                              : 'bg-white dark:bg-[#151b26] text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs truncate">{p.name}</div>
                          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`}>
                            {p.variants.length} variant(s)
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── STEP 3: VARIANT / SPECS SELECTION ── */}
          {selectedProduct && (
            <div className="space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  3. Select Variant & Specs for {selectedProduct.name}
                </label>
                {!isCreatingVariant && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingVariant(true)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ New Variant / Specs</span>
                  </button>
                )}
              </div>

              {/* Inline Variant Creator */}
              {isCreatingVariant ? (
                <form
                  onSubmit={handleCreateVariant}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 animate-fadeIn"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>Add New Variant to {selectedProduct.name}</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingVariant(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Storage / Size</label>
                      <input
                        type="text"
                        placeholder="256GB, 1TB, 65-inch..."
                        value={newVarStorage}
                        onChange={(e) => setNewVarStorage(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Color / Finish</label>
                      <input
                        type="text"
                        placeholder="Natural Titanium, Black..."
                        value={newVarColor}
                        onChange={(e) => setNewVarColor(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Dynamic Specs</label>
                      <input
                        type="text"
                        placeholder="Disc Edition, 4K OLED, Privacy..."
                        value={newVarCustomSpec}
                        onChange={(e) => setNewVarCustomSpec(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Selling Price (ETB)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="165000"
                        value={newVarPrice}
                        onChange={(e) => setNewVarPrice(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingVariant(false)}
                      className="px-3 h-7 rounded-lg text-xs text-slate-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingVariant}
                      className="px-3.5 h-7 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1"
                    >
                      {isSubmittingVariant ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>Save Variant</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.variants.map((v) => {
                    const isSelected = v.id === selectedVariantId;
                    const specParts = [
                      v.storage,
                      v.ram ? `${v.ram} RAM` : '',
                      v.color,
                      ...(v.specs ? Object.values(v.specs) : []),
                    ].filter(Boolean);

                    const displayLabel = specParts.join(' • ') || 'Standard Specification';

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-[#151b26] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        <span>{displayLabel}</span>
                        {v.default_selling_price && (
                          <span className={`font-mono text-[11px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {Number(v.default_selling_price).toLocaleString()} ETB
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: INTAKE PARAMETERS & FINANCIALS ── */}
          {selectedVariant && (
            <form onSubmit={handleSubmitIntake} className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span>4. Receiving Parameters & Financial Cost Basis</span>
                </label>

                {hasSerials && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium">Serial Mode:</span>
                    <div className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg flex text-[11px]">
                      <button
                        type="button"
                        onClick={() => setBulkMode(false)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                          !bulkMode ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-400'
                        }`}
                      >
                        Single Unit
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkMode(true)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                          bulkMode ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-400'
                        }`}
                      >
                        Bulk Paste ({parsedImeis.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Serial / Quantity Inputs */}
              {hasSerials ? (
                bulkMode ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Paste Serial Numbers / IMEIs (One per line or separated by comma) *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={bulkImeisText}
                      onChange={(e) => setBulkImeisText(e.target.value)}
                      placeholder="359871109911111&#10;359871109922222&#10;359871109933333"
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                      {parsedImeis.length} device serials detected. {parsedImeis.length} individual units will be created.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Serial Number / IMEI *
                      </label>
                      <div className="relative">
                        <Barcode className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={singleImei}
                          onChange={(e) => setSingleImei(e.target.value)}
                          placeholder="e.g. 359871109988776 or SN: LG65-8821"
                          className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Device Physical Condition
                      </label>
                      <select
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs focus:outline-none"
                      >
                        <option value="new">Brand New (Factory Sealed)</option>
                        <option value="open_box">Open Box (Like New, 100%)</option>
                        <option value="used_clean">Used Clean (Grade A)</option>
                        <option value="used_fair">Used Fair (Grade B)</option>
                        <option value="refurbished">Refurbished / Inspected</option>
                      </select>
                    </div>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Quantity Received (Units) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Batch item without unique serial numbers (screen protectors, cables, CDs).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Batch Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs focus:outline-none"
                    >
                      <option value="new">Brand New</option>
                      <option value="used_clean">Pre-owned Clean</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Phone / Laptop Hardware Attributes */}
              {isPhoneOrLaptop && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1 flex items-center gap-1">
                      <BatteryCharging className="w-3 h-3 text-emerald-500" />
                      <span>Battery Health (%)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={batteryHealth}
                      onChange={(e) => setBatteryHealth(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono"
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
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      SIM Capability
                    </label>
                    <select
                      value={simType}
                      onChange={(e) => setSimType(e.target.value as any)}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs"
                    >
                      <option value="physical">Physical SIM</option>
                      <option value="esim">eSIM Only</option>
                      <option value="dual">Dual SIM (Physical + eSIM)</option>
                      <option value="na">N/A</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Financial Cost Basis & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cost Basis per Unit (ETB) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 140000"
                    value={costBasis}
                    onChange={(e) => setCostBasis(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Selling Price (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 165000"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shop Location
                  </label>
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs"
                  >
                    <option value="Shop Counter">Shop Counter</option>
                    <option value="Display Showcase">Display Showcase</option>
                    <option value="Accessory Display Wall">Accessory Display Wall</option>
                    <option value="Backroom Safe">Backroom Safe</option>
                  </select>
                </div>
              </div>

              {/* Supplier & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purchased From (Supplier / Peer Vendor)
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs"
                  >
                    <option value="">-- Select Sourcing Contact (Optional) --</option>
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Internal Inspection Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Imported sealed box with original warranty card"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs"
                  />
                </div>
              </div>

              {/* Financial Calculation Strip */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Capital Outlay Summary
                  </div>
                  <div className="text-sm font-bold font-mono mt-0.5">
                    Receiving {totalUnitsToReceive} unit(s) • Total Investment: {totalInvestmentCost.toLocaleString()} ETB
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  {totalProjectedRevenue > 0 && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Projected Revenue</span>
                      <span className="font-bold text-emerald-400">
                        {totalProjectedRevenue.toLocaleString()} ETB
                      </span>
                    </div>
                  )}
                  {totalProjectedRevenue > totalInvestmentCost && (
                    <div>
                      <span className="text-slate-400 text-[10px] block">Estimated Profit</span>
                      <span className="font-bold text-teal-300">
                        +{(totalProjectedRevenue - totalInvestmentCost).toLocaleString()} ETB
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIntake}
                  className="px-5 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSubmittingIntake ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                  )}
                  <span>
                    Record Intake ({totalUnitsToReceive} {totalUnitsToReceive === 1 ? 'Unit' : 'Units'})
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
