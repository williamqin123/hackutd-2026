/** Neighborhood bases so generated SOS are not stacked on downtown. */
export const HOUSTON_ANCHORS = [
  { name: "Downtown", lat: 29.7604, lon: -95.3698 },
  { name: "Meyerland", lat: 29.6741, lon: -95.4678 },
  { name: "Cypress", lat: 29.9691, lon: -95.6972 },
  { name: "Greenspoint", lat: 29.9167, lon: -95.4089 },
  { name: "Kingwood", lat: 30.0505, lon: -95.1847 },
  { name: "Memorial", lat: 29.7628, lon: -95.5342 },
  { name: "Heights", lat: 29.7997, lon: -95.3982 },
  { name: "Addicks", lat: 29.7858, lon: -95.7725 },
  { name: "Bellaire", lat: 29.7058, lon: -95.4588 },
  { name: "Pasadena", lat: 29.6911, lon: -95.2091 },
  { name: "Baytown", lat: 29.7355, lon: -94.9774 },
  { name: "Humble", lat: 29.9988, lon: -95.2622 },
  { name: "Spring Branch", lat: 29.8055, lon: -95.5133 },
  { name: "Galleria", lat: 29.739, lon: -95.461 },
  { name: "Hobby", lat: 29.645, lon: -95.278 },
];

function jitter(lat, lon, km) {
  const dLat = (Math.random() - 0.5) * (km / 111);
  const dLon = (Math.random() - 0.5) * (km / (111 * Math.cos((lat * Math.PI) / 180)));
  return {
    lat: Math.round((lat + dLat) * 1e5) / 1e5,
    lon: Math.round((lon + dLon) * 1e5) / 1e5,
  };
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Prefer hot gages, then fill from neighborhoods so pins spread across Houston. */
export function pickSosAnchors(threatRegions = [], count = 1) {
  const hot = (threatRegions || []).filter((region) =>
    region &&
    Number.isFinite(region.lat) &&
    Number.isFinite(region.lon) &&
    (region.level === "critical" || region.level === "warning" || region.level === "advisory"),
  );
  const hotBases = shuffle(hot).map((region) => ({
    name: region.name || "Flood gage",
    lat: region.lat,
    lon: region.lon,
    level: region.level,
  }));
  const neighborhoods = shuffle(HOUSTON_ANCHORS);
  const bases = [];
  for (let i = 0; i < count; i += 1) {
    if (i < hotBases.length) bases.push(hotBases[i]);
    else bases.push(neighborhoods[(i - hotBases.length) % neighborhoods.length]);
  }
  return bases.slice(0, count).map((base) => {
    const spreadKm = base.level ? 3.2 : 2.2;
    const point = jitter(base.lat, base.lon, spreadKm);
    return { name: base.name, level: base.level || "neighborhood", ...point };
  });
}
