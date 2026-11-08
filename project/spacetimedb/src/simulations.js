import { ScheduleAt } from 'spacetimedb';
import { validateSimulation } from '../../shared/validation.js';
import { simulate } from './simulator.js';

export function startSimulation(ctx, { id, ...input }) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid simulation ID.');
  const values = validateSimulation(input);
  const existing = ctx.db.simulations.id.find(id);
  if (existing) {
    if (!existing.owner.equals(ctx.sender) || Object.keys(values).some(key => existing[key] !== values[key])) {
      throw new Error('Simulation ID is already in use.');
    }
    return;
  }
  ctx.db.simulations.insert({
    id, owner: ctx.sender, ...values, status: 'queued',
    createdAt: ctx.timestamp.toDate().toISOString(), completedAt: '', error: '',
  });
  ctx.db.simulationJobs.insert({
    id: 0n, simulationId: id,
    scheduledAt: ScheduleAt.time(ctx.timestamp.microsSinceUnixEpoch),
  });
}

export function runSimulation(ctx, id) {
  const row = ctx.db.simulations.id.find(id);
  if (!row || row.status !== 'queued') return;
  try {
    const result = simulate(row, [...ctx.db.floods.iter()]);
    ctx.db.simulationResults.insert({ simulationId: id, data: JSON.stringify(result) });
    ctx.db.simulations.id.update({ ...row, status: 'completed', completedAt: ctx.timestamp.toDate().toISOString() });
  } catch (error) {
    ctx.db.simulations.id.update({ ...row, status: 'failed', error: String(error), completedAt: ctx.timestamp.toDate().toISOString() });
  }
}
