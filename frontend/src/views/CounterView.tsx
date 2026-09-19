import React, { useState, useEffect } from 'react';
import type { Product, InventoryUnit, Contact, FinancialAccount, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import { ShoppingBag, ArrowRightLeft, Loader2 } from 'lucide-react';

interface CounterViewProps {
  user: User | null;
  accounts: FinancialAccount[];
  contacts: Contact[];
  onSaleSuccess: () => void;
}

export const CounterView: React.FC<CounterViewProps> = ({ user, accounts, contacts, onSaleSuccess }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [availableUnits, setAvailableUnits] = useState<InventoryUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [sourcingType, setSourcingType] = useState<'internal_stock' | 'brokered_neighbour'>('internal_stock');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  // Brokered details
  const [vendorContactId, setVendorContactId] = useState<string>('');
  const [vendorCost, setVendorCost] = useState<string>('');

  // Pricing & Payment
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('telebirr');
  const [financialAccountId, setFinancialAccountId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, units] = await Promise.all([
        api.getProducts(),
        api.getInventoryUnits({ status: 'in_stock' }),
      ]);
      setProducts(prods);
      setAvailableUnits(units);

      const defaultAcc = accounts.find((a) => a.type === 'mobile_money' || a.type === 'cash');
      if (defaultAcc) {
        setFinancialAccountId(defaultAcc.id);
      }
    } catch (err: any) {
      toast.error('Failed to load inventory for sales');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const variants = selectedProduct?.variants || [];
  const unitsForVariant = availableUnits.filter((u) => u.variant_id === selectedVariantId);

  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    setSelectedUnitId('');
    const v = variants.find((item) => item.id === variantId);
    if (v?.default_selling_price) {
      const priceStr = String(v.default_selling_price);
      setSellingPrice(priceStr);
      setPaidAmount(priceStr);
    }
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      toast.error('Please select a product and variant');
      return;
    }

    const priceNum = parseFloat(sellingPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Please enter a valid customer selling price');
      return;
    }

    if (sourcingType === 'brokered_neighbour') {
      if (!vendorContactId) {
        toast.error('Please select the peer merchant where device is sourced');
        return;
      }
      const costNum = parseFloat(vendorCost);
      if (isNaN(costNum) || costNum <= 0) {
        toast.error('Please enter the agreed peer merchant purchase cost');
        return;
      }
    }

    try {
      setSubmitting(true);
      const paidNum = parseFloat(paidAmount || '0');
      const discountNum = parseFloat(discountAmount || '0');

      const salePayload = {
        customer_id: customerId || null,
        discount_amount: discountNum,
        paid_amount: paidNum,
        payment_method: paymentMethod,
        financial_account_id: paidNum > 0 ? financialAccountId : null,
        notes: notes || null,
        items: [
          {
            variant_id: selectedVariantId,
            inventory_unit_id: sourcingType === 'internal_stock' ? (selectedUnitId || null) : null,
            quantity: 1,
            unit_price: priceNum,
            sourcing_type: sourcingType,
            vendor_contact_id: sourcingType === 'brokered_neighbour' ? vendorContactId : null,
            vendor_cost: sourcingType === 'brokered_neighbour' ? parseFloat(vendorCost) : null,
          },
        ],
      };

      const order = await api.recordSale(salePayload);

      toast.success(`Sale recorded! Order #${order.order_number}`, {
        description:
          sourcingType === 'brokered_neighbour'
            ? 'Brokered profit booked & payable recorded for peer merchant.'
            : 'Internal inventory deducted & ledger updated.',
      });

      // Reset form
      setSelectedProductId('');
      setSelectedVariantId('');
      setSelectedUnitId('');
      setSellingPrice('');
      setPaidAmount('');
      setDiscountAmount('0');
      setVendorCost('');
      setNotes('');
      loadData();
      onSaleSuccess();
    } catch (err: any) {
      toast.error('Failed to record sale', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const peerMerchants = contacts.filter((c) => c.roles.includes('peer_vendor') || c.roles.includes('supplier'));
  const customerList = contacts.filter((c) => c.roles.includes('customer') || c.roles.includes('debtor'));

  if (loading && products.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
        <span>Loading catalog and inventory items...</span>
      </div>
    );
  }

  const brokeredProfit =
    sourcingType === 'brokered_neighbour' && sellingPrice && vendorCost
      ? parseFloat(sellingPrice) - parseFloat(vendorCost)
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-page-enter">
      <div className="bg-white dark:bg-[#131926] rounded-3xl border border-slate-200/80 dark:border-slate-800/90 p-6 sm:p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)]">
        {/* Header & Sourcing Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">Sales Entry</h2>
              {user && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  Rep: {user.name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              Record sales for shop stock or brokered items
            </p>
          </div>

          {/* Sourcing Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSourcingType('internal_stock')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                sourcingType === 'internal_stock'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Shop Inventory
            </button>
            <button
              type="button"
              onClick={() => setSourcingType('brokered_neighbour')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                sourcingType === 'brokered_neighbour'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Brokered (Peer Shop)</span>
              <span className={`w-1.5 h-1.5 rounded-full ${sourcingType === 'brokered_neighbour' ? 'bg-white' : 'bg-amber-500'}`} />
            </button>
          </div>
        </div>

        {/* Brokered Sourcing Info Notice */}
        {sourcingType === 'brokered_neighbour' && (
          <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
            <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Brokered Sourcing Active:</span> Sourced from a peer shop (e.g. Mekdi, Yenus). Does not touch your internal inventory and automatically generates a payable debt in the ledger.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitSale} className="space-y-5 pt-6">
          {/* 1. Product & Variant Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Product Model
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setSelectedVariantId('');
                  setSelectedUnitId('');
                }}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700"
                required
              >
                <option value="">-- Select Device or Item --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Specification & Color
              </label>
              <select
                value={selectedVariantId}
                onChange={(e) => handleVariantChange(e.target.value)}
                disabled={!selectedProductId}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-700 disabled:opacity-50"
                required
              >
                <option value="">-- Select Variant --</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.storage, v.color].filter(Boolean).join(' • ') || 'Standard'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Sourcing Context Specifics */}
          {sourcingType === 'internal_stock' ? (
            selectedProduct?.has_serials && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Choose Available Serialized Unit
                </label>
                {unitsForVariant.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    No physical units in stock for this variant. (Toggle "Brokered" above if sourcing from a peer).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {unitsForVariant.map((u) => {
                      const isSelected = selectedUnitId === u.id;
                      return (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => setSelectedUnitId(u.id)}
                          className={`p-3 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono font-bold">
                            <span>{u.imei_or_serial ? `Serial: ${u.imei_or_serial}` : 'No Serial'}</span>
                            {u.sim_type && u.sim_type !== 'na' && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                                  isSelected ? 'bg-slate-800 dark:bg-slate-100 text-slate-200 dark:text-slate-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {u.sim_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] opacity-85">
                            {u.battery_health && <span>Battery: {u.battery_health}%</span>}
                            {u.cycle_count !== null && <span>• {u.cycle_count}cc</span>}
                            <span>• {u.condition.replace(/_/g, ' ')}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          ) : (
            /* Brokered Peer Shop Details */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Peer Sourcing Partner (Shop Name)
                </label>
                <select
                  value={vendorContactId}
                  onChange={(e) => setVendorContactId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                  required={sourcingType === 'brokered_neighbour'}
                >
                  <option value="">-- Select Sourcing Partner --</option>
                  {peerMerchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.phone ? `(${m.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Agreed Purchase Cost from Partner (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={vendorCost}
                  onChange={(e) => setVendorCost(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white"
                  required={sourcingType === 'brokered_neighbour'}
                />
              </div>
            </div>
          )}

          {/* 3. Pricing, Customer & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Selling Price (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => {
                  setSellingPrice(e.target.value);
                  setPaidAmount(e.target.value);
                }}
                placeholder="e.g. 165000"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-bold text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Amount Paid Now (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Full or partial"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono font-medium text-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="telebirr">TeleBirr Mobile Money</option>
                <option value="cash">Cash on Hand (Drawer)</option>
                <option value="cbe">CBE Bank Transfer</option>
                <option value="bank_transfer">Other Bank Transfer</option>
                <option value="credit">Credit Sale (Unpaid)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Discount (ETB)
              </label>
              <input
                type="number"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                disabled={user ? !user.can_discount : false}
                placeholder="0"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-mono text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Receiving Account
              </label>
              <select
                value={financialAccountId}
                onChange={(e) => setFinancialAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="">-- Select Receiving Account --</option>
                {accounts.filter((a) => !a.is_custom_asset).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Customer Contact
              </label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b26] text-xs font-medium text-slate-900 dark:text-white"
              >
                <option value="">-- Anonymous Walk-in Customer --</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Margin Calculation Preview */}
          {brokeredProfit !== null && (
            <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-between text-xs font-mono shadow-sm">
              <span className="text-slate-300">Brokered Margin Calculation:</span>
              <span className="font-bold text-emerald-400 text-sm">
                +{brokeredProfit.toLocaleString()} ETB Profit
              </span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="h-11 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2 active:scale-[0.98]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingBag className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              )}
              <span>{submitting ? 'Recording Sale...' : 'Complete & Record Sale'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
