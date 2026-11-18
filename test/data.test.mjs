import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore, toCSV, makeExpense } from '../src/renderer/data/store.js';
import { rangeFor, shift, inRange } from '../src/renderer/data/period.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('add / list / remove / restore', async () => {
  const s = new LocalStore(memoryStorage());
  const a = await s.add({ date: '2026-11-18', category: 'food', amount: 12.345, currency: 'EUR' });
  assert.equal(a.amount, 12.35);
  assert.equal((await s.list()).length, 1);
  await s.remove(a.id);
  assert.equal((await s.list()).length, 0);
  await s.restore(a);
  assert.deepEqual(await s.list(), [a]);
});

test('rejects invalid expenses', () => {
  assert.throws(() => makeExpense({ date: '2026-11-18', category: 'food', amount: 0 }));
  assert.throws(() => makeExpense({ date: '18/11/2026', category: 'food', amount: 3 }));
  assert.throws(() => makeExpense({ date: '2026-11-18', amount: 3 }));
});

test('CSV escapes commas and quotes', () => {
  const csv = toCSV([{ id: '1', date: '2026-11-18', category: 'food', amount: 3, currency: 'EUR', note: 'milk, "bio"', createdAt: 'x' }]);
  assert.equal(csv, 'id,date,category,amount,currency,note,createdAt\n1,2026-11-18,food,3,EUR,"milk, ""bio""",x\n');
});

test('period ranges', () => {
  const d = new Date(2026, 10, 18); // Wed 18 Nov 2026
  assert.deepEqual(rangeFor('day', d), { start: '2026-11-18', end: '2026-11-18' });
  assert.deepEqual(rangeFor('week', d), { start: '2026-11-16', end: '2026-11-22' });
  assert.deepEqual(rangeFor('month', d), { start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(rangeFor('year', d), { start: '2026-01-01', end: '2026-12-31' });
  assert.ok(inRange('2020-01-01', rangeFor('all', d)));
  // month shift from the 31st must not skip months
  assert.deepEqual(rangeFor('month', shift('month', new Date(2026, 0, 31), 1)), { start: '2026-02-01', end: '2026-02-28' });
});

import { CategoryStore, DEFAULT_CATEGORIES } from '../src/renderer/data/categories.js';

test('categories: add, edit, archive, reorder, reset', () => {
  const storage = memoryStorage();
  const cats = new CategoryStore(storage);
  assert.equal(cats.active().length, DEFAULT_CATEGORIES.length);

  const rent = cats.add({ label: 'Rent', icon: '🏠', color: '#ef5350' });
  assert.equal(rent.id, 'rent');
  assert.equal(cats.add({ label: 'Rent' }).id, 'rent_2'); // ids never collide
  assert.throws(() => cats.add({ label: '  ' }));

  cats.update('rent', { label: 'Lloguer' });
  assert.equal(cats.get('rent').label, 'Lloguer');

  cats.remove('rent');
  assert.ok(!cats.active().some((c) => c.id === 'rent'));
  assert.equal(cats.get('rent').label, 'Lloguer'); // history still resolves

  const [first, second] = cats.active();
  cats.move(second.id, -1);
  assert.equal(cats.active()[0].id, second.id);
  assert.equal(cats.active()[1].id, first.id);

  // persisted
  assert.equal(new CategoryStore(storage).get('rent').label, 'Lloguer');

  cats.reset();
  assert.equal(cats.active().length, DEFAULT_CATEGORIES.length);
});

test('categories: cannot delete the last one', () => {
  const cats = new CategoryStore(memoryStorage());
  for (const c of cats.active().slice(1)) cats.remove(c.id);
  assert.throws(() => cats.remove(cats.active()[0].id));
});

test('categories: reorder by ids and auto colors', () => {
  const cats = new CategoryStore(memoryStorage());
  const ids = cats.active().map((c) => c.id);
  cats.remove(ids[1]);
  cats.reorder([ids[3], ids[0]]); // partial list: the rest keep their order after
  const now = cats.active().map((c) => c.id);
  assert.deepEqual(now.slice(0, 3), [ids[3], ids[0], ids[2]]);
  assert.equal(now.length, ids.length - 1);
  assert.ok(cats.get(ids[1]).archived); // archived kept
  const used = new Set(cats.active().map((c) => c.color));
  assert.ok(!used.has(cats.add({ label: 'New' }).color) || used.size >= 16);
});
