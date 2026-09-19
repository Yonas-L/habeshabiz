import React, { useState, useEffect } from 'react';
import type { InventoryUnit, Product, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Battery,
  Loader2,
  X,
  RotateCcw,
  Gamepad2,
  Smartphone,
  Tv,
  Laptop,
} from 'lucide-react';

interface InventoryViewProps {
  user: User | null;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ user }) => {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'in_stock' | 'sold' | 'all'>('in_stock');

  // Intake Modal State
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeVariantId, setIntakeVariantId] = useState('');
  const [intakeImei, setIntakeImei] = useState('');
  const [intakeBattery, setIntakeBattery] = useState('100');
  const [intakeCycles, setIntakeCycles] = useState('0');
  const [intakeSim, setIntakeSim] = useState<'physical' | 'esim' | 'dual'>('physical');
  const [intakeCondition, setIntakeCondition] = useState('new');
  const [intakeCost, setIntakeCost] = useState('');
  const [intakeLocation, setIntakeLocation] = useState('Shop Counter');
  const [intakeNotes, setIntakeNotes] = useState('');
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  // Quick New Product inside Modal
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<'smartphone' | 'console' | 'laptop' | 'tv' | 'accessory' | 'other'>('console');
  const [newProdStorage, setNewProdStorage] = useState('');
  const [newProdColor, setNewProdColor] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [statusFilter]);

  // Handle Esc key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showIntakeModal) {
        setShowIntakeModal(false);
        setShowNewProductForm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIntakeModal]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const [u, p] = await Promise.all([
        api.getInventoryUnits({ status: statusFilter === 'all' ? undefined : statusFilter, search }),
        api.getProducts(),
      ]);
      setUnits(u);
      setProducts(p);
    } catch (err: any) {
      toast.error('Failed to load inventory', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInventory();
  };

  // Check if selected product is an iPhone/smartphone
  const selectedProduct = products.find((p) => p.variants.some((v) => v.id === intakeVariantId));
  const isPhone = selectedProduct
    ? selectedProduct.category === 'smartphone' ||
      selectedProduct.name.toLowerCase().includes('phone') ||
      selectedProduct.name.toLowerCase().includes('iphone') ||
      selectedProduct.name.toLowerCase().includes('galaxy') ||
      selectedProduct.name.toLowerCase().includes('pixel')
    : true; // Default to phone fields until user picks another

  const handleCreateNewProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    try {
      setCreatingProduct(true);
      const res = await api.createProduct({
        name: newProdName.trim(),
        category: newProdCategory,
        has_serials: true,
        variants: [
          {
            storage: newProdStorage.trim() || undefined,
            color: newProdColor.trim() || undefined,
          },
        ],
      });

      toast.success('Product model created', { description: `${res.name} added to catalog.` });
      const updatedProducts = await api.getProducts();
      setProducts(updatedProducts);

      if (res.variants?.[0]?.id) {
        setIntakeVariantId(res.variants[0].id);
      }
      setShowNewProductForm(false);
      setNewProdName('');
      setNewProdStorage('');
      setNewProdColor('');
    } catch (err: any) {
      toast.error('Failed to create product', { description: err.message });
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeVariantId || !intakeCost) return;

    try {
      setIntakeSubmitting(true);
      await api.intakeInventoryUnit({
        variant_id: intakeVariantId,
        imei_or_serial: intakeImei || null,
        battery_health: isPhone && intakeBattery ? parseInt(intakeBattery) : null,
        cycle_count: isPhone && intakeCycles ? parseInt(intakeCycles) : null,
        sim_type: isPhone ? intakeSim : 'na',
        condition: intakeCondition,
        cost_basis: parseFloat(intakeCost),
        location: intakeLocation || 'Shop Counter',
        notes: intakeNotes || null,
      });

      toast.success('Item added to available stock', {
        description: `${selectedProduct?.name || 'Unit'} • Cost: ${parseFloat(intakeCost).toLocaleString()} ETB`,
      });

      setShowIntakeModal(false);
      setIntakeImei('');
      setIntakeCost('');
      setIntakeNotes('');
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to intake unit', { description: err.message });
    } finally {
      setIntakeSubmitting(false);
    }
  };

  // Restock an unsold, reserved, or returned device back to available stock
  const handleRestock = async (unit: InventoryUnit) => {
    try {
      await api.restockInventoryUnit(unit.id);
      toast.success('Item Restocked to Shelf', {
        description: `${unit.variant?.product?.name || 'Device'} is now active in stock.`,
      });
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to restock item', { description: err.message });
    }
  };

  const canViewCost = user?.can_view_costs ?? false;

  const getItemCategoryIcon = (category?: string, name?: string) => {
    const n = (name || '').toLowerCase();
    const c = (category || '').toLowerCase();
    if (c === 'console' || n.includes('playstation') || n.includes('ps5') || n.includes('ps4') || n.includes('xbox')) {
      return <Gamepad2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
    }
    if (c === 'laptop' || n.includes('macbook') || n.includes('laptop')) {
      return <Laptop className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
    if (c === 'tv' || n.includes('tv') || n.includes('screen')) {
      return <Tv className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
    }
    return <Smartphone className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
  };

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Segmented Control */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('in_stock')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'in_stock'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            In Stock ({units.filter((u) => u.status === 'in_stock').length})
          </button>
          <button
            onClick={() => setStatusFilter('sold')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'sold'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sold / Out
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Inventory
          </button>
        </div>

        {/* Search & Stock Intake Button */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Model, Serial, IMEI..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-xs"
            />
          </form>

          <button
            onClick={() => {
              setShowIntakeModal(true);
              setShowNewProductForm(false);
            }}
            className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm flex items-center gap-2 shrink-0 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            <span>Stock Intake</span>
          </button>
        </div>
      </div>

      {/* Inventory Data Table */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Item & Model</th>
                <th className="py-3 px-5 font-mono">IMEI / Serial</th>
                <th className="py-3 px-5">Specs / Battery</th>
                <th className="py-3 px-5">Condition</th>
                {canViewCost && <th className="py-3 px-5 text-right">Cost Basis</th>}
                <th className="py-3 px-5 text-center">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                      <span>Loading inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    No inventory units found. Click "+ Stock Intake" to add phones, PlayStations, or electronics.
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const pName = unit.variant?.product?.name || 'Device';
                  const pCat = unit.variant?.product?.category;
                  const isUnitPhone =
                    pCat === 'smartphone' ||
                    pName.toLowerCase().includes('iphone') ||
                    pName.toLowerCase().includes('galaxy') ||
                    pName.toLowerCase().includes('phone');

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            {getItemCategoryIcon(pCat, pName)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                              {pName}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {[unit.variant?.storage, unit.variant?.color].filter(Boolean).join(' • ') || 'Standard'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 font-mono text-slate-800 dark:text-slate-200 font-medium">
                        {unit.imei_or_serial || <span className="text-slate-400 dark:text-slate-500 font-sans italic">Not recorded</span>}
                      </td>

                      <td className="py-3.5 px-5">
                        {isUnitPhone ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Battery className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                                {unit.battery_health ? `${unit.battery_health}%` : 'N/A'}
                              </span>
                            </div>
                            {unit.sim_type && unit.sim_type !== 'na' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono">
                                {unit.sim_type}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {unit.variant?.storage || 'Console / Electronics'}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 capitalize text-slate-600 dark:text-slate-400 font-medium">
                        {unit.condition.replace(/_/g, ' ')}
                      </td>

                      {canViewCost && (
                        <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {Number(unit.cost_basis).toLocaleString()} ETB
                        </td>
                      )}

                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            unit.status === 'in_stock'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {unit.status === 'in_stock' ? 'In Stock' : unit.status === 'sold' ? 'Sold' : 'Out'}
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        {unit.status !== 'in_stock' && (
                          <button
                            onClick={() => handleRestock(unit)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shadow-2xs active:scale-95"
                            title="Restock this unsold or returned unit back to shelf"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restock to Shelf</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Intake Modal for Phones & All Electronics */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowIntakeModal(false)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Stock Intake (New Device or Item)
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Record phones, PlayStations, TVs, and electronics into inventory
                </p>
              </div>
              <button
                onClick={() => setShowIntakeModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Add Product / Model Accordion */}
            {showNewProductForm ? (
              <form onSubmit={handleCreateNewProduct} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Create New Catalog Product / Model
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewProductForm(false)}
                    className="text-xs text-slate-400 hover:underline"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Product Name (e.g. PlayStation 5 Slim, iPhone 16 Pro)
                    </label>
                    <input
                      type="text"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      placeholder="e.g. PlayStation 5 Pro 2TB"
                      required
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Category
                    </label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value as any)}
                      className="w-full h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                    >
                      <option value="console">Gaming Console (PS5, Xbox)</option>
                      <option value="smartphone">Smartphone / Phone</option>
                      <option value="laptop">Laptop / MacBook</option>
                      <option value="tv">Television / Screen</option>
                      <option value="accessory">Accessory / Audio</option>
                      <option value="other">Other Electronic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Storage / Spec (Optional)
                    </label>
                    <input
                      type="text"
                      value={newProdStorage}
                      onChange={(e) => setNewProdStorage(e.target.value)}
                      placeholder="e.g. 1TB, 825GB, 256GB"
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={creatingProduct}
                    className="h-8 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                  >
                    {creatingProduct ? 'Creating...' : 'Save Product'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Product & Variant
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewProductForm(true)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Product / Model</span>
                </button>
              </div>
            )}

            <form onSubmit={handleIntakeSubmit} className="space-y-4">
              {!showNewProductForm && (
                <div>
                  <select
                    value={intakeVariantId}
                    onChange={(e) => setIntakeVariantId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  >
                    <option value="">-- Choose Product Variant --</option>
                    {products.flatMap((p) =>
                      p.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {p.name} - {[v.storage, v.color].filter(Boolean).join(' ') || 'Standard'}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              {/* Serial & Cost Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isPhone ? 'IMEI or Serial #' : 'Serial # or Model #'}
                  </label>
                  <input
                    type="text"
                    value={intakeImei}
                    onChange={(e) => setIntakeImei(e.target.value)}
                    placeholder={isPhone ? 'e.g. 354868698...' : 'e.g. S01-F329482...'}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Purchase Cost (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={intakeCost}
                    onChange={(e) => setIntakeCost(e.target.value)}
                    placeholder="e.g. 85000"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    required
                  />
                </div>
              </div>

              {/* Phone-Specific Fields (Battery & SIM) — Automatically hidden for PlayStation, Consoles, TVs, etc. */}
              {isPhone && (
                <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Battery %
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={intakeBattery}
                      onChange={(e) => setIntakeBattery(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Cycle Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={intakeCycles}
                      onChange={(e) => setIntakeCycles(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      SIM Type
                    </label>
                    <select
                      value={intakeSim}
                      onChange={(e) => setIntakeSim(e.target.value as any)}
                      className="w-full h-9 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      <option value="physical">Physical SIM</option>
                      <option value="esim">eSIM</option>
                      <option value="dual">Dual SIM</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Physical Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Physical Condition
                  </label>
                  <select
                    value={intakeCondition}
                    onChange={(e) => setIntakeCondition(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                  >
                    <option value="new">Brand New (Sealed)</option>
                    <option value="used_clean">Used Clean (Pristine)</option>
                    <option value="used_minor_scratches">Used Minor Scratches</option>
                    <option value="backcrack">Back Crack</option>
                    <option value="refurbished">Refurbished</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Storage Location
                  </label>
                  <input
                    type="text"
                    value={intakeLocation}
                    onChange={(e) => setIntakeLocation(e.target.value)}
                    placeholder="Shop Counter, Back Safe..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={intakeSubmitting || !intakeVariantId || !intakeCost}
                  className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm active:scale-[0.98]"
                >
                  {intakeSubmitting ? 'Recording...' : 'Add Item to Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
