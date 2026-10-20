import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type {
  User,
  Tenant,
  Contact,
  FinancialAccount,
  Product,
  ProductVariant,
  ProformaInvoice,
  ProformaInvoiceItem,
} from '../../api/client';
import { api } from '../../api/client';
import {
  X,
  Plus,
  Trash2,
  Upload,
  Move,
  Loader2,
  Search,
  Download,
  ChevronDown,
  RotateCcw,
  RotateCw,
  Maximize2,
  PenTool,
  Stamp as StampIcon,
  Eye,
  EyeOff,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';
import { SignaturePadModal } from '../signature/SignaturePadModal';
import { StampProcessorModal } from '../signature/StampProcessorModal';

interface ProformaInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (invoice: ProformaInvoice) => void;
  initialInvoice?: ProformaInvoice | null;
  user: User | null;
  tenant: Tenant | null;
  contacts?: Contact[];
  accounts?: FinancialAccount[];
}

export const ProformaInvoiceModal: React.FC<ProformaInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialInvoice,
  user,
  tenant,
  contacts = [],
  accounts = [],
}) => {
  // Main view mode: 'form' or 'placement'
  const [activeView, setActiveView] = useState<'form' | 'placement'>('form');

  // Core Fields (Minimal, clean like hale.jpg)
  const [customerName, setCustomerName] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Optional expandable client fields (kept hidden by default to remove clutter)
  const [showExtraClientDetails, setShowExtraClientDetails] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerTin, setCustomerTin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');

  // Tax treatment
  const [taxMode, setTaxMode] = useState<'vat15' | 'none' | 'wht15'>('vat15');

  // Line items
  const [items, setItems] = useState<ProformaInvoiceItem[]>([
    {
      item_number: 1,
      description: '',
      unit_of_measure: 'Pcs',
      quantity: 1,
      unit_price: 0,
      tax_rate: 15,
    },
  ]);

  // Catalog item picker modal/dropdown
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [pickingItemIndex, setPickingItemIndex] = useState<number | null>(null);

  // Full-page Drag & Drop Signature & Stamp State
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [hasCustomPlacement, setHasCustomPlacement] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);

  // Coordinates on full A4 canvas (0 to 100 percentage of the whole document)
  // Default placement positioned neatly over Authorized Signature & Stamp area
  const [stampPosition, setStampPosition] = useState({ x: 74, y: 84, width: 22, height: 18, rotation: 0, opacity: 90 });
  const [sigPosition, setSigPosition] = useState({ x: 78, y: 89, width: 20, height: 10, rotation: 0 });

  const [activeOverlay, setActiveOverlay] = useState<'stamp' | 'sig'>('stamp');
  const [draggingTarget, setDraggingTarget] = useState<'stamp' | 'sig' | null>(null);
  const [resizingTarget, setResizingTarget] = useState<'stamp' | 'sig' | null>(null);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isStampModalOpen, setIsStampModalOpen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form
  useEffect(() => {
    if (initialInvoice) {
      setCustomerName(initialInvoice.customer_name || '');
      setSelectedContactId(initialInvoice.customer_id || null);
      setCustomerPhone(initialInvoice.customer_phone || '');
      setCustomerTin(initialInvoice.customer_tin || '');
      setCustomerAddress(initialInvoice.customer_address || '');
      setIssueDate(initialInvoice.issue_date || new Date().toISOString().slice(0, 10));

      if (initialInvoice.customer_phone || initialInvoice.customer_tin || initialInvoice.customer_address) {
        setShowExtraClientDetails(true);
      }

      if (Number(initialInvoice.withholding_rate) > 0) {
        setTaxMode('wht15');
      } else if (Number(initialInvoice.vat_rate) === 0 && Number(initialInvoice.vat_total) === 0) {
        setTaxMode('none');
      } else {
        setTaxMode('vat15');
      }

      if (initialInvoice.items && initialInvoice.items.length > 0) {
        setItems(
          initialInvoice.items.map((it, idx) => ({
            id: it.id,
            item_number: it.item_number || idx + 1,
            description: it.description || '',
            unit_of_measure: it.unit_of_measure || 'Pcs',
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
            tax_rate: Number(it.tax_rate) !== undefined ? Number(it.tax_rate) : 15,
            product_id: it.product_id,
            variant_id: it.variant_id,
          }))
        );
      }

      const cfg = initialInvoice.signature_stamp_config;
      if (cfg) {
        setSignatureUrl(cfg.signature_url || null);
        setStampUrl(cfg.stamp_url || null);
        setShowSignature(cfg.show_signature !== false);
        setShowStamp(cfg.show_stamp !== false);
        setHasCustomPlacement(Boolean(cfg.has_custom_placement));
        if (cfg.stamp_position) {
          setStampPosition({
            x: Number(cfg.stamp_position.x) || 74,
            y: Number(cfg.stamp_position.y) || 84,
            width: Number(cfg.stamp_position.width) || 22,
            height: Number(cfg.stamp_position.height) || 18,
            rotation: Number(cfg.stamp_position.rotation) || 0,
            opacity: Number(cfg.stamp_position.opacity) || 90,
          });
        }
        if (cfg.signature_position) {
          setSigPosition({
            x: Number(cfg.signature_position.x) || 78,
            y: Number(cfg.signature_position.y) || 89,
            width: Number(cfg.signature_position.width) || 20,
            height: Number(cfg.signature_position.height) || 10,
            rotation: Number(cfg.signature_position.rotation) || 0,
          });
        }
      }
    } else {
      setCustomerName('');
      setSelectedContactId(null);
      setCustomerPhone('');
      setCustomerTin('');
      setCustomerAddress('');
      setShowExtraClientDetails(false);
      setIssueDate(new Date().toISOString().slice(0, 10));
      setTaxMode('vat15');
      setItems([
        {
          item_number: 1,
          description: '',
          unit_of_measure: 'Pcs',
          quantity: 1,
          unit_price: 0,
          tax_rate: 15,
        },
      ]);
      setSignatureUrl(tenant?.settings?.default_signature_url || null);
      setStampUrl(tenant?.settings?.default_stamp_url || null);
      setStampPosition({ x: 74, y: 84, width: 22, height: 18, rotation: 0, opacity: 90 });
      setSigPosition({ x: 78, y: 89, width: 20, height: 10, rotation: 0 });
      setHasCustomPlacement(false);
    }
  }, [initialInvoice, isOpen, tenant]);

  // Load catalog for quick-fill
  useEffect(() => {
    if (isOpen && catalogProducts.length === 0) {
      api
        .getProducts()
        .then((res) => {
          setCatalogProducts(Array.isArray(res) ? res : (res as any).data || []);
        })
        .catch(() => {});
    }
  }, [isOpen, catalogProducts.length]);

  // Calculate live line item totals and summaries
  const calculations = useMemo(() => {
    let subtotalSum = 0;

    const lineCalculations = items.map((it) => {
      const qty = Math.max(0.01, Number(it.quantity) || 1);
      const price = Math.max(0, Number(it.unit_price) || 0);
      const lineTotal = Math.round(qty * price * 100) / 100;
      subtotalSum += lineTotal;

      return {
        lineTotal,
      };
    });

    let vatRate = 0;
    let vatAmount = 0;
    let whtRate = 0;
    let whtAmount = 0;

    if (taxMode === 'vat15') {
      vatRate = 15;
      vatAmount = Math.round(subtotalSum * 0.15 * 100) / 100;
    } else if (taxMode === 'wht15') {
      whtRate = 1.5;
      whtAmount = Math.round(subtotalSum * 0.015 * 100) / 100;
    }

    const grossTotal = Math.round((subtotalSum + vatAmount) * 100) / 100;
    const netPayable = Math.max(0, Math.round((grossTotal - whtAmount) * 100) / 100);

    return {
      lines: lineCalculations,
      subtotal: Math.round(subtotalSum * 100) / 100,
      vatRate,
      vatTotal: vatAmount,
      withholdingRate: whtRate,
      withholdingTotal: whtAmount,
      grandTotal: netPayable,
    };
  }, [items, taxMode]);

  // Handle contact selection
  const handleSelectContact = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setCustomerName(contact.name);
    setCustomerPhone(contact.phone || '');
    setCustomerTin(contact.tax_number || '');
    setCustomerAddress(contact.address || '');
    if (contact.phone || contact.tax_number || contact.address) {
      setShowExtraClientDetails(true);
    }
    setContactSearchOpen(false);
  };

  // Add line item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item_number: prev.length + 1,
        description: '',
        unit_of_measure: 'Pcs',
        quantity: 1,
        unit_price: 0,
        tax_rate: taxMode === 'vat15' ? 15 : 0,
      },
    ]);
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('At least one item is required.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index).map((it, idx) => ({ ...it, item_number: idx + 1 })));
  };

  // Quick fill from catalog
  const handlePickProduct = (itemIdx: number, variant: ProductVariant, product: Product) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = {
        ...copy[itemIdx],
        product_id: product.id,
        variant_id: variant.id,
        description: `${product.name} ${variant.display_name || variant.storage || ''}`.trim(),
        unit_price: Number(variant.default_selling_price) || copy[itemIdx].unit_price || 0,
      };
      return copy;
    });
    setPickingItemIndex(null);
  };

  // Upload signature / stamp asset
  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, type: 'signature' | 'stamp') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'signature') setIsUploadingSignature(true);
    else setIsUploadingStamp(true);

    try {
      const res = await api.uploadProformaAsset(file, type);
      if (type === 'signature') {
        setSignatureUrl(res.url);
        setShowSignature(true);
        toast.success('Signature uploaded');
      } else {
        setStampUrl(res.url);
        setShowStamp(true);
        toast.success('Official stamp uploaded');
      }
    } catch (err: any) {
      toast.error('Upload failed', { description: err.message || 'Please upload an image file.' });
    } finally {
      if (type === 'signature') setIsUploadingSignature(false);
      else setIsUploadingStamp(false);
    }
  };

  // Full-page pointer & touch drag and resize handler
  const handleCanvasDragMove = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (resizingTarget) {
      if (!resizeStartRef.current) return;
      setHasCustomPlacement(true);
      const deltaX = clientX - resizeStartRef.current.startX;
      const deltaPercent = (deltaX / rect.width) * 100;
      const newWidth = Math.max(10, Math.min(55, Math.round(resizeStartRef.current.startWidth + deltaPercent)));

      if (resizingTarget === 'stamp') {
        setStampPosition((prev) => ({ ...prev, width: newWidth }));
      } else if (resizingTarget === 'sig') {
        setSigPosition((prev) => ({ ...prev, width: newWidth }));
      }
      return;
    }

    if (draggingTarget) {
      setHasCustomPlacement(true);
      const xPercent = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
      const yPercent = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));

      if (draggingTarget === 'stamp') {
        setStampPosition((prev) => ({ ...prev, x: Math.round(xPercent), y: Math.round(yPercent) }));
      } else if (draggingTarget === 'sig') {
        setSigPosition((prev) => ({ ...prev, x: Math.round(xPercent), y: Math.round(yPercent) }));
      }
    }
  };

  const handlePointerUp = () => {
    setDraggingTarget(null);
    setResizingTarget(null);
    resizeStartRef.current = null;
  };

  // Save proforma invoice
  const handleSave = async (status: 'draft' | 'sent' = 'draft', andDownloadPdf = false) => {
    if (!customerName.trim()) {
      toast.error('Please enter customer / company name (To:)');
      return;
    }

    if (items.some((it) => !it.description.trim())) {
      toast.error('Please enter description for all items');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_id: selectedContactId,
        customer_phone: customerPhone.trim() || null,
        customer_tin: customerTin.trim() || null,
        customer_address: customerAddress.trim() || null,
        issue_date: issueDate,
        currency: tenant?.currency_code || tenant?.currency || 'ETB',
        status,
        vat_rate: calculations.vatRate,
        withholding_rate: calculations.withholdingRate,
        shipping_fee: 0,
        prepared_by: user?.name || null,
        bank_account_id: accounts[0]?.id || null,
        signature_stamp_config: {
          signature_url: signatureUrl,
          stamp_url: stampUrl,
          show_signature: showSignature,
          show_stamp: showStamp,
          has_custom_placement: hasCustomPlacement,
          stamp_position: stampPosition,
          signature_position: sigPosition,
        },
        items: items.map((it, idx) => ({
          item_number: idx + 1,
          product_id: it.product_id || null,
          variant_id: it.variant_id || null,
          description: it.description.trim(),
          unit_of_measure: it.unit_of_measure?.trim() || 'Pcs',
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          discount_type: 'percentage',
          discount_rate: 0,
          tax_rate: calculations.vatRate,
        })),
      };

      let savedInvoice: ProformaInvoice;
      if (initialInvoice?.id) {
        const res = await api.updateProformaInvoice(initialInvoice.id, payload);
        savedInvoice = (res as any).data || res;
        toast.success(`Proforma #${savedInvoice.proforma_number} updated.`);
      } else {
        const res = await api.createProformaInvoice(payload);
        savedInvoice = (res as any).data || res;
        toast.success(`Proforma #${savedInvoice.proforma_number} saved.`);
      }

      onSaved(savedInvoice);

      if (andDownloadPdf && savedInvoice.id) {
        try {
          const blob = await api.downloadProformaPdf(savedInvoice.id, true);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Proforma_${savedInvoice.proforma_number}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
          toast.error('Document saved, but PDF download failed.');
        }
      }

      onClose();
    } catch (err: any) {
      toast.error('Save failed', { description: err.message || 'Please check entries.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs select-none">
      <div className="bg-white dark:bg-[#111622] rounded-t-3xl sm:rounded-2xl w-full max-w-4xl h-[92vh] sm:h-[94vh] sm:max-h-[860px] flex flex-col shadow-2xl overflow-hidden border-t sm:border border-slate-200/80 dark:border-slate-800 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        
        {/* Mobile Bottom Sheet Grab Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Responsive Header: Clean on Mobile, Uncluttered on Desktop */}
        <div className="px-4 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                {initialInvoice ? `Edit Performa #${initialInvoice.proforma_number}` : 'New Performa Invoice'}
              </h2>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[140px] sm:max-w-none">
                {tenant?.name || 'HabeshaBiz'}
              </span>
            </div>

            {/* Mobile Close Button (Top-Right) */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex sm:hidden items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher: Full-width segmented pill on mobile, compact on desktop */}
            <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveView('form')}
                className={`px-3 py-1.5 sm:py-1 rounded-md text-center transition-colors ${
                  activeView === 'form'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Invoice Entry
              </button>
              <button
                type="button"
                onClick={() => setActiveView('placement')}
                className={`px-3 py-1.5 sm:py-1 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                  activeView === 'placement'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Move className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Stamp & Sig</span>
              </button>
            </div>

            {/* Desktop Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {activeView === 'form' ? (
            <>
              {/* Header Details (From / To / Date) - Flat, direct like hale.jpg */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pb-2 border-b border-slate-100 dark:border-slate-800/60">
                {/* To: Customer Input */}
                <div className="sm:col-span-8 space-y-1 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      To: Customer or Entity Name *
                    </label>

                    {contacts.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setContactSearchOpen(!contactSearchOpen)}
                          className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Pick from Contacts</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>

                        {contactSearchOpen && (
                          <div className="absolute right-0 top-5 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 z-30 space-y-1">
                            <input
                              type="text"
                              value={contactSearchQuery}
                              onChange={(e) => setContactSearchQuery(e.target.value)}
                              placeholder="Search..."
                              className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                              autoFocus
                            />
                            <div className="max-h-40 overflow-y-auto space-y-0.5">
                              {contacts
                                .filter((c) => c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()))
                                .map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => handleSelectContact(c)}
                                    className="w-full text-left px-2 py-1 rounded text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white"
                                  >
                                    <div className="font-semibold">{c.name}</div>
                                  </button>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. OLA Energy Ethiopia Limited"
                    className="w-full h-10 sm:h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white transition-all shadow-2xs"
                    required
                  />

                  {/* Optional client details expander */}
                  <div className="pt-1">
                    {!showExtraClientDetails ? (
                      <button
                        type="button"
                        onClick={() => setShowExtraClientDetails(true)}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Phone, TIN or Delivery Address</span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 animate-in fade-in duration-100">
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium block mb-0.5 sm:hidden">Phone</label>
                          <input
                            type="text"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Phone: +251 91..."
                            className="w-full h-9 sm:h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium block mb-0.5 sm:hidden">Client TIN</label>
                          <input
                            type="text"
                            value={customerTin}
                            onChange={(e) => setCustomerTin(e.target.value)}
                            placeholder="Client TIN: 00123..."
                            className="w-full h-9 sm:h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-medium block mb-0.5 sm:hidden">Address</label>
                          <input
                            type="text"
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            placeholder="Address: Bole, Addis Ababa"
                            className="w-full h-9 sm:h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date Input */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Date
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full h-10 sm:h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white shadow-2xs"
                  />
                </div>
              </div>

              {/* Items Table Section - Clean, flat, matching hale.jpg */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Items & Hardware
                  </span>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* Desktop Table View (>= 640px) */}
                <div className="hidden sm:block border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-400">
                        <th className="py-2.5 px-3 w-10 text-center">S.No</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-2 w-20 text-center">Unit</th>
                        <th className="py-2.5 px-2 w-20 text-right">Qty</th>
                        <th className="py-2.5 px-3 w-28 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 w-28 text-right">Total</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {items.map((item, idx) => {
                        const line = calculations.lines[idx] || { lineTotal: 0 };
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setItems((prev) => {
                                      const copy = [...prev];
                                      copy[idx].description = val;
                                      return copy;
                                    });
                                  }}
                                  placeholder="e.g. Magic Keyboard for iPad M5..."
                                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                                  required
                                />
                                {catalogProducts.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setPickingItemIndex(idx)}
                                    title="Pick product from stock"
                                    className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={item.unit_of_measure || 'Pcs'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setItems((prev) => {
                                    const copy = [...prev];
                                    copy[idx].unit_of_measure = val;
                                    return copy;
                                  });
                                }}
                                className="w-full h-8 px-1 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              />
                            </td>
                            <td className="py-2 px-2">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setItems((prev) => {
                                    const copy = [...prev];
                                    copy[idx].quantity = val;
                                    return copy;
                                  });
                                }}
                                className="w-full h-8 px-2 text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unit_price}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setItems((prev) => {
                                    const copy = [...prev];
                                    copy[idx].unit_price = val;
                                    return copy;
                                  });
                                }}
                                className="w-full h-8 px-2 text-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {line.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Responsive Item View (< 640px) */}
                <div className="block sm:hidden space-y-3">
                  {items.map((item, idx) => {
                    const line = calculations.lines[idx] || { lineTotal: 0 };
                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 rounded-2xl space-y-2.5 border border-slate-200/80 dark:border-slate-800 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            #{idx + 1}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            {catalogProducts.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setPickingItemIndex(idx)}
                                className="h-7 px-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                              >
                                <Search className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>Catalog</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              disabled={items.length <= 1}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                            Item & Description
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItems((prev) => {
                                const copy = [...prev];
                                copy[idx].description = val;
                                return copy;
                              });
                            }}
                            placeholder="e.g. Magic Keyboard for iPad M5..."
                            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-medium"
                            required
                          />
                        </div>

                        {/* Unit / Qty / Price 3-col Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                              Unit
                            </label>
                            <input
                              type="text"
                              value={item.unit_of_measure || 'Pcs'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItems((prev) => {
                                  const copy = [...prev];
                                  copy[idx].unit_of_measure = val;
                                  return copy;
                                });
                              }}
                              className="w-full h-9 px-2 text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                              Qty
                            </label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setItems((prev) => {
                                  const copy = [...prev];
                                  copy[idx].quantity = val;
                                  return copy;
                                });
                              }}
                              className="w-full h-9 px-2 text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                              Price (ETB)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.unit_price}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setItems((prev) => {
                                  const copy = [...prev];
                                  copy[idx].unit_price = val;
                                  return copy;
                                });
                              }}
                              className="w-full h-9 px-2 text-right rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        {/* Line Total */}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                          <span className="text-slate-400 font-medium text-[11px]">Item Line Total:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {line.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Mobile Add Item Button */}
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full h-10 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white/50 dark:bg-slate-900/40"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* Catalog Quick Picker Modal */}
                {pickingItemIndex !== null && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Pick product from inventory catalog
                      </span>
                      <button
                        type="button"
                        onClick={() => setPickingItemIndex(null)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto">
                      {catalogProducts.map((p) =>
                        p.variants?.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handlePickProduct(pickingItemIndex, v, p)}
                            className="p-2 text-left bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-900 dark:hover:border-white text-xs transition-colors"
                          >
                            <div className="font-semibold text-slate-900 dark:text-white truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {v.display_name || v.storage || v.sku || 'Unit'} · {Number(v.default_selling_price || 0).toLocaleString()} ETB
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement Summary (Right-aligned table matching hale.jpg) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                {/* Tax Option Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tax Treatment:</span>
                  <select
                    value={taxMode}
                    onChange={(e) => setTaxMode(e.target.value as any)}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-white"
                  >
                    <option value="vat15">15% VAT (Standard)</option>
                    <option value="none">No VAT (0% Exempt)</option>
                    <option value="wht15">1.5% Withholding Tax (WHT)</option>
                  </select>
                </div>

                {/* Minimal Summary Box */}
                <div className="w-full sm:w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-[11px]">Sub Total</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {calculations.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {taxMode === 'vat15' && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span className="font-semibold uppercase tracking-wider text-[11px]">VAT (15%)</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {calculations.vatTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {taxMode === 'wht15' && (
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span className="font-semibold uppercase tracking-wider text-[11px]">Less: WHT (1.5%)</span>
                      <span className="font-mono font-bold">
                        - {calculations.withholdingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t-2 border-slate-900 dark:border-white pt-2 text-sm font-extrabold text-slate-900 dark:text-white">
                    <span>GRAND TOTAL</span>
                    <span className="font-mono">
                      {calculations.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Full-page Interactive Placement Canvas (Move Stamp & Signature Anywhere!) */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Stamp & Signature Placement, Scale & Rotation
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Drag elements anywhere on the page, or tap quick placement presets below.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs active:scale-98">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingStamp ? 'Uploading...' : 'Quick Stamp'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadAsset(e, 'stamp')}
                      disabled={isUploadingStamp}
                    />
                  </label>

                  <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs active:scale-98">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingSignature ? 'Uploading...' : 'Quick Sig'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadAsset(e, 'signature')}
                      disabled={isUploadingSignature}
                    />
                  </label>
                </div>
              </div>

              {/* Interactive Sizing & Rotation Control Strip */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Overlay Switcher Tabs */}
                  <div className="grid grid-cols-2 gap-1 sm:flex sm:items-center p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setActiveOverlay('stamp')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        activeOverlay === 'stamp'
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <StampIcon className="w-3.5 h-3.5" />
                      <span>Company Stamp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveOverlay('sig')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        activeOverlay === 'sig'
                          ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Authorized Sig</span>
                    </button>
                  </div>

                  {/* Actions for Active Overlay */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeOverlay === 'stamp' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowStamp(!showStamp)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                            showStamp
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}
                        >
                          {showStamp ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{showStamp ? 'Visible' : 'Hidden'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsStampModalOpen(true)}
                          className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Process & Clean</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowSignature(!showSignature)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                            showSignature
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}
                        >
                          {showSignature ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{showSignature ? 'Visible' : 'Hidden'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSignatureModalOpen(true)}
                          className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Draw Pad</span>
                        </button>
                      </>
                    )}

                    {hasCustomPlacement && (
                      <button
                        type="button"
                        onClick={() => {
                          setHasCustomPlacement(false);
                          toast.success('Auto-aligned over authorized signature & stamp area');
                        }}
                        className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                        title="Auto-align signature and stamp directly on the signature line"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Auto-Align to Line</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Mobile Native Placement Presets */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Quick Placement Presets</span>
                    <span className="text-[9px] font-normal text-slate-400 sm:hidden">Tap to instant position</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setHasCustomPlacement(false);
                        toast.success('Auto-aligned to authorized line');
                      }}
                      className={`p-2 rounded-xl border text-[11px] font-semibold text-center transition-all cursor-pointer ${
                        !hasCustomPlacement
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Auto-Align (Default)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHasCustomPlacement(true);
                        setStampPosition((prev) => ({ ...prev, x: 74, y: 84 }));
                        setSigPosition((prev) => ({ ...prev, x: 78, y: 89 }));
                        toast.success('Positioned: Bottom Right');
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-center cursor-pointer active:scale-95"
                    >
                      Bottom Right
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHasCustomPlacement(true);
                        setStampPosition((prev) => ({ ...prev, x: 26, y: 84 }));
                        setSigPosition((prev) => ({ ...prev, x: 30, y: 89 }));
                        toast.success('Positioned: Bottom Left');
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-center cursor-pointer active:scale-95"
                    >
                      Bottom Left
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHasCustomPlacement(true);
                        setStampPosition((prev) => ({ ...prev, x: 50, y: 55 }));
                        setSigPosition((prev) => ({ ...prev, x: 50, y: 65 }));
                        toast.success('Positioned: Document Center');
                      }}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-center cursor-pointer active:scale-95"
                    >
                      Document Center
                    </button>
                  </div>
                </div>

                {/* Resize, Rotation & Opacity Sliders for Active Overlay */}
                <div className={`grid grid-cols-1 ${activeOverlay === 'stamp' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs`}>
                  {/* Size / Scale Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        {activeOverlay === 'stamp' ? 'Stamp Scale' : 'Signature Scale'}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {activeOverlay === 'stamp' ? stampPosition.width : sigPosition.width}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeOverlay === 'stamp') setStampPosition((prev) => ({ ...prev, width: Math.max(10, prev.width - 4) }));
                          else setSigPosition((prev) => ({ ...prev, width: Math.max(10, prev.width - 4) }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="10"
                        max="55"
                        value={activeOverlay === 'stamp' ? stampPosition.width : sigPosition.width}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (activeOverlay === 'stamp') setStampPosition((prev) => ({ ...prev, width: val }));
                          else setSigPosition((prev) => ({ ...prev, width: val }));
                        }}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500 bg-slate-200 dark:bg-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (activeOverlay === 'stamp') setStampPosition((prev) => ({ ...prev, width: Math.min(55, prev.width + 4) }));
                          else setSigPosition((prev) => ({ ...prev, width: Math.min(55, prev.width + 4) }));
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Rotation Angle Slider & Quick Angle Presets */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">Rotation Angle</span>
                      <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                        <span>{activeOverlay === 'stamp' ? stampPosition.rotation || 0 : sigPosition.rotation || 0}°</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeOverlay === 'stamp') setStampPosition((prev) => ({ ...prev, rotation: 0 }));
                            else setSigPosition((prev) => ({ ...prev, rotation: 0 }));
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-600 font-normal underline ml-1 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeOverlay === 'stamp') setStampPosition((prev) => ({ ...prev, rotation: (prev.rotation || 0) - 15 }));
                          else setSigPosition((prev) => ({ ...prev, rotation: (prev.rotation || 0) - 15 }));
                        }}
                        className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 shrink-0 cursor-pointer active:scale-95"
                        title="Rotate -15 degrees"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        value={activeOverlay === 'stamp' ? stampPosition.rotation || 0 : sigPosition.rotation || 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (activeOverlay === 'stamp') setStampPosition((prev) => ({ ...prev, rotation: val }));
                          else setSigPosition((prev) => ({ ...prev, rotation: val }));
                        }}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500 bg-slate-200 dark:bg-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (activeOverlay === 'stamp') setStampPosition((prev) => ({ ...prev, rotation: (prev.rotation || 0) + 15 }));
                          else setSigPosition((prev) => ({ ...prev, rotation: (prev.rotation || 0) + 15 }));
                        }}
                        className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 shrink-0 cursor-pointer active:scale-95"
                        title="Rotate +15 degrees"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Opacity Slider for Stamp */}
                  {activeOverlay === 'stamp' && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Stamp Opacity</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {stampPosition.opacity ?? 90}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="range"
                          min="20"
                          max="100"
                          value={stampPosition.opacity ?? 90}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setStampPosition((prev) => ({ ...prev, opacity: val }));
                          }}
                          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:accent-emerald-500 bg-slate-200 dark:bg-slate-700"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          {[75, 90, 100].map((op) => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => setStampPosition((prev) => ({ ...prev, opacity: op }))}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                                stampPosition.opacity === op
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 font-bold'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                              }`}
                            >
                              {op}%
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Document Canvas (Proportional to A4 sheet) */}
              <div
                ref={canvasRef}
                onPointerMove={(e) => handleCanvasDragMove(e.clientX, e.clientY)}
                onPointerUp={handlePointerUp}
                onTouchMove={(e) => {
                  if (draggingTarget || resizingTarget) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    if (touch) handleCanvasDragMove(touch.clientX, touch.clientY);
                  }
                }}
                onTouchEnd={handlePointerUp}
                className="w-full aspect-[1/1.35] max-h-[500px] sm:max-h-[580px] bg-white text-slate-900 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-xl relative overflow-hidden select-none touch-none p-4 sm:p-8 flex flex-col justify-between"
              >
                {/* Simulated Executive Proforma Document Layout inside Canvas */}
                <div>
                  {/* Letterhead */}
                  <div className="flex justify-between items-start pb-2 border-b-2 border-slate-900 mb-2">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                        {(tenant?.name || 'HB').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-extrabold text-xs uppercase tracking-tight text-slate-900">{tenant?.name || 'HabeshaBiz Electronics'}</div>
                        <div className="text-[8px] text-slate-500 leading-tight">
                          {tenant?.phone ? `Tel: ${tenant.phone}` : 'Official Corporate Entity'} · Addis Ababa
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-xs tracking-wider text-slate-900 uppercase">PROFORMA INVOICE</div>
                      <div className="text-[8px] font-mono text-slate-600 font-bold">{initialInvoice?.proforma_number ? `#${initialInvoice.proforma_number}` : '#PI-2026-XXXX'}</div>
                      <div className="text-[7.5px] text-slate-500">{issueDate}</div>
                    </div>
                  </div>

                  {/* Recipient Details Strip (ISSUED TO) */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 mb-2 text-[9px]">
                    <div className="text-[7px] font-extrabold uppercase tracking-wider text-slate-400">QUOTATION ISSUED TO (CLIENT / BUYER)</div>
                    <div className="font-extrabold text-slate-900 text-[10px] mt-0.5">{customerName || 'Customer Entity'}</div>
                    <div className="flex flex-col gap-0.5 text-[8px] text-slate-600 mt-1">
                      {customerPhone && <div><span className="font-semibold text-slate-500">Tel:</span> {customerPhone}</div>}
                      {customerTin && <div><span className="font-semibold text-slate-500">TIN / VAT:</span> {customerTin}</div>}
                      {customerAddress && <div><span className="font-semibold text-slate-500">Address:</span> {customerAddress}</div>}
                      {!customerPhone && !customerTin && !customerAddress && <div>Official Customer Entity</div>}
                    </div>
                  </div>

                  {/* Executive Line Items Table */}
                  <div className="text-[8.5px] mb-2">
                    <div className="flex font-extrabold uppercase bg-slate-100 border-y border-slate-900 p-1 text-slate-800 text-[7.5px]">
                      <span className="w-6 text-center">#</span>
                      <span className="flex-1">Item & Description</span>
                      <span className="w-8 text-center">Unit</span>
                      <span className="w-8 text-center">Qty</span>
                      <span className="w-16 text-right">Price</span>
                      <span className="w-18 text-right">Total</span>
                    </div>

                    {items.slice(0, 4).map((it, idx) => (
                      <div key={idx} className="flex border-b border-slate-100 p-1">
                        <span className="w-6 text-center font-mono text-slate-400">{idx + 1}</span>
                        <span className="flex-1 font-bold truncate text-slate-900">{it.description || 'Magic keyboard for ipad m5...'}</span>
                        <span className="w-8 text-center text-slate-600">{it.unit_of_measure || 'Pcs'}</span>
                        <span className="w-8 text-center font-mono font-bold text-slate-900">{it.quantity || 1}</span>
                        <span className="w-16 text-right font-mono text-slate-600">{(Number(it.unit_price) || 0).toLocaleString()}</span>
                        <span className="w-18 text-right font-mono font-bold text-slate-900">{((Number(it.quantity) || 1) * (Number(it.unit_price) || 0)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Right-aligned Executive Summary Box */}
                  <div className="flex justify-end text-[8.5px]">
                    <div className="w-48 bg-slate-50 border border-slate-200 rounded p-1.5 space-y-0.5 font-mono">
                      <div className="flex justify-between text-slate-600 text-[8px]"><span>Subtotal:</span><span>{calculations.subtotal.toLocaleString()}</span></div>
                      {taxMode === 'vat15' && <div className="flex justify-between text-slate-600 text-[8px]"><span>VAT (15%):</span><span>+{calculations.vatTotal.toLocaleString()}</span></div>}
                      {taxMode === 'wht15' && <div className="flex justify-between text-rose-600 text-[8px]"><span>Less: WHT (1.5%):</span><span>-{calculations.withholdingTotal.toLocaleString()}</span></div>}
                      <div className="flex justify-between font-extrabold border-t border-slate-900 pt-1 text-[9.5px] text-slate-900">
                        <span>GRAND TOTAL:</span>
                        <span>{calculations.grandTotal.toLocaleString()} ETB</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer in canvas */}
                <div className="text-[8.5px] pt-3 border-t-2 border-slate-900 flex justify-between items-end">
                  <div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase">PREPARED BY</div>
                    <div className="font-bold text-slate-900 text-[10px]">{user?.name || 'Sales Representative'}</div>
                  </div>
                  <div className="w-48 text-right relative">
                    {!hasCustomPlacement && showSignature && signatureUrl && (
                      <div className="h-8 flex items-end justify-center mb-0.5 pointer-events-none">
                        <img src={signatureUrl} alt="Signature" className="max-h-8 max-w-[140px] object-contain" />
                      </div>
                    )}
                    {!hasCustomPlacement && showStamp && stampUrl && (
                      <div
                        className="absolute right-0 -bottom-1 w-14 h-14 pointer-events-none"
                        style={{ opacity: (stampPosition.opacity ?? 90) / 100 }}
                      >
                        <img src={stampUrl} alt="Stamp" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="border-b-2 border-slate-900 pb-0.5 font-mono text-[7px] font-bold text-slate-700 uppercase tracking-wider text-center">
                      AUTHORIZED SIGNATURE & STAMP
                    </div>
                    <div className="text-[6.5px] text-slate-400 text-center mt-0.5">Date & Official Company Seal Verification</div>
                  </div>
                </div>

                {/* Movable & Resizable Official Stamp (When custom positioned or in placement tab) */}
                {showStamp && stampUrl && (hasCustomPlacement || activeView === 'placement') && (
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setActiveOverlay('stamp');
                      setDraggingTarget('stamp');
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setActiveOverlay('stamp');
                      setDraggingTarget('stamp');
                    }}
                    style={{
                      position: 'absolute',
                      left: `${stampPosition.x}%`,
                      top: `${stampPosition.y}%`,
                      width: `${stampPosition.width}%`,
                      transform: `translate(-50%, -50%) rotate(${stampPosition.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                      opacity: (stampPosition.opacity ?? 90) / 100,
                    }}
                    className={`cursor-move p-1.5 border-2 ${
                      activeOverlay === 'stamp'
                        ? 'border-slate-900 dark:border-emerald-500 bg-emerald-50/10 shadow-lg ring-2 ring-emerald-500/20'
                        : 'border-dashed border-slate-400/80 dark:border-emerald-400/60 bg-transparent'
                    } rounded-xl flex items-center justify-center transition-all group select-none`}
                  >
                    <img src={stampUrl} alt="Stamp" className="w-full h-auto object-contain pointer-events-none" />
                    
                    {/* Badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 text-[8px] font-bold shadow-xs whitespace-nowrap pointer-events-none">
                      Stamp · {stampPosition.width}% · {stampPosition.opacity ?? 90}% {stampPosition.rotation ? `· ${stampPosition.rotation}°` : ''}
                    </div>

                    {/* Corner Resize Handle */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveOverlay('stamp');
                        setResizingTarget('stamp');
                        resizeStartRef.current = { startX: e.clientX, startWidth: stampPosition.width };
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setActiveOverlay('stamp');
                        setResizingTarget('stamp');
                        const touch = e.touches[0];
                        if (touch) {
                          resizeStartRef.current = { startX: touch.clientX, startWidth: stampPosition.width };
                        }
                      }}
                      className="absolute -bottom-2.5 -right-2.5 w-6 h-6 rounded-full bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                      title="Drag to resize stamp"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </div>
                  </div>
                )}

                {/* Movable & Resizable Signature (When custom positioned or in placement tab) */}
                {showSignature && signatureUrl && (hasCustomPlacement || activeView === 'placement') && (
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setActiveOverlay('sig');
                      setDraggingTarget('sig');
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setActiveOverlay('sig');
                      setDraggingTarget('sig');
                    }}
                    style={{
                      position: 'absolute',
                      left: `${sigPosition.x}%`,
                      top: `${sigPosition.y}%`,
                      width: `${sigPosition.width}%`,
                      transform: `translate(-50%, -50%) rotate(${sigPosition.rotation || 0}deg)`,
                      transformOrigin: 'center center',
                    }}
                    className={`cursor-move p-1.5 border-2 ${
                      activeOverlay === 'sig'
                        ? 'border-slate-900 dark:border-emerald-500 bg-emerald-50/10 shadow-lg ring-2 ring-emerald-500/20'
                        : 'border-dashed border-slate-400/80 dark:border-emerald-400/60 bg-transparent'
                    } rounded-xl flex items-center justify-center transition-all group select-none`}
                  >
                    <img src={signatureUrl} alt="Signature" className="w-full h-auto object-contain pointer-events-none" />
                    
                    {/* Badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 text-[8px] font-bold shadow-xs whitespace-nowrap pointer-events-none">
                      Sig · {sigPosition.width}% {sigPosition.rotation ? `· ${sigPosition.rotation}°` : ''}
                    </div>

                    {/* Corner Resize Handle */}
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveOverlay('sig');
                        setResizingTarget('sig');
                        resizeStartRef.current = { startX: e.clientX, startWidth: sigPosition.width };
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setActiveOverlay('sig');
                        setResizingTarget('sig');
                        const touch = e.touches[0];
                        if (touch) {
                          resizeStartRef.current = { startX: touch.clientX, startWidth: sigPosition.width };
                        }
                      }}
                      className="absolute -bottom-2.5 -right-2.5 w-6 h-6 rounded-full bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                      title="Drag to resize signature"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Flat Bottom Actions Strip */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('draft', false)}
              className="h-10 sm:h-9 px-3.5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Save Draft
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSave('sent', true)}
              className="h-10 sm:h-9 px-4 sm:px-5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Save & PDF</span>
            </button>
          </div>
        </div>

        {/* Embedded Signature Pad and Stamp Processor Modals */}
        <SignaturePadModal
          isOpen={isSignatureModalOpen}
          onClose={() => setIsSignatureModalOpen(false)}
          onSaved={(url) => {
            setSignatureUrl(url);
            setShowSignature(true);
          }}
        />

        <StampProcessorModal
          isOpen={isStampModalOpen}
          onClose={() => setIsStampModalOpen(false)}
          onSaved={(url) => {
            setStampUrl(url);
            setShowStamp(true);
          }}
        />

      </div>
    </div>,
    document.body
  );
};
