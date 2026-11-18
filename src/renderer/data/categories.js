// Expense categories ("buckets").
//
// `id` is what gets stored in each expense row / spreadsheet cell, so ids are
// never changed or reused — editing a category only changes label/icon/color.
// Deleting a category archives it: it disappears from the board and picker,
// but past expenses still show its name and icon.

export const DEFAULT_CATEGORIES = [
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

export const ICON_CHOICES = [
  '🛒', '🍽️', '☕', '🍺', '🍕', '🥖', '🚌', '🚇', '🚗', '⛽', '🚕', '🚲', '✈️', '🏨',
  '🏠', '🛋️', '🔌', '💡', '💧', '🧾', '📱', '💻', '🌐', '📺', '💊', '🩺', '🦷', '💇',
  '👕', '👟', '🎬', '🎮', '🎵', '📚', '🎓', '🏃', '⚽', '🏋️', '🎁', '🐶', '👶', '🧸',
  '💰', '🏦', '📈', '🛡️', '💳', '🔧', '🧹', '🧴', '🚬', '🎉', '❤️', '📦',
];

export const COLOR_CHOICES = [
  '#ef5350', '#ec407a', '#ab47bc', '#7e57c2', '#5c6bc0', '#42a5f5', '#26c6da', '#26a69a',
  '#4caf50', '#9ccc65', '#fdd835', '#ffa726', '#ff7043', '#8d6e63', '#90a4ae', '#455a64',
];

const KEY = 'butxaca.categories.v1';

function slug(label) {
  return label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'cat';
}

export class CategoryStore {
  constructor(storage) {
    this.storage = storage;
    this.items = this.#load();
  }

  #load() {
    try {
      const saved = JSON.parse(this.storage.getItem(KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { /* fall through to defaults */ }
    return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }

  #save() {
    this.storage.setItem(KEY, JSON.stringify(this.items));
  }

  /** Categories shown on the board / picker, in display order. */
  active() {
    return this.items.filter((c) => !c.archived);
  }

  get(id) {
    return this.items.find((c) => c.id === id) || { id, label: id, icon: '❔', color: '#b0bec5' };
  }

  add({ label, icon, color }) {
    label = String(label || '').trim();
    if (!label) throw new Error('Name is required');
    let id = slug(label);
    let n = 2;
    while (this.items.some((c) => c.id === id)) id = `${slug(label)}_${n++}`;
    const cat = { id, label, icon: icon || '📦', color: color || '#90a4ae' };
    this.items.push(cat);
    this.#save();
    return cat;
  }

  update(id, patch) {
    const cat = this.items.find((c) => c.id === id);
    if (!cat) return;
    if (patch.label !== undefined) {
      const label = String(patch.label).trim();
      if (!label) throw new Error('Name is required');
      cat.label = label;
    }
    if (patch.icon) cat.icon = patch.icon;
    if (patch.color) cat.color = patch.color;
    this.#save();
  }

  /** "Delete": hide it, keep it for history. */
  remove(id) {
    if (this.active().length <= 1) throw new Error('Keep at least one category');
    const cat = this.items.find((c) => c.id === id);
    if (cat) { cat.archived = true; this.#save(); }
  }

  /** Move within the active list (changes position on the board). */
  move(id, dir) {
    const active = this.active();
    const i = active.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= active.length) return;
    const a = this.items.indexOf(active[i]);
    const b = this.items.indexOf(active[j]);
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    this.#save();
  }

  reset() {
    this.items = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    this.#save();
  }
}

export const CURRENCIES = [
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US dollar' },
  { code: 'GBP', name: 'British pound' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish złoty' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'MXN', name: 'Mexican peso' },
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
