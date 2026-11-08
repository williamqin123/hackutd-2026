import { loadOriginalDemoCsv } from "./original-demo-data.js";
import { parseCsvRows } from "./csv.js";

export function parseDemoSos(text, now = Date.now()) {
  const [headers = [], ...rows] = parseCsvRows(text);
  const required = ["id", "lat", "lon", "peopleCount", "medicalUrgent", "stranded", "needsTransport", "waitMinutes", "description"];
  if (required.some((key) => !headers.includes(key))) throw new Error("Missing SOS CSV columns");
  const ids = new Set();
  return rows.map((values, index) => {
    const row = Object.fromEntries(headers.map((key, i) => [key, values[i]]));
    const lat = Number(row.lat), lon = Number(row.lon);
    const peopleCount = Number(row.peopleCount), waitMinutes = Number(row.waitMinutes);
    if (values.length !== headers.length || required.some((key) => !row[key]) || ids.has(row.id) ||
        !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180 ||
        !Number.isSafeInteger(peopleCount) || peopleCount < 1 ||
        !Number.isSafeInteger(waitMinutes) || waitMinutes < 0 ||
        [row.medicalUrgent, row.stranded, row.needsTransport].some((v) => !["true", "false"].includes(v))) {
      throw new Error(`Invalid SOS CSV row ${index + 2}`);
    }
    ids.add(row.id);
    const medicalUrgent = row.medicalUrgent === "true", stranded = row.stranded === "true";
    const needsTransport = row.needsTransport === "true";
    return {
      id: `demo-${row.id}`, lat, lon, peopleCount, medicalUrgent, stranded, needsTransport,
      description: row.description, status: "pending", isDemo: true,
      priorityScore: (medicalUrgent ? 1000 : 0) + (stranded ? 400 : 0) + (needsTransport ? 150 : 0) + Math.min(peopleCount, 20) * 10,
      createdAt: { microsSinceUnixEpoch: BigInt(now - waitMinutes * 60000) * 1000n },
    };
  });
}

export async function loadDemoSos() {
  const columns = ["id", "lat", "lon", "peopleCount", "medicalUrgent", "stranded", "needsTransport", "waitMinutes", "description"];
  return parseDemoSos(await loadOriginalDemoCsv("sos", columns));
}
