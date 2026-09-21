import React, { useState, useEffect, useMemo } from 'react';
import type { InventoryUnit, Product, ProductCategory, Contact, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Battery,
  Loader2,
  X,
  RotateCcw,
  ChevronRight,
  UserCheck,
  Undo2,
  Wrench,
  FolderCog,
  Smartphone,
  Gamepad2,
  Laptop,
  Tv,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  Edit3,
  Layers,
  Package,
  ChevronsDown,
  ChevronsUp,
  Handshake,
} from 'lucide-react';
import { InventoryUnitDrawer } from '../components/drawers/InventoryUnitDrawer';
import { StockIntakeModal } from '../components/inventory/StockIntakeModal';
import { CategoryManagementModal, getCategoryIcon } from '../components/inventory/CategoryManagementModal';
import { EditProductModal } from '../components/inventory/EditProductModal';

interface InventoryViewProps {
  user: User | null;
}

type TabType = 'in_stock' | 'vendor_stock' | 'out' | 'sold' | 'returned' | 'all';

export const InventoryView: React.FC<InventoryViewProps> = ({ user }) => {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TabType>('in_stock');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);

  // Tab counts from server
  const [counts, setCounts] = useState({
    in_stock: 0,
    vendor_stock: 0,
    returned_to_vendor: 0,
    out: 0,
    sold: 0,
    returned: 0,
    all: 0,
  });

  // Modal States
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeInitialProductId, setIntakeInitialProductId] = useState<string | undefined>(undefined);
  const [intakeInitialVariantId, setIntakeInitialVariantId] = useState<string | undefined>(undefined);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Collapsible state for in_stock grouped products
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Handover Modal State (for in_stock -> out)
  const [handoverTargetUnit, setHandoverTargetUnit] = useState<InventoryUnit | null>(null);
  const [handoverTo, setHandoverTo] = useState('');
  const [handoverLocation, setHandoverLocation] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverReturnDeadline, setHandoverReturnDeadline] = useState('');
  const [handoverPayout, setHandoverPayout] = useState('');
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

  // Return to Vendor Modal State (for vendor consignment units -> returned_to_vendor)
  const [returnToVendorUnit, setReturnToVendorUnit] = useState<InventoryUnit | null>(null);
  const [returnToVendorReason, setReturnToVendorReason] = useState('');
  const [returnToVendorSubmitting, setReturnToVendorSubmitting] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [statusFilter, selectedCategoryId]);

  // Handle Esc key to close all modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showIntakeModal) setShowIntakeModal(false);
        if (isCategoryModalOpen) setIsCategoryModalOpen(false);
        if (editingProduct) setEditingProduct(null);
        if (handoverTargetUnit) setHandoverTargetUnit(null);
        if (returnTargetUnit) setReturnTargetUnit(null);
        if (repairedTargetUnit) setRepairedTargetUnit(null);
        if (returnToVendorUnit) setReturnToVendorUnit(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIntakeModal, isCategoryModalOpen, editingProduct, handoverTargetUnit, returnTargetUnit, repairedTargetUnit, returnToVendorUnit]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const [res, p, cats, conts] = await Promise.all([
        api.getInventoryWithCounts({
          status: statusFilter === 'all' ? undefined : statusFilter,
          category_id: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
          search: search.trim() || undefined,
        }),
        api.getProducts(),
        api.getCategories(),
        api.getContacts(),
      ]);
      setUnits(res.units);
      setCounts(res.counts);
      setProducts(p);
      setCategories(cats);
      setContacts(conts);
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

  const isOwner = user?.role === 'owner';

  // Toggle expand / collapse for product model row in In Stock tab
  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProductIds(new Set(inStockProducts.map((p) => p.product.id)));
  };

  const collapseAll = () => {
    setExpandedProductIds(new Set());
  };

  // Group in-stock units by product model for clean collapsible hierarchy
  const inStockProducts = useMemo(() => {
    if (statusFilter !== 'in_stock') return [];

    const unitsByProductId: Record<string, InventoryUnit[]> = {};
    for (const unit of units) {
      const pid = unit.variant?.product_id || unit.variant?.product?.id;
      if (pid) {
        if (!unitsByProductId[pid]) unitsByProductId[pid] = [];
        unitsByProductId[pid].push(unit);
      }
    }

    const items = products.map((prod) => {
      const prodUnits = unitsByProductId[prod.id] || [];

      const variantBreakdowns = (prod.variants || []).map((variant) => {
        const vUnits = prodUnits.filter((u) => u.variant_id === variant.id);
        const qtyOnHand = variant.stock?.quantity_on_hand ?? 0;
        const count = prod.has_serials ? vUnits.length : (vUnits.length > 0 ? vUnits.length : qtyOnHand);
        const costBasis = vUnits.length > 0
          ? vUnits.reduce((sum, u) => sum + (Number(u.cost_basis) || 0), 0)
          : qtyOnHand * (Number(variant.stock?.average_cost) || 0);

        return {
          variant,
          units: vUnits,
          count,
          costBasis,
        };
      });

      const totalInStock = variantBreakdowns.reduce((sum, vb) => sum + vb.count, 0);
      const totalCost = variantBreakdowns.reduce((sum, vb) => sum + vb.costBasis, 0);

      const prices = (prod.variants || [])
        .map((v) => Number(v.default_selling_price))
        .filter((pr) => !isNaN(pr) && pr > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

      return {
        product: prod,
        units: prodUnits,
        variantBreakdowns,
        totalInStock,
        totalCost,
        minPrice,
        maxPrice,
      };
    });

    return items.filter((item) => {
      // Category filter check
      if (selectedCategoryId !== 'all') {
        const matchCat =
          item.product.category_id === selectedCategoryId ||
          item.product.category_rel?.id === selectedCategoryId ||
          categories.find((c) => c.id === selectedCategoryId)?.slug === item.product.category;
        if (!matchCat) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const nameMatch = item.product.name.toLowerCase().includes(q);
        const brandMatch = (item.product.brand || '').toLowerCase().includes(q);
        const unitMatch = item.units.some((u) => (u.imei_or_serial || '').toLowerCase().includes(q));
        const variantMatch = item.product.variants.some(
          (v) =>
            (v.storage || '').toLowerCase().includes(q) ||
            (v.color || '').toLowerCase().includes(q) ||
            (v.sku || '').toLowerCase().includes(q)
        );
        return nameMatch || brandMatch || unitMatch || variantMatch;
      }

      // Default: show products that have in-stock units on shelf
      return item.totalInStock > 0;
    });
  }, [statusFilter, units, products, selectedCategoryId, categories, search]);

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
        return_deadline: handoverReturnDeadline || undefined,
        handover_payout: handoverPayout ? parseFloat(handoverPayout) : undefined,
      });

      toast.success('Item marked as out for sale', {
        description: `Handed out to ${handoverTo.trim()} for sale.${handoverPayout ? ` Receivable: ${Number(handoverPayout).toLocaleString()} ETB` : ''}`,
      });

      setHandoverTargetUnit(null);
      setHandoverTo('');
      setHandoverLocation('');
      setHandoverNotes('');
      setHandoverReturnDeadline('');
      setHandoverPayout('');
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

  // Submit Return to Vendor
  const handleSubmitReturnToVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnToVendorUnit) return;

    try {
      setReturnToVendorSubmitting(true);
      await api.returnUnitToVendor(returnToVendorUnit.id, {
        return_reason: returnToVendorReason.trim() || 'Unsold within agreed window',
      });

      toast.success('Unit Returned to Vendor', {
        description: `${returnToVendorUnit.variant?.product?.name || 'Device'} returned to vendor/broker. Removed from active shelf stock.`,
      });

      setReturnToVendorUnit(null);
      setReturnToVendorReason('');
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to return unit to vendor', { description: err.message });
    } finally {
      setReturnToVendorSubmitting(false);
    }
  };

  const canViewCost = user?.can_view_costs ?? false;

  const getItemCategoryIcon = (category?: string, name?: string) => {
    const n = (name || '').toLowerCase();
    const c = (category || '').toLowerCase();
    if (c === 'console' || n.includes('playstation') || n.includes('ps5') || n.includes('ps4') || n.includes('xbox')) {
      return <Gamepad2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
    if (c === 'laptop' || n.includes('macbook') || n.includes('laptop')) {
      return <Laptop className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
    if (c === 'tv' || n.includes('tv') || n.includes('screen')) {
      return <Tv className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
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

          {/* Tab: Vendor Stock */}
          <button
            onClick={() => setStatusFilter('vendor_stock')}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'vendor_stock'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Handshake className="w-3.5 h-3.5 text-amber-500" />
            <span>Vendor Stock</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-mono font-bold">
              {counts.vendor_stock ?? 0}
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

        {/* Right: Category Dropdown + Search + Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Minimalist Category Select Dropdown */}
          <div className="relative min-w-[130px] sm:w-44">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs appearance-none cursor-pointer"
            >
              <option value="all">All Categories ({counts.all})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.in_stock_units_count ? `(${c.in_stock_units_count})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Model, Serial..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs"
            />
          </form>

          {/* Owner Actions */}
          {isOwner && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
                title="Manage product categories"
              >
                <FolderCog className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="hidden lg:inline">Categories</span>
              </button>

              <button
                onClick={() => {
                  setIntakeInitialProductId(undefined);
                  setIntakeInitialVariantId(undefined);
                  setShowIntakeModal(true);
                }}
                className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-2 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-500" />
                <span>Stock Intake</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inventory Data Table Container */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        {/* Sub-header Controls for In Stock Grouped View */}
        {statusFilter === 'in_stock' && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Grouped Catalog Models ({inStockProducts.length})
              </span>
              <span className="text-[11px] text-slate-400">
                • {counts.in_stock} total active units on shelf
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 shadow-2xs"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                <span>Expand All</span>
              </button>
              <button
                onClick={collapseAll}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 shadow-2xs"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          {statusFilter === 'in_stock' ? (
            /* COLLAPSIBLE GROUPED IN-STOCK TABLE */
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Product Model</th>
                  <th className="py-3 px-5 text-center">Total In Stock</th>
                  <th className="py-3 px-5">Specifications / Variants</th>
                  <th className="py-3 px-5 text-right">Benchmark Price</th>
                  {canViewCost && <th className="py-3 px-5 text-right">Total Cost Basis</th>}
                  {isOwner && <th className="py-3 px-5 text-right">Actions</th>}
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={canViewCost ? (isOwner ? 7 : 6) : (isOwner ? 6 : 5)} className="py-16 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                        <span>Loading inventory models...</span>
                      </div>
                    </td>
                  </tr>
                ) : inStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? (isOwner ? 7 : 6) : (isOwner ? 6 : 5)} className="py-16 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400">No products currently in stock</p>
                      {isOwner && (
                        <p className="text-xs text-slate-400 mt-0.5">Use the "+ Stock Intake" button to receive new items into counter inventory.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  inStockProducts.map((item) => {
                    const isExpanded = expandedProductIds.has(item.product.id);
                    const pCat = item.product.category;
                    const pCatRel = item.product.category_rel;
                    const specSummary = item.variantBreakdowns
                      .map((vb) => [vb.variant.storage, vb.variant.ram ? `${vb.variant.ram} RAM` : null, vb.variant.color].filter(Boolean).join(' '))
                      .filter(Boolean)
                      .join(' • ');

                    return (
                      <React.Fragment key={item.product.id}>
                        {/* Collapsed / Base Product Row */}
                        <tr
                          onClick={() => toggleExpand(item.product.id)}
                          className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                            isExpanded ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''
                          }`}
                        >
                          {/* Col 1: Product Model & Badges */}
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:bg-slate-200/50 dark:group-hover:bg-slate-800 transition-all shrink-0">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </div>

                              <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-slate-700 dark:text-slate-300">
                                {pCatRel?.icon
                                  ? getCategoryIcon(pCatRel.icon, 'w-4 h-4')
                                  : getItemCategoryIcon(pCat, item.product.name)}
                              </div>

                              <div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                                  <span>{item.product.name}</span>
                                  {item.product.brand && (
                                    <span className="text-[10px] font-semibold text-slate-400 font-sans">
                                      ({item.product.brand})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {pCatRel?.name || item.product.category}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {item.product.has_serials ? 'Serialized' : 'Bulk Batch'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Summed Stock Badge */}
                          <td className="py-3.5 px-5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-mono">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{item.totalInStock} In Stock</span>
                            </span>
                          </td>

                          {/* Col 3: Variants / Specs Summary */}
                          <td className="py-3.5 px-5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              {item.variantBreakdowns.length}{' '}
                              {item.variantBreakdowns.length === 1 ? 'Specification' : 'Specifications'}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                              {specSummary || 'Standard'}
                            </div>
                          </td>

                          {/* Col 4: Benchmark Selling Price */}
                          <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {item.minPrice !== null && item.maxPrice !== null ? (
                              item.minPrice === item.maxPrice ? (
                                `${item.minPrice.toLocaleString()} ETB`
                              ) : (
                                `${item.minPrice.toLocaleString()} – ${item.maxPrice.toLocaleString()} ETB`
                              )
                            ) : (
                              <span className="text-slate-400 font-sans italic text-[11px]">No default</span>
                            )}
                          </td>

                          {/* Col 5: Total Cost Basis (Owner Only) */}
                          {canViewCost && (
                            <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {item.totalCost > 0 ? `${item.totalCost.toLocaleString()} ETB` : '—'}
                            </td>
                          )}

                          {/* Col 6: Quick Action Buttons (Owner Only) */}
                          {isOwner && (
                            <td className="py-3.5 px-5 text-right">
                              <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    setIntakeInitialProductId(item.product.id);
                                    setIntakeInitialVariantId(undefined);
                                    setShowIntakeModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shadow-2xs active:scale-95"
                                  title={`Intake stock for ${item.product.name}`}
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Intake</span>
                                </button>

                                <button
                                  onClick={() => setEditingProduct(item.product)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
                                  title="Edit product details, manage variants, or remove"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              </div>
                            </td>
                          )}

                          {/* Col 7: Chevron */}
                          <td className="py-3.5 px-3 text-right">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                            )}
                          </td>
                        </tr>

                        {/* Uncollapsed Sub-row: Variants Breakdown & Physical Units Table */}
                        {isExpanded && (
                          <tr className="bg-slate-50/40 dark:bg-slate-900/20">
                            <td colSpan={canViewCost ? 7 : 6} className="p-0">
                              <div className="p-5 border-y border-slate-100 dark:border-slate-800 space-y-4">
                                {/* Strip 1: Variants Stock Grid */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Available Variant Specifications ({item.variantBreakdowns.length})</span>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                      Specific stock counts per configuration
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                    {item.variantBreakdowns.map((vb) => {
                                      const specLabel = [
                                        vb.variant.storage,
                                        vb.variant.ram ? `${vb.variant.ram} RAM` : null,
                                        vb.variant.color,
                                      ].filter(Boolean).join(' • ') || 'Standard Specification';

                                      return (
                                        <div
                                          key={vb.variant.id}
                                          className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 shadow-2xs"
                                        >
                                          <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                                              {specLabel}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                              {vb.variant.default_selling_price ? (
                                                <span>Selling: {Number(vb.variant.default_selling_price).toLocaleString()} ETB</span>
                                              ) : (
                                                <span>No benchmark price</span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono ${
                                                vb.count > 0
                                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50'
                                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                              }`}
                                            >
                                              {vb.count} in stock
                                            </span>

                                            {isOwner && (
                                              <button
                                                onClick={() => {
                                                  setIntakeInitialProductId(item.product.id);
                                                  setIntakeInitialVariantId(vb.variant.id);
                                                  setShowIntakeModal(true);
                                                }}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                                title={`Intake more ${specLabel}`}
                                              >
                                                <Plus className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Strip 2: Individual Physical Units Table */}
                                {item.units.length > 0 ? (
                                  <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#131926]">
                                    <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        Tracked Serial Stock Units ({item.units.length})
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        Click any row to open device history drawer
                                      </span>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50/40 dark:bg-slate-900/30 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-slate-100 dark:border-slate-800">
                                          <tr>
                                            <th className="py-2.5 px-4 font-mono">IMEI / Serial</th>
                                            <th className="py-2.5 px-4">Spec</th>
                                            <th className="py-2.5 px-4">Battery / SIM</th>
                                            <th className="py-2.5 px-4">Condition</th>
                                            <th className="py-2.5 px-4">Location</th>
                                            {canViewCost && <th className="py-2.5 px-4 text-right">Cost</th>}
                                            {isOwner && <th className="py-2.5 px-4 text-right">Flow Action</th>}
                                            <th className="py-2.5 px-2"></th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                          {item.units.map((unit) => {
                                            const unitSpec = [
                                              unit.variant?.storage,
                                              unit.variant?.ram ? `${unit.variant.ram} RAM` : null,
                                              unit.variant?.color,
                                            ].filter(Boolean).join(' • ') || 'Standard';

                                            return (
                                              <tr
                                                key={unit.id}
                                                onClick={() => setSelectedUnit(unit)}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                                              >
                                                <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span>
                                                      {unit.imei_or_serial || (
                                                        <span className="text-slate-400 font-sans italic text-[11px]">
                                                          Bulk Unit
                                                        </span>
                                                      )}
                                                    </span>
                                                    {unit.source_type === 'consignment' && (
                                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                                                        <Handshake className="w-2.5 h-2.5" />
                                                        Vendor
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                                                  {unitSpec}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                  {unit.battery_health ? (
                                                    <div className="flex items-center gap-1.5">
                                                      <Battery className="w-3.5 h-3.5 text-slate-400" />
                                                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                                                        {unit.battery_health}%
                                                      </span>
                                                      {unit.sim_type && unit.sim_type !== 'na' && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase font-mono">
                                                          {unit.sim_type}
                                                        </span>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <span className="text-slate-400 text-[11px]">N/A</span>
                                                  )}
                                                </td>
                                                <td className="py-2.5 px-4 capitalize text-slate-600 dark:text-slate-400 font-medium">
                                                  {unit.condition.replace(/_/g, ' ')}
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                                                  {unit.location || 'Shop Counter'}
                                                </td>
                                                {canViewCost && (
                                                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                                    {unit.cost_basis ? `${Number(unit.cost_basis).toLocaleString()} ETB` : '—'}
                                                  </td>
                                                )}
                                                {isOwner && (
                                                  <td className="py-2.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                      {unit.source_type === 'consignment' && (
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReturnToVendorUnit(unit);
                                                            setReturnToVendorReason('');
                                                          }}
                                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors shadow-2xs active:scale-95"
                                                          title="Return unsold consignment unit back to broker"
                                                        >
                                                          <Handshake className="w-3 h-3" />
                                                          <span>Return</span>
                                                        </button>
                                                      )}
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setHandoverTargetUnit(unit);
                                                          setHandoverTo('');
                                                          setHandoverLocation('');
                                                          setHandoverNotes('');
                                                          setHandoverReturnDeadline('');
                                                          setHandoverPayout('');
                                                        }}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shadow-2xs active:scale-95"
                                                        title="Handover device to staff or broker to sell"
                                                      >
                                                        <UserCheck className="w-3 h-3" />
                                                        <span>Handover / Out</span>
                                                      </button>
                                                    </div>
                                                  </td>
                                                )}
                                                <td className="py-2.5 px-2 text-right">
                                                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                                    No physical units in stock for this model currently.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* FLAT TABLE FOR OTHER TABS (OUT, SOLD, RETURNED, ALL) */
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Item & Model</th>
                  <th className="py-3 px-5 font-mono">IMEI / Serial</th>
                  <th className="py-3 px-5">Specs / Battery</th>
                  <th className="py-3 px-5">Condition</th>
                  <th className="py-3 px-5 text-center">Status & Location</th>
                  {canViewCost && <th className="py-3 px-5 text-right">Cost Basis</th>}
                  {isOwner && <th className="py-3 px-5 text-right">Flow Action</th>}
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={canViewCost ? (isOwner ? 8 : 7) : (isOwner ? 7 : 6)} className="py-16 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
                        <span>Loading inventory units...</span>
                      </div>
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? (isOwner ? 8 : 7) : (isOwner ? 7 : 6)} className="py-16 text-center text-slate-400">
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
                    const pCatRel = unit.variant?.product?.category_rel;
                    const isUnitPhone =
                      pCat === 'smartphone' ||
                      pCatRel?.slug === 'smartphones' ||
                      pName.toLowerCase().includes('iphone') ||
                      pName.toLowerCase().includes('galaxy') ||
                      pName.toLowerCase().includes('phone');

                    const specVals = unit.variant?.specs ? Object.values(unit.variant.specs).map(String) : [];
                    const variantSubtitle = [
                      unit.variant?.storage,
                      unit.variant?.ram ? `${unit.variant.ram} RAM` : null,
                      unit.variant?.color,
                      ...specVals,
                    ].filter(Boolean).join(' • ') || 'Standard';

                    return (
                      <tr
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        {/* Model & Item Name */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-slate-700 dark:text-slate-300">
                              {pCatRel?.icon
                                ? getCategoryIcon(pCatRel.icon, 'w-4 h-4')
                                : getItemCategoryIcon(pCat, pName)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {pName}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {pCatRel?.name && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    {pCatRel.name}
                                  </span>
                                )}
                                {unit.source_type === 'consignment' && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/40 dark:border-amber-800/40">
                                    <Handshake className="w-2.5 h-2.5" />
                                    Vendor Stock
                                  </span>
                                )}
                                <span>{variantSubtitle}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Serial / IMEI */}
                        <td className="py-3.5 px-5 font-mono text-slate-800 dark:text-slate-200 font-medium">
                          {unit.imei_or_serial || <span className="text-slate-400 font-sans italic">Not recorded</span>}
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
                            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                              {specVals.length > 0 ? specVals.join(' • ') : unit.variant?.storage || 'Standard Specs'}
                            </span>
                          )}
                        </td>

                        {/* Condition */}
                        <td className="py-3.5 px-5 capitalize text-slate-600 dark:text-slate-400 font-medium">
                          {unit.condition.replace(/_/g, ' ')}
                        </td>

                        {/* Status & Location / Handover info */}
                        <td className="py-3.5 px-5 text-center">
                          {unit.status === 'in_stock' && unit.source_type === 'consignment' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50">
                                <Handshake className="w-3 h-3" />
                                Vendor Stock
                              </span>
                              {unit.return_deadline ? (
                                <div className="text-[10px] mt-0.5">
                                  {new Date(unit.return_deadline) < new Date() ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-bold">Return Overdue</span>
                                  ) : (
                                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                                      Return by {new Date(unit.return_deadline).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 mt-0.5">{unit.location || 'Shop Counter'}</div>
                              )}
                            </div>
                          )}

                          {unit.status === 'in_stock' && unit.source_type !== 'consignment' && (
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
                              {unit.handover_payout && (
                                <div className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  {Number(unit.handover_payout).toLocaleString()} ETB
                                </div>
                              )}
                              {unit.return_deadline && (
                                <div className="text-[10px] mt-0.5">
                                  {new Date(unit.return_deadline) < new Date() ? (
                                    <span className="text-rose-600 dark:text-rose-400 font-bold">Return Overdue</span>
                                  ) : (
                                    <span className="text-slate-400">
                                      Due {new Date(unit.return_deadline).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              )}
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

                          {unit.status === 'returned_to_vendor' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                <RotateCcw className="w-3 h-3" />
                                Returned to Broker
                              </span>
                              {unit.returned_at && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(unit.returned_at).toLocaleDateString()}
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

                        {/* Contextual Action Button */}
                        {isOwner && (
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {unit.source_type === 'consignment' && unit.status === 'in_stock' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReturnToVendorUnit(unit);
                                  setReturnToVendorReason('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors shadow-2xs active:scale-95"
                                title="Return unsold consignment item back to broker"
                              >
                                <Handshake className="w-3 h-3" />
                                <span>Return to Vendor</span>
                              </button>
                            )}

                            {unit.status === 'in_stock' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHandoverTargetUnit(unit);
                                  setHandoverTo('');
                                  setHandoverLocation('');
                                  setHandoverNotes('');
                                  setHandoverReturnDeadline('');
                                  setHandoverPayout('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shadow-2xs active:scale-95"
                                title="Handover this device to a staff member or broker to sell"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Handover / Out</span>
                              </button>
                            )}

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
                          </div>
                        </td>
                        )}
                        <td className="py-3.5 px-3 text-right">
                          <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
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

              {/* Agreed Return Window & Payout */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agreed Return Window
                  </label>
                  <input
                    type="date"
                    value={handoverReturnDeadline}
                    onChange={(e) => setHandoverReturnDeadline(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Return if unsold by this date</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Agreed Vendor Payout (ETB)
                  </label>
                  <input
                    type="number"
                    value={handoverPayout}
                    onChange={(e) => setHandoverPayout(e.target.value)}
                    placeholder="e.g. 25000"
                    min="0"
                    step="0.01"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Amount vendor owes on sale</p>
                </div>
              </div>

              {handoverPayout && parseFloat(handoverPayout) > 0 && (
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  💰 A receivable of <span className="font-bold">{Number(handoverPayout).toLocaleString()} ETB</span> will be recorded. The vendor must pay this or return the device{handoverReturnDeadline ? ` by ${new Date(handoverReturnDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
                </div>
              )}

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

      {/* Return to Vendor Modal (Consignment unit returned to broker/partner) */}
      {returnToVendorUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setReturnToVendorUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Handshake className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Return to Vendor / Broker
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Remove unsold consignment item from store stock
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReturnToVendorUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {returnToVendorUnit.variant?.product?.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Serial/IMEI: {returnToVendorUnit.imei_or_serial || 'Standard stock'}
              </div>
              {returnToVendorUnit.return_deadline && (
                <div className="text-[11px] font-medium pt-1 border-t border-amber-200/50 dark:border-amber-800/30">
                  {new Date(returnToVendorUnit.return_deadline) < new Date() ? (
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      ⚠ Agreed deadline passed ({new Date(returnToVendorUnit.return_deadline).toLocaleDateString()})
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-300">
                      Agreed return by: {new Date(returnToVendorUnit.return_deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitReturnToVendor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Return
                </label>
                <input
                  type="text"
                  value={returnToVendorReason}
                  onChange={(e) => setReturnToVendorReason(e.target.value)}
                  placeholder="e.g. Unsold within agreed window, Customer demand low"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Unsold within agreed window', 'Consignment expired', 'Broker requested return', 'Customer demand low'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReturnToVendorReason(reason)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/60 transition-colors"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReturnToVendorUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={returnToVendorSubmitting}
                  className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
                >
                  {returnToVendorSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Handshake className="w-3.5 h-3.5" />}
                  <span>Confirm Return to Broker</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scalable Stock Intake Modal, Category Management & Edit Product Modal (Owner Only) */}
      {isOwner && (
        <>
          <StockIntakeModal
            isOpen={showIntakeModal}
            onClose={() => {
              setShowIntakeModal(false);
              setIntakeInitialProductId(undefined);
              setIntakeInitialVariantId(undefined);
            }}
            categories={categories}
            products={products}
            contacts={contacts}
            initialProductId={intakeInitialProductId}
            initialVariantId={intakeInitialVariantId}
            onIntakeSuccess={() => {
              loadInventory();
            }}
            onOpenCategoryManager={() => {
              setShowIntakeModal(false);
              setIsCategoryModalOpen(true);
            }}
          />

          <CategoryManagementModal
            isOpen={isCategoryModalOpen}
            onClose={() => setIsCategoryModalOpen(false)}
            categories={categories}
            onCategoriesChanged={() => {
              loadInventory();
            }}
          />

          <EditProductModal
            isOpen={editingProduct !== null}
            onClose={() => setEditingProduct(null)}
            product={editingProduct}
            categories={categories}
            onProductUpdated={() => {
              loadInventory();
            }}
            onProductDeleted={() => {
              setEditingProduct(null);
              loadInventory();
            }}
          />
        </>
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
          setHandoverReturnDeadline('');
          setHandoverPayout('');
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
