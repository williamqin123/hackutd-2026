import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FALLBACKS = [
  { description: "Family stranded on the roof, water still rising around the house.", medicalUrgent: false, stranded: true, needsTransport: true, peopleCount: 4 },
  { description: "Elderly neighbor needs oxygen and cannot get down from the second floor.", medicalUrgent: true, stranded: true, needsTransport: true, peopleCount: 2 },
  { description: "Two adults and a child stuck in a car on a flooded side street.", medicalUrgent: false, stranded: true, needsTransport: true, peopleCount: 3 },
  { description: "Chest pain, we are in the attic and the stairs are underwater.", medicalUrgent: true, stranded: true, needsTransport: true, peopleCount: 1 },
  { description: "Group waiting on the second floor with no way to leave the block.", medicalUrgent: false, stranded: true, needsTransport: true, peopleCount: 5 },
];

function fallbackMessages(count) {
  return Array.from({ length: count }, (_, index) => ({ ...FALLBACKS[index % FALLBACKS.length] }));
}

function clampPeople(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(8, Math.round(n)));
}

function normalizeMessage(raw, fallback) {
  const source = raw && typeof raw === "object" ? raw : {};
  const description = String(source.description || source.summary || fallback.description).trim().slice(0, 280);
  return {
    description: description || fallback.description,
    medicalUrgent: Boolean(source.medicalUrgent),
    stranded: source.stranded === undefined ? true : Boolean(source.stranded),
    needsTransport: source.needsTransport === undefined ? true : Boolean(source.needsTransport),
    peopleCount: clampPeople(source.peopleCount ?? fallback.peopleCount),
  };
}

function parseModelJson(text) {
  const trimmed = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  const slice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  const parsed = JSON.parse(slice);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const count = Math.max(1, Math.min(5, Number(body.count) || 1));
  const anchors = Array.isArray(body.anchors) ? body.anchors.slice(0, count) : [];
  const key = process.env.OPENROUTER_API_KEY?.trim();
  const fallback = fallbackMessages(count);

  if (!key) {
    return NextResponse.json({
      messages: fallback,
      source: "fallback",
      warning: "OPENROUTER_API_KEY is not set",
    });
  }

  const places = anchors.map((anchor, index) => (
    `${index + 1}. ${anchor?.name || "Houston"} (${anchor?.level || "area"})`
  )).join("\n");

  const model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash";

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "The WaterBoard",
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content: "You write short, distinct Hurricane Harvey flood SOS texts for a Houston rescue demo. Return ONLY a JSON array. Each item: {\"description\":string,\"medicalUrgent\":boolean,\"stranded\":boolean,\"needsTransport\":boolean,\"peopleCount\":number}. peopleCount is 1-6. Do not include coordinates. No markdown.",
          },
          {
            role: "user",
            content: `Write ${count} different SOS messages for these Houston places during Harvey flooding:\n${places || "Greater Houston"}\nVary injuries, families, and how trapped they are.`,
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.error || response.statusText;
      return NextResponse.json({
        messages: fallback,
        source: "fallback",
        warning: `OpenRouter error: ${detail}`,
      });
    }

    const text = payload?.choices?.[0]?.message?.content || "";
    const parsed = parseModelJson(text);
    const messages = fallback.map((item, index) => normalizeMessage(parsed[index], item));
    return NextResponse.json({ messages, source: "openrouter" });
  } catch (error) {
    return NextResponse.json({
      messages: fallback,
      source: "fallback",
      warning: error instanceof Error ? error.message : "OpenRouter request failed",
    });
  }
}
