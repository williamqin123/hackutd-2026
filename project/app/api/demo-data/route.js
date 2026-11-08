import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const csv = await readFile(path.resolve(process.cwd(), "../../../harvey_2017_houston_harris_flood_marks.csv"), "utf8");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Original flood-mark CSV could not be read" }, { status: 500 });
  }
}
