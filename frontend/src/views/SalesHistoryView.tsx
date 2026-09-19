import React, { useState, useEffect } from 'react';
import type { SalesOrder, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Search, ArrowRightLeft, UserCheck, Loader2 } from 'lucide-react';

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

  return (
    <div className="space-y-5">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Segmented Control */}
        <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200/60 text-xs">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              statusFilter === '' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Orders ({sales.length})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              statusFilter === 'paid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fully Paid
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              statusFilter === 'unpaid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Credit (Unpaid)
          </button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </form>
      </div>

      {/* Orders Table (Clean, no card nesting) */}
      <div className="bg-white rounded-lg border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-medium">
              <tr>
                <th className="py-2.5 px-4">Order # & Date</th>
                <th className="py-2.5 px-4">Customer & Salesperson</th>
                <th className="py-2.5 px-4">Items Sold</th>
                <th className="py-2.5 px-4">Sourcing Channel</th>
                <th className="py-2.5 px-4 text-right">Selling Price</th>
                {canViewCost && <th className="py-2.5 px-4 text-right">Gross Profit</th>}
                <th className="py-2.5 px-4 text-center">Status</th>
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
                    No sales recorded yet.
                  </td>
                </tr>
              ) : (
                sales.map((order) => {
                  const isBrokered = order.items.some((i) => i.sourcing_type === 'brokered_neighbour');
                  const orderProfit = order.items.reduce((sum, i) => sum + parseFloat(String(i.profit || '0')), 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-semibold text-slate-900">{order.order_number}</div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          {new Date(order.order_date).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {order.customer?.name || <span className="text-slate-400 italic font-normal">Walk-in Customer</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <UserCheck className="w-3 h-3 text-slate-400" />
                          <span>Rep: {order.salesperson?.name || 'Shop'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="font-medium text-slate-800">
                            {item.quantity}x {item.variant?.product?.name} ({item.variant?.storage || 'Standard'})
                          </div>
                        ))}
                      </td>

                      <td className="py-3 px-4">
                        {isBrokered ? (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200/60">
                            <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                            <span>Brokered ({order.items[0]?.vendor_contact?.name || 'Peer'})</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            Our Stock
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        {Number(order.total_amount).toLocaleString()} ETB
                      </td>

                      {canViewCost && (
                        <td className="py-3 px-4 text-right font-mono font-medium text-emerald-700">
                          +{orderProfit.toLocaleString()} ETB
                        </td>
                      )}

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                            order.payment_status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/50'
                          }`}
                        >
                          {order.payment_status.replace(/_/g, ' ')}
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
