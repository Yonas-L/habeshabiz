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
