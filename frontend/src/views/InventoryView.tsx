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
  ChevronRight,
  UserCheck,
  Undo2,
  Wrench,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { InventoryUnitDrawer } from '../components/drawers/InventoryUnitDrawer';

interface InventoryViewProps {
  user: User | null;
}

type TabType = 'in_stock' | 'out' | 'sold' | 'returned' | 'all';

export const InventoryView: React.FC<InventoryViewProps> = ({ user }) => {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TabType>('in_stock');
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);

  // Tab counts from server
  const [counts, setCounts] = useState({
    in_stock: 0,
    out: 0,
    sold: 0,
    returned: 0,
    all: 0,
  });

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

  // Handover Modal State (for in_stock -> out)
  const [handoverTargetUnit, setHandoverTargetUnit] = useState<InventoryUnit | null>(null);
  const [handoverTo, setHandoverTo] = useState('');
  const [handoverLocation, setHandoverLocation] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

  // Customer Return Modal State (for sold -> returned)
  const [returnTargetUnit, setReturnTargetUnit] = useState<InventoryUnit | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnCondition, setReturnCondition] = useState('inspection_needed');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Repaired Restock Modal State (for returned -> in_stock)
  const [repairedTargetUnit, setRepairedTargetUnit] = useState<InventoryUnit | null>(null);
  const [repairedCondition, setRepairedCondition] = useState('refurbished');
  const [repairedNotes, setRepairedNotes] = useState('');
  const [repairedSubmitting, setRepairedSubmitting] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [statusFilter]);

  // Handle Esc key to close all modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showIntakeModal) {
          setShowIntakeModal(false);
          setShowNewProductForm(false);
        }
        if (handoverTargetUnit) setHandoverTargetUnit(null);
        if (returnTargetUnit) setReturnTargetUnit(null);
        if (repairedTargetUnit) setRepairedTargetUnit(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIntakeModal, handoverTargetUnit, returnTargetUnit, repairedTargetUnit]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const [res, p] = await Promise.all([
        api.getInventoryWithCounts({
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search.trim() || undefined,
        }),
        api.getProducts(),
      ]);
      setUnits(res.units);
      setCounts(res.counts);
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
    : true;

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

  // Restock an unsold OUT device back to shelf
  const handleRestockOut = async (unit: InventoryUnit) => {
    try {
      await api.restockInventoryUnit(unit.id);
      toast.success('Item Restocked to Shelf', {
        description: `${unit.variant?.product?.name || 'Device'} is now back in stock.`,
      });
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to restock item', { description: err.message });
    }
  };

  // Submit Handover (Mark out)
  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverTargetUnit || !handoverTo.trim()) return;

    try {
      setHandoverSubmitting(true);
      await api.handoverInventoryUnit(handoverTargetUnit.id, {
        handover_to: handoverTo.trim(),
        location: handoverLocation.trim() || undefined,
        notes: handoverNotes.trim() || undefined,
      });

      toast.success('Item marked as out for sale', {
        description: `Handed out to ${handoverTo.trim()} for customer demo/sale.`,
      });

      setHandoverTargetUnit(null);
      setHandoverTo('');
      setHandoverLocation('');
      setHandoverNotes('');
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to handover unit', { description: err.message });
    } finally {
      setHandoverSubmitting(false);
    }
  };

  // Submit Customer Return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetUnit || !returnReason.trim()) return;

    try {
      setReturnSubmitting(true);
      await api.customerReturnInventoryUnit(returnTargetUnit.id, {
        return_reason: returnReason.trim(),
        condition: returnCondition || undefined,
        notes: returnNotes.trim() || undefined,
      });

      toast.success('Customer return recorded', {
        description: `Device logged into Repair & Inspection shelf.`,
      });

      setReturnTargetUnit(null);
      setReturnReason('');
      setReturnNotes('');
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to record customer return', { description: err.message });
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Submit Repaired Restock
  const handleSubmitRepairedRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairedTargetUnit) return;

    try {
      setRepairedSubmitting(true);
      await api.repairedRestockInventoryUnit(repairedTargetUnit.id, {
        condition: repairedCondition,
        notes: repairedNotes.trim() || undefined,
      });

      toast.success('Device repaired & restocked', {
        description: `Placed back into active shop counter stock.`,
      });

      setRepairedTargetUnit(null);
      setRepairedNotes('');
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to restock repaired unit', { description: err.message });
    } finally {
      setRepairedSubmitting(false);
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
    <div className="space-y-5 animate-page-enter">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Segmented Tabs */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold overflow-x-auto">
          {/* Tab 1: In Stock */}
          <button
            onClick={() => setStatusFilter('in_stock')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'in_stock'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>In Stock</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono">
              {counts.in_stock}
            </span>
          </button>

          {/* Tab 2: Out for Sale */}
          <button
            onClick={() => setStatusFilter('out')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'out'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Out for Sale</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-mono">
              {counts.out}
            </span>
          </button>

          {/* Tab 3: Sold */}
          <button
            onClick={() => setStatusFilter('sold')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'sold'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Sold</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
              {counts.sold}
            </span>
          </button>

          {/* Tab 4: Returned / Repair */}
          <button
            onClick={() => setStatusFilter('returned')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'returned'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Returned / Repair</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-mono">
              {counts.returned}
            </span>
          </button>

          {/* Tab 5: All */}
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>All ({counts.all})</span>
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
              placeholder="Search Model, Serial, Handover, Defect..."
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
                <th className="py-3 px-5 text-center">Status & Location</th>
                {canViewCost && <th className="py-3 px-5 text-right">Cost Basis</th>}
                <th className="py-3 px-5 text-right">Flow Action</th>
                <th className="py-3 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                      <span>Loading inventory units...</span>
                    </div>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400 dark:text-slate-500">
                    {statusFilter === 'out'
                      ? 'No items are currently out with staff or brokers.'
                      : statusFilter === 'sold'
                      ? 'No sold items found.'
                      : statusFilter === 'returned'
                      ? 'No devices under return/repair inspection.'
                      : 'No inventory units found in this category.'}
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
                    <tr
                      key={unit.id}
                      onClick={() => setSelectedUnit(unit)}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Model & Item Name */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {getItemCategoryIcon(pCat, pName)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {pName}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {[unit.variant?.storage, unit.variant?.color].filter(Boolean).join(' • ') || 'Standard'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Serial / IMEI */}
                      <td className="py-3.5 px-5 font-mono text-slate-800 dark:text-slate-200 font-medium">
                        {unit.imei_or_serial || <span className="text-slate-400 dark:text-slate-500 font-sans italic">Not recorded</span>}
                      </td>

                      {/* Specs / Battery */}
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

                      {/* Condition */}
                      <td className="py-3.5 px-5 capitalize text-slate-600 dark:text-slate-400 font-medium">
                        {unit.condition.replace(/_/g, ' ')}
                      </td>

                      {/* Status & Location / Handover info */}
                      <td className="py-3.5 px-5 text-center">
                        {unit.status === 'in_stock' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                              <CheckCircle2 className="w-3 h-3" />
                              In Stock
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">{unit.location || 'Shop Counter'}</div>
                          </div>
                        )}

                        {unit.status === 'out' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                              <Clock className="w-3 h-3" />
                              Out for Sale
                            </span>
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-0.5 truncate max-w-[140px] mx-auto">
                              With: {unit.handover_to || 'Staff'}
                            </div>
                          </div>
                        )}

                        {unit.status === 'sold' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
                              <CheckCircle2 className="w-3 h-3" />
                              Sold
                            </span>
                            {unit.sold_at && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(unit.sold_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )}

                        {unit.status === 'returned' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50">
                              <AlertCircle className="w-3 h-3" />
                              Returned
                            </span>
                            {unit.return_reason && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 truncate max-w-[140px] mx-auto" title={unit.return_reason}>
                                {unit.return_reason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Cost basis (owner only) */}
                      {canViewCost && (
                        <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                          {unit.cost_basis ? `${Number(unit.cost_basis).toLocaleString()} ETB` : '—'}
                        </td>
                      )}

                      {/* Contextual Action Button (Strictly enforces business rules) */}
                      <td className="py-3.5 px-5 text-right">
                        {/* 1. IN STOCK -> Handover Out */}
                        {unit.status === 'in_stock' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setHandoverTargetUnit(unit);
                              setHandoverTo('');
                              setHandoverLocation('');
                              setHandoverNotes('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shadow-2xs active:scale-95"
                            title="Handover this device to a staff member or broker to sell"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>Handover / Out</span>
                          </button>
                        )}

                        {/* 2. OUT -> Restock Unsold to Shelf */}
                        {unit.status === 'out' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestockOut(unit);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors shadow-2xs active:scale-95"
                            title="Restock this unsold unit back to shop shelf"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Restock to Shelf</span>
                          </button>
                        )}

                        {/* 3. SOLD -> Customer Return (NO RESTOCK BUTTON!) */}
                        {unit.status === 'sold' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReturnTargetUnit(unit);
                              setReturnReason('');
                              setReturnCondition('inspection_needed');
                              setReturnNotes('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors shadow-2xs active:scale-95"
                            title="Customer returned this sold device"
                          >
                            <Undo2 className="w-3 h-3" />
                            <span>Customer Return</span>
                          </button>
                        )}

                        {/* 4. RETURNED -> Repaired & Restock */}
                        {unit.status === 'returned' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRepairedTargetUnit(unit);
                              setRepairedCondition('refurbished');
                              setRepairedNotes('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/60 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition-colors shadow-2xs active:scale-95"
                            title="Device repaired and ready to place back in stock"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Repaired & Restock</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-2 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Handover Modal (Mark In-Stock Device as Out for Sale) */}
      {handoverTargetUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setHandoverTargetUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Handover Device for Sale
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Mark as out with staff or peer broker
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHandoverTargetUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {handoverTargetUnit.variant?.product?.name}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Serial/IMEI: {handoverTargetUnit.imei_or_serial || 'Standard stock'}
              </div>
            </div>

            <form onSubmit={handleSubmitHandover} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Handed Out To (Staff Name or Broker) *
                </label>
                <input
                  type="text"
                  required
                  value={handoverTo}
                  onChange={(e) => setHandoverTo(e.target.value)}
                  placeholder="e.g. Husa, Kalid, Yenus (Peer Shop)"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
                {/* Quick Name Pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Husa (Lead Sales)', 'Kalid', 'Neju', 'Yenus (Peer)', 'Mekdi (Peer)'].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setHandoverTo(name)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/60 transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination / Location (Optional)
                </label>
                <input
                  type="text"
                  value={handoverLocation}
                  onChange={(e) => setHandoverLocation(e.target.value)}
                  placeholder="e.g. Bole Medhanialem Mall demo, Given to neighbour shop"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Handover Note (Optional)
                </label>
                <textarea
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="e.g. Expected return by 5:00 PM if unsold"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setHandoverTargetUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={handoverSubmitting || !handoverTo.trim()}
                  className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {handoverSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>Confirm Handover Out</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Return Modal (For SOLD units returned by customer with reason) */}
      {returnTargetUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setReturnTargetUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Undo2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Record Customer Return
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Track device for repair, warranty, or inspection
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReturnTargetUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {returnTargetUnit.variant?.product?.name}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Serial/IMEI: {returnTargetUnit.imei_or_serial || 'Standard stock'}
              </div>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Return *
                </label>
                <input
                  type="text"
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Screen flickering, Battery drops rapidly, Defective mic"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
                {/* Quick Reason Pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Screen defect / touch issue', 'Battery draining fast', 'Camera / FaceID failure', 'Audio / Mic fault', 'Customer changed mind'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReturnReason(reason)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/60 transition-colors"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Device Condition upon Return
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="inspection_needed">Inspection Needed</option>
                  <option value="defective">Defective Hardware</option>
                  <option value="used_clean">Used Clean (Pristine)</option>
                  <option value="backcrack">Back Crack / Damage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Technician / Customer Notes (Optional)
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Customer brought receipt, requested replacement or repair"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReturnTargetUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting || !returnReason.trim()}
                  className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {returnSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                  <span>Confirm Customer Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repaired Restock Modal (For RETURNED units after repair) */}
      {repairedTargetUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setRepairedTargetUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Repaired & Restock Device
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Return repaired unit to active counter stock
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRepairedTargetUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {repairedTargetUnit.variant?.product?.name}
              </div>
              <div className="text-[11px] text-rose-600 font-medium mt-0.5">
                Defect reported: {repairedTargetUnit.return_reason || 'N/A'}
              </div>
            </div>

            <form onSubmit={handleSubmitRepairedRestock} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Updated Condition Grade
                </label>
                <select
                  value={repairedCondition}
                  onChange={(e) => setRepairedCondition(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="refurbished">Refurbished (Tested 100%)</option>
                  <option value="used_clean">Used Clean</option>
                  <option value="new">Like New</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Repair & Resolution Notes (Optional)
                </label>
                <textarea
                  value={repairedNotes}
                  onChange={(e) => setRepairedNotes(e.target.value)}
                  placeholder="e.g. Screen replaced by technician, full hardware diagnostics passed"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRepairedTargetUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={repairedSubmitting}
                  className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {repairedSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                  <span>Restock Repaired Device</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Inventory Unit Workspace Drawer */}
      <InventoryUnitDrawer
        unit={selectedUnit}
        isOpen={selectedUnit !== null}
        onClose={() => setSelectedUnit(null)}
        user={user}
        onRestockSuccess={loadInventory}
        onOpenHandover={(unit) => {
          setHandoverTargetUnit(unit);
          setHandoverTo('');
          setHandoverLocation('');
          setHandoverNotes('');
        }}
        onOpenCustomerReturn={(unit) => {
          setReturnTargetUnit(unit);
          setReturnReason('');
          setReturnCondition('inspection_needed');
          setReturnNotes('');
        }}
        onOpenRepairedRestock={(unit) => {
          setRepairedTargetUnit(unit);
          setRepairedCondition('refurbished');
          setRepairedNotes('');
        }}
      />
    </div>
  );
};
