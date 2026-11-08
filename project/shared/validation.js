export function validateSimulation(input) {
  const fields = {
    latitude: [-90, 90], longitude: [-180, 180],
    rainfallMm: [0, 2000], durationHours: [0.01, 168], radiusKm: [0.1, 100],
  };
  const result = {};
  for (const [field, [min, max]] of Object.entries(fields)) {
    const raw = input[field];
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!['number', 'string'].includes(typeof raw) || String(raw).trim() === '' ||
        !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${field} must be between ${min} and ${max}.`);
    }
    result[field] = value;
  }
  return result;
}

export function validateFlood(row) {
  if (!row.id || typeof row.id !== 'string') throw new Error('Flood record requires a source ID.');
  if (!Number.isFinite(row.latitude) || Math.abs(row.latitude) > 90 ||
      !Number.isFinite(row.longitude) || Math.abs(row.longitude) > 180) {
    throw new Error(`Invalid coordinates for flood ${row.id}.`);
  }
  return row;
}
