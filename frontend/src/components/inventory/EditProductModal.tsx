import React, { useState, useEffect } from 'react';
import type { Product, ProductCategory, ProductVariant } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Loader2,
  Package,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Sparkles,
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

  // Loading states
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add Variant State
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newStorage, setNewStorage] = useState('');
  const [newRam, setNewRam] = useState('');
  const [newColor, setNewColor] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [addingVariant, setAddingVariant] = useState(false);

  // Edit Variant Inline State
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStorage, setEditStorage] = useState('');
  const [editRam, setEditRam] = useState('');
  const [editColor, setEditColor] = useState('');
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
    }
  }, [product, categories]);

  if (!isOpen || !product) return null;

  const currentCategory = categories.find((c) => c.id === categoryId);

  // Handle Save General Info
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }

    try {
      setSavingGeneral(true);
      const res = await api.updateProduct(product.id, {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category_id: categoryId || undefined,
        has_serials: hasSerials,
        is_active: isActive,
      });

      toast.success('Product Updated', {
        description: `'${res.data.name}' details have been saved successfully.`,
      });
      onProductUpdated();
    } catch (err: any) {
      toast.error('Failed to update product', { description: err.message });
    } finally {
      setSavingGeneral(false);
    }
  };

  // Handle Add Variant
  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAddingVariant(true);
      const res = await api.addVariant(product.id, {
        storage: newStorage.trim() || undefined,
        ram: newRam.trim() || undefined,
        color: newColor.trim() || undefined,
        sku: newSku.trim() || undefined,
        default_selling_price: newPrice ? parseFloat(newPrice) : undefined,
      });

      toast.success('Variant Added', {
        description: `New variant added to ${product.name}.`,
      });

      setVariants((prev) => [...prev, res]);
      setNewStorage('');
      setNewRam('');
      setNewColor('');
      setNewSku('');
      setNewPrice('');
      setShowAddVariant(false);
      onProductUpdated();
    } catch (err: any) {
      toast.error('Failed to add variant', { description: err.message });
    } finally {
      setAddingVariant(false);
    }
  };

  // Handle Update Variant
  const handleSaveVariant = async (variantId: string) => {
    try {
      setSavingVariant(true);
      const res = await api.updateVariant(variantId, {
        storage: editStorage.trim() || undefined,
        ram: editRam.trim() || undefined,
        color: editColor.trim() || undefined,
        default_selling_price: editPrice ? parseFloat(editPrice) : undefined,
      });

      toast.success('Variant Updated');
      setVariants((prev) =>
        prev.map((v) => (v.id === variantId ? { ...v, ...res.data } : v))
      );
      setEditingVariantId(null);
      onProductUpdated();
    } catch (err: any) {
      toast.error('Failed to update variant', { description: err.message });
    } finally {
      setSavingVariant(false);
    }
  };

  // Handle Delete Variant
  const handleDeleteVariant = async (variantId: string) => {
    if (!window.confirm('Are you sure you want to remove this variant specification?')) return;

    try {
      setDeletingVariantId(variantId);
      await api.deleteVariant(variantId);
      toast.success('Variant Removed');
      setVariants((prev) => prev.filter((v) => v.id !== variantId));
      onProductUpdated();
    } catch (err: any) {
      toast.error('Cannot remove variant', { description: err.message });
    } finally {
      setDeletingVariantId(null);
    }
  };

  // Handle Delete / Archive Product
  const handleDeleteProduct = async () => {
    try {
      setDeletingProduct(true);
      const res = await api.deleteProduct(product.id);
      if (res.deactivated) {
        toast.success('Product Archived', {
          description: res.message,
        });
      } else {
        toast.success('Product Deleted', {
          description: res.message,
        });
      }
      onClose();
      if (onProductDeleted) {
        onProductDeleted();
      } else {
        onProductUpdated();
      }
    } catch (err: any) {
      toast.error('Cannot delete product', { description: err.message });
    } finally {
      setDeletingProduct(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-300">
              {currentCategory?.icon ? getCategoryIcon(currentCategory.icon, 'w-5 h-5') : <Package className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {product.name}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isActive ? 'Active Catalog' : 'Archived'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage product details, variant specifications, and catalog visibility
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Form 1: General Product Details */}
          <form onSubmit={handleSaveGeneral} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                General Product Information
              </span>
              <button
                type="submit"
                disabled={savingGeneral}
                className="h-8 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                {savingGeneral ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                )}
                <span>Save Info</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. iPhone 12 Pro"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              {/* Brand */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Brand / Manufacturer
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Apple, Sony, Samsung"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              {/* Category */}
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

              {/* Serialization Tracking */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tracking Model
                </label>
                <div className="grid grid-cols-2 gap-2 h-10">
                  <button
                    type="button"
                    onClick={() => setHasSerials(true)}
                    className={`h-full rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                      hasSerials
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span>Serialized</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasSerials(false)}
                    className={`h-full rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                      !hasSerials
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-2xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span>Batch / Bulk</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Catalog Active Status Switch */}
            <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Catalog Visibility
                </span>
                <p className="text-[11px] text-slate-400">
                  {isActive
                    ? 'Product is active and selectable in stock intake and sales checkout.'
                    : 'Archived. Hidden from active dropdowns while preserving ledger integrity.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {isActive ? 'Active' : 'Archived'}
              </button>
            </div>
          </form>

          {/* Form 2: Variants & Specifications */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Variants & Specifications ({variants.length})
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure storage, colors, RAM, and benchmark selling prices
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVariant(!showAddVariant)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-2xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-500" />
                <span>{showAddVariant ? 'Cancel' : 'Add Variant'}</span>
              </button>
            </div>

            {/* Add Variant Form Drawer */}
            {showAddVariant && (
              <form
                onSubmit={handleAddVariant}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 space-y-3 animate-page-enter"
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Add New Variant Spec</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Storage
                    </label>
                    <input
                      type="text"
                      value={newStorage}
                      onChange={(e) => setNewStorage(e.target.value)}
                      placeholder="e.g. 256GB"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
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
                      placeholder="e.g. 8GB"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
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
                      placeholder="e.g. Pacific Blue"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Selling Price (ETB)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      placeholder="e.g. 54000"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium font-mono text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddVariant(false)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingVariant}
                    className="h-8 px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {addingVariant ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Add Variant</span>
                  </button>
                </div>
              </form>
            )}

            {/* Existing Variants List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              {variants.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No variants defined yet. Add at least one specification.
                </div>
              ) : (
                variants.map((variant) => {
                  const isEditing = editingVariantId === variant.id;
                  const specItems = [
                    variant.storage,
                    variant.ram ? `${variant.ram} RAM` : null,
                    variant.color,
                  ].filter(Boolean);

                  return (
                    <div
                      key={variant.id}
                      className="p-3.5 bg-white dark:bg-[#131926] hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 font-semibold block mb-0.5">
                                Storage
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
                                Default Price (ETB)
                              </label>
                              <input
                                type="number"
                                step="any"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
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
                              onClick={() => handleSaveVariant(variant.id)}
                              disabled={savingVariant}
                              className="h-7 px-3 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1"
                            >
                              {savingVariant ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {specItems.length > 0 ? specItems.join(' • ') : 'Standard Specification'}
                            </span>
                            {variant.sku && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                {variant.sku}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              {variant.default_selling_price
                                ? `${Number(variant.default_selling_price).toLocaleString()} ETB`
                                : 'No default price'}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingVariantId(variant.id);
                                setEditStorage(variant.storage || '');
                                setEditRam(variant.ram || '');
                                setEditColor(variant.color || '');
                                setEditPrice(variant.default_selling_price ? String(variant.default_selling_price) : '');
                              }}
                              className="px-2 py-1 rounded text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(variant.id)}
                              disabled={deletingVariantId === variant.id}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Delete variant (only if 0 active units)"
                            >
                              {deletingVariantId === variant.id ? (
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

          {/* Section 3: Danger Zone / Safe Deletion & Archival */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Archive or Remove Product</span>
                  </div>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80">
                    If this product has historical sales or units, it will be safely deactivated/archived
                    to preserve sales logs and financial ledger balance. If it has 0 units and 0 sales, it
                    will be permanently removed.
                  </p>
                </div>

                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs shrink-0 flex items-center gap-1.5 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Product</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="h-8 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteProduct}
                      disabled={deletingProduct}
                      className="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
                    >
                      {deletingProduct ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Confirm Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
