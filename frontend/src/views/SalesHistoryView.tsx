import React, { useState, useEffect } from 'react';
import type { SalesOrder, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  Search,
  ArrowRightLeft,
  UserCheck,
  Loader2,
  ShoppingBag,
  TrendingUp,
  Layers,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { MiniSparkline, MiniBarHistogram } from '../components/Charts';

interface SalesHistoryViewProps {
  user: User | null;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ user }) => {
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadSales();
  }, [statusFilter]);

  const loadSales = async () => {
    try {
      setLoading(true);
      const res = await api.getSales({ payment_status: statusFilter || undefined, search });
      setSales(res);
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

  const canViewCost = user?.can_view_costs ?? false;

  const totalVolume = sales.reduce((sum, s) => sum + parseFloat(String(s.total_amount)), 0);
  const totalProfit = sales.reduce((sum, s) => {
    const orderProfit = s.items.reduce((pSum, i) => pSum + parseFloat(String(i.profit || '0')), 0);
    return sum + orderProfit;
  }, 0);

  const brokeredOrdersCount = sales.filter((s) =>
    s.items.some((i) => i.sourcing_type === 'brokered_neighbour')
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Volume */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Gross Sales Volume
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-slate-700" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
              {totalVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
              <span className="text-xs font-bold text-slate-400">ETB</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">{sales.length} Orders Recorded</span>
            <MiniSparkline values={[45, 52, 60, 58, 68, 75, 82]} color="indigo" />
          </div>
        </div>

        {/* 2. Realized Gross Profit (Masked for salespersons) */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Realized Profit
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono tracking-tight mt-2">
              {canViewCost ? (
                <>
                  +{totalProfit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}{' '}
                  <span className="text-xs font-bold text-emerald-600">ETB</span>
                </>
              ) : (
                <span className="text-slate-400 text-lg font-sans font-medium">Confidential</span>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">
              {canViewCost
                ? `${((totalProfit / (totalVolume || 1)) * 100).toFixed(1)}% Avg. Margin`
                : 'Owner role only'}
            </span>
            <MiniSparkline values={[15, 18, 22, 21, 26, 28, 32]} color="emerald" />
          </div>
        </div>

        {/* 3. Brokered vs Shop Stock */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Brokered Items
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
              {brokeredOrdersCount}{' '}
              <span className="text-xs font-bold text-slate-400">Orders</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">Sourced from neighbours</span>
            <MiniBarHistogram values={[2, 4, 3, 5, 2, 6, 4]} color="amber" />
          </div>
        </div>

        {/* 4. Payment Fulfillment Rate */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Fulfillment Status
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Layers className="w-4 h-4 text-slate-700" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-2">
              {sales.filter((s) => s.payment_status === 'paid').length} / {sales.length}{' '}
              <span className="text-xs font-bold text-slate-400">Paid</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between">
            <span className="text-[11px] text-slate-400 font-medium">
              {sales.length > 0
                ? `${Math.round((sales.filter((s) => s.payment_status === 'paid').length / sales.length) * 100)}% Settled`
                : '100%'}
            </span>
            <MiniBarHistogram values={[8, 12, 10, 14, 15, 18, 20]} color="emerald" />
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Segmented Control */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === ''
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All Orders ({sales.length})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'paid'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Fully Paid
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'unpaid'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Credit (Unpaid)
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, rep..."
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 shadow-xs"
          />
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Order # & Date</th>
                <th className="py-3 px-5">Customer & Salesperson</th>
                <th className="py-3 px-5">Items Sold</th>
                <th className="py-3 px-5">Sourcing Channel</th>
                <th className="py-3 px-5 text-right">Selling Price</th>
                {canViewCost && <th className="py-3 px-5 text-right">Gross Profit</th>}
                <th className="py-3 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                      <span>Loading sales history...</span>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    No sales orders found matching criteria.
                  </td>
                </tr>
              ) : (
                sales.map((order) => {
                  const isBrokered = order.items.some((i) => i.sourcing_type === 'brokered_neighbour');
                  const orderProfit = order.items.reduce(
                    (sum, i) => sum + parseFloat(String(i.profit || '0')),
                    0
                  );
                  const customerInitials = order.customer?.name
                    ? order.customer.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : 'WK';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-mono">
                        <div className="font-bold text-slate-900 text-sm">{order.order_number}</div>
                        <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                          {new Date(order.order_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200/60">
                            {customerInitials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm leading-tight">
                              {order.customer?.name || (
                                <span className="text-slate-400 italic font-normal">Walk-in Customer</span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <UserCheck className="w-3 h-3 text-slate-400" />
                              <span>Rep: {order.salesperson?.name || 'Shop'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="font-medium text-slate-800 text-xs">
                              <span className="font-bold text-slate-900">{item.quantity}x</span>{' '}
                              {item.variant?.product?.name}{' '}
                              <span className="text-slate-400">
                                ({[item.variant?.storage, item.variant?.color].filter(Boolean).join(' ') || 'Standard'})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        {isBrokered ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200/70">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                            <span>Brokered ({order.items[0]?.vendor_contact?.name || 'Neighbour'})</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700">
                            Shop Stock
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 text-sm">
                        {Number(order.total_amount).toLocaleString()} ETB
                      </td>

                      {canViewCost && (
                        <td className="py-3.5 px-5 text-right font-mono font-bold text-emerald-700 text-sm">
                          +{orderProfit.toLocaleString()} ETB
                        </td>
                      )}

                      <td className="py-3.5 px-5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            order.payment_status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/50'
                          }`}
                        >
                          {order.payment_status === 'paid' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-600" />
                          )}
                          {order.payment_status === 'paid' ? 'Fully Paid' : 'Credit Unpaid'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
