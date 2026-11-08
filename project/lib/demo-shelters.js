import { parseCsvRows } from "./csv.js";
import { loadOriginalDemoCsv } from "./original-demo-data.js";

export function parseSheltersCsv(text) {
  const rows = parseCsvRows(text);
  const headers = rows.shift() ?? [];
  const columns = ["id", "name", "capacity", "occupied"].map((key) => headers.indexOf(key));
  if (columns.includes(-1)) throw new Error("Shelter CSV requires id, name, capacity, occupied columns");
  const ids = new Set();
  return rows.map((values, index) => {
    const [id, name, rawCapacity, rawOccupied] = columns.map((column) => values[column]);
    const capacity = Number(rawCapacity), occupied = Number(rawOccupied);
    if (values.length !== headers.length || !id || !name || ids.has(id) ||
        !rawCapacity || !rawOccupied || !Number.isSafeInteger(capacity) || capacity <= 0 ||
        !Number.isSafeInteger(occupied) || occupied < 0 || occupied > capacity) {
      throw new Error(`Invalid shelter CSV row ${index + 2}`);
    }
    ids.add(id);
    return { id, name, capacity, occupied };
  });
}

export async function loadDemoShelters() {
  return parseSheltersCsv(await loadOriginalDemoCsv("shelter", ["id", "name", "capacity", "occupied"]));
}
