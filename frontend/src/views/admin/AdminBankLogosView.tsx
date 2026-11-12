import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  adminApi,
  type AdminBankLogoItem,
} from '../../api/adminClient';
import { CustomPageLoader } from '../../components/loading/CustomPageLoader';
import { toast } from 'sonner';
import {
  UploadCloud,
  Trash2,
  Landmark,
  Smartphone,
  Wallet,
  DollarSign,
  Coins,
  Globe,
  Loader2,
  AlertCircle,
  X,
  Sparkles,
  Layers,
  Edit2,
  Check,
} from 'lucide-react';
import { LOGO_CATEGORIES, type LogoCategoryValue, fetchPlatformBankLogos } from '../../utils/bankLogos';

const CATEGORY_META: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }>; badgeClass: string; color: string }
> = {
  bank: {
    label: 'Bank Account',
    icon: Landmark,
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    color: 'purple',
  },
  mobile_money: {
    label: 'Mobile Money',
    icon: Smartphone,
    badgeClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    color: 'sky',
  },
  cash: {
    label: 'Cash Drawer',
    icon: Wallet,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    color: 'emerald',
  },
  asset_fx: {
    label: 'Foreign Currency',
    icon: DollarSign,
    badgeClass: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    color: 'green',
  },
  asset_gold: {
    label: 'Gold Reserve',
    icon: Coins,
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    color: 'amber',
  },
  custom: {
    label: 'Custom Asset',
    icon: Globe,
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    color: 'slate',
  },
};

export const AdminBankLogosView: React.FC = () => {
  const [logos, setLogos] = useState<AdminBankLogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('all');
  const [uploadCategory, setUploadCategory] = useState<LogoCategoryValue>('bank');
  const [logoToDelete, setLogoToDelete] = useState<AdminBankLogoItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Quick edit state for logo name/category
  const [editingLogo, setEditingLogo] = useState<AdminBankLogoItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<LogoCategoryValue>('bank');
  const [savingEdit, setSavingEdit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLogos = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getBankLogos();
      setLogos(res.data || []);
    } catch (err: any) {
      toast.error('Failed to load logos', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogos();
  }, []);

  // When filter changes (other than 'all'), also update the upload category default
  const handleFilterCategoryChange = (cat: string) => {
    setSelectedFilterCategory(cat);
    if (cat !== 'all') {
      setUploadCategory(cat as LogoCategoryValue);
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList).filter((f) =>
      f.type.startsWith('image/') || f.name.endsWith('.svg')
    );

    if (filesArray.length === 0) {
      toast.error('Invalid files', { description: 'Please select valid image files (PNG, SVG, JPG, WebP).' });
      return;
    }

    try {
      setUploading(true);
      const res = await adminApi.uploadBankLogos(filesArray, uploadCategory);
      toast.success(
        res.message || `${filesArray.length} logo(s) uploaded successfully under ${CATEGORY_META[uploadCategory]?.label || uploadCategory}!`
      );
      await loadLogos();
      await fetchPlatformBankLogos(true);
    } catch (err: any) {
      toast.error('Upload failed', { description: err.message || 'Could not upload logo.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const confirmDelete = async () => {
    if (!logoToDelete) return;
    try {
      setDeletingId(logoToDelete.id);
      await adminApi.deleteBankLogo(logoToDelete.id);
      toast.success('Logo removed', {
        description: `"${logoToDelete.name || 'Logo'}" has been removed from platform library.`,
      });
      setLogos((prev) => prev.filter((l) => l.id !== logoToDelete.id));
      setLogoToDelete(null);
      await fetchPlatformBankLogos(true);
    } catch (err: any) {
      toast.error('Failed to delete logo', { description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (logo: AdminBankLogoItem) => {
    setEditingLogo(logo);
    setEditName(logo.name || '');
    setEditCategory((logo.category as LogoCategoryValue) || 'bank');
  };

  const saveEdit = async () => {
    if (!editingLogo) return;
    try {
      setSavingEdit(true);
      const res = await adminApi.updateBankLogo(editingLogo.id, {
        name: editName.trim(),
        category: editCategory,
      });
      toast.success('Logo updated successfully');
      setLogos((prev) =>
        prev.map((l) => (l.id === editingLogo.id ? { ...l, ...res.data } : l))
      );
      setEditingLogo(null);
      await fetchPlatformBankLogos(true);
    } catch (err: any) {
      toast.error('Failed to update logo', { description: err.message });
    } finally {
      setSavingEdit(false);
    }
  };

  // Filtered logos
  const filteredLogos = useMemo(() => {
    if (selectedFilterCategory === 'all') return logos;
    return logos.filter((l) => l.category === selectedFilterCategory);
  }, [logos, selectedFilterCategory]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: logos.length };
    LOGO_CATEGORIES.forEach((cat) => {
      counts[cat.value] = logos.filter((l) => l.category === cat.value).length;
    });
    return counts;
  }, [logos]);

  if (loading) {
    return <CustomPageLoader mode="admin" fullScreen={false} />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Account & Bank Logos
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              {logos.length} {logos.length === 1 ? 'Logo' : 'Logos'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Upload official logos organized by category (Bank Account, Mobile Money, Cash Drawer, FX, Gold, etc.). When merchants create or edit accounts, the logos for that category are displayed for selection.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-md shadow-violet-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          <span>{uploading ? 'Uploading...' : `Upload to ${CATEGORY_META[uploadCategory]?.label || 'Category'}`}</span>
        </button>
      </div>

      {/* ── Category Filter Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        <button
          type="button"
          onClick={() => handleFilterCategoryChange('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedFilterCategory === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Categories</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono opacity-80">
            {categoryCounts.all}
          </span>
        </button>

        {LOGO_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat.value];
          const Icon = meta.icon;
          const isSelected = selectedFilterCategory === cat.value;
          const count = categoryCounts[cat.value] || 0;

          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleFilterCategoryChange(cat.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Dropzone & Upload Category Selector ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 p-4 sm:p-5 space-y-4">
        {/* Upload Category Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Upload Target Category:
            </span>
            <div className="relative inline-block">
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as LogoCategoryValue)}
                disabled={uploading}
                className="appearance-none pl-3 pr-8 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer"
              >
                {LOGO_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {c.label} ({c.description})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Files uploaded will show under "{CATEGORY_META[uploadCategory]?.label}" in merchant modals</span>
          </div>
        </div>

        {/* Drop Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/30 scale-[1.005]'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 hover:border-violet-400 dark:hover:border-violet-600 hover:bg-violet-50/20 dark:hover:bg-violet-950/10'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            multiple
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="hidden"
            disabled={uploading}
          />

          <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>

            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {uploading ? 'Processing & saving logos...' : `Drop logos for ${CATEGORY_META[uploadCategory]?.label} here, or click to browse`}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                PNG, SVG, JPG, WebP. Select one or multiple files — automatically assigned to <strong>{CATEGORY_META[uploadCategory]?.label}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Logos Grid ── */}
      {filteredLogos.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Landmark className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {selectedFilterCategory === 'all'
              ? 'No logos uploaded yet'
              : `No logos uploaded in "${CATEGORY_META[selectedFilterCategory]?.label || selectedFilterCategory}"`}
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            Select the category in the upload box above and drop images to make them instantly available for your merchants.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {filteredLogos.map((logo) => {
            const isDeletingThis = deletingId === logo.id;
            const meta = CATEGORY_META[logo.category] || CATEGORY_META.bank;
            const CategoryIcon = meta.icon;

            return (
              <div
                key={logo.id}
                className="group relative rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between hover:shadow-lg hover:border-violet-500/40 transition-all overflow-hidden"
              >
                {/* Logo Image Preview Container (Pure frameless image display) */}
                <div className="w-full aspect-square flex items-center justify-center p-2 relative overflow-hidden">
                  <img
                    src={logo.logo_url}
                    alt={logo.name || 'Logo'}
                    className="w-full h-full object-contain filter drop-shadow-xs transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Actions (Top Overlay) */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(logo);
                      }}
                      className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-600 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer"
                      title="Edit name & category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLogoToDelete(logo);
                      }}
                      disabled={isDeletingThis}
                      className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      title="Remove logo"
                    >
                      {isDeletingThis ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-2.5 px-0.5 space-y-1">
                  <p
                    className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                    title={logo.name || 'Logo'}
                  >
                    {logo.name || 'Logo'}
                  </p>

                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border ${meta.badgeClass}`}
                    >
                      <CategoryIcon className="w-2.5 h-2.5" />
                      <span className="truncate max-w-[80px]">{meta.label}</span>
                    </span>

                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(logo.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Logo Modal ── */}
      {editingLogo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-enter">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-bold text-sm">
                <Edit2 className="w-4 h-4" />
                <span>Edit Logo Details</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingLogo(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-14 h-14 flex items-center justify-center shrink-0">
                <img
                  src={editingLogo.logo_url}
                  alt={editingLogo.name || ''}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-400">Current Category</p>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {CATEGORY_META[editingLogo.category]?.label || editingLogo.category}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Logo Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Commercial Bank of Ethiopia"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Account Category
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as LogoCategoryValue)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                >
                  {LOGO_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLogo(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingEdit ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {logoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-backdrop-enter">
          <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Remove Logo</span>
              </div>
              <button
                type="button"
                onClick={() => setLogoToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0">
                <img
                  src={logoToDelete.logo_url}
                  alt={logoToDelete.name || ''}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {logoToDelete.name || 'Logo'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Category: {CATEGORY_META[logoToDelete.category]?.label || logoToDelete.category}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to remove this logo? It will no longer appear when merchants add or edit accounts in this category. Existing accounts using this logo will retain their image.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLogoToDelete(null)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {deletingId !== null && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Delete Logo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
