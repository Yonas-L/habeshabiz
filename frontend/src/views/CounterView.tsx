import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Product, ProductVariant, InventoryUnit, Contact, FinancialAccount, User } from '../api/client';
import { api } from '../api/client';
import { toast } from 'sonner';
import {
  ShoppingBag,
  Loader2,
  Search,
  X,
  Check,
  ChevronRight,
  ArrowLeft,
  Smartphone,
  Battery,
  CreditCard,
  Wallet,
  Banknote,
  Receipt,
  User as UserIcon,
  Tag,
  AlertTriangle,
  Plus,
  Minus,
  Handshake,
  TrendingUp,
  Repeat,
  Wrench,
} from 'lucide-react';
import { AccountLogo } from '../utils/bankLogos';
import { ExchangeDeviceModal, type ExchangeDevicePayload } from '../components/counter/ExchangeDeviceModal';
import type { ProductCategory } from '../api/client';

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
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [availableUnits, setAvailableUnits] = useState<InventoryUnit[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);
  const [productSearch, setProductSearch] = useState('');

  const [liveContacts, setLiveContacts] = useState<Contact[]>(contacts);

  useEffect(() => {
    setLiveContacts(contacts);
  }, [contacts]);

  // Pricing & Discount
  const [unitSellingPrice, setUnitSellingPrice] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('telebirr');
  const [financialAccountId, setFinancialAccountId] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerMode, setCustomerMode] = useState<'walk_in' | 'new' | 'existing'>('walk_in');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Exchange / Trade-In State
  const [exchangeDevice, setExchangeDevice] = useState<ExchangeDevicePayload | null>(null);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);

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
      const [prods, units, cats] = await Promise.all([
        api.getProducts(),
        api.getInventoryUnits({ status: 'in_stock' }),
        api.getCategories(),
      ]);
      setProducts(prods);
      setAvailableUnits(units);
      setCategories(cats);

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
  const unitsForVariant = useMemo(() => {
    if (!selectedVariantId) return [];
    const fromAvailable = availableUnits.filter((u) => u.variant_id === selectedVariantId);
    if (fromAvailable.length > 0) return fromAvailable;
    return (selectedVariant?.inventory_units || []).filter((u) => u.status === 'in_stock');
  }, [availableUnits, selectedVariantId, selectedVariant]);

  // Calculate maximum available stock for inventory
  const maxAvailableStock = useMemo(() => {
    if (!selectedVariant) return 0;

    const inStockUnitsCount = unitsForVariant.length;
    const quantityOnHand = selectedVariant.stock?.quantity_on_hand ?? 0;

    if (selectedProduct?.has_serials) {
      return inStockUnitsCount;
    }

    return Math.max(quantityOnHand, inStockUnitsCount);
  }, [selectedVariant, selectedProduct, unitsForVariant]);

  const customerList = liveContacts.filter((c) => c.roles.includes('customer') || c.roles.includes('debtor'));
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
        const serialUnitsCount = availableUnits.filter((u) => variantIds.includes(u.variant_id)).length;
        const nonSerialCount = p.variants.reduce((sum, v) => sum + (v.stock?.quantity_on_hand ?? 0), 0);
        const stockCount = p.has_serials ? serialUnitsCount : Math.max(serialUnitsCount, nonSerialCount);
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
  const tradeInAllowance = exchangeDevice ? Number(exchangeDevice.trade_in_value || 0) : 0;
  const netCashDue = Math.max(0, totalAfterDiscount - tradeInAllowance);
  const paidNum = parseFloat(paidAmount) || 0;
  const balanceDue = Math.max(0, netCashDue - paidNum);
  const isCredit = balanceDue > 0;

  // Upsell bonus calculation
  const currentVariant = useMemo(() => {
    return products.flatMap((p) => p.variants).find((v) => v.id === selectedVariantId) || null;
  }, [products, selectedVariantId]);
  const selectedSingleUnit = useMemo(() => {
    return selectedUnitIds.length === 1 ? availableUnits.find((u) => u.id === selectedUnitIds[0]) || null : null;
  }, [selectedUnitIds, availableUnits]);
  const settedPrice = Number(selectedSingleUnit?.selling_price || currentVariant?.default_selling_price || 0);
  const isUpsell = settedPrice > 0 && unitPriceNum > settedPrice;
  const upsellBonusPerUnit = isUpsell ? unitPriceNum - settedPrice : 0;
  const rawTotalBonus = upsellBonusPerUnit * quantity;
  const netEstimatedBonus = Math.max(0, rawTotalBonus - calculatedDiscountAmount);

  const isSerialRequired = !!selectedProduct?.has_serials;
  const hasSelectedSerials = selectedUnitIds.length > 0;
  const isSerialComplete = !isSerialRequired || (hasSelectedSerials && selectedUnitIds.length === quantity);
  const selectedUnitsHaveConsignment = useMemo(() => {
    return selectedUnitIds.some((uId) => {
      const u = availableUnits.find((unit) => unit.id === uId);
      return u?.source_type === 'consignment';
    });
  }, [selectedUnitIds, availableUnits]);

  const selectedUnitsHaveExchange = useMemo(() => {
    return selectedUnitIds.some((uId) => {
      const u = availableUnits.find((unit) => unit.id === uId);
      return u?.source_type === 'exchange' || Boolean(u?.exchange_sales_order_id);
    });
  }, [selectedUnitIds, availableUnits]);

  const outgoingUnitCost = useMemo(() => {
    if (selectedUnitIds.length > 0) {
      const u = availableUnits.find((unit) => unit.id === selectedUnitIds[0]);
      if (u && Number(u.cost_basis || 0) > 0) return Number(u.cost_basis);
    }
    return Number(selectedVariant?.stock?.average_cost || 0);
  }, [selectedUnitIds, availableUnits, selectedVariant]);

  // Step progress
  const step1Done = !!selectedProductId;
  const step2Done = !!selectedVariantId && (!isSerialRequired || isSerialComplete);
  const step3Done = unitPriceNum > 0 && quantity > 0 && maxAvailableStock > 0;
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    const vList = prod?.variants || [];

    // Auto-select the first in-stock variant, or the first variant if available
    const preferredVariant = vList.find((v) => {
      const uCount = availableUnits.filter((u) => u.variant_id === v.id).length || (v.inventory_units || []).filter((u) => u.status === 'in_stock').length;
      const qOnHand = v.stock?.quantity_on_hand ?? 0;
      return prod?.has_serials ? uCount > 0 : Math.max(uCount, qOnHand) > 0;
    }) || (vList.length > 0 ? vList[0] : undefined);

    if (preferredVariant) {
      handleSelectVariant(preferredVariant, prod);
    } else {
      setSelectedVariantId('');
      setSelectedUnitIds([]);
      setQuantity(1);
      setUnitSellingPrice('');
      setDiscountValue('');
      setPaidAmount('');
    }
    setProductSearch('');
  };

  const handleSelectVariant = (variant: ProductVariant, prodOverride?: Product) => {
    setSelectedVariantId(variant.id);
    const prod = prodOverride || selectedProduct || products.find((p) => p.variants.some((v) => v.id === variant.id));

    // Auto-select the first in-stock unit if product requires serials
    const vUnits = availableUnits.filter((u) => u.variant_id === variant.id);
    const inStockUnits = vUnits.length > 0 ? vUnits : (variant.inventory_units || []).filter((u) => u.status === 'in_stock');
    if (prod?.has_serials && inStockUnits.length > 0) {
      setSelectedUnitIds([inStockUnits[0].id]);
    } else {
      setSelectedUnitIds([]);
    }

    setQuantity(1);
    const firstUnit = inStockUnits[0];
    const initialPrice = firstUnit?.selling_price || variant.default_selling_price;
    if (initialPrice) {
      const priceStr = String(initialPrice);
      setUnitSellingPrice(priceStr);
      const remCash = exchangeDevice ? Math.max(0, Number(priceStr) - exchangeDevice.trade_in_value) : Number(priceStr);
      setPaidAmount(String(remCash));
    }
  };

  // Auto-select first in-stock unit for serial products if none selected yet
  useEffect(() => {
    if (selectedProduct?.has_serials && selectedVariantId && unitsForVariant.length > 0 && selectedUnitIds.length === 0) {
      const first = unitsForVariant[0];
      setSelectedUnitIds([first.id]);
      if (first.selling_price) {
        setUnitSellingPrice(String(first.selling_price));
      }
    }
  }, [selectedProduct?.has_serials, selectedVariantId, unitsForVariant, selectedUnitIds.length]);

  const handleToggleUnit = (unitId: string) => {
    setSelectedUnitIds((prev) => {
      const isRemoving = prev.includes(unitId);
      if (!isRemoving && maxAvailableStock > 0 && prev.length >= maxAvailableStock) {
        toast.warning(`All ${maxAvailableStock} available unit(s) are selected.`);
        return prev;
      }
      const next = isRemoving ? prev.filter((id) => id !== unitId) : [...prev, unitId];
      const newQty = next.length > 0 ? next.length : 1;
      setQuantity(newQty);

      if (next.length === 1) {
        const single = availableUnits.find((u) => u.id === next[0]);
        const targetPrice = single?.selling_price || selectedVariant?.default_selling_price;
        if (targetPrice) {
          setUnitSellingPrice(String(targetPrice));
        }
      }

      if (unitPriceNum > 0) {
        const newGross = unitPriceNum * newQty;
        const discountAmt = discountType === 'percent'
          ? (newGross * Math.min(100, rawDiscountVal)) / 100
          : Math.min(newGross, rawDiscountVal);
        const newTotal = Math.max(0, newGross - discountAmt);
        const remCash = tradeInAllowance > 0 ? Math.max(0, newTotal - tradeInAllowance) : newTotal;
        setPaidAmount(String(remCash));
      }
      return next;
    });
  };

  const handleQuantityChange = (newQty: number) => {
    if (maxAvailableStock <= 0) {
      toast.error('Item is out of stock.');
      setQuantity(1);
      return;
    }
    if (newQty > maxAvailableStock) {
      toast.warning(`Maximum available stock is ${maxAvailableStock}.`);
      newQty = maxAvailableStock;
    }
    const validQty = Math.max(1, newQty);
    setQuantity(validQty);
    if (unitPriceNum > 0) {
      const newGross = unitPriceNum * validQty;
      const discountAmt = discountType === 'percent'
        ? (newGross * Math.min(100, rawDiscountVal)) / 100
        : Math.min(newGross, rawDiscountVal);
      const newTotal = Math.max(0, newGross - discountAmt);
      const remCash = tradeInAllowance > 0 ? Math.max(0, newTotal - tradeInAllowance) : newTotal;
      setPaidAmount(String(remCash));
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
    const remCash = tradeInAllowance > 0 ? Math.max(0, newTotal - tradeInAllowance) : newTotal;
    setPaidAmount(String(remCash));
  };

  const handleDiscountChange = (val: string, type: 'percent' | 'fixed') => {
    let d = parseFloat(val) || 0;
    if (d < 0) d = 0;
    if (type === 'percent' && d > 100) {
      d = 100;
      toast.warning('Discount percentage cannot exceed 100%.');
    } else if (type === 'fixed' && grossSubtotal > 0 && d > grossSubtotal) {
      d = grossSubtotal;
      toast.warning(`Fixed discount cannot exceed ${grossSubtotal.toLocaleString()} ETB.`);
    }

    setDiscountValue(val === '' ? '' : String(d));
    const discountAmt = type === 'percent'
      ? (grossSubtotal * Math.min(100, d)) / 100
      : Math.min(grossSubtotal, d);
    const newTotal = Math.max(0, grossSubtotal - discountAmt);
    const remCash = tradeInAllowance > 0 ? Math.max(0, newTotal - tradeInAllowance) : newTotal;
    setPaidAmount(String(remCash));
  };

  const handlePaidAmountChange = (val: string) => {
    setPaidAmount(val);
    const paidVal = parseFloat(val) || 0;

    // Total gross customer value: cash paid + trade-in allowance + applied discount
    const totalCustomerValue = paidVal + tradeInAllowance + calculatedDiscountAmount;
    const perUnitReceived = quantity > 0 ? totalCustomerValue / quantity : totalCustomerValue;

    // Dynamic upsell: if customer pays above the baseline set selling price, raise unitSellingPrice so upsell bonus triggers
    if (settedPrice > 0) {
      if (perUnitReceived > settedPrice) {
        setUnitSellingPrice(String(perUnitReceived));
      } else if (unitPriceNum > settedPrice && perUnitReceived <= settedPrice) {
        setUnitSellingPrice(String(settedPrice));
      }
    }
  };

  const resetForm = () => {
    setSelectedProductId('');
    setSelectedVariantId('');
    setSelectedUnitIds([]);
    setQuantity(1);
    setUnitSellingPrice('');
    setDiscountValue('');
    setPaidAmount('');
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerMode('walk_in');
    setNotes('');
    setProductSearch('');
    setExchangeDevice(null);
  };

  const handleBackToProducts = () => {
    setSelectedProductId('');
    setSelectedVariantId('');
    setSelectedUnitIds([]);
    setQuantity(1);
    setUnitSellingPrice('');
    setDiscountValue('');
    setPaidAmount('');
    setProductSearch('');
    setTimeout(() => {
      searchRef.current?.focus();
    }, 50);
  };

  const handleSubmitSale = async () => {
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }
    if (!selectedVariantId) {
      toast.error('Please select a product variant');
      return;
    }
    if (isSerialRequired && !isSerialComplete) {
      toast.error(
        selectedUnitIds.length === 0
          ? 'Please select the IMEI / serial unit before completing the sale.'
          : `Please select all ${quantity} serial unit(s) before completing the sale.`
      );
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
    if (maxAvailableStock <= 0) {
      toast.error('Item is out of stock in shop inventory.');
      return;
    }
    if (quantity > maxAvailableStock) {
      toast.error(`Sale quantity (${quantity}) exceeds available stock (${maxAvailableStock}).`);
      return;
    }

    try {
      setSubmitting(true);

      let itemsPayload: Array<{
        variant_id: string;
        inventory_unit_id: string | null;
        quantity: number;
        unit_price: number;
        setted_price?: number;
        sourcing_type: 'internal_stock';
        vendor_contact_id: string | null;
        vendor_cost: number | null;
      }> = [];

      if (selectedUnitIds.length > 0) {
        itemsPayload = selectedUnitIds.map((uId) => ({
          variant_id: selectedVariantId,
          inventory_unit_id: uId,
          quantity: 1,
          unit_price: unitPriceNum,
          setted_price: settedPrice > 0 ? settedPrice : undefined,
          sourcing_type: 'internal_stock',
          vendor_contact_id: null,
          vendor_cost: null,
        }));
      } else {
        itemsPayload = [
          {
            variant_id: selectedVariantId,
            inventory_unit_id: null,
            quantity: quantity,
            unit_price: unitPriceNum,
            setted_price: settedPrice > 0 ? settedPrice : undefined,
            sourcing_type: 'internal_stock',
            vendor_contact_id: null,
            vendor_cost: null,
          },
        ];
      }

      const salePayload: any = {
        customer_id: customerMode === 'existing' ? (customerId || null) : null,
        customer_name: customerMode === 'new' && customerName.trim() ? customerName.trim() : null,
        customer_phone: customerMode === 'new' && customerPhone.trim() ? customerPhone.trim() : null,
        discount_amount: calculatedDiscountAmount,
        paid_amount: paidNum,
        payment_method: paymentMethod,
        financial_account_id: paidNum > 0 ? financialAccountId : null,
        notes: notes || null,
        items: itemsPayload,
      };

      if (exchangeDevice && exchangeDevice.trade_in_value > 0) {
        salePayload.exchange = {
          variant_id: exchangeDevice.variant_id,
          trade_in_value: exchangeDevice.trade_in_value,
          imei_or_serial: exchangeDevice.imei_or_serial || null,
          condition: exchangeDevice.condition,
          battery_health: exchangeDevice.battery_health ?? null,
          cycle_count: exchangeDevice.cycle_count ?? null,
          sim_type: exchangeDevice.sim_type || 'physical',
          location: exchangeDevice.location || 'Shop Counter',
          notes: exchangeDevice.notes || null,
        };
      }

      const order = await api.recordSale(salePayload);

      const bonusEarned = Number(order.total_bonus_amount || 0);
      if (bonusEarned > 0) {
        toast.success(`Sale recorded: Order #${order.order_number}`, {
          description: `+${bonusEarned.toLocaleString()} ETB bonus earned — marked uncollected on your dashboard.`,
        });
      } else {
        toast.success(`Sale recorded: Order #${order.order_number}`);
      }

      resetForm();
      loadData();
      onSaleSuccess();
    } catch (err: any) {
      toast.error('Failed to record sale', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const variantLabel = (v: ProductVariant) => {
    const specParts = v.specs ? Object.values(v.specs).map(String) : [];
    const parts = [v.storage, v.ram ? `${v.ram} RAM` : null, v.color, ...specParts].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Standard';
  };

  if (loading && products.length === 0) {
    return (
      <div className="py-24 text-center text-slate-400 dark:text-slate-500 text-xs flex items-center justify-center gap-2 animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
        <span>Loading POS workspace...</span>
      </div>
    );
  }

  return (
    <div className="animate-page-enter space-y-4">
      {/* Step progress & Back Navigation */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {selectedProductId && (
          <>
            <button
              type="button"
              onClick={handleBackToProducts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs active:scale-95 transition-all cursor-pointer group"
              title="Return to product selection"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
              <span>Back to Products</span>
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
          </>
        )}
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
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
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
                    No products found
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredProducts.map((p) => {
                      const cat = p.category_rel?.name || p.category || '';
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProduct(p.id)}
                          className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-600 transition-all text-left group cursor-pointer"
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-tight truncate" title={p.name}>
                            {p.name}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400 truncate">
                              {p.brand || cat}
                            </span>
                            <span className={`text-[10px] font-bold font-mono ${
                              p.stockCount > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                            }`}>
                              {p.stockCount}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-xs" title={selectedProduct.name}>
                      {selectedProduct.name}
                    </span>
                    {selectedProduct.brand && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {selectedProduct.brand}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToProducts}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all cursor-pointer"
                    title="Change selected product"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Change Product</span>
                  </button>
                </div>

                {/* ── STEP 2: Variant Chips ── */}
                <div className="mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                    Variant
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
                          className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500'
                          }`}
                        >
                          {variantLabel(v)}
                          <span className={`ml-1.5 text-[10px] font-bold font-mono ${
                            vStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                          }`}>
                            ({vStock})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Serial Unit Selection ── */}
          {selectedVariant && selectedProduct?.has_serials && (
            <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    {tradeInAllowance > 0 ? 'Outgoing Device to Hand Over' : 'Serial Units'} ({unitsForVariant.length} in stock)
                  </span>
                  {tradeInAllowance > 0 && (
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      Select the stock unit to give to customer
                    </span>
                  )}
                </div>
                {selectedUnitIds.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedUnitIds.length} selected
                  </span>
                )}
              </div>

              {unitsForVariant.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Out of stock in shop inventory.</span>
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {unitsForVariant.map((u) => {
                      const isSelected = selectedUnitIds.includes(u.id);
                      const isExchange = u.source_type === 'exchange';
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleToggleUnit(u.id)}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                              : isExchange
                                ? 'border-purple-300 dark:border-purple-800/80 bg-purple-50/20 dark:bg-purple-950/10 hover:border-purple-400 dark:hover:border-purple-600'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px] truncate">
                                {u.imei_or_serial || 'No Serial'}
                              </span>
                              {u.battery_health && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400">
                                  <Battery className="w-3 h-3 text-slate-400 shrink-0" />
                                  {u.battery_health}%
                                </span>
                              )}
                              {u.source_type === 'consignment' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                  <Handshake className="w-2.5 h-2.5" />
                                  Vendor
                                </span>
                              )}
                              {isExchange && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50">
                                  <Repeat className="w-2.5 h-2.5" />
                                  Exchanged
                                </span>
                              )}
                              {(u.is_repaired || (u.maintenance_records && u.maintenance_records.length > 0)) && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50">
                                  <Wrench className="w-2.5 h-2.5" />
                                  Repaired
                                </span>
                              )}
                            </div>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-slate-700'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Quantity, Pricing & Payment ── */}
          {selectedVariant && (
            <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] space-y-4">
              
              {/* ── Quantity Stepper Section ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</span>
                  <span className={`text-[10px] font-semibold ${
                    maxAvailableStock > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400'
                  }`}>
                    {maxAvailableStock > 0 ? `${maxAvailableStock} available` : 'Out of stock'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1 || maxAvailableStock <= 0}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxAvailableStock > 0 ? maxAvailableStock : 1}
                      value={quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      disabled={maxAvailableStock <= 0}
                      className="w-12 text-center font-mono font-black text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none disabled:opacity-30"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={quantity >= maxAvailableStock}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="hidden sm:flex items-center gap-1">
                    {[1, 2, 3, 5, 10].map((count) => {
                      const isOverStock = count > maxAvailableStock;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => handleQuantityChange(count)}
                          disabled={isOverStock}
                          className={`h-8 px-2.5 rounded-lg text-xs font-mono font-bold transition-all ${
                            quantity === count
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                              : isOverStock
                              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {count}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Price & Discount Inputs ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Unit Price */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <Tag className="w-3 h-3 inline mr-0.5" />
                      Unit Price (ETB) *
                    </label>
                    {settedPrice > 0 && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Base: <strong className="text-slate-600 dark:text-slate-300 font-medium">{settedPrice.toLocaleString()} ETB</strong>
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={unitSellingPrice}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    required
                  />
                  {quantity > 1 && unitPriceNum > 0 && (
                    <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                      Subtotal: {grossSubtotal.toLocaleString()} ETB
                    </span>
                  )}
                  {isUpsell && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                      <TrendingUp className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>
                        +{netEstimatedBonus.toLocaleString()} ETB Bonus · +{upsellBonusPerUnit.toLocaleString()} above target
                      </span>
                    </div>
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
                        %
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
                        ETB
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
                      placeholder={discountType === 'percent' ? '0%' : '0 ETB'}
                      className="w-full h-10 pl-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-40"
                    />
                    <div className="absolute right-3 top-2.5 text-xs font-mono font-bold text-slate-400 pointer-events-none">
                      {discountType === 'percent' ? '%' : 'ETB'}
                    </div>
                  </div>

                  {calculatedDiscountAmount > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-mono font-bold">
                      -{calculatedDiscountAmount.toLocaleString()} ETB ({discountType === 'percent' ? `${rawDiscountVal}%` : `${((calculatedDiscountAmount / (grossSubtotal || 1)) * 100).toFixed(1)}%`})
                    </span>
                  )}
                </div>

                {/* 3. Paid Now */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Amount Paid (ETB)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsExchangeModalOpen(true)}
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${
                        exchangeDevice
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-600 dark:text-slate-300 hover:text-purple-600'
                      }`}
                    >
                      <Repeat className="w-3 h-3 text-purple-500" />
                      {exchangeDevice ? 'Exchange Added' : 'Exchange'}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => handlePaidAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    required
                  />

                  {/* Active Exchange Chip (Minimal 1-line) */}
                  {exchangeDevice ? (
                    <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0 pr-2">
                        <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="font-semibold text-purple-900 dark:text-purple-200 truncate">
                          Exchange: {exchangeDevice.product_name}
                        </span>
                        {exchangeDevice.imei_or_serial && (
                          <span className="text-[10px] text-purple-600/80 dark:text-purple-400/80 font-mono truncate">
                            ({exchangeDevice.imei_or_serial})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsExchangeModalOpen(true)}
                          className="text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:underline px-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExchangeDevice(null);
                            setPaidAmount(String(totalAfterDiscount));
                          }}
                          className="w-5 h-5 rounded flex items-center justify-center text-purple-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                          title="Remove exchange"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Warning if total trade-in credit + cash does not cover outgoing unit cost */}
                  {exchangeDevice && outgoingUnitCost > 0 && (Number(exchangeDevice.trade_in_value) + paidNum < outgoingUnitCost) && (
                    <div className="mt-1.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-[11px] font-semibold">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        Below shop cost by {(outgoingUnitCost - (Number(exchangeDevice.trade_in_value) + paidNum)).toLocaleString()} ETB
                      </span>
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 font-mono uppercase">Loss Deal</span>
                    </div>
                  )}

                  {netCashDue >= 0 && paidNum !== netCashDue && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(String(netCashDue))}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-1 block font-medium underline"
                    >
                      Set extra cash customer pays ({netCashDue.toLocaleString()} ETB)
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
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(m.value);
                          setPaidAmount(String(totalAfterDiscount));
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

              {/* Receiving Account */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Receiving Account
                  </label>
                  {(() => {
                    const sel = treasuryAccounts.find((a) => a.id === financialAccountId);
                    return sel ? <AccountLogo account={sel} size="xs" /> : null;
                  })()}
                </div>
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

              {/* Customer Selection / New Customer */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <UserIcon className="w-3 h-3 inline mr-1" />
                    Customer
                  </label>

                  {/* Customer Mode Pills */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('walk_in');
                        setCustomerId('');
                        setCustomerName('');
                        setCustomerPhone('');
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        customerMode === 'walk_in'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Walk-in
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('new');
                        setCustomerId('');
                      }}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        customerMode === 'new'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      + New
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('existing')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        customerMode === 'existing'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Existing ({customerList.length})
                    </button>
                  </div>
                </div>

                {customerMode === 'walk_in' && (
                  <div className="h-9 px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs text-slate-500">
                    <span>Walk-in Customer (Anonymous)</span>
                    <span className="text-[10px] text-slate-400">Default</span>
                  </div>
                )}

                {customerMode === 'new' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer Name (optional)"
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone (optional, 09...)"
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                  </div>
                )}

                {customerMode === 'existing' && (
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                  >
                    <option value="">— Select Existing Customer —</option>
                    {customerList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                )}
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
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Summary
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Empty State */}
              {!selectedProduct ? (
                <div className="py-8 text-center">
                  <ShoppingBag className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-medium">Select a product to begin</p>
                </div>
              ) : (
                <>
                  {/* Product Line Item */}
                  <div className="py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
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
                                <div key={uId} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span>{u?.imei_or_serial || 'Unknown'}</span>
                                  {u?.source_type === 'consignment' && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                      <Handshake className="w-2.5 h-2.5" />
                                      Vendor
                                    </span>
                                  )}
                                  {(u?.source_type === 'exchange' || Boolean(u?.exchange_sales_order_id)) && (
                                    <span className="text-[9px] text-slate-400 font-sans">
                                      (Exchanged)
                                    </span>
                                  )}
                                  {(u?.is_repaired || (u?.maintenance_records && u.maintenance_records.length > 0)) && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-600 dark:text-teal-400">
                                      <Wrench className="w-2.5 h-2.5" />
                                      Repaired
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {selectedUnitsHaveConsignment && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                            Vendor consignment unit
                          </div>
                        )}
                        {selectedUnitsHaveExchange && (
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Exchanged stock unit
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        ×{quantity}
                      </span>
                    </div>
                  </div>

                  {/* Out of Stock Warning */}
                  {selectedVariant && maxAvailableStock <= 0 && (
                    <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Out of stock in shop inventory.</span>
                    </div>
                  )}

                  {/* Price Breakdown */}
                  <div className="space-y-2 text-xs">
                    {/* Customer in Summary */}
                    {((customerMode === 'new' && (customerName.trim() || customerPhone.trim())) || (customerMode === 'existing' && customerId)) ? (
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1 text-[11px]">
                          <UserIcon className="w-3 h-3 text-slate-400" />
                          Customer
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[160px] text-right">
                          {customerMode === 'new'
                            ? `${customerName.trim() || 'Customer'}${customerPhone.trim() ? ` · ${customerPhone.trim()}` : ''}`
                            : (customerList.find((c) => c.id === customerId)?.name || 'Walk-in')}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Unit Price</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {unitPriceNum > 0 ? unitPriceNum.toLocaleString() : '—'} ETB
                      </span>
                    </div>

                    {quantity > 1 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Subtotal ({quantity}x)</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {grossSubtotal > 0 ? grossSubtotal.toLocaleString() : '—'} ETB
                        </span>
                      </div>
                    )}

                    {calculatedDiscountAmount > 0 && (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400">
                        <span>
                          Discount {discountType === 'percent' ? `(${rawDiscountVal}%)` : ''}
                        </span>
                        <span className="font-mono font-bold whitespace-nowrap">
                          -{calculatedDiscountAmount.toLocaleString()} ETB
                        </span>
                      </div>
                    )}

                    {tradeInAllowance > 0 && (
                      <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                        <span>Exchanged Device</span>
                        <span className="font-mono font-bold whitespace-nowrap text-purple-600 dark:text-purple-400">
                          −{tradeInAllowance.toLocaleString()} ETB
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {tradeInAllowance > 0 ? 'Cash Difference to Pay' : 'Net Total'}
                      </span>
                      <span className="font-mono font-black text-base text-slate-900 dark:text-white whitespace-nowrap">
                        {netCashDue > 0 ? netCashDue.toLocaleString() : '0'} ETB
                      </span>
                    </div>

                    {unitPriceNum > 0 && (
                      <>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Cash/Transfer Paid</span>
                          <span className="font-mono font-bold whitespace-nowrap">{paidNum.toLocaleString()} ETB</span>
                        </div>

                        {isCredit && (
                          <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Balance Due (Credit)
                            </span>
                            <span className="font-mono whitespace-nowrap">{balanceDue.toLocaleString()} ETB</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Submit Button */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleSubmitSale}
                disabled={
                  submitting ||
                  !selectedProductId ||
                  !selectedVariantId ||
                  !isSerialComplete ||
                  unitPriceNum <= 0 ||
                  quantity <= 0 ||
                  maxAvailableStock <= 0 ||
                  quantity > maxAvailableStock
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
                    ? 'Processing...'
                    : !selectedProductId
                    ? 'Select Product'
                    : !selectedVariantId
                    ? 'Select Variant'
                    : maxAvailableStock <= 0
                    ? 'Out of Stock'
                    : isSerialRequired && !hasSelectedSerials
                    ? (tradeInAllowance > 0 ? 'Select Outgoing Device IMEI' : 'Select IMEI / Serial Unit')
                    : isSerialRequired && selectedUnitIds.length < quantity
                    ? `Select ${quantity - selectedUnitIds.length} More Serial(s)`
                    : unitPriceNum <= 0
                    ? 'Enter Unit Price'
                    : tradeInAllowance > 0
                    ? `Complete Exchange (${quantity}x) — ${paidNum > 0 ? `Customer Pays ${paidNum.toLocaleString()} ETB Cash` : 'Direct Exchange'}`
                    : `Complete Sale (${quantity}x) — ${totalAfterDiscount.toLocaleString()} ETB`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Device Modal */}
      <ExchangeDeviceModal
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
        categories={categories}
        products={products}
        availableUnits={availableUnits}
        outgoingUnitCost={outgoingUnitCost}
        outgoingUnitPrice={unitPriceNum}
        currentPaidCash={paidNum}
        initialExchange={exchangeDevice}
        onReloadProducts={loadData}
        onConfirmExchange={(payload) => {
          const oldDiff = exchangeDevice ? Math.max(0, totalAfterDiscount - Number(exchangeDevice.trade_in_value)) : -1;
          const newDiff = Math.max(0, totalAfterDiscount - payload.trade_in_value);
          setExchangeDevice(payload);
          if (
            !paidAmount ||
            Number(paidAmount) === 0 ||
            Number(paidAmount) === totalAfterDiscount ||
            Number(paidAmount) === oldDiff
          ) {
            setPaidAmount(String(newDiff));
          }
          toast.success(`Exchange attached: ${payload.product_name}`);
        }}
      />
    </div>
  );
};
