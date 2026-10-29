import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePayload, statusAppearance, MAX_ROWS } from '../src/frontend/payload.js';

test('empty value is ok and empty', () => {
  assert.deepEqual(parsePayload(''), { ok: true, workOrders: [], updated: '', truncated: false });
  assert.equal(parsePayload(null).ok, true);
});

test('parses envelope and bare array', () => {
  const wo = { id: 28133, name: 'Nikki A', url: 'https://airtable.com/x', designer: 'Michael Aguila', status: 'Active', dueDate: '2026-11-20' };
  const a = parsePayload(JSON.stringify({ version: 1, updated: '2026-10-28', workOrders: [wo] }));
  const b = parsePayload(JSON.stringify([wo]));
  assert.equal(a.workOrders[0].id, '28133');
  assert.equal(a.updated, '2026-10-28');
  assert.deepEqual(a.workOrders, b.workOrders);
});

test('rejects bad JSON and wrong shape', () => {
  assert.equal(parsePayload('{nope').ok, false);
  assert.equal(parsePayload('{"a":1}').ok, false);
});

test('drops non-https urls and empty rows', () => {
  const r = parsePayload([{ id: 1, url: 'javascript:alert(1)' }, { id: 2, url: 'http://x.com' }, {}, null]);
  assert.equal(r.workOrders.length, 2);
  assert.equal(r.workOrders[0].url, '');
  assert.equal(r.workOrders[1].url, '');
});

test('caps rows', () => {
  const r = parsePayload(Array.from({ length: MAX_ROWS + 5 }, (_, i) => ({ id: i + 1 })));
  assert.equal(r.workOrders.length, MAX_ROWS);
  assert.equal(r.truncated, true);
});

test('status appearance', () => {
  assert.equal(statusAppearance('Completed'), 'success');
  assert.equal(statusAppearance('Weird'), 'default');
});
