import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { SalesOrder, User, InventoryUnit, Tenant } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Search,
  ArrowLeftRight,
  Loader2,
  CheckCircle2,
  Clock,
  Repeat,
  Receipt,
  Undo2,
  X,
  ChevronRight,
  Handshake,
  Sparkles,
} from 'lucide-react';
import { SalesOrderDrawer } from '../components/drawers/SalesOrderDrawer';
import { SwapDeviceModal } from '../components/inventory/SwapDeviceModal';

interface SalesHistoryViewProps {
  user: User | null;
  tenant?: Tenant | null;
  initialSelectedOrder?: SalesOrder | null;
  onClearInitialContext?: () => void;
}

// Shimmer Skeleton Row for Table
const SalesRowSkeleton: React.FC<{ canManageInv: boolean }> = ({ canManageInv }) => (
  <tr className="animate-pulse">
    {/* Model */}
    <td className="py-3 px-3.5">
      <div className="space-y-1.5 max-w-[220px]">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-36"></div>
      </div>
    </td>
    {/* Customer */}
    <td className="py-3 px-3.5">
      <div className="space-y-1 max-w-[120px]">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-24"></div>
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800/60 rounded-md w-16"></div>
      </div>
    </td>
    {/* IMEI */}
    <td className="py-3 px-3.5">
      <div className="h-3.5 bg-emerald-100/60 dark:bg-emerald-950/40 rounded-md w-28"></div>
    </td>
    {/* Total */}
    <td className="py-3 px-3.5 text-right">
      <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-md w-20 ml-auto"></div>
    </td>
    {/* Status */}
    <td className="py-3 px-3.5 text-center">
      <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-full w-14 mx-auto"></div>
    </td>
    {/* Action */}
    {canManageInv && (
      <td className="py-3 px-3.5 text-right">
        <div className="h-6 bg-slate-100 dark:bg-slate-800 rounded-lg w-24 ml-auto"></div>
      </td>
    )}
    {/* Chevron */}
    <td className="py-3 px-2 text-right">
      <div className="w-3.5 h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full ml-auto"></div>
    </td>
  </tr>
);

// Shimmer Skeleton Card for Mobile
const SalesCardSkeleton: React.FC = () => (
  <div className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs space-y-2 animate-pulse">
    <div className="flex items-center justify-between gap-2">
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-36"></div>
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-16"></div>
    </div>
    <div className="flex items-center justify-between gap-2">
      <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md w-24"></div>
      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-12"></div>
    </div>
    <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
      <div className="h-2.5 bg-emerald-100/60 dark:bg-emerald-950/40 rounded-md w-20"></div>
      <div className="w-3.5 h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
    </div>
  </div>
);

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  user,
  tenant,
  initialSelectedOrder,
  onClearInitialContext,
}) => {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 25;

  const [counts, setCounts] = useState<{ all: number; paid: number; credit: number; exchange: number; b2b?: number }>({
    all: 0,
    paid: 0,
    credit: 0,
    exchange: 0,
    b2b: 0,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

  const querySeqRef = useRef(0);
  const isFetchingRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLTableCellElement>(null);
  const mobileSentinelRef = useRef<HTMLDivElement>(null);

  // Customer Return Modal State (matching stock sold page)
  const isOwner = user?.role === 'owner';
  const canManageInv = isOwner || !!user?.can_manage_inventory || !!user?.permissions?.can_manage_inventory;
  const [returnTargetUnit, setReturnTargetUnit] = useState<InventoryUnit | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnCondition, setReturnCondition] = useState('inspection_needed');
  const [returnDestination, setReturnDestination] = useState<'repair' | 'vendor'>('repair');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [multiReturnOrder, setMultiReturnOrder] = useState<SalesOrder | null>(null);

  // Warranty Swap Modal State
  const [swapTargetUnit, setSwapTargetUnit] = useState<InventoryUnit | null>(null);
  const [swapTargetOrder, setSwapTargetOrder] = useState<SalesOrder | null>(null);
  const [multiSwapOrder, setMultiSwapOrder] = useState<SalesOrder | null>(null);

  const loadSales = async (searchOverride?: string, pageToFetch = 1) => {
    if (pageToFetch > 1 && isFetchingRef.current) return;
    const querySeq = ++querySeqRef.current;
    try {
      isFetchingRef.current = true;
      if (pageToFetch === 1) {
        setIsLoadingInitial(true);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        if (mobileContainerRef.current) mobileContainerRef.current.scrollTop = 0;
      } else {
        setIsLoadingMore(true);
      }

      const activeSearch = searchOverride !== undefined ? searchOverride : search;
      const res = await api.getSalesWithCounts({
        payment_status: statusFilter || undefined,
        source_type: sourceFilter || undefined,
        search: activeSearch.trim() || undefined,
        per_page: PAGE_SIZE,
        page: pageToFetch,
      });

      if (querySeq !== querySeqRef.current) return;

      if (pageToFetch === 1) {
        setSales(res.sales);
      } else {
        setSales((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newItems = res.sales.filter((s) => !existingIds.has(s.id));
          return [...prev, ...newItems];
        });
      }

      setPage(pageToFetch);
      if (res.counts) setCounts(res.counts);

      if (res.pagination) {
        setHasMore(res.pagination.current_page < res.pagination.last_page);
      } else {
        setHasMore(res.sales.length === PAGE_SIZE);
      }
    } catch (err: any) {
      if (querySeq === querySeqRef.current) {
        toast.error('Failed to load sales history', { description: err.message });
      }
    } finally {
      if (querySeq === querySeqRef.current) {
        setIsLoadingInitial(false);
        setIsLoadingMore(false);
        isFetchingRef.current = false;
      }
    }
  };

  const loadMoreSales = () => {
    if (isLoadingMore || isLoadingInitial || !hasMore || isFetchingRef.current) return;
    loadSales(undefined, page + 1);
  };

  useEffect(() => {
    loadSales(undefined, 1);
  }, [statusFilter, sourceFilter]);

  // Eager Infinite Scroll Observers with 300px rootMargin
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoadingInitial) {
          loadMoreSales();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '300px',
        threshold: 0,
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadingInitial, page, sales.length]);

  useEffect(() => {
    const mobileSentinel = mobileSentinelRef.current;
    if (!mobileSentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoadingInitial) {
          loadMoreSales();
        }
      },
      {
        root: mobileContainerRef.current,
        rootMargin: '300px',
        threshold: 0,
      }
    );
    observer.observe(mobileSentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoadingInitial, page, sales.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - (target.scrollTop + target.clientHeight) < 300) {
      if (hasMore && !isLoadingMore && !isLoadingInitial) {
        loadMoreSales();
      }
    }
  };

  useEffect(() => {
    if (initialSelectedOrder) {
      setSelectedOrder(initialSelectedOrder);
      onClearInitialContext?.();
    }
  }, [initialSelectedOrder, onClearInitialContext]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSales();
  };

  const getReturnableUnits = (order: SalesOrder): InventoryUnit[] => {
    return order.items
      .filter((item) => item.inventory_unit && item.inventory_unit.status === 'sold')
      .map((item) => {
        const u = item.inventory_unit!;
        return {
          ...u,
          variant_id: u.variant_id || item.variant_id,
          variant: u.variant || item.variant,
          cost_basis: u.cost_basis ?? (item.unit_cost !== undefined ? item.unit_cost : undefined),
          supplier_contact_id: u.supplier_contact_id || item.vendor_contact_id || undefined,
          sales_order_item: {
            ...item,
            sales_order: order,
          },
        };
      });
  };

  const handleInitiateReturn = (order: SalesOrder) => {
    const returnable = getReturnableUnits(order);
    if (returnable.length === 1) {
      const u = returnable[0];
      const isVendor = Boolean(
        u.supplier_contact_id ||
        u.source_type === 'vendor_direct' ||
        u.source_type === 'consignment' ||
        u.sales_order_item?.sourcing_type === 'brokered_neighbour'
      );
      setReturnTargetUnit(u);
      setReturnDestination(isVendor ? 'vendor' : 'repair');
      setReturnReason('');
      setReturnCondition('inspection_needed');
      setReturnNotes('');
    } else if (returnable.length > 1) {
      setMultiReturnOrder(order);
    } else {
      toast.error('No returnable sold inventory units found in this order.');
    }
  };

  const handleInitiateSwap = (order: SalesOrder) => {
    const returnable = getReturnableUnits(order);
    if (returnable.length === 1) {
      setSwapTargetUnit(returnable[0]);
      setSwapTargetOrder(order);
    } else if (returnable.length > 1) {
      setMultiSwapOrder(order);
    } else {
      toast.error('No returnable sold inventory units found in this order to swap.');
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTargetUnit) return;
    try {
      setReturnSubmitting(true);
      await api.customerReturnInventoryUnit(returnTargetUnit.id, {
        return_reason: returnReason,
        condition: returnCondition,
        destination: returnDestination,
        notes: returnNotes || undefined,
      });
      toast.success(
        returnDestination === 'vendor' ? 'Returned Directly to Vendor' : 'Customer Return Recorded',
        {
          description:
            returnDestination === 'vendor'
              ? `${returnTargetUnit.variant?.product?.name || 'Device'} marked as returned to vendor/supplier.`
              : `${returnTargetUnit.variant?.product?.name || 'Device'} placed into Repair & Inspection shelf.`,
        }
      );
      setReturnTargetUnit(null);
      setMultiReturnOrder(null);
      setReturnDestination('repair');
      loadSales(undefined, 1);
    } catch (err: any) {
      toast.error('Failed to process customer return', { description: err.message });
    } finally {
      setReturnSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 animate-page-enter flex-1 flex flex-col min-h-0">
      {/* Filter Segmented Control & Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold shadow-2xs overflow-x-auto max-w-full no-scrollbar">
          <button
            onClick={() => { setStatusFilter(''); setSourceFilter(''); }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === '' && sourceFilter === ''
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All • {counts.all}
          </button>
          <button
            onClick={() => { setStatusFilter('paid'); setSourceFilter(''); }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'paid' && sourceFilter === ''
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Paid • {counts.paid}
          </button>
          <button
            onClick={() => { setStatusFilter('credit'); setSourceFilter(''); }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'credit' && sourceFilter === ''
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Credit • {counts.credit}
          </button>
          <button
            onClick={() => {
              if (sourceFilter === 'exchange') {
                setSourceFilter('');
              } else {
                setSourceFilter('exchange');
                setStatusFilter('');
              }
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              sourceFilter === 'exchange'
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-3 h-3 text-purple-500" />
            Exchange • {counts.exchange}
          </button>
          <button
            onClick={() => {
              if (sourceFilter === 'b2b') {
                setSourceFilter('');
              } else {
                setSourceFilter('b2b');
                setStatusFilter('');
              }
            }}
            className={`px-3 sm:px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              sourceFilter === 'b2b'
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Handshake className="w-3 h-3 text-indigo-500" />
            B2B Trade • {counts.b2b || 0}
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value === '') {
                loadSales('', 1);
              }
            }}
            placeholder="Search order #, customer, rep..."
            className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                loadSales('', 1);
              }}
              className="absolute right-2.5 top-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Orders Table — Fixed-height Infinite Scroll Ledger */}
      <div className="bg-transparent md:bg-white md:dark:bg-[#131926] md:rounded-2xl md:border md:border-slate-100 md:dark:border-slate-800/80 md:overflow-hidden md:shadow-2xs space-y-3 md:space-y-0 flex-1 flex flex-col min-h-0">
        {/* Desktop Table (md and up) — Fixed Height with Sticky Header */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="hidden md:block overflow-x-auto overflow-y-auto h-[calc(100vh-185px)] min-h-[560px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 relative"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-[#131926]/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] shadow-2xs">
              <tr>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Model</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Customer</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap font-mono">IMEI</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Total</th>
                <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Status</th>
                {canManageInv && <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Action</th>}
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {isLoadingInitial && sales.length === 0 ? (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SalesRowSkeleton key={`init-skel-${i}`} canManageInv={canManageInv} />
                  ))}
                </>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={canManageInv ? 7 : 6} className="py-20 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No sales found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Completed checkout orders will appear here.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {sales.map((order) => {
                    const gross = Number(order.total_amount) || 0;
                    const disc = Number(order.discount_amount) || 0;
                    const exchange = Number(order.exchange_allowance) || 0;
                    const netPayable = Math.max(0, gross - disc - exchange);

                    const returnableUnits = getReturnableUnits(order);
                    const hasReturnedUnits = order.items.some(
                      (i) =>
                        i.inventory_unit?.status === 'returned' ||
                        i.inventory_unit?.status === 'fixed' ||
                        Boolean(i.inventory_unit?.returned_at)
                    );

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group select-none"
                      >
                        {/* Col 1: Model */}
                        <td className="py-2.5 px-3.5">
                          <div className="space-y-1 max-w-[260px]">
                            {order.items.map((item, idx) => {
                              const isAccessory = item.is_accessory || Boolean(item.accessory_name);
                              const isVendoredAcc = isAccessory && (order.is_vendor_sourced || item.sourcing_type === 'brokered_neighbour' || Boolean(item.vendor_contact_id));
                              const pName = item.accessory_name || (isVendoredAcc ? 'Vendored Accessory' : isAccessory ? 'Accessory' : (item.inventory_unit?.variant?.product?.name || item.variant?.product?.name || 'Device'));

                              return (
                                <div key={idx} className="min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                    {item.quantity > 1 && (
                                      <span className="font-mono text-slate-500 font-normal text-[11px]">
                                        {item.quantity}×
                                      </span>
                                    )}
                                    <span className="truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{pName}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* Col 2: Customer */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-white text-xs truncate max-w-[120px]">
                              {order.customer?.name || <span className="text-slate-400 font-normal italic">Walk-in</span>}
                            </span>
                            {(order.payment_method === 'debt_offset' || order.customer?.roles?.some((r: string) => ['peer_vendor', 'vendor', 'supplier', 'partner'].includes(r))) && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0" title="B2B Vendor / Partner Trade">
                                B2B
                              </span>
                            )}
                          </div>
                          {order.customer?.phone && (
                            <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                              {order.customer.phone}
                            </div>
                          )}
                        </td>

                        {/* Col 3: IMEI */}
                        <td className="py-2.5 px-3.5 font-mono text-xs whitespace-nowrap">
                          <div className="space-y-1">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="font-bold text-emerald-600 dark:text-emerald-400">
                                {item.inventory_unit?.imei_or_serial || (
                                  <span className="text-slate-400 font-sans italic text-[11px] font-normal">—</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Col 4: Total */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {gross.toLocaleString()} <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                          </div>
                        </td>

                        {/* Col 6: Status (High-contrast minimal badges) */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {order.payment_status === 'refunded' || order.items.every((i) => i.inventory_unit?.status === 'returned' || i.inventory_unit?.status === 'returned_to_vendor') ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                              <Undo2 className="w-3.5 h-3.5" />
                              Refunded
                            </span>
                          ) : order.payment_status === 'paid' || netPayable - (Number(order.paid_amount) || 0) - (Number(order.write_off_amount) || 0) <= 0 ? (
                            order.payment_method === 'debt_offset' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400" title="Settled via B2B debt offset">
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                B2B Offset
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Paid
                              </span>
                            )
                          ) : order.payment_status === 'partial' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              Partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              Credit
                            </span>
                          )}
                          {order.bonus_info?.used_for_debt && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50" title={order.bonus_info.offset_notes || 'Bonus used for debt settlement'}>
                                <Sparkles className="w-2.5 h-2.5 text-emerald-500" />
                                Used for Debt
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Col 7: Action */}
                        {canManageInv && (
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {returnableUnits.length > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateReturn(order)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Process customer return"
                                  >
                                    <Undo2 className="w-3 h-3" />
                                    <span>Return</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateSwap(order)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                                    title="Warranty Swap"
                                  >
                                    <ArrowLeftRight className="w-3 h-3" />
                                    <span>Swap</span>
                                  </button>
                                </div>
                              ) : hasReturnedUnits ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                  <Undo2 className="w-2.5 h-2.5" />
                                  Returned
                                </span>
                              ) : null}
                            </div>
                          </td>
                        )}

                        {/* Col 8: Chevron */}
                        <td className="py-2.5 px-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                        </td>
                      </tr>
                    );
                  })}

                  {/* Shimmer skeleton rows while eager-loading more */}
                  {isLoadingMore && (
                    <>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <SalesRowSkeleton key={`more-skel-${i}`} canManageInv={canManageInv} />
                      ))}
                    </>
                  )}

                  {/* All caught up footer banner */}
                  {!hasMore && sales.length > 0 && (
                    <tr>
                      <td
                        colSpan={canManageInv ? 7 : 6}
                        className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30 font-medium"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>All {sales.length} transactions loaded</span>
                        </span>
                      </td>
                    </tr>
                  )}

                  {/* Invisible sentinel for IntersectionObserver */}
                  <tr>
                    <td ref={sentinelRef} colSpan={canManageInv ? 7 : 6} className="h-2 p-0 m-0 border-none pointer-events-none" />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Native Cards (< md) — Fixed Height with Infinite Scroll */}
        <div
          ref={mobileContainerRef}
          onScroll={handleScroll}
          className="md:hidden overflow-y-auto h-[calc(100vh-185px)] min-h-[480px] space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
        >
          {isLoadingInitial && sales.length === 0 ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <SalesCardSkeleton key={`init-mob-skel-${i}`} />
              ))}
            </>
          ) : sales.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">No sales found</p>
              <p className="text-xs text-slate-400 mt-0.5">Completed checkout orders will appear here.</p>
            </div>
          ) : (
            <>
              {sales.map((order) => {
                const gross = Number(order.total_amount) || 0;
                const disc = Number(order.discount_amount) || 0;
                const exchange = Number(order.exchange_allowance) || 0;
                const netPayable = Math.max(0, gross - disc - exchange);

                const returnableUnits = getReturnableUnits(order);
                const hasReturnedUnits = order.items.some(
                  (i) =>
                    i.inventory_unit?.status === 'returned' ||
                    i.inventory_unit?.status === 'fixed' ||
                    Boolean(i.inventory_unit?.returned_at)
                );

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="p-3.5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer active:scale-[0.99] space-y-2 select-none"
                  >
                    {/* Top: Model & Total */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                          {order.items.map((item, idx) => {
                            const isAccessory = item.is_accessory || Boolean(item.accessory_name);
                            const isVendoredAcc =
                              isAccessory &&
                              (order.is_vendor_sourced ||
                                item.sourcing_type === 'brokered_neighbour' ||
                                Boolean(item.vendor_contact_id));
                            const pName =
                              item.accessory_name ||
                              (isVendoredAcc
                                ? 'Vendored Accessory'
                                : isAccessory
                                ? 'Accessory'
                                : item.inventory_unit?.variant?.product?.name ||
                                  item.variant?.product?.name ||
                                  'Device');

                            return (
                              <span key={idx}>
                                {idx > 0 && ', '}
                                {item.quantity > 1 && `${item.quantity}× `}
                                {pName}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white shrink-0 text-right">
                        {gross.toLocaleString()}{' '}
                        <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                      </div>
                    </div>

                    {/* Middle: Customer + Status */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                          {order.customer?.name || <span className="text-slate-400 font-normal italic">Walk-in</span>}
                        </span>
                        {order.customer?.phone && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            • {order.customer.phone}
                          </span>
                        )}
                        {(order.payment_method === 'debt_offset' ||
                          order.customer?.roles?.some((r: string) =>
                            ['peer_vendor', 'vendor', 'supplier', 'partner'].includes(r)
                          )) && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0"
                            title="B2B Vendor / Partner Trade"
                          >
                            B2B
                          </span>
                        )}
                      </div>

                      {/* Status */}
                      <div className="shrink-0">
                        {order.payment_status === 'refunded' ||
                        order.items.every(
                          (i) =>
                            i.inventory_unit?.status === 'returned' ||
                            i.inventory_unit?.status === 'returned_to_vendor'
                        ) ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            <Undo2 className="w-3 h-3" />
                            Refunded
                          </span>
                        ) : order.payment_status === 'paid' ||
                          netPayable -
                            (Number(order.paid_amount) || 0) -
                            (Number(order.write_off_amount) || 0) <=
                            0 ? (
                          order.payment_method === 'debt_offset' ? (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400"
                              title="Settled via B2B debt offset"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              B2B Offset
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Paid
                            </span>
                          )
                        ) : order.payment_status === 'partial' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3 h-3" />
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Credit
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom: IMEI / Date + Action buttons & Chevron */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      <div className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        {order.items.find((i) => i.inventory_unit?.imei_or_serial)?.inventory_unit?.imei_or_serial ? (
                          <span>{order.items.find((i) => i.inventory_unit?.imei_or_serial)?.inventory_unit?.imei_or_serial}</span>
                        ) : (
                          <span className="text-[10px] font-sans text-slate-400 font-normal">
                            {new Date(order.order_date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {canManageInv && (
                          returnableUnits.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleInitiateReturn(order)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 active:scale-95 cursor-pointer"
                              >
                                <Undo2 className="w-2.5 h-2.5" />
                                <span>Return</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInitiateSwap(order)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 active:scale-95 cursor-pointer"
                              >
                                <ArrowLeftRight className="w-2.5 h-2.5" />
                                <span>Swap</span>
                              </button>
                            </div>
                          ) : hasReturnedUnits ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              <Undo2 className="w-2.5 h-2.5" />
                              Returned
                            </span>
                          ) : null
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Shimmer cards while eager-loading next page */}
              {isLoadingMore && (
                <>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <SalesCardSkeleton key={`more-mob-skel-${i}`} />
                  ))}
                </>
              )}

              {/* Caught up message on mobile */}
              {!hasMore && sales.length > 0 && (
                <div className="py-3 text-center text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>All {sales.length} transactions loaded</span>
                </div>
              )}

              {/* Mobile sentinel */}
              <div ref={mobileSentinelRef} className="h-2 w-full pointer-events-none" />
            </>
          )}
        </div>
      </div>

      {/* Transaction Detail Workspace Drawer */}
      <SalesOrderDrawer
        order={selectedOrder}
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        user={user}
        tenant={tenant}
        onInitiateReturn={(order) => {
          setSelectedOrder(null);
          handleInitiateReturn(order);
        }}
        onInitiateSwap={(order) => {
          setSelectedOrder(null);
          handleInitiateSwap(order);
        }}
        onPaymentCollected={(updatedOrder) => {
          setSelectedOrder(updatedOrder);
          loadSales();
        }}
      />

      {/* Customer Return Modal (Responsive Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {returnTargetUnit && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-fade-in select-none">
          <div
            className="fixed inset-0"
            onClick={() => setReturnTargetUnit(null)}
          />
          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 sm:border-slate-100 sm:dark:border-slate-800 w-full sm:max-w-md p-5 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4 sm:space-y-4 shadow-2xl sm:shadow-xl max-h-[92vh] sm:max-h-none overflow-y-auto animate-bottom-sheet sm:animate-modal-enter flex flex-col">
            {/* Mobile Bottom Sheet Grab Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3.5 sm:pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-2 text-rose-600 dark:text-rose-400">
                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center shrink-0">
                  <Undo2 className="w-5 h-5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-sm tracking-tight">
                    Record Customer Return
                  </h3>
                  <p className="text-xs sm:text-[11px] text-slate-400 font-medium sm:font-normal">
                    Track device for repair, warranty, or inspection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnTargetUnit(null)}
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-3 rounded-2xl sm:rounded-xl bg-slate-50 dark:bg-slate-800/50 sm:dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 sm:border-slate-200/60 shrink-0 text-xs sm:text-xs">
              <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-xs">
                {returnTargetUnit.variant?.product?.name || 'Device'}
              </div>
              <div className="text-xs sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 sm:font-normal">
                Serial/IMEI: <strong className="text-slate-800 dark:text-slate-200 sm:font-normal">{returnTargetUnit.imei_or_serial || 'Standard stock'}</strong>
              </div>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4 sm:space-y-3.5 flex-1">
              <div>
                <label className="block text-sm sm:text-xs font-bold sm:font-semibold text-slate-800 sm:text-slate-700 dark:text-slate-200 sm:dark:text-slate-300 mb-1.5 sm:mb-1">
                  Reason for Return *
                </label>
                <input
                  type="text"
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Screen flickering, Battery drops rapidly, Defective mic"
                  className="w-full h-11 sm:h-10 px-3.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-700 sm:dark:border-slate-800 bg-white dark:bg-[#151b26] text-base sm:text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500/40 sm:focus:ring-slate-900/10 sm:dark:focus:ring-slate-700 transition-all shadow-2xs sm:shadow-none"
                />
                {/* Quick Reason Pills */}
                <div className="flex flex-wrap gap-1.5 mt-2.5 sm:mt-2">
                  {['Screen defect / touch issue', 'Battery draining fast', 'Camera / FaceID failure', 'Audio / Mic fault', 'Customer changed mind'].map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReturnReason(reason)}
                      className="px-2.5 sm:px-2 py-1 sm:py-0.5 rounded-xl sm:rounded-lg text-xs sm:text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 sm:text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/60 active:scale-95 transition-all cursor-pointer"
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm sm:text-xs font-bold sm:font-semibold text-slate-800 sm:text-slate-700 dark:text-slate-200 sm:dark:text-slate-300 mb-1.5 sm:mb-1">
                  Device Condition upon Return
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-full h-11 sm:h-10 px-3.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-700 sm:dark:border-slate-800 bg-white dark:bg-[#151b26] text-sm sm:text-xs font-semibold sm:font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs sm:shadow-none cursor-pointer"
                >
                  <option value="inspection_needed">Inspection Needed</option>
                  <option value="defective">Defective Hardware</option>
                  <option value="used_clean">Used Clean (Pristine)</option>
                  <option value="backcrack">Back Crack / Damage</option>
                </select>
              </div>

              {Boolean(
                returnTargetUnit.supplier_contact_id ||
                returnTargetUnit.source_type === 'consignment' ||
                returnTargetUnit.source_type === 'vendor_direct' ||
                returnTargetUnit.sales_order_item?.sourcing_type === 'brokered_neighbour'
              ) && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm sm:text-xs font-bold sm:font-semibold text-slate-800 sm:text-slate-700 dark:text-slate-200 sm:dark:text-slate-300">
                      Return Destination
                    </label>
                    <span className="text-[10px] font-bold sm:font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40">
                      Vendor Sourced
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-1.5 sm:p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl sm:rounded-xl text-xs sm:text-xs font-bold sm:font-semibold">
                    <button
                      type="button"
                      onClick={() => setReturnDestination('vendor')}
                      className={`py-2.5 sm:py-2 px-3 rounded-xl sm:rounded-lg transition-all cursor-pointer text-left ${
                        returnDestination === 'vendor'
                          ? 'bg-white dark:bg-[#131926] text-amber-600 dark:text-amber-400 shadow-xs font-bold ring-1 ring-amber-500/20'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div>Return to Vendor</div>
                      <div className="text-[11px] sm:text-[10px] font-normal opacity-75 mt-0.5">Cancels vendor payable</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReturnDestination('repair')}
                      className={`py-2.5 sm:py-2 px-3 rounded-xl sm:rounded-lg transition-all cursor-pointer text-left ${
                        returnDestination === 'repair'
                          ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div>Repair Shelf</div>
                      <div className="text-[11px] sm:text-[10px] font-normal opacity-75 mt-0.5">Keep in shop</div>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm sm:text-xs font-bold sm:font-semibold text-slate-800 sm:text-slate-700 dark:text-slate-200 sm:dark:text-slate-300 mb-1.5 sm:mb-1">
                  Notes
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Customer brought receipt, requested replacement or inspection"
                  rows={2}
                  className="w-full p-3 sm:p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 sm:dark:border-slate-800 bg-white dark:bg-[#151b26] text-sm sm:text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 shadow-2xs sm:shadow-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 sm:gap-2 pt-3 sm:pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReturnTargetUnit(null)}
                  className="w-full sm:w-auto h-11 sm:h-9 px-5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm sm:text-xs font-bold sm:font-semibold text-slate-700 sm:text-slate-600 dark:text-slate-300 sm:dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting || !returnReason.trim()}
                  className="w-full sm:w-auto h-11 sm:h-9 px-5 sm:px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm sm:text-xs font-bold sm:font-semibold shadow-md sm:shadow-sm shadow-rose-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-1.5 cursor-pointer flex-1 sm:flex-initial"
                >
                  {returnSubmitting ? <Loader2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 animate-spin" /> : <Undo2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />}
                  <span className="sm:hidden">Return</span>
                  <span className="hidden sm:inline">Confirm Customer Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Multi-Device Return Picker Modal (Responsive Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {multiReturnOrder && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-fade-in select-none">
          <div
            className="fixed inset-0"
            onClick={() => setMultiReturnOrder(null)}
          />
          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 sm:border-slate-100 sm:dark:border-slate-800 w-full sm:max-w-md p-5 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4 sm:space-y-4 shadow-2xl sm:shadow-xl max-h-[85vh] sm:max-h-none overflow-y-auto animate-bottom-sheet sm:animate-modal-enter flex flex-col">
            {/* Mobile Bottom Sheet Grab Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3.5 sm:pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-2 text-rose-600 dark:text-rose-400">
                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center shrink-0">
                  <Undo2 className="w-5 h-5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-sm tracking-tight">
                    Select Device to Return
                  </h3>
                  <p className="text-xs sm:text-[11px] text-slate-400 font-medium sm:font-normal">
                    Order #{multiReturnOrder.order_number} contains multiple devices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMultiReturnOrder(null)}
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 sm:space-y-2">
              <p className="text-xs sm:text-xs font-bold sm:font-normal text-slate-600 dark:text-slate-400">
                Choose the specific device the customer is returning:
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-xl overflow-hidden">
                {getReturnableUnits(multiReturnOrder).map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => {
                      const isVendor = Boolean(
                        unit.supplier_contact_id ||
                        unit.source_type === 'vendor_direct' ||
                        unit.source_type === 'consignment' ||
                        unit.sales_order_item?.sourcing_type === 'brokered_neighbour'
                      );
                      setReturnTargetUnit(unit);
                      setReturnDestination(isVendor ? 'vendor' : 'repair');
                      setReturnReason('');
                      setReturnCondition('inspection_needed');
                      setReturnNotes('');
                      setMultiReturnOrder(null);
                    }}
                    className="w-full p-3.5 sm:p-3 text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-xs group-hover:text-rose-600 dark:group-hover:text-rose-400">
                        {unit.variant?.product?.name || 'Device'}
                      </div>
                      <div className="text-xs sm:text-[11px] font-mono font-semibold sm:font-normal text-emerald-600 dark:text-emerald-400 mt-0.5">
                        SN: {unit.imei_or_serial || 'Unrecorded'}
                      </div>
                    </div>
                    <span className="text-xs sm:text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <span>Select</span>
                      <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 sm:pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMultiReturnOrder(null)}
                className="w-full sm:w-auto h-11 sm:h-9 px-5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm sm:text-xs font-bold sm:font-semibold text-slate-700 sm:text-slate-600 dark:text-slate-300 sm:dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Warranty Swap Modal */}
      <SwapDeviceModal
        isOpen={swapTargetUnit !== null}
        onClose={() => {
          setSwapTargetUnit(null);
          setSwapTargetOrder(null);
        }}
        oldUnit={swapTargetUnit}
        order={swapTargetOrder}
        onSwapSuccess={() => {
          loadSales();
        }}
      />

      {/* Multi-Item Swap Picker Modal (Responsive Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      {multiSwapOrder && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-fade-in select-none">
          <div
            className="fixed inset-0"
            onClick={() => setMultiSwapOrder(null)}
          />
          <div className="relative z-10 bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 sm:border-slate-100 sm:dark:border-slate-800 w-full sm:max-w-md p-5 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-5 space-y-4 max-h-[85vh] sm:max-h-none overflow-y-auto animate-bottom-sheet sm:animate-modal-enter shadow-2xl sm:shadow-xl flex flex-col">
            {/* Mobile Bottom Sheet Grab Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2 sm:hidden shrink-0" />

            <div className="flex items-center justify-between pb-3.5 sm:pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-2 text-slate-800 dark:text-slate-200">
                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-sm tracking-tight">
                    Select Device to Swap
                  </h3>
                  <p className="text-xs sm:text-[11px] text-slate-400 font-medium sm:font-normal">
                    Order #{multiSwapOrder.order_number} contains multiple devices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMultiSwapOrder(null)}
                className="w-8 h-8 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 sm:space-y-2 flex-1">
              <p className="text-xs sm:text-xs font-bold sm:font-normal text-slate-600 dark:text-slate-400">
                Choose the device the customer is returning for a warranty swap:
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-2xl sm:rounded-xl overflow-hidden">
                {getReturnableUnits(multiSwapOrder).map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => {
                      setSwapTargetUnit(unit);
                      setSwapTargetOrder(multiSwapOrder);
                      setMultiSwapOrder(null);
                    }}
                    className="w-full p-3.5 sm:p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {unit.variant?.product?.name || 'Device'}
                      </div>
                      <div className="text-xs sm:text-[11px] font-mono font-semibold sm:font-normal text-emerald-600 dark:text-emerald-400 mt-0.5">
                        SN: {unit.imei_or_serial || 'Unrecorded'}
                      </div>
                    </div>
                    <span className="text-xs sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span>Select</span>
                      <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 sm:pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMultiSwapOrder(null)}
                className="w-full sm:w-auto h-11 sm:h-9 px-5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm sm:text-xs font-bold sm:font-semibold text-slate-700 sm:text-slate-600 dark:text-slate-300 sm:dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
