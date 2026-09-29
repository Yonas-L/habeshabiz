import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { Pagination } from '../components/Pagination';
import { SalesOrderDrawer } from '../components/drawers/SalesOrderDrawer';
import { SwapDeviceModal } from '../components/inventory/SwapDeviceModal';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';

interface SalesHistoryViewProps {
  user: User | null;
  tenant?: Tenant | null;
  initialSelectedOrder?: SalesOrder | null;
  onClearInitialContext?: () => void;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  user,
  tenant,
  initialSelectedOrder,
  onClearInitialContext,
}) => {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [counts, setCounts] = useState<{ all: number; paid: number; credit: number; exchange: number }>({
    all: 0,
    paid: 0,
    credit: 0,
    exchange: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);

  // Customer Return Modal State (matching stock sold page)
  const isOwner = user?.role === 'owner';
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

  useEffect(() => {
    loadSales();
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    if (initialSelectedOrder) {
      setSelectedOrder(initialSelectedOrder);
      onClearInitialContext?.();
    }
  }, [initialSelectedOrder, onClearInitialContext]);

  const loadSales = async (searchOverride?: string) => {
    try {
      setLoading(true);
      setCurrentPage(1);
      const activeSearch = searchOverride !== undefined ? searchOverride : search;
      const res = await api.getSalesWithCounts({
        payment_status: statusFilter || undefined,
        source_type: sourceFilter || undefined,
        search: activeSearch.trim() || undefined,
      });
      setSales(res.sales);
      if (res.counts) {
        setCounts(res.counts);
      }
    } catch (err: any) {
      toast.error('Failed to load sales history', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

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
      setReturnTargetUnit(returnable[0]);
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
      loadSales();
    } catch (err: any) {
      toast.error('Failed to process customer return', { description: err.message });
    } finally {
      setReturnSubmitting(false);
    }
  };

  const canViewCost = user?.can_view_costs ?? false;

  const totalVolume = sales.reduce((sum, s) => {
    const gross = parseFloat(String(s.total_amount)) || 0;
    const disc = parseFloat(String(s.discount_amount || '0')) || 0;
    return sum + Math.max(0, gross - disc);
  }, 0);

  const totalProfit = sales.reduce((sum, s) => {
    const orderProfit = s.items.reduce((pSum, i) => pSum + parseFloat(String(i.profit || '0')), 0);
    return sum + orderProfit;
  }, 0);

  const brokeredOrdersCount = sales.filter((s) =>
    s.items.some((i) => i.sourcing_type === 'brokered_neighbour')
  ).length;

  const tradeInCount = sales.filter((s) => Number(s.exchange_allowance || 0) > 0).length;

  if (loading && sales.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  return (
    <div className="space-y-4 animate-page-enter">
      {/* Sleek KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-100 dark:border-slate-800/80 p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Volume</div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
            <AnimatedNumber value={totalVolume} />
            <span className="text-[10px] font-medium text-slate-400 font-sans ml-1">ETB</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {sales.length} order{sales.length !== 1 ? 's' : ''} total
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-100 dark:border-slate-800/80 p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Profit</div>
          <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {canViewCost ? (
              <>
                +<AnimatedNumber value={totalProfit} />
                <span className="text-[10px] font-medium text-emerald-500 font-sans ml-1">ETB</span>
              </>
            ) : (
              <span className="text-slate-400 text-sm font-sans font-medium">Restricted</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {canViewCost ? `${((totalProfit / (totalVolume || 1)) * 100).toFixed(1)}% margin` : 'Owner only'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-100 dark:border-slate-800/80 p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Settled</div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
            {sales.filter((s) => s.payment_status === 'paid').length}
            <span className="text-xs font-normal text-slate-400 font-mono"> of {sales.length}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {sales.length > 0
              ? `${Math.round((sales.filter((s) => s.payment_status === 'paid').length / sales.length) * 100)}% settled`
              : '100%'}
          </div>
        </div>

        <div className="bg-white dark:bg-[#131926] rounded-xl border border-slate-100 dark:border-slate-800/80 p-3.5 shadow-2xs">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sourcing</div>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-white tabular-nums mt-0.5">
            {brokeredOrdersCount}
            <span className="text-[10px] font-medium text-slate-400 font-sans ml-1">brokered</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {tradeInCount > 0 ? `${tradeInCount} trade-in${tradeInCount > 1 ? 's' : ''}` : 'Direct shop stock'}
          </div>
        </div>
      </div>

      {/* Filter Segmented Control & Search Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold shadow-2xs">
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
                loadSales('');
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
                loadSales('');
              }}
              className="absolute right-2.5 top-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Orders Table — High-contrast, clean ledger */}
      <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800/80 overflow-hidden shadow-2xs">
        {/* Desktop Table (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Order</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Customer</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap">Model</th>
                <th className="py-2.5 px-3.5 whitespace-nowrap font-mono">IMEI</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Total</th>
                <th className="py-2.5 px-3.5 text-center whitespace-nowrap">Status</th>
                {isOwner && <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Action</th>}
                <th className="py-2.5 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={isOwner ? 8 : 7} className="py-8 text-center">
                    <CustomPageLoader mode="app" fullScreen={false} />
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 8 : 7} className="py-16 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-400">No sales found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Completed checkout orders will appear here.</p>
                  </td>
                </tr>
              ) : (
                sales.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((order) => {
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
                      {/* Col 1: Order */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {order.order_number}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(order.order_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Col 2: Customer */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white text-xs truncate max-w-[130px]">
                          {order.customer?.name || <span className="text-slate-400 font-normal italic">Walk-in</span>}
                        </div>
                        {order.customer?.phone && (
                          <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                            {order.customer.phone}
                          </div>
                        )}
                      </td>

                      {/* Col 3: Model */}
                      <td className="py-2.5 px-3.5">
                        <div className="space-y-1 max-w-[240px]">
                          {order.items.map((item, idx) => {
                            const pName = item.variant?.product?.name || 'Device';
                            const spec = [item.variant?.storage, item.variant?.color].filter(Boolean).join(' • ');
                            const unit = item.inventory_unit;
                            const isReturned = unit?.status === 'returned';
                            const isSwapped = Boolean(unit?.swapped_from_unit_id || unit?.is_swapped);
                            const isExchanged = unit?.source_type === 'exchange' || Boolean(unit?.exchange_sales_order_id);

                            return (
                              <div key={idx} className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate flex items-center gap-1.5">
                                  {item.quantity > 1 && (
                                    <span className="font-mono text-slate-500 font-normal text-[11px]">
                                      {item.quantity}×
                                    </span>
                                  )}
                                  <span className="truncate">{pName}</span>
                                  {isSwapped && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/50 shrink-0">
                                      <ArrowLeftRight className="w-2.5 h-2.5" />
                                      Swapped
                                    </span>
                                  )}
                                  {isReturned && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/50 shrink-0">
                                      <Undo2 className="w-2.5 h-2.5" />
                                      Returned
                                    </span>
                                  )}
                                  {!isReturned && !isSwapped && isExchanged && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/50 shrink-0">
                                      <Repeat className="w-2.5 h-2.5" />
                                      Trade-In
                                    </span>
                                  )}
                                </div>
                                {spec && (
                                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                    {spec}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {exchange > 0 && (
                            <div className="mt-1 pt-1 border-t border-purple-100 dark:border-purple-900/40 flex items-center gap-1 text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                              <Repeat className="w-3 h-3 text-purple-500 shrink-0" />
                              <span className="truncate">
                                Trade-In: {order.exchange_unit?.variant?.product?.name || 'Device'}
                                {order.exchange_unit?.imei_or_serial ? ` (${order.exchange_unit.imei_or_serial})` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Col 4: IMEI */}
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

                      {/* Col 5: Total */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {gross.toLocaleString()} <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                        </div>
                        {exchange > 0 ? (
                          <div className="text-[10px] text-purple-700 dark:text-purple-300 font-mono mt-0.5">
                            {netPayable.toLocaleString()} cash + {exchange.toLocaleString()} trade
                          </div>
                        ) : disc > 0 ? (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                            −{disc.toLocaleString()} disc ({netPayable.toLocaleString()} net)
                          </div>
                        ) : null}
                      </td>

                      {/* Col 6: Status (Border-free minimal colored text) */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {order.payment_status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Credit
                          </span>
                        )}
                      </td>

                      {/* Col 7: Action */}
                      {isOwner && (
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
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Native Cards (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="py-6 text-center">
              <CustomPageLoader mode="app" fullScreen={false} />
            </div>
          ) : sales.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">No sales found</p>
              <p className="text-xs text-slate-400 mt-0.5">Completed checkout orders will appear here.</p>
            </div>
          ) : (
            sales.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((order) => {
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
                  className="p-4 space-y-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors cursor-pointer active:bg-slate-100 dark:active:bg-slate-800/50"
                >
                  {/* Card Header: Order # + Date + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {order.order_number}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(order.order_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })} • {order.customer?.name || 'Walk-in'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-base text-slate-900 dark:text-white">
                        {gross.toLocaleString()} <span className="text-[10px] font-normal text-slate-400 font-sans">ETB</span>
                      </div>
                      {exchange > 0 ? (
                        <div className="text-[10px] text-purple-700 dark:text-purple-300 font-mono mt-0.5">
                          {netPayable.toLocaleString()} cash + {exchange.toLocaleString()} trade
                        </div>
                      ) : disc > 0 ? (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                          −{disc.toLocaleString()} disc ({netPayable.toLocaleString()} net)
                        </div>
                      ) : null}
                      <div className="mt-1">
                        {order.payment_status === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            Credit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sold Items Summary */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100/80 dark:border-slate-800/50">
                    {order.items.map((item, idx) => {
                      const pName = item.variant?.product?.name || 'Device';
                      const spec = [item.variant?.storage, item.variant?.color].filter(Boolean).join(' • ');
                      const imei = item.inventory_unit?.imei_or_serial;

                      return (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                              {item.quantity > 1 ? `${item.quantity}× ` : ''}{pName}
                            </span>
                            {spec && <span className="text-[10px] text-slate-400 block">{spec}</span>}
                          </div>
                          {imei && (
                            <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {imei}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {exchange > 0 && (
                      <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1 pt-0.5">
                        <Repeat className="w-3 h-3 text-purple-500 shrink-0" />
                        <span>Trade-In allowance: {exchange.toLocaleString()} ETB</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Chevron Footer */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-[11px] text-slate-400">
                      {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {isOwner && (
                        returnableUnits.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleInitiateReturn(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/50 border border-rose-200/60 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 active:scale-95"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>Return</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInitiateSwap(order)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 active:scale-95"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>Swap</span>
                            </button>
                          </>
                        ) : hasReturnedUnits ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            <Undo2 className="w-2.5 h-2.5" />
                            Returned
                          </span>
                        ) : null
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 ml-1" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="px-5 pb-4">
          <Pagination
            currentPage={currentPage}
            totalItems={sales.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Transaction Detail Workspace Drawer */}
      <SalesOrderDrawer
        order={selectedOrder}
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        user={user}
        tenant={tenant}
        onPaymentCollected={(updatedOrder) => {
          setSelectedOrder(updatedOrder);
          loadSales();
        }}
      />

      {/* Customer Return Modal (Exact parity with Stock Sold page) */}
      {returnTargetUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center">
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
                type="button"
                onClick={() => setReturnTargetUnit(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {returnTargetUnit.variant?.product?.name || 'Device'}
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
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Customer brought receipt, requested replacement or inspection"
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReturnTargetUnit(null)}
                  className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={returnSubmitting || !returnReason.trim()}
                  className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {returnSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                  <span>Confirm Customer Return</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Device Return Picker Modal */}
      {multiReturnOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center">
                  <Undo2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Select Device to Return
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Order #{multiReturnOrder.order_number} contains multiple devices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMultiReturnOrder(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Choose the specific device the customer is returning:
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                {getReturnableUnits(multiReturnOrder).map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => {
                      setReturnTargetUnit(unit);
                      setReturnReason('');
                      setReturnCondition('inspection_needed');
                      setReturnNotes('');
                      setMultiReturnOrder(null);
                    }}
                    className="w-full p-3 text-left hover:bg-rose-50/50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white text-xs group-hover:text-rose-600 dark:group-hover:text-rose-400">
                        {unit.variant?.product?.name || 'Device'}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                        SN: {unit.imei_or_serial || 'Unrecorded'}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <span>Select</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMultiReturnOrder(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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

      {/* Multi-Item Swap Picker Modal */}
      {multiSwapOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Select Device to Swap
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Order #{multiSwapOrder.order_number} has multiple items
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMultiSwapOrder(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Which device does the customer want to swap?
              </label>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                {getReturnableUnits(multiSwapOrder).map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    onClick={() => {
                      setSwapTargetUnit(unit);
                      setSwapTargetOrder(multiSwapOrder);
                      setMultiSwapOrder(null);
                    }}
                    className="w-full p-3 text-left hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white text-xs group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {unit.variant?.product?.name || 'Device'}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                        SN: {unit.imei_or_serial || 'Unrecorded'}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <span>Select</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMultiSwapOrder(null)}
                className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
