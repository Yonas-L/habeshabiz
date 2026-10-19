import React, { useMemo } from 'react';
import type { Product, Contact, FinancialAccount, User } from '../../api/client';
import { Plus, X, Package, Truck, Sparkles } from 'lucide-react';
import { formatCurrencyInput, parseFormattedNumber } from '../../utils/numberUtils';
import { SplitPaymentSelector, type PaymentSplitItem } from '../common/SplitPaymentSelector';

export interface AttachedAccessoryItem {
  id: string; // client temporary uuid
  source: 'stock' | 'vendor';
  // If Stock:
  product_id?: string;
  variant_id?: string;
  inventory_unit_id?: string;
  name: string;
  available_stock?: number;
  // If Vendor:
  vendor_contact_id?: string;
  vendor_payment_method: 'owed' | 'paid_now';
  vendor_paid_amount?: number;
  vendor_payment_account_id?: string;
  vendor_is_split?: boolean;
  vendor_payment_splits?: PaymentSplitItem[];
  // Financials:
  cost: number;
  price: number;
  quantity: number;
}

interface AccessoryAttachmentSectionProps {
  accessories: AttachedAccessoryItem[];
  onChange: (accessories: AttachedAccessoryItem[]) => void;
  products: Product[];
  contacts: Contact[];
  accounts: FinancialAccount[];
  currentUser?: User | null;
  isOwner?: boolean;
}

export const AccessoryAttachmentSection: React.FC<AccessoryAttachmentSectionProps> = ({
  accessories,
  onChange,
  products,
  contacts,
  accounts,
  currentUser,
  isOwner = false,
}) => {
  const canViewCost = isOwner || !!currentUser?.can_view_costs || !!currentUser?.permissions?.can_view_costs;
  const canDiscount = isOwner || !!currentUser?.can_discount || !!currentUser?.permissions?.can_discount;

  const vendorContacts = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.is_active !== false &&
          ['vendor', 'peer_vendor', 'supplier', 'partner'].some((r) => c.roles?.includes(r))
      ),
    [contacts]
  );

  // Flatten available stocked accessories/products with variants
  const stockOptions = useMemo(() => {
    const list: Array<{
      product_id: string;
      variant_id: string;
      unit_id?: string;
      label: string;
      cost: number;
      default_price: number;
      stock_qty: number;
      is_accessory_cat: boolean;
    }> = [];

    products.forEach((p) => {
      const cat = (p.category || '').toLowerCase();
      const name = p.name.toLowerCase();
      const isAccessory =
        cat.includes('access') ||
        cat.includes('protect') ||
        cat.includes('glass') ||
        cat.includes('charg') ||
        cat.includes('cable') ||
        cat.includes('power') ||
        cat.includes('gadget') ||
        cat.includes('audio') ||
        name.includes('case') ||
        name.includes('cover') ||
        name.includes('protector') ||
        name.includes('charger') ||
        name.includes('adapter') ||
        name.includes('cable');

      (p.variants || []).forEach((v) => {
        const inStockUnits = (v.inventory_units || []).filter((u) => u.status === 'in_stock');
        const unitCost = inStockUnits.length > 0 ? Number(inStockUnits[0].cost_basis || 0) : Number(v.stock?.average_cost || 0);
        const qty = inStockUnits.length > 0 ? inStockUnits.length : (v.stock?.quantity_on_hand || 0);
        const defaultPrice = Number(v.default_selling_price || 0);

        const specParts = [v.storage, v.color].filter(Boolean);
        const specStr = specParts.length > 0 ? ` (${specParts.join(', ')})` : '';

        list.push({
          product_id: p.id,
          variant_id: v.id,
          unit_id: inStockUnits[0]?.id,
          label: `${p.name}${specStr}`,
          cost: unitCost,
          default_price: defaultPrice,
          stock_qty: qty,
          is_accessory_cat: isAccessory,
        });
      });
    });

    // Prioritize accessory categories first, then alphabetical
    return list.sort((a, b) => {
      if (a.is_accessory_cat && !b.is_accessory_cat) return -1;
      if (!a.is_accessory_cat && b.is_accessory_cat) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [products]);

  const handleAddAccessory = () => {
    // Default to first stock option if available, otherwise vendor sourced
    const firstStock = stockOptions[0];
    const newAcc: AttachedAccessoryItem = firstStock
      ? {
          id: Math.random().toString(36).substring(2, 9),
          source: 'stock',
          product_id: firstStock.product_id,
          variant_id: firstStock.variant_id,
          inventory_unit_id: firstStock.unit_id,
          name: firstStock.label,
          available_stock: firstStock.stock_qty,
          cost: firstStock.cost,
          price: firstStock.default_price,
          quantity: 1,
          vendor_payment_method: 'owed',
        }
      : {
          id: Math.random().toString(36).substring(2, 9),
          source: 'vendor',
          name: '',
          cost: 0,
          price: 0,
          quantity: 1,
          vendor_payment_method: 'owed',
        };

    onChange([...accessories, newAcc]);
  };

  const handleRemove = (id: string) => {
    onChange(accessories.filter((a) => a.id !== id));
  };

  const handleUpdate = (id: string, updates: Partial<AttachedAccessoryItem>) => {
    onChange(
      accessories.map((a) => {
        if (a.id !== id) return a;
        return { ...a, ...updates };
      })
    );
  };

  const totals = useMemo(() => {
    let totalPrice = 0;
    let totalCost = 0;
    let giveaways = 0;

    accessories.forEach((a) => {
      const p = Number(a.price) || 0;
      const c = Number(a.cost) || 0;
      const q = Number(a.quantity) || 1;
      totalPrice += p * q;
      totalCost += c * q;
      if (p <= 0) giveaways += q;
    });

    const netMargin = totalPrice - totalCost;
    return { totalPrice, totalCost, giveaways, netMargin };
  }, [accessories]);

  return (
    <div className="space-y-2.5">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-slate-900 dark:text-white">
            Attached Accessories & Bundles
          </span>
          {accessories.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
              {accessories.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddAccessory}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Accessory</span>
        </button>
      </div>

      {/* Accessories Items List */}
      {accessories.length === 0 ? (
        <div className="px-3 py-2 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-[11px] text-slate-400">
          No accessories attached. Click above to attach a charger, screen protector, or case from stock or vendor.
        </div>
      ) : (
        <div className="space-y-2">
          {accessories.map((acc, idx) => {
            const margin = (acc.price - acc.cost) * acc.quantity;
            const isGift = acc.price <= 0;

            return (
              <div
                key={acc.id}
                className="p-2.5 rounded-lg border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-900/60 space-y-2 text-xs"
              >
                {/* Source Selection & Delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                    <div className="inline-flex p-0.5 rounded bg-slate-200/60 dark:bg-slate-800/70 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          const firstStock = stockOptions[0];
                          handleUpdate(acc.id, {
                            source: 'stock',
                            product_id: firstStock?.product_id,
                            variant_id: firstStock?.variant_id,
                            inventory_unit_id: firstStock?.unit_id,
                            name: firstStock ? firstStock.label : '',
                            cost: firstStock?.cost || 0,
                            price: firstStock?.default_price || 0,
                            available_stock: firstStock?.stock_qty || 0,
                          });
                        }}
                        className={`px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 ${
                          acc.source === 'stock'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Package className="w-3 h-3" />
                        <span>In Stock</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdate(acc.id, {
                            source: 'vendor',
                            product_id: undefined,
                            variant_id: undefined,
                            inventory_unit_id: undefined,
                            name: '',
                            cost: 0,
                            price: 0,
                            available_stock: undefined,
                          })
                        }
                        className={`px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 ${
                          acc.source === 'vendor'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Truck className="w-3 h-3" />
                        <span>Vendor Brokered</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(acc.id)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Remove accessory"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sourcing Fields */}
                {acc.source === 'stock' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                        Stock Item (Search by name or category)
                      </label>
                      <select
                        value={acc.variant_id || ''}
                        onChange={(e) => {
                          const chosen = stockOptions.find((o) => o.variant_id === e.target.value);
                          if (chosen) {
                            handleUpdate(acc.id, {
                              product_id: chosen.product_id,
                              variant_id: chosen.variant_id,
                              inventory_unit_id: chosen.unit_id,
                              name: chosen.label,
                              cost: chosen.cost,
                              price: chosen.default_price,
                              available_stock: chosen.stock_qty,
                            });
                          }
                        }}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {stockOptions.map((opt) => (
                          <option key={opt.variant_id} value={opt.variant_id}>
                            {opt.label} ({opt.stock_qty} in stock)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                          Accessory Name
                        </label>
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => handleUpdate(acc.id, { name: e.target.value })}
                          placeholder="e.g. Anker 20W Fast Charger"
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                          Vendor / Broker
                        </label>
                        <select
                          value={acc.vendor_contact_id || ''}
                          onChange={(e) => handleUpdate(acc.id, { vendor_contact_id: e.target.value })}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">Select Vendor</option>
                          {vendorContacts.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/50 dark:border-slate-800/50 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                            Vendor Cost (ETB)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={acc.cost > 0 ? formatCurrencyInput(acc.cost) : ''}
                            onChange={(e) =>
                              handleUpdate(acc.id, {
                                cost: parseFormattedNumber(e.target.value) ?? 0,
                              })
                            }
                            placeholder="0"
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                            Vendor Settlement Terms
                          </label>
                          <select
                            value={acc.vendor_payment_method}
                            onChange={(e) =>
                              handleUpdate(acc.id, {
                                vendor_payment_method: e.target.value as 'owed' | 'paid_now',
                              })
                            }
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none"
                          >
                            <option value="owed">Pay Later (Owed)</option>
                            <option value="paid_now">Pay Now (Deduct from Accounts)</option>
                          </select>
                        </div>
                      </div>

                      {acc.vendor_payment_method === 'paid_now' && (
                        <div className="pt-1">
                          <SplitPaymentSelector
                            accounts={accounts}
                            targetAmount={Number(acc.cost || 0) * (acc.quantity || 1)}
                            singleAccountId={acc.vendor_payment_account_id || ''}
                            onSingleAccountChange={(accId) => handleUpdate(acc.id, { vendor_payment_account_id: accId })}
                            isSplit={!!acc.vendor_is_split}
                            onIsSplitChange={(isSplit) => handleUpdate(acc.id, { vendor_is_split: isSplit })}
                            splits={acc.vendor_payment_splits || []}
                            onSplitsChange={(splits) => handleUpdate(acc.id, { vendor_payment_splits: splits })}
                            label="Deduct Vendor Payout From"
                            direction="outflow"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selling Price & Margin Calculation */}
                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-32">
                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                        Customer Price
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={acc.price > 0 ? formatCurrencyInput(acc.price) : acc.price === 0 ? '0' : ''}
                        onChange={(e) => {
                          const val = parseFormattedNumber(e.target.value);
                          handleUpdate(acc.id, { price: val ?? 0 });
                        }}
                        placeholder="0"
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {canDiscount && (
                      <div className="pt-3.5">
                        <button
                          type="button"
                          onClick={() => handleUpdate(acc.id, { price: 0 })}
                          className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            acc.price === 0
                              ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          Free Gift (0 ETB)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Real-time Profit Preview */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {canViewCost && (
                      <span className="text-slate-400">
                        Cost: <span className="font-mono">{acc.cost.toLocaleString()} ETB</span>
                      </span>
                    )}

                    {isGift ? (
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
                        −{acc.cost.toLocaleString()} ETB Giveaway
                      </span>
                    ) : margin >= 0 ? (
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                        +{margin.toLocaleString()} ETB Profit
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                        {margin.toLocaleString()} ETB Below Cost
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Minimal Summary Footer */}
          <div className="px-3 py-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100/70 dark:border-indigo-900/40 text-[11px] flex flex-wrap items-center justify-between gap-2">
            <span className="text-indigo-900 dark:text-indigo-200 font-medium">
              Accessories Total: +{totals.totalPrice.toLocaleString()} ETB to order
              {totals.giveaways > 0 && ` (${totals.giveaways} free gift)`}
            </span>
            <span className="font-mono font-semibold">
              Net Margin Impact:{' '}
              <span
                className={
                  totals.netMargin >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }
              >
                {totals.netMargin >= 0 ? `+${totals.netMargin.toLocaleString()}` : totals.netMargin.toLocaleString()} ETB
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
