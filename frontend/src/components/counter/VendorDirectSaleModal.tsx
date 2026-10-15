import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Product, ProductCategory, Contact, FinancialAccount } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { formatCurrencyInput, parseFormattedNumber } from '../../utils/numberUtils';
import {
  X,
  Handshake,
  Check,
  Barcode,
  BatteryCharging,
  Building2,
  Clock,
  ShieldAlert,
  Plus,
  Search,
  ChevronDown,
  Banknote,
  ArrowLeftRight,
  Clock3,
  Flag,
  User as UserIcon,
} from 'lucide-react';
import { LdrsSpinner } from '../loading/LdrsSpinner';
import { PartnerFormModal } from '../partners/PartnerFormModal';
import { SplitPaymentSelector, type PaymentSplitItem } from '../common/SplitPaymentSelector';

interface VendorDirectSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories?: ProductCategory[];
  contacts: Contact[];
  accounts: FinancialAccount[];
  isOwner?: boolean;
  initialProductId?: string;
  onSaleSuccess: () => void;
}

export const VendorDirectSaleModal: React.FC<VendorDirectSaleModalProps> = ({
  isOpen,
  onClose,
  products,
  categories = [],
  contacts,
  accounts,
  isOwner = false,
  initialProductId,
  onSaleSuccess,
}) => {
  // Local products cache to immediately show newly created models
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Category & Product Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [isModelSearchOpen, setIsModelSearchOpen] = useState(false);
  const modelSearchContainerRef = useRef<HTMLDivElement>(null);
  const [customProductName, setCustomProductName] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Quick Add Product Model State
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  // Hardware Diagnostic Specs
  const [storage, setStorage] = useState('128GB');
  const [ram, setRam] = useState('');
  const [color, setColor] = useState('');
  const [imeiOrSerial, setImeiOrSerial] = useState('');
  const [condition, setCondition] = useState('new');
  const [batteryHealth, setBatteryHealth] = useState('100');

  // Vendor & Sourcing Details
  const [vendorContactId, setVendorContactId] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  const [vendorPaymentType, setVendorPaymentType] = useState<'immediate_account' | 'payable_debt'>('immediate_account');
  const [vendorAccountId, setVendorAccountId] = useState('');
  const [isVendorSplit, setIsVendorSplit] = useState(false);
  const [vendorPaymentSplits, setVendorPaymentSplits] = useState<PaymentSplitItem[]>([]);
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [liveContacts, setLiveContacts] = useState<Contact[]>(contacts);

  // Customer & POS Sale Details
  const [sellingPrice, setSellingPrice] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isCreditSale, setIsCreditSale] = useState(false);
  const [isWriteOff, setIsWriteOff] = useState(false);
  const [customerAccountId, setCustomerAccountId] = useState('');
  const [customerMode, setCustomerMode] = useState<'walk_in' | 'new' | 'existing'>('walk_in');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setLiveContacts(contacts);
  }, [contacts]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close model search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelSearchContainerRef.current && !modelSearchContainerRef.current.contains(e.target as Node)) {
        setIsModelSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Set initial product, category or defaults
  useEffect(() => {
    if (isOpen) {
      if (initialProductId) {
        const prod = localProducts.find((p) => p.id === initialProductId);
        if (prod) {
          setSelectedProductId(prod.id);
          setModelSearchQuery(prod.name);
          if (prod.category_id) {
            setSelectedCategoryId(prod.category_id);
          } else if (prod.category) {
            const matchCat = categories.find((c) => c.slug === prod.category);
            if (matchCat) setSelectedCategoryId(matchCat.id);
          }
          if (prod.variants && prod.variants.length > 0) {
            setSelectedVariantId(prod.variants[0].id);
            if (prod.variants[0].storage) setStorage(prod.variants[0].storage);
            if (prod.variants[0].ram) setRam(prod.variants[0].ram);
            if (prod.variants[0].color) setColor(prod.variants[0].color);
            if (prod.variants[0].default_selling_price) {
              const defPrice = formatCurrencyInput(prod.variants[0].default_selling_price);
              setSellingPrice(defPrice);
              setPaidAmount(defPrice);
            }
          }
        }
      } else if (categories.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(categories[0].id);
      }
      if (accounts.length > 0) {
        if (!vendorAccountId) setVendorAccountId(accounts[0].id);
        if (!customerAccountId) setCustomerAccountId(accounts[0].id);
      }
      setIsVendorSplit(false);
      setVendorPaymentSplits([]);
      setIsCreatingProduct(false);
      setNewProductName('');
      setNewProductBrand('');
      if (!initialProductId) {
        setModelSearchQuery('');
        setIsModelSearchOpen(false);
      }
    }
  }, [isOpen, initialProductId, localProducts, categories, selectedCategoryId, accounts]);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || categories[0];
  }, [categories, selectedCategoryId]);

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return localProducts;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    const catSlug = cat?.slug?.toLowerCase();
    const catName = cat?.name?.toLowerCase();

    return localProducts.filter((p) => {
      if (p.category_id && p.category_id === selectedCategoryId) return true;
      if (p.category_rel && p.category_rel.id === selectedCategoryId) return true;
      const pCat = (p.category || '').toLowerCase();
      if (catSlug && pCat === catSlug) return true;
      if (catName && pCat === catName) return true;
      return false;
    });
  }, [localProducts, selectedCategoryId, categories]);

  const selectedProduct = useMemo(() => {
    return localProducts.find((p) => p.id === selectedProductId) || null;
  }, [localProducts, selectedProductId]);

  // Real-time search filter for Model search field
  const searchedProducts = useMemo(() => {
    const query = modelSearchQuery.trim().toLowerCase();
    // If query matches the currently selected product name, show all category models so user can easily switch
    if (!query || (selectedProduct && query === selectedProduct.name.toLowerCase())) {
      return filteredProducts;
    }
    return filteredProducts.filter((p) => {
      const name = p.name.toLowerCase();
      const brand = (p.brand || '').toLowerCase();
      return name.includes(query) || brand.includes(query);
    });
  }, [filteredProducts, modelSearchQuery, selectedProduct]);

  const handleSelectSearchedProduct = (prod: Product) => {
    setSelectedProductId(prod.id);
    setModelSearchQuery(prod.name);
    setCustomProductName('');
    setIsModelSearchOpen(false);

    if (prod.variants && prod.variants.length > 0) {
      const v = prod.variants[0];
      setSelectedVariantId(v.id);
      if (v.storage) setStorage(v.storage);
      if (v.ram) setRam(v.ram);
      if (v.color) setColor(v.color);
      if (v.default_selling_price) {
        const defPrice = formatCurrencyInput(v.default_selling_price);
        setSellingPrice(defPrice);
        setPaidAmount(defPrice);
      }
    } else {
      setSelectedVariantId('');
    }
  };

  const vendorContacts = useMemo(
    () => liveContacts.filter((contact) =>
      contact.is_active !== false &&
      ['vendor', 'peer_vendor', 'supplier', 'partner'].some((role) => contact.roles?.includes(role))
    ),
    [liveContacts]
  );

  const isPhone = useMemo(() => {
    const name = (selectedProduct?.name || customProductName || newProductName).toLowerCase();
    const cat = (activeCategory?.name || activeCategory?.slug || selectedProduct?.category || '').toLowerCase();
    return (
      cat.includes('phone') ||
      cat.includes('tablet') ||
      cat.includes('smartphone') ||
      name.includes('iphone') ||
      name.includes('galaxy') ||
      name.includes('pixel')
    );
  }, [selectedProduct, customProductName, newProductName, activeCategory]);

  // Handle Quick Product Model Creation
  const handleCreateProduct = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newProductName.trim()) {
      toast.error('Model name is required');
      return;
    }

    try {
      setIsSubmittingProduct(true);
      const res = await api.createProduct({
        name: newProductName.trim(),
        brand: newProductBrand.trim() || undefined,
        category: activeCategory?.slug || 'other',
        category_id: activeCategory?.id,
        has_serials: activeCategory?.has_serials ?? true,
        variants: [
          {
            storage: storage.trim() || undefined,
            ram: ram.trim() || undefined,
            color: color.trim() || undefined,
            default_selling_price: parseFormattedNumber(sellingPrice) || undefined,
          },
        ],
      });

      toast.success(`Model "${res.name}" created`);
      setIsCreatingProduct(false);
      setNewProductName('');
      setNewProductBrand('');

      setLocalProducts((prev) => [res, ...prev.filter((p) => p.id !== res.id)]);
      setSelectedProductId(res.id);
      setModelSearchQuery(res.name);
      setIsModelSearchOpen(false);
      if (res.variants && res.variants.length > 0) {
        setSelectedVariantId(res.variants[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product model');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Numeric calculations
  const vendorCostNum = parseFormattedNumber(vendorCost) || 0;
  const sellingPriceNum = parseFormattedNumber(sellingPrice) || 0;
  const paidAmountNum = parseFormattedNumber(paidAmount) || 0;
  const grossProfit = sellingPriceNum - vendorCostNum;
  const marginPct = sellingPriceNum > 0 ? (grossProfit / sellingPriceNum) * 100 : 0;
  const isLossDeal = sellingPriceNum > 0 && vendorCostNum > 0 && grossProfit < 0;

  // Selected vendor payment account & overdraft check
  const selectedVendorAccount = useMemo(() => {
    return accounts.find((a) => a.id === vendorAccountId) || null;
  }, [accounts, vendorAccountId]);

  const vendorFee = useMemo(() => {
    if (vendorPaymentType !== 'immediate_account' || !selectedVendorAccount) return 0;
    if (!selectedVendorAccount.default_fee_type || selectedVendorAccount.default_fee_type === 'none') return 0;
    const rate = Number(selectedVendorAccount.default_fee_amount) || 0;
    if (rate <= 0) return 0;
    if (selectedVendorAccount.default_fee_type === 'fixed') return rate;
    if (selectedVendorAccount.default_fee_type === 'percentage') {
      return Math.round(((vendorCostNum * rate) / 100) * 100) / 100;
    }
    return 0;
  }, [vendorPaymentType, selectedVendorAccount, vendorCostNum]);

  const totalVendorDeduction = vendorCostNum + vendorFee;

  const isVendorAccountOverdrawn = useMemo(() => {
    if (vendorPaymentType !== 'immediate_account') return false;
    if (!isOwner || !selectedVendorAccount || selectedVendorAccount.current_balance === null) return false;
    return totalVendorDeduction > Number(selectedVendorAccount.current_balance);
  }, [vendorPaymentType, isOwner, selectedVendorAccount, totalVendorDeduction]);

  const vendorSplitTotal = useMemo(() => {
    return vendorPaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  }, [vendorPaymentSplits]);

  const isVendorSplitMismatch = isVendorSplit && Math.abs(vendorSplitTotal - vendorCostNum) > 0.01;

  const isAnyVendorSplitOverdrawn = useMemo(() => {
    if (vendorPaymentType !== 'immediate_account' || !isVendorSplit) return false;
    if (!isOwner) return false;
    return vendorPaymentSplits.some((split) => {
      const acc = accounts.find((a) => a.id === split.financial_account_id);
      if (!acc || acc.current_balance === null) return false;
      const amt = Number(split.amount) || 0;
      let fee = 0;
      if (acc.default_fee_type === 'fixed') fee = Number(acc.default_fee_amount) || 0;
      else if (acc.default_fee_type === 'percentage') {
        fee = Math.round(((amt * (Number(acc.default_fee_amount) || 0)) / 100) * 100) / 100;
      }
      return (amt + fee) > Number(acc.current_balance);
    });
  }, [vendorPaymentType, isVendorSplit, isOwner, vendorPaymentSplits, accounts]);

  // Auto-sync paidAmount when sellingPrice changes (if paid was equal or empty)
  const handleSellingPriceChange = (val: string) => {
    const formatted = formatCurrencyInput(val);
    setSellingPrice(formatted);
    const parsed = parseFormattedNumber(formatted);
    if (parsed !== null && (!paidAmount || parseFormattedNumber(paidAmount) === sellingPriceNum)) {
      setPaidAmount(formatted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalProductId = selectedProductId && selectedProductId !== '__custom__' ? selectedProductId : undefined;
    let finalProductName = selectedProduct
      ? selectedProduct.name
      : (customProductName.trim() || newProductName.trim());

    if (!finalProductName && modelSearchQuery.trim()) {
      const match = filteredProducts.find(
        (p) => p.name.toLowerCase() === modelSearchQuery.trim().toLowerCase()
      );
      if (match) {
        finalProductId = match.id;
        finalProductName = match.name;
      } else {
        finalProductName = modelSearchQuery.trim();
      }
    }

    if (!finalProductName) {
      toast.error('Please select or create the device model');
      return;
    }

    if (!vendorContactId) {
      toast.error('Please select the vendor / broker partner');
      return;
    }

    if (vendorCostNum <= 0) {
      toast.error('Please enter a valid vendor cost');
      return;
    }

    if (sellingPriceNum <= 0) {
      toast.error('Please enter a valid customer selling price');
      return;
    }

    if (vendorPaymentType === 'immediate_account') {
      if (isVendorSplit) {
        if (isVendorSplitMismatch) {
          toast.error(`Vendor payment split total (${vendorSplitTotal.toLocaleString()} ETB) does not match vendor cost (${vendorCostNum.toLocaleString()} ETB)`);
          return;
        }
        if (isAnyVendorSplitOverdrawn) {
          toast.error('Insufficient balance in one or more split payout accounts');
          return;
        }
      } else {
        if (isVendorAccountOverdrawn) {
          toast.error('Insufficient balance in selected payout account');
          return;
        }
      }
    }

    if (paidAmountNum > 0 && paymentMethod !== 'debt_offset' && !isCreditSale && !isWriteOff && !customerAccountId) {
      toast.error('Please select the shop receiving account');
      return;
    }

    if (paymentMethod === 'debt_offset' && (!customerId || customerMode !== 'existing')) {
      toast.error('Please select an existing customer/party contact for debt offset');
      return;
    }

    if (submitting || submittingRef.current) {
      return;
    }

    try {
      submittingRef.current = true;
      setSubmitting(true);

      const payload = {
        product_id: finalProductId,
        product_name: finalProductName,
        variant_id: selectedVariantId || undefined,
        storage: storage.trim() || undefined,
        ram: ram.trim() || undefined,
        color: color.trim() || undefined,
        imei_or_serial: imeiOrSerial.trim() || undefined,
        condition,
        vendor_contact_id: vendorContactId,
        vendor_cost: vendorCostNum,
        vendor_payment_method: vendorPaymentType === 'immediate_account' ? ('paid_now' as const) : ('owed' as const),
        vendor_payment_account_id: vendorPaymentType === 'immediate_account' ? (isVendorSplit ? undefined : vendorAccountId) : undefined,
        vendor_payment_splits: (vendorPaymentType === 'immediate_account' && isVendorSplit)
          ? vendorPaymentSplits.map((s) => ({
              financial_account_id: s.financial_account_id,
              amount: Number(s.amount) || 0,
            }))
          : undefined,
        selling_price: sellingPriceNum,
        paid_amount: paidAmountNum,
        payment_method: (isCreditSale
          ? 'credit'
          : (paymentMethod || 'cash')) as any,
        credit_sale: isCreditSale,
        intentional_shortfall: isWriteOff,
        financial_account_id: paidAmountNum > 0 && paymentMethod !== 'debt_offset' && !isCreditSale && !isWriteOff ? customerAccountId : undefined,
        customer_id: customerMode === 'existing' ? customerId || undefined : undefined,
        customer_name: customerMode === 'new' && customerName.trim() ? customerName.trim() : undefined,
        customer_phone: customerMode === 'new' && customerPhone.trim() ? customerPhone.trim() : undefined,
        notes: notes.trim() || undefined,
      };

      const order = await api.vendorDirectSale(payload);

      const orderNumber = (order as any)?.order_number || (order as any)?.data?.order_number || 'Completed';

      toast.success(`Vendor Direct Sale Completed: Order #${orderNumber}`, {
        description: `Customer paid ${paidAmountNum.toLocaleString()} ETB. Sourced from vendor directly.`,
      });

      // Clear dynamic inputs to prevent duplicate submission
      setImeiOrSerial('');
      setSellingPrice('');
      setPaidAmount('');
      setVendorCost('');
      setRam('');
      setNotes('');
      setCustomProductName('');
      setIsCreatingProduct(false);
      setNewProductName('');
      setNewProductBrand('');
      setModelSearchQuery('');
      setIsModelSearchOpen(false);
      setIsVendorSplit(false);
      setVendorPaymentSplits([]);
      setIsCreditSale(false);
      setIsWriteOff(false);
      setPaymentMethod('cash');

      onSaleSuccess();
      onClose();
    } catch (err: any) {
      toast.error('Failed to complete vendor direct sale', { description: err.message });
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-8 pt-0 sm:pt-20 pb-0 sm:pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal Surface */}
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden max-sm:animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[90vh] sm:max-h-[calc(100vh-6rem)] my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-900 border border-slate-800 text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
              <Handshake className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                Source from Vendor
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                JIT drop-ship sale · Direct checkout from vendor to customer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="vendor-direct-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4"
        >
          {/* ── SECTION 1: DEVICE DETAILS ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Device Details <span className="text-rose-500">*</span>
              </label>
              {!isCreatingProduct && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProduct(true);
                    setNewProductName('');
                    setNewProductBrand('');
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Model</span>
                </button>
              )}
            </div>

            {/* Quick Add Product Model Form (Matches Stock Intake Modal) */}
            {isCreatingProduct && (
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3 animate-modal-enter">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    New Product Model ({activeCategory?.name || 'Category'})
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Saves to catalog</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Model Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. iPhone 16 Pro Max, Galaxy S24 Ultra"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Apple, Samsung, Google"
                      value={newProductBrand}
                      onChange={(e) => setNewProductBrand(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                  </div>
                </div>

                {/* Quick Initial Variant Specs */}
                <div className="pt-1 space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Initial Variant Specification
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Storage</label>
                      <input
                        type="text"
                        placeholder="256GB"
                        value={storage}
                        onChange={(e) => setStorage(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">RAM</label>
                      <input
                        type="text"
                        placeholder="8GB"
                        value={ram}
                        onChange={(e) => setRam(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">Color</label>
                      <input
                        type="text"
                        placeholder="Natural Titanium"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProduct(false)}
                    className="h-8 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateProduct}
                    disabled={isSubmittingProduct || !newProductName.trim()}
                    className="h-8 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 text-xs font-bold disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {isSubmittingProduct ? <LdrsSpinner size={14} color="#34d399" stroke={2.5} /> : null}
                    <span>Save Model</span>
                  </button>
                </div>
              </div>
            )}

            {/* Standard Dropdowns (Category, Model, Variant) */}
            {!isCreatingProduct && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Category Dropdown */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => {
                          const newCatId = e.target.value;
                          setSelectedCategoryId(newCatId);
                          setSelectedProductId('');
                          setSelectedVariantId('');
                          setCustomProductName('');
                        }}
                        className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.has_serials ? '(Serialized)' : '(Batch)'}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Model Searchable Combobox */}
                  <div ref={modelSearchContainerRef} className="relative">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Model <span className="text-slate-400 font-normal">({filteredProducts.length} available)</span>
                    </label>
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={modelSearchQuery}
                        onFocus={() => setIsModelSearchOpen(true)}
                        onChange={(e) => {
                          const val = e.target.value;
                          setModelSearchQuery(val);
                          setIsModelSearchOpen(true);
                          if (!val.trim()) {
                            setSelectedProductId('');
                            setSelectedVariantId('');
                            setCustomProductName('');
                          } else if (selectedProductId && selectedProductId !== '__custom__') {
                            const current = localProducts.find((p) => p.id === selectedProductId);
                            if (current && current.name.toLowerCase() !== val.trim().toLowerCase()) {
                              setSelectedProductId('');
                              setSelectedVariantId('');
                            }
                          }
                        }}
                        placeholder={
                          filteredProducts.length === 0
                            ? 'No models in this category yet'
                            : 'Type to filter model or add custom...'
                        }
                        className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                      />
                      {modelSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModelSearchQuery('');
                            setSelectedProductId('');
                            setSelectedVariantId('');
                            setCustomProductName('');
                            setIsModelSearchOpen(true);
                          }}
                          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                          title="Clear model"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
                      )}
                    </div>

                    {/* Floating Filtered Suggestions */}
                    {isModelSearchOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {searchedProducts.length > 0 ? (
                          <div className="py-1">
                            {searchedProducts.map((p) => {
                              const isSelected = p.id === selectedProductId;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleSelectSearchedProduct(p)}
                                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors ${
                                    isSelected
                                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold'
                                      : 'text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="font-semibold truncate">{p.name}</div>
                                    {p.brand && (
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                        {p.brand}
                                      </div>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="px-3 py-3 text-xs text-slate-400 text-center">
                            No existing models found for "{modelSearchQuery}"
                          </div>
                        )}

                        {/* Quick Actions (Create Model or One-Off) */}
                        <div className="p-1.5 space-y-1 bg-slate-50/50 dark:bg-slate-800/40">
                          {modelSearchQuery.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewProductName(modelSearchQuery.trim());
                                setIsCreatingProduct(true);
                                setIsModelSearchOpen(false);
                              }}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1.5 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">Add "{modelSearchQuery.trim()}" to Catalog</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductId('__custom__');
                              setCustomProductName(modelSearchQuery.trim() || '');
                              setIsModelSearchOpen(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                          >
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 shrink-0">One-off</span>
                            <span className="truncate">
                              {modelSearchQuery.trim()
                                ? `Use "${modelSearchQuery.trim()}" (Unsaved one-off)`
                                : 'Enter custom one-off model name'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* If Custom One-Off Selected */}
                {selectedProductId === '__custom__' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Custom Model Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. iPhone 16 Pro Max"
                      value={customProductName}
                      onChange={(e) => {
                        setCustomProductName(e.target.value);
                        setModelSearchQuery(e.target.value);
                      }}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                  </div>
                )}

                {/* If Selected Product has Variants */}
                {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Variant Specification
                      </label>
                      <span className="text-[10px] text-slate-400">
                        {selectedProduct.variants.length} variant{selectedProduct.variants.length > 1 ? 's' : ''} in catalog
                      </span>
                    </div>
                    <div className="relative">
                      <select
                        value={selectedVariantId}
                        onChange={(e) => {
                          const vid = e.target.value;
                          setSelectedVariantId(vid);
                          const v = selectedProduct.variants.find((item) => item.id === vid);
                          if (v) {
                            if (v.storage) setStorage(v.storage);
                            if (v.ram) setRam(v.ram);
                            if (v.color) setColor(v.color);
                            if (v.default_selling_price) {
                              const defPrice = formatCurrencyInput(v.default_selling_price);
                              setSellingPrice(defPrice);
                              setPaidAmount(defPrice);
                            }
                          }
                        }}
                        className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                      >
                        {selectedProduct.variants.map((v) => {
                          const ramLabel = v.ram ? (v.ram.toLowerCase().includes('ram') ? v.ram : `${v.ram} RAM`) : null;
                          const label = [v.storage, ramLabel, v.color].filter(Boolean).join(' · ') || 'Standard';
                          return (
                            <option key={v.id} value={v.id}>
                              {label} {v.default_selling_price ? `(${Number(v.default_selling_price).toLocaleString()} ETB)` : ''}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Storage
                </label>
                <input
                  type="text"
                  placeholder="e.g. 256GB"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  RAM / Memory
                </label>
                <input
                  type="text"
                  placeholder="e.g. 8GB, 12GB"
                  value={ram}
                  onChange={(e) => setRam(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  placeholder="e.g. Black"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="new">Brand New</option>
                  <option value="used_clean">Used Clean</option>
                  <option value="used_minor_scratches">Minor Scratches</option>
                  <option value="refurbished">Refurbished</option>
                </select>
              </div>

              {isPhone ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Battery %</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batteryHealth}
                    onChange={(e) => setBatteryHealth(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              ) : (
                <div />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Serial / IMEI #
              </label>
              <div className="relative">
                <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="3598711099..."
                  value={imeiOrSerial}
                  onChange={(e) => setImeiOrSerial(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION 2: VENDOR & SOURCING COST ── */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Vendor Sourcing & Payout <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Vendor / Broker Partner *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddPartnerOpen(true)}
                    className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Partner</span>
                  </button>
                </div>
                <select
                  value={vendorContactId}
                  required
                  onChange={(e) => setVendorContactId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="">— Select Vendor Partner —</option>
                  {vendorContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Vendor Cost (ETB) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="e.g. 85,000"
                  value={vendorCost}
                  onChange={(e) => setVendorCost(formatCurrencyInput(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
            </div>

            {/* Vendor Settlement Mode Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setVendorPaymentType('immediate_account')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  vendorPaymentType === 'immediate_account'
                    ? 'border-slate-800 bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 shadow-xs font-bold ring-1 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${vendorPaymentType === 'immediate_account' ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <div>
                  <div className={`text-xs font-bold ${vendorPaymentType === 'immediate_account' ? 'text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    Pay Vendor Now
                  </div>
                  <div className={`text-[10px] font-normal mt-0.5 ${vendorPaymentType === 'immediate_account' ? 'text-slate-300 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    Deduct from shop bank / cash
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVendorPaymentType('payable_debt')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  vendorPaymentType === 'payable_debt'
                    ? 'border-slate-800 bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 shadow-xs font-bold ring-1 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Clock className={`w-4 h-4 mt-0.5 shrink-0 ${vendorPaymentType === 'payable_debt' ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <div>
                  <div className={`text-xs font-bold ${vendorPaymentType === 'payable_debt' ? 'text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    Pay Vendor Later
                  </div>
                  <div className={`text-[10px] font-normal mt-0.5 ${vendorPaymentType === 'payable_debt' ? 'text-slate-300 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    Record in vendor debt ledger
                  </div>
                </div>
              </button>
            </div>

            {/* Payout Account selection if Pay Now */}
            {vendorPaymentType === 'immediate_account' && (
              <div className="space-y-1.5 pt-1">
                <SplitPaymentSelector
                  accounts={accounts}
                  targetAmount={vendorCostNum}
                  singleAccountId={vendorAccountId}
                  onSingleAccountChange={setVendorAccountId}
                  isSplit={isVendorSplit}
                  onIsSplitChange={setIsVendorSplit}
                  splits={vendorPaymentSplits}
                  onSplitsChange={setVendorPaymentSplits}
                  direction="outflow"
                  label="Vendor Payout Account *"
                />
                {!isVendorSplit && isVendorAccountOverdrawn && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Insufficient balance in selected payout account</span>
                  </div>
                )}
                {isVendorSplit && isAnyVendorSplitOverdrawn && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Insufficient balance in one or more split payout accounts</span>
                  </div>
                )}
                {!isVendorSplit && selectedVendorAccount && selectedVendorAccount.default_fee_type && selectedVendorAccount.default_fee_type !== 'none' && Number(selectedVendorAccount.default_fee_amount) > 0 && vendorCostNum > 0 && (
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1">
                      <span className="font-bold">Outgoing Fee ({Number(selectedVendorAccount.default_fee_amount)}{selectedVendorAccount.default_fee_type === 'percentage' ? '%' : ' ETB'}):</span>
                      <span>+{vendorFee.toLocaleString()} ETB</span>
                    </span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      Total deducted: <span className="font-bold font-mono text-slate-900 dark:text-white">{totalVendorDeduction.toLocaleString()} ETB</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION 3: CUSTOMER SALE & CHECKOUT ── */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Customer Sale & Checkout <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Customer Selling Price (ETB) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="e.g. 95,000"
                  value={sellingPrice}
                  onChange={(e) => handleSellingPriceChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Amount Customer Pays Now (ETB) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(formatCurrencyInput(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>
            </div>

            {/* Margin Pill */}
            {sellingPriceNum > 0 && vendorCostNum > 0 && (
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border ${
                  isLossDeal
                    ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40'
                }`}
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {isLossDeal ? 'Below Vendor Cost' : 'Direct Profit Margin'}
                </span>
                <span className="font-mono font-bold">
                  {grossProfit >= 0 ? '+' : ''}
                  {grossProfit.toLocaleString()} ETB ({marginPct.toFixed(1)}%)
                </span>
              </div>
            )}

            {/* Customer Pill Toggle */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <UserIcon className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                  Customer
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode('walk_in');
                      setCustomerId('');
                      setCustomerName('');
                      setCustomerPhone('');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      customerMode === 'walk_in'
                        ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
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
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      customerMode === 'new'
                        ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    + New
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('existing')}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      customerMode === 'existing'
                        ? 'bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 shadow-xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Existing
                  </button>
                </div>
              </div>

              {customerMode === 'new' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Customer Name (Optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Phone (09...)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              )}

              {customerMode === 'existing' && (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="">— Select Customer —</option>
                  {liveContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Payment Method Selector & Shop Receiving Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-1.5">
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
                          if (!isCreditOption && !isWriteOffOption) {
                            if (sellingPriceNum > 0) {
                              setPaidAmount(String(sellingPriceNum));
                            }
                          } else if (isCreditOption && paidAmountNum >= sellingPriceNum) {
                            setPaidAmount('0');
                          } else if (isWriteOffOption && paidAmountNum >= sellingPriceNum) {
                            setPaidAmount('0');
                          }
                        }}
                        className={`h-9 px-2 rounded-xl border text-left flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-slate-800 bg-slate-900 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 font-bold shadow-xs ring-1 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {paidAmountNum > 0 && paymentMethod !== 'debt_offset' && !isCreditSale && !isWriteOff && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Shop Deposit Account *
                  </label>
                  <select
                    value={customerAccountId}
                    required
                    onChange={(e) => setCustomerAccountId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {isOwner && a.current_balance !== null ? ` (${Number(a.current_balance).toLocaleString()} ETB)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Optional Sale Note */}
            <div>
              <input
                type="text"
                placeholder="Optional sale note / warranty note..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Footer with Complete Action */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131926] shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          <div className="text-xs">
            <span className="text-slate-400">Total Price: </span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">
              {sellingPriceNum.toLocaleString()} ETB
            </span>
            {vendorCostNum > 0 && (
              <span className="ml-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                • Net Profit: {grossProfit.toLocaleString()} ETB
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="vendor-direct-form"
              disabled={
                submitting ||
                (!selectedProduct && !customProductName.trim()) ||
                !vendorContactId ||
                vendorCostNum <= 0 ||
                sellingPriceNum <= 0 ||
                (vendorPaymentType === 'immediate_account' && (isVendorSplit ? (isAnyVendorSplitOverdrawn || isVendorSplitMismatch) : isVendorAccountOverdrawn))
              }
              className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-800 text-emerald-400 dark:text-emerald-400 active:scale-[0.98] text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <LdrsSpinner size={15} color="#34d399" stroke={2.5} />
                  <span>Processing Sale...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Complete Vendor Sale</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Partner Modal */}
      <PartnerFormModal
        isOpen={isAddPartnerOpen}
        onClose={() => setIsAddPartnerOpen(false)}
        defaultRole="supplier"
        onSuccess={(saved) => {
          setLiveContacts((prev) => [...prev.filter((c) => c.id !== saved.id), saved]);
          setVendorContactId(saved.id);
        }}
      />
    </div>
  );

  return createPortal(modalContent, document.body);
};
