import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Check, Plus, X } from 'lucide-react';
import type { Product } from '../../api/client';
import {
  getCategoryArchetype,
  POPULAR_BRANDS_BY_ARCHETYPE,
  detectBrandFromModelName,
} from '../../utils/electronicsArchetypes';

export interface BrandSelectInputProps {
  value: string;
  onChange: (brand: string) => void;
  products?: Product[];
  categorySlug?: string;
  categoryName?: string;
  modelName?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  autoDetect?: boolean;
}

export const BrandSelectInput: React.FC<BrandSelectInputProps> = ({
  value,
  onChange,
  products = [],
  categorySlug,
  categoryName,
  modelName,
  label = 'Brand',
  placeholder = 'Select or enter brand...',
  required = false,
  disabled = false,
  className = '',
  autoDetect = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when external value changes
  useEffect(() => {
    setInputVal(value || '');
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const archetype = useMemo(() => {
    return getCategoryArchetype(categorySlug, categoryName, modelName);
  }, [categorySlug, categoryName, modelName]);

  // Detected brand from model name
  const detectedBrand = useMemo(() => {
    if (!modelName) return null;
    return detectBrandFromModelName(modelName);
  }, [modelName]);

  // Auto-apply detected brand if brand is currently empty and model changed
  useEffect(() => {
    if (autoDetect && detectedBrand && !value && !inputVal) {
      onChange(detectedBrand);
      setInputVal(detectedBrand);
    }
  }, [detectedBrand, autoDetect]);

  // 1. Existing brands from products matching the active category
  const categoryStoreBrands = useMemo(() => {
    if (!products || products.length === 0) return [];
    const brands = new Set<string>();
    products.forEach((p) => {
      const pCatSlug = (p.category || '').toLowerCase();
      const pCatName = (p.category_rel?.name || '').toLowerCase();
      const targetSlug = (categorySlug || '').toLowerCase();
      const targetName = (categoryName || '').toLowerCase();

      const isMatch =
        (targetSlug && pCatSlug === targetSlug) ||
        (targetName && (pCatName === targetName || pCatSlug === targetName));

      if (isMatch && p.brand && p.brand.trim()) {
        brands.add(p.brand.trim());
      }
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [products, categorySlug, categoryName]);

  // 2. Curated popular brands for this category archetype
  const curatedArchetypeBrands = useMemo(() => {
    return POPULAR_BRANDS_BY_ARCHETYPE[archetype] || POPULAR_BRANDS_BY_ARCHETYPE.general;
  }, [archetype]);

  // 3. Other store brands (from other categories)
  const otherStoreBrands = useMemo(() => {
    if (!products || products.length === 0) return [];
    const catBrandSet = new Set(categoryStoreBrands.map((b) => b.toLowerCase()));
    const brands = new Set<string>();
    products.forEach((p) => {
      if (p.brand && p.brand.trim() && !catBrandSet.has(p.brand.trim().toLowerCase())) {
        brands.add(p.brand.trim());
      }
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b));
  }, [products, categoryStoreBrands]);

  // Unified deduplicated list preserving priority
  const combinedBrands = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];

    const add = (b: string) => {
      const lower = b.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        list.push(b);
      }
    };

    categoryStoreBrands.forEach(add);
    curatedArchetypeBrands.forEach(add);
    otherStoreBrands.forEach(add);

    return list;
  }, [categoryStoreBrands, curatedArchetypeBrands, otherStoreBrands]);

  // Filtered by user input
  const filteredBrands = useMemo(() => {
    const q = inputVal.trim().toLowerCase();
    if (!q) return combinedBrands;
    return combinedBrands.filter((b) => b.toLowerCase().includes(q));
  }, [combinedBrands, inputVal]);

  const hasExactMatch = useMemo(() => {
    const q = inputVal.trim().toLowerCase();
    if (!q) return false;
    return combinedBrands.some((b) => b.toLowerCase() === q);
  }, [combinedBrands, inputVal]);

  const showCustomOption = inputVal.trim().length > 0 && !hasExactMatch;

  const handleSelectBrand = (brandName: string) => {
    onChange(brandName);
    setInputVal(brandName);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    onChange(val); // Immediately sets brand as current written text
    if (!isOpen) setIsOpen(true);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setInputVal('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredBrands.length > 0 && !showCustomOption) {
        handleSelectBrand(filteredBrands[0]);
      } else if (inputVal.trim()) {
        handleSelectBrand(inputVal.trim());
      }
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label with clean auto-detect suggestion */}
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {detectedBrand && (!value || value.toLowerCase() !== detectedBrand.toLowerCase()) && (
          <button
            type="button"
            onClick={() => handleSelectBrand(detectedBrand)}
            className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            title={`Auto-detected: ${detectedBrand}`}
          >
            Suggested: {detectedBrand}
          </button>
        )}
      </div>

      {/* Input Box */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-10 px-3 pr-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-slate-400/10 transition-colors"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {inputVal && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear brand"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Toggle brand dropdown"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] shadow-xl py-1 text-xs">
          {/* Custom typed option if not matching an existing brand */}
          {showCustomOption && (
            <div className="p-1.5 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/30">
              <button
                type="button"
                onClick={() => handleSelectBrand(inputVal.trim())}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    Set brand as <strong>"{inputVal.trim()}"</strong>
                  </span>
                </span>
                <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 font-bold shrink-0 ml-2">
                  Custom
                </span>
              </button>
            </div>
          )}

          {/* Quick Clear option if value is set */}
          {value && (
            <div className="px-2 py-1 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Active Brand: <strong className="text-slate-700 dark:text-slate-200">{value}</strong></span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[10px] text-rose-500 hover:underline font-semibold cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          )}

          {/* Brand List */}
          {filteredBrands.length > 0 ? (
            <div className="py-1">
              {filteredBrands.map((b) => {
                const isSelected = value.toLowerCase() === b.toLowerCase();
                const isCatBrand = categoryStoreBrands.some((cb) => cb.toLowerCase() === b.toLowerCase());
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleSelectBrand(b)}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{b}</span>
                      {isCatBrand && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          In Catalog
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            !showCustomOption && (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">
                No matching brands found
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
