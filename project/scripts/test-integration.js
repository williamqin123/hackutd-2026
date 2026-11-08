// Run against a fresh, local flood-db published by the identity in this CLI config.
// Tokens are read only into memory and never printed.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFloodCsv } from '../lib/flood-service.js';
import { encodeArguments } from '../lib/spacetime.js';

const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:3001';
let token = process.env.TEST_DEVELOPER_TOKEN;
if (!token && process.argv[2]) {
  const config = await readFile(process.argv[2], 'utf8');
  token = config.match(/^spacetimedb_token\s*=\s*"([^"]+)"/m)?.[1];
}
assert.ok(token, 'Set TEST_DEVELOPER_TOKEN or pass a local CLI config file.');
async function call(name, args = [], authorized = true) {
  const response = await fetch(`${origin}/v1/database/flood-db/call/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(encodeArguments(args)),
  });
  const body = await response.text();
  return { status: response.status, body, ok: response.ok };
}
function data(response) {
  assert.ok(response.ok, `HTTP ${response.status}: ${response.body.slice(0, 400)}`);
  return JSON.parse(JSON.parse(response.body));
}

const rows = parseFloodCsv(await readFile('public/harvey_2017_houston_harris_flood_marks.csv', 'utf8'));
assert.equal((await call('import_floods', [rows.slice(0, 1)], false)).ok, false);
for (let i = 0; i < rows.length; i += 100) {
  const result = await call('import_floods', [rows.slice(i, i + 100)]);
  assert.ok(result.ok, result.body);
}
assert.ok((await call('import_floods', [rows.slice(0, 100)])).ok);
assert.equal(data(await call('get_floods', [], false)).length, rows.length);
console.log(`CSV import and duplicate handling: ${rows.length} records.`);

const id = `test-${crypto.randomUUID()}`;
const args = [id, 29.99, -95.24, 100, 6, 10];
assert.equal((await call('create_simulation', args, false)).ok, false);
assert.equal((await call('create_simulation', [`invalid-${id}`, 999, -95, 100, 6, 10])).ok, false);
assert.ok((await call('create_simulation', args)).ok);
assert.ok((await call('create_simulation', args)).ok, 'Identical request is idempotent.');
assert.equal((await call('create_simulation', [id, 30, -95.24, 100, 6, 10])).ok, false);
let simulation;
for (let attempt = 0; attempt < 40; attempt++) {
  simulation = data(await call('get_simulation', [id]));
  if (['completed', 'failed'].includes(simulation.status)) break;
  await new Promise(resolve => setTimeout(resolve, 100));
}
assert.equal(simulation.status, 'completed', simulation.error);
assert.ok(simulation.result.matchedRecords > 0);
assert.equal(simulation.result.rainfallIntensityMmPerHour, 100 / 6);
assert.match(data(await call('get_simulation', [id], false)).error, /Developer access required/);
assert.equal(data(await call('get_simulation', ['missing'])), null);
console.log('Scheduled simulation, stored results, validation, idempotency, and access checks passed.');
