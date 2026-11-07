import type { ProductCategory } from '../api/client';

export const RECENT_CATEGORY_STORAGE_KEY = 'habesha_recent_category_id';

/**
 * Checks if a category is a smartphone category based on slug and name.
 */
export function isSmartphoneCategory(cat: ProductCategory): boolean {
  if (!cat) return false;
  const slug = (cat.slug || '').toLowerCase().trim();
  const name = (cat.name || '').toLowerCase().trim();

  // 1. Direct slug matches
  if (['smartphones', 'smartphone', 'phones', 'phone', 'mobile'].includes(slug)) {
    return true;
  }

  // 2. Exact name matches
  if (['smartphones', 'smartphone', 'phones', 'phone', 'mobile', 'mobile phones'].includes(name)) {
    return true;
  }

  // 3. Name contains smartphone or smart phone
  if (name.includes('smartphone') || name.includes('smart phone')) {
    return true;
  }

  // 4. Word boundary match for phone/mobile (excluding audio, earphones, headphones, speakers)
  if (/\b(smartphones?|phones?|mobiles?)\b/i.test(name) && !/\b(headphone|earphone|speaker|audio)\b/i.test(name)) {
    return true;
  }

  return false;
}

/**
 * Returns the best initial category to select when opening intake or sales modals:
 * 1. Most recently used category from localStorage (if still present in categories).
 * 2. Smartphones category if present.
 * 3. Fallback to categories[0].
 */
export function getInitialCategoryId(
  categories: ProductCategory[],
  storageKey: string = RECENT_CATEGORY_STORAGE_KEY
): string {
  if (!categories || categories.length === 0) return '';

  // 1. Check most recent category from localStorage
  try {
    const recentId = localStorage.getItem(storageKey);
    if (recentId && categories.some((c) => c.id === recentId)) {
      return recentId;
    }
  } catch {
    // Ignore storage access errors
  }

  // 2. Default to Smartphone category
  const smartphoneCat = categories.find(isSmartphoneCategory);
  if (smartphoneCat) {
    return smartphoneCat.id;
  }

  // 3. Fallback to first available category
  return categories[0].id;
}

/**
 * Saves the user's selected category to localStorage for subsequent modal opens.
 */
export function setRecentCategoryId(
  categoryId: string,
  storageKey: string = RECENT_CATEGORY_STORAGE_KEY
): void {
  try {
    if (categoryId) {
      localStorage.setItem(storageKey, categoryId);
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Returns categories sorted with the preferred/recent/smartphone category at the top,
 * followed by the remaining categories.
 */
export function sortCategoriesWithPreferredFirst(
  categories: ProductCategory[],
  preferredCategoryId?: string
): ProductCategory[] {
  if (!categories || categories.length <= 1) return categories || [];
  const targetId = preferredCategoryId || getInitialCategoryId(categories);
  const preferred = categories.find((c) => c.id === targetId);
  if (!preferred) return categories;
  const others = categories.filter((c) => c.id !== targetId);
  return [preferred, ...others];
}
