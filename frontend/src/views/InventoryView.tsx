import React, { useState, useEffect } from 'react';
import type { InventoryUnit, Product, User } from '../api/client';
import { api } from '../api/client';
import { Plus, Search, Battery } from 'lucide-react';

interface InventoryViewProps {
  user: User | null;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ user }) => {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'in_stock' | 'sold' | 'all'>('in_stock');

  // Intake Drawer
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeVariantId, setIntakeVariantId] = useState('');
  const [intakeImei, setIntakeImei] = useState('');
  const [intakeBattery, setIntakeBattery] = useState('100');
  const [intakeCycles, setIntakeCycles] = useState('0');
  const [intakeSim, setIntakeSim] = useState<'physical' | 'esim' | 'dual'>('physical');
  const [intakeCondition, setIntakeCondition] = useState('new');
  const [intakeCost, setIntakeCost] = useState('');
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [statusFilter]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const [u, p] = await Promise.all([
        api.getInventoryUnits({ status: statusFilter === 'all' ? undefined : statusFilter, search }),
        api.getProducts(),
      ]);
      setUnits(u);
      setProducts(p);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInventory();
  };

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeVariantId || !intakeCost) return;

    try {
      setIntakeSubmitting(true);
      await api.intakeInventoryUnit({
        variant_id: intakeVariantId,
        imei_or_serial: intakeImei || null,
        battery_health: intakeBattery ? parseInt(intakeBattery) : null,
        cycle_count: intakeCycles ? parseInt(intakeCycles) : null,
        sim_type: intakeSim,
        condition: intakeCondition,
        cost_basis: parseFloat(intakeCost),
      });

      setShowIntakeModal(false);
      setIntakeImei('');
      setIntakeCost('');
      loadInventory();
    } catch (err: any) {
      alert(err.message || 'Failed to intake inventory.');
    } finally {
      setIntakeSubmitting(false);
    }
  };

  const canViewCost = user?.can_view_costs ?? false;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-900 text-lg">Inventory & Serialized Tracking</h2>
          <p className="text-xs text-slate-500">Track IMEI, battery health, cycle counts, and physical phone condition</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs">
            <button
              onClick={() => setStatusFilter('in_stock')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'in_stock' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              In Stock ({units.filter((u) => u.status === 'in_stock').length})
            </button>
            <button
              onClick={() => setStatusFilter('sold')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'sold' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Sold
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              All
            </button>
          </div>

          <button
            onClick={() => setShowIntakeModal(true)}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Stock Intake</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Model, IMEI, condition, or color..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
          />
        </div>
        <button
          type="submit"
          className="px-4 h-10 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Inventory Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-medium">
              <tr>
                <th className="py-3 px-4">Item & Variant</th>
                <th className="py-3 px-4">IMEI / Serial</th>
                <th className="py-3 px-4">Battery & Cycles</th>
                <th className="py-3 px-4">SIM & Specs</th>
                <th className="py-3 px-4">Condition</th>
                {canViewCost && <th className="py-3 px-4 text-right">Cost Basis</th>}
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading inventory...
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No serialized inventory units found. Click "+ Stock Intake" to add items.
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {unit.variant?.product?.name || 'Electronics Unit'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {[unit.variant?.storage, unit.variant?.color].filter(Boolean).join(' • ') || 'Standard'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-800">
                      {unit.imei_or_serial || <span className="text-slate-400 font-sans italic">Not recorded</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Battery className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-900">
                          {unit.battery_health ? `${unit.battery_health}%` : 'N/A'}
                        </span>
                        {unit.cycle_count !== null && (
                          <span className="text-[10px] text-slate-400 font-mono">({unit.cycle_count}cc)</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 uppercase">
                        {unit.sim_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 capitalize text-slate-600">
                      {unit.condition.replace('_', ' ')}
                    </td>

                    {canViewCost && (
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-900">
                        {Number(unit.cost_basis).toLocaleString()} ETB
                      </td>
                    )}

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          unit.status === 'in_stock'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {unit.status === 'in_stock' ? 'In Stock' : 'Sold'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Intake Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Stock Intake (New Serialized Unit)</h3>
              <button
                onClick={() => setShowIntakeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Select Variant</label>
                <select
                  value={intakeVariantId}
                  onChange={(e) => setIntakeVariantId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  required
                >
                  <option value="">-- Choose Product Variant --</option>
                  {products.flatMap((p) =>
                    p.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {p.name} - {[v.storage, v.color].filter(Boolean).join(' ')}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">IMEI or Serial</label>
                  <input
                    type="text"
                    value={intakeImei}
                    onChange={(e) => setIntakeImei(e.target.value)}
                    placeholder="e.g. 354868698..."
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Purchase Cost (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={intakeCost}
                    onChange={(e) => setIntakeCost(e.target.value)}
                    placeholder="e.g. 145000"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Battery %</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={intakeBattery}
                    onChange={(e) => setIntakeBattery(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Cycle Count</label>
                  <input
                    type="number"
                    min="0"
                    value={intakeCycles}
                    onChange={(e) => setIntakeCycles(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">SIM Type</label>
                  <select
                    value={intakeSim}
                    onChange={(e) => setIntakeSim(e.target.value as any)}
                    className="w-full h-9 px-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900"
                  >
                    <option value="physical">Physical SIM</option>
                    <option value="esim">eSIM</option>
                    <option value="dual">Dual SIM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Condition</label>
                <select
                  value={intakeCondition}
                  onChange={(e) => setIntakeCondition(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900"
                >
                  <option value="new">Brand New (Sealed)</option>
                  <option value="used_clean">Used Clean (Pristine)</option>
                  <option value="used_minor_scratches">Used Minor Scratches</option>
                  <option value="backcrack">Back Crack</option>
                  <option value="demo_locked">Demo / Locked</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={intakeSubmitting}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {intakeSubmitting ? 'Saving...' : 'Add Unit to Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
