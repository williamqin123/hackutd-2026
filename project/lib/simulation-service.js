import { callSpacetime } from './spacetime.js';
import { validateSimulation } from '../shared/validation.js';

export async function createSimulation(input) {
  const values = validateSimulation(input);
  const id = crypto.randomUUID();
  await callSpacetime('create_simulation', [id, values.latitude, values.longitude,
    values.rainfallMm, values.durationHours, values.radiusKm], { developer: true });
  return id;
}

export function getSimulation(id, options = {}) {
  return callSpacetime('get_simulation', [id], { ...options, developer: true });
}
