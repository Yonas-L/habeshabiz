import React, { useState, useEffect } from 'react';
import type { InventoryUnit, Product, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { Plus, Search, Battery, Loader2, X } from 'lucide-react';

interface InventoryViewProps {
  user: User | null;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ user }) => {
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'in_stock' | 'sold' | 'all'>('in_stock');

  // Intake Modal
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

  // Handle Esc key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showIntakeModal) {
        setShowIntakeModal(false);
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

      toast.success('Inventory unit added to stock', {
        description: `IMEI: ${intakeImei || 'Not recorded'} • Cost: ${parseFloat(intakeCost).toLocaleString()} ETB`,
      });

      setShowIntakeModal(false);
      setIntakeImei('');
      setIntakeCost('');
      loadInventory();
    } catch (err: any) {
      toast.error('Failed to intake unit', { description: err.message });
    } finally {
      setIntakeSubmitting(false);
    }
  };

  const canViewCost = user?.can_view_costs ?? false;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Segmented Control */}
        <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('in_stock')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'in_stock'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            In Stock ({units.filter((u) => u.status === 'in_stock').length})
          </button>
          <button
            onClick={() => setStatusFilter('sold')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'sold'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sold
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All History
          </button>
        </div>

        {/* Search & Action */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Model, IMEI, condition..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 shadow-xs"
            />
          </form>

          <button
            onClick={() => setShowIntakeModal(true)}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2 shrink-0 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Stock Intake</span>
          </button>
        </div>
      </div>

      {/* Inventory Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Item Model & Variant</th>
                <th className="py-3 px-5 font-mono">IMEI / Serial</th>
                <th className="py-3 px-5">Battery & Health</th>
                <th className="py-3 px-5">SIM Type</th>
                <th className="py-3 px-5">Physical Condition</th>
                {canViewCost && <th className="py-3 px-5 text-right">Cost Basis</th>}
                <th className="py-3 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
                      <span>Loading inventory records...</span>
                    </div>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    No serialized inventory units found. Click "+ Stock Intake" to add devices.
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 text-sm">
                        {unit.variant?.product?.name || 'Device Unit'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {[unit.variant?.storage, unit.variant?.color].filter(Boolean).join(' &bull; ') || 'Standard'}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 font-mono text-slate-800 font-medium">
                      {unit.imei_or_serial || <span className="text-slate-400 font-sans italic">Not recorded</span>}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        <Battery className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold text-slate-900 font-mono">
                          {unit.battery_health ? `${unit.battery_health}%` : 'N/A'}
                        </span>
                        {unit.cycle_count !== null && (
                          <span className="text-[10px] text-slate-400 font-mono">({unit.cycle_count}cc)</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 uppercase font-mono">
                        {unit.sim_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 capitalize text-slate-600 font-medium">
                      {unit.condition.replace(/_/g, ' ')}
                    </td>

                    {canViewCost && (
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900">
                        {Number(unit.cost_basis).toLocaleString()} ETB
                      </td>
                    )}

                    <td className="py-3.5 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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

      {/* Tactile Modal for Stock Intake */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs animate-backdrop-enter"
            onClick={() => setShowIntakeModal(false)}
          />

          <div className="relative z-10 bg-white rounded-2xl border border-slate-100 shadow-2xl ring-1 ring-black/5 max-w-lg w-full p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Stock Intake (New Serialized Device)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Record serial IMEI, battery health, and purchase cost</p>
              </div>
              <button
                onClick={() => setShowIntakeModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIntakeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Variant</label>
                <select
                  value={intakeVariantId}
                  onChange={(e) => setIntakeVariantId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">IMEI or Serial Number</label>
                  <input
                    type="text"
                    value={intakeImei}
                    onChange={(e) => setIntakeImei(e.target.value)}
                    placeholder="e.g. 354868698..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purchase Cost (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={intakeCost}
                    onChange={(e) => setIntakeCost(e.target.value)}
                    placeholder="e.g. 145000"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Battery %</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={intakeBattery}
                    onChange={(e) => setIntakeBattery(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Cycle Count</label>
                  <input
                    type="number"
                    min="0"
                    value={intakeCycles}
                    onChange={(e) => setIntakeCycles(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">SIM Type</label>
                  <select
                    value={intakeSim}
                    onChange={(e) => setIntakeSim(e.target.value as any)}
                    className="w-full h-10 px-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900"
                  >
                    <option value="physical">Physical SIM</option>
                    <option value="esim">eSIM</option>
                    <option value="dual">Dual SIM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Physical Condition</label>
                <select
                  value={intakeCondition}
                  onChange={(e) => setIntakeCondition(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900"
                >
                  <option value="new">Brand New (Sealed)</option>
                  <option value="used_clean">Used Clean (Pristine)</option>
                  <option value="used_minor_scratches">Used Minor Scratches</option>
                  <option value="backcrack">Back Crack</option>
                  <option value="demo_locked">Demo / Locked</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel (Esc)
                </button>
                <button
                  type="submit"
                  disabled={intakeSubmitting}
                  className="h-10 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm active:scale-[0.98]"
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
