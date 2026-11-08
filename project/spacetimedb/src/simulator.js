export const MODEL = 'historical-proximity-screening-v1';

export function distanceKm(a, b) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) *
    Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Screening only: historical points are context, not predicted inundation.
// Replace this pure function when a calibrated hydrological model is available.
export function simulate(input, floods) {
  const points = floods.map(row => ({ ...row, distanceKm: distanceKm(input, row) }))
    .filter(row => row.distanceKm <= input.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return {
    model: MODEL,
    description: 'Historical flood observations near the scenario. This model does not predict flood depth or extent.',
    rainfallIntensityMmPerHour: input.rainfallMm / input.durationHours,
    rainfallVolumeM3: input.rainfallMm / 1000 * Math.PI * (input.radiusKm * 1000) ** 2,
    matchedRecords: points.length,
    points,
  };
}
