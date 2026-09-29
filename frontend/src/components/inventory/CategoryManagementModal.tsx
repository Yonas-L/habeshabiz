import React, { useState } from 'react';
import type { ProductCategory } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import {
  X,
  Plus,
  Trash2,
  Edit2,
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
  ChevronDown,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingCategory(null);
    setName('');
    setIcon('tag');
    setDescription('');
    setHasSerials(true);
    setIsCreating(true);
  };

  const handleStartEdit = (cat: ProductCategory) => {
    setIsCreating(false);
    setEditingCategory(cat);
    setName(cat.name);
    setIcon(cat.icon || 'tag');
    setDescription(cat.description || '');
    setHasSerials(cat.has_serials);
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

    try {
      setIsSubmitting(true);
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, {
          name: name.trim(),
          icon,
          description: description.trim() || undefined,
          has_serials: hasSerials,
        });
        toast.success(`Category '${name}' updated`);
      } else {
        await api.createCategory({
          name: name.trim(),
          icon,
          description: description.trim() || undefined,
          has_serials: hasSerials,
        });
        toast.success(`Category '${name}' created`);
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
        description: `This category contains ${cat.products_count} catalog product(s). Remove or reassign them first.`,
      });
      return;
    }

    if (!window.confirm(`Delete category '${cat.name}'?`)) return;

    try {
      await api.deleteCategory(cat.id);
      toast.success(`Category '${cat.name}' deleted`);
      onCategoriesChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const filteredCategories = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet Surface */}
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[92vh] sm:max-h-[90vh] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-0">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Manage Categories
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              Organize inventory catalog and tracking modes
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isCreating && !editingCategory && (
              <button
                onClick={handleStartCreate}
                className="h-8 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Category</span>
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
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Create or Edit Inline Card */}
          {(isCreating || editingCategory) && (
            <form
              onSubmit={handleSaveCategory}
              className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {editingCategory ? `Edit: ${editingCategory.name}` : 'Create New Category'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Smart Watches, Audio, Accessories"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Icon
                  </label>
                  <div className="relative">
                    <select
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none"
                    >
                      <option value="smartphone">Smartphone</option>
                      <option value="laptop">Laptop / MacBook</option>
                      <option value="gamepad-2">Gaming Console</option>
                      <option value="gamepad">Gaming Controller / Joystick</option>
                      <option value="tv">Television & Display</option>
                      <option value="headphones">Headphones & Audio</option>
                      <option value="disc">Game Disc / CD</option>
                      <option value="monitor">Desktop / Mac Mini</option>
                      <option value="shield-check">Screen Protector & Glass</option>
                      <option value="zap">Charger & Power</option>
                      <option value="speaker">Speaker</option>
                      <option value="watch">Smartwatch</option>
                      <option value="tablet">Tablet / iPad</option>
                      <option value="sparkles">Gadget / Other</option>
                      <option value="tag">General Tag</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apple Watches, Galaxy Watches and accessories"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Tracking Mode Toggle */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Stock Tracking Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setHasSerials(true)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      hasSerials
                        ? 'border-slate-900 dark:border-white bg-white dark:bg-[#151b26] shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <Barcode className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Serialized (Unique IMEI)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Phones, Consoles, TVs, Laptops
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHasSerials(false)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      !hasSerials
                        ? 'border-slate-900 dark:border-white bg-white dark:bg-[#151b26] shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <Boxes className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Batch Count (Quantity)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Screen Protectors, CDs, Cables
                    </p>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-8 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </span>
                  ) : editingCategory ? (
                    'Update Category'
                  ) : (
                    'Save Category'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Search bar */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Catalog Categories ({categories.length})
            </span>
            <input
              type="text"
              placeholder="Filter categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-44"
            />
          </div>

          {/* Category Cards List */}
          <div className="space-y-2">
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#151b26] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                    {getCategoryIcon(cat.icon, 'w-4 h-4')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {cat.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        {cat.has_serials ? 'Serial' : 'Batch'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{cat.products_count || 0} models</span>
                      <span>•</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {cat.in_stock_units_count || 0} in stock
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStartEdit(cat)}
                    title="Edit Category"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {(cat.products_count || 0) === 0 && (
                    <button
                      onClick={() => handleDelete(cat)}
                      title="Delete Category"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-end">
          <button
            onClick={onClose}
            className="h-8 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
