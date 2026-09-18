import React, { useState, useEffect } from 'react';
import type { Product, InventoryUnit, Contact, FinancialAccount, User } from '../api/client';
import { api } from '../api/client';
import { ShoppingBag, ArrowRightLeft, Check, AlertCircle, Loader2 } from 'lucide-react';

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
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

      // Default financial account to TeleBirr or Cash
      const defaultAcc = accounts.find((a) => a.type === 'mobile_money' || a.type === 'cash');
      if (defaultAcc) {
        setFinancialAccountId(defaultAcc.id);
      }
    } catch (err: any) {
      console.error('Failed to load counter data:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const variants = selectedProduct?.variants || [];

  // Filter available serialized units for this variant
  const unitsForVariant = availableUnits.filter((u) => u.variant_id === selectedVariantId);

  // Automatically update selling price when variant or unit is selected
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

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId) {
      setStatusMessage({ type: 'error', text: 'Please select a product and variant.' });
      return;
    }

    const priceNum = parseFloat(sellingPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid selling price.' });
      return;
    }

    if (sourcingType === 'brokered_neighbour') {
      if (!vendorContactId) {
        setStatusMessage({ type: 'error', text: 'Please select the peer merchant where the phone is sourced from.' });
        return;
      }
      const costNum = parseFloat(vendorCost);
      if (isNaN(costNum) || costNum <= 0) {
        setStatusMessage({ type: 'error', text: 'Please enter the agreed purchase cost for the peer merchant.' });
        return;
      }
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

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
      setStatusMessage({
        type: 'success',
        text: `Sale recorded successfully! Order #${order.order_number}. ${
          sourcingType === 'brokered_neighbour' ? 'Payable automatically generated for peer merchant.' : ''
        }`,
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
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record sale.' });
    } finally {
      setSubmitting(false);
    }
  };

  const peerMerchants = contacts.filter((c) => c.roles.includes('peer_vendor') || c.roles.includes('supplier'));
  const customerList = contacts.filter((c) => c.roles.includes('customer') || c.roles.includes('debtor'));

  if (loading && products.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
        <span>Loading catalog and inventory...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-900 text-lg">Counter Checkout POS</h2>
              {user && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  Cashier: {user.name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">High-speed sale recording for shop floor and mobile counter</p>
          </div>

          {/* Sourcing Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setSourcingType('internal_stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sourcingType === 'internal_stock'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              From Our Stock
            </button>
            <button
              type="button"
              onClick={() => setSourcingType('brokered_neighbour')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                sourcingType === 'brokered_neighbour'
                  ? 'bg-amber-50 text-amber-900 border border-amber-200/60 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Brokered (Neighbour Shop)</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmitSale} className="space-y-6 pt-6">
          {/* Sourcing Banner Alert if Brokered */}
          {sourcingType === 'brokered_neighbour' && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/70 text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-amber-700" />
                Brokered Neighbour Sourcing Active
              </div>
              <p className="text-amber-800">
                You are selling an item directly sourced from a neighbouring shop. The system will record your sale profit and <strong>automatically register an outstanding payable</strong> to the peer merchant.
              </p>
            </div>
          )}

          {/* 1. Item Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Select Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setSelectedVariantId('');
                  setSelectedUnitId('');
                }}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              >
                <option value="">-- Choose Product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Variant & Storage</label>
              <select
                value={selectedVariantId}
                onChange={(e) => handleVariantChange(e.target.value)}
                disabled={!selectedProductId}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                required
              >
                <option value="">-- Choose Variant --</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {[v.storage, v.color].filter(Boolean).join(' - ') || 'Standard'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Sourcing Context Specifics */}
          {sourcingType === 'internal_stock' ? (
            selectedProduct?.has_serials && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Choose Available Serialized Unit (IMEI & Health)
                </label>
                {unitsForVariant.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    No serialized units currently in stock for this variant. (You can switch to Brokered Sourcing if sourcing from a peer).
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {unitsForVariant.map((u) => {
                      const isSelected = selectedUnitId === u.id;
                      return (
                        <button
                          type="button"
                          key={u.id}
                          onClick={() => handleUnitChange(u.id)}
                          className={`p-3 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono font-medium">
                            <span>IMEI: {u.imei_or_serial || 'No IMEI'}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-slate-800' : 'bg-slate-100'}`}>
                              {u.sim_type.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] opacity-80">
                            {u.battery_health && <span>Battery: {u.battery_health}%</span>}
                            {u.cycle_count && <span>• {u.cycle_count}cc</span>}
                            <span>• {u.condition}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          ) : (
            /* Brokered Neighbour Shop Sourcing Inputs */
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Peer Merchant (Where did you borrow/buy it?)
                </label>
                <select
                  value={vendorContactId}
                  onChange={(e) => setVendorContactId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  required={sourcingType === 'brokered_neighbour'}
                >
                  <option value="">-- Choose Peer Merchant --</option>
                  {peerMerchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.phone ? `(${m.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Peer Merchant Cost (What you owe them in ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={vendorCost}
                  onChange={(e) => setVendorCost(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                  required={sourcingType === 'brokered_neighbour'}
                />
              </div>
            </div>
          )}

          {/* 3. Pricing, Customer & Payment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Customer Selling Price (ETB)</label>
              <input
                type="number"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => {
                  setSellingPrice(e.target.value);
                  setPaidAmount(e.target.value);
                }}
                placeholder="e.g. 20000"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Amount Paid Now (ETB)</label>
              <input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="Full or partial"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              >
                <option value="telebirr">TeleBirr Mobile Money</option>
                <option value="cash">Cash on Hand (Drawer)</option>
                <option value="cbe">CBE Bank Transfer</option>
                <option value="bank_transfer">Other Bank Transfer</option>
                <option value="credit">Credit Sale (Unpaid)</option>
              </select>
            </div>
          </div>

          {/* Discount & Receiving Account */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Discount Given (ETB)</label>
              <input
                type="number"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                disabled={user ? !user.can_discount : false}
                placeholder="0"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Receiving Account</label>
              <select
                value={financialAccountId}
                onChange={(e) => setFinancialAccountId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              >
                <option value="">-- Choose Account --</option>
                {accounts.filter((a) => !a.is_custom_asset).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({Number(a.current_balance).toLocaleString()} ETB)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Customer (Optional)</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900"
              >
                <option value="">-- Walk-in Anonymous Customer --</option>
                {customerList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Margin Calculation Preview */}
          {sourcingType === 'brokered_neighbour' && sellingPrice && vendorCost && (
            <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">Brokered Margin Calculation:</span>
              <span>
                {parseFloat(sellingPrice).toLocaleString()} - {parseFloat(vendorCost).toLocaleString()} ={' '}
                <strong className="text-emerald-400 font-semibold">
                  +{(parseFloat(sellingPrice) - parseFloat(vendorCost)).toLocaleString()} ETB Profit
                </strong>
              </span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{submitting ? 'Recording Transaction...' : 'Complete & Record Sale'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
