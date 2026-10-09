/**
 * Format the age or duration elapsed from a purchase/intake date to today.
 * Examples: '0d', '4d', '2m', '1yr'
 */
export function formatPurchaseAge(dateString?: string | null): string {
  if (!dateString) return '—';
  const purchase = new Date(dateString);
  if (isNaN(purchase.getTime())) return '—';

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - purchase.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays}d`;
  }
  if (diffDays < 365) {
    const months = Math.max(1, Math.floor(diffDays / 30.4375));
    return `${months}m`;
  }
  const years = Math.max(1, Math.floor(diffDays / 365.25));
  return `${years}yr`;
}

/**
 * Format a Date object as local 'YYYY-MM-DD' without UTC timezone offset skew.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

