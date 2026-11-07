import { schema, table, t } from "spacetimedb/server";
import { TimeDuration, Timestamp } from "spacetimedb";

const spacetimedb = schema({
  simulationState: table(
    { public: true },
    {
      regionTag: t.string(),
      historicalStartTs: t.timestamp(),
      lastPlayedTs: t.timestamp(),
      elapsedDur: t.timeDuration(),
      isPlaying: t.bool(),
    },
  ),
});

export default spacetimedb;

// Find a simulation by region tag
function findSimulation(
  ctx: Parameters<Parameters<typeof spacetimedb.reducer>[1]>[0],
  regionTag: string,
) {
  for (const sim of ctx.db.simulationState.iter()) {
    if (sim.regionTag === regionTag) {
      return sim;
    }
  }
  return undefined;
}

// Create a simulation (initially paused)
export const createSimulation = spacetimedb.reducer(
  {
    regionTag: t.string(),
    historicalStartTs: t.timestamp(),
  },
  (ctx, { regionTag, historicalStartTs }) => {
    if (findSimulation(ctx, regionTag)) {
      throw new Error(`Simulation ${regionTag} already exists`);
    }

    ctx.db.simulationState.insert({
      regionTag,
      historicalStartTs,
      lastPlayedTs: ctx.timestamp,
      elapsedDur: new TimeDuration(0n),
      isPlaying: false,
    });
  },
);

// Play or resume a simulation
export const playSimulation = spacetimedb.reducer(
  { regionTag: t.string() },
  (ctx, { regionTag }) => {
    const sim = findSimulation(ctx, regionTag);

    if (!sim) {
      throw new Error(`Simulation ${regionTag} not found`);
    }

    if (sim.isPlaying) return;

    ctx.db.simulationState.delete(sim);

    ctx.db.simulationState.insert({
      ...sim,
      lastPlayedTs: ctx.timestamp,
      isPlaying: true,
    });
  },
);

// Pause a simulation
export const pauseSimulation = spacetimedb.reducer(
  { regionTag: t.string() },
  (ctx, { regionTag }) => {
    const sim = findSimulation(ctx, regionTag);

    if (!sim) {
      throw new Error(`Simulation ${regionTag} not found`);
    }

    if (!sim.isPlaying) return;

    const elapsedMicros =
      ctx.timestamp.microsSinceUnixEpoch -
      sim.lastPlayedTs.microsSinceUnixEpoch;

    const totalMicros = sim.elapsedDur.micros + elapsedMicros;

    ctx.db.simulationState.delete(sim);

    ctx.db.simulationState.insert({
      ...sim,
      elapsedDur: new TimeDuration(totalMicros),
      isPlaying: false,
    });
  },
);

// Delete a simulation
export const deleteSimulation = spacetimedb.reducer(
  { regionTag: t.string() },
  (ctx, { regionTag }) => {
    const sim = findSimulation(ctx, regionTag);

    if (!sim) {
      throw new Error(`Simulation ${regionTag} not found`);
    }

    ctx.db.simulationState.delete(sim);
  },
);

export const init = spacetimedb.init((_ctx) => {});

export const onConnect = spacetimedb.clientConnected((_ctx) => {});

export const onDisconnect = spacetimedb.clientDisconnected((_ctx) => {});
