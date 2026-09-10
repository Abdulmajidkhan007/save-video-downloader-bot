export function formatAmount(amount: number, currency = 'UZS'): string {
  if (currency === 'UZS') {
    if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)} mlrd so'm`;
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} mln so'm`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k so'm`;
    return `${amount.toLocaleString()} so'm`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'time' = 'short'): string {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions =
    format === 'time'
      ? { hour: '2-digit', minute: '2-digit' }
      : format === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' };
  return d.toLocaleDateString('uz-UZ', options);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function getMonthName(month: number, year: number): string {
  return new Date(year, month - 1).toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
}
