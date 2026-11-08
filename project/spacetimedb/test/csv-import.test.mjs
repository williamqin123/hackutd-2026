import { test } from "node:test";
import assert from "node:assert/strict";
import { Timestamp } from "spacetimedb";
import { importCsvRecords } from "../src/csv-import.js";

function setup() {
    const shelters = new Map(), requests = new Map(), imports = new Map(), events = [];
    let sequence = 0n;
    const ctx = {
        timestamp: new Timestamp(1800000000000000n),
        db: {
            shelter: { id: { find: (id) => shelters.get(id) }, insert: (row) => shelters.set(row.id, row) },
            rescueRequest: { insert: (row) => {
                const saved = { ...row, id: ++sequence };
                requests.set(saved.id, saved);
                return saved;
            } },
            csvRequestImport: { sourceId: { find: (id) => imports.get(id) }, insert: (row) => imports.set(row.sourceId, row) },
            activityEvent: { insert: (row) => events.push(row) },
        },
    };
    return { ctx, shelters, requests, imports, events };
}

const payload = () => ({
    shelters: [{ id: "north", name: "North Shelter", capacity: 120, occupied: 78 }],
    requests: [{ sourceId: "D01", lat: 29.775, lon: -95.375, peopleCount: 4,
        medicalUrgent: true, stranded: true, needsTransport: true,
        description: "Four people stranded upstairs", waitMinutes: 47 }],
});
const fail = (message) => { throw new Error(message); };

test("imports pending requests, computes priority and initial wait, and stores the source mapping", () => {
    const state = setup();
    importCsvRecords(state.ctx, payload(), fail);
    const row = state.requests.get(1n);
    assert.equal(row.status, "pending");
    assert.equal(row.priorityScore, 1590);
    assert.equal(row.createdAt.microsSinceUnixEpoch, state.ctx.timestamp.microsSinceUnixEpoch - 47n * 60000000n);
    assert.equal(state.imports.get("D01").requestId, row.id);
    assert.equal(state.shelters.get("north").occupied, 78);
    assert.equal(state.events.length, 1);
});

test("reimport preserves assigned status, timestamps and changed shelter occupancy without duplicate activity", () => {
    const state = setup();
    importCsvRecords(state.ctx, payload(), fail);
    const row = state.requests.get(1n);
    row.status = "assigned";
    state.shelters.get("north").occupied = 90;
    state.ctx.timestamp = new Timestamp(1800000060000000n);
    importCsvRecords(state.ctx, payload(), fail);
    assert.equal(state.requests.size, 1);
    assert.equal(state.imports.size, 1);
    assert.equal(state.shelters.size, 1);
    assert.equal(state.requests.get(1n), row);
    assert.equal(row.status, "assigned");
    assert.equal(state.shelters.get("north").occupied, 90);
    assert.equal(state.events.length, 1);
});

test("a later batch imports only new source IDs", () => {
    const state = setup();
    importCsvRecords(state.ctx, payload(), fail);
    const next = payload();
    next.requests.push({ ...next.requests[0], sourceId: "D02" });
    importCsvRecords(state.ctx, next, fail);
    assert.equal(state.requests.size, 2);
    assert.equal(state.events.length, 2);
});

for (const [label, change] of [
    ["invalid latitude", (data) => { data.requests[0].lat = 91; }],
    ["nonfinite longitude", (data) => { data.requests[0].lon = NaN; }],
    ["zero people", (data) => { data.requests[0].peopleCount = 0; }],
    ["negative wait", (data) => { data.requests[0].waitMinutes = -1; }],
    ["blank description", (data) => { data.requests[0].description = " "; }],
    ["occupancy above capacity", (data) => { data.shelters[0].occupied = 121; }],
    ["duplicate request IDs", (data) => { data.requests.push({ ...data.requests[0] }); }],
    ["duplicate shelter IDs", (data) => { data.shelters.push({ ...data.shelters[0] }); }],
    ["oversized batch", (data) => { data.requests = Array(1001).fill(data.requests[0]); }],
]) {
    test(`rejects ${label} before writing any records`, () => {
        const state = setup(), data = payload();
        change(data);
        assert.throws(() => importCsvRecords(state.ctx, data, fail));
        assert.equal(state.requests.size + state.shelters.size + state.imports.size + state.events.length, 0);
    });
}
