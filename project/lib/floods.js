import Papa from "papaparse";

// Served from project/public. This is the real Harvey high-water-mark file.
const CSV_URL = "/harvey_2017_houston_harris_flood_marks.csv";

function toNumber(value) {
  const text = (value ?? "").toString().trim();
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function toText(value) {
  const text = (value ?? "").toString().trim();
  return text ? text : undefined;
}

function toBigInt(value) {
  const text = (value ?? "").toString().trim();
  if (!text) return undefined;
  try {
    return BigInt(text);
  } catch {
    return undefined;
  }
}

/**
 * Fetch and parse the historical flood-mark CSV into a slim list of objects
 * that match the `seedFloodMarks` reducer's FloodMarkInput shape.
 * Rows missing an id or coordinates are skipped; duplicate ids are de-duped.
 */
export async function loadFloodMarks() {
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to load flood CSV: ${response.status}`);
  }

  const text = await response.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0].message);
  }

  const marks = [];
  const seen = new Set();

  for (const row of parsed.data) {
    const objectId = toBigInt(row.OBJECTID);
    const lat = toNumber(row.latitude_dd);
    const lon = toNumber(row.longitude_dd);
    if (objectId === undefined || lat === undefined || lon === undefined) {
      continue;
    }

    const key = objectId.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    // The SurveyDate column holds milliseconds since the Unix epoch.
    const ms = toBigInt(row.SurveyDate);
    const surveyTimeMicros = ms === undefined ? undefined : ms * 1000n;

    marks.push({
      objectId,
      lat,
      lon,
      elevFt: toNumber(row.elev_ft),
      heightAboveGnd: toNumber(row.height_above_gnd),
      waterbody: toText(row.waterbody),
      countyName: toText(row.countyName),
      quality: toText(row.hwmQualityName),
      label: toText(row.hwm_label) ?? toText(row.siteDescription),
      surveyTimeMicros,
    });
  }

  return marks;
}
