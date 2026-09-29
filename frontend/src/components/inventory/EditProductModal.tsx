import React, { useState, useEffect, useMemo } from 'react';
import type { Product, ProductCategory, ProductVariant } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Loader2,
  Package,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Edit2,
  Check,
} from 'lucide-react';
import { getCategoryIcon } from './CategoryManagementModal';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: ProductCategory[];
  onProductUpdated: () => void;
  onProductDeleted?: () => void;
}

type CategoryArchetype =
  | 'phone_tablet'
  | 'laptop'
  | 'screen_protector'
  | 'charger_cable'
  | 'smartwatch'
  | 'general';

function getCategoryArchetype(slug?: string, name?: string): CategoryArchetype {
  const s = ((slug || '') + ' ' + (name || '')).toLowerCase();
  if (s.includes('protector') || s.includes('tempered') || s.includes('glass')) {
    return 'screen_protector';
  }
  if (s.includes('charger') || s.includes('adapter') || s.includes('cable') || s.includes('power')) {
    return 'charger_cable';
  }
  if (s.includes('watch') || s.includes('band')) {
    return 'smartwatch';
  }
  if (s.includes('laptop') || s.includes('macbook') || s.includes('computer')) {
    return 'laptop';
  }
  if (s.includes('phone') || s.includes('tablet') || s.includes('ipad') || s.includes('smartphone')) {
    return 'phone_tablet';
  }
  return 'general';
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  product,
  categories,
  onProductUpdated,
  onProductDeleted,
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [hasSerials, setHasSerials] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Action states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add Variant Form State
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);
  const [newStorage, setNewStorage] = useState('');
  const [newRam, setNewRam] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newProcessor, setNewProcessor] = useState('');
  const [newCompatibility, setNewCompatibility] = useState('');
  const [newGlassType, setNewGlassType] = useState('');
  const [newWattage, setNewWattage] = useState('');
  const [newCaseSize, setNewCaseSize] = useState('');
  const [newGeneralSpec, setNewGeneralSpec] = useState('');
  const [newPrice, setNewPrice] = useState('');

  // Inline Edit Variant State
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editStorage, setEditStorage] = useState('');
  const [editRam, setEditRam] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [savingVariant, setSavingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setBrand(product.brand || '');
      setCategoryId(product.category_id || categories.find((c) => c.slug === product.category)?.id || '');
      setHasSerials(product.has_serials ?? true);
      setIsActive(product.is_active ?? true);
      setVariants(product.variants || []);
      setShowAddVariant(false);
      setEditingVariantId(null);
      setShowDeleteConfirm(false);
      resetNewVariantInputs();
    }
  }, [product, categories]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentCategory = useMemo(() => {
    return categories.find((c) => c.id === categoryId) || categories.find((c) => c.slug === product?.category);
  }, [categories, categoryId, product]);

  const activeArchetype = useMemo(() => {
    return getCategoryArchetype(currentCategory?.slug, currentCategory?.name);
  }, [currentCategory]);

  const resetNewVariantInputs = () => {
    setNewStorage('');
    setNewRam('');
    setNewColor('');
    setNewProcessor('');
    setNewCompatibility('');
    setNewGlassType('');
    setNewWattage('');
    setNewCaseSize('');
    setNewGeneralSpec('');
    setNewPrice('');
  };

  if (!isOpen || !product) return null;

  // Handle Save Main Product Details
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Product model name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.updateProduct(product.id, {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category_id: categoryId || undefined,
        has_serials: hasSerials,
        is_active: isActive,
      });

      const updatedName = (res as any)?.name || (res as any)?.data?.name || name.trim();
      toast.success('Product updated', {
        description: `'${updatedName}' details have been saved.`,
      });
      onProductUpdated();
      onClose();
    } catch (err: any) {
      toast.error('Failed to update product', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Variant
  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddingVariant(true);

      const payload: any = {
        default_selling_price: newPrice ? parseFloat(newPrice) : undefined,
      };

      switch (activeArchetype) {
        case 'laptop':
          payload.storage = newStorage.trim() || undefined;
          payload.ram = newRam.trim() || undefined;
          payload.color = newColor.trim() || undefined;
          if (newProcessor.trim()) {
            payload.specs = { processor: newProcessor.trim() };
          }
          break;
        case 'screen_protector':
          payload.specs = {
            compatible_model: newCompatibility.trim() || undefined,
            glass_type: newGlassType.trim() || undefined,
          };
          payload.storage = newCompatibility.trim() || undefined;
          payload.color = newGlassType.trim() || undefined;
          break;
        case 'charger_cable':
          payload.specs = {
            wattage: newWattage.trim() || undefined,
          };
          payload.storage = newWattage.trim() || undefined;
          payload.color = newColor.trim() || undefined;
          break;
        case 'smartwatch':
          payload.specs = {
            case_size: newCaseSize.trim() || undefined,
          };
          payload.storage = newCaseSize.trim() || undefined;
          payload.color = newColor.trim() || undefined;
          break;
        case 'phone_tablet':
          payload.storage = newStorage.trim() || undefined;
          payload.ram = newRam.trim() || undefined;
          payload.color = newColor.trim() || undefined;
          break;
        default:
          payload.storage = newGeneralSpec.trim() || undefined;
          payload.color = newColor.trim() || undefined;
          break;
      }

      const res = await api.addVariant(product.id, payload);
      const newVar = (res as any)?.id ? res : (res as any)?.data;
      if (newVar) {
        setVariants((prev) => [...prev, newVar]);
      }
      toast.success('Specification Added');
      setShowAddVariant(false);
      resetNewVariantInputs();
      onProductUpdated();
    } catch (err: any) {
      toast.error('Failed to add specification', { description: err.message });
    } finally {
      setAddingVariant(false);
    }
  };

  // Handle Save Variant
  const handleSaveVariant = async (variantId: string) => {
    try {
      setSavingVariant(true);
      const res = await api.updateVariant(variantId, {
        storage: editStorage.trim() || undefined,
        ram: editRam.trim() || undefined,
        color: editColor.trim() || undefined,
        default_selling_price: editPrice ? parseFloat(editPrice) : undefined,
      });

      const updated = (res as any)?.id ? res : (res as any)?.data || { id: variantId };
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, ...updated } : v))
      );
      toast.success('Specification updated');
      setEditingVariantId(null);
      onProductUpdated();
    } catch (err: any) {
      toast.error('Failed to update specification', { description: err.message });
    } finally {
      setSavingVariant(false);
    }
  };

  // Handle Delete Variant
  const handleDeleteVariant = async (variantId: string) => {
    try {
      setDeletingVariantId(variantId);
      await api.deleteVariant(variantId);
      toast.success('Specification removed');
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
      onProductUpdated();
    } catch (err: any) {
      toast.error('Cannot remove specification', { description: err.message });
    } finally {
      setDeletingVariantId(null);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = async () => {
    try {
      setDeletingProduct(true);
      const res = await api.deleteProduct(product.id);
      toast.success('Product Removed', {
        description: (res as any)?.message || 'Product removed. Historical sales and records remain preserved.',
      });
      onClose();
      if (onProductDeleted) {
        onProductDeleted();
      } else {
        onProductUpdated();
      }
    } catch (err: any) {
      toast.error('Failed to remove product', { description: err.message });
    } finally {
      setDeletingProduct(false);
      setShowDeleteConfirm(false);
    }
  };

  const getVariantDisplayLabel = (v: ProductVariant) => {
    const parts = [
      v.storage,
      v.ram ? `${v.ram} RAM` : null,
      v.color,
    ].filter(Boolean);

    if (v.specs) {
      if (v.specs.processor && !parts.includes(v.specs.processor)) parts.push(v.specs.processor);
      if (v.specs.compatible_model && !parts.includes(v.specs.compatible_model)) parts.push(v.specs.compatible_model);
      if (v.specs.glass_type && !parts.includes(v.specs.glass_type)) parts.push(v.specs.glass_type);
      if (v.specs.wattage && !parts.includes(v.specs.wattage)) parts.push(v.specs.wattage);
      if (v.specs.case_size && !parts.includes(v.specs.case_size)) parts.push(v.specs.case_size);
    }

    return parts.length > 0 ? parts.join(' • ') : 'Standard Specification';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-8 pt-0 sm:pt-24 pb-0 sm:pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet Surface */}
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[92vh] sm:max-h-[calc(100vh-7rem)] my-0 sm:my-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              {currentCategory?.icon ? (
                getCategoryIcon(currentCategory.icon, 'w-4 h-4')
              ) : (
                <Package className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                  Edit Product
                </h2>
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isActive ? 'Active' : 'Archived'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Update model name, category, and specifications
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="edit-product-form" onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Main Info Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Product Model Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MacBook Pro M5, iPhone 16 Pro Max"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Apple, Samsung, Sony"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <div className="relative">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 appearance-none cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Visibility Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Catalog Status
                </span>
                <span className="text-[11px] text-slate-400">
                  {isActive
                    ? 'Active in catalog and selectable during stock intake & sales checkout.'
                    : 'Archived. Hidden from active dropdowns while preserving ledger history.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {isActive ? 'Active' : 'Archived'}
              </button>
            </div>
          </div>

          {/* Variants & Specifications Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Specifications & Variants ({variants.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Setting a benchmark selling price is optional; actual unit costs and prices are set upon intake.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVariant(!showAddVariant)}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-500" />
                <span>{showAddVariant ? 'Cancel' : 'Add Variant'}</span>
              </button>
            </div>

            {/* Inline Add Variant Drawer */}
            {showAddVariant && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-3 animate-page-enter">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-emerald-500" />
                  <span>New Specification</span>
                </div>

                {/* Context-aware dynamic fields */}
                {activeArchetype === 'laptop' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Storage
                      </label>
                      <input
                        type="text"
                        value={newStorage}
                        onChange={(e) => setNewStorage(e.target.value)}
                        placeholder="e.g. 512GB, 1TB"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        RAM
                      </label>
                      <input
                        type="text"
                        value={newRam}
                        onChange={(e) => setNewRam(e.target.value)}
                        placeholder="e.g. 16GB, 32GB"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Color
                      </label>
                      <input
                        type="text"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        placeholder="e.g. Space Black"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Chip / CPU
                      </label>
                      <input
                        type="text"
                        value={newProcessor}
                        onChange={(e) => setNewProcessor(e.target.value)}
                        placeholder="e.g. M5, M5 Pro"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeArchetype === 'phone_tablet' && (
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Storage
                      </label>
                      <input
                        type="text"
                        value={newStorage}
                        onChange={(e) => setNewStorage(e.target.value)}
                        placeholder="e.g. 128GB, 256GB"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        RAM (Optional)
                      </label>
                      <input
                        type="text"
                        value={newRam}
                        onChange={(e) => setNewRam(e.target.value)}
                        placeholder="e.g. 8GB"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Color
                      </label>
                      <input
                        type="text"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        placeholder="e.g. Natural Titanium"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeArchetype === 'screen_protector' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Compatible Phone Model
                      </label>
                      <input
                        type="text"
                        value={newCompatibility}
                        onChange={(e) => setNewCompatibility(e.target.value)}
                        placeholder="e.g. iPhone 16 Pro Max, S24 Ultra"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Glass Type / Finish
                      </label>
                      <input
                        type="text"
                        value={newGlassType}
                        onChange={(e) => setNewGlassType(e.target.value)}
                        placeholder="e.g. Privacy Glass, Clear HD"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeArchetype === 'charger_cable' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Wattage / Spec
                      </label>
                      <input
                        type="text"
                        value={newWattage}
                        onChange={(e) => setNewWattage(e.target.value)}
                        placeholder="e.g. 65W GaN, 20W USB-C"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Color / Finish
                      </label>
                      <input
                        type="text"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        placeholder="e.g. White, Braided Black"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeArchetype === 'smartwatch' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Case Size
                      </label>
                      <input
                        type="text"
                        value={newCaseSize}
                        onChange={(e) => setNewCaseSize(e.target.value)}
                        placeholder="e.g. 45mm, 49mm"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Color / Material
                      </label>
                      <input
                        type="text"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        placeholder="e.g. Midnight Aluminum"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {activeArchetype === 'general' && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Specification / Option
                      </label>
                      <input
                        type="text"
                        value={newGeneralSpec}
                        onChange={(e) => setNewGeneralSpec(e.target.value)}
                        placeholder="e.g. 1TB Edition, Large"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Color
                      </label>
                      <input
                        type="text"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                        placeholder="e.g. Black"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Benchmark Price (Explicitly marked as Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Benchmark Selling Price (Optional)
                    </label>
                    <span className="text-[10px] text-slate-400">ETB</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="e.g. 120,000 (leave blank if dynamic)"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium font-mono text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddVariant(false);
                      resetNewVariantInputs();
                    }}
                    className="h-7 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddVariant}
                    disabled={addingVariant}
                    className="h-7 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {addingVariant ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    <span>Add Variant</span>
                  </button>
                </div>
              </div>
            )}

            {/* Existing Variants List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              {variants.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No specifications defined yet. Click "+ Add Variant" to specify storage or options.
                </div>
              ) : (
                variants.map((v) => {
                  const isEditing = editingVariantId === v.id;

                  return (
                    <div
                      key={v.id}
                      className="p-3 bg-white dark:bg-[#131926] hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                                Storage / Spec
                              </label>
                              <input
                                type="text"
                                value={editStorage}
                                onChange={(e) => setEditStorage(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                                RAM
                              </label>
                              <input
                                type="text"
                                value={editRam}
                                onChange={(e) => setEditRam(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                                Color
                              </label>
                              <input
                                type="text"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                                Benchmark Price
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                placeholder="Optional"
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingVariantId(null)}
                              className="h-7 px-2.5 rounded-md text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveVariant(v.id)}
                              disabled={savingVariant}
                              className="h-7 px-3 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              {savingVariant ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white text-xs block truncate">
                              {getVariantDisplayLabel(v)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                              {v.default_selling_price ? (
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {Number(v.default_selling_price).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">ETB</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No price set</span>
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingVariantId(v.id);
                                setEditStorage(v.storage || '');
                                setEditRam(v.ram || '');
                                setEditColor(v.color || '');
                                setEditPrice(v.default_selling_price ? String(v.default_selling_price) : '');
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit specification"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(v.id)}
                              disabled={deletingVariantId === v.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Remove specification"
                            >
                              {deletingVariantId === v.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </form>

        {/* Delete Confirmation Overlay (If triggered) */}
        {showDeleteConfirm && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200/60 dark:border-rose-900/60 space-y-2 animate-page-enter">
            <div className="flex items-center gap-2 text-rose-900 dark:text-rose-300 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Remove "{product.name}" from catalog?</span>
            </div>
            <p className="text-[11px] text-rose-700/90 dark:text-rose-400/90 leading-relaxed">
              Any unsold units in stock will be archived. All historical sales invoices, payments, and audit logs linked to this model remain safe and intact.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={deletingProduct}
                className="h-8 px-3.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        )}

        {/* Unified Bottom Action Bar */}
        {!showDeleteConfirm && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Product</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-product-form"
                disabled={isSubmitting}
                className="h-9 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-500" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
