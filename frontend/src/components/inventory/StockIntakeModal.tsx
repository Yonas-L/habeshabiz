import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ProductCategory, Product, Contact, ProductVariant } from '../../api/client';
import { api } from '../../api/client';
import { toast } from 'sonner';
import { formatCurrencyInput, parseFormattedNumber } from '../../utils/numberUtils';
import {
  X,
  Plus,
  Package,
  Barcode,
  BatteryCharging,
  Loader2,
  ChevronDown,
  Handshake,
  Building2,
  Check,
  Clock,
} from 'lucide-react';
import { PartnerFormModal } from '../partners/PartnerFormModal';

interface StockIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ProductCategory[];
  products: Product[];
  contacts: Contact[];
  onIntakeSuccess: () => void;
  onOpenCategoryManager?: () => void;
  initialProductId?: string;
  initialVariantId?: string;
}

type CategoryArchetype =
  | 'phone_tablet'
  | 'laptop_computer'
  | 'smartwatch'
  | 'screen_protector'
  | 'case_cover'
  | 'charger_cable'
  | 'audio'
  | 'gaming'
  | 'general';

function getCategoryArchetype(catSlug?: string, catName?: string): CategoryArchetype {
  const s = `${catSlug || ''} ${catName || ''}`.toLowerCase();
  if (s.includes('protector') || s.includes('glass') || s.includes('tempered') || s.includes('film')) {
    return 'screen_protector';
  }
  if (s.includes('case') || s.includes('cover') || s.includes('pouch') || s.includes('skin')) {
    return 'case_cover';
  }
  if (s.includes('charger') || s.includes('cable') || s.includes('power') || s.includes('adapter')) {
    return 'charger_cable';
  }
  if (s.includes('watch') || s.includes('wearable')) {
    return 'smartwatch';
  }
  if (s.includes('laptop') || s.includes('macbook') || s.includes('computer') || s.includes('pc') || s.includes('desktop')) {
    return 'laptop_computer';
  }
  if (s.includes('audio') || s.includes('headphone') || s.includes('earphone') || s.includes('airpod') || s.includes('speaker')) {
    return 'audio';
  }
  if (s.includes('game') || s.includes('gaming') || s.includes('console') || s.includes('playstation') || s.includes('xbox')) {
    return 'gaming';
  }
  if (s.includes('phone') || s.includes('tablet') || s.includes('ipad') || s.includes('smartphone')) {
    return 'phone_tablet';
  }
  return 'general';
}

export const StockIntakeModal: React.FC<StockIntakeModalProps> = ({
  isOpen,
  onClose,
  categories,
  products,
  contacts,
  onIntakeSuccess,
  onOpenCategoryManager,
  initialProductId,
  initialVariantId,
}) => {
  // Category & Product Selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const variantListRef = useRef<HTMLDivElement>(null);

  // Local products state to dynamically update when new models/variants are created
  const [localProducts, setLocalProducts] = useState<Product[]>(products);

  // Quick Inline Product Creation
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductBrand, setNewProductBrand] = useState('');

  // Structured Variant Fields for Product / Variant Creation
  const [variantStorage, setVariantStorage] = useState('');
  const [variantRam, setVariantRam] = useState('');
  const [variantColor, setVariantColor] = useState('');
  const [variantProcessor, setVariantProcessor] = useState('');
  const [variantCompatibility, setVariantCompatibility] = useState('');
  const [variantGlassType, setVariantGlassType] = useState('');
  const [variantWattage, setVariantWattage] = useState('');
  const [variantCaseSize, setVariantCaseSize] = useState('');
  const [variantMaterial, setVariantMaterial] = useState('');
  const [variantGeneralSpec, setVariantGeneralSpec] = useState('');

  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [isSubmittingVariant, setIsSubmittingVariant] = useState(false);

  // Intake Parameters
  const [bulkMode, setBulkMode] = useState(false);
  const [singleImei, setSingleImei] = useState('');
  const [bulkImeisText, setBulkImeisText] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('new');
  const [batteryHealth, setBatteryHealth] = useState('100');
  const [cycleCount, setCycleCount] = useState('0');
  const [simType, setSimType] = useState<'physical' | 'esim' | 'dual' | 'na'>('physical');
  const [costBasis, setCostBasis] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [liveContacts, setLiveContacts] = useState<Contact[]>(contacts);
  const [sourceType, setSourceType] = useState<'purchase' | 'consignment'>('purchase');
  const [returnDeadlineDays, setReturnDeadlineDays] = useState<number | 'custom' | 'none'>('none');
  const [customReturnDate, setCustomReturnDate] = useState('');
  const [location, setLocation] = useState('Shop Counter');
  const [notes, setNotes] = useState('');
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

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

  // Initialize selected category or preselected product
  useEffect(() => {
    if (isOpen && initialProductId) {
      const prod = localProducts.find((p) => p.id === initialProductId);
      if (prod) {
        setSelectedProductId(prod.id);
        if (prod.category_id) {
          setSelectedCategoryId(prod.category_id);
        } else {
          const matchCat = categories.find((c) => c.slug === prod.category);
          if (matchCat) setSelectedCategoryId(matchCat.id);
        }
        if (initialVariantId && prod.variants.some((v) => v.id === initialVariantId)) {
          setSelectedVariantId(initialVariantId);
          const v = prod.variants.find((v) => v.id === initialVariantId);
          if (v?.default_selling_price && !sellingPrice) {
            setSellingPrice(String(v.default_selling_price));
          }
        } else if (prod.variants && prod.variants.length > 0) {
          setSelectedVariantId(prod.variants[0].id);
          if (prod.variants[0].default_selling_price && !sellingPrice) {
            setSellingPrice(String(prod.variants[0].default_selling_price));
          }
        }
      }
    } else if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [isOpen, initialProductId, initialVariantId, localProducts, categories, selectedCategoryId]);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId) || categories[0];
  }, [categories, selectedCategoryId]);

  const activeArchetype = useMemo(() => {
    return getCategoryArchetype(activeCategory?.slug, activeCategory?.name);
  }, [activeCategory]);

  const hasSerials = activeCategory ? activeCategory.has_serials : true;

  // Filter products by selected category
  const filteredProducts = useMemo(() => {
    if (!selectedCategoryId) return localProducts;
    const cat = categories.find((c) => c.id === selectedCategoryId);
    const catSlug = (cat?.slug || '').toLowerCase();
    const catName = (cat?.name || '').toLowerCase();

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

  // Extract existing variants' attributes for selected product
  const productExistingStorages = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    return Array.from(new Set(selectedProduct.variants.map((v) => v.storage).filter(Boolean))) as string[];
  }, [selectedProduct]);

  const productExistingRams = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    return Array.from(new Set(selectedProduct.variants.map((v) => v.ram).filter(Boolean))) as string[];
  }, [selectedProduct]);

  const productExistingColors = useMemo(() => {
    if (!selectedProduct?.variants) return [];
    return Array.from(new Set(selectedProduct.variants.map((v) => v.color).filter(Boolean))) as string[];
  }, [selectedProduct]);

  // Quick-pick options for Phone & Tablet
  const quickStorageOptions = useMemo(() => {
    const defaults = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
    const merged = [...defaults];
    productExistingStorages.forEach((s) => {
      if (!merged.some((m) => m.toLowerCase() === s.toLowerCase())) merged.push(s);
    });
    return merged;
  }, [productExistingStorages]);

  const quickRamOptions = useMemo(() => {
    const defaults = ['4GB', '6GB', '8GB', '12GB', '16GB', '24GB', '32GB'];
    const merged = [...defaults];
    productExistingRams.forEach((r) => {
      if (!merged.some((m) => m.toLowerCase() === r.toLowerCase())) merged.push(r);
    });
    return merged;
  }, [productExistingRams]);

  const quickColorOptions = useMemo(() => {
    const defaults = [
      'Natural Titanium',
      'Black Titanium',
      'White Titanium',
      'Desert Titanium',
      'Blue Titanium',
      'Space Black',
      'Silver',
      'Gold',
      'Midnight',
      'Starlight',
      'Graphite',
      'Deep Purple',
      'Black',
      'White',
      'Gray',
      'Blue',
    ];
    const list: string[] = [];
    productExistingColors.forEach((c) => {
      if (!list.some((l) => l.toLowerCase() === c.toLowerCase())) list.push(c);
    });
    defaults.forEach((c) => {
      if (!list.some((l) => l.toLowerCase() === c.toLowerCase())) list.push(c);
    });
    return list;
  }, [productExistingColors]);

  // Quick-pick options for Laptop
  const quickLaptopStorageOptions = useMemo(() => {
    const defaults = ['256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD', '4TB SSD'];
    const merged = [...defaults];
    productExistingStorages.forEach((s) => {
      if (!merged.some((m) => m.toLowerCase() === s.toLowerCase())) merged.push(s);
    });
    return merged;
  }, [productExistingStorages]);

  const quickLaptopRamOptions = useMemo(() => {
    const defaults = ['8GB', '16GB', '24GB', '32GB', '36GB', '48GB', '64GB', '128GB'];
    const merged = [...defaults];
    productExistingRams.forEach((r) => {
      if (!merged.some((m) => m.toLowerCase() === r.toLowerCase())) merged.push(r);
    });
    return merged;
  }, [productExistingRams]);

  const quickProcessorOptions = useMemo(() => {
    return [
      'M1',
      'M2',
      'M3',
      'M3 Pro',
      'M3 Max',
      'M4',
      'M4 Pro',
      'M4 Max',
      'Intel Core i5',
      'Intel Core i7',
      'Intel Core i9',
      'AMD Ryzen 7',
      'AMD Ryzen 9',
    ];
  }, []);

  // When product changes, auto-select first variant
  useEffect(() => {
    if (selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0) {
      if (!selectedProduct.variants.some((v) => v.id === selectedVariantId)) {
        const firstVariant = selectedProduct.variants[0];
        setSelectedVariantId(firstVariant.id);
        if (firstVariant.default_selling_price && !sellingPrice) {
          setSellingPrice(formatCurrencyInput(firstVariant.default_selling_price));
        }
      }
    }
  }, [selectedProduct]);

  // When variant changes, auto-fill default selling price if empty
  const handleVariantChange = (variantId: string) => {
    setSelectedVariantId(variantId);
    const v = selectedProduct?.variants.find((item) => item.id === variantId);
    if (v?.default_selling_price && !sellingPrice) {
      setSellingPrice(formatCurrencyInput(v.default_selling_price));
    }
  };

  // Smoothly scroll selected variant into view inside the fixed-height list
  useEffect(() => {
    if (selectedVariantId && variantListRef.current) {
      const el = variantListRef.current.querySelector<HTMLElement>(`[data-variant-id="${selectedVariantId}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedVariantId]);

  const resetVariantInputs = () => {
    setVariantStorage('');
    setVariantRam('');
    setVariantColor('');
    setVariantProcessor('');
    setVariantCompatibility('');
    setVariantGlassType('');
    setVariantWattage('');
    setVariantCaseSize('');
    setVariantMaterial('');
    setVariantGeneralSpec('');
  };

  // Build variant payload based on category archetype
  const buildVariantData = () => {
    const specs: Record<string, any> = {};

    let storage: string | undefined = undefined;
    let ram: string | undefined = undefined;
    let color: string | undefined = undefined;

    switch (activeArchetype) {
      case 'phone_tablet':
        storage = variantStorage.trim() || undefined;
        ram = variantRam.trim() || undefined;
        color = variantColor.trim() || undefined;
        break;

      case 'laptop_computer':
        storage = variantStorage.trim() || undefined;
        ram = variantRam.trim() || undefined;
        color = variantColor.trim() || undefined;
        if (variantProcessor.trim()) specs.processor = variantProcessor.trim();
        break;

      case 'smartwatch':
        if (variantCaseSize.trim()) specs.case_size = variantCaseSize.trim();
        color = variantColor.trim() || undefined;
        if (variantRam.trim()) specs.connectivity = variantRam.trim();
        break;

      case 'screen_protector':
        if (variantCompatibility.trim()) specs.compatibility = variantCompatibility.trim();
        if (variantGlassType.trim()) specs.glass_type = variantGlassType.trim();
        break;

      case 'case_cover':
        if (variantCompatibility.trim()) specs.compatibility = variantCompatibility.trim();
        if (variantMaterial.trim()) specs.material = variantMaterial.trim();
        color = variantColor.trim() || undefined;
        break;

      case 'charger_cable':
        if (variantWattage.trim()) specs.wattage = variantWattage.trim();
        if (variantGeneralSpec.trim()) specs.port_type = variantGeneralSpec.trim();
        color = variantColor.trim() || undefined;
        break;

      case 'audio':
      case 'gaming':
      case 'general':
      default:
        storage = variantStorage.trim() || undefined;
        color = variantColor.trim() || undefined;
        if (variantGeneralSpec.trim()) specs.edition = variantGeneralSpec.trim();
        break;
    }

    return {
      storage,
      ram,
      color,
      specs: Object.keys(specs).length > 0 ? specs : undefined,
    };
  };

  // Handle Quick Product Creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      toast.error('Product model name is required');
      return;
    }

    try {
      setIsSubmittingProduct(true);
      const variantData = buildVariantData();

      const res = await api.createProduct({
        name: newProductName.trim(),
        brand: newProductBrand.trim() || undefined,
        category: activeCategory?.slug || 'other',
        category_id: activeCategory?.id,
        has_serials: activeCategory?.has_serials ?? true,
        variants: [variantData],
      });

      toast.success(`Model "${res.name}" created`);
      setIsCreatingProduct(false);
      setNewProductName('');
      setNewProductBrand('');
      resetVariantInputs();

      setLocalProducts((prev) => [res, ...prev.filter((p) => p.id !== res.id)]);
      setSelectedProductId(res.id);
      if (res.variants?.[0]?.id) {
        setSelectedVariantId(res.variants[0].id);
      }
      onIntakeSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product model');
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  // Handle Dynamic Variant Addition to Existing Product
  const handleCreateVariant = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProductId) {
      toast.error('Please select a product model first');
      return;
    }

    try {
      setIsSubmittingVariant(true);
      const variantData = buildVariantData();

      const createdVariant: ProductVariant = await api.addVariant(selectedProductId, variantData);

      toast.success('Variant added to model');

      setLocalProducts((prev) =>
        prev.map((p) => {
          if (p.id === selectedProductId) {
            return {
              ...p,
              variants: [...(p.variants || []), createdVariant],
            };
          }
          return p;
        })
      );

      setSelectedVariantId(createdVariant.id);
      if (createdVariant.default_selling_price && !sellingPrice) {
        setSellingPrice(formatCurrencyInput(createdVariant.default_selling_price));
      }
      setIsCreatingVariant(false);
      resetVariantInputs();
      onIntakeSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add variant');
    } finally {
      setIsSubmittingVariant(false);
    }
  };

  // Parse bulk IMEIs
  const parsedImeis = useMemo(() => {
    if (!bulkImeisText.trim()) return [];
    return bulkImeisText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [bulkImeisText]);

  const duplicateImeisInBulk = useMemo(() => {
    if (!bulkMode || parsedImeis.length === 0) return [];
    const counts = new Map<string, number>();
    for (const item of parsedImeis) {
      const lower = item.toLowerCase();
      counts.set(lower, (counts.get(lower) || 0) + 1);
    }
    const dupes: string[] = [];
    counts.forEach((count, key) => {
      if (count > 1) dupes.push(key);
    });
    return dupes;
  }, [bulkMode, parsedImeis]);

  // Total units and cost calculations
  const totalUnitsToReceive = useMemo(() => {
    if (hasSerials) {
      return bulkMode ? parsedImeis.length : singleImei.trim() ? 1 : 0;
    }
    const q = parseInt(quantity, 10);
    return isNaN(q) || q <= 0 ? 0 : q;
  }, [hasSerials, bulkMode, parsedImeis.length, singleImei, quantity]);

  const totalInvestmentCost = useMemo(() => {
    const cost = parseFormattedNumber(costBasis);
    if (!cost || cost <= 0) return 0;
    return totalUnitsToReceive * cost;
  }, [costBasis, totalUnitsToReceive]);

  const isPhone = useMemo(() => {
    const catSlug = activeCategory?.slug || '';
    const prodName = (selectedProduct?.name || '').toLowerCase();
    return (
      catSlug.includes('phone') ||
      catSlug.includes('smartphone') ||
      prodName.includes('iphone') ||
      prodName.includes('galaxy') ||
      prodName.includes('pixel')
    );
  }, [activeCategory, selectedProduct]);

  // Submit Stock Intake
  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedVariantId) {
      toast.error('Please select a product specification');
      return;
    }

    const costNum = parseFormattedNumber(costBasis);
    if (costNum === null || costNum < 0) {
      toast.error('Please enter a valid cost per unit');
      return;
    }

    if (hasSerials) {
      if (bulkMode && parsedImeis.length === 0) {
        toast.error('Please enter at least one Serial or IMEI');
        return;
      }
      if (bulkMode && duplicateImeisInBulk.length > 0) {
        toast.error(
          `Duplicate IMEIs detected (${duplicateImeisInBulk.slice(0, 3).join(', ')}). Each unit must be unique.`
        );
        return;
      }
      if (!bulkMode && !singleImei.trim()) {
        toast.error('Please enter the device Serial or IMEI');
        return;
      }
    } else {
      const q = parseInt(quantity, 10);
      if (isNaN(q) || q <= 0) {
        toast.error('Please enter a valid quantity');
        return;
      }
    }

    if (sourceType === 'consignment' && !supplierId) {
      toast.error('Please select the broker/vendor partner');
      return;
    }

    try {
      setIsSubmittingIntake(true);

      let calculatedReturnDeadline: string | null = null;
      if (sourceType === 'consignment' && returnDeadlineDays !== 'none') {
        if (returnDeadlineDays === 'custom' && customReturnDate) {
          calculatedReturnDeadline = customReturnDate;
        } else if (typeof returnDeadlineDays === 'number') {
          const d = new Date();
          d.setDate(d.getDate() + returnDeadlineDays);
          calculatedReturnDeadline = d.toISOString().split('T')[0];
        }
      }

      const payload: any = {
        variant_id: selectedVariantId,
        cost_basis: costNum,
        condition,
        location: location || 'Shop Counter',
        notes: notes.trim() || null,
        source_type: sourceType,
        supplier_contact_id: supplierId || null,
        return_deadline: calculatedReturnDeadline,
        selling_price: parseFormattedNumber(sellingPrice) ?? undefined,
      };

      if (hasSerials) {
        if (bulkMode) {
          payload.imeis = parsedImeis;
        } else {
          payload.imei_or_serial = singleImei.trim();
        }
        if (isPhone) {
          payload.battery_health = batteryHealth ? parseInt(batteryHealth, 10) : null;
          payload.cycle_count = cycleCount ? parseInt(cycleCount, 10) : null;
          payload.sim_type = simType;
        }
      } else {
        payload.quantity = parseInt(quantity, 10) || 1;
      }

      await api.intakeInventoryUnit(payload);

      toast.success('Stock added successfully', {
        description: `${totalUnitsToReceive} unit(s) received into inventory.`,
      });

      // Reset fields
      setSingleImei('');
      setBulkImeisText('');
      setQuantity('1');
      setCostBasis('');
      setSellingPrice('');
      setNotes('');
      onIntakeSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record stock intake');
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  // Render context-aware variant input fields
  const renderCategoryVariantInputs = () => {
    switch (activeArchetype) {
      case 'screen_protector':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Compatible Phone Model *
              </label>
              <input
                type="text"
                placeholder="e.g. iPhone 16 Pro Max, S24 Ultra"
                value={variantCompatibility}
                onChange={(e) => setVariantCompatibility(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Glass / Finish Type
              </label>
              <input
                type="text"
                placeholder="e.g. Privacy Glass, Clear HD, Matte"
                value={variantGlassType}
                onChange={(e) => setVariantGlassType(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>
        );

      case 'case_cover':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Phone Model *
              </label>
              <input
                type="text"
                placeholder="e.g. iPhone 16 Pro, S24"
                value={variantCompatibility}
                onChange={(e) => setVariantCompatibility(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Material / Style
              </label>
              <input
                type="text"
                placeholder="e.g. MagSafe Clear, Silicone, Leather"
                value={variantMaterial}
                onChange={(e) => setVariantMaterial(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Color
              </label>
              <input
                type="text"
                placeholder="e.g. Midnight, Deep Purple, Clear"
                value={variantColor}
                onChange={(e) => setVariantColor(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>
        );

      case 'charger_cable':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Power / Wattage
              </label>
              <input
                type="text"
                placeholder="e.g. 20W, 65W GaN, 20000mAh"
                value={variantWattage}
                onChange={(e) => setVariantWattage(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Connector / Length
              </label>
              <input
                type="text"
                placeholder="e.g. USB-C to C (1m), 3-in-1"
                value={variantGeneralSpec}
                onChange={(e) => setVariantGeneralSpec(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Color
              </label>
              <input
                type="text"
                placeholder="e.g. White, Braided Black"
                value={variantColor}
                onChange={(e) => setVariantColor(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>
        );

      case 'smartwatch':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Case Size
              </label>
              <input
                type="text"
                placeholder="e.g. 41mm, 45mm, 49mm"
                value={variantCaseSize}
                onChange={(e) => setVariantCaseSize(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Connectivity
              </label>
              <input
                type="text"
                placeholder="e.g. GPS, GPS + Cellular"
                value={variantRam}
                onChange={(e) => setVariantRam(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Band & Color
              </label>
              <input
                type="text"
                placeholder="e.g. Midnight, Starlight"
                value={variantColor}
                onChange={(e) => setVariantColor(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
              />
            </div>
          </div>
        );

      case 'laptop_computer':
        return (
          <div className="space-y-3.5">
            {/* SSD Storage Radio Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  SSD Storage <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400">Select or enter new</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {quickLaptopStorageOptions.map((opt) => {
                  const isSelected = variantStorage.trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVariantStorage(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Or custom capacity (e.g. 2TB SSD, 8TB)..."
                value={variantStorage}
                onChange={(e) => setVariantStorage(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>

            {/* RAM Radio Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Unified RAM / Memory
                </label>
                <span className="text-[10px] text-slate-400">Select or enter new</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {quickLaptopRamOptions.map((opt) => {
                  const isSelected = variantRam.trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVariantRam(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Or custom RAM (e.g. 18GB, 96GB)..."
                value={variantRam}
                onChange={(e) => setVariantRam(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>

            {/* Processor / Chip Radio Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Processor / Chip
                </label>
                <span className="text-[10px] text-slate-400">Select or enter new</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {quickProcessorOptions.map((opt) => {
                  const isSelected = variantProcessor.trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVariantProcessor(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Or custom processor (e.g. Ultra 9 185H)..."
                value={variantProcessor}
                onChange={(e) => setVariantProcessor(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>

            {/* Color Radio Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Color / Finish
                </label>
                <span className="text-[10px] text-slate-400">Select or enter new</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {['Space Black', 'Silver', 'Space Gray', 'Midnight', 'Starlight'].map((opt) => {
                  const isSelected = variantColor.trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVariantColor(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Or custom color..."
                value={variantColor}
                onChange={(e) => setVariantColor(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>
          </div>
        );

      case 'phone_tablet':
      default:
        return (
          <div className="space-y-3.5">
            {/* Storage Radio Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Storage / Capacity <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400">Click to select or enter new</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {quickStorageOptions.map((opt) => {
                  const isSelected = variantStorage.trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVariantStorage(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Or custom capacity (e.g. 2TB, 4TB)..."
                value={variantStorage}
                onChange={(e) => setVariantStorage(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>

            {/* RAM Radio Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  RAM / Memory (Optional)
                </label>
                <span className="text-[10px] text-slate-400">Click to select</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                <button
                  type="button"
                  onClick={() => setVariantRam('')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    !variantRam
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  Standard / N/A
                </button>
                {quickRamOptions.map((opt) => {
                  const isSelected = variantRam.trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVariantRam(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Or custom RAM (e.g. 18GB)..."
                value={variantRam}
                onChange={(e) => setVariantRam(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>

            {/* Color Radio Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Color / Finish
                </label>
                <span className="text-[10px] text-slate-400">Click to select existing or enter new</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {quickColorOptions.slice(0, 12).map((opt) => {
                  const isSelected = variantColor.trim().toLowerCase() === opt.toLowerCase();
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVariantColor(opt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-2xs font-bold'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                placeholder="Or custom color (e.g. Desert Titanium, Cosmic Orange)..."
                value={variantColor}
                onChange={(e) => setVariantColor(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900/20"
              />
            </div>
          </div>
        );
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-8 pt-0 sm:pt-24 pb-0 sm:pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/50 dark:bg-black/70 backdrop-blur-xs animate-backdrop-enter"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet Surface */}
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#131926] rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-bottom-sheet sm:animate-modal-enter flex flex-col max-h-[88vh] sm:max-h-[calc(100vh-7rem)] my-0 sm:my-auto">
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                Add Stock
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">
                Receive devices or accessories into inventory
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="intake-form"
          onSubmit={handleSubmitIntake}
          className="flex-1 overflow-y-auto p-5 space-y-5"
        >
          {/* ── SECTION 1: PRODUCT & SPECIFICATION ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Product & Specification <span className="text-rose-500">*</span>
              </label>
              {!isCreatingProduct && !isCreatingVariant && (
                <button
                  type="button"
                  onClick={() => setIsCreatingProduct(true)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Model</span>
                </button>
              )}
            </div>

            {/* Quick Add Full Product Model Form */}
            {isCreatingProduct && (
              <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  New Product Model ({activeCategory?.name || 'Category'})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Model Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. iPhone 16 Pro Max, Diamond Glass 9H"
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
                      placeholder="e.g. Apple, Anker, Spigen"
                      value={newProductBrand}
                      onChange={(e) => setNewProductBrand(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    />
                  </div>
                </div>

                {/* Category-Specific Variant Fields for New Model */}
                <div className="pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                    Initial Variant Specification
                  </span>
                  {renderCategoryVariantInputs()}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProduct(false)}
                    className="h-9 px-3.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateProduct}
                    disabled={isSubmittingProduct || !newProductName.trim()}
                    className="h-9 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmittingProduct ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Save Model</span>
                  </button>
                </div>
              </div>
            )}

            {/* Standard Dropdowns */}
            {!isCreatingProduct && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Category
                    </label>
                    {onOpenCategoryManager && (
                      <button
                        type="button"
                        onClick={onOpenCategoryManager}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Manage
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => {
                        const newCatId = e.target.value;
                        setSelectedCategoryId(newCatId);
                        setSelectedProductId('');
                        setSelectedVariantId('');
                        setIsCreatingVariant(false);
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

                {/* Product Model */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Model
                  </label>
                  <div className="relative">
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setSelectedVariantId('');
                        setIsCreatingVariant(false);
                      }}
                      className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                    >
                      <option value="">
                        {filteredProducts.length === 0
                          ? '-- No models in this category yet --'
                          : `-- Choose Model (${filteredProducts.length} available) --`}
                      </option>
                      {filteredProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.brand ? `(${p.brand})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Variant Selector — Radio Tiles & Inline Builder */}
                {selectedProduct && (
                  <div className="sm:col-span-2 space-y-2.5 pt-1">
                    {!isCreatingVariant && (
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          Device Variant <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingVariant(true);
                            resetVariantInputs();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>New Variant</span>
                        </button>
                      </div>
                    )}

                    {/* Radio Cards for Existing Variants — hidden while adding a new one */}
                    {!isCreatingVariant && selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                      <div
                        ref={variantListRef}
                        className="max-h-[236px] overflow-y-auto pr-1.5 overscroll-contain"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-0.5">
                          {selectedProduct.variants.map((v) => {
                            const isSelected = selectedVariantId === v.id && !isCreatingVariant;
                            const specValues = v.specs ? Object.values(v.specs).map(String) : [];
                            const specLabel = [v.ram ? `${v.ram} RAM` : null, ...specValues].filter(Boolean).join(' • ');

                            return (
                              <button
                                type="button"
                                key={v.id}
                                data-variant-id={v.id}
                                onClick={() => {
                                  setIsCreatingVariant(false);
                                  handleVariantChange(v.id);
                                }}
                                className={`relative text-left flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-1 ring-emerald-600/30 dark:ring-emerald-500/30 shadow-xs'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <span
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500'
                                        : 'border-slate-300 dark:border-slate-600 bg-transparent'
                                    }`}
                                  >
                                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                      <span>{v.storage || 'Standard'}</span>
                                      {v.color && (
                                        <span className="text-[10px] font-normal text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 truncate">
                                          {v.color}
                                        </span>
                                      )}
                                    </div>
                                    {specLabel && (
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                        {specLabel}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {v.default_selling_price && (
                                  <div className="text-right shrink-0">
                                    <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 block">
                                      {Number(v.default_selling_price).toLocaleString()}
                                    </span>
                                    <span className="text-[8px] text-slate-400 uppercase">ETB</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}

                          {!isCreatingVariant && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsCreatingVariant(true);
                                resetVariantInputs();
                              }}
                              className="flex items-center gap-2.5 p-3 rounded-xl border border-dashed text-xs font-semibold transition-all cursor-pointer border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                            >
                              <span className="w-4 h-4 rounded-full border border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center shrink-0">
                                <Plus className="w-2.5 h-2.5" />
                              </span>
                              <span className="truncate">+ New Variant (e.g. 2TB)...</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : !isCreatingVariant ? (
                      <div className="p-3.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                        <span>No specifications defined yet for this model.</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingVariant(true);
                            resetVariantInputs();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                        >
                          Add Initial Variant
                        </button>
                      </div>
                    ) : null}

                    {/* Inline New Variant Builder */}
                    {isCreatingVariant && (
                      <div className="mt-2.5 p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm animate-fade-in">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800">
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              Add New Variant to {selectedProduct.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Click radio options below or type new custom specifications
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingVariant(false);
                              resetVariantInputs();
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                            title="Close"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Interactive Radio Builders for Storage, RAM, Color, etc. */}
                        {renderCategoryVariantInputs()}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingVariant(false);
                              resetVariantInputs();
                            }}
                            className="h-8 px-3.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCreateVariant()}
                            disabled={isSubmittingVariant}
                            className="h-8 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            {isSubmittingVariant ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Save & Select Variant</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION 2: SERIAL / QUANTITY & HARDWARE ── */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {hasSerials ? 'Serial / IMEI' : 'Batch Quantity'} <span className="text-rose-500">*</span>
              </label>

              {/* Single / Bulk Toggle */}
              {hasSerials && (
                <div className="p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg flex text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setBulkMode(false)}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      !bulkMode
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Single Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkMode(true)}
                    className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      bulkMode
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Bulk Paste
                  </button>
                </div>
              )}
            </div>

            {hasSerials ? (
              bulkMode ? (
                <div>
                  <textarea
                    rows={3}
                    required
                    value={bulkImeisText}
                    onChange={(e) => setBulkImeisText(e.target.value)}
                    placeholder="359871109911111&#10;359871109922222&#10;359871109933333"
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                  />
                  <div className="flex items-center justify-between text-[11px] font-mono mt-1">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {parsedImeis.length} device serials entered
                    </span>
                    {duplicateImeisInBulk.length > 0 && (
                      <span className="text-rose-500 font-semibold">
                        {duplicateImeisInBulk.length} duplicate IMEI(s) detected
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      {isPhone ? 'IMEI / Serial #' : 'Serial #'}
                    </label>
                    <div className="relative">
                      <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={singleImei}
                        onChange={(e) => setSingleImei(e.target.value)}
                        placeholder={isPhone ? '359871109988776' : 'S01-F329482'}
                        className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                      Condition
                    </label>
                    <select
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="new">Brand New (Sealed)</option>
                      <option value="used_clean">Used Clean (Grade A)</option>
                      <option value="used_minor_scratches">Used Minor Scratches</option>
                      <option value="refurbished">Refurbished</option>
                    </select>
                  </div>
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Quantity (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Condition
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="new">Brand New</option>
                    <option value="used_clean">Pre-owned Clean</option>
                  </select>
                </div>
              </div>
            )}

            {/* Phone Specific Battery & SIM */}
            {hasSerials && isPhone && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1">
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Battery %</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={batteryHealth}
                    onChange={(e) => setBatteryHealth(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Cycle Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={cycleCount}
                    onChange={(e) => setCycleCount(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    SIM Type
                  </label>
                  <select
                    value={simType}
                    onChange={(e) => setSimType(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer focus:outline-none"
                  >
                    <option value="physical">Physical SIM</option>
                    <option value="esim">eSIM Only</option>
                    <option value="dual">Dual SIM</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 3: OWNERSHIP & FINANCIALS ── */}
          <div className="space-y-3 pt-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ownership & Pricing <span className="text-rose-500">*</span>
            </label>

            {/* Ownership Toggle Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSourceType('purchase')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  sourceType === 'purchase'
                    ? 'border-slate-900 dark:border-slate-200 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                }`}
              >
                <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Shop Owned</div>
                  <div className="text-[10px] opacity-75 font-normal mt-0.5">
                    Purchased store inventory
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('consignment')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                  sourceType === 'consignment'
                    ? 'border-amber-500 bg-amber-500 text-white shadow-xs font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-amber-300'
                }`}
              >
                <Handshake className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Vendor Consignment</div>
                  <div className="text-[10px] opacity-75 font-normal mt-0.5">
                    Broker stock · Auto-debt on sale
                  </div>
                </div>
              </button>
            </div>

            {/* Consignment Return Deadline */}
            {sourceType === 'consignment' && (
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Return Window to Broker (Optional)</span>
                  </div>
                  <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
                    Optional return deadline
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5 text-[11px] font-semibold">
                  {[
                    { label: 'None', value: 'none' },
                    { label: '3 Days', value: 3 },
                    { label: '7 Days', value: 7 },
                    { label: '14 Days', value: 14 },
                    { label: 'Custom', value: 'custom' },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setReturnDeadlineDays(option.value as any)}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                        returnDeadlineDays === option.value
                          ? 'border-amber-600 bg-amber-600 text-white font-bold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {returnDeadlineDays === 'custom' && (
                  <input
                    type="date"
                    value={customReturnDate}
                    onChange={(e) => setCustomReturnDate(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-mono font-medium focus:outline-none"
                  />
                )}
              </div>
            )}

            {/* Financial Inputs (Cost Basis, Selling Price, Location) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  {sourceType === 'consignment' ? 'Agreed Payout (ETB)' : 'Cost Basis (ETB)'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="e.g. 85,000"
                  value={costBasis}
                  onChange={(e) => setCostBasis(formatCurrencyInput(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Selling Price (ETB)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 95,000"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(formatCurrencyInput(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Shop Location
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                >
                  <option value="Shop Counter">Shop Counter</option>
                  <option value="Display Showcase">Display Showcase</option>
                  <option value="Backroom Safe">Backroom Safe</option>
                </select>
              </div>
            </div>

            {/* Projected Margin Indicator */}
            {(() => {
              const cost = parseFormattedNumber(costBasis);
              const price = parseFormattedNumber(sellingPrice);
              if (cost !== null && price !== null && cost > 0 && price > 0) {
                const diff = price - cost;
                const marginPct = (diff / price) * 100;
                const isPositive = diff >= 0;
                return (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border ${
                    isPositive 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-900/40'
                      : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                      Projected Gross Margin per Unit
                    </span>
                    <span className="font-mono font-semibold">
                      {isPositive ? '+' : ''}{diff.toLocaleString()} ETB ({marginPct.toFixed(1)}%)
                    </span>
                  </div>
                );
              }
              return null;
            })()}

            {/* Supplier / Broker & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {sourceType === 'consignment' ? (
                      <span>Broker Partner <span className="text-rose-500">*</span></span>
                    ) : (
                      'Supplier / Source (Optional)'
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddSupplierOpen(true)}
                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Partner</span>
                  </button>
                </div>
                <select
                  value={supplierId}
                  required={sourceType === 'consignment'}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white focus:outline-none cursor-pointer ${
                    sourceType === 'consignment' && !supplierId
                      ? 'border-amber-400 dark:border-amber-600'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <option value="">
                    {sourceType === 'consignment' ? '-- Select Broker (Required) --' : '-- Direct / Walk-in --'}
                  </option>
                  {liveContacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional intake note..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131926] shrink-0 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-5">
          <div className="text-xs">
            <span className="text-slate-400">Total: </span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">
              {totalUnitsToReceive} unit(s)
            </span>
            {totalInvestmentCost > 0 && (
              <span className="ml-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                • {totalInvestmentCost.toLocaleString()} ETB
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
              form="intake-form"
              disabled={
                isSubmittingIntake ||
                !selectedVariantId ||
                !costBasis ||
                totalUnitsToReceive === 0 ||
                (bulkMode && duplicateImeisInBulk.length > 0)
              }
              className="h-10 px-5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
            >
              {isSubmittingIntake ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Add Stock</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Supplier Modal */}
      <PartnerFormModal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        defaultRole="supplier"
        onSuccess={(saved) => {
          setLiveContacts((prev) => [...prev.filter((c) => c.id !== saved.id), saved]);
          setSupplierId(saved.id);
          onIntakeSuccess();
        }}
      />
    </div>
  );

  return createPortal(modalContent, document.body);
};
