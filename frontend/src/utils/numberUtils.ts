/**
 * Format raw number or string input with comma separators as the user types.
 * Example: '80000' -> '80,000', '1250000.5' -> '1,250,000.5'
 */
export function formatCurrencyInput(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).replace(/,/g, '');
  let cleaned = str.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';

  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1) {
    const beforeDot = cleaned.substring(0, dotIndex);
    const afterDot = cleaned.substring(dotIndex + 1).replace(/\./g, '');
    const formattedBefore = beforeDot ? beforeDot.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '0';
    return `${formattedBefore}.${afterDot}`;
  }

  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Parse a comma-formatted numeric string into a float number.
 * Example: '80,000' -> 80000, '1,250.50' -> 1250.5
 */
export function parseFormattedNumber(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = String(val).replace(/,/g, '').trim();
  if (!cleaned || isNaN(Number(cleaned))) return null;
  return parseFloat(cleaned);
}

/**
 * Format numbers into clean compact strings with K or M or B suffix.
 * Prevents text truncation on compact mobile cards (e.g. 3,958,500 -> 3.96M, 536,460 -> 536K).
 */
export function formatCompactKMB(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    const num = abs / 1_000_000_000;
    return `${sign}${num >= 10 ? num.toFixed(1) : num.toFixed(2).replace(/\.?0+$/, '')}B`;
  }
  if (abs >= 1_000_000) {
    const num = abs / 1_000_000;
    return `${sign}${num >= 10 ? num.toFixed(1) : num.toFixed(2).replace(/\.?0+$/, '')}M`;
  }
  if (abs >= 10_000) {
    const num = abs / 1_000;
    return `${sign}${num >= 100 ? Math.round(num) : num.toFixed(1).replace(/\.?0+$/, '')}K`;
  }
  return `${sign}${abs.toLocaleString('en-US')}`;
}
