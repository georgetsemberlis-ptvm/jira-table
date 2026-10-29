// Runs the Airtable automation script end to end against a mocked Airtable base and Jira.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../airtable/sync-work-orders-to-jira.js', import.meta.url), 'utf8');

const F = { epic: 'PT Epic Key (Effective)', id: 'Work Order ID', name: 'Name', url: 'Work Order Interface URL', designer: 'Assignee', status: 'Work Order Status', due: 'Due Date' };
const mkRecord = (rid, v) => ({
  id: rid,
  getCellValue: (f) => v[f],
  getCellValueAsString: (f) => (v[f] === undefined || v[f] === null ? '' : String(v[f])),
});

async function run(records, recordId, { ok = true } = {}) {
  const calls = [];
  const outputs = {};
  const ctx = {
    input: { config: () => ({ recordId }), secret: (k) => ({ JIRA_EMAIL: 'svc@example.com', JIRA_API_TOKEN: 'tok' })[k] },
    output: { set: (k, v) => (outputs[k] = v) },
    base: { getTable: () => ({ selectRecordsAsync: async () => ({ records, getRecord: (id) => records.find((r) => r.id === id) }) }) },
    fetch: async (url, opts) => { calls.push({ url, opts }); return { ok, status: ok ? 204 : 400, text: async () => 'bad' }; },
    btoa: (s) => Buffer.from(s).toString('base64'),
    console, Date, JSON, Object, Array, Error, RegExp, Math,
  };
  // Wrap in an async function so top-level await works, like Airtable's runtime.
  await vm.runInNewContext(`(async () => {\n${source}\n})()`, ctx);
  return { calls, outputs };
}

const wo = (rid, id, epic, extra = {}) => mkRecord(rid, { [F.epic]: epic, [F.id]: id, [F.name]: `WO ${id}`, [F.url]: `https://airtable.com/x?r=${rid}`, [F.designer]: 'Michael Aguila', [F.status]: 'Active', [F.due]: '2026-11-20', ...extra });

test('writes all work orders for the epic, sorted by due date, to the Jira field', async () => {
  const records = [wo('r1', 2, 'PT-10', { [F.due]: '2026-12-01' }), wo('r2', 1, 'PT-10'), wo('r3', 3, 'PT-99')];
  const { calls, outputs } = await run(records, 'r1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://cbsmarketing.atlassian.net/rest/api/3/issue/PT-10');
  assert.equal(calls[0].opts.method, 'PUT');
  assert.equal(calls[0].opts.headers.Authorization, 'Basic ' + Buffer.from('svc@example.com:tok').toString('base64'));
  const payload = JSON.parse(JSON.parse(calls[0].opts.body).fields.customfield_XXXXX);
  assert.deepEqual(payload.workOrders.map((w) => w.id), [1, 2]);
  assert.equal(payload.workOrders[0].designer, 'Michael Aguila');
  assert.match(outputs.result, /PT-10 with 2\/2/);
});

test('skips records with no valid epic key and never calls Jira', async () => {
  const { calls, outputs } = await run([wo('r1', 1, '')], 'r1');
  assert.equal(calls.length, 0);
  assert.match(outputs.result, /Skipped/);
});

test('trims payload under the size cap', async () => {
  const records = Array.from({ length: 100 }, (_, i) => wo(`r${i}`, i + 1, 'PT-10', { [F.name]: 'x'.repeat(500) }));
  const { calls } = await run(records, 'r0');
  const body = JSON.parse(calls[0].opts.body).fields.customfield_XXXXX;
  assert.ok(body.length <= 30000);
  assert.ok(JSON.parse(body).workOrders.length < 100);
});

test('throws when Jira rejects the update', async () => {
  await assert.rejects(() => run([wo('r1', 1, 'PT-10')], 'r1', { ok: false }), /Jira update of PT-10 failed: 400/);
});
