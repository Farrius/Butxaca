import { CategoryStore, CURRENCIES, ICON_CHOICES, COLOR_CHOICES, formatMoney } from './data/categories.js';
import { LocalStore, toCSV } from './data/store.js';
import { rangeFor, shift, inRange, labelFor, toISODate, parseISODate } from './data/period.js';

const store = new LocalStore();
const categories = new CategoryStore(store.storage);
const $ = (id) => document.getElementById(id);

const settings = store.getSettings();
const state = {
  period: settings.period || 'month',
  anchor: new Date(),
  currency: settings.currency || settings.viewCurrency || settings.defaultCurrency || 'EUR',
  expenses: [],
  entry: { category: null, value: '0', currency: null },
  expanded: new Set(),
  editing: null, // category being edited ({ id?, label, icon, color })
};

// Locale decimal separator ("," in Catalan/Spanish, "." in English).
const DECIMAL = (1.5).toLocaleString().charAt(1);
const money = (n) => formatMoney(n, state.currency);
const round2 = (n) => Math.round(n * 100) / 100;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Data helpers ----------
function periodExpenses() {
  const range = rangeFor(state.period, state.anchor);
  return state.expenses.filter((e) => inRange(e.date, range));
}

function totalsByCategory(rows) {
  const map = new Map();
  for (const r of rows) {
    if (r.currency !== state.currency) continue;
    map.set(r.category, (map.get(r.category) || 0) + r.amount);
  }
  return map;
}

/**
 * Board geometry: icons sit evenly on a circle (clockwise from the top)
 * around the donut. Everything scales with the available space and the
 * number of categories, so it stays round on any screen.
 */
function circleLayout(width, height, n) {
  const S = Math.min(width, height);
  const AMOUNT_ROOM = 16; // label under the bottom icons
  let icon = 50;
  let R = S / 2 - icon / 2 - AMOUNT_ROOM;
  // Shrink icons when there are many categories so neighbours never touch.
  for (let i = 0; i < 2; i++) {
    const spacing = (2 * Math.PI * R) / Math.max(n, 1);
    icon = Math.max(28, Math.min(54, spacing * 0.7, S * 0.14));
    R = S / 2 - icon / 2 - AMOUNT_ROOM;
  }
  const donut = Math.max(120, 2 * (R - icon / 2 - 18)); // leave room for amounts under top icons
  const cx = width / 2;
  const cy = height / 2;
  const points = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });
  return { cx, cy, icon, donut, points };
}

// ---------- Main screen ----------
function renderHeader() {
  $('periodLabel').textContent = labelFor(state.period, state.anchor);
  const isAll = state.period === 'all';
  $('prevBtn').disabled = isAll;
  $('nextBtn').disabled = isAll;
}

function catButton(cat, { amount = 0, mode = 'board' } = {}) {
  const btn = document.createElement('button');
  btn.className = 'cat-cell' + (mode === 'board' && !amount ? ' empty' : '');
  btn.style.setProperty('--c', cat.color);
  btn.dataset.category = cat.id;
  btn.title = cat.label;
  btn.setAttribute('aria-label', amount ? `${cat.label}: ${money(amount)}` : cat.label);
  btn.innerHTML = `<span class="cat-icon">${escapeHtml(cat.icon)}</span>` + (mode === 'board'
    ? `<span class="cat-amount">${amount ? money(amount) : ''}</span>`
    : `<span class="cat-name">${escapeHtml(cat.label)}</span>`);
  return btn;
}

function renderBoard(totals) {
  const board = $('board');
  board.querySelectorAll('.cat-cell').forEach((n) => n.remove());
  const cats = categories.active();
  // Also show deleted categories that still have spending in this period.
  for (const id of totals.keys()) {
    if (!cats.some((c) => c.id === id)) cats.push(categories.get(id));
  }
  for (const cat of cats) {
    const btn = catButton(cat, { amount: totals.get(cat.id) || 0 });
    btn.addEventListener('click', () => (cat.archived ? openList() : openAmount(cat.id)));
    board.appendChild(btn);
  }
  layoutBoard();
}

/** Positions the icons and sizes the donut; re-run whenever the board resizes. */
function layoutBoard() {
  const board = $('board');
  const cells = [...board.querySelectorAll('.cat-cell')];
  const { cx, cy, icon, donut, points } = circleLayout(board.clientWidth, board.clientHeight, cells.length);
  cells.forEach((el, i) => {
    el.style.left = `${points[i][0]}px`;
    el.style.top = `${points[i][1]}px`;
    el.style.setProperty('--sz', `${icon}px`);
  });
  const d = $('donut');
  d.style.left = `${cx}px`;
  d.style.top = `${cy}px`;
  d.style.setProperty('--d', `${donut}px`);
}

function renderDonut(totals) {
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const r = 80;
  const C = 2 * Math.PI * r;
  const parts = [`<circle cx="100" cy="100" r="${r}" fill="none" stroke="#e3e6ea" stroke-width="26"/>`];
  if (total > 0) {
    let offset = 0;
    const gap = totals.size > 1 ? 1.5 : 0;
    for (const [catId, amt] of [...totals.entries()].sort((a, b) => b[1] - a[1])) {
      const len = (amt / total) * C;
      const seg = Math.max(len - gap, 0.5);
      parts.push(
        `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${categories.get(catId).color}" stroke-width="26"
          stroke-dasharray="${seg} ${C - seg}" stroke-dashoffset="${-offset}" transform="rotate(-90 100 100)"/>`
      );
      offset += len;
    }
  }
  parts.push(`<circle cx="100" cy="100" r="66" fill="#fff"/>`);
  $('donutSvg').innerHTML = parts.join('');
  $('totalLabel').textContent = money(round2(total));
}

function render() {
  const totals = totalsByCategory(periodExpenses());
  renderHeader();
  renderBoard(totals);
  renderDonut(totals);
  if (!$('listSheet').hidden) renderList();
}

// ---------- Overlays ----------
function closeAll() {
  $('scrim').hidden = true;
  $('drawer').hidden = true;
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));
}
function openSheet(id) {
  closeAll();
  $('toast').classList.remove('show'); // a stale "undo" shouldn't cover the next screen
  $('scrim').hidden = false;
  $(id).hidden = false;
}

// ---------- Hamburger menu ----------
function openDrawer() {
  closeAll();
  state.editing = null;
  $('toast').classList.remove('show');
  renderDrawer();
  $('scrim').hidden = false;
  $('drawer').hidden = false;
}

function renderDrawer() {
  document.querySelectorAll('#periodOptions button').forEach((b) =>
    b.classList.toggle('active', b.dataset.period === state.period));
  $('mainCurrency').value = state.currency;
  renderCategories();
  $('drawerSummary').textContent = `${state.period === 'all' ? 'All time' : state.period} · ${state.currency}`;
}

function setPeriod(p) {
  state.period = p;
  state.anchor = new Date();
  store.saveSettings({ period: p });
  renderDrawer();
  render();
}

function setCurrency(code) {
  state.currency = code;
  store.saveSettings({ currency: code });
  renderDrawer();
  render();
}

// ---------- Add expense: category picker → amount ----------
function openCategoryPicker() {
  const grid = $('categoryGrid');
  grid.innerHTML = '';
  for (const cat of categories.active()) {
    const btn = catButton(cat, { mode: 'picker' });
    btn.addEventListener('click', () => openAmount(cat.id));
    grid.appendChild(btn);
  }
  openSheet('categorySheet');
}

function openAmount(categoryId) {
  const cat = categories.get(categoryId);
  state.entry = { category: categoryId, value: '0', currency: state.currency };
  $('amountHead').style.setProperty('--c', cat.color);
  $('amountCat').innerHTML = `<span>${escapeHtml(cat.icon)}</span><span>${escapeHtml(cat.label)}</span>`;
  $('currencySelect').value = state.entry.currency;
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
  $('amountValue').textContent = Number(int).toLocaleString() + (dec !== undefined ? DECIMAL + dec : '');
  const ok = Number(v) > 0;
  $('confirmBtn').disabled = !ok;
  $('confirmBtn').textContent = ok
    ? `Add ${formatMoney(Number(v), state.entry.currency)} · ${categories.get(state.entry.category).label}`
    : 'Add expense';
}

function pressKey(key) {
  let v = state.entry.value;
  if (key === 'back') v = v.length > 1 ? v.slice(0, -1) : '0';
  else if (key === '.') { if (!v.includes('.')) v += '.'; }
  else if (/^\d$/.test(key)) {
    const [int, dec] = v.split('.');
    if (dec !== undefined) { if (dec.length >= 2) return; v += key; }
    else { if (int.length >= 9) return; v = v === '0' ? key : v + key; }
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
  await reload();
  closeAll();
  const other = row.currency !== state.currency ? ` (shown when main currency is ${row.currency})` : '';
  toast(`${formatMoney(row.amount, row.currency)} added to ${categories.get(row.category).label}${other}`, async () => {
    await store.remove(row.id);
    await reload();
  });
}

// ---------- Expense list (tap the donut) ----------
function openList() {
  renderList();
  openSheet('listSheet');
}

function renderList() {
  const rows = periodExpenses();
  const inCur = rows.filter((r) => r.currency === state.currency);
  const total = inCur.reduce((a, r) => a + r.amount, 0);
  $('listTitle').textContent = `${labelFor(state.period, state.anchor)} · ${money(round2(total))}`;
  const body = $('listBody');
  body.innerHTML = '';
  if (!inCur.length) {
    body.innerHTML = `<div class="empty-state">No expenses in ${state.currency} for this period.<br/>Tap <b>+ Expense</b> to add one.</div>`;
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
    const cat = categories.get(catId);
    const pct = total ? (sum / total) * 100 : 0;
    const g = document.createElement('div');
    g.className = 'group';
    g.style.setProperty('--c', cat.color);
    g.innerHTML = `
      <button class="group-row">
        <span class="cat-icon">${escapeHtml(cat.icon)}</span>
        <span class="group-label"><span>${escapeHtml(cat.label)}${cat.archived ? ' <small>(deleted)</small>' : ''}</span><span class="bar"><i style="width:${pct.toFixed(1)}%"></i></span></span>
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
            <div class="item-meta"><div>${escapeHtml(r.note) || escapeHtml(cat.label)}</div><small>${d}</small></div>
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

  const others = rows.filter((r) => r.currency !== state.currency);
  if (others.length) {
    const byCur = {};
    for (const r of others) byCur[r.currency] = (byCur[r.currency] || 0) + r.amount;
    const p = document.createElement('div');
    p.className = 'other-currencies';
    p.textContent = 'Also in this period: ' +
      Object.entries(byCur).map(([c, a]) => formatMoney(round2(a), c)).join(', ') +
      ' — change the main currency in the ☰ menu to see them.';
    body.appendChild(p);
  }
}

// ---------- Categories (edited inline in the menu) ----------
// state.editing: null, or { id (null = new), label, icon, color }

function renderCategories() {
  const list = $('categoriesList');
  list.innerHTML = '';
  const cats = categories.active();
  $('catCount').textContent = cats.length;
  cats.forEach((cat, i) => {
    const open = state.editing?.id === cat.id;
    const row = document.createElement('div');
    row.className = 'cat-row' + (open ? ' open' : '');
    row.style.setProperty('--c', cat.color);
    row.innerHTML = `
      <button class="name"><span class="cat-icon">${escapeHtml(cat.icon)}</span><span>${escapeHtml(cat.label)}</span></button>
      <button class="move" data-dir="-1" aria-label="Move ${escapeHtml(cat.label)} up" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="move" data-dir="1" aria-label="Move ${escapeHtml(cat.label)} down" ${i === cats.length - 1 ? 'disabled' : ''}>▼</button>`;
    row.querySelector('.name').addEventListener('click', () => {
      state.editing = open ? null : { id: cat.id, label: cat.label, icon: cat.icon, color: cat.color };
      renderCategories();
    });
    row.querySelectorAll('.move').forEach((b) => b.addEventListener('click', () => {
      categories.move(cat.id, Number(b.dataset.dir));
      renderCategories();
      render();
    }));
    list.appendChild(row);
    if (open) list.appendChild(categoryEditor());
  });

  const slot = $('newCategorySlot');
  slot.innerHTML = '';
  const adding = state.editing && state.editing.id === null;
  if (adding) slot.appendChild(categoryEditor());
  $('addCategoryBtn').hidden = adding;
}

function categoryEditor() {
  const e = state.editing;
  const isNew = e.id === null;
  const el = document.createElement('div');
  el.className = 'cat-editor';
  const icons = ICON_CHOICES.includes(e.icon) ? ICON_CHOICES : [e.icon, ...ICON_CHOICES];
  el.innerHTML = `
    <div class="ed-top">
      <span class="cat-icon" style="--c:${e.color}">${escapeHtml(e.icon)}</span>
      <input type="text" class="select" maxlength="24" placeholder="Name (e.g. Rent)" value="${escapeHtml(e.label)}" />
    </div>
    <div class="icon-grid">${icons.map((ic) => `<button class="${ic === e.icon ? 'sel' : ''}">${ic}</button>`).join('')}</div>
    <div class="color-grid">${COLOR_CHOICES.map((c) =>
      `<button class="${c === e.color ? 'sel' : ''}" style="background:${c}" data-color="${c}" aria-label="Color ${c}"></button>`).join('')}</div>
    <p class="error"></p>
    <div class="ed-actions">
      <button class="save">${isNew ? 'Add' : 'Save'}</button>
      <button class="cancel">Cancel</button>
      ${isNew ? '' : '<button class="delete">Delete</button>'}
    </div>`;

  const preview = el.querySelector('.ed-top .cat-icon');
  const input = el.querySelector('input');
  const error = el.querySelector('.error');
  input.addEventListener('input', () => { e.label = input.value; error.textContent = ''; });
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
  el.querySelector('.icon-grid').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    e.icon = b.textContent;
    preview.textContent = e.icon;
    el.querySelectorAll('.icon-grid button').forEach((x) => x.classList.toggle('sel', x === b));
  });
  el.querySelector('.color-grid').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    e.color = b.dataset.color;
    preview.style.setProperty('--c', e.color);
    el.querySelectorAll('.color-grid button').forEach((x) => x.classList.toggle('sel', x === b));
  });

  function save() {
    try {
      if (isNew) categories.add(e);
      else categories.update(e.id, e);
    } catch (err) {
      error.textContent = err.message;
      return;
    }
    state.editing = null;
    renderCategories();
    render();
  }
  el.querySelector('.save').addEventListener('click', save);
  el.querySelector('.cancel').addEventListener('click', () => { state.editing = null; renderCategories(); });

  const del = el.querySelector('.delete');
  if (del) del.addEventListener('click', () => {
    // Two taps to delete (no native confirm dialogs on mobile web views).
    if (!del.classList.contains('armed')) {
      const used = state.expenses.filter((x) => x.category === e.id).length;
      del.classList.add('armed');
      del.textContent = used ? `Sure? ${used} past expense${used > 1 ? 's stay' : ' stays'} in history` : 'Tap again to delete';
      return;
    }
    try {
      categories.remove(e.id);
    } catch (err) {
      error.textContent = err.message;
      return;
    }
    state.editing = null;
    renderCategories();
    render();
    toast('Category deleted');
  });

  if (isNew) setTimeout(() => input.focus(), 30);
  return el;
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
  document.querySelector('#keypad [data-key="."]').textContent = DECIMAL;
  const opts = CURRENCIES.map((c) => `<option value="${c.code}">${c.code} — ${c.name}</option>`).join('');
  $('mainCurrency').innerHTML = opts;
  $('currencySelect').innerHTML = CURRENCIES.map((c) => `<option value="${c.code}">${c.code}</option>`).join('');
  $('currencySelect').addEventListener('change', (e) => { state.entry.currency = e.target.value; renderAmount(); });

  // Header
  $('menuBtn').addEventListener('click', openDrawer);
  $('periodLabel').addEventListener('click', openDrawer);
  $('prevBtn').addEventListener('click', () => { state.anchor = shift(state.period, state.anchor, -1); render(); });
  $('nextBtn').addEventListener('click', () => { state.anchor = shift(state.period, state.anchor, 1); render(); });

  // Drawer
  document.querySelectorAll('#periodOptions button').forEach((b) =>
    b.addEventListener('click', () => setPeriod(b.dataset.period)));
  $('mainCurrency').addEventListener('change', (e) => setCurrency(e.target.value));
  $('exportBtn').addEventListener('click', exportCSV);

  // Categories
  $('addCategoryBtn').addEventListener('click', () => {
    state.editing = { id: null, label: '', icon: ICON_CHOICES[0], color: COLOR_CHOICES[Math.floor(Math.random() * COLOR_CHOICES.length)] };
    renderCategories();
  });
  $('resetCategories').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to restore defaults'; return; }
    delete b.dataset.armed;
    b.textContent = 'Restore default categories';
    state.editing = null;
    categories.reset();
    renderCategories();
    render();
  });

  // Main flows
  $('addBtn').addEventListener('click', openCategoryPicker);
  $('donut').addEventListener('click', openList);
  $('listClose').addEventListener('click', closeAll);
  $('scrim').addEventListener('click', closeAll);
  $('amountBack').addEventListener('click', openCategoryPicker);
  $('confirmBtn').addEventListener('click', confirmAmount);
  $('keypad').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pressKey(b.dataset.key || b.textContent.trim());
  });

  // Desktop keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return closeAll();
    if ($('amountSheet').hidden) return;
    if (e.key === 'Enter') { e.preventDefault(); return confirmAmount(); }
    if (e.target.matches('input, select')) return;
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

  new ResizeObserver(layoutBoard).observe($('board'));
  reload();
}

init();
