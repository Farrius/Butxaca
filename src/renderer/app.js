import { CATEGORIES, CURRENCIES, getCategory, formatMoney } from './data/categories.js';
import { LocalStore, toCSV } from './data/store.js';
import { rangeFor, shift, inRange, labelFor, toISODate, parseISODate } from './data/period.js';

const store = new LocalStore();
const $ = (id) => document.getElementById(id);

const settings = store.getSettings();
const state = {
  period: settings.period || 'month',
  anchor: new Date(),
  viewCurrency: settings.viewCurrency || settings.defaultCurrency || 'EUR',
  expenses: [],
  // amount entry
  entry: { category: null, value: '0', currency: settings.defaultCurrency || 'EUR' },
  expanded: new Set(),
};

// Where each of the 14 categories sits on the 4x5 board around the donut.
const BOARD_SLOTS = [
  [1, 1], [1, 2], [1, 3], [1, 4], // top row
  [2, 4], [3, 4], [4, 4],         // right column
  [5, 4], [5, 3], [5, 2], [5, 1], // bottom row (right → left)
  [4, 1], [3, 1], [2, 1],         // left column (bottom → top)
];

// ---------- Data helpers ----------
function periodExpenses() {
  const range = rangeFor(state.period, state.anchor);
  return state.expenses.filter((e) => inRange(e.date, range));
}

function totalsByCategory(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.currency !== state.viewCurrency) continue;
    map.set(r.category, (map.get(r.category) || 0) + r.amount);
  }
  return map;
}

// Locale decimal separator ("," in Catalan/Spanish, "." in English).
const DECIMAL = (1.5).toLocaleString().charAt(1);
const money = (n) => formatMoney(n, state.viewCurrency);
const round2 = (n) => Math.round(n * 100) / 100;

// ---------- Rendering ----------
function renderHeader() {
  document.querySelectorAll('#periods button').forEach((b) => {
    b.classList.toggle('active', b.dataset.period === state.period);
  });
  $('periodLabel').textContent = labelFor(state.period, state.anchor);
  const isAll = state.period === 'all';
  $('prevBtn').disabled = isAll;
  $('nextBtn').disabled = isAll;
  $('currencyBtn').textContent = state.viewCurrency;
}

function catButton(cat, amount) {
  const btn = document.createElement('button');
  btn.className = 'cat-cell' + (amount ? '' : ' empty');
  btn.style.setProperty('--c', cat.color);
  btn.dataset.category = cat.id;
  btn.innerHTML = `
    <span class="cat-icon">${cat.icon}</span>
    <span class="cat-name">${cat.label}</span>
    <span class="cat-amount">${amount ? money(amount) : ''}</span>`;
  return btn;
}

function renderBoard(totals) {
  const board = $('board');
  board.querySelectorAll('.cat-cell').forEach((n) => n.remove());
  CATEGORIES.slice(0, BOARD_SLOTS.length).forEach((cat, i) => {
    const btn = catButton(cat, totals.get(cat.id) || 0);
    const [row, col] = BOARD_SLOTS[i];
    btn.style.gridRow = row;
    btn.style.gridColumn = col;
    btn.addEventListener('click', () => openAmount(cat.id));
    board.appendChild(btn);
  });
}

function renderDonut(totals) {
  const svg = $('donutSvg');
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const r = 80;
  const C = 2 * Math.PI * r;
  const parts = [];
  parts.push(`<circle cx="100" cy="100" r="${r}" fill="none" stroke="#e3e6ea" stroke-width="26"/>`);
  if (total > 0) {
    let offset = 0;
    const gap = totals.size > 1 ? 1.5 : 0;
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    for (const [catId, amt] of sorted) {
      const len = (amt / total) * C;
      const seg = Math.max(len - gap, 0.5);
      parts.push(
        `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${getCategory(catId).color}" stroke-width="26"
          stroke-dasharray="${seg} ${C - seg}" stroke-dashoffset="${-offset}"
          transform="rotate(-90 100 100)"/>`
      );
      offset += len;
    }
  }
  parts.push(`<circle cx="100" cy="100" r="66" fill="#fff"/>`);
  svg.innerHTML = parts.join('');
  $('totalLabel').textContent = money(round2(total));
}

function render() {
  const rows = periodExpenses();
  const totals = totalsByCategory(rows);
  renderHeader();
  renderBoard(totals);
  renderDonut(totals);
  if (!$('listSheet').hidden) renderList();
}

// ---------- Sheets ----------
function openSheet(id) {
  closeSheets();
  $('scrim').hidden = false;
  $(id).hidden = false;
}
function closeSheets() {
  $('scrim').hidden = true;
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));
}

// Category picker (the "+" flow)
function openCategoryPicker() {
  const grid = $('categoryGrid');
  grid.innerHTML = '';
  for (const cat of CATEGORIES) {
    const btn = catButton(cat, 0);
    btn.classList.remove('empty');
    btn.querySelector('.cat-amount').remove();
    btn.addEventListener('click', () => openAmount(cat.id));
    grid.appendChild(btn);
  }
  openSheet('categorySheet');
}

// Amount entry
function openAmount(categoryId) {
  const cat = getCategory(categoryId);
  state.entry = { category: categoryId, value: '0', currency: state.entry.currency };
  $('amountHead').style.setProperty('--c', cat.color);
  $('amountCat').innerHTML = `<span>${cat.icon}</span><span>${cat.label}</span>`;
  $('currencySelect').value = state.entry.currency;
  // Default the date to the period being viewed if it's not "today's" period.
  const today = toISODate(new Date());
  const range = rangeFor(state.period, state.anchor);
  $('dateInput').value = inRange(today, range) ? today : range.end || today;
  $('noteInput').value = '';
  renderAmount();
  openSheet('amountSheet');
}

function renderAmount() {
  const v = state.entry.value;
  const [int, dec] = v.split('.');
  const pretty = Number(int).toLocaleString() + (dec !== undefined ? DECIMAL + dec : '');
  $('amountValue').textContent = pretty;
  $('confirmBtn').disabled = !(Number(v) > 0);
  const cat = getCategory(state.entry.category);
  $('confirmBtn').textContent = Number(v) > 0
    ? `Add ${formatMoney(Number(v), state.entry.currency)} · ${cat.label}`
    : 'Add expense';
}

function pressKey(key) {
  let v = state.entry.value;
  if (key === 'back') {
    v = v.length > 1 ? v.slice(0, -1) : '0';
  } else if (key === '.') {
    if (!v.includes('.')) v += '.';
  } else if (/^\d$/.test(key)) {
    const [int, dec] = v.split('.');
    if (dec !== undefined) {
      if (dec.length >= 2) return;
      v += key;
    } else {
      if (int.length >= 9) return;
      v = v === '0' ? key : v + key;
    }
  } else return;
  state.entry.value = v;
  renderAmount();
}

async function confirmAmount() {
  const amount = Number(state.entry.value);
  if (!(amount > 0)) return;
  const row = await store.add({
    date: $('dateInput').value || toISODate(new Date()),
    category: state.entry.category,
    amount,
    currency: state.entry.currency,
    note: $('noteInput').value,
  });
  store.saveSettings({ defaultCurrency: row.currency });
  // If you log in another currency, switch the view so you see it land.
  if (row.currency !== state.viewCurrency) setViewCurrency(row.currency);
  await reload();
  closeSheets();
  toast(`${formatMoney(row.amount, row.currency)} added to ${getCategory(row.category).label}`, async () => {
    await store.remove(row.id);
    await reload();
  });
}

// Expense list (tap the donut)
function renderList() {
  const rows = periodExpenses();
  const inCur = rows.filter((r) => r.currency === state.viewCurrency);
  const total = inCur.reduce((a, r) => a + r.amount, 0);
  $('listTitle').textContent = `${labelFor(state.period, state.anchor)} · ${money(round2(total))}`;
  const body = $('listBody');
  body.innerHTML = '';

  if (!inCur.length) {
    body.innerHTML = `<div class="empty-state">No expenses in ${state.viewCurrency} for this period.<br/>Tap <b>+ Expense</b> to add one.</div>`;
  }

  const groups = new Map();
  for (const r of inCur) {
    if (!groups.has(r.category)) groups.set(r.category, []);
    groups.get(r.category).push(r);
  }
  const sorted = [...groups.entries()]
    .map(([cat, items]) => [cat, items, items.reduce((a, r) => a + r.amount, 0)])
    .sort((a, b) => b[2] - a[2]);

  for (const [catId, items, sum] of sorted) {
    const cat = getCategory(catId);
    const pct = total ? (sum / total) * 100 : 0;
    const g = document.createElement('div');
    g.className = 'group';
    g.style.setProperty('--c', cat.color);
    g.innerHTML = `
      <button class="group-row">
        <span class="cat-icon">${cat.icon}</span>
        <span class="group-label"><span>${cat.label}</span><span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span></span>
        <span class="group-total">${money(round2(sum))}<small>${pct.toFixed(0)}% · ${items.length}</small></span>
      </button>`;
    g.querySelector('.group-row').addEventListener('click', () => {
      state.expanded.has(catId) ? state.expanded.delete(catId) : state.expanded.add(catId);
      renderList();
    });
    if (state.expanded.has(catId)) {
      const list = document.createElement('div');
      list.className = 'items';
      items
        .slice()
        .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
        .forEach((r) => {
          const it = document.createElement('div');
          it.className = 'item';
          const d = parseISODate(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
          it.innerHTML = `
            <div class="item-meta"><div>${escapeHtml(r.note) || cat.label}</div><small>${d}</small></div>
            <span class="item-amt">${formatMoney(r.amount, r.currency)}</span>
            <button class="del" aria-label="Delete">✕</button>`;
          it.querySelector('.del').addEventListener('click', async () => {
            await store.remove(r.id);
            await reload();
            toast(`Deleted ${formatMoney(r.amount, r.currency)}`, async () => {
              await store.restore(r);
              await reload();
            });
          });
          list.appendChild(it);
        });
      g.appendChild(list);
    }
    body.appendChild(g);
  }

  const others = rows.filter((r) => r.currency !== state.viewCurrency);
  if (others.length) {
    const byCur = {};
    for (const r of others) byCur[r.currency] = (byCur[r.currency] || 0) + r.amount;
    const p = document.createElement('div');
    p.className = 'other-currencies';
    p.textContent = 'Also in this period: ' +
      Object.entries(byCur).map(([c, a]) => formatMoney(round2(a), c)).join(', ') +
      ' — tap the currency chip at the top to switch.';
    body.appendChild(p);
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Misc ----------
let toastTimer;
function toast(msg, undo) {
  const t = $('toast');
  t.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  if (undo) {
    const b = document.createElement('button');
    b.textContent = 'UNDO';
    b.onclick = () => { t.classList.remove('show'); undo(); };
    t.appendChild(b);
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

function setViewCurrency(code) {
  state.viewCurrency = code;
  store.saveSettings({ viewCurrency: code });
}

async function exportCSV() {
  const rows = (await store.list()).slice().sort((a, b) => a.date.localeCompare(b.date));
  const csv = toCSV(rows);
  // Inside an embedded/sandboxed page downloads are blocked: copy instead.
  if (window.self !== window.top) {
    try {
      await navigator.clipboard.writeText(csv);
      toast(`Copied ${rows.length} expenses as CSV — paste into Google Sheets`);
    } catch {
      toast('Export not available here — use the desktop app');
    }
    return;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `butxaca-expenses-${toISODate(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${rows.length} expenses`);
}

async function reload() {
  state.expenses = await store.list();
  render();
}

// ---------- Wiring ----------
function init() {
  const sel = $('currencySelect');
  document.querySelector('#keypad [data-key="."]').textContent = DECIMAL;
  sel.innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${c.code}</option>`).join('');
  sel.addEventListener('change', () => { state.entry.currency = sel.value; renderAmount(); });

  document.querySelectorAll('#periods button').forEach((b) =>
    b.addEventListener('click', () => {
      state.period = b.dataset.period;
      state.anchor = new Date();
      store.saveSettings({ period: state.period });
      render();
    })
  );
  $('prevBtn').addEventListener('click', () => { state.anchor = shift(state.period, state.anchor, -1); render(); });
  $('nextBtn').addEventListener('click', () => { state.anchor = shift(state.period, state.anchor, 1); render(); });
  $('currencyBtn').addEventListener('click', () => {
    const codes = CURRENCIES.map((c) => c.code);
    setViewCurrency(codes[(codes.indexOf(state.viewCurrency) + 1) % codes.length]);
    render();
  });
  $('exportBtn').addEventListener('click', exportCSV);

  $('addBtn').addEventListener('click', openCategoryPicker);
  $('donut').addEventListener('click', () => { renderList(); openSheet('listSheet'); });
  $('listClose').addEventListener('click', closeSheets);
  $('scrim').addEventListener('click', closeSheets);
  $('amountBack').addEventListener('click', openCategoryPicker);
  $('confirmBtn').addEventListener('click', confirmAmount);

  $('keypad').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pressKey(b.dataset.key || b.textContent.trim());
  });

  // Desktop keyboard support while the amount sheet is open.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return closeSheets();
    if ($('amountSheet').hidden) return;
    const typing = e.target.matches('input, select');
    if (e.key === 'Enter') { e.preventDefault(); return confirmAmount(); }
    if (typing) return;
    if (/^\d$/.test(e.key)) pressKey(e.key);
    else if (e.key === '.' || e.key === ',') pressKey('.');
    else if (e.key === 'Backspace') pressKey('back');
  });

  // Swipe left/right on the board to change period, like Monefy.
  let x0 = null;
  $('board').addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  $('board').addEventListener('touchend', (e) => {
    if (x0 == null || state.period === 'all') return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 60) { state.anchor = shift(state.period, state.anchor, dx < 0 ? 1 : -1); render(); }
    x0 = null;
  });

  reload();
}

init();
