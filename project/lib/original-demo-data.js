import { parseCsvRows } from "./csv.js";

// Project only the added demo columns; historical flood observations stay intact.
export function projectDemoCsv(text, kind, columns) {
  const [headers = [], ...rows] = parseCsvRows(text);
  const indices = columns.map((column) => headers.indexOf(`demo_${kind}_${column}`));
  const sourceIndex = headers.indexOf("demo_data_source");
  if (sourceIndex < 0 || indices.includes(-1)) throw new Error("Original CSV is missing demo columns");
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns, ...rows.filter((row) => row[sourceIndex] === "fictional_demo" && row[indices[0]])
    .map((row) => indices.map((i) => row[i]))]
    .map((row) => row.map(quote).join(",")).join("\n");
}

export async function loadOriginalDemoCsv(kind, columns) {
  const response = await fetch("/api/demo-data", { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load original CSV: ${response.status}`);
  return projectDemoCsv(await response.text(), kind, columns);
}
