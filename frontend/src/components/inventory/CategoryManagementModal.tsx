import React, { useState } from 'react';
import type { ProductCategory } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Tag,
  Smartphone,
  Laptop,
  Tv,
  Gamepad2,
  Gamepad,
  Headphones,
  Disc,
  Monitor,
  ShieldCheck,
  Zap,
  Sparkles,
  Watch,
  Camera,
  Speaker,
  Tablet,
  Barcode,
  Boxes,
  Loader2,
  Layers,
} from 'lucide-react';

interface CategoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  onCategoriesChanged: () => void;
}

export const CategoryIconMap: Record<string, React.FC<{ className?: string }>> = {
  smartphone: Smartphone,
  laptop: Laptop,
  tv: Tv,
  'gamepad-2': Gamepad2,
  gamepad: Gamepad,
  headphones: Headphones,
  disc: Disc,
  monitor: Monitor,
  'shield-check': ShieldCheck,
  zap: Zap,
  sparkles: Sparkles,
  watch: Watch,
  camera: Camera,
  speaker: Speaker,
  tablet: Tablet,
  tag: Tag,
};

export const getCategoryIcon = (iconName?: string, className: string = 'w-4 h-4') => {
  const IconComponent = CategoryIconMap[iconName || 'tag'] || Tag;
  return <IconComponent className={className} />;
};

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  onClose,
  categories,
  onCategoriesChanged,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tag');
  const [description, setDescription] = useState('');
  const [hasSerials, setHasSerials] = useState(true);
  const [specFieldsStr, setSpecFieldsStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingCategory(null);
    setName('');
    setIcon('tag');
    setDescription('');
    setHasSerials(true);
    setSpecFieldsStr('');
    setIsCreating(true);
  };

  const handleStartEdit = (cat: ProductCategory) => {
    setIsCreating(false);
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(cat.icon || 'tag');
    setDescription(cat.description || '');
    setHasSerials(cat.has_serials);
    setSpecFieldsStr(cat.spec_fields ? cat.spec_fields.join(', ') : '');
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingCategory(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    const specFields = specFieldsStr
      ? specFieldsStr.split(',').map((s) => s.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean)
      : undefined;

    try {
      setIsSubmitting(true);
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: name.trim(),
          icon,
          description: description.trim() || undefined,
          has_serials: hasSerials,
          spec_fields: specFields,
        });
        toast.success(`Category '${name}' updated!`);
      } else {
        await api.createCategory({
          name: name.trim(),
          icon,
          description: description.trim() || undefined,
          has_serials: hasSerials,
          spec_fields: specFields,
        });
        toast.success(`Category '${name}' created!`);
      }

      handleCancelForm();
      onCategoriesChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat: ProductCategory) => {
    if ((cat.products_count || 0) > 0) {
      toast.error('Cannot delete category', {
        description: `This category has ${cat.products_count} product(s). Remove or reassign them first.`,
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete '${cat.name}'?`)) return;

    try {
      await api.deleteCategory(cat.id);
      toast.success(`Category '${cat.name}' deleted.`);
      onCategoriesChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <div className="relative z-10 w-full max-w-3xl bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-modal-enter flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Product Categories & Taxonomy
              </h2>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Organize shop inventory (Smartphones, TVs, Laptops, Consoles, Screen Protectors & Accessories)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && !editingCategory && (
              <button
                onClick={handleStartCreate}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Category</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Create or Edit Form */}
          {(isCreating || editingCategory) && (
            <form onSubmit={handleSaveCategory} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Smart Watches & Bands"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Icon Representation
                  </label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="smartphone">📱 Smartphone</option>
                    <option value="laptop">💻 Laptop</option>
                    <option value="gamepad-2">🎮 PlayStation & Consoles</option>
                    <option value="tv">📺 TV & Smart Display</option>
                    <option value="headphones">🎧 Audio & Headphones</option>
                    <option value="gamepad">🕹️ Gaming Controller</option>
                    <option value="disc">💿 Game CD / Disc</option>
                    <option value="monitor">🖥️ Desktop & Mac Mini</option>
                    <option value="shield-check">🛡️ Screen Protectors & Glass</option>
                    <option value="zap">⚡ Charger & Power</option>
                    <option value="sparkles">✨ Gadgets & Accessories</option>
                    <option value="watch">⌚ Smart Watch</option>
                    <option value="speaker">🔊 Bluetooth Speaker</option>
                    <option value="camera">📷 Camera & Gear</option>
                    <option value="tablet">📟 Tablet & iPad</option>
                    <option value="tag">🏷️ General Tag</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apple Watch, Galaxy Watch, fit bands and straps"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Inventory Tracking Mode */}
                <div className="p-3 rounded-xl bg-white dark:bg-[#151b26] border border-slate-200 dark:border-slate-800">
                  <div className="text-xs font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                    {hasSerials ? <Barcode className="w-4 h-4 text-emerald-500" /> : <Boxes className="w-4 h-4 text-blue-500" />}
                    <span>Tracking Model</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasSerials"
                        checked={hasSerials}
                        onChange={() => setHasSerials(true)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Serialized (Unique IMEI / Serial)</span>
                    </label>
                    <p className="text-[10px] text-slate-400 pl-5">Phones, Laptops, Consoles, TVs, Joysticks</p>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="radio"
                        name="hasSerials"
                        checked={!hasSerials}
                        onChange={() => setHasSerials(false)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Batch / Quantity (No Serial)</span>
                    </label>
                    <p className="text-[10px] text-slate-400 pl-5">Screen Protectors, Game CDs, Cables, Adapters</p>
                  </div>
                </div>

                {/* Common Spec Fields */}
                <div className="p-3 rounded-xl bg-white dark:bg-[#151b26] border border-slate-200 dark:border-slate-800">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white mb-1">
                    Relevant Specification Keys
                  </label>
                  <input
                    type="text"
                    placeholder="storage, ram, color, screen_size..."
                    value={specFieldsStr}
                    onChange={(e) => setSpecFieldsStr(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Comma-separated list of attributes for products in this category.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-3.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingCategory ? 'Update Category' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Categories List View */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Active Store Categories ({categories.length})
              </span>
              <input
                type="text"
                placeholder="Filter categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-48"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151b26] hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0 shadow-xs">
                      {getCategoryIcon(cat.icon, 'w-5 h-5')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {cat.name}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {cat.description || 'Standard electronic catalog category.'}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {cat.products_count || 0} models
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">
                          {cat.in_stock_units_count || 0} in stock
                        </span>
                        {cat.has_serials ? (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                            <Barcode className="w-3 h-3 text-slate-400" />
                            <span>Serial</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-blue-500 dark:text-blue-400 font-mono flex items-center gap-0.5">
                            <Boxes className="w-3 h-3" />
                            <span>Batch</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => handleStartEdit(cat)}
                      title="Edit Category"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {(cat.products_count || 0) === 0 && (
                      <button
                        onClick={() => handleDelete(cat)}
                        title="Delete Category"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Categories synchronize across counter, inventory, and stock intake.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
