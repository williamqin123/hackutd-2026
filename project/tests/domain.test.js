import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSimulation } from '../shared/validation.js';
import { parseFloodCsv } from '../lib/flood-service.js';
import { distanceKm, simulate } from '../spacetimedb/src/simulator.js';
import { importFloodRecords } from '../spacetimedb/src/floods.js';
import { requireDeveloper } from '../spacetimedb/src/access.js';
import { callSpacetime } from '../lib/spacetime.js';

const input = { latitude: 30, longitude: -95, rainfallMm: 100, durationHours: 5, radiusKm: 10 };

test('validation rejects empty, nonfinite, and out-of-range scenario inputs', () => {
  assert.deepEqual(validateSimulation(input), input);
  for (const [field, value] of [['latitude', ''], ['longitude', 181], ['durationHours', 0],
    ['rainfallMm', -1], ['rainfallMm', Infinity], ['radiusKm', 101]]) {
    assert.throws(() => validateSimulation({ ...input, [field]: value }));
  }
});

test('screening calculates physical rainfall units and filters historical locations', () => {
  const records = [{ id: 'near', latitude: 30, longitude: -95 }, { id: 'far', latitude: 35, longitude: -95 }];
  const result = simulate(input, records);
  assert.equal(distanceKm(input, input), 0);
  assert.equal(result.rainfallIntensityMmPerHour, 20);
  assert.ok(Math.abs(result.rainfallVolumeM3 - Math.PI * 10000000) < 0.001);
  assert.deepEqual(result.points.map(row => row.id), ['near']);
  assert.equal(simulate(input, []).matchedRecords, 0);
  assert.equal(records[0].distanceKm, undefined);
});

test('bundled CSV normalizes IDs, dates and coordinates and rejects duplicates', async () => {
  const rows = parseFloodCsv(await readFile(new URL('../public/harvey_2017_houston_harris_flood_marks.csv', import.meta.url), 'utf8'));
  assert.ok(rows.length > 100);
  assert.equal(rows[0].id, 'harvey-2017-harris:14');
  assert.equal(rows[0].observedAt, '2017-09-22T11:00:00.000Z');
  assert.equal(rows[0].latitude, 29.99918);
  assert.throws(() => parseFloodCsv('OBJECTID,latitude_dd,longitude_dd\n1,30,-95\n1,30,-95'));
  assert.throws(() => parseFloodCsv('OBJECTID,latitude_dd,longitude_dd\n1,,-95'));
});

test('imports retain existing observations and reject oversized batches', () => {
  const saved = new Map();
  const ctx = { db: { floods: { id: { find: id => saved.get(id) }, insert: row => saved.set(row.id, row) } } };
  const row = { id: 'source:1', latitude: 30, longitude: -95 };
  importFloodRecords(ctx, [row]);
  importFloodRecords(ctx, [{ ...row, latitude: 31 }]);
  assert.equal(saved.size, 1);
  assert.equal(saved.get(row.id).latitude, 30);
  assert.throws(() => importFloodRecords(ctx, Array(101).fill(row)));
});

test('developer actions require the authenticated sender to be allowed', () => {
  const ctx = { sender: 'dispatcher', db: { developers: { identity: { find: sender => sender === 'developer' } } } };
  assert.throws(() => requireDeveloper(ctx), /Developer access/);
  assert.doesNotThrow(() => requireDeveloper({ ...ctx, sender: 'developer' }));
});

test('HTTP transport encodes Spacetime fields and decodes procedure results', async context => {
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/v1/database/flood-db/call/get_floods');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), [[{ event_name: 'Harvey', observed_at: '2017' }]]);
    assert.equal(options.headers.Authorization, undefined);
    return new Response(JSON.stringify(JSON.stringify([{ id: 'record' }])));
  });
  assert.deepEqual(await callSpacetime('get_floods', [[{ eventName: 'Harvey', observedAt: '2017' }]]), [{ id: 'record' }]);
});
