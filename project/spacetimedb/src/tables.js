import { schema, table, t } from 'spacetimedb/server';

export const floodFields = {
  id: t.string().primaryKey(), latitude: t.f64(), longitude: t.f64(),
  eventName: t.string(), observedAt: t.string(), waterbody: t.string(),
  heightAboveGroundFt: t.string(), source: t.string(),
};
export const floodInput = t.object('FloodInput', {
  id: t.string(), latitude: t.f64(), longitude: t.f64(),
  eventName: t.string(), observedAt: t.string(), waterbody: t.string(),
  heightAboveGroundFt: t.string(), source: t.string(),
});
const floods = table({ name: 'floods', public: true }, floodFields);
const developers = table({ name: 'developers' }, { identity: t.identity().primaryKey() });
const simulations = table({ name: 'simulations' }, {
  id: t.string().primaryKey(), owner: t.identity(),
  latitude: t.f64(), longitude: t.f64(), rainfallMm: t.f64(),
  durationHours: t.f64(), radiusKm: t.f64(), status: t.string(),
  createdAt: t.string(), completedAt: t.string(), error: t.string(),
});
const simulationResults = table({ name: 'simulation_results' }, {
  simulationId: t.string().primaryKey(), data: t.string(),
});
export const simulationJobs = table({ name: 'simulation_jobs' }, {
  id: t.u64().primaryKey().autoInc(), scheduledAt: t.scheduleAt(), simulationId: t.string(),
});
export default schema({ floods, developers, simulations, simulationResults, simulationJobs });
