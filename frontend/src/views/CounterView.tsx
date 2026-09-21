import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Product, ProductVariant, InventoryUnit, Contact, FinancialAccount, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ShoppingBag,
  ArrowRightLeft,
  Loader2,
  Search,
  X,
  Check,
  ChevronRight,
  Package,
  Smartphone,
  Battery,
  CreditCard,
  Wallet,
  Banknote,
  Receipt,
  User as UserIcon,
  Tag,
  AlertTriangle,
  Zap,
  Plus,
  Minus,
} from 'lucide-react';

interface CounterViewProps {
  user: User | null;
  accounts: FinancialAccount[];
  contacts: Contact[];
  onSaleSuccess: () => void;
}

/* ─── Step Indicator ─── */
const StepBadge: React.FC<{ num: number; label: string; active: boolean; done: boolean }> = ({
  num, label, active, done,
}) => (
  <div className={`flex items-center gap-2 ${active ? '' : 'opacity-40'}`}>
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
      done ? 'bg-emerald-500 text-white' : active ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
    }`}>
      {done ? <Check className="w-3 h-3" /> : num}
    </div>
    <span className={`text-[11px] font-bold hidden sm:inline ${active ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
      {label}
    </span>
  </div>
);

export const CounterView: React.FC<CounterViewProps> = ({ user, accounts, contacts, onSaleSuccess }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [availableUnits, setAvailableUnits] = useState<InventoryUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [sourcingType, setSourcingType] = useState<'internal_stock' | 'brokered_neighbour'>('internal_stock');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [productSearch, setProductSearch] = useState('');

  // Brokered details
  const [vendorContactId, setVendorContactId] = useState<string>('');
  const [vendorCost, setVendorCost] = useState<string>('');

  // Pricing & Discount
  const [unitSellingPrice, setUnitSellingPrice] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('telebirr');
  const [financialAccountId, setFinancialAccountId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-focus search on mount
  useEffect(() => {
    if (!loading && searchRef.current) {
      searchRef.current.focus();
    }
  }, [loading]);

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

  // ─── Derived State ───
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const variants = selectedProduct?.variants || [];
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const unitsForVariant = availableUnits.filter((u) => u.variant_id === selectedVariantId);

  // Calculate maximum available stock for internal inventory
  const maxAvailableStock = useMemo(() => {
    if (sourcingType === 'brokered_neighbour') {
      return 9999; // Brokered items are sourced externally from peer merchant
    }
    if (!selectedVariant) return 0;

    const inStockUnitsCount = unitsForVariant.length;
    const quantityOnHand = selectedVariant.stock?.quantity_on_hand ?? 0;

    // Serialized products: strictly the count of physical in-stock units
    if (selectedProduct?.has_serials) {
      return inStockUnitsCount;
    }

    // Non-serialized items: check quantity_on_hand or in-stock unit count
    return Math.max(quantityOnHand, inStockUnitsCount);
  }, [sourcingType, selectedVariant, selectedProduct, unitsForVariant]);

  const peerMerchants = contacts.filter((c) => c.roles.includes('peer_vendor') || c.roles.includes('supplier'));
  const customerList = contacts.filter((c) => c.roles.includes('customer') || c.roles.includes('debtor'));
  const treasuryAccounts = accounts.filter((a) => !a.is_custom_asset);

  // Products filtered by search, with in-stock count
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products
      .filter((p) => {
        if (!q) return true;
        const cat = p.category_rel?.name || p.category || '';
        return (
          p.name.toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
        );
      })
      .map((p) => {
        const variantIds = p.variants.map((v) => v.id);
        const stockCount = availableUnits.filter((u) => variantIds.includes(u.variant_id)).length;
        return { ...p, stockCount };
      });
  }, [products, productSearch, availableUnits]);

  // Pricing & Discount calculations
  const unitPriceNum = parseFloat(unitSellingPrice) || 0;
  const grossSubtotal = unitPriceNum * quantity;
  const rawDiscountVal = parseFloat(discountValue) || 0;

  const calculatedDiscountAmount = useMemo(() => {
    if (rawDiscountVal <= 0 || grossSubtotal <= 0) return 0;
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, rawDiscountVal));
      return (grossSubtotal * pct) / 100;
    }
    return Math.min(grossSubtotal, Math.max(0, rawDiscountVal));
  }, [discountType, rawDiscountVal, grossSubtotal]);

  const totalAfterDiscount = Math.max(0, grossSubtotal - calculatedDiscountAmount);
  const paidNum = parseFloat(paidAmount) || 0;
  const balanceDue = Math.max(0, totalAfterDiscount - paidNum);
  const isCredit = balanceDue > 0;

  const vendorCostNum = parseFloat(vendorCost) || 0;
  const brokeredProfit = sourcingType === 'brokered_neighbour' && unitSellingPrice && vendorCost
    ? (unitPriceNum - vendorCostNum) * quantity
    : null;

  // Step progress
  const step1Done = !!selectedProductId;
  const step2Done = !!selectedVariantId;
  const step3Done = unitPriceNum > 0 && quantity > 0 && (sourcingType === 'brokered_neighbour' || maxAvailableStock > 0);
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setSelectedVariantId('');
    setSelectedUnitIds([]);
    setQuantity(1);
    setUnitSellingPrice('');
    setDiscountValue('');
    setPaidAmount('');
    setProductSearch('');
  };

  const handleSelectVariant = (variant: ProductVariant) => {
    setSelectedVariantId(variant.id);
    setSelectedUnitIds([]);
    setQuantity(1);
    if (variant.default_selling_price) {
      const priceStr = String(variant.default_selling_price);
      setUnitSellingPrice(priceStr);
      setPaidAmount(priceStr);
    }
  };

  const handleToggleUnit = (unitId: string) => {
    setSelectedUnitIds((prev) => {
      const isRemoving = prev.includes(unitId);
      if (!isRemoving && maxAvailableStock > 0 && prev.length >= maxAvailableStock) {
        toast.warning(`All ${maxAvailableStock} available unit(s) are already selected.`);
        return prev;
      }
      const next = isRemoving ? prev.filter((id) => id !== unitId) : [...prev, unitId];
      const newQty = next.length > 0 ? next.length : 1;
      setQuantity(newQty);
      if (unitPriceNum > 0) {
        const newGross = unitPriceNum * newQty;
        const discountAmt = discountType === 'percent'
          ? (newGross * Math.min(100, rawDiscountVal)) / 100
          : Math.min(newGross, rawDiscountVal);
        const newTotal = Math.max(0, newGross - discountAmt);
        setPaidAmount(String(newTotal));
      }
      return next;
    });
  };

  const handleQuantityChange = (newQty: number) => {
    if (sourcingType === 'internal_stock') {
      if (maxAvailableStock <= 0) {
        toast.error('Item is out of stock in shop inventory. Switch to "Brokered" to source from a peer.');
        setQuantity(1);
        return;
      }
      if (newQty > maxAvailableStock) {
        toast.warning(`Cannot exceed available inventory (${maxAvailableStock} in stock).`);
        newQty = maxAvailableStock;
      }
    }
    const validQty = Math.max(1, newQty);
    setQuantity(validQty);
    if (unitPriceNum > 0) {
      const newGross = unitPriceNum * validQty;
      const discountAmt = discountType === 'percent'
        ? (newGross * Math.min(100, rawDiscountVal)) / 100
        : Math.min(newGross, rawDiscountVal);
      const newTotal = Math.max(0, newGross - discountAmt);
      setPaidAmount(String(newTotal));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitSellingPrice(val);
    const p = parseFloat(val) || 0;
    const newGross = p * quantity;
    const discountAmt = discountType === 'percent'
      ? (newGross * Math.min(100, rawDiscountVal)) / 100
      : Math.min(newGross, rawDiscountVal);
    const newTotal = Math.max(0, newGross - discountAmt);
    setPaidAmount(String(newTotal));
  };

  const handleDiscountChange = (val: string, type: 'percent' | 'fixed') => {
    let d = parseFloat(val) || 0;
    if (d < 0) d = 0;
    if (type === 'percent' && d > 100) {
      d = 100;
      toast.warning('Percentage discount cannot exceed 100%.');
    } else if (type === 'fixed' && grossSubtotal > 0 && d > grossSubtotal) {
      d = grossSubtotal;
      toast.warning(`Fixed discount cannot exceed subtotal (${grossSubtotal.toLocaleString()} ETB).`);
    }

    setDiscountValue(val === '' ? '' : String(d));
    const discountAmt = type === 'percent'
      ? (grossSubtotal * Math.min(100, d)) / 100
      : Math.min(grossSubtotal, d);
    const newTotal = Math.max(0, grossSubtotal - discountAmt);
    setPaidAmount(String(newTotal));
  };

  const resetForm = () => {
    setSelectedProductId('');
    setSelectedVariantId('');
    setSelectedUnitIds([]);
    setQuantity(1);
    setUnitSellingPrice('');
    setDiscountValue('');
    setPaidAmount('');
    setVendorCost('');
    setVendorContactId('');
    setCustomerId('');
    setNotes('');
    setProductSearch('');
  };

  const handleSubmitSale = async () => {
    if (!selectedVariantId) {
      toast.error('Please select a product and variant');
      return;
    }
    if (unitPriceNum <= 0) {
      toast.error('Please enter a valid selling price');
      return;
    }
    if (quantity <= 0) {
      toast.error('Quantity must be at least 1');
      return;
    }
    if (sourcingType === 'internal_stock') {
      if (maxAvailableStock <= 0) {
        toast.error('Cannot record sale: Item is out of stock in shop inventory.');
        return;
      }
      if (quantity > maxAvailableStock) {
        toast.error(`Sale quantity (${quantity}) exceeds available stock (${maxAvailableStock}).`);
        return;
      }
    }
    if (sourcingType === 'brokered_neighbour') {
      if (!vendorContactId) {
        toast.error('Please select the peer merchant');
        return;
      }
      if (isNaN(vendorCostNum) || vendorCostNum <= 0) {
        toast.error('Please enter the agreed peer purchase cost');
        return;
      }
    }

    try {
      setSubmitting(true);

      // Build items array
      let itemsPayload: Array<{
        variant_id: string;
        inventory_unit_id: string | null;
        quantity: number;
        unit_price: number;
        sourcing_type: 'internal_stock' | 'brokered_neighbour';
        vendor_contact_id: string | null;
        vendor_cost: number | null;
      }> = [];

      if (sourcingType === 'internal_stock' && selectedUnitIds.length > 0) {
        // Multiple or single serialized units
        itemsPayload = selectedUnitIds.map((uId) => ({
          variant_id: selectedVariantId,
          inventory_unit_id: uId,
          quantity: 1,
          unit_price: unitPriceNum,
          sourcing_type: 'internal_stock',
          vendor_contact_id: null,
          vendor_cost: null,
        }));
      } else {
        // Quantity-based sale (non-serialized or without specific serial unit)
        itemsPayload = [
          {
            variant_id: selectedVariantId,
            inventory_unit_id: null,
            quantity: quantity,
            unit_price: unitPriceNum,
            sourcing_type: sourcingType,
            vendor_contact_id: sourcingType === 'brokered_neighbour' ? vendorContactId : null,
            vendor_cost: sourcingType === 'brokered_neighbour' ? vendorCostNum : null,
          },
        ];
      }

      const salePayload = {
        customer_id: customerId || null,
        discount_amount: calculatedDiscountAmount,
        paid_amount: paidNum,
        payment_method: paymentMethod,
        financial_account_id: paidNum > 0 ? financialAccountId : null,
        notes: notes || null,
        items: itemsPayload,
      };

      const order = await api.recordSale(salePayload);

      toast.success(`Sale recorded! Order #${order.order_number}`, {
        description: sourcingType === 'brokered_neighbour'
          ? `Brokered sale of ${quantity} unit(s) booked & payable recorded.`
          : `Sold ${quantity} unit(s) — Inventory deducted & ledger updated.`,
      });

      resetForm();
      loadData();
      onSaleSuccess();
    } catch (err: any) {
      toast.error('Failed to record sale', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Variant display label ───
  const variantLabel = (v: ProductVariant) => {
    const specParts = v.specs ? Object.values(v.specs).map(String) : [];
    const parts = [v.storage, v.ram ? `${v.ram} RAM` : null, v.color, ...specParts].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Standard';
  };

  if (loading && products.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
        <span>Loading catalog and inventory items...</span>
      </div>
    );
  }

  return (
    <div className="animate-page-enter">
      {/* ─── Top Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center">
            <ShoppingBag className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="font-black text-slate-900 dark:text-white text-base tracking-tight">Point of Sale</h2>
            <p className="text-[11px] text-slate-400 font-medium">
              {user && <span className="text-slate-600 dark:text-slate-300 font-bold">{user.name}</span>}
              {user && ' — '}Quick sale entry with percentage (%) and fixed discount modes
            </p>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-3 sm:gap-4">
          <StepBadge num={1} label="Product" active={currentStep >= 1} done={step1Done} />
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          <StepBadge num={2} label="Variant" active={currentStep >= 2} done={step2Done} />
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          <StepBadge num={3} label="Qty & Price" active={currentStep >= 3} done={step3Done} />
          <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-600" />
          <StepBadge num={4} label="Confirm" active={currentStep >= 4} done={false} />
        </div>
      </div>

      {/* ─── Sourcing Mode Toggle ─── */}
      <div className="mb-5">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setSourcingType('internal_stock');
              setSelectedUnitIds([]);
            }}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              sourcingType === 'internal_stock'
                ? 'bg-white dark:bg-[#131926] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            From Our Stock
          </button>
          <button
            type="button"
            onClick={() => {
              setSourcingType('brokered_neighbour');
              setSelectedUnitIds([]);
            }}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
              sourcingType === 'brokered_neighbour'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Brokered (Peer Shop)
          </button>
        </div>
      </div>

      {/* ─── Main Two-Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ═══ LEFT: Selection Area (3 cols) ═══ */}
        <div className="lg:col-span-3 space-y-5">

          {/* ── STEP 1: Product Search & Selection ── */}
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  ref={searchRef}
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name, brand, or category..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
              {selectedProductId && (
                <button
                  onClick={resetForm}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Product Grid */}
            {!selectedProductId && (
              <div className="p-3 max-h-[320px] overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No products match "{productSearch}"
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredProducts.map((p) => {
                      const cat = p.category_rel?.name || p.category || '';
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProduct(p.id)}
                          className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-sm transition-all text-left group"
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight">
                            {p.name}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400 font-medium truncate">
                              {p.brand || cat}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              p.stockCount > 0
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}>
                              {p.stockCount} in stock
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Selected product header */}
            {selectedProduct && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedProduct.name}</span>
                    {selectedProduct.brand && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                        {selectedProduct.brand}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedProductId('');
                      setSelectedVariantId('');
                      setSelectedUnitIds([]);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold"
                  >
                    Change
                  </button>
                </div>

                {/* ── STEP 2: Variant Chips ── */}
                <div className="mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Select Variant
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => {
                      const isSelected = selectedVariantId === v.id;
                      const vUnits = availableUnits.filter((u) => u.variant_id === v.id);
                      const vQtyOnHand = v.stock?.quantity_on_hand ?? 0;
                      const vStock = selectedProduct.has_serials ? vUnits.length : Math.max(vQtyOnHand, vUnits.length);
                      return (
                        <button
                          key={v.id}
                          onClick={() => handleSelectVariant(v)}
                          className={`px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                          }`}
                        >
                          <span>{variantLabel(v)}</span>
                          {sourcingType === 'internal_stock' && (
                            <span className={`ml-1.5 text-[10px] font-bold ${
                              vStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                            }`}>
                              ({vStock > 0 ? `${vStock} in stock` : '0 in stock'})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Serial Unit Selection (for internal stock with serials) ── */}
          {selectedVariant && sourcingType === 'internal_stock' && selectedProduct?.has_serials && (
            <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Pick Serialized Units ({unitsForVariant.length} in stock)
                </span>
                {selectedUnitIds.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedUnitIds.length} / {maxAvailableStock} unit(s) selected
                  </span>
                )}
              </div>

              {unitsForVariant.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Out of stock in shop inventory. You can switch to "Brokered" above to source from a peer merchant without inventory limit.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {unitsForVariant.map((u) => {
                    const isSelected = selectedUnitIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleToggleUnit(u.id)}
                        className={`p-3 rounded-xl border-2 text-left text-xs transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                            {u.imei_or_serial || 'No Serial'}
                          </span>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-slate-700'
                          }`}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          {u.battery_health && (
                            <span className="inline-flex items-center gap-0.5">
                              <Battery className="w-3 h-3" />
                              {u.battery_health}%
                            </span>
                          )}
                          {u.cycle_count !== null && <span>{u.cycle_count} cc</span>}
                          <span className="capitalize">{u.condition.replace(/_/g, ' ')}</span>
                          {u.sim_type && u.sim_type !== 'na' && (
                            <span className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono uppercase text-[9px] font-bold">
                              {u.sim_type}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Brokered Sourcing Info ── */}
          {selectedVariant && sourcingType === 'brokered_neighbour' && (
            <div className="bg-white dark:bg-[#131926] rounded-2xl border border-amber-200/60 dark:border-amber-800/40 p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Brokered Source Details
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Peer Merchant
                  </label>
                  <select
                    value={vendorContactId}
                    onChange={(e) => setVendorContactId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    required
                  >
                    <option value="">— Select Sourcing Partner —</option>
                    {peerMerchants.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.phone ? `(${m.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Peer Unit Cost (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={vendorCost}
                    onChange={(e) => setVendorCost(e.target.value)}
                    placeholder="Agreed cost per unit"
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    required
                  />
                </div>
              </div>
              {brokeredProfit !== null && (
                <div className={`mt-3 p-2.5 rounded-xl text-xs font-bold font-mono text-center ${
                  brokeredProfit > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50'
                }`}>
                  {brokeredProfit > 0 ? '+' : ''}{brokeredProfit.toLocaleString()} ETB total margin ({quantity} × {(unitPriceNum - vendorCostNum).toLocaleString()} ETB)
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Quantity, Pricing & Payment ── */}
          {selectedVariant && (
            <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4">
              
              {/* ── Quantity Stepper Section ── */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Quantity / Number of Units
                      </span>
                      {sourcingType === 'internal_stock' && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          maxAvailableStock > 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                        }`}>
                          {maxAvailableStock > 0 ? `${maxAvailableStock} Available` : 'Out of Stock'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {selectedUnitIds.length > 0
                        ? `${selectedUnitIds.length} specific serial unit(s) selected above`
                        : sourcingType === 'internal_stock'
                        ? `Max ${maxAvailableStock} unit(s) can be sold from inventory`
                        : 'Specify how many units to sell'}
                    </p>
                  </div>

                  {/* Stepper + Quick count chips */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(quantity - 1)}
                        disabled={quantity <= 1 || (sourcingType === 'internal_stock' && maxAvailableStock <= 0)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min="1"
                        max={sourcingType === 'internal_stock' ? (maxAvailableStock > 0 ? maxAvailableStock : 1) : undefined}
                        value={quantity}
                        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                        disabled={sourcingType === 'internal_stock' && maxAvailableStock <= 0}
                        className="w-12 text-center font-mono font-black text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none disabled:opacity-30"
                      />

                      <button
                        type="button"
                        onClick={() => handleQuantityChange(quantity + 1)}
                        disabled={sourcingType === 'internal_stock' && quantity >= maxAvailableStock}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick Count Preset Chips (only enabled if <= maxAvailableStock) */}
                    <div className="hidden sm:flex items-center gap-1">
                      {[1, 2, 3, 5, 10].map((count) => {
                        const isOverStock = sourcingType === 'internal_stock' && count > maxAvailableStock;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => handleQuantityChange(count)}
                            disabled={isOverStock}
                            title={isOverStock ? `Only ${maxAvailableStock} in stock` : undefined}
                            className={`h-8 px-2 rounded-lg text-xs font-mono font-bold transition-all ${
                              quantity === count
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                                : isOverStock
                                ? 'bg-slate-100 dark:bg-slate-900 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                            }`}
                          >
                            {count}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Price & Discount Inputs ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Unit Price */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    <Tag className="w-3 h-3 inline mr-0.5" />
                    Unit Price (ETB) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitSellingPrice}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    placeholder="Price per unit"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                  {quantity > 1 && unitPriceNum > 0 && (
                    <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                      = {grossSubtotal.toLocaleString()} ETB subtotal
                    </span>
                  )}
                </div>

                {/* 2. Discount with % vs ETB Mode Switcher */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Discount
                    </label>
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('percent');
                          handleDiscountChange(discountValue, 'percent');
                        }}
                        className={`px-2 py-0.5 rounded-md transition-all ${
                          discountType === 'percent'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        % Percent
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('fixed');
                          handleDiscountChange(discountValue, 'fixed');
                        }}
                        className={`px-2 py-0.5 rounded-md transition-all ${
                          discountType === 'fixed'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                      >
                        ETB Fixed
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step={discountType === 'percent' ? '1' : '0.01'}
                      min="0"
                      max={discountType === 'percent' ? 100 : (grossSubtotal > 0 ? grossSubtotal : undefined)}
                      value={discountValue}
                      onChange={(e) => handleDiscountChange(e.target.value, discountType)}
                      disabled={user ? !user.can_discount : false}
                      placeholder={discountType === 'percent' ? 'e.g. 20 (for 20%)' : 'e.g. 5000 (flat)'}
                      className="w-full h-10 pl-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-40"
                    />
                    <div className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                      {discountType === 'percent' ? '%' : 'ETB'}
                    </div>
                  </div>

                  {calculatedDiscountAmount > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-mono font-bold">
                      {discountType === 'percent'
                        ? `= -${calculatedDiscountAmount.toLocaleString()} ETB off (${rawDiscountVal}% of ${grossSubtotal.toLocaleString()} ETB)`
                        : `= -${calculatedDiscountAmount.toLocaleString()} ETB off (${((calculatedDiscountAmount / (grossSubtotal || 1)) * 100).toFixed(1)}%)`}
                    </span>
                  )}
                </div>

                {/* 3. Paid Now */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Paid Now (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="Full or partial"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    required
                  />
                  {totalAfterDiscount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(String(totalAfterDiscount))}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-1 block font-medium underline"
                    >
                      Fill full net amount ({totalAfterDiscount.toLocaleString()} ETB)
                    </button>
                  )}
                </div>
              </div>

              {/* Payment Method Quick Selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Payment Method
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'telebirr', label: 'TeleBirr', icon: Smartphone },
                    { value: 'cash', label: 'Cash', icon: Banknote },
                    { value: 'cbe', label: 'CBE Transfer', icon: CreditCard },
                    { value: 'bank_transfer', label: 'Other Bank', icon: Wallet },
                    { value: 'credit', label: 'Credit Sale', icon: Receipt },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.value);
                          if (m.value === 'credit') {
                            setPaidAmount('0');
                          } else {
                            setPaidAmount(String(totalAfterDiscount));
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-[11px] font-semibold transition-all ${
                          isSelected
                            ? m.value === 'credit'
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                              : 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Account & Customer Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Receiving Account
                  </label>
                  <select
                    value={financialAccountId}
                    onChange={(e) => setFinancialAccountId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                  >
                    <option value="">— Select Account —</option>
                    {treasuryAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {user?.role === 'owner' && a.current_balance !== null
                          ? `${a.name} (${Number(a.current_balance).toLocaleString()} ETB)`
                          : a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    <UserIcon className="w-3 h-3 inline mr-0.5" />
                    Customer
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                  >
                    <option value="">Walk-in Customer</option>
                    {customerList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sale notes (optional)..."
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Order Summary / Receipt (2 cols) ═══ */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] sticky top-4 overflow-hidden">
            {/* Receipt Header */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sale Summary
                </span>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Empty State */}
              {!selectedProduct ? (
                <div className="py-8 text-center">
                  <ShoppingBag className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-medium">Search and select a product to begin</p>
                </div>
              ) : (
                <>
                  {/* Product Line Item */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {selectedProduct.name}
                        </div>
                        {selectedVariant && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {variantLabel(selectedVariant)}
                          </div>
                        )}
                        {selectedUnitIds.length > 0 && (
                          <div className="text-[10px] text-slate-400 font-mono mt-1 space-y-0.5">
                            {selectedUnitIds.map((uId) => {
                              const u = availableUnits.find((unit) => unit.id === uId);
                              return (
                                <div key={uId} className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  <span>SN: {u?.imei_or_serial || 'Unknown'}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {sourcingType === 'brokered_neighbour' && (
                          <div className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                            Brokered
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700">
                          × {quantity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Out of Stock Warning Banner */}
                  {sourcingType === 'internal_stock' && maxAvailableStock <= 0 && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Item is out of stock in shop inventory. Switch to "Brokered" to source from a peer.</span>
                    </div>
                  )}

                  {/* Price Breakdown */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Unit Price</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {unitPriceNum > 0 ? unitPriceNum.toLocaleString() : '—'} ETB
                      </span>
                    </div>

                    {quantity > 1 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Gross Subtotal ({quantity} × {unitPriceNum.toLocaleString()})</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {grossSubtotal > 0 ? grossSubtotal.toLocaleString() : '—'} ETB
                        </span>
                      </div>
                    )}

                    {calculatedDiscountAmount > 0 && (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400">
                        <span>
                          Discount {discountType === 'percent' ? `(${rawDiscountVal}%)` : '(Fixed)'}
                        </span>
                        <span className="font-mono font-bold">
                          -{calculatedDiscountAmount.toLocaleString()} ETB
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-slate-900 dark:text-white">Total Net Payable</span>
                      <span className="font-mono font-black text-base text-slate-900 dark:text-white">
                        {totalAfterDiscount > 0 ? totalAfterDiscount.toLocaleString() : '—'} ETB
                      </span>
                    </div>

                    {unitPriceNum > 0 && (
                      <>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Amount Paid</span>
                          <span className="font-mono font-bold">{paidNum.toLocaleString()} ETB</span>
                        </div>

                        {isCredit && (
                          <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Balance Due (Credit)
                            </span>
                            <span className="font-mono">{balanceDue.toLocaleString()} ETB</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Credit Warning */}
                  {isCredit && unitPriceNum > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      A receivable debt of {balanceDue.toLocaleString()} ETB will be created for {customerId ? 'this customer' : 'anonymous debtor'}.
                    </div>
                  )}

                  {/* Brokered Margin */}
                  {brokeredProfit !== null && (
                    <div className={`p-2.5 rounded-xl text-[11px] font-bold text-center ${
                      brokeredProfit > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                        : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50'
                    }`}>
                      Total margin: {brokeredProfit > 0 ? '+' : ''}{brokeredProfit.toLocaleString()} ETB ({quantity} units)
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Submit Button */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleSubmitSale}
                disabled={
                  submitting ||
                  !selectedVariantId ||
                  unitPriceNum <= 0 ||
                  quantity <= 0 ||
                  (sourcingType === 'internal_stock' && (maxAvailableStock <= 0 || quantity > maxAvailableStock))
                }
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingBag className="w-4 h-4" />
                )}
                <span>
                  {submitting
                    ? 'Recording...'
                    : !selectedVariantId
                    ? 'Select a Product'
                    : sourcingType === 'internal_stock' && maxAvailableStock <= 0
                    ? 'Out of Stock in Inventory'
                    : unitPriceNum <= 0
                    ? 'Enter Unit Price'
                    : `Complete Sale (${quantity}x) — ${totalAfterDiscount.toLocaleString()} ETB`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
