/**
 * Load historical Harvey high-water marks prepared for WaterBoard.
 * Source extract lives at public/harvey_flood_marks.json (converted from the
 * original USGS high-water-mark CSV; no CSV is shipped in the repo).
 */

const JSON_URL = "/harvey_flood_marks.json";

/**
 * Returns objects shaped for the `seedFloodMarks` reducer.
 */
export async function loadFloodMarks() {
  const response = await fetch(JSON_URL);
  if (!response.ok) {
    throw new Error(`Failed to load flood marks: ${response.status}`);
  }

  const data = await response.json();
  const marks = [];
  const seen = new Set();

  for (const row of data.marks ?? []) {
    if (row.objectId == null || row.lat == null || row.lon == null) continue;
    const objectId = BigInt(row.objectId);
    const key = objectId.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    marks.push({
      objectId,
      lat: Number(row.lat),
      lon: Number(row.lon),
      elevFt: row.elevFt == null ? undefined : Number(row.elevFt),
      heightAboveGnd:
        row.heightAboveGnd == null ? undefined : Number(row.heightAboveGnd),
      waterbody: row.waterbody ?? undefined,
      countyName: row.countyName ?? undefined,
      quality: row.quality ?? undefined,
      label: row.label ?? undefined,
      surveyTimeMicros:
        row.surveyTimeMicros == null
          ? undefined
          : BigInt(row.surveyTimeMicros),
    });
  }

  return marks;
}
