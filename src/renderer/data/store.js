// Expense storage.
//
// Every expense is a flat row whose keys map 1:1 to spreadsheet columns, so
// the future Google Sheets backend is just another implementation of the same
// interface (list / add / remove) — the UI doesn't need to change.
//
//   id | date (YYYY-MM-DD) | category | amount | currency | note | createdAt
//
export const COLUMNS = ['id', 'date', 'category', 'amount', 'currency', 'note', 'createdAt'];

const STORAGE_KEY = 'butxaca.expenses.v1';
const SETTINGS_KEY = 'butxaca.settings.v1';

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function makeExpense({ date, category, amount, currency, note = '' }) {
  const value = Math.round(Number(amount) * 100) / 100;
  if (!(value > 0)) throw new Error('Amount must be greater than 0');
  if (!category) throw new Error('Category is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be YYYY-MM-DD');
  return {
    id: uid(),
    date,
    category,
    amount: value,
    currency: currency || 'EUR',
    note: String(note || '').trim(),
    createdAt: new Date().toISOString(),
  };
}

/** Local backend: browser localStorage (persisted per-profile by Electron). */
export class LocalStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  async list() {
    try {
      const rows = JSON.parse(this.storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }

  async #save(rows) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }

  async add(input) {
    const row = makeExpense(input);
    const rows = await this.list();
    rows.push(row);
    await this.#save(rows);
    return row;
  }

  /** Re-insert an existing row as-is (used for "undo delete"). */
  async restore(row) {
    const rows = await this.list();
    if (!rows.some((r) => r.id === row.id)) rows.push(row);
    await this.#save(rows);
  }

  async remove(id) {
    const rows = await this.list();
    await this.#save(rows.filter((r) => r.id !== id));
  }

  getSettings() {
    try {
      return { defaultCurrency: 'EUR', period: 'month', ...JSON.parse(this.storage.getItem(SETTINGS_KEY) || '{}') };
    } catch {
      return { defaultCurrency: 'EUR', period: 'month' };
    }
  }

  saveSettings(patch) {
    this.storage.setItem(SETTINGS_KEY, JSON.stringify({ ...this.getSettings(), ...patch }));
  }
}

/** Rows -> CSV text (opens directly in Google Sheets / Excel). */
export function toCSV(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [COLUMNS.join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => esc(r[c])).join(','));
  return lines.join('\n') + '\n';
}
