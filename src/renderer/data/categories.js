// Default expense categories (Monefy-like). `id` is what gets stored in each
// expense row / spreadsheet cell, so never rename an id — only labels.
export const CATEGORIES = [
  { id: 'food',          label: 'Food',          icon: '🛒', color: '#4caf50' },
  { id: 'eating_out',    label: 'Eating out',    icon: '🍽️', color: '#ff7043' },
  { id: 'transport',     label: 'Transport',     icon: '🚌', color: '#42a5f5' },
  { id: 'car',           label: 'Car',           icon: '🚗', color: '#5c6bc0' },
  { id: 'house',         label: 'House',         icon: '🏠', color: '#8d6e63' },
  { id: 'bills',         label: 'Bills',         icon: '🧾', color: '#ef5350' },
  { id: 'communications',label: 'Phone & web',   icon: '📱', color: '#26c6da' },
  { id: 'health',        label: 'Health',        icon: '💊', color: '#ec407a' },
  { id: 'clothes',       label: 'Clothes',       icon: '👕', color: '#ab47bc' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#ffa726' },
  { id: 'sports',        label: 'Sports',        icon: '🏃', color: '#66bb6a' },
  { id: 'gifts',         label: 'Gifts',         icon: '🎁', color: '#f06292' },
  { id: 'taxi',          label: 'Taxi',          icon: '🚕', color: '#fdd835' },
  { id: 'other',         label: 'Other',         icon: '📦', color: '#90a4ae' },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id) {
  return byId.get(id) || { id, label: id, icon: '❔', color: '#b0bec5' };
}

export const CURRENCIES = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'JPY', symbol: '¥' },
];

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
