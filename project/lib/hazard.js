/**
 * Load historical storm track + USGS gage series prepared for The WaterBoard.
 * USGS JSON was fetched from:
 *   https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items
 * for Houston-area stations (param 00065 gage height) during Harvey.
 */

export async function loadStormTrack() {
  const response = await fetch("/harvey_storm_track.json");
  if (!response.ok) throw new Error(`storm track HTTP ${response.status}`);
  const data = await response.json();
  return (data.points ?? []).map((p) => ({
    timeMicros: BigInt(p.timeMicros),
    lat: p.lat,
    lon: p.lon,
    windKt: p.windKt,
    sshs: p.sshs,
  }));
}

export async function loadUsgsGauges() {
  const response = await fetch("/usgs_harvey_gauges.json");
  if (!response.ok) throw new Error(`usgs gauges HTTP ${response.status}`);
  const data = await response.json();

  const stations = (data.stations ?? []).map((s) => ({
    stationId: s.stationId,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    floodStageFt: s.floodStageFt,
  }));

  const readings = (data.readings ?? []).map((r) => ({
    stationId: r.stationId,
    timeMicros: BigInt(r.timeMicros),
    gageHeightFt: r.gageHeightFt,
  }));

  return { stations, readings, meta: { api: data.api, range: data.datetimeRange, note: data.note } };
}
