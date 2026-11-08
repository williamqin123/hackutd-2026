import test from 'node:test';
import assert from 'node:assert/strict';
import { SosArrivalTracker } from '../lib/sos-arrivals.js';

test('initial data is static and only a subsequently added ID animates', () => {
  const tracker = new SosArrivalTracker();
  tracker.update([{ id: 1n }], false, 0);
  tracker.update([{ id: 1n }, { id: 2n }], true, 100);
  assert.equal(tracker.elapsed(1n, 100), null);
  assert.equal(tracker.elapsed(2n, 100), null);
  tracker.update([{ id: 1n }, { id: 2n }, { id: 3n }], true, 200);
  assert.equal(tracker.elapsed(3n, 200), 0);
  assert.equal(tracker.elapsed(2n, 200), null);
});

test('status updates and rerenders preserve the original six-second deadline', () => {
  const tracker = new SosArrivalTracker();
  tracker.update([], true, 0);
  tracker.update([{ id: 1n, status: 'pending' }], true, 100);
  tracker.update([{ id: 1n, status: 'assigned' }], true, 3100);
  assert.equal(tracker.elapsed(1n, 3100), 3000);
  assert.equal(tracker.elapsed(1n, 6099), 5999);
  assert.equal(tracker.elapsed(1n, 6100), null);
  tracker.update([{ id: 1n }], true, 6200);
  assert.equal(tracker.elapsed(1n, 6200), null);
});

test('reconnecting does not replay old arrivals or animate the resync snapshot', () => {
  const tracker = new SosArrivalTracker();
  tracker.update([], true, 0);
  tracker.update([{ id: 1n }], true, 100);
  tracker.update([{ id: 1n }], false, 200);
  assert.equal(tracker.elapsed(1n, 200), null);
  tracker.update([{ id: 1n }, { id: 2n }], true, 300);
  assert.equal(tracker.elapsed(1n, 300), null);
  assert.equal(tracker.elapsed(2n, 300), null);
  tracker.update([{ id: 1n }, { id: 2n }, { id: 3n }], true, 400);
  assert.equal(tracker.elapsed(3n, 400), 0);
});

test('multiple new requests animate independently without replaying a removed ID', () => {
  const tracker = new SosArrivalTracker();
  tracker.update([{ id: 1n }], true, 0);
  tracker.update([{ id: 2n }, { id: 3n }], true, 100);
  tracker.update([{ id: 1n }, { id: 2n }, { id: 3n }], true, 200);
  assert.equal(tracker.elapsed(1n, 200), null);
  assert.equal(tracker.elapsed(2n, 200), 100);
  assert.equal(tracker.elapsed(3n, 200), 100);
});
