import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Product, ProductVariant, InventoryUnit, Contact, FinancialAccount, User, SalesOrder } from '../api/client';
import { api } from '../api/client';
import { CustomPageLoader } from '../components/loading/CustomPageLoader';
import { toast } from 'sonner';
import {
  ShoppingBag,
  Loader2,
  Search,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Smartphone,
  Package,
  Battery,
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
  Clock,
  Clock3,
  Flag,
  ArrowLeftRight,
} from 'lucide-react';
import { SplitPaymentSelector, type PaymentSplitItem } from '../components/common/SplitPaymentSelector';
import { ExchangeDeviceModal, type ExchangeDevicePayload } from '../components/counter/ExchangeDeviceModal';
import { VendorDirectSaleModal } from '../components/counter/VendorDirectSaleModal';
import { AccessoryAttachmentSection, type AttachedAccessoryItem } from '../components/counter/AccessoryAttachmentSection';
import type { ProductCategory } from '../api/client';
import { formatUnitDisplayIdentifier, getCategoryArchetype } from '../utils/electronicsArchetypes';

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
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const [liveContacts, setLiveContacts] = useState<Contact[]>(contacts);

  useEffect(() => {
    setLiveContacts(contacts);
  }, [contacts]);

  // Pricing & Discount
  const [unitSellingPrice, setUnitSellingPrice] = useState<string>('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [isWriteOff, setIsWriteOff] = useState(false);
  const [financialAccountId, setFinancialAccountId] = useState<string>('');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitItem[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [customerMode, setCustomerMode] = useState<'walk_in' | 'new' | 'existing'>('walk_in');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [debtOffsetAmount, setDebtOffsetAmount] = useState<string>('');
  const [cashTransferAmount, setCashTransferAmount] = useState<string>('');

  // Exchange / Trade-In State
  const [exchangeDevice, setExchangeDevice] = useState<ExchangeDevicePayload | null>(null);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
  const [isVendorDirectModalOpen, setIsVendorDirectModalOpen] = useState(false);
  const [attachedAccessories, setAttachedAccessories] = useState<AttachedAccessoryItem[]>([]);

  // Recent Models Search History
  const RECENT_SALES_MODELS_KEY = 'pos_recent_sales_models';
  const [recentSalesModelIds, setRecentSalesModelIds] = useState<string[]>(() => {
    try {
      const rawSales = localStorage.getItem('pos_recent_sales_models');
      const rawVendor = localStorage.getItem('pos_recent_vendor_models');
      const salesArr = rawSales ? JSON.parse(rawSales) : [];
      const vendorArr = rawVendor ? JSON.parse(rawVendor) : [];
      return Array.from(new Set([...salesArr, ...vendorArr])).slice(0, 8);
    } catch {
      return [];
    }
  });

  const [isModelSearchOpen, setIsModelSearchOpen] = useState(false);
  const modelSearchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modelSearchContainerRef.current &&
        !modelSearchContainerRef.current.contains(event.target as Node)
      ) {
        setIsModelSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recordRecentModel = (productId: string) => {
    if (!productId || productId === '__custom__') return;
    setRecentSalesModelIds((prev) => {
      const updated = [productId, ...prev.filter((id) => id !== productId)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SALES_MODELS_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
  };

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
      const [prods, units, cats, salesRes] = await Promise.all([
        api.getProducts(),
        api.getInventoryUnits({ status: 'in_stock' }),
        api.getCategories(),
        api.getSales({ per_page: 30 }).catch(() => [] as SalesOrder[]),
      ]);
      setProducts(prods);
      setAvailableUnits(units);
      setCategories(cats);

      // Extract recently sold product IDs
      const apiRecentIds: string[] = [];
      for (const order of salesRes) {
        for (const item of (order.items || [])) {
          const pId = item.variant?.product_id || item.variant?.product?.id;
          if (pId && !apiRecentIds.includes(pId)) {
            apiRecentIds.push(pId);
          }
        }
      }

      setRecentSalesModelIds((prev) => {
        const merged = Array.from(new Set([...prev, ...apiRecentIds])).slice(0, 8);
        try {
          localStorage.setItem(RECENT_SALES_MODELS_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }
        return merged;
      });

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

  // Products filtered by search and category, with in-stock count
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products
      .filter((p) => {
        if (selectedCategoryFilter !== 'all') {
          const pCatId = p.category_id || p.category_rel?.id;
          const pCatSlug = p.category_rel?.slug || p.category;
          const catObj = categories.find((c) => c.id === selectedCategoryFilter);
          const matchesId = pCatId === selectedCategoryFilter;
          const matchesSlug = pCatSlug === selectedCategoryFilter ||
            (catObj && (
              pCatSlug?.toLowerCase() === catObj.slug?.toLowerCase() ||
              pCatSlug?.toLowerCase() === catObj.name?.toLowerCase()
            ));
          if (!matchesId && !matchesSlug) {
            return false;
          }
        }
        if (!q) return true;
        const cat = p.category_rel?.name || p.category || '';
        const matchesText =
          p.name.toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q);
        if (matchesText) return true;

        // Fast search by unit serial number or IMEI
        const variantIds = (p.variants || []).map((v) => v.id);
        return availableUnits.some(
          (u) =>
            variantIds.includes(u.variant_id) &&
            ((u.imei_or_serial && u.imei_or_serial.toLowerCase().includes(q)) ||
              (u.serial_number && u.serial_number.toLowerCase().includes(q)))
        );
      })
      .map((p) => {
        const variantIds = p.variants.map((v) => v.id);
        const serialUnitsCount = availableUnits.filter((u) => variantIds.includes(u.variant_id)).length;
        const nonSerialCount = p.variants.reduce((sum, v) => sum + (v.stock?.quantity_on_hand ?? 0), 0);
        const stockCount = p.has_serials ? serialUnitsCount : Math.max(serialUnitsCount, nonSerialCount);
        return { ...p, stockCount };
      });
  }, [products, productSearch, availableUnits, selectedCategoryFilter, categories]);

  const recentModels = useMemo(() => {
    if (!recentSalesModelIds.length) return [];
    return recentSalesModelIds
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => {
        if (!p || p.is_active === false) return false;
        if (selectedCategoryFilter !== 'all') {
          const pCatId = p.category_id || p.category_rel?.id;
          const pCatSlug = p.category_rel?.slug || p.category;
          const catObj = categories.find((c) => c.id === selectedCategoryFilter);
          const matchesId = pCatId === selectedCategoryFilter;
          const matchesSlug =
            pCatSlug === selectedCategoryFilter ||
            (catObj &&
              (pCatSlug?.toLowerCase() === catObj.slug?.toLowerCase() ||
                pCatSlug?.toLowerCase() === catObj.name?.toLowerCase()));
          if (!matchesId && !matchesSlug) return false;
        }
        return true;
      })
      .map((p) => {
        const variantIds = (p.variants || []).map((v) => v.id);
        const serialUnitsCount = availableUnits.filter((u) => variantIds.includes(u.variant_id)).length;
        const nonSerialCount = (p.variants || []).reduce((sum, v) => sum + (v.stock?.quantity_on_hand ?? 0), 0);
        const stockCount = p.has_serials ? serialUnitsCount : Math.max(serialUnitsCount, nonSerialCount);
        return { ...p, stockCount };
      });
  }, [recentSalesModelIds, products, availableUnits, selectedCategoryFilter, categories]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsModelSearchOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts.length > 0) {
        handleSelectProduct(filteredProducts[0].id);
        setIsModelSearchOpen(false);
      } else if (recentModels.length > 0 && !productSearch.trim()) {
        handleSelectProduct(recentModels[0].id);
        setIsModelSearchOpen(false);
      }
    }
  };

  // Pricing & Discount calculations
  const unitPriceNum = parseFloat(unitSellingPrice) || 0;
  const grossSubtotal = unitPriceNum * quantity;

  // Accessories calculations
  const accessoriesTotal = useMemo(
    () => attachedAccessories.reduce((sum, a) => sum + (Number(a.price) || 0) * (Number(a.quantity) || 1), 0),
    [attachedAccessories]
  );
  const accessoriesCostTotal = useMemo(
    () => attachedAccessories.reduce((sum, a) => sum + (Number(a.cost) || 0) * (Number(a.quantity) || 1), 0),
    [attachedAccessories]
  );
  const combinedGross = grossSubtotal + accessoriesTotal;

  const rawDiscountVal = parseFloat(discountValue) || 0;

  const calculatedDiscountAmount = useMemo(() => {
    if (rawDiscountVal <= 0 || combinedGross <= 0) return 0;
    if (discountType === 'percent') {
      const pct = Math.min(100, Math.max(0, rawDiscountVal));
      return (combinedGross * pct) / 100;
    }
    return Math.min(combinedGross, Math.max(0, rawDiscountVal));
  }, [discountType, rawDiscountVal, combinedGross]);

  const totalAfterDiscount = Math.max(0, combinedGross - calculatedDiscountAmount);
  const tradeInAllowance = exchangeDevice ? Number(exchangeDevice.trade_in_value || 0) : 0;
  const netCashDue = Math.max(0, totalAfterDiscount - tradeInAllowance);
  const paidNum = parseFloat(paidAmount) || 0;

  const handleAccessoriesChange = (newAccs: AttachedAccessoryItem[]) => {
    const prevAccTotal = attachedAccessories.reduce((sum, a) => sum + (Number(a.price) || 0) * (Number(a.quantity) || 1), 0);
    const newAccTotal = newAccs.reduce((sum, a) => sum + (Number(a.price) || 0) * (Number(a.quantity) || 1), 0);
    setAttachedAccessories(newAccs);

    const currentPaid = parseFloat(paidAmount) || 0;
    const oldTotal = Math.max(0, grossSubtotal + prevAccTotal - calculatedDiscountAmount) - tradeInAllowance;
    if (currentPaid === oldTotal || !paidAmount) {
      const newTotal = Math.max(0, grossSubtotal + newAccTotal - calculatedDiscountAmount) - tradeInAllowance;
      setPaidAmount(String(Math.max(0, newTotal)));
    }
  };

  const isDebtOffset = paymentMethod === 'debt_offset' && !isCreditSale && !isWriteOff;
  const debtOffsetNum = isDebtOffset
    ? (debtOffsetAmount !== '' ? parseFloat(debtOffsetAmount) || 0 : netCashDue)
    : 0;
  const cashTransferNum = isDebtOffset
    ? (cashTransferAmount !== '' ? parseFloat(cashTransferAmount) || 0 : Math.max(0, netCashDue - debtOffsetNum))
    : 0;
  const effectiveCashInflow = isDebtOffset ? cashTransferNum : paidNum;
  const totalCustomerPaid = isDebtOffset ? (debtOffsetNum + cashTransferNum) : paidNum;

  const balanceDue = Math.max(0, netCashDue - totalCustomerPaid);
  const isCredit = balanceDue > 0;
  const hasUnmarkedBalance = isDebtOffset ? balanceDue > 0.01 : (balanceDue > 0 && !isCreditSale && !isWriteOff);

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
    setIsModelSearchOpen(false);
    recordRecentModel(productId);
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

  // Auto-select first in-stock unit(s) for serial products if none selected yet
  useEffect(() => {
    if (selectedProduct?.has_serials && selectedVariantId && unitsForVariant.length > 0 && selectedUnitIds.length === 0) {
      const neededCount = Math.min(Math.max(1, quantity), unitsForVariant.length);
      const toSelect = unitsForVariant.slice(0, neededCount).map((u) => u.id);
      setSelectedUnitIds(toSelect);
      const firstWithPrice = unitsForVariant.find((u) => Number(u.selling_price) > 0);
      const targetPrice = firstWithPrice?.selling_price || selectedVariant?.default_selling_price;
      if (targetPrice && (!unitSellingPrice || Number(unitSellingPrice) <= 0)) {
        setUnitSellingPrice(String(targetPrice));
      }
    }
  }, [selectedProduct?.has_serials, selectedVariantId, unitsForVariant, selectedUnitIds.length, quantity, selectedVariant, unitSellingPrice]);

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
      if (selectedProduct?.has_serials) {
        setSelectedUnitIds([]);
      }
      return;
    }
    if (newQty > maxAvailableStock) {
      toast.warning(`Maximum available stock is ${maxAvailableStock}.`);
      newQty = maxAvailableStock;
    }
    const validQty = Math.max(1, newQty);
    setQuantity(validQty);

    // Auto-select available serial units to match the requested quantity
    if (selectedProduct?.has_serials) {
      let nextUnits = [...selectedUnitIds];
      if (validQty > nextUnits.length) {
        const remaining = unitsForVariant.filter((u) => !nextUnits.includes(u.id));
        const needed = validQty - nextUnits.length;
        nextUnits = [...nextUnits, ...remaining.slice(0, needed).map((u) => u.id)];
      } else if (validQty < nextUnits.length) {
        nextUnits = nextUnits.slice(0, validQty);
      }
      setSelectedUnitIds(nextUnits);
    }

    const currentPrice = parseFloat(unitSellingPrice) || 0;
    const effectivePrice = currentPrice > 0
      ? currentPrice
      : Number(unitsForVariant.find((u) => Number(u.selling_price) > 0)?.selling_price || selectedVariant?.default_selling_price || 0);

    if (effectivePrice > 0) {
      if (currentPrice <= 0) {
        setUnitSellingPrice(String(effectivePrice));
      }
      const newGross = effectivePrice * validQty;
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
    setAttachedAccessories([]);
    setQuantity(1);
    setUnitSellingPrice('');
    setDiscountValue('');
    setPaidAmount('');
    setIsCreditSale(false);
    setIsWriteOff(false);
    setPaymentMethod('cash');
    setIsSplitPayment(false);
    setPaymentSplits([]);
    setCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerMode('walk_in');
    setNotes('');
    setProductSearch('');
    setIsModelSearchOpen(false);
    setDebtOffsetAmount('');
    setCashTransferAmount('');
    setExchangeDevice(null);
  };

  const handleBackToProducts = () => {
    setSelectedProductId('');
    setSelectedVariantId('');
    setSelectedUnitIds([]);
    setAttachedAccessories([]);
    setQuantity(1);
    setUnitSellingPrice('');
    setDiscountValue('');
    setPaidAmount('');
    setIsSplitPayment(false);
    setPaymentSplits([]);
    setProductSearch('');
    setIsModelSearchOpen(false);
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
    if (hasUnmarkedBalance) {
      toast.error('Collect the full amount or mark this checkout as a credit sale.');
      return;
    }
    if (paymentMethod === 'debt_offset' && (!customerId || customerMode !== 'existing')) {
      toast.error('Please select an existing customer/vendor contact for debt offset.');
      return;
    }

    if (effectiveCashInflow > 0) {
      if (isSplitPayment) {
        const splitSum = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        if (Math.abs(splitSum - effectiveCashInflow) > 0.01) {
          toast.error(`Split amounts (${splitSum.toLocaleString()} ETB) must equal bank cash deposit (${effectiveCashInflow.toLocaleString()} ETB)`);
          return;
        }
        if (paymentSplits.length === 0 || paymentSplits.some((s) => !s.financial_account_id || s.amount <= 0)) {
          toast.error('All split accounts must have a valid account and amount greater than 0');
          return;
        }
      } else if (!financialAccountId) {
        toast.error('Please select an account for depositing funds');
        return;
      }
    }

    try {
      setSubmitting(true);

      let itemsPayload: Array<{
        variant_id: string | null;
        inventory_unit_id: string | null;
        is_accessory?: boolean;
        accessory_name?: string | null;
        quantity: number;
        unit_price: number;
        setted_price?: number;
        sourcing_type: 'internal_stock' | 'brokered_neighbour';
        vendor_contact_id: string | null;
        vendor_cost: number | null;
        vendor_paid_now?: boolean;
        vendor_paid_amount?: number;
        vendor_payment_account_id?: string | null;
        vendor_payment_splits?: { financial_account_id: string; amount: number; reference_number?: string }[];
      }> = [];

      if (selectedUnitIds.length > 0) {
        itemsPayload = selectedUnitIds.map((uId) => ({
          variant_id: selectedVariantId,
          inventory_unit_id: uId,
          is_accessory: false,
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
            is_accessory: false,
            quantity: quantity,
            unit_price: unitPriceNum,
            setted_price: settedPrice > 0 ? settedPrice : undefined,
            sourcing_type: 'internal_stock',
            vendor_contact_id: null,
            vendor_cost: null,
          },
        ];
      }

      // Append attached accessories
      attachedAccessories.forEach((acc) => {
        const isVendor = acc.source === 'vendor';
        const vendorPaidNow = isVendor && acc.vendor_payment_method === 'paid_now';
        const isSplit = vendorPaidNow && !!acc.vendor_is_split && (acc.vendor_payment_splits?.length ?? 0) > 0;
        const validSplits = isSplit
          ? acc.vendor_payment_splits!.map((s) => ({
              financial_account_id: s.financial_account_id,
              amount: Number(s.amount) || 0,
            }))
          : undefined;

        itemsPayload.push({
          variant_id: acc.variant_id || null,
          inventory_unit_id: acc.inventory_unit_id || null,
          is_accessory: true,
          accessory_name: acc.name || null,
          quantity: acc.quantity || 1,
          unit_price: Number(acc.price) || 0,
          sourcing_type: isVendor ? 'brokered_neighbour' : 'internal_stock',
          vendor_contact_id: isVendor ? (acc.vendor_contact_id || null) : null,
          vendor_cost: isVendor ? (Number(acc.cost) || 0) : null,
          vendor_paid_now: vendorPaidNow,
          vendor_paid_amount: vendorPaidNow ? (Number(acc.cost) || 0) * (acc.quantity || 1) : 0,
          vendor_payment_account_id: vendorPaidNow
            ? isSplit
              ? validSplits![0]?.financial_account_id || null
              : acc.vendor_payment_account_id || null
            : null,
          vendor_payment_splits: validSplits,
        });
      });

      const salePayload: any = {
        customer_id: customerMode === 'existing' ? (customerId || null) : null,
        customer_name: customerMode === 'new' && customerName.trim() ? customerName.trim() : null,
        customer_phone: customerMode === 'new' && customerPhone.trim() ? customerPhone.trim() : null,
        discount_amount: calculatedDiscountAmount,
        paid_amount: totalCustomerPaid,
        debt_offset_amount: isDebtOffset ? debtOffsetNum : undefined,
        cash_amount: isDebtOffset ? cashTransferNum : undefined,
        payment_method: isCreditSale
          ? 'credit'
          : (isSplitPayment && effectiveCashInflow > 0 ? 'split' : (paymentMethod || 'cash')),
        credit_sale: isCreditSale,
        intentional_shortfall: isWriteOff,
        financial_account_id: effectiveCashInflow > 0 && !isSplitPayment ? financialAccountId : null,
        payment_splits: isSplitPayment && effectiveCashInflow > 0 ? paymentSplits : undefined,
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

      if (selectedProductId) {
        recordRecentModel(selectedProductId);
      }

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
    const ramLabel = v.ram ? (v.ram.toLowerCase().includes('ram') ? v.ram : `${v.ram} RAM`) : null;
    const specParts = v.specs ? Object.values(v.specs).map(String) : [];
    const parts = [v.storage, ramLabel, v.color, ...specParts].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Standard';
  };

  if (loading && products.length === 0) {
    return <CustomPageLoader mode="app" fullScreen={false} />;
  }

  return (
    <div className="animate-page-enter space-y-4">
      {/* ── Mobile Native Step Tracker (< sm) ── */}
      <div className="sm:hidden space-y-2.5">
        {selectedProductId && (
          <button
            type="button"
            onClick={handleBackToProducts}
            className="w-full inline-flex items-center justify-between px-3.5 py-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#131926] text-xs font-black text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Return to product selection"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Back to Products</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Step 1</span>
          </button>
        )}
        <div className="flex items-center justify-between w-full bg-white dark:bg-[#131926] p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
              {currentStep}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider block leading-none">
                Step {currentStep} of 4
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white leading-tight truncate block mt-0.5">
                {currentStep === 1 ? 'Pick Device' : currentStep === 2 ? 'Choose Variant' : currentStep === 3 ? 'Qty & Pricing' : 'Review & Confirm'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === currentStep
                    ? 'w-7 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : s < currentStep
                    ? 'w-3.5 bg-emerald-400 dark:bg-emerald-600'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Desktop Step progress & Back Navigation (>= sm) ── */}
      <div className="hidden sm:flex items-center gap-3 sm:gap-4 flex-wrap">
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
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
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
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs relative">
            {/* Top Action Bar: Step 1 Title + Category Filter & Source from Vendor (Where they belong) */}
            {!selectedProductId && (
              <>
                <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black sm:font-bold text-xs">
                      1
                    </div>
                    <div>
                      <h2 className="text-xs font-black sm:font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Device / Model Selection
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Category Dropdown (Where it was!) */}
                    {categories.length > 0 && (
                      <div className="relative">
                        <select
                          value={selectedCategoryFilter}
                          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                          className="h-10 sm:h-9.5 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-xs font-bold sm:semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate dark:[&>option]:bg-slate-900 dark:[&>option]:text-white"
                          aria-label="Filter products by category"
                        >
                          <option value="all">All Categories</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    )}

                    {/* Source from Vendor Action (Where it was!) */}
                    <button
                      type="button"
                      onClick={() => setIsVendorDirectModalOpen(true)}
                      className="h-10 sm:h-9.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800/80 dark:border-slate-800 text-emerald-400 dark:text-emerald-400 active:scale-95 text-xs font-black sm:font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer group"
                      title="Source device directly from vendor (1-Step POS Sale)"
                    >
                      <Handshake className="w-4 h-4 text-emerald-400 transition-transform group-hover:scale-105" />
                      <span className="hidden sm:inline text-emerald-400">Source from Vendor</span>
                      <span className="sm:hidden text-emerald-400 font-bold">Vendor</span>
                    </button>
                  </div>
                </div>

                {/* Centered Full-Width Search Bar & Floating UI/UX Section */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div ref={modelSearchContainerRef} className="relative w-full">
                    <div className="relative flex items-center">
                      <Search className="w-5 h-5 sm:w-4 sm:h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      <input
                        ref={searchRef}
                        type="text"
                        value={productSearch}
                        onFocus={() => setIsModelSearchOpen(true)}
                        onClick={() => setIsModelSearchOpen(true)}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setIsModelSearchOpen(true);
                        }}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search model, brand, or serial..."
                        className="w-full h-12 sm:h-11 pl-11 sm:pl-10 pr-10 rounded-2xl sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 text-sm sm:text-xs font-bold sm:font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs sm:shadow-2xs"
                      />
                      {productSearch ? (
                        <button
                          type="button"
                          onClick={() => {
                            setProductSearch('');
                            setIsModelSearchOpen(true);
                            searchRef.current?.focus();
                          }}
                          className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Clear search"
                        >
                          <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsModelSearchOpen((prev) => !prev);
                            searchRef.current?.focus();
                          }}
                          className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Toggle models list"
                        >
                          <ChevronDown className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Floating Suggestions Overlay Dropdown */}
                    {isModelSearchOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 py-1.5 sm:py-1 bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {/* Recently Sold / Sourced Models (Shown before typing) */}
                        {recentModels.length > 0 && !productSearch.trim() && (
                          <div className="py-1 bg-slate-50/50 dark:bg-slate-900/40">
                            <div className="px-4 sm:px-3.5 py-1.5 text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-500" />
                              <span>Recent Models</span>
                            </div>
                            {recentModels.map((p) => {
                              const hasStock = p.stockCount > 0;
                              return (
                                <button
                                  key={`recent-${p.id}`}
                                  type="button"
                                  onClick={() => {
                                    handleSelectProduct(p.id);
                                    setIsModelSearchOpen(false);
                                  }}
                                  className="w-full text-left px-4 sm:px-3.5 py-3 sm:py-2.5 text-sm sm:text-xs flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3 sm:gap-2.5 min-w-0 pr-2">
                                    <div className="w-9 h-9 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors shadow-2xs">
                                      {p.has_serials ? <Smartphone className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" /> : <Package className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-black sm:font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5 text-sm sm:text-xs">
                                        <span>{p.name}</span>
                                        <span className="text-[10px] sm:text-[9px] font-bold sm:font-normal px-1.5 sm:px-1 py-0.5 sm:py-0.2 rounded bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                          Recent
                                        </span>
                                      </div>
                                      {p.brand && (
                                        <div className="text-xs sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium sm:font-normal truncate">
                                          {p.brand}{p.category_rel?.name || p.category ? ` · ${p.category_rel?.name || p.category}` : ''}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={`text-xs sm:text-[11px] font-mono font-black sm:font-bold ${
                                      hasStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                                    }`}>
                                      {hasStock ? `${p.stockCount} in stock` : 'Out of stock'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* All / Filtered Category Models */}
                        {filteredProducts.length > 0 ? (
                          <div className="py-1">
                            {!productSearch.trim() && recentModels.length > 0 && (
                              <div className="px-4 sm:px-3.5 py-1.5 text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                All Category Models ({filteredProducts.length})
                              </div>
                            )}
                            {filteredProducts.map((p) => {
                              const hasStock = p.stockCount > 0;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    handleSelectProduct(p.id);
                                    setIsModelSearchOpen(false);
                                  }}
                                  className="w-full text-left px-4 sm:px-3.5 py-3 sm:py-2.5 text-sm sm:text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
                                >
                                  <div className="flex items-center gap-3 sm:gap-2.5 min-w-0 pr-2">
                                    <div className="w-9 h-9 sm:w-7 sm:h-7 rounded-xl sm:rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors shadow-2xs">
                                      {p.has_serials ? <Smartphone className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" /> : <Package className="w-4.5 h-4.5 sm:w-3.5 sm:h-3.5" />}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-black sm:font-semibold text-slate-900 dark:text-white truncate text-sm sm:text-xs">
                                        {p.name}
                                      </div>
                                      {p.brand && (
                                        <div className="text-xs sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium sm:font-normal truncate">
                                          {p.brand}{p.category_rel?.name || p.category ? ` · ${p.category_rel?.name || p.category}` : ''}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className={`text-xs sm:text-[11px] font-mono font-black sm:font-bold ${
                                      hasStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                                    }`}>
                                      {hasStock ? `${p.stockCount} in stock` : 'Out of stock'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-4 py-6 text-sm sm:text-xs text-slate-400 text-center font-medium">
                            No models found matching "{productSearch}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Recent Models Chips Under the Search Bar */}
                  {recentModels.length > 0 && !isModelSearchOpen && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-emerald-500" />
                        <span>Recent:</span>
                      </span>
                      {recentModels.slice(0, 6).map((p) => (
                        <button
                          key={`chip-${p.id}`}
                          type="button"
                          onClick={() => handleSelectProduct(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-xl sm:rounded-lg text-xs font-bold sm:font-semibold bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all shadow-2xs cursor-pointer"
                          title={`${p.name} (${p.stockCount} in stock)`}
                        >
                          <span className="truncate max-w-[130px]">{p.name}</span>
                          {p.stockCount > 0 && (
                            <span className="text-xs sm:text-[10px] font-mono font-black text-emerald-600 dark:text-emerald-400">
                              ({p.stockCount})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Resting Guide Prompt (When no model is chosen yet and dropdown is closed) */}
                  {!isModelSearchOpen && (
                    <div
                      onClick={() => {
                        searchRef.current?.focus();
                        setIsModelSearchOpen(true);
                      }}
                      className="p-8 sm:p-10 text-center flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50/40 dark:hover:bg-slate-900/20 rounded-2xl sm:rounded-xl transition-colors group border border-dashed border-slate-200/80 dark:border-slate-800/80 mt-2"
                    >
                      <div className="w-14 h-14 sm:w-11 sm:h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 sm:mb-2.5 group-hover:scale-105 transition-transform shadow-xs">
                        <Search className="w-6 h-6 sm:w-5 sm:h-5" />
                      </div>
                      <h3 className="text-sm sm:text-xs font-black sm:font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Search or Pick a Model
                      </h3>
                      <p className="text-xs sm:text-[11px] font-medium sm:font-normal text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        Click or type in the search bar above to filter models as you type, choose from recent sales, or source directly from a vendor.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Selected product header */}
            {selectedProduct && (
              <div className="p-4 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-1 gap-2">
                  <div className="flex items-center gap-3 sm:gap-2.5 min-w-0">
                    <div className="w-11 h-11 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
                      {selectedProduct.has_serials ? (
                        <Smartphone className="w-5 h-5 sm:w-4 sm:h-4" />
                      ) : (
                        <Package className="w-5 h-5 sm:w-4 sm:h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base sm:text-sm font-black sm:font-bold text-slate-900 dark:text-white truncate" title={selectedProduct.name}>
                        {selectedProduct.name}
                      </div>
                      <div className="text-xs sm:text-[11px] font-medium sm:font-normal text-slate-400 dark:text-slate-500">
                        {selectedProduct.brand ? `${selectedProduct.brand} · ` : ''}{selectedProduct.category_rel?.name || selectedProduct.category || ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToProducts}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black sm:font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Change selected product"
                  >
                    <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    <span>Change Product</span>
                  </button>
                </div>

                {/* ── STEP 2: Variant Chips ── */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400 mb-2.5 sm:mb-2 block">
                    Choose Variant
                  </span>
                  <div className="flex flex-wrap gap-2.5 sm:gap-2">
                    {variants.map((v) => {
                      const isSelected = selectedVariantId === v.id;
                      const vUnits = availableUnits.filter((u) => u.variant_id === v.id);
                      const vQtyOnHand = v.stock?.quantity_on_hand ?? 0;
                      const vStock = selectedProduct.has_serials ? vUnits.length : Math.max(vQtyOnHand, vUnits.length);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectVariant(v)}
                          className={`px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-xl text-xs font-black sm:font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{variantLabel(v)}</span>
                          <span className={`ml-2 text-[11px] sm:text-[10px] font-mono font-black ${
                            isSelected
                              ? 'text-emerald-400 dark:text-emerald-600'
                              : vStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                          }`}>
                            {vStock > 0 ? `${vStock} in stock` : '0 in stock'}
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
                  <span className="text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400 block">
                    {tradeInAllowance > 0 ? 'Outgoing Device to Hand Over' : 'Serial Units'} · {unitsForVariant.length} in stock
                  </span>
                  {tradeInAllowance > 0 && (
                    <span className="text-xs sm:text-[10px] text-purple-600 dark:text-purple-400 font-bold sm:font-medium">
                      Select the stock unit to give to customer
                    </span>
                  )}
                </div>
                {selectedUnitIds.length > 0 && (
                  <span className="text-xs sm:text-[11px] font-black sm:font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedUnitIds.length} selected
                  </span>
                )}
              </div>

              {unitsForVariant.length === 0 ? (
                <div className="flex items-center gap-2 text-sm sm:text-xs text-amber-700 dark:text-amber-400 font-bold sm:font-normal">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Out of stock in shop inventory.</span>
                </div>
              ) : (
                <div className="max-h-60 sm:max-h-52 overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2">
                    {unitsForVariant.map((u) => {
                      const isSelected = selectedUnitIds.includes(u.id);
                      const isExchange = u.source_type === 'exchange';
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleToggleUnit(u.id)}
                          className={`p-3 sm:p-2.5 rounded-xl border text-left text-xs transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                              : isExchange
                                ? 'border-purple-300 dark:border-purple-800/80 bg-purple-50/20 dark:bg-purple-950/10 hover:border-purple-400 dark:hover:border-purple-600'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              {(() => {
                                const ident = formatUnitDisplayIdentifier(u);
                                const isTablet = getCategoryArchetype(selectedProduct?.category, selectedProduct?.category_rel?.name, selectedProduct?.name) === 'tablet';
                                return (
                                  <>
                                    {ident.hasBoth ? (
                                      <div className="flex flex-col text-left">
                                        <span className="font-mono font-black sm:font-bold text-slate-900 dark:text-white text-xs sm:text-[11px] leading-tight">
                                          SN: {ident.serial}
                                        </span>
                                        <span className="font-mono font-bold sm:font-normal text-[11px] sm:text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                          IMEI: {ident.imei}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="font-mono font-black sm:font-bold text-slate-900 dark:text-white text-xs sm:text-[11px] truncate">
                                        {ident.primaryLabel}
                                      </span>
                                    )}
                                    {u.sim_type === 'esim' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 sm:py-0.2 rounded text-[10px] sm:text-[9px] font-black sm:font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                                        eSIM
                                      </span>
                                    )}
                                    {u.sim_type === 'dual' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 sm:py-0.2 rounded text-[10px] sm:text-[9px] font-black sm:font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50">
                                        Dual SIM
                                      </span>
                                    )}
                                    {isTablet && u.sim_type === 'na' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 sm:py-0.2 rounded text-[10px] sm:text-[9px] font-black sm:font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        Wi-Fi
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                              {selectedVariant && (selectedVariant.storage || selectedVariant.ram) && (
                                <span className="inline-flex items-center text-[10px] sm:text-[9px] font-black sm:font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 sm:py-0.2 rounded font-mono">
                                  {[selectedVariant.storage, selectedVariant.ram ? (selectedVariant.ram.toLowerCase().includes('ram') ? selectedVariant.ram : `${selectedVariant.ram} RAM`) : null].filter(Boolean).join('/')}
                                </span>
                              )}
                              {u.battery_health && (
                                <span className="inline-flex items-center gap-0.5 text-[11px] sm:text-[10px] font-mono font-black sm:font-medium text-slate-600 dark:text-slate-400">
                                  <Battery className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                                  {u.battery_health}%
                                </span>
                              )}
                              {u.cycle_count !== null && u.cycle_count !== undefined && (
                                <span className="text-[11px] sm:text-[10px] font-mono font-bold sm:font-normal text-slate-400">
                                  ({u.cycle_count}c)
                                </span>
                              )}
                              {u.source_type === 'consignment' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] sm:text-[9px] font-black sm:font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                  <Handshake className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                                  Vendor
                                </span>
                              )}
                              {isExchange && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] sm:text-[9px] font-black sm:font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50">
                                  <Repeat className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                                  Exchanged
                                </span>
                              )}
                              {(u.is_repaired || (u.maintenance_records && u.maintenance_records.length > 0)) && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] sm:text-[9px] font-black sm:font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/50">
                                  <Wrench className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                                  Repaired
                                </span>
                              )}
                            </div>
                            <div className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-emerald-500 text-white' : 'border border-slate-300 dark:border-slate-700'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 sm:w-2.5 sm:h-2.5" />}
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
                  <span className="text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400">Qty</span>
                  <span className={`text-xs sm:text-[10px] font-black sm:font-semibold ${
                    maxAvailableStock > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-500 dark:text-rose-400'
                  }`}>
                    {maxAvailableStock > 0 ? `${maxAvailableStock} available` : 'Out of stock'}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-2">
                  <div className="inline-flex items-center rounded-2xl sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity - 1)}
                      disabled={quantity <= 1 || maxAvailableStock <= 0}
                      className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxAvailableStock > 0 ? maxAvailableStock : 1}
                      value={quantity}
                      onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                      disabled={maxAvailableStock <= 0}
                      className="w-14 sm:w-12 text-center font-mono font-black text-base sm:text-sm text-slate-900 dark:text-white bg-transparent focus:outline-none disabled:opacity-30"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(quantity + 1)}
                      disabled={quantity >= maxAvailableStock}
                      className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-1 overflow-x-auto py-0.5">
                    {[1, 2, 3, 5, 10].map((count) => {
                      const isOverStock = count > maxAvailableStock;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => handleQuantityChange(count)}
                          disabled={isOverStock}
                          className={`h-10 sm:h-8 px-3 sm:px-2.5 rounded-xl sm:rounded-lg text-xs font-mono font-black transition-all ${
                            quantity === count
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                              : isOverStock
                              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-40'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 bg-white dark:bg-slate-800'
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-3">
                {/* 1. Unit Price */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400">
                      <Tag className="w-3.5 h-3.5 sm:w-3 sm:h-3 inline mr-1" />
                      Unit Price (ETB) *
                    </label>
                    {settedPrice > 0 && (
                      <span className="text-xs sm:text-[10px] font-mono text-slate-400">
                        Base: <strong className="text-slate-700 dark:text-slate-300 font-bold">{settedPrice.toLocaleString()} ETB</strong>
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={unitSellingPrice}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-12 sm:h-10 px-3.5 sm:px-3 rounded-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-base sm:text-sm font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-2xs"
                    required
                  />
                  {quantity > 1 && unitPriceNum > 0 && (
                    <span className="text-xs sm:text-[10px] text-slate-400 mt-1 block font-mono font-bold">
                      Subtotal: {grossSubtotal.toLocaleString()} ETB
                    </span>
                  )}
                  {isUpsell && (
                    <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 rounded-xl sm:rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/40 text-xs sm:text-[10px] text-purple-700 dark:text-purple-300 font-black">
                      <TrendingUp className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>
                        +{netEstimatedBonus.toLocaleString()} ETB Bonus · +{upsellBonusPerUnit.toLocaleString()} above target
                      </span>
                    </div>
                  )}
                  {unitPriceNum > 0 && outgoingUnitCost > 0 && unitPriceNum < outgoingUnitCost && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs sm:text-[11px] font-bold sm:font-semibold text-rose-700 dark:text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Below cost by {(outgoingUnitCost - unitPriceNum).toLocaleString()} ETB</span>
                    </div>
                  )}
                </div>

                {/* 2. Discount with % vs ETB Mode Switcher */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400">
                      Discount
                    </label>
                    <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs sm:text-[10px] font-black">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('percent');
                          handleDiscountChange(discountValue, 'percent');
                        }}
                        className={`px-2.5 sm:px-2 py-0.5 rounded-md transition-all ${
                          discountType === 'percent'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
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
                        className={`px-2.5 sm:px-2 py-0.5 rounded-md transition-all ${
                          discountType === 'fixed'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-black'
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
                      className="w-full h-12 sm:h-10 pl-3.5 sm:pl-3 pr-11 sm:pr-10 rounded-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-base sm:text-sm font-mono font-black sm:font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-40 shadow-2xs"
                    />
                    <div className="absolute right-3.5 sm:right-3 top-3.5 sm:top-2.5 text-xs font-mono font-black text-slate-400 pointer-events-none">
                      {discountType === 'percent' ? '%' : 'ETB'}
                    </div>
                  </div>

                  {calculatedDiscountAmount > 0 && (
                    <span className="text-xs sm:text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 block font-mono font-black sm:font-bold">
                      -{calculatedDiscountAmount.toLocaleString()} ETB ({discountType === 'percent' ? `${rawDiscountVal}%` : `${((calculatedDiscountAmount / (grossSubtotal || 1)) * 100).toFixed(1)}%`})
                    </span>
                  )}
                </div>

                {/* 3. Paid Now */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400">
                      Amount Paid (ETB)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsExchangeModalOpen(true)}
                      className={`inline-flex items-center gap-1 text-xs sm:text-[10px] font-black px-2.5 sm:px-2 py-0.5 rounded-lg sm:rounded-md transition-colors ${
                        exchangeDevice
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-800 dark:text-slate-200 hover:text-purple-700'
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-purple-500" />
                      {exchangeDevice ? 'Exchange Added' : 'Exchange'}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => handlePaidAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-12 sm:h-10 px-3.5 sm:px-3 rounded-2xl sm:rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-base sm:text-sm font-mono font-black sm:font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 shadow-2xs"
                    required
                  />

                  {/* Active Exchange Chip (Minimal 1-line) */}
                  {exchangeDevice ? (
                    <div className="mt-2 px-3 sm:px-2.5 py-2 sm:py-1.5 rounded-xl sm:rounded-lg bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/50 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 sm:gap-1.5 min-w-0 pr-2">
                        <Repeat className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="font-black sm:font-semibold text-purple-900 dark:text-purple-200 truncate text-xs">
                          Exchange: {exchangeDevice.product_name}
                        </span>
                        {exchangeDevice.imei_or_serial && (
                          <span className="text-[11px] sm:text-[10px] text-purple-600/80 dark:text-purple-400/80 font-mono truncate">
                            ({exchangeDevice.imei_or_serial})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsExchangeModalOpen(true)}
                          className="text-xs sm:text-[10px] font-black text-purple-700 dark:text-purple-300 hover:underline px-1"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExchangeDevice(null);
                            setPaidAmount(String(totalAfterDiscount));
                          }}
                          className="w-6 h-6 sm:w-5 sm:h-5 rounded-lg flex items-center justify-center text-purple-400 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                          title="Remove exchange"
                        >
                          <X className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Warning if total trade-in credit + cash does not cover outgoing unit cost */}
                  {exchangeDevice && outgoingUnitCost > 0 && (Number(exchangeDevice.trade_in_value) + paidNum < outgoingUnitCost) && (
                    <div className="mt-1.5 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs sm:text-[11px] font-bold sm:font-semibold">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        Below shop cost by {(outgoingUnitCost - (Number(exchangeDevice.trade_in_value) + paidNum)).toLocaleString()} ETB
                      </span>
                      <span className="text-xs sm:text-[10px] font-black text-red-600 dark:text-red-400 font-mono uppercase">Loss Deal</span>
                    </div>
                  )}

                  {netCashDue >= 0 && paidNum !== netCashDue && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(String(netCashDue))}
                      className="text-xs sm:text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 mt-1.5 block font-bold sm:font-medium underline"
                    >
                      Set extra cash customer pays ({netCashDue.toLocaleString()} ETB)
                    </button>
                  )}
                </div>
              </div>

              {/* Attached Accessories & Bundles */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <AccessoryAttachmentSection
                  accessories={attachedAccessories}
                  onChange={handleAccessoriesChange}
                  products={products}
                  categories={categories}
                  contacts={liveContacts}
                  onContactCreated={(newC) => {
                    setLiveContacts((prev) => [...prev.filter((c) => c.id !== newC.id), newC]);
                  }}
                  accounts={accounts}
                  currentUser={user}
                  isOwner={user?.role === 'owner'}
                />
              </div>

              {/* Payment Method Quick Selector */}
              <div>
                <label className="block text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400 mb-2.5 sm:mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 sm:gap-2">
                  {[
                    { value: 'cash', label: 'Cash transfer', icon: Banknote },
                    { value: 'debt_offset', label: 'Debt offset', icon: ArrowLeftRight },
                    { value: 'credit', label: 'Credit sale', icon: Clock3 },
                    { value: 'writeoff', label: 'Price concession', icon: Flag },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = m.value === 'credit'
                      ? isCreditSale
                      : m.value === 'writeoff'
                        ? isWriteOff
                        : paymentMethod === m.value && !isCreditSale && !isWriteOff;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => {
                          const isCreditOption = m.value === 'credit';
                          const isWriteOffOption = m.value === 'writeoff';
                          setPaymentMethod(isCreditOption || isWriteOffOption ? 'cash' : m.value);
                          setIsCreditSale(isCreditOption);
                          setIsWriteOff(isWriteOffOption);
                          const cashDue = exchangeDevice
                            ? Math.max(0, totalAfterDiscount - Number(exchangeDevice.trade_in_value || 0))
                            : totalAfterDiscount;
                          if (!isCreditOption && !isWriteOffOption) {
                            setPaidAmount(String(cashDue));
                          } else if (isCreditOption && paidNum >= cashDue) {
                            setPaidAmount('0');
                          } else if (isWriteOffOption && paidNum >= cashDue) {
                            setPaidAmount('0');
                          }
                        }}
                        className={`h-12 sm:h-auto px-3.5 py-2.5 sm:px-3 sm:py-2 rounded-2xl sm:rounded-xl border text-xs sm:text-[11px] font-black sm:font-semibold transition-all cursor-pointer flex items-center justify-center sm:justify-start gap-2 sm:gap-1.5 ${
                          isSelected
                            ? m.value === 'credit'
                              ? 'border-slate-800 bg-slate-900 dark:bg-slate-900 text-amber-400 dark:text-amber-400 shadow-xs font-bold ring-1 ring-amber-500/20'
                              : m.value === 'writeoff'
                              ? 'border-slate-800 bg-slate-900 dark:bg-slate-900 text-rose-400 dark:text-rose-400 shadow-xs font-bold ring-1 ring-rose-500/20'
                              : m.value === 'debt_offset'
                              ? 'border-slate-800 bg-slate-900 dark:bg-slate-900 text-indigo-400 dark:text-indigo-400 shadow-xs font-bold ring-1 ring-indigo-500/20'
                              : 'border-slate-800 bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 shadow-xs font-bold ring-1 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <Icon className={`w-4.5 h-4.5 sm:w-3.5 sm:h-3.5 shrink-0 ${isSelected ? (m.value === 'credit' ? 'text-amber-400' : m.value === 'writeoff' ? 'text-rose-400' : m.value === 'debt_offset' ? 'text-indigo-400' : 'text-emerald-400') : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bilateral Debt Offset Configuration */}
              {isDebtOffset && (
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      <ArrowLeftRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Debt Offset & Payment Split</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDebtOffsetAmount(String(netCashDue));
                          setCashTransferAmount('0');
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                          debtOffsetNum >= netCashDue - 0.01
                            ? 'bg-slate-900 text-indigo-300 font-bold dark:bg-slate-900'
                            : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                      >
                        Full Offset (100%)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const half = Math.round(netCashDue / 2);
                          setDebtOffsetAmount(String(half));
                          setCashTransferAmount(String(netCashDue - half));
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                          Math.abs(debtOffsetNum - Math.round(netCashDue / 2)) < 0.01 && debtOffsetNum < netCashDue - 0.01
                            ? 'bg-slate-900 text-indigo-300 font-bold dark:bg-slate-900'
                            : 'bg-white/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                        }`}
                      >
                        Half (50% / 50%)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                        Debt Offset Amount (ETB)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder={netCashDue.toLocaleString()}
                        value={debtOffsetAmount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDebtOffsetAmount(v);
                          const offVal = parseFloat(v) || 0;
                          const remCash = Math.max(0, netCashDue - offVal);
                          setCashTransferAmount(String(remCash));
                        }}
                        className="w-full h-8 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-indigo-900 dark:text-indigo-300 mb-1">
                        Cash / Transfer Amount (ETB)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={cashTransferAmount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCashTransferAmount(v);
                        }}
                        className="w-full h-8 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {effectiveCashInflow <= 0 ? (
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-300">
                      Sale proceeds will deduct from the customer's open payable debt. Zero bank cash movement.
                    </div>
                  ) : (
                    <div className="text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                      <span>Offset: <strong className="font-mono">{debtOffsetNum.toLocaleString()} ETB</strong></span>
                      <span>Bank/Cash deposit: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{effectiveCashInflow.toLocaleString()} ETB</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Receiving Account (Shown whenever real money enters the shop: Cash, Credit down payment, Price Concession, or Debt Offset cash portion) */}
              {effectiveCashInflow > 0 && (
                <SplitPaymentSelector
                  accounts={treasuryAccounts}
                  targetAmount={effectiveCashInflow}
                  singleAccountId={financialAccountId}
                  onSingleAccountChange={setFinancialAccountId}
                  isSplit={isSplitPayment}
                  onIsSplitChange={setIsSplitPayment}
                  splits={paymentSplits}
                  onSplitsChange={setPaymentSplits}
                  direction="inflow"
                  label="Receiving Account"
                />
              )}

              {/* Customer Selection / New Customer */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400">
                    <UserIcon className="w-3.5 h-3.5 sm:w-3 sm:h-3 inline mr-1" />
                    Customer
                  </label>

                  {/* Customer Mode Pills */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 sm:p-0.5 rounded-xl sm:rounded-lg text-xs sm:text-[10px] font-black sm:font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('walk_in');
                        setCustomerId('');
                        setCustomerName('');
                        setCustomerPhone('');
                      }}
                      className={`px-3 sm:px-2 py-1 sm:py-0.5 rounded-lg sm:rounded-md transition-all cursor-pointer ${
                        customerMode === 'walk_in'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black sm:font-bold'
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
                      className={`px-3 sm:px-2 py-1 sm:py-0.5 rounded-lg sm:rounded-md transition-all cursor-pointer ${
                        customerMode === 'new'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black sm:font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      + New
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('existing')}
                      className={`px-3 sm:px-2 py-1 sm:py-0.5 rounded-lg sm:rounded-md transition-all cursor-pointer ${
                        customerMode === 'existing'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black sm:font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Existing ({customerList.length})
                    </button>
                  </div>
                </div>

                {customerMode === 'walk_in' && (
                  <div className="h-11 sm:h-9 px-3.5 sm:px-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs font-bold sm:font-medium text-slate-600 dark:text-slate-400">
                    <span>Walk-in Customer (Anonymous)</span>
                    <span className="text-xs sm:text-[10px] text-slate-400 font-bold sm:font-normal">Default</span>
                  </div>
                )}

                {customerMode === 'new' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer Name (optional)"
                      className="h-11 sm:h-9 px-3.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold sm:font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone (optional, 09...)"
                      className="h-11 sm:h-9 px-3.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold sm:font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                  </div>
                )}

                {customerMode === 'existing' && (
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full h-11 sm:h-9 px-3.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold sm:font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
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
                className="w-full h-11 sm:h-9 px-3.5 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold sm:font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          )}
        </div>

        {/* ═══ RIGHT: Order Summary / Receipt (2 cols) ═══ */}
        <div id="counter-order-summary" className="lg:col-span-2">
          <div className="bg-white dark:bg-[#131926] rounded-2xl border border-slate-200/80 dark:border-slate-800/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] sticky top-4 overflow-hidden">
            {/* Receipt Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
              <Receipt className="w-5 h-5 sm:w-3.5 sm:h-3.5 text-slate-500" />
              <span className="text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Summary
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Empty State */}
              {!selectedProduct ? (
                <div className="py-8 text-center">
                  <ShoppingBag className="w-9 h-9 sm:w-8 sm:h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm sm:text-xs text-slate-400 font-bold sm:font-medium">Select a product to begin</p>
                </div>
              ) : (
                <>
                  {/* Product Line Item */}
                  <div className="py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm sm:text-xs font-black sm:font-bold text-slate-900 dark:text-white truncate">
                          {selectedProduct.name}
                        </div>
                        {selectedVariant && (
                          <div className="text-xs sm:text-[11px] font-bold sm:font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                            {variantLabel(selectedVariant)}
                          </div>
                        )}
                        {selectedUnitIds.length > 0 && (
                          <div className="text-[11px] sm:text-[10px] text-slate-400 font-mono mt-1 space-y-0.5">
                            {selectedUnitIds.map((uId) => {
                              const u = availableUnits.find((unit) => unit.id === uId);
                              return (
                                <div key={uId} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span>
                                    {(() => {
                                      if (!u) return 'Unknown';
                                      const ident = formatUnitDisplayIdentifier(u);
                                      return ident.hasBoth ? `SN: ${ident.serial} · IMEI: ${ident.imei}` : ident.primaryLabel;
                                    })()}
                                  </span>
                                  {u?.source_type === 'consignment' && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[9px] font-black sm:font-bold text-amber-600 dark:text-amber-400">
                                      <Handshake className="w-2.5 h-2.5" />
                                      Vendor
                                    </span>
                                  )}
                                  {(u?.source_type === 'exchange' || Boolean(u?.exchange_sales_order_id)) && (
                                    <span className="text-[10px] sm:text-[9px] text-slate-400 font-sans font-bold sm:font-normal">
                                      (Exchanged)
                                    </span>
                                  )}
                                  {(u?.is_repaired || (u?.maintenance_records && u.maintenance_records.length > 0)) && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[9px] font-black sm:font-bold text-teal-600 dark:text-teal-400">
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
                          <div className="text-xs sm:text-[10px] text-amber-600 dark:text-amber-400 font-bold sm:font-medium mt-1">
                            Vendor consignment unit
                          </div>
                        )}
                        {selectedUnitsHaveExchange && (
                          <div className="text-xs sm:text-[10px] text-slate-400 font-bold sm:font-medium mt-0.5">
                            Exchanged stock unit
                          </div>
                        )}
                      </div>
                      <span className="text-sm sm:text-xs font-mono font-black sm:font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        ×{quantity}
                      </span>
                    </div>
                  </div>

                  {/* Out of Stock Warning */}
                  {selectedVariant && maxAvailableStock <= 0 && (
                    <div className="flex items-center gap-2 text-sm sm:text-xs text-rose-600 dark:text-rose-400 font-bold sm:font-normal">
                      <AlertTriangle className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span>Out of stock in shop inventory.</span>
                    </div>
                  )}

                  {/* Price Breakdown */}
                  <div className="space-y-2.5 sm:space-y-2 text-xs">
                    {/* Customer in Summary */}
                    {((customerMode === 'new' && (customerName.trim() || customerPhone.trim())) || (customerMode === 'existing' && customerId)) ? (
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 pb-2 sm:pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 sm:gap-1 text-xs sm:text-[11px] font-bold sm:font-normal">
                          <UserIcon className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-slate-400" />
                          Customer
                        </span>
                        <span className="font-black sm:font-semibold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-[160px] text-right text-xs">
                          {customerMode === 'new'
                            ? `${customerName.trim() || 'Customer'}${customerPhone.trim() ? ` · ${customerPhone.trim()}` : ''}`
                            : (customerList.find((c) => c.id === customerId)?.name || 'Walk-in')}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span className="font-bold sm:font-normal text-xs sm:text-xs">Unit Price</span>
                      <span className="font-mono font-black sm:font-bold text-slate-900 dark:text-white whitespace-nowrap text-sm sm:text-xs">
                        {unitPriceNum > 0 ? unitPriceNum.toLocaleString() : '—'} ETB
                      </span>
                    </div>

                    {quantity > 1 && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span className="font-bold sm:font-normal text-xs sm:text-xs">Subtotal ({quantity}x)</span>
                        <span className="font-mono font-black sm:font-bold text-slate-900 dark:text-white whitespace-nowrap text-sm sm:text-xs">
                          {grossSubtotal > 0 ? grossSubtotal.toLocaleString() : '—'} ETB
                        </span>
                      </div>
                    )}

                    {calculatedDiscountAmount > 0 && (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400">
                        <span className="font-bold sm:font-normal text-xs sm:text-xs">
                          Discount {discountType === 'percent' ? `(${rawDiscountVal}%)` : ''}
                        </span>
                        <span className="font-mono font-black sm:font-bold whitespace-nowrap text-sm sm:text-xs">
                          -{calculatedDiscountAmount.toLocaleString()} ETB
                        </span>
                      </div>
                    )}

                    {tradeInAllowance > 0 && (
                      <div className="flex justify-between text-slate-700 dark:text-slate-300 font-bold sm:font-medium">
                        <span className="text-xs sm:text-xs">Exchanged Device</span>
                        <span className="font-mono font-black sm:font-bold whitespace-nowrap text-purple-600 dark:text-purple-400 text-sm sm:text-xs">
                          −{tradeInAllowance.toLocaleString()} ETB
                        </span>
                      </div>
                    )}

                    {attachedAccessories.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-xs sm:text-[10px] font-black sm:font-bold uppercase tracking-wider text-slate-400">
                          <span>Accessories ({attachedAccessories.length})</span>
                          <span>+{accessoriesTotal.toLocaleString()} ETB</span>
                        </div>
                        {attachedAccessories.map((a) => (
                          <div key={a.id} className="flex justify-between items-center text-xs sm:text-[11px] text-slate-700 dark:text-slate-300 font-bold sm:font-normal">
                            <span className="truncate max-w-[150px]">{a.name || 'Accessory'}</span>
                            <span className="font-mono font-black sm:font-normal whitespace-nowrap">
                              {Number(a.price) > 0 ? (
                                `+${(Number(a.price) * (a.quantity || 1)).toLocaleString()} ETB`
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 font-black sm:font-semibold">Free Gift</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-baseline pt-2.5 sm:pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <span className="font-black text-slate-900 dark:text-white text-sm sm:text-xs uppercase tracking-wider">
                        {tradeInAllowance > 0 ? 'Cash Difference to Pay' : 'Net Total'}
                      </span>
                      <span className="font-mono font-black text-xl sm:text-base text-slate-900 dark:text-white whitespace-nowrap">
                        {netCashDue > 0 ? netCashDue.toLocaleString() : '0'} ETB
                      </span>
                    </div>

                    {unitPriceNum > 0 && (
                      <>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span className="font-bold sm:font-normal text-xs sm:text-xs">Cash/Transfer Paid</span>
                          <span className="font-mono font-black sm:font-bold whitespace-nowrap text-sm sm:text-xs">{paidNum.toLocaleString()} ETB</span>
                        </div>

                        {isCredit && (
                          <div className={`flex justify-between font-black sm:font-bold text-xs sm:text-xs ${isCreditSale ? 'text-amber-600 dark:text-amber-400' : isWriteOff ? 'text-rose-600 dark:text-rose-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                              {isCreditSale ? 'Balance Due (Credit Sale)' : isWriteOff ? 'Intentional Shortfall (Written Off)' : 'Payment Shortfall — choose an option'}
                            </span>
                            <span className="font-mono whitespace-nowrap">{balanceDue.toLocaleString()} ETB</span>
                          </div>
                        )}

                        {(user?.role === 'owner' || !!user?.permissions?.can_view_costs) && (outgoingUnitCost > 0 || accessoriesCostTotal > 0) && (
                          <div className="flex justify-between items-center text-xs sm:text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800 text-slate-500 font-bold sm:font-normal">
                            <span>Estimated Net Profit</span>
                            <span className={`font-mono font-black sm:font-bold ${
                              (totalAfterDiscount - ((outgoingUnitCost * quantity) + accessoriesCostTotal)) >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {(totalAfterDiscount - ((outgoingUnitCost * quantity) + accessoriesCostTotal)) >= 0 ? '+' : ''}
                              {(totalAfterDiscount - ((outgoingUnitCost * quantity) + accessoriesCostTotal)).toLocaleString()} ETB
                            </span>
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
                  quantity > maxAvailableStock ||
                  hasUnmarkedBalance
                }
                className="w-full h-13 sm:h-11 rounded-2xl sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-700 dark:disabled:text-slate-300 text-sm sm:text-xs font-black sm:font-bold transition-all shadow-md sm:shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <ShoppingBag className="w-5 h-5 sm:w-4 sm:h-4" />
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

      {/* Mobile Sticky Quick-Checkout Trigger Bar */}
      {selectedProduct && selectedVariant && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 p-3.5 px-4.5 bg-white/95 dark:bg-[#131926]/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex items-center justify-between gap-3 animate-fade-in">
          <div className="min-w-0">
            <div className="text-xs font-black text-slate-500 dark:text-slate-400 truncate">
              {selectedProduct.name} · {quantity}x
            </div>
            <div className="text-base font-black font-mono text-slate-900 dark:text-white">
              {unitPriceNum > 0
                ? `${(tradeInAllowance > 0 ? netCashDue : totalAfterDiscount).toLocaleString()} ETB`
                : 'Enter Unit Price'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              document.getElementById('counter-order-summary')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-11 px-4.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <span>Review & Pay</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* 1-Step Vendor Direct Sale Modal */}
      <VendorDirectSaleModal
        isOpen={isVendorDirectModalOpen}
        onClose={() => setIsVendorDirectModalOpen(false)}
        products={products}
        categories={categories}
        contacts={contacts}
        accounts={accounts}
        isOwner={user?.role === 'owner'}
        initialProductId={selectedProductId || undefined}
        onSaleSuccess={() => {
          loadData();
          onSaleSuccess();
        }}
      />
    </div>
  );
};
