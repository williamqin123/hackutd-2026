import { schema, table, t, SenderError } from "spacetimedb/server";

/**
 * The WaterBoard minimal MVP schema.
 * Historical flood CSVs / map layers can be added later.
 * This backend focuses on: simulation clock → SOS → priority → dispatch.
 */

const simulationState = table(
  {
    name: "simulation_state",
    public: true,
  },
  {
    id: t.u64().primaryKey().autoInc(),
    regionTag: t.string().unique(),
    // Simulated "disaster clock" as unix micros (historical timeline position)
    simTimeMicros: t.i64(),
    speedMultiplier: t.f64(),
    isPlaying: t.bool(),
    updatedAt: t.timestamp(),
  },
);

const rescueRequest = table(
  {
    name: "rescue_request",
    public: true,
    indexes: [
      { accessor: "byStatus", algorithm: "btree", columns: ["status"] },
      { accessor: "byPriority", algorithm: "btree", columns: ["priorityScore"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    lat: t.f64(),
    lon: t.f64(),
    peopleCount: t.u32(),
    medicalUrgent: t.bool(),
    stranded: t.bool(),
    needsTransport: t.bool(),
    description: t.string(),
    // pending | recommended | assigned | completed | cancelled
    status: t.string(),
    priorityScore: t.i32(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  },
);

const rescueTeam = table(
  {
    name: "rescue_team",
    public: true,
    indexes: [{ accessor: "byStatus", algorithm: "btree", columns: ["status"] }],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string(),
    lat: t.f64(),
    lon: t.f64(),
    capacity: t.u32(),
    hasMedical: t.bool(),
    hasBoat: t.bool(),
    // available | busy | offline
    status: t.string(),
    updatedAt: t.timestamp(),
  },
);

const dispatchAssignment = table(
  {
    name: "dispatch_assignment",
    public: true,
    indexes: [
      { accessor: "byRequest", algorithm: "btree", columns: ["requestId"] },
      { accessor: "byTeam", algorithm: "btree", columns: ["teamId"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    requestId: t.u64(),
    teamId: t.u64(),
    // recommended | confirmed | en_route | completed | cancelled
    status: t.string(),
    createdAt: t.timestamp(),
    updatedAt: t.timestamp(),
  },
);

const activityEvent = table(
  {
    name: "activity_event",
    public: true,
  },
  {
    id: t.u64().primaryKey().autoInc(),
    kind: t.string(),
    message: t.string(),
    relatedRequestId: t.option(t.u64()),
    relatedTeamId: t.option(t.u64()),
    createdAt: t.timestamp(),
  },
);

/**
 * Historical high-water marks from Hurricane Harvey (USGS). This is a slim
 * subset of the source CSV: enough to place markers on a map and tie them to
 * the simulation timeline. These are REAL observed values, not simulated.
 * objectId is the primary key so re-seeding is idempotent.
 */
const floodMark = table(
  {
    name: "flood_mark",
    public: true,
  },
  {
    objectId: t.i64().primaryKey(),
    lat: t.f64(),
    lon: t.f64(),
    elevFt: t.option(t.f64()),
    heightAboveGnd: t.option(t.f64()),
    waterbody: t.option(t.string()),
    countyName: t.option(t.string()),
    quality: t.option(t.string()),
    label: t.option(t.string()),
    // Milliseconds-derived micros since epoch; empty in source means unknown.
    surveyTimeMicros: t.option(t.i64()),
  },
);

const FloodMarkInput = t.object("FloodMarkInput", {
  objectId: t.i64(),
  lat: t.f64(),
  lon: t.f64(),
  elevFt: t.option(t.f64()),
  heightAboveGnd: t.option(t.f64()),
  waterbody: t.option(t.string()),
  countyName: t.option(t.string()),
  quality: t.option(t.string()),
  label: t.option(t.string()),
  surveyTimeMicros: t.option(t.i64()),
});

/** Hurricane track observations (IBTrACS / best-track CSV). */
const stormObservation = table(
  {
    name: "storm_observation",
    public: true,
    indexes: [
      { accessor: "byTime", algorithm: "btree", columns: ["timeMicros"] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    timeMicros: t.i64(),
    lat: t.f64(),
    lon: t.f64(),
    windKt: t.f64(),
    sshs: t.i32(),
  },
);

const StormObservationInput = t.object("StormObservationInput", {
  timeMicros: t.i64(),
  lat: t.f64(),
  lon: t.f64(),
  windKt: t.f64(),
  sshs: t.i32(),
});

/** USGS monitoring locations used for river/bayou gage height. */
const gaugeStation = table(
  {
    name: "gauge_station",
    public: true,
  },
  {
    stationId: t.string().primaryKey(),
    name: t.string(),
    lat: t.f64(),
    lon: t.f64(),
    // Approximate demo flood-stage threshold (ft). Not an official NWS stage.
    floodStageFt: t.f64(),
  },
);

const GaugeStationInput = t.object("GaugeStationInput", {
  stationId: t.string(),
  name: t.string(),
  lat: t.f64(),
  lon: t.f64(),
  floodStageFt: t.f64(),
});

/** Hourly USGS gage-height readings (parameter 00065) during Harvey. */
const gaugeReading = table(
  {
    name: "gauge_reading",
    public: true,
    indexes: [
      {
        accessor: "byStationTime",
        algorithm: "btree",
        columns: ["stationId", "timeMicros"],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    stationId: t.string(),
    timeMicros: t.i64(),
    gageHeightFt: t.f64(),
  },
);

const GaugeReadingInput = t.object("GaugeReadingInput", {
  stationId: t.string(),
  timeMicros: t.i64(),
  gageHeightFt: t.f64(),
});

/**
 * Live per-site threat scores recomputed from storm + gauge + historical marks
 * at the current simulation time. Synthetic/modelled scores — not forecasts.
 */
const siteThreat = table(
  {
    name: "site_threat",
    public: true,
    indexes: [
      { accessor: "byLevel", algorithm: "btree", columns: ["level"] },
      { accessor: "byScore", algorithm: "btree", columns: ["threatScore"] },
    ],
  },
  {
    objectId: t.i64().primaryKey(),
    lat: t.f64(),
    lon: t.f64(),
    threatScore: t.f64(),
    // none | watch | advisory | warning | critical
    level: t.string(),
    stormComponent: t.f64(),
    gaugeComponent: t.f64(),
    historicalComponent: t.f64(),
    nearestStationId: t.option(t.string()),
    updatedSimMicros: t.i64(),
  },
);

/**
 * Visual threat regions centered on gauges. Radius grows as stage rises.
 * These are modelled demonstration zones, not official inundation maps.
 */
const threatRegion = table(
  {
    name: "threat_region",
    public: true,
  },
  {
    stationId: t.string().primaryKey(),
    name: t.string(),
    lat: t.f64(),
    lon: t.f64(),
    radiusKm: t.f64(),
    gageHeightFt: t.f64(),
    floodStageFt: t.f64(),
    stageRatio: t.f64(),
    // none | watch | advisory | warning | critical
    level: t.string(),
    updatedSimMicros: t.i64(),
  },
);

const spacetimedb = schema({
  simulationState,
  rescueRequest,
  rescueTeam,
  dispatchAssignment,
  activityEvent,
  floodMark,
  stormObservation,
  gaugeStation,
  gaugeReading,
  siteThreat,
  threatRegion,
});

export default spacetimedb;

type Ctx = Parameters<Parameters<typeof spacetimedb.reducer>[1]>[0];

function logActivity(
  ctx: Ctx,
  kind: string,
  message: string,
  relatedRequestId?: bigint,
  relatedTeamId?: bigint,
) {
  ctx.db.activityEvent.insert({
    id: 0n,
    kind,
    message,
    relatedRequestId,
    relatedTeamId,
    createdAt: ctx.timestamp,
  });
}

/** Transparent deterministic priority: higher = more urgent. */
function computePriorityScore(input: {
  medicalUrgent: boolean;
  stranded: boolean;
  peopleCount: number;
  needsTransport: boolean;
}): number {
  let score = 0;
  if (input.medicalUrgent) score += 1000;
  if (input.stranded) score += 400;
  if (input.needsTransport) score += 150;
  score += Math.min(input.peopleCount, 20) * 10;
  return score;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export const init = spacetimedb.init((ctx) => {
  // Seed one paused Houston simulation + a couple of demo teams.
  ctx.db.simulationState.insert({
    id: 0n,
    regionTag: "houston-harvey",
    // 2017-08-25T00:00:00Z in micros
    simTimeMicros: 1503619200000000n,
    speedMultiplier: 1,
    isPlaying: false,
    updatedAt: ctx.timestamp,
  });

  ctx.db.rescueTeam.insert({
    id: 0n,
    name: "Boat Team Alpha",
    lat: 29.7604,
    lon: -95.3698,
    capacity: 6,
    hasMedical: true,
    hasBoat: true,
    status: "available",
    updatedAt: ctx.timestamp,
  });

  ctx.db.rescueTeam.insert({
    id: 0n,
    name: "Ground Team Bravo",
    lat: 29.7499,
    lon: -95.3584,
    capacity: 4,
    hasMedical: false,
    hasBoat: false,
    status: "available",
    updatedAt: ctx.timestamp,
  });

  logActivity(ctx, "init", "The WaterBoard module initialized with demo teams");
});

export const onConnect = spacetimedb.clientConnected((_ctx) => {});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {});

/**
 * One-time historical import. Inserts only flood marks whose objectId is not
 * already present, so calling it repeatedly is safe and never duplicates rows.
 */
export const seedFloodMarks = spacetimedb.reducer(
  { marks: t.array(FloodMarkInput) },
  (ctx, { marks }) => {
    let inserted = 0;
    for (const m of marks) {
      if (ctx.db.floodMark.objectId.find(m.objectId)) continue;
      ctx.db.floodMark.insert({
        objectId: m.objectId,
        lat: m.lat,
        lon: m.lon,
        elevFt: m.elevFt,
        heightAboveGnd: m.heightAboveGnd,
        waterbody: m.waterbody,
        countyName: m.countyName,
        quality: m.quality,
        label: m.label,
        surveyTimeMicros: m.surveyTimeMicros,
      });
      inserted++;
    }
    if (inserted > 0) {
      logActivity(ctx, "flood", `Seeded ${inserted} historical flood marks`);
    }
  },
);

export const clearFloodMarks = spacetimedb.reducer((ctx) => {
  const ids = [...ctx.db.floodMark.iter()].map((r) => r.objectId);
  for (const id of ids) {
    ctx.db.floodMark.objectId.delete(id);
  }
  if (ids.length > 0) {
    logActivity(ctx, "flood", `Cleared ${ids.length} flood marks`);
  }
});

export const createSimulation = spacetimedb.reducer(
  { regionTag: t.string(), simTimeMicros: t.i64() },
  (ctx, { regionTag, simTimeMicros }) => {
    for (const row of ctx.db.simulationState.iter()) {
      if (row.regionTag === regionTag) {
        throw new SenderError(`Simulation already exists: ${regionTag}`);
      }
    }

    ctx.db.simulationState.insert({
      id: 0n,
      regionTag,
      simTimeMicros,
      speedMultiplier: 1,
      isPlaying: false,
      updatedAt: ctx.timestamp,
    });

    logActivity(ctx, "simulation", `Created simulation ${regionTag}`);
  },
);

export const setSimulationPlaying = spacetimedb.reducer(
  { regionTag: t.string(), isPlaying: t.bool() },
  (ctx, { regionTag, isPlaying }) => {
    const sim = ctx.db.simulationState.regionTag.find(regionTag);
    if (!sim) throw new SenderError(`Simulation not found: ${regionTag}`);

    ctx.db.simulationState.id.update({
      ...sim,
      isPlaying,
      updatedAt: ctx.timestamp,
    });
  },
);

export const setSimulationSpeed = spacetimedb.reducer(
  { regionTag: t.string(), speedMultiplier: t.f64() },
  (ctx, { regionTag, speedMultiplier }) => {
    if (!(speedMultiplier > 0)) {
      throw new SenderError("speedMultiplier must be > 0");
    }

    const sim = ctx.db.simulationState.regionTag.find(regionTag);
    if (!sim) throw new SenderError(`Simulation not found: ${regionTag}`);

    ctx.db.simulationState.id.update({
      ...sim,
      speedMultiplier,
      updatedAt: ctx.timestamp,
    });
  },
);

export const advanceSimulation = spacetimedb.reducer(
  { regionTag: t.string(), deltaMicros: t.i64() },
  (ctx, { regionTag, deltaMicros }) => {
    if (deltaMicros <= 0n) {
      throw new SenderError("deltaMicros must be positive");
    }

    const sim = ctx.db.simulationState.regionTag.find(regionTag);
    if (!sim) throw new SenderError(`Simulation not found: ${regionTag}`);

    ctx.db.simulationState.id.update({
      ...sim,
      simTimeMicros: sim.simTimeMicros + deltaMicros,
      updatedAt: ctx.timestamp,
    });
  },
);

export const resetSimulation = spacetimedb.reducer(
  { regionTag: t.string(), simTimeMicros: t.i64() },
  (ctx, { regionTag, simTimeMicros }) => {
    const sim = ctx.db.simulationState.regionTag.find(regionTag);
    if (!sim) throw new SenderError(`Simulation not found: ${regionTag}`);

    ctx.db.simulationState.id.update({
      ...sim,
      simTimeMicros,
      isPlaying: false,
      speedMultiplier: 1,
      updatedAt: ctx.timestamp,
    });

    logActivity(ctx, "simulation", `Reset simulation ${regionTag}`);
  },
);

export const createRescueRequest = spacetimedb.reducer(
  {
    lat: t.f64(),
    lon: t.f64(),
    peopleCount: t.u32(),
    medicalUrgent: t.bool(),
    stranded: t.bool(),
    needsTransport: t.bool(),
    description: t.string(),
  },
  (ctx, args) => {
    if (args.peopleCount < 1) {
      throw new SenderError("peopleCount must be >= 1");
    }

    const priorityScore = computePriorityScore(args);

    const row = ctx.db.rescueRequest.insert({
      id: 0n,
      lat: args.lat,
      lon: args.lon,
      peopleCount: args.peopleCount,
      medicalUrgent: args.medicalUrgent,
      stranded: args.stranded,
      needsTransport: args.needsTransport,
      description: args.description,
      status: "pending",
      priorityScore,
      createdAt: ctx.timestamp,
      updatedAt: ctx.timestamp,
    });

    logActivity(
      ctx,
      "sos",
      `New SOS #${row.id} priority=${priorityScore}`,
      row.id,
    );
  },
);

export const createRescueTeam = spacetimedb.reducer(
  {
    name: t.string(),
    lat: t.f64(),
    lon: t.f64(),
    capacity: t.u32(),
    hasMedical: t.bool(),
    hasBoat: t.bool(),
  },
  (ctx, args) => {
    if (!args.name.trim()) throw new SenderError("name required");
    if (args.capacity < 1) throw new SenderError("capacity must be >= 1");

    const row = ctx.db.rescueTeam.insert({
      id: 0n,
      name: args.name.trim(),
      lat: args.lat,
      lon: args.lon,
      capacity: args.capacity,
      hasMedical: args.hasMedical,
      hasBoat: args.hasBoat,
      status: "available",
      updatedAt: ctx.timestamp,
    });

    logActivity(ctx, "team", `Created team ${row.name}`, undefined, row.id);
  },
);

export const setTeamStatus = spacetimedb.reducer(
  { teamId: t.u64(), status: t.string() },
  (ctx, { teamId, status }) => {
    if (!["available", "busy", "offline"].includes(status)) {
      throw new SenderError("invalid team status");
    }

    const team = ctx.db.rescueTeam.id.find(teamId);
    if (!team) throw new SenderError("team not found");

    ctx.db.rescueTeam.id.update({
      ...team,
      status,
      updatedAt: ctx.timestamp,
    });
  },
);

/**
 * Recommend an available team for the highest-priority pending request
 * that does not already have an open assignment.
 */
export const recommendDispatch = spacetimedb.reducer((ctx) => {
  const pending = [...ctx.db.rescueRequest.iter()]
    .filter((r) => r.status === "pending")
    .sort((a, b) => b.priorityScore - a.priorityScore);

  if (pending.length === 0) {
    throw new SenderError("no pending requests");
  }

  const openRequestIds = new Set(
    [...ctx.db.dispatchAssignment.iter()]
      .filter((a) => a.status === "recommended" || a.status === "confirmed" || a.status === "en_route")
      .map((a) => a.requestId.toString()),
  );

  const request = pending.find((r) => !openRequestIds.has(r.id.toString()));
  if (!request) throw new SenderError("all pending requests already have assignments");

  const available = [...ctx.db.rescueTeam.iter()].filter(
    (team) => team.status === "available" && team.capacity >= request.peopleCount,
  );

  if (available.length === 0) {
    throw new SenderError("no available team with enough capacity");
  }

  // Prefer medical-capable teams for medical emergencies, then nearest.
  available.sort((a, b) => {
    if (request.medicalUrgent) {
      if (a.hasMedical !== b.hasMedical) return a.hasMedical ? -1 : 1;
    }
    if (request.stranded) {
      if (a.hasBoat !== b.hasBoat) return a.hasBoat ? -1 : 1;
    }
    return (
      haversineKm(a.lat, a.lon, request.lat, request.lon) -
      haversineKm(b.lat, b.lon, request.lat, request.lon)
    );
  });

  const team = available[0];

  ctx.db.dispatchAssignment.insert({
    id: 0n,
    requestId: request.id,
    teamId: team.id,
    status: "recommended",
    createdAt: ctx.timestamp,
    updatedAt: ctx.timestamp,
  });

  ctx.db.rescueRequest.id.update({
    ...request,
    status: "recommended",
    updatedAt: ctx.timestamp,
  });

  logActivity(
    ctx,
    "dispatch",
    `Recommended ${team.name} for SOS #${request.id}`,
    request.id,
    team.id,
  );
});

/** Human dispatcher confirms a recommended assignment. */
export const confirmDispatch = spacetimedb.reducer(
  { assignmentId: t.u64() },
  (ctx, { assignmentId }) => {
    const assignment = ctx.db.dispatchAssignment.id.find(assignmentId);
    if (!assignment) throw new SenderError("assignment not found");
    if (assignment.status !== "recommended") {
      throw new SenderError("only recommended assignments can be confirmed");
    }

    const team = ctx.db.rescueTeam.id.find(assignment.teamId);
    const request = ctx.db.rescueRequest.id.find(assignment.requestId);
    if (!team || !request) throw new SenderError("assignment references missing rows");
    if (team.status !== "available") throw new SenderError("team no longer available");

    ctx.db.dispatchAssignment.id.update({
      ...assignment,
      status: "confirmed",
      updatedAt: ctx.timestamp,
    });

    ctx.db.rescueTeam.id.update({
      ...team,
      status: "busy",
      updatedAt: ctx.timestamp,
    });

    ctx.db.rescueRequest.id.update({
      ...request,
      status: "assigned",
      updatedAt: ctx.timestamp,
    });

    logActivity(
      ctx,
      "dispatch",
      `Confirmed dispatch of ${team.name} to SOS #${request.id}`,
      request.id,
      team.id,
    );
  },
);

export const seedStormTrack = spacetimedb.reducer(
  { points: t.array(StormObservationInput) },
  (ctx, { points }) => {
    if ([...ctx.db.stormObservation.iter()].length > 0) {
      // Already seeded — keep idempotent for demos.
      return;
    }
    for (const p of points) {
      ctx.db.stormObservation.insert({
        id: 0n,
        timeMicros: p.timeMicros,
        lat: p.lat,
        lon: p.lon,
        windKt: p.windKt,
        sshs: p.sshs,
      });
    }
    logActivity(ctx, "storm", `Seeded ${points.length} storm track points`);
  },
);

export const seedGaugeStations = spacetimedb.reducer(
  { stations: t.array(GaugeStationInput) },
  (ctx, { stations }) => {
    let inserted = 0;
    let updated = 0;
    for (const s of stations) {
      const existing = ctx.db.gaugeStation.stationId.find(s.stationId);
      if (existing) {
        ctx.db.gaugeStation.stationId.update({
          ...existing,
          name: s.name,
          lat: s.lat,
          lon: s.lon,
          floodStageFt: s.floodStageFt,
        });
        updated++;
        continue;
      }
      ctx.db.gaugeStation.insert({
        stationId: s.stationId,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        floodStageFt: s.floodStageFt,
      });
      inserted++;
    }
    if (inserted > 0 || updated > 0) {
      logActivity(
        ctx,
        "gauge",
        `Gauge stations inserted=${inserted} updated=${updated}`,
      );
    }
  },
);

export const seedGaugeReadings = spacetimedb.reducer(
  { readings: t.array(GaugeReadingInput) },
  (ctx, { readings }) => {
    if ([...ctx.db.gaugeReading.iter()].length > 0) return;
    for (const r of readings) {
      ctx.db.gaugeReading.insert({
        id: 0n,
        stationId: r.stationId,
        timeMicros: r.timeMicros,
        gageHeightFt: r.gageHeightFt,
      });
    }
    logActivity(ctx, "gauge", `Seeded ${readings.length} USGS gage readings`);
  },
);

function levelFromScore(score: number): string {
  if (score >= 75) return "critical";
  if (score >= 55) return "warning";
  if (score >= 35) return "advisory";
  if (score >= 15) return "watch";
  return "none";
}

/** Gauge-region levels keyed off stage ratio (1.0 = flood stage). */
function levelFromStageRatio(ratio: number): string {
  if (ratio >= 1.05) return "critical";
  if (ratio >= 0.9) return "warning";
  if (ratio >= 0.75) return "advisory";
  if (ratio >= 0.5) return "watch";
  return "none";
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Recompute live flooding threat from:
 *  1) hurricane proximity + wind (storm CSV)
 *  2) USGS gage height vs flood-stage (Water Data API)
 *  3) historical high-water mark confirmation (flood CSV)
 *
 * Transparent weighted score for demo / State Farm prioritization context.
 * Not a hydrologic forecast.
 */
export const recomputeThreats = spacetimedb.reducer(
  { regionTag: t.string() },
  (ctx, { regionTag }) => {
    const sim = ctx.db.simulationState.regionTag.find(regionTag);
    if (!sim) throw new SenderError(`Simulation not found: ${regionTag}`);
    const T = sim.simTimeMicros;

    const track = [...ctx.db.stormObservation.iter()].sort((a, b) =>
      a.timeMicros < b.timeMicros ? -1 : a.timeMicros > b.timeMicros ? 1 : 0,
    );
    let storm = track.length ? track[0] : undefined;
    for (const p of track) {
      if (p.timeMicros <= T) storm = p;
      else break;
    }

    const stations = [...ctx.db.gaugeStation.iter()];
    const readingsByStation = new Map<string, { timeMicros: bigint; gageHeightFt: number }[]>();
    for (const r of ctx.db.gaugeReading.iter()) {
      const list = readingsByStation.get(r.stationId) ?? [];
      list.push({ timeMicros: r.timeMicros, gageHeightFt: r.gageHeightFt });
      readingsByStation.set(r.stationId, list);
    }
    for (const list of readingsByStation.values()) {
      list.sort((a, b) =>
        a.timeMicros < b.timeMicros ? -1 : a.timeMicros > b.timeMicros ? 1 : 0,
      );
    }

    function readingAt(stationId: string): number | undefined {
      const list = readingsByStation.get(stationId);
      if (!list || list.length === 0) return undefined;
      let best: number | undefined;
      for (const r of list) {
        if (r.timeMicros <= T) best = r.gageHeightFt;
        else break;
      }
      return best;
    }

    // --- Gauge-centered threat regions (visual "live flood" zones) ---
    for (const station of stations) {
      const height = readingAt(station.stationId) ?? 0;
      const ratio = station.floodStageFt > 0 ? height / station.floodStageFt : 0;
      const over = Math.max(0, ratio - 0.6);
      const radiusKm = 2 + over * 18;
      const level = levelFromStageRatio(ratio);

      const existing = ctx.db.threatRegion.stationId.find(station.stationId);
      const row = {
        stationId: station.stationId,
        name: station.name,
        lat: station.lat,
        lon: station.lon,
        radiusKm,
        gageHeightFt: height,
        floodStageFt: station.floodStageFt,
        stageRatio: ratio,
        level,
        updatedSimMicros: T,
      };
      if (existing) ctx.db.threatRegion.stationId.update(row);
      else ctx.db.threatRegion.insert(row);
    }

    // --- Per flood-mark threat scores ---
    const marks = [...ctx.db.floodMark.iter()];
    for (const mark of marks) {
      let stormComponent = 0;
      if (storm) {
        const dist = haversineKm(mark.lat, mark.lon, storm.lat, storm.lon);
        const windNorm = clamp01(storm.windKt / 130);
        const prox = Math.exp(-dist / 90);
        stormComponent = 100 * windNorm * prox;
      }

      let gaugeComponent = 0;
      let nearestStationId: string | undefined;
      let nearestDist = Number.POSITIVE_INFINITY;
      for (const station of stations) {
        const dist = haversineKm(mark.lat, mark.lon, station.lat, station.lon);
        const height = readingAt(station.stationId);
        if (height === undefined) continue;
        const ratio = clamp01(height / station.floodStageFt);
        const prox = Math.exp(-dist / 25);
        const contrib = 100 * ratio * prox;
        if (contrib > gaugeComponent) {
          gaugeComponent = contrib;
          nearestStationId = station.stationId;
          nearestDist = dist;
        } else if (dist < nearestDist) {
          nearestDist = dist;
          nearestStationId = station.stationId;
        }
      }

      let historicalComponent = 0;
      if (mark.surveyTimeMicros !== undefined && mark.surveyTimeMicros <= T) {
        const hag = mark.heightAboveGnd ?? 0;
        historicalComponent = 20 + clamp01(hag / 8) * 20;
      }

      const threatScore =
        0.4 * stormComponent + 0.45 * gaugeComponent + 0.15 * historicalComponent;
      const level = levelFromScore(threatScore);

      const existing = ctx.db.siteThreat.objectId.find(mark.objectId);
      const row = {
        objectId: mark.objectId,
        lat: mark.lat,
        lon: mark.lon,
        threatScore,
        level,
        stormComponent,
        gaugeComponent,
        historicalComponent,
        nearestStationId,
        updatedSimMicros: T,
      };
      if (existing) ctx.db.siteThreat.objectId.update(row);
      else ctx.db.siteThreat.insert(row);
    }

    logActivity(
      ctx,
      "threat",
      `Recomputed threats at sim micros ${T} (${marks.length} sites, ${stations.length} regions)`,
    );
  },
);
