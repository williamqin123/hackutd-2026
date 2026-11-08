import Papa from 'papaparse';
import { callSpacetime } from './spacetime.js';
import { validateFlood } from '../shared/validation.js';

export const CSV_PATH = '/harvey_2017_houston_harris_flood_marks.csv';
export const getFloods = options => callSpacetime('get_floods', [], options);

export function parseFloodCsv(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  const seen = new Set();
  return parsed.data.map(row => {
    const source = 'harvey-2017-harris';
    const id = row.OBJECTID?.trim();
    if (!id || seen.has(id)) throw new Error(`Missing or duplicate CSV ID: ${id || '(empty)'}`);
    seen.add(id);
    if (!row.latitude_dd?.trim() || !row.longitude_dd?.trim()) throw new Error(`Missing coordinates for ${id}.`);
    const timestamp = row.SurveyDate?.trim();
    let observedAt = timestamp || '';
    if (timestamp && /^\d+$/.test(timestamp)) {
      const date = new Date(Number(timestamp));
      if (Number.isNaN(date.getTime())) throw new Error(`Invalid observation date for ${id}.`);
      observedAt = date.toISOString();
    }
    return validateFlood({
      id: `${source}:${id}`, latitude: Number(row.latitude_dd), longitude: Number(row.longitude_dd),
      eventName: row.eventName || '', observedAt, waterbody: row.waterbody || '',
      heightAboveGroundFt: row.height_above_gnd?.trim() || '', source,
    });
  });
}

export async function importSampleFloods(onProgress = () => {}) {
  const response = await fetch(CSV_PATH);
  if (!response.ok) throw new Error('Could not load the sample CSV.');
  const rows = parseFloodCsv(await response.text());
  for (let index = 0; index < rows.length; index += 100) {
    await callSpacetime('import_floods', [rows.slice(index, index + 100)], { developer: true });
    onProgress(Math.min(index + 100, rows.length), rows.length);
  }
  return rows.length;
}
