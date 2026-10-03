import React, { useState, useEffect, useMemo } from 'react';
import type { InventoryUnit, Product, ProductCategory, Contact, User, FinancialAccount, SalesOrder } from '../api/client';
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
  Package,
  ChevronsDown,
  ChevronsUp,
  Handshake,
  Repeat,
  ArrowLeftRight,
  DollarSign,
  Trash2,
} from 'lucide-react';
import { InventoryUnitDrawer } from '../components/drawers/InventoryUnitDrawer';
import { SalesOrderDrawer } from '../components/drawers/SalesOrderDrawer';
import { Pagination } from '../components/Pagination';
import { StockIntakeModal } from '../components/inventory/StockIntakeModal';
import { CategoryManagementModal, getCategoryIcon } from '../components/inventory/CategoryManagementModal';
import { EditProductModal } from '../components/inventory/EditProductModal';
import { SwapDeviceModal } from '../components/inventory/SwapDeviceModal';
import { RecordExpenseModal } from '../components/RecordExpenseModal';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { formatPurchaseAge } from '../utils/dateUtils';

interface InventoryViewProps {
  user: User | null;
  onInventoryChange?: () => void;
  initialSelectedUnit?: InventoryUnit | null;
  initialShowIntake?: boolean;
  onClearInitialContext?: () => void;
}

type TabType = 'in_stock' | 'vendor_stock' | 'exchange_stock' | 'out' | 'sold' | 'returned' | 'returned_to_vendor' | 'all' | 'archived';

export const InventoryView: React.FC<InventoryViewProps> = ({
  user,
  onInventoryChange,
  initialSelectedUnit,
  initialShowIntake,
  onClearInitialContext,
}) => {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TabType>('in_stock');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnit | null>(null);
  const [viewingSalesOrder, setViewingSalesOrder] = useState<SalesOrder | null>(null);

  const [counts, setCounts] = useState<{
    in_stock: number;
    vendor_stock: number;
    exchange_stock?: number;
    returned_to_vendor: number;
    out: number;
    sold: number;
    returned: number;
    all: number;
  }>({
    in_stock: 0,
    vendor_stock: 0,
    exchange_stock: 0,
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

  // Sync external search navigation context
  useEffect(() => {
    if (initialSelectedUnit) {
      setSelectedUnit(initialSelectedUnit);
      onClearInitialContext?.();
    }
  }, [initialSelectedUnit, onClearInitialContext]);

  useEffect(() => {
    if (initialShowIntake) {
      setShowIntakeModal(true);
      onClearInitialContext?.();
    }
  }, [initialShowIntake, onClearInitialContext]);

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

  // Mark Handover Device Sold Modal State (for out -> sold)
  const [markSoldUnit, setMarkSoldUnit] = useState<InventoryUnit | null>(null);
  const [markSoldSettlementType, setMarkSoldSettlementType] = useState<'paid' | 'offset' | 'credit'>('paid');
  const [markSoldPrice, setMarkSoldPrice] = useState<string>('');
  const [markSoldAccountId, setMarkSoldAccountId] = useState<string>('');
  const [markSoldPaymentDate, setMarkSoldPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [markSoldReference, setMarkSoldReference] = useState<string>('');
  const [markSoldNotes, setMarkSoldNotes] = useState<string>('');
  const [markSoldSubmitting, setMarkSoldSubmitting] = useState(false);

  const openMarkSoldModal = (unit: InventoryUnit) => {
    setMarkSoldUnit(unit);
    setMarkSoldSettlementType('paid');
    const defaultPrice = unit.handover_payout ? String(unit.handover_payout) : (unit.selling_price ? String(unit.selling_price) : '');
    setMarkSoldPrice(defaultPrice);
    setMarkSoldAccountId(accounts[0]?.id || '');
    setMarkSoldPaymentDate(new Date().toISOString().split('T')[0]);
    setMarkSoldReference('');
    setMarkSoldNotes('');
  };

  // Customer Return Modal State (for sold -> returned)
  const [returnTargetUnit, setReturnTargetUnit] = useState<InventoryUnit | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnCondition, setReturnCondition] = useState('inspection_needed');
  const [returnDestination, setReturnDestination] = useState<'repair' | 'vendor'>('repair');
  const [returnCustomerWaiting, setReturnCustomerWaiting] = useState(true);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  // Repair Expense Modal State (for logging technician repair on returned/damaged devices)
  const [repairExpenseTargetUnit, setRepairExpenseTargetUnit] = useState<InventoryUnit | null>(null);
  const [showRepairExpenseModal, setShowRepairExpenseModal] = useState(false);

  // Repaired Restock Modal State (for returned/fixed -> in_stock)
  const [repairedTargetUnit, setRepairedTargetUnit] = useState<InventoryUnit | null>(null);
  const [repairedAction, setRepairedAction] = useState<'restock' | 'deliver_to_customer'>('restock');
  const [repairedCondition, setRepairedCondition] = useState('refurbished');
  const [repairedImei, setRepairedImei] = useState('');
  const [repairedNotes, setRepairedNotes] = useState('');
  const [repairedSellingPrice, setRepairedSellingPrice] = useState('');
  const [repairedSubmitting, setRepairedSubmitting] = useState(false);

  const openRepairedRestock = (unit: InventoryUnit) => {
    setRepairedTargetUnit(unit);
    setRepairedAction(unit.customer_waiting ? 'deliver_to_customer' : 'restock');
    setRepairedCondition('refurbished');
    setRepairedImei(unit.imei_or_serial || '');
    setRepairedNotes('');
    const initialPrice = unit.selling_price || unit.variant?.default_selling_price;
    setRepairedSellingPrice(initialPrice ? String(initialPrice) : '');
  };

  // Return to Vendor Modal State (for vendor consignment units -> returned_to_vendor)
  const [returnToVendorUnit, setReturnToVendorUnit] = useState<InventoryUnit | null>(null);
  const [returnToVendorReason, setReturnToVendorReason] = useState('');
  const [returnToVendorSubmitting, setReturnToVendorSubmitting] = useState(false);

  // Receive Fixed from Vendor Modal State
  const [receiveFixedUnit, setReceiveFixedUnit] = useState<InventoryUnit | null>(null);
  const [receiveFixedAction, setReceiveFixedAction] = useState<'deliver_to_customer' | 'restock'>('deliver_to_customer');
  const [receiveFixedCondition, setReceiveFixedCondition] = useState('refurbished');
  const [receiveFixedBattery, setReceiveFixedBattery] = useState('');
  const [receiveFixedCycle, setReceiveFixedCycle] = useState('');
  const [receiveFixedNotes, setReceiveFixedNotes] = useState('');
  const [receiveFixedPrice, setReceiveFixedPrice] = useState('');
  const [receiveFixedSubmitting, setReceiveFixedSubmitting] = useState(false);

  // Vendor Replacement Swap Modal State
  const [vendorSwapUnit, setVendorSwapUnit] = useState<InventoryUnit | null>(null);
  const [vendorSwapAction, setVendorSwapAction] = useState<'deliver_to_customer' | 'restock'>('deliver_to_customer');
  const [vendorSwapImei, setVendorSwapImei] = useState('');
  const [vendorSwapCondition, setVendorSwapCondition] = useState('new');
  const [vendorSwapBattery, setVendorSwapBattery] = useState('100');
  const [vendorSwapCycle, setVendorSwapCycle] = useState('');
  const [vendorSwapSimType, setVendorSwapSimType] = useState<'physical' | 'esim' | 'dual' | 'na'>('physical');
  const [vendorSwapNotes, setVendorSwapNotes] = useState('');
  const [vendorSwapPrice, setVendorSwapPrice] = useState('');
  const [vendorSwapSubmitting, setVendorSwapSubmitting] = useState(false);

  // Warranty Swap Modal State
  const [swapTargetUnit, setSwapTargetUnit] = useState<InventoryUnit | null>(null);

  // Debounce search input for high performance
  useEffect(() => {
    if (search === debouncedSearch) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setIsSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Initial load on component mount
  useEffect(() => {
    loadInventory();
  }, []);

  // Fast re-fetch on filter change or debounced search update
  useEffect(() => {
    if (products.length === 0) return;
    loadUnitsAndCounts(debouncedSearch);
  }, [statusFilter, selectedCategoryId, debouncedSearch]);

  // Handle Esc key to close all modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showIntakeModal) setShowIntakeModal(false);
        if (isCategoryModalOpen) setIsCategoryModalOpen(false);
        if (editingProduct) setEditingProduct(null);
        if (handoverTargetUnit) setHandoverTargetUnit(null);
        if (markSoldUnit) setMarkSoldUnit(null);
        if (returnTargetUnit) setReturnTargetUnit(null);
        if (repairedTargetUnit) setRepairedTargetUnit(null);
        if (returnToVendorUnit) setReturnToVendorUnit(null);
        if (receiveFixedUnit) setReceiveFixedUnit(null);
        if (vendorSwapUnit) setVendorSwapUnit(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIntakeModal, isCategoryModalOpen, editingProduct, handoverTargetUnit, markSoldUnit, returnTargetUnit, repairedTargetUnit, returnToVendorUnit, receiveFixedUnit, vendorSwapUnit]);

  const loadUnitsAndCounts = async (searchTerm = debouncedSearch) => {
    if (statusFilter === 'archived') return;
    try {
      setCurrentPage(1);
      const res = await api.getInventoryWithCounts({
        status: statusFilter === 'all' ? undefined : statusFilter,
        category_id: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
        search: searchTerm.trim() || undefined,
      });
      setUnits(res.units);
      setCounts(res.counts);
    } catch (err: any) {
      toast.error('Failed to update inventory', { description: err.message });
    }
  };

  const loadInventory = async (searchTerm = debouncedSearch) => {
    try {
      setLoading(true);
      setCurrentPage(1);
      const [res, p, cats, conts, accs] = await Promise.all([
        api.getInventoryWithCounts({
          status: statusFilter === 'all' || statusFilter === 'archived' ? undefined : statusFilter,
          category_id: selectedCategoryId === 'all' ? undefined : selectedCategoryId,
          search: searchTerm.trim() || undefined,
        }),
        api.getProducts({ include_inactive: true }),
        api.getCategories(),
        api.getContacts(),
        api.getAccounts(),
      ]);
      setUnits(res.units);
      setCounts(res.counts);
      setProducts(p);
      setCategories(cats);
      setContacts(conts);
      const allAccs = [...(accs.treasury_accounts || []), ...(accs.asset_accounts || [])];
      setAccounts(allAccs);
    } catch (err: any) {
      toast.error('Failed to load inventory', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const isOwner = user?.role === 'owner';
  const canIntake = isOwner || !!user?.can_intake_stock || !!user?.permissions?.can_intake_stock;
  const canHandover = isOwner || !!user?.can_handover || !!user?.permissions?.can_handover;
  const canManageInv = isOwner || !!user?.can_manage_inventory || !!user?.permissions?.can_manage_inventory;
  const canAction = isOwner || canIntake || canManageInv;

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

  const activeProducts = useMemo(() => {
    return products.filter((p) => p.is_active !== false);
  }, [products]);

  const archivedProducts = useMemo(() => {
    return products.filter((p) => p.is_active === false);
  }, [products]);

  const filteredArchivedProducts = useMemo(() => {
    return archivedProducts.filter((p) => {
      if (selectedCategoryId !== 'all') {
        const matchCat =
          p.category_id === selectedCategoryId ||
          p.category_rel?.id === selectedCategoryId ||
          categories.find((c) => c.id === selectedCategoryId)?.slug === p.category;
        if (!matchCat) return false;
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const brandMatch = (p.brand || '').toLowerCase().includes(q);
        return nameMatch || brandMatch;
      }
      return true;
    });
  }, [archivedProducts, selectedCategoryId, categories, debouncedSearch]);

  const handleRestoreProduct = async (p: Product) => {
    try {
      await api.unarchiveProduct(p.id);
      toast.success(`"${p.name}" restored to active catalog`);
      loadInventory();
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to restore product', { description: err.message });
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Permanently delete "${p.name}"? If there is historical sales history, financial records remain safely preserved.`)) {
      return;
    }
    try {
      await api.deleteProduct(p.id);
      toast.success(`"${p.name}" deleted successfully`);
      loadInventory();
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to delete product', { description: err.message });
    }
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

    const items = activeProducts.map((prod) => {
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
  }, [statusFilter, units, activeProducts, selectedCategoryId, categories, search]);

  // Restock an unsold OUT device back to shelf
  const handleRestockOut = async (unit: InventoryUnit) => {
    try {
      await api.restockInventoryUnit(unit.id);
      toast.success('Item Restocked to Shelf', {
        description: `${unit.variant?.product?.name || 'Device'} is now back in stock.`,
      });
      loadInventory();
      onInventoryChange?.();
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
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to handover unit', { description: err.message });
    } finally {
      setHandoverSubmitting(false);
    }
  };

  // Submit Mark Handover Device Sold
  const handleSubmitMarkSold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!markSoldUnit) return;

    if (markSoldSettlementType === 'paid' && !markSoldAccountId) {
      toast.error('Please select an account to deposit funds');
      return;
    }

    try {
      setMarkSoldSubmitting(true);
      await api.markHandoverSold(markSoldUnit.id, {
        settlement_type: markSoldSettlementType,
        selling_price: markSoldPrice ? parseFloat(markSoldPrice) : undefined,
        financial_account_id: markSoldSettlementType === 'paid' ? markSoldAccountId : undefined,
        payment_date: markSoldPaymentDate || undefined,
        reference_number: markSoldReference.trim() || undefined,
        notes: markSoldNotes.trim() || undefined,
      });

      const partner = markSoldUnit.handover_to || 'Partner';
      const devName = markSoldUnit.variant?.product?.name || 'Device';

      toast.success('Device Sold & Pipeline Synchronized', {
        description: `${devName} confirmed sold by ${partner}. It cannot be restocked directly.`,
      });

      setMarkSoldUnit(null);
      loadInventory();
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to confirm sale', { description: err.message });
    } finally {
      setMarkSoldSubmitting(false);
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
        destination: returnDestination,
        customer_waiting: returnCustomerWaiting,
      });

      toast.success(
        returnDestination === 'vendor'
          ? (returnCustomerWaiting ? 'Sent to vendor (Customer Waiting)' : 'Returned directly to vendor')
          : 'Customer return recorded',
        {
          description: returnDestination === 'vendor'
            ? (returnCustomerWaiting
                ? 'Device sent to vendor under warranty. Customer ticket active.'
                : 'Device returned to supplier/broker. Active stock updated.')
            : 'Device logged into Repair & Inspection shelf.',
        }
      );

      setReturnTargetUnit(null);
      setReturnReason('');
      setReturnNotes('');
      setReturnDestination('repair');
      setReturnCustomerWaiting(true);
      loadInventory();
      onInventoryChange?.();
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
        action: repairedAction,
        condition: repairedCondition,
        notes: repairedNotes.trim() || undefined,
        new_selling_price: repairedAction === 'restock' && repairedSellingPrice ? Number(repairedSellingPrice) : undefined,
        imei_or_serial: repairedImei.trim() || undefined,
      });

      toast.success(
        repairedAction === 'deliver_to_customer'
          ? 'Device delivered to customer'
          : 'Device repaired & restocked',
        {
          description: repairedAction === 'deliver_to_customer'
            ? 'Repaired device returned to customer custody. Waiting ticket cleared.'
            : 'Placed back into active shop counter stock with capitalized maintenance cost basis.',
        }
      );

      setRepairedTargetUnit(null);
      setRepairedNotes('');
      setRepairedSellingPrice('');
      setRepairedImei('');
      loadInventory();
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to process repaired unit', { description: err.message });
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
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to return unit to vendor', { description: err.message });
    } finally {
      setReturnToVendorSubmitting(false);
    }
  };

  // Submit Receive Fixed from Vendor
  const handleSubmitReceiveFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveFixedUnit) return;

    try {
      setReceiveFixedSubmitting(true);
      await api.receiveFromVendor(receiveFixedUnit.id, {
        action: receiveFixedAction,
        condition: receiveFixedCondition,
        battery_health: receiveFixedBattery ? parseInt(receiveFixedBattery, 10) : undefined,
        cycle_count: receiveFixedCycle ? parseInt(receiveFixedCycle, 10) : undefined,
        notes: receiveFixedNotes.trim() || undefined,
        new_selling_price: receiveFixedPrice ? parseFloat(receiveFixedPrice) : undefined,
      });

      toast.success(
        receiveFixedAction === 'deliver_to_customer'
          ? 'Device delivered to customer'
          : 'Device restocked to shelf',
        {
          description: receiveFixedAction === 'deliver_to_customer'
            ? 'Repaired device returned to customer custody.'
            : 'Repaired device added back to active shop counter stock.',
        }
      );

      setReceiveFixedUnit(null);
      loadInventory();
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to receive unit from vendor', { description: err.message });
    } finally {
      setReceiveFixedSubmitting(false);
    }
  };

  // Submit Vendor Replacement Swap
  const handleSubmitVendorSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorSwapUnit || !vendorSwapImei.trim()) return;

    try {
      setVendorSwapSubmitting(true);
      await api.vendorSwap(vendorSwapUnit.id, {
        replacement_imei: vendorSwapImei.trim(),
        action: vendorSwapAction,
        condition: vendorSwapCondition,
        battery_health: vendorSwapBattery ? parseInt(vendorSwapBattery, 10) : undefined,
        cycle_count: vendorSwapCycle ? parseInt(vendorSwapCycle, 10) : undefined,
        sim_type: vendorSwapSimType,
        notes: vendorSwapNotes.trim() || undefined,
        new_selling_price: vendorSwapPrice ? parseFloat(vendorSwapPrice) : undefined,
      });

      toast.success(
        vendorSwapAction === 'deliver_to_customer'
          ? `Replacement SN ${vendorSwapImei.trim()} delivered to customer`
          : `Replacement SN ${vendorSwapImei.trim()} added to shelf stock`,
        {
          description: vendorSwapAction === 'deliver_to_customer'
            ? 'Customer sales order and warranty successfully updated to new IMEI.'
            : 'Replacement unit added to active shop counter inventory.',
        }
      );

      setVendorSwapUnit(null);
      loadInventory();
      onInventoryChange?.();
    } catch (err: any) {
      toast.error('Failed to process vendor swap', { description: err.message });
    } finally {
      setVendorSwapSubmitting(false);
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

  if (loading && products.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  return (
    <div className="space-y-5 animate-page-enter">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Status Dropdown + Category Dropdown + Search */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1 max-w-3xl">
          {/* Status Select Dropdown */}
          <div className="relative min-w-[140px] sm:w-44 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as TabType);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs appearance-none cursor-pointer"
            >
              <option value="in_stock">In Stock • {counts.in_stock}</option>
              <option value="vendor_stock">Vendor Stock • {counts.vendor_stock ?? 0}</option>
              <option value="exchange_stock">Exchanged Stock • {counts.exchange_stock ?? 0}</option>
              <option value="out">Out for Sale • {counts.out}</option>
              <option value="sold">Sold • {counts.sold}</option>
              <option value="returned">Returns • {counts.returned}</option>
              <option value="returned_to_vendor">With Vendor • {counts.returned_to_vendor ?? 0}</option>
              <option value="all">All Records • {counts.all}</option>
              {isOwner && (
                <option value="archived">Archived Models • {archivedProducts.length}</option>
              )}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Category Select Dropdown */}
          <div className="relative min-w-[130px] sm:w-44 shrink-0">
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs appearance-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.in_stock_units_count ? `• ${c.in_stock_units_count}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[180px]">
            {isSearching ? (
              <Loader2 className="w-4 h-4 text-primary-500 animate-spin absolute left-3 top-3 pointer-events-none" />
            ) : (
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            )}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setDebouncedSearch(search);
                }
              }}
              placeholder="Search Model, Serial, IMEI..."
              className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDebouncedSearch('');
                }}
                className="absolute right-2.5 top-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Action Buttons (Hidden on mobile as accessible via FAB & in-card action) */}
        {(isOwner || canIntake) && (
          <div className="hidden sm:flex items-center gap-2 shrink-0 justify-end">
            {isOwner && (
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Manage product categories"
              >
                <FolderCog className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="hidden lg:inline">Categories</span>
              </button>
            )}

            <button
              onClick={() => {
                setIntakeInitialProductId(undefined);
                setIntakeInitialVariantId(undefined);
                setShowIntakeModal(true);
              }}
              className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs flex items-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-400 dark:text-emerald-500" />
              <span>Add Stock</span>
            </button>
          </div>
        )}
      </div>

      {/* Inventory Data Table Container */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        {/* Sub-header Controls for In Stock Grouped View */}
        {statusFilter === 'in_stock' && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {inStockProducts.length} models · {counts.in_stock} units
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 shadow-2xs"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 shadow-2xs"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
                Collapse All
              </button>
            </div>
          </div>
        )}

        {statusFilter === 'archived' && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {filteredArchivedProducts.length} archived model{filteredArchivedProducts.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Click "Unarchive" to restore any model back to the active catalog and stock intake.
            </span>
          </div>
        )}

        {/* Desktop Tables (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          {statusFilter === 'in_stock' ? (
            /* COLLAPSIBLE GROUPED IN-STOCK TABLE */
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Model</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap font-mono">Stock</th>
                  <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Price ETB</th>
                  {canViewCost && <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Cost ETB</th>}
                  {canAction && <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Action</th>}
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={canViewCost ? (canAction ? 6 : 5) : (canAction ? 5 : 4)} className="py-8 text-center">
                      <CustomPageLoader mode="app" fullScreen={false} />
                    </td>
                  </tr>
                ) : inStockProducts.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? (canAction ? 6 : 5) : (canAction ? 5 : 4)} className="py-16 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400">No products currently in stock</p>
                      {canIntake && (
                        <p className="text-xs text-slate-400 mt-0.5">Use the "+ Add" button to receive new items into counter inventory.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  inStockProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => {
                    const isExpanded = expandedProductIds.has(item.product.id);
                    const pCat = item.product.category;
                    const pCatRel = item.product.category_rel;

                    return (
                      <React.Fragment key={item.product.id}>
                        {/* Parent Product Row (Collapsible) */}
                        <tr
                          onClick={() => toggleExpand(item.product.id)}
                          className={`hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group select-none ${
                            isExpanded ? 'bg-slate-50/60 dark:bg-slate-900/40' : ''
                          }`}
                        >
                          {/* Col 1: Chevron + Model Icon + Name */}
                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded flex items-center justify-center text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors shrink-0">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </div>
                              <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-slate-700 dark:text-slate-300">
                                {pCatRel?.icon
                                  ? getCategoryIcon(pCatRel.icon, 'w-3.5 h-3.5')
                                  : getItemCategoryIcon(pCat, item.product.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5 min-w-0">
                                  <span className="truncate">{item.product.name}</span>
                                  {item.product.brand && (
                                    <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                      {item.product.brand}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {item.variantBreakdowns.length} variant{item.variantBreakdowns.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Stock Count (Minimal green number only) */}
                          <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs whitespace-nowrap">
                            {item.totalInStock}
                          </td>

                          {/* Col 3: Benchmark Selling Price */}
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {item.minPrice !== null && item.maxPrice !== null ? (
                              item.minPrice === item.maxPrice
                                ? Number(item.minPrice).toLocaleString()
                                : `${Number(item.minPrice).toLocaleString()} – ${Number(item.maxPrice).toLocaleString()}`
                            ) : (
                              <span className="text-slate-400 font-normal italic text-[11px]">—</span>
                            )}
                          </td>

                          {/* Col 4: Total Cost (Owner Only) */}
                          {canViewCost && (
                            <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {item.totalCost > 0 ? (
                                Number(item.totalCost).toLocaleString()
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>
                          )}

                          {/* Col 5: Actions */}
                          {canAction && (
                            <td className="py-2.5 px-3.5 text-right">
                              <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {(isOwner || canIntake) && (
                                  <button
                                    onClick={() => {
                                      setIntakeInitialProductId(item.product.id);
                                      setIntakeInitialVariantId(undefined);
                                      setShowIntakeModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title={`Add stock for ${item.product.name}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add</span>
                                  </button>
                                )}
                                {(isOwner || canManageInv) && (
                                  <button
                                    onClick={() => setEditingProduct(item.product)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
                                    title="Edit product"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Col 6: Chevron */}
                          <td className="py-2.5 px-2 text-right">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                            )}
                          </td>
                        </tr>

                        {/* Child Serial Rows (When expanded) */}
                        {isExpanded && item.units.map((unit) => {
                          const unitSpec = [
                            unit.variant?.storage,
                            unit.variant?.ram ? `${unit.variant.ram} RAM` : null,
                            unit.variant?.color,
                          ].filter(Boolean).join(' • ') || 'Standard';

                          return (
                            <tr
                              key={unit.id}
                              onClick={() => setSelectedUnit(unit)}
                              className="bg-slate-50/40 dark:bg-slate-900/25 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                            >
                              {/* Col 1: Indented IMEI (in minimal green) + Variant Specs + Badges */}
                              <td className="py-2.5 px-3.5 pl-8">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-slate-400 dark:text-slate-600 font-mono text-xs select-none">↳</span>
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                                    {unit.imei_or_serial || <span className="text-slate-400 font-sans italic text-[11px] font-normal">Bulk</span>}
                                  </span>
                                  {unitSpec && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600 text-xs">•</span>
                                      <span className="font-medium text-slate-700 dark:text-slate-300 text-xs truncate">
                                        {unitSpec}
                                      </span>
                                    </>
                                  )}
                                  {unit.battery_health !== null && unit.battery_health !== undefined && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 shrink-0">
                                      <Battery className="w-2.5 h-2.5 text-slate-400" />
                                      {unit.battery_health}%
                                    </span>
                                  )}
                                  {unit.source_type === 'exchange' && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50 shrink-0">
                                      <Repeat className="w-2.5 h-2.5" />
                                      Exchanged
                                    </span>
                                  )}
                                  {unit.source_type === 'consignment' && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 shrink-0">
                                      <Handshake className="w-2.5 h-2.5" />
                                      Vendor
                                    </span>
                                  )}
                                  {(unit.is_repaired || (unit.maintenance_records && unit.maintenance_records.length > 0)) && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50 shrink-0" title="Repaired & Serviced unit">
                                      <Wrench className="w-2.5 h-2.5" />
                                      Repaired
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Col 2: Unit Stock Count */}
                              <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                                1
                              </td>

                              {/* Col 3: Selling Price */}
                              <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-xs">
                                {(unit.selling_price || unit.variant?.default_selling_price) ? (
                                  Number(unit.selling_price || unit.variant?.default_selling_price).toLocaleString()
                                ) : (
                                  <span className="text-slate-400 font-normal italic text-[11px]">—</span>
                                )}
                              </td>

                              {/* Col 4: Cost */}
                              {canViewCost && (
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-xs">
                                  {unit.cost_basis ? (
                                    Number(unit.cost_basis).toLocaleString()
                                  ) : (
                                    <span className="text-slate-400 font-normal text-xs">—</span>
                                  )}
                                </td>
                              )}

                              {/* Col 5: Action */}
                              {(isOwner || canHandover || canManageInv) && (
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    {(isOwner || canManageInv) && unit.source_type === 'consignment' && (
                                      <button
                                        onClick={() => {
                                          setReturnToVendorUnit(unit);
                                          setReturnToVendorReason('');
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                        title="Return unsold consignment unit back to broker"
                                      >
                                        <Handshake className="w-3 h-3" />
                                        <span>Return</span>
                                      </button>
                                    )}
                                    {(isOwner || canHandover) && (
                                      <button
                                      onClick={() => {
                                        setHandoverTargetUnit(unit);
                                        setHandoverTo('');
                                        setHandoverLocation('');
                                        setHandoverNotes('');
                                        setHandoverReturnDeadline('');
                                        setHandoverPayout('');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                      title="Handover device to staff or broker"
                                    >
                                      <UserCheck className="w-3 h-3" />
                                      <span>Handover</span>
                                    </button>
                                  )}
                                  </div>
                                </td>
                              )}

                              {/* Col 6: Chevron */}
                              <td className="py-2.5 px-2 text-right">
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                              </td>
                            </tr>
                          );
                        })}

                        {/* Non-serialized items */}
                        {isExpanded && item.units.length === 0 && item.variantBreakdowns.map((vb) => {
                          const specLabel = [
                            vb.variant.storage,
                            vb.variant.ram ? `${vb.variant.ram} RAM` : null,
                            vb.variant.color,
                          ].filter(Boolean).join(' • ') || 'Standard';

                          return (
                            <tr
                              key={vb.variant.id}
                              className="bg-slate-50/40 dark:bg-slate-900/25 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-2.5 px-3.5 pl-8">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-400 dark:text-slate-600 font-mono text-xs select-none">↳</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                    {specLabel}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {vb.count}
                              </td>
                              <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-xs">
                                {vb.variant.default_selling_price ? (
                                  Number(vb.variant.default_selling_price).toLocaleString()
                                ) : (
                                  <span className="text-slate-400 font-normal text-xs">—</span>
                                )}
                              </td>
                              {canViewCost && (
                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">
                                  {vb.costBasis > 0 ? Number(vb.costBasis).toLocaleString() : '—'}
                                </td>
                              )}
                              {(isOwner || canIntake) && (
                                <td className="py-2.5 px-3.5 text-right">
                                  <button
                                    onClick={() => {
                                      setIntakeInitialProductId(item.product.id);
                                      setIntakeInitialVariantId(vb.variant.id);
                                      setShowIntakeModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title={`Add stock for ${specLabel}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add</span>
                                  </button>
                                </td>
                              )}
                              <td className="py-2.5 px-2"></td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : statusFilter === 'archived' ? (
            /* ARCHIVED PRODUCT MODELS TABLE */
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Archived Product Model</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Category</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Tracking Model</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Specifications</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Status</th>
                  {isOwner && <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {filteredArchivedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={isOwner ? 6 : 5} className="py-16 text-center text-slate-400">
                      <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-600 dark:text-slate-400">No archived product models</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Products archived via "Edit Product" appear here and can be unarchived at any time.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredArchivedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((prod) => {
                    const pCat = prod.category;
                    const pCatRel = prod.category_rel;
                    const categoryName = pCatRel?.name || categories.find((c) => c.slug === pCat || c.id === prod.category_id)?.name || prod.category || 'General';

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Col 1: Model Icon + Name + Brand */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
                              {pCatRel?.icon
                                ? getCategoryIcon(pCatRel.icon, 'w-4 h-4')
                                : getItemCategoryIcon(pCat, prod.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{prod.name}</span>
                                {prod.brand && (
                                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                    {prod.brand}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Col 2: Category */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {categoryName}
                          </span>
                        </td>

                        {/* Col 3: Tracking Model */}
                        <td className="py-3 px-3.5 whitespace-nowrap text-slate-500 text-xs">
                          {prod.has_serials ? 'Serialized IMEI' : 'Batch / Bulk'}
                        </td>

                        {/* Col 4: Specifications */}
                        <td className="py-3 px-3.5">
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {prod.variants?.length ?? 0} specification{(prod.variants?.length ?? 0) !== 1 ? 's' : ''}
                          </span>
                        </td>

                        {/* Col 5: Status */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                            Archived
                          </span>
                        </td>

                        {/* Col 6: Actions */}
                        {isOwner && (
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleRestoreProduct(prod)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                title={`Restore ${prod.name} to active catalog`}
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Unarchive</span>
                              </button>
                              <button
                                onClick={() => setEditingProduct(prod)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
                                title="Edit product details"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shadow-2xs cursor-pointer"
                                title="Permanently delete product"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* FLAT TABLE FOR OTHER TABS (OUT, SOLD, RETURNED, ALL, EXCHANGE) */
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3.5 whitespace-nowrap">Model</th>
                  <th className="py-2.5 px-3.5 whitespace-nowrap font-mono">IMEI</th>
                  <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Status</th>
                  {canViewCost && <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Cost ETB</th>}
                  {canAction && <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Action</th>}
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={canViewCost ? (canAction ? 6 : 5) : (canAction ? 5 : 4)} className="py-8 text-center">
                      <CustomPageLoader mode="app" fullScreen={false} />
                    </td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? (canAction ? 6 : 5) : (canAction ? 5 : 4)} className="py-16 text-center text-slate-400">
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
                  units.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((unit) => {
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
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-slate-700 dark:text-slate-300">
                              {pCatRel?.icon
                                ? getCategoryIcon(pCatRel.icon, 'w-3.5 h-3.5')
                                : getItemCategoryIcon(pCat, pName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white text-xs leading-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{pName}</span>
                                {unit.source_type === 'consignment' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                                    <Handshake className="w-2.5 h-2.5" />
                                    Vendor
                                  </span>
                                )}
                                {unit.source_type === 'exchange' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400 shrink-0">
                                    <Repeat className="w-2.5 h-2.5" />
                                    Exchanged
                                  </span>
                                )}
                                {(unit.is_repaired || (unit.maintenance_records && unit.maintenance_records.length > 0)) && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/50 shrink-0" title="Repaired & Serviced unit">
                                    <Wrench className="w-2.5 h-2.5" />
                                    Repaired
                                  </span>
                                )}
                                {unit.is_swapped && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 shrink-0" title={`Warranty swapped unit${unit.return_reason ? `: ${unit.return_reason}` : ''}`}>
                                    <ArrowLeftRight className="w-2.5 h-2.5" />
                                    Swapped
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">{variantSubtitle}</div>
                            </div>
                          </div>
                        </td>

                        {/* Serial / IMEI + Battery */}
                        <td className="py-2.5 px-3.5 font-mono text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {unit.imei_or_serial || <span className="text-slate-400 font-sans italic text-[11px] font-normal">Not recorded</span>}
                            </span>
                            {unit.is_swapped && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50 font-sans shrink-0"
                                title="Device entered inventory or was restocked via warranty swap"
                              >
                                <ArrowLeftRight className="w-2.5 h-2.5" />
                                Swapped
                              </span>
                            )}
                            {isUnitPhone && unit.battery_health && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                <Battery className="w-3 h-3 text-slate-400" />
                                {unit.battery_health}%
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {unit.status === 'in_stock' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              {unit.is_repaired ? 'In Stock (Repaired)' : unit.is_swapped ? 'In Stock (Swapped)' : 'In Stock'}
                            </span>
                          )}

                          {unit.status === 'out' && (
                            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3 h-3" />
                              <span>Out {unit.handover_to ? `(${unit.handover_to})` : ''}</span>
                            </div>
                          )}

                          {unit.status === 'sold' && (
                            <div
                              className="flex items-center justify-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-300"
                              title={unit.created_at ? `Purchased: ${new Date(unit.created_at).toLocaleDateString()} (${formatPurchaseAge(unit.created_at)} ago)` : undefined}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Sold ({formatPurchaseAge(unit.created_at)})</span>
                            </div>
                          )}

                          {unit.status === 'fixed' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Fixed & Ready
                            </span>
                          )}

                          {unit.status === 'returned' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              <AlertCircle className="w-3 h-3" />
                              Needs Repair
                            </span>
                          )}

                          {unit.status === 'returned_to_vendor' && (
                            <div className="flex flex-col items-center">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                                unit.customer_waiting
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                <RotateCcw className="w-3 h-3" />
                                <span>{unit.customer_waiting ? 'With Vendor (Customer Waiting)' : 'With Vendor'}</span>
                              </span>
                              {unit.customer_waiting && unit.sales_order_item?.sales_order && (
                                <span className="text-[9px] text-slate-400 font-mono">
                                  #{unit.sales_order_item.sales_order.order_number}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Cost basis (owner only) */}
                        {canViewCost && (
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {unit.cost_basis ? (
                              Number(unit.cost_basis).toLocaleString()
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>
                        )}

                        {/* Contextual Action Button */}
                        {(isOwner || canHandover || canManageInv) && (
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {(isOwner || canManageInv) && unit.source_type === 'consignment' && unit.status === 'in_stock' && (
                                <button
                                  onClick={() => {
                                    setReturnToVendorUnit(unit);
                                    setReturnToVendorReason('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                  title="Return unsold consignment item back to broker"
                                >
                                  <Handshake className="w-3 h-3" />
                                  <span>Return</span>
                                </button>
                              )}

                              {(isOwner || canHandover) && unit.status === 'in_stock' && (
                                <button
                                  onClick={() => {
                                    setHandoverTargetUnit(unit);
                                    setHandoverTo('');
                                    setHandoverLocation('');
                                    setHandoverNotes('');
                                    setHandoverReturnDeadline('');
                                    setHandoverPayout('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                  title="Handover this device to a staff member or broker to sell"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Handover</span>
                                </button>
                              )}

                              {(isOwner || canHandover) && unit.status === 'out' && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openMarkSoldModal(unit)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Confirm this handed-out device was sold by partner/vendor"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Mark Sold</span>
                                  </button>
                                  <button
                                    onClick={() => handleRestockOut(unit)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Restock this unsold unit back to shop shelf"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Restock</span>
                                  </button>
                                </div>
                              )}

                              {unit.status === 'sold' && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setReturnTargetUnit(unit);
                                      setReturnReason('');
                                      setReturnCondition('inspection_needed');
                                      setReturnDestination('repair');
                                      setReturnNotes('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Customer returned this sold device"
                                  >
                                    <Undo2 className="w-3 h-3" />
                                    <span>Return</span>
                                  </button>
                                  <button
                                    onClick={() => setSwapTargetUnit(unit)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Warranty Swap: 1-to-1 replacement for a defective device"
                                  >
                                    <ArrowLeftRight className="w-3 h-3" />
                                    <span>Swap</span>
                                  </button>
                                </div>
                              )}

                              {(unit.status === 'returned' || unit.status === 'fixed') && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setRepairExpenseTargetUnit(unit);
                                      setShowRepairExpenseModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Record technician repair cost (Shop covered or Vendor deductible)"
                                  >
                                    <Wrench className="w-3 h-3" />
                                    <span>Repair</span>
                                  </button>
                                  {Boolean(unit.supplier_contact_id || unit.source_type === 'consignment') && (
                                    <button
                                      onClick={() => {
                                        setReturnToVendorUnit(unit);
                                        setReturnToVendorReason(unit.return_reason ? `Defective: ${unit.return_reason}` : 'Returned defective unit back to vendor');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/50 dark:hover:text-amber-400 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                      title="Return defective unit directly back to vendor / broker"
                                    >
                                      <Handshake className="w-3 h-3" />
                                      <span>To Vendor</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openRepairedRestock(unit)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shadow-2xs active:scale-95 cursor-pointer ${
                                      unit.status === 'fixed'
                                        ? 'bg-teal-50 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/60 text-teal-700 dark:text-teal-400 hover:bg-teal-100'
                                        : 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
                                    }`}
                                    title="Restock this inspected/repaired unit back to shelf"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Restock</span>
                                  </button>
                                </div>
                              )}

                              {unit.status === 'returned_to_vendor' && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setReceiveFixedUnit(unit);
                                      setReceiveFixedAction(unit.customer_waiting ? 'deliver_to_customer' : 'restock');
                                      setReceiveFixedCondition('refurbished');
                                      setReceiveFixedBattery(unit.battery_health ? String(unit.battery_health) : '');
                                      setReceiveFixedCycle('');
                                      setReceiveFixedNotes('');
                                      const p = unit.selling_price || unit.variant?.default_selling_price;
                                      setReceiveFixedPrice(p ? String(p) : '');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 dark:bg-teal-950/50 border border-teal-200/60 dark:border-teal-800/60 text-teal-700 dark:text-teal-400 hover:bg-teal-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Receive this device back fixed from vendor (same IMEI)"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Receive Fixed</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setVendorSwapUnit(unit);
                                      setVendorSwapAction(unit.customer_waiting ? 'deliver_to_customer' : 'restock');
                                      setVendorSwapImei('');
                                      setVendorSwapCondition('new');
                                      setVendorSwapBattery('100');
                                      setVendorSwapCycle('');
                                      setVendorSwapSimType(unit.sim_type || 'physical');
                                      setVendorSwapNotes('');
                                      const p = unit.selling_price || unit.variant?.default_selling_price;
                                      setVendorSwapPrice(p ? String(p) : '');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Vendor replaced with a different IMEI"
                                  >
                                    <ArrowLeftRight className="w-3 h-3" />
                                    <span>Vendor Swap</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        )}

                        {/* Chevron */}
                        <td className="py-2.5 px-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Mobile Native Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {statusFilter === 'in_stock' ? (
            /* COLLAPSIBLE GROUPED IN-STOCK MOBILE CARDS */
            loading ? (
              <div className="py-6 text-center">
                <CustomPageLoader mode="app" fullScreen={false} />
              </div>
            ) : inStockProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">No products currently in stock</p>
                {isOwner && (
                  <p className="text-xs text-slate-400 mt-0.5">Use the "+ Add" button to receive new items into counter inventory.</p>
                )}
              </div>
            ) : (
              inStockProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => {
                const isExpanded = expandedProductIds.has(item.product.id);
                const pCat = item.product.category;
                const pCatRel = item.product.category_rel;
                const priceLabel =
                  item.minPrice !== null && item.maxPrice !== null
                    ? item.minPrice === item.maxPrice
                      ? `${Number(item.minPrice).toLocaleString()} ETB`
                      : `${Number(item.minPrice).toLocaleString()} – ${Number(item.maxPrice).toLocaleString()} ETB`
                    : '—';

                return (
                  <div key={item.product.id} className="p-4 space-y-3">
                    {/* Top Row: Click to toggle expand */}
                    <div
                      onClick={() => toggleExpand(item.product.id)}
                      className="flex items-start justify-between gap-3 cursor-pointer active:opacity-70"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-slate-600 dark:text-slate-300">
                          {pCatRel?.icon
                            ? getCategoryIcon(pCatRel.icon, 'w-4 h-4')
                            : getItemCategoryIcon(pCat, item.product.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white text-sm truncate flex items-center gap-1.5">
                            <span>{item.product.name}</span>
                            {item.product.brand && (
                              <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                {item.product.brand}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {item.totalInStock} in stock
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                          {priceLabel}
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 mt-1">
                          <span>{isExpanded ? 'Hide' : 'Units'}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Action Header for Owner */}
                    {isOwner && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 dark:border-slate-800/50">
                        <button
                          type="button"
                          onClick={() => setEditingProduct(item.product)}
                          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Model</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIntakeInitialProductId(item.product.id);
                            setIntakeInitialVariantId(undefined);
                            setShowIntakeModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Stock</span>
                        </button>
                      </div>
                    )}

                    {/* Expanded Units Sub-List */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                        {item.units.map((unit) => {
                          const unitSpec = [
                            unit.variant?.storage,
                            unit.variant?.ram ? `${unit.variant.ram} RAM` : null,
                            unit.variant?.color,
                          ]
                            .filter(Boolean)
                            .join(' • ') || 'Standard';

                          return (
                            <div
                              key={unit.id}
                              onClick={() => setSelectedUnit(unit)}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs active:bg-slate-100 dark:active:bg-slate-800 cursor-pointer"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate">
                                    {unit.imei_or_serial || 'Unserialized'}
                                  </span>
                                  {unit.battery_health !== null && unit.battery_health !== undefined && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                                      <Battery className="w-2.5 h-2.5" />
                                      {unit.battery_health}%
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5 font-sans">
                                  {unitSpec}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                                <span>Inspect</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : statusFilter === 'archived' ? (
            /* ARCHIVED PRODUCT MODELS MOBILE CARDS */
            filteredArchivedProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No archived product models.
              </div>
            ) : (
              filteredArchivedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((prod) => (
                <div key={prod.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {prod.category} • {prod.has_serials ? 'Serialized IMEI' : 'Batch / Bulk'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                      Archived
                    </span>
                  </div>
                  {isOwner && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleRestoreProduct(prod)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 active:scale-95"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Unarchive</span>
                      </button>
                      <button
                        onClick={() => setEditingProduct(prod)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 active:scale-95"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(prod)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 active:scale-95"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )
          ) : (
            /* FLAT UNITS MOBILE CARDS (out, sold, returned, all, exchange) */
            loading ? (
              <div className="py-6 text-center">
                <CustomPageLoader mode="app" fullScreen={false} />
              </div>
            ) : units.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                {statusFilter === 'out'
                  ? 'No items are currently out with staff or brokers.'
                  : statusFilter === 'sold'
                  ? 'No sold items found.'
                  : statusFilter === 'returned'
                  ? 'No devices under return/repair inspection.'
                  : 'No inventory units found in this category.'}
              </div>
            ) : (
              units.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((unit) => {
                const pName = unit.variant?.product?.name || 'Device';
                const specVals = unit.variant?.specs ? Object.values(unit.variant.specs).map(String) : [];
                const variantSubtitle = [
                  unit.variant?.storage,
                  unit.variant?.ram ? `${unit.variant.ram} RAM` : null,
                  unit.variant?.color,
                  ...specVals,
                ].filter(Boolean).join(' • ') || 'Standard';

                return (
                  <div
                    key={unit.id}
                    onClick={() => setSelectedUnit(unit)}
                    className="p-4 space-y-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-800/50"
                  >
                    {/* Header: Model & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-sm truncate flex items-center gap-1.5">
                          <span>{pName}</span>
                          {unit.source_type === 'consignment' && (
                            <span className="text-[10px] text-amber-600 font-semibold">Vendor</span>
                          )}
                          {unit.source_type === 'exchange' && (
                            <span className="text-[10px] text-purple-600 font-semibold">Exchanged</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{variantSubtitle}</div>
                      </div>

                      <div className="text-right shrink-0">
                        {canViewCost && unit.cost_basis ? (
                          <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {Number(unit.cost_basis).toLocaleString()} <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                          </div>
                        ) : null}
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold capitalize mt-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {unit.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {/* IMEI / Battery Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 dark:border-slate-800/50 text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {unit.imei_or_serial || 'Unserialized'}
                        </span>
                        {unit.battery_health && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                            <Battery className="w-3 h-3" />
                            {unit.battery_health}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>Inspect</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Pagination */}
        <div className="px-5 pb-4">
          <Pagination
            currentPage={currentPage}
            totalItems={
              statusFilter === 'in_stock'
                ? inStockProducts.length
                : statusFilter === 'archived'
                ? filteredArchivedProducts.length
                : units.length
            }
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Handover Modal (Mark In-Stock Device as Out for Sale) */}
      {handoverTargetUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 pt-20 sm:pt-24 pb-8 overflow-y-auto">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setHandoverTargetUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal-enter max-h-[calc(100vh-7rem)] my-auto overflow-y-auto">
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
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {handoverTargetUnit.variant?.product?.name}
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                Serial IMEI: {handoverTargetUnit.imei_or_serial || 'Standard stock'}
              </div>
            </div>

            <form onSubmit={handleSubmitHandover} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Handed Out To *
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Select partner or enter name</span>
                </div>

                {/* Partner Dropdown */}
                <select
                  value={contacts.some((c) => c.name.toLowerCase() === handoverTo.toLowerCase()) ? contacts.find((c) => c.name.toLowerCase() === handoverTo.toLowerCase())?.name : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setHandoverTo(e.target.value);
                    }
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 cursor-pointer mb-2"
                >
                  <option value="">-- Choose Partner or Vendor --</option>
                  {contacts
                    .filter((c) => c.is_active !== false)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.phone ? `· ${c.phone}` : ''} {c.roles?.includes('peer_vendor') ? '· Broker' : c.roles?.includes('supplier') ? '· Supplier' : ''}
                      </option>
                    ))}
                </select>

                {/* Direct Name Input */}
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={handoverTo}
                    onChange={(e) => setHandoverTo(e.target.value)}
                    placeholder="Or enter recipient name..."
                    className="w-full h-9 px-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 placeholder:text-slate-400"
                  />
                  {handoverTo && (
                    <button
                      type="button"
                      onClick={() => setHandoverTo('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1 cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Location
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
                    Agreed Vendor Payout ETB
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
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {handoverTargetUnit.selling_price && Number(handoverTargetUnit.selling_price) > 0 && (
                      <button
                        type="button"
                        onClick={() => setHandoverPayout(String(handoverTargetUnit.selling_price))}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Retail: {Number(handoverTargetUnit.selling_price).toLocaleString()} ETB
                      </button>
                    )}
                    {handoverTargetUnit.cost_basis && Number(handoverTargetUnit.cost_basis) > 0 && (
                      <button
                        type="button"
                        onClick={() => setHandoverPayout(String(handoverTargetUnit.cost_basis))}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Cost: {Number(handoverTargetUnit.cost_basis).toLocaleString()} ETB
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Partner Balance & Handover Offset Preview */}
              {(() => {
                const selectedPartner = contacts.find((c) => c.name.toLowerCase() === handoverTo.trim().toLowerCase());
                const payoutNum = parseFloat(handoverPayout) || 0;
                const hasNet = selectedPartner && typeof selectedPartner.net_balance === 'number';

                return (
                  <>
                    {hasNet && (
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 text-[11px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Current Partner Balance:</span>
                          <span className={`font-mono font-bold ${
                            (selectedPartner.net_balance ?? 0) > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : (selectedPartner.net_balance ?? 0) < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {(selectedPartner.net_balance ?? 0) > 0
                              ? `+${(selectedPartner.net_balance ?? 0).toLocaleString()} ETB · Owes us`
                              : (selectedPartner.net_balance ?? 0) < 0
                              ? `${(selectedPartner.net_balance ?? 0).toLocaleString()} ETB · Shop owes`
                              : '0.00 ETB · Settled'}
                          </span>
                        </div>
                        {payoutNum > 0 && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800/40">
                            <span className="text-slate-600 dark:text-slate-300 font-medium">After Handover Offset:</span>
                            {(() => {
                              const newBal = (selectedPartner.net_balance ?? 0) + payoutNum;
                              return (
                                <span className={`font-mono font-bold ${
                                  newBal > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : newBal < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                  {newBal > 0
                                    ? `+${newBal.toLocaleString()} ETB · Partner owes`
                                    : newBal < 0
                                    ? `${newBal.toLocaleString()} ETB · Reduces debt`
                                    : '0.00 ETB · Balanced'}
                                </span>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {payoutNum > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                        💰 A receivable of <span className="font-bold">{payoutNum.toLocaleString()} ETB</span> will be booked. The vendor owes this on sale or must return the device{handoverReturnDeadline ? ` by ${new Date(handoverReturnDeadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
                      </div>
                    )}
                  </>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Handover Note
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
                  Cancel
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

      {/* Mark Handover Device Sold Modal (For OUT units sold by partner/vendor) */}
      {markSoldUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setMarkSoldUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-modal-enter max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Confirm Handover Device Sold
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Device sold by {markSoldUnit.handover_to || 'partner'} · Settle holding & update pipeline
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMarkSoldUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Device Info Card */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  {markSoldUnit.variant?.product?.name || 'Device'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  Currently Out
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>SN: {markSoldUnit.imei_or_serial || 'Standard stock'}</span>
                <span>With: <strong className="text-slate-800 dark:text-slate-200 font-sans">{markSoldUnit.handover_to || 'Vendor'}</strong></span>
              </div>
              {markSoldUnit.handover_payout && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center">
                  <span>Agreed Handover Payout:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {Number(markSoldUnit.handover_payout).toLocaleString()} ETB
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitMarkSold} className="space-y-4">
              {/* Settlement Type Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Settlement & Payout Method *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* Paid */}
                  <button
                    type="button"
                    onClick={() => setMarkSoldSettlementType('paid')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      markSoldSettlementType === 'paid'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <DollarSign className={`w-3.5 h-3.5 ${markSoldSettlementType === 'paid' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>Direct Paid</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Cash or wire collected in shop bank
                    </p>
                  </button>

                  {/* Offset */}
                  <button
                    type="button"
                    onClick={() => setMarkSoldSettlementType('offset')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      markSoldSettlementType === 'offset'
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <ArrowLeftRight className={`w-3.5 h-3.5 ${markSoldSettlementType === 'offset' ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span>Debt Offset</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Covered by mutual debt or swap
                    </p>
                  </button>

                  {/* Credit */}
                  <button
                    type="button"
                    onClick={() => setMarkSoldSettlementType('credit')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      markSoldSettlementType === 'credit'
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 ring-1 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                      <Clock className={`w-3.5 h-3.5 ${markSoldSettlementType === 'credit' ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span>On Credit</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Sold, payment collected later
                    </p>
                  </button>
                </div>
              </div>

              {/* Conditional Account Selector for Paid */}
              {markSoldSettlementType === 'paid' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Deposit Into Financial Account *
                    </label>
                    <select
                      required
                      value={markSoldAccountId}
                      onChange={(e) => setMarkSoldAccountId(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    >
                      <option value="">-- Choose Account --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.type}) • {Number(acc.current_balance).toLocaleString()} ETB
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Payment Date
                      </label>
                      <input
                        type="date"
                        value={markSoldPaymentDate}
                        onChange={(e) => setMarkSoldPaymentDate(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Reference / Slip #
                      </label>
                      <input
                        type="text"
                        value={markSoldReference}
                        onChange={(e) => setMarkSoldReference(e.target.value)}
                        placeholder="e.g. Wire ref, slip #"
                        className="w-full h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Informational Banner for Offset */}
              {markSoldSettlementType === 'offset' && (
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Bilateral Offset / Mutual Debt Clearance</span>
                    <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      The holding receivable obligation will be marked as settled against mutual debts or product trade. No cash moves through shop bank accounts.
                    </span>
                  </div>
                </div>
              )}

              {/* Informational Banner for Credit */}
              {markSoldSettlementType === 'credit' && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Customer Sale on Credit</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">
                      The device is marked as sold and delivered to the end customer. The receivable debt remains open in {markSoldUnit.handover_to || 'partner'}'s statement for future collection.
                    </span>
                  </div>
                </div>
              )}

              {/* Sale Price / Collected Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sale / Collected Amount (ETB)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={markSoldPrice}
                  onChange={(e) => setMarkSoldPrice(e.target.value)}
                  placeholder="e.g. 100000"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sale Notes / Reference Context
                </label>
                <input
                  type="text"
                  value={markSoldNotes}
                  onChange={(e) => setMarkSoldNotes(e.target.value)}
                  placeholder="e.g. Sold to VIP walk-in customer, covered against yesterday 14 Pro payable"
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Permanent Custody Constraint Notice */}
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Important Custody Rule</span>
                </div>
                <p>
                  Once marked as sold, this device is physically in customer hands and <strong>cannot be restocked</strong> back to shop shelves. If returned in the future, it must be handled through <em>Customer Return</em> or <em>Warranty Swap</em>.
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMarkSoldUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={markSoldSubmitting}
                  className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {markSoldSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Confirm Sold & Update Pipeline</span>
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

              {Boolean(returnTargetUnit.supplier_contact_id || returnTargetUnit.source_type === 'consignment') && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Return Destination
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setReturnDestination('repair')}
                        className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                          returnDestination === 'repair'
                            ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Repair Shelf
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnDestination('vendor')}
                        className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                          returnDestination === 'vendor'
                            ? 'bg-white dark:bg-[#131926] text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Return to Vendor
                      </button>
                    </div>
                  </div>

                  {returnDestination === 'vendor' && (
                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                          Customer Ticket Status
                        </span>
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          {returnCustomerWaiting ? 'Customer Waiting' : 'Customer Handled'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 bg-amber-100/60 dark:bg-amber-900/40 p-1 rounded-xl text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setReturnCustomerWaiting(true)}
                          className={`py-1 px-2 rounded-lg transition-all cursor-pointer text-center ${
                            returnCustomerWaiting
                              ? 'bg-white dark:bg-[#131926] text-amber-900 dark:text-amber-200 shadow-xs font-bold'
                              : 'text-amber-700/70 dark:text-amber-400/70 hover:text-amber-900 dark:hover:text-white'
                          }`}
                        >
                          Customer Waiting
                        </button>
                        <button
                          type="button"
                          onClick={() => setReturnCustomerWaiting(false)}
                          className={`py-1 px-2 rounded-lg transition-all cursor-pointer text-center ${
                            !returnCustomerWaiting
                              ? 'bg-white dark:bg-[#131926] text-slate-800 dark:text-slate-200 shadow-xs font-bold'
                              : 'text-amber-700/70 dark:text-amber-400/70 hover:text-amber-900 dark:hover:text-white'
                          }`}
                        >
                          Customer Handled
                        </button>
                      </div>
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                        {returnCustomerWaiting
                          ? 'Device will be logged as With Vendor. When vendor repairs or swaps it, you can deliver it to the customer.'
                          : 'Customer was already refunded or credited. This device is returned directly to vendor to clear payables.'}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Need to replace from shop stock right away?</span>
                    <button
                      type="button"
                      onClick={() => {
                        const target = returnTargetUnit;
                        setReturnTargetUnit(null);
                        setSwapTargetUnit(target);
                      }}
                      className="font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Swap Now from Stock</span>
                    </button>
                  </div>
                </div>
              )}

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
                  Cancel
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

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  {repairedTargetUnit.variant?.product?.name}
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-500">
                  {repairedTargetUnit.imei_or_serial ? `#${repairedTargetUnit.imei_or_serial}` : 'Bulk Unit'}
                </span>
              </div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                Defect reported: {repairedTargetUnit.return_reason || 'N/A'}
              </div>
            </div>

            {/* Financial & Capitalization Overview Card */}
            {(() => {
              const origCost = Number(repairedTargetUnit.cost_basis || 0);
              const uncapitalizedMaintenance = (repairedTargetUnit.maintenance_records || [])
                .filter((r) => !r.is_capitalized && r.billing_type !== 'vendor_deduct' && r.billing_type !== 'vendor_reimburse')
                .reduce((acc, r) => acc + Number(r.cost), 0);
              const vendorCoveredMaintenance = (repairedTargetUnit.maintenance_records || [])
                .filter((r) => r.billing_type === 'vendor_deduct' || r.billing_type === 'vendor_reimburse')
                .reduce((acc, r) => acc + Number(r.cost), 0);
              const pendingRepairCost = uncapitalizedMaintenance;
              const newCost = origCost + uncapitalizedMaintenance;
              const currentRetail = Number(repairedTargetUnit.variant?.default_selling_price || 0);
              const currentOrUpdatedRetail = repairedSellingPrice ? Number(repairedSellingPrice) : currentRetail;
              const projectedMargin = currentOrUpdatedRetail > 0 ? currentOrUpdatedRetail - newCost : undefined;

              return (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Original Cost Basis:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {origCost.toLocaleString()} ETB
                    </span>
                  </div>

                  {pendingRepairCost > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5" />
                        Repair Expense Added:
                      </span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        +{pendingRepairCost.toLocaleString()} ETB
                      </span>
                    </div>
                  )}

                  {vendorCoveredMaintenance > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Handshake className="w-3.5 h-3.5" />
                        Vendor Covered Repair:
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {vendorCoveredMaintenance.toLocaleString()} ETB (Deducted from vendor)
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="font-bold text-slate-900 dark:text-white">New Capitalized Cost Basis:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {newCost.toLocaleString()} ETB
                    </span>
                  </div>

                  {/* Selling Price Adjustment */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Selling / Retail Price (ETB)
                      </label>
                      {pendingRepairCost > 0 && currentRetail > 0 && (
                        <button
                          type="button"
                          onClick={() => setRepairedSellingPrice(String(currentRetail + pendingRepairCost))}
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60 transition-colors"
                          title="Increase selling price by repair cost to preserve profit margin"
                        >
                          + Add Repair Cost (+{pendingRepairCost.toLocaleString()})
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={repairedSellingPrice}
                      onChange={(e) => setRepairedSellingPrice(e.target.value)}
                      placeholder="e.g. 85000"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                    />
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/60 text-[11px] text-teal-800 dark:text-teal-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span>Device-Specific Pricing: Only this individual unit will be adjusted. Other in-stock units of this model remain untouched.</span>
                    </div>

                    {projectedMargin !== undefined && (
                      <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                        <span>Expected Profit Margin:</span>
                        <span className={`font-mono font-bold ${projectedMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {projectedMargin.toLocaleString()} ETB
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSubmitRepairedRestock} className="space-y-3.5">
              {repairedTargetUnit.customer_waiting && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Destination / Next Step
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setRepairedAction('deliver_to_customer')}
                      className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                        repairedAction === 'deliver_to_customer'
                          ? 'bg-white dark:bg-[#131926] text-blue-700 dark:text-blue-400 shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Deliver to Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepairedAction('restock')}
                      className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                        repairedAction === 'restock'
                          ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Restock to Shelf
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {repairedAction === 'deliver_to_customer'
                      ? 'Returns repaired device to customer custody. Sales order audit note updated and waiting ticket cleared.'
                      : 'Returns repaired device to active shop counter stock for sale with capitalized cost basis.'}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Device Serial / IMEI
                </label>
                <input
                  type="text"
                  value={repairedImei}
                  onChange={(e) => setRepairedImei(e.target.value)}
                  placeholder="e.g. 354892019283741"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

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
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repairedSubmitting}
                  className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {repairedSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                  <span>{repairedAction === 'deliver_to_customer' ? 'Deliver to Customer' : 'Restock Repaired Device'}</span>
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
                  Cancel
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

      {/* Receive Fixed Device from Vendor Modal */}
      {receiveFixedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setReceiveFixedUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Receive Fixed Device
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Vendor resolved issue & returned unit (SN: {receiveFixedUnit.imei_or_serial || 'Bulk'})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReceiveFixedUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Device Info Card */}
            <div className="p-3.5 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-800/40 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  {receiveFixedUnit.variant?.product?.name}
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-500">
                  {receiveFixedUnit.imei_or_serial ? `#${receiveFixedUnit.imei_or_serial}` : 'Standard Stock'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Reported Defect: <strong className="font-semibold text-slate-700 dark:text-slate-300">{receiveFixedUnit.return_reason || 'N/A'}</strong>
              </div>
              {receiveFixedUnit.customer_waiting && (
                <div className="pt-1 mt-1 border-t border-teal-200/50 dark:border-teal-800/30 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Customer waiting for this repaired unit</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitReceiveFixed} className="space-y-3.5">
              {/* Destination Action */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination / Next Step
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setReceiveFixedAction('deliver_to_customer')}
                    className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                      receiveFixedAction === 'deliver_to_customer'
                        ? 'bg-white dark:bg-[#131926] text-teal-700 dark:text-teal-400 shadow-xs font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Deliver to Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiveFixedAction('restock')}
                    className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                      receiveFixedAction === 'restock'
                        ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Restock to Shelf
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {receiveFixedAction === 'deliver_to_customer'
                    ? 'Unit marked as Sold & delivered to customer custody. Customer waiting state is cleared.'
                    : 'Unit returned to active shop counter inventory available for new sales.'}
                </p>
              </div>

              {/* Condition Grade */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hardware Condition Grade
                </label>
                <select
                  value={receiveFixedCondition}
                  onChange={(e) => setReceiveFixedCondition(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                >
                  <option value="refurbished">Refurbished (Tested 100%)</option>
                  <option value="used_clean">Used Clean (Pristine)</option>
                  <option value="new">Like New / Factory Standard</option>
                </select>
              </div>

              {/* Battery & Cycle Count */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Battery Health (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={receiveFixedBattery}
                    onChange={(e) => setReceiveFixedBattery(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cycle Count (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={receiveFixedCycle}
                    onChange={(e) => setReceiveFixedCycle(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Selling Price Adjustment if restocking to shelf */}
              {receiveFixedAction === 'restock' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shelf Selling Price (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={receiveFixedPrice}
                    onChange={(e) => setReceiveFixedPrice(e.target.value)}
                    placeholder="e.g. 75000"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Resolution Notes (Optional)
                </label>
                <textarea
                  value={receiveFixedNotes}
                  onChange={(e) => setReceiveFixedNotes(e.target.value)}
                  placeholder="e.g. Vendor replaced screen under warranty; device passed full diagnostics"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReceiveFixedUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiveFixedSubmitting}
                  className="h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {receiveFixedSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{receiveFixedAction === 'deliver_to_customer' ? 'Deliver to Customer' : 'Restock to Counter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vendor Replacement Swap Modal */}
      {vendorSwapUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setVendorSwapUnit(null)}
          />

          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Vendor Replacement Swap
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Vendor provided replacement unit with new Serial/IMEI
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVendorSwapUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Defective Unit Summary */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  {vendorSwapUnit.variant?.product?.name}
                </span>
                <span className="font-mono text-[11px] text-slate-500 font-semibold line-through">
                  Old: #{vendorSwapUnit.imei_or_serial || 'None'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Defect reported: <strong className="font-semibold text-slate-700 dark:text-slate-300">{vendorSwapUnit.return_reason || 'N/A'}</strong>
              </div>
              {vendorSwapUnit.customer_waiting && (
                <div className="pt-1 mt-1 border-t border-indigo-200/50 dark:border-indigo-800/30 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Customer waiting for replacement</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitVendorSwap} className="space-y-3.5">
              {/* Destination Action */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Destination / Next Step
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setVendorSwapAction('deliver_to_customer')}
                    className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                      vendorSwapAction === 'deliver_to_customer'
                        ? 'bg-white dark:bg-[#131926] text-indigo-700 dark:text-indigo-400 shadow-xs font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Deliver to Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorSwapAction('restock')}
                    className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                      vendorSwapAction === 'restock'
                        ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Restock to Shelf
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {vendorSwapAction === 'deliver_to_customer'
                    ? 'Customer sales order, receipt, and warranty will automatically update to the new IMEI.'
                    : 'Replacement unit will enter shop counter inventory with original cost basis preserved.'}
                </p>
              </div>

              {/* Replacement Serial / IMEI */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Replacement Serial / IMEI *
                </label>
                <input
                  type="text"
                  required
                  value={vendorSwapImei}
                  onChange={(e) => setVendorSwapImei(e.target.value)}
                  placeholder="e.g. 359182049102834"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Condition Grade & SIM Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Condition Grade
                  </label>
                  <select
                    value={vendorSwapCondition}
                    onChange={(e) => setVendorSwapCondition(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                  >
                    <option value="new">Brand New (Factory Sealed)</option>
                    <option value="refurbished">Refurbished</option>
                    <option value="used_clean">Used Clean (Pristine)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    SIM Card Config
                  </label>
                  <select
                    value={vendorSwapSimType}
                    onChange={(e) => setVendorSwapSimType(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
                  >
                    <option value="physical">Physical SIM</option>
                    <option value="esim">eSIM Only</option>
                    <option value="dual">Dual SIM (Physical + eSIM)</option>
                    <option value="na">N/A</option>
                  </select>
                </div>
              </div>

              {/* Battery Health & Cycle Count */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Battery Health (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={vendorSwapBattery}
                    onChange={(e) => setVendorSwapBattery(e.target.value)}
                    placeholder="100"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Cycle Count (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={vendorSwapCycle}
                    onChange={(e) => setVendorSwapCycle(e.target.value)}
                    placeholder="e.g. 0"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Swap Notes (Optional)
                </label>
                <textarea
                  value={vendorSwapNotes}
                  onChange={(e) => setVendorSwapNotes(e.target.value)}
                  placeholder="e.g. Vendor replacement provided directly from supplier warranty depot"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setVendorSwapUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={vendorSwapSubmitting || !vendorSwapImei.trim()}
                  className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {vendorSwapSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
                  <span>{vendorSwapAction === 'deliver_to_customer' ? 'Swap & Deliver to Customer' : 'Swap & Add to Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scalable Stock Intake Modal, Category Management & Edit Product Modal */}
      {(isOwner || canIntake || canManageInv) && (
        <>
          {showIntakeModal && (
            <StockIntakeModal
              isOpen={showIntakeModal}
              onClose={() => {
                setShowIntakeModal(false);
                setIntakeInitialProductId(undefined);
                setIntakeInitialVariantId(undefined);
              }}
              categories={categories}
              products={activeProducts}
              contacts={contacts}
              accounts={accounts}
              isOwner={isOwner}
              initialProductId={intakeInitialProductId}
              initialVariantId={intakeInitialVariantId}
              onIntakeSuccess={() => {
                loadInventory();
                onInventoryChange?.();
              }}
              onOpenCategoryManager={() => {
                setShowIntakeModal(false);
                setIsCategoryModalOpen(true);
              }}
            />
          )}

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
        onUnitUpdated={(updated) => {
          setSelectedUnit(updated);
          loadInventory();
        }}
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
          setReturnDestination('repair');
          setReturnNotes('');
        }}
        onOpenRepairExpense={(unit) => {
          setRepairExpenseTargetUnit(unit);
          setShowRepairExpenseModal(true);
        }}
        onOpenRepairedRestock={(unit) => openRepairedRestock(unit)}
        onOpenSwap={(unit) => setSwapTargetUnit(unit)}
        onOpenReceiveFixed={(unit) => {
          setReceiveFixedUnit(unit);
          setReceiveFixedAction(unit.customer_waiting ? 'deliver_to_customer' : 'restock');
          setReceiveFixedCondition('refurbished');
          setReceiveFixedBattery(unit.battery_health ? String(unit.battery_health) : '');
          setReceiveFixedCycle('');
          setReceiveFixedNotes('');
          const p = unit.selling_price || unit.variant?.default_selling_price;
          setReceiveFixedPrice(p ? String(p) : '');
        }}
        onOpenVendorSwap={(unit) => {
          setVendorSwapUnit(unit);
          setVendorSwapAction(unit.customer_waiting ? 'deliver_to_customer' : 'restock');
          setVendorSwapImei('');
          setVendorSwapCondition('new');
          setVendorSwapBattery('100');
          setVendorSwapCycle('');
          setVendorSwapSimType(unit.sim_type || 'physical');
          setVendorSwapNotes('');
          const p = unit.selling_price || unit.variant?.default_selling_price;
          setVendorSwapPrice(p ? String(p) : '');
        }}
        onOpenMarkSold={(unit) => openMarkSoldModal(unit)}
        onViewSalesOrder={(order) => setViewingSalesOrder(order)}
      />

      {/* Transaction Detail Workspace Drawer for Sold Units */}
      <SalesOrderDrawer
        order={viewingSalesOrder}
        isOpen={viewingSalesOrder !== null}
        onClose={() => setViewingSalesOrder(null)}
        user={user}
      />

      {/* Warranty Swap Modal */}
      <SwapDeviceModal
        isOpen={swapTargetUnit !== null}
        onClose={() => setSwapTargetUnit(null)}
        oldUnit={swapTargetUnit}
        onSwapSuccess={() => {
          loadInventory();
        }}
      />

      {/* Repair Expense Modal (Technician billing / Vendor deductible) */}
      <RecordExpenseModal
        isOpen={showRepairExpenseModal}
        onClose={() => {
          setShowRepairExpenseModal(false);
          setRepairExpenseTargetUnit(null);
        }}
        accounts={accounts}
        initialUnit={repairExpenseTargetUnit || undefined}
        initialUnitId={repairExpenseTargetUnit?.id}
        initialCategory="maintenance"
        onSuccess={() => {
          loadInventory();
          onInventoryChange?.();
        }}
      />
    </div>
  );
};
