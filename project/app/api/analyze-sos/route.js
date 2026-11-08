import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You extract Hurricane Harvey flood SOS urgency flags from a victim message.
Return ONLY valid JSON with this shape:
{"medicalUrgent":boolean,"stranded":boolean,"needsTransport":boolean,"peopleCount":number,"summary":string}
Rules:
- medicalUrgent: injuries, oxygen, illness, hospital, medical care needed
- stranded: trapped, roof, attic, rising water, cannot leave
- needsTransport: needs boat/vehicle/evacuation lift
- peopleCount: integer 1–50 (default 1 if unclear)
- summary: one short sentence
Do not invent facts not implied by the text.`;

function heuristicFallback(text, tags = []) {
  const target = `${tags.join(" ")} ${text}`.trim();
  const medicalUrgent =
    /medic|doctor|injur|oxygen|hospital|sick|ambulance|bleed|heart|diabet/i.test(
      target,
    );
  const stranded =
    /strand|trap|roof|attic|water rising|stuck|second floor|flooded/i.test(
      target,
    );
  const needsTransport =
    /boat|evac|transport|rescue|pickup|cannot walk|wheelchair/i.test(target);
  let peopleCount = 1;
  const peopleMatch = target.match(
    /(\d+)\s*(?:people|persons|adults|kids|children|family members)/i,
  );
  if (peopleMatch) {
    const p = parseInt(peopleMatch[1], 10);
    if (!Number.isNaN(p) && p >= 1 && p <= 50) peopleCount = p;
  }
  return {
    medicalUrgent,
    stranded,
    needsTransport,
    peopleCount,
    summary: text.slice(0, 140) || "SOS distress",
    source: "heuristic",
  };
}

function normalizeFlags(raw, text) {
  const people = Number(raw?.peopleCount);
  return {
    medicalUrgent: Boolean(raw?.medicalUrgent),
    stranded: Boolean(raw?.stranded),
    needsTransport: Boolean(raw?.needsTransport),
    peopleCount:
      Number.isFinite(people) && people >= 1 && people <= 50
        ? Math.floor(people)
        : 1,
    summary:
      typeof raw?.summary === "string" && raw.summary.trim()
        ? raw.summary.trim().slice(0, 200)
        : (text || "SOS").slice(0, 140),
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t) => typeof t === "string").slice(0, 12)
    : [];

  if (!text && tags.length === 0) {
    return NextResponse.json(
      { error: "text or tags required" },
      { status: 400 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ...heuristicFallback(text, tags),
      source: "heuristic",
      warning: "GEMINI_API_KEY not set",
    });
  }

  const userContent = [
    tags.length ? `Quick tags: ${tags.join(", ")}` : null,
    `Message: ${text || "(tags only)"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const models = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro",
  ];

  try {
    let lastWarning = "Gemini unavailable";
    for (const model of models) {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
        `?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${SYSTEM_PROMPT}\n\n${userContent}` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastWarning = `Gemini ${model} HTTP ${res.status}`;
        console.error("Gemini analyze-sos failed", model, res.status, errText.slice(0, 300));
        continue;
      }

      const data = await res.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : null;
      }
      if (!parsed) {
        lastWarning = `Gemini ${model} returned non-JSON`;
        continue;
      }

      return NextResponse.json({
        ...normalizeFlags(parsed, text),
        source: "gemini",
        model,
      });
    }

    return NextResponse.json({
      ...heuristicFallback(text, tags),
      source: "heuristic",
      warning: lastWarning,
    });
  } catch (err) {
    console.error("Gemini analyze-sos error", err);
    return NextResponse.json({
      ...heuristicFallback(text, tags),
      source: "heuristic",
      warning: err instanceof Error ? err.message : String(err),
    });
  }
}
