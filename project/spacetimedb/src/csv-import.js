import { Timestamp } from "spacetimedb";

function validateId(value, label, seen, fail) {
    if (!value.trim() || value !== value.trim() || value.length > 200 || seen.has(value)) {
        fail(`${label} must be nonempty, unique in the batch, and at most 200 characters`);
    }
    seen.add(value);
}

// Called inside a reducer transaction. Reimports never reset operational state.
export function importCsvRecords(ctx, { shelters, requests }, fail) {
    if (shelters.length > 1000 || requests.length > 1000) {
        fail("Import at most 1000 shelters and 1000 requests per batch");
    }
    const shelterIds = new Set();
    const requestIds = new Set();

    // Validate the entire batch before writing any rows.
    for (const row of shelters) {
        validateId(row.id, "Shelter ID", shelterIds, fail);
        if (!row.name.trim() || row.name.length > 200 ||
            !Number.isInteger(row.capacity) || row.capacity < 1 || row.capacity > 4294967295 ||
            !Number.isInteger(row.occupied) || row.occupied < 0 || row.occupied > row.capacity) {
            fail(`Invalid name, capacity, or occupancy for shelter ${row.id}`);
        }
    }
    for (const row of requests) {
        validateId(row.sourceId, "CSV request ID", requestIds, fail);
        if (!Number.isFinite(row.lat) || Math.abs(row.lat) > 90 ||
            !Number.isFinite(row.lon) || Math.abs(row.lon) > 180 ||
            !Number.isInteger(row.peopleCount) || row.peopleCount < 1 || row.peopleCount > 4294967295 ||
            !Number.isInteger(row.waitMinutes) || row.waitMinutes < 0 || row.waitMinutes > 525600 ||
            !row.description.trim() || row.description.length > 10000 ||
            [row.medicalUrgent, row.stranded, row.needsTransport].some((v) => typeof v !== "boolean")) {
            fail(`Invalid coordinates, needs, people count, wait, or description for ${row.sourceId}`);
        }
    }

    let importedShelters = 0;
    let importedRequests = 0;
    for (const row of shelters) {
        if (ctx.db.shelter.id.find(row.id)) continue;
        ctx.db.shelter.insert({ ...row, name: row.name.trim(), updatedAt: ctx.timestamp });
        importedShelters++;
    }
    for (const row of requests) {
        if (ctx.db.csvRequestImport.sourceId.find(row.sourceId)) continue;
        const priorityScore = (row.medicalUrgent ? 1000 : 0) + (row.stranded ? 400 : 0) +
            (row.needsTransport ? 150 : 0) + Math.min(row.peopleCount, 20) * 10;
        const request = ctx.db.rescueRequest.insert({
            id: 0n,
            lat: row.lat,
            lon: row.lon,
            peopleCount: row.peopleCount,
            medicalUrgent: row.medicalUrgent,
            stranded: row.stranded,
            needsTransport: row.needsTransport,
            description: row.description.trim(),
            status: "pending",
            priorityScore,
            createdAt: new Timestamp(ctx.timestamp.microsSinceUnixEpoch - BigInt(row.waitMinutes) * 60000000n),
            updatedAt: ctx.timestamp,
        });
        ctx.db.csvRequestImport.insert({
            sourceId: row.sourceId,
            requestId: request.id,
            importedAt: ctx.timestamp,
        });
        importedRequests++;
    }
    if (importedShelters || importedRequests) {
        ctx.db.activityEvent.insert({
            id: 0n,
            kind: "csv_import",
            message: `Imported ${importedRequests} SOS requests and ${importedShelters} shelters from CSV`,
            relatedRequestId: undefined,
            relatedTeamId: undefined,
            createdAt: ctx.timestamp,
        });
    }
}
