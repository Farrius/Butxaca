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
