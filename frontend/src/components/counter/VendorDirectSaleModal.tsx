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
  Loader2,
  Barcode,
  BatteryCharging,
  Building2,
  Clock,
  ShieldAlert,
  Plus,
  Smartphone,
  CreditCard,
  Banknote,
  Wallet,
  User as UserIcon,
} from 'lucide-react';
import { PartnerFormModal } from '../partners/PartnerFormModal';

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
  contacts,
  accounts,
  isOwner = false,
  initialProductId,
  onSaleSuccess,
}) => {
  // Device Selection & Details
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customProductName, setCustomProductName] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
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
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [liveContacts, setLiveContacts] = useState<Contact[]>(contacts);

  // Customer & POS Sale Details
  const [sellingPrice, setSellingPrice] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('telebirr');
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

  // Set initial product or defaults
  useEffect(() => {
    if (isOpen) {
      if (initialProductId) {
        const prod = products.find((p) => p.id === initialProductId);
        if (prod) {
          setSelectedProductId(prod.id);
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
      }
      if (accounts.length > 0) {
        if (!vendorAccountId) setVendorAccountId(accounts[0].id);
        if (!customerAccountId) setCustomerAccountId(accounts[0].id);
      }
    }
  }, [isOpen, initialProductId, products, accounts]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const vendorContacts = useMemo(
    () => liveContacts.filter((contact) =>
      contact.is_active !== false &&
      ['vendor', 'peer_vendor', 'supplier', 'partner'].some((role) => contact.roles?.includes(role))
    ),
    [liveContacts]
  );

  const isPhone = useMemo(() => {
    const name = (selectedProduct?.name || customProductName).toLowerCase();
    const cat = (selectedProduct?.category || '').toLowerCase();
    return (
      cat.includes('phone') ||
      cat.includes('smartphone') ||
      name.includes('iphone') ||
      name.includes('galaxy') ||
      name.includes('pixel')
    );
  }, [selectedProduct, customProductName]);

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

    const finalProductName = selectedProduct ? selectedProduct.name : customProductName.trim();
    if (!finalProductName) {
      toast.error('Please select or enter the device model name');
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

    if (vendorPaymentType === 'immediate_account' && isVendorAccountOverdrawn) {
      toast.error('Insufficient balance in selected payout account');
      return;
    }

    if (paidAmountNum > 0 && paymentMethod !== 'cash' && !customerAccountId) {
      toast.error('Please select the shop receiving account');
      return;
    }

    if (submitting || submittingRef.current) {
      return;
    }

    try {
      submittingRef.current = true;
      setSubmitting(true);

      const payload = {
        product_id: selectedProductId || undefined,
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
        vendor_payment_account_id: vendorPaymentType === 'immediate_account' ? vendorAccountId : undefined,
        selling_price: sellingPriceNum,
        paid_amount: paidAmountNum,
        payment_method: paymentMethod as any,
        financial_account_id: paidAmountNum > 0 && paymentMethod !== 'cash' ? customerAccountId : undefined,
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
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[90vh] sm:max-h-[calc(100vh-6rem)] my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none flex items-center gap-1.5">
                <span>Source from Vendor</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  1-Step POS
                </span>
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Device Details <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Catalog Model
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setSelectedProductId(pid);
                    const prod = products.find((p) => p.id === pid);
                    if (prod?.variants && prod.variants.length > 0) {
                      setSelectedVariantId(prod.variants[0].id);
                      if (prod.variants[0].storage) setStorage(prod.variants[0].storage);
                      if (prod.variants[0].ram) setRam(prod.variants[0].ram);
                      if (prod.variants[0].color) setColor(prod.variants[0].color);
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="">— Custom Model (Type Below) —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.brand ? `(${p.brand})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedProductId ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Custom Model Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. iPhone 16 Pro Max"
                    value={customProductName}
                    onChange={(e) => setCustomProductName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              ) : selectedProduct?.variants && selectedProduct.variants.length > 0 ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Variant
                  </label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => {
                      const vid = e.target.value;
                      setSelectedVariantId(vid);
                      const v = selectedProduct.variants.find((item) => item.id === vid);
                      if (v?.storage) setStorage(v.storage);
                      if (v?.ram) setRam(v.ram);
                      if (v?.color) setColor(v.color);
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    {selectedProduct.variants.map((v) => {
                      const ramLabel = v.ram ? (v.ram.toLowerCase().includes('ram') ? v.ram : `${v.ram} RAM`) : null;
                      const label = [v.storage, ramLabel, v.color].filter(Boolean).join(' · ') || 'Standard';
                      return (
                        <option key={v.id} value={v.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}
            </div>

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
                    className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5 cursor-pointer"
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
                    ? 'border-slate-900 dark:border-slate-200 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Pay Vendor Now</div>
                  <div className="text-[10px] opacity-75 font-normal mt-0.5">
                    Deduct from shop bank / cash
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVendorPaymentType('payable_debt')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  vendorPaymentType === 'payable_debt'
                    ? 'border-amber-500 bg-amber-500 text-white shadow-xs font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-amber-300'
                }`}
              >
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Pay Vendor Later</div>
                  <div className="text-[10px] opacity-75 font-normal mt-0.5">
                    Record in vendor debt ledger
                  </div>
                </div>
              </button>
            </div>

            {/* Payout Account selection if Pay Now */}
            {vendorPaymentType === 'immediate_account' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Vendor Payout Account *
                  </label>
                  {isVendorAccountOverdrawn && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
                      <ShieldAlert className="w-3 h-3" />
                      Insufficient balance
                    </span>
                  )}
                </div>
                <select
                  value={vendorAccountId}
                  required
                  onChange={(e) => setVendorAccountId(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer ${
                    isVendorAccountOverdrawn ? 'border-rose-300 dark:border-rose-700 ring-1 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {isOwner && a.current_balance !== null ? ` (${Number(a.current_balance).toLocaleString()} ETB)` : ''}
                    </option>
                  ))}
                </select>
                {selectedVendorAccount && selectedVendorAccount.default_fee_type && selectedVendorAccount.default_fee_type !== 'none' && Number(selectedVendorAccount.default_fee_amount) > 0 && vendorCostNum > 0 && (
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
                        : 'text-slate-500'
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
                        : 'text-slate-500'
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
                        : 'text-slate-500'
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
                    { value: 'telebirr', label: 'TeleBirr', icon: Smartphone },
                    { value: 'cbe', label: 'CBE', icon: CreditCard },
                    { value: 'cash', label: 'Cash', icon: Banknote },
                    { value: 'bank_transfer', label: 'Other Bank', icon: Wallet },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPaymentMethod(m.value)}
                        className={`h-9 px-2 rounded-xl border text-left flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {paidAmountNum > 0 && paymentMethod !== 'cash' && (
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
                (vendorPaymentType === 'immediate_account' && isVendorAccountOverdrawn)
              }
              className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Sale...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
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
