import { t } from 'spacetimedb/server';
import db, { floodInput, simulationJobs } from './tables.js';
import { isDeveloper, requireDeveloper } from './access.js';
import { importFloodRecords } from './floods.js';
import { startSimulation, runSimulation } from './simulations.js';

export default db;
export const init = db.init(ctx => {
  ctx.db.developers.insert({ identity: ctx.sender });
});
export const importFloods = db.reducer({ name: 'import_floods' }, { rows: t.array(floodInput) }, (ctx, { rows }) => {
  requireDeveloper(ctx);
  importFloodRecords(ctx, rows);
});
export const getFloods = db.procedure({ name: 'get_floods' }, {}, t.string(), ctx =>
  ctx.withTx(tx => JSON.stringify([...tx.db.floods.iter()]))
);
export const createSimulation = db.reducer({ name: 'create_simulation' }, {
  id: t.string(), latitude: t.f64(), longitude: t.f64(),
  rainfallMm: t.f64(), durationHours: t.f64(), radiusKm: t.f64(),
}, (ctx, input) => {
  requireDeveloper(ctx);
  startSimulation(ctx, input);
});
export const processSimulation = db.reducer(
  { name: 'process_simulation', onSchedule: simulationJobs },
  { job: simulationJobs.rowType },
  (ctx, { job }) => {
    if (!ctx.sender.equals(ctx.identity)) throw new Error('Scheduled calls only.');
    runSimulation(ctx, job.simulationId);
  },
);
export const getSimulation = db.procedure({ name: 'get_simulation' }, { id: t.string() }, t.string(), (ctx, { id }) =>
  ctx.withTx(tx => {
    if (!isDeveloper(tx)) return JSON.stringify({ error: 'Developer access required. Use an authorized Spacetime identity token.' });
    const row = tx.db.simulations.id.find(id);
    if (!row) return 'null';
    const result = tx.db.simulationResults.simulationId.find(id);
    return JSON.stringify({ ...row, owner: row.owner.toHexString(), result: result ? JSON.parse(result.data) : null });
  })
);
