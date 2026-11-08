"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { tables } from "../src/module_bindings";
import { loadFloodMarks } from "../lib/floods";
import { loadStormTrack, loadUsgsGauges } from "../lib/hazard";

// Leaflet touches `window` at import time — load the map only in the browser.
const FloodMap = dynamic(() => import("./FloodMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 480,
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        display: "grid",
        placeItems: "center",
        color: "#64748b",
        background: "#f8fafc",
      }}
    >
      Loading map…
    </div>
  ),
});

const REGION = "houston-harvey";
const HOUR_MICROS = 3_600_000_000n;

function microsLabel(micros) {
  if (micros === undefined || micros === null) return "—";
  return new Date(Number(micros / 1000n)).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

export default function Home() {
  const { isActive, getConnection } = useSpacetimeDB();
  const conn = getConnection();

  const [simulations, simReady] = useTable(tables.simulationState);
  const [requests, reqReady] = useTable(tables.rescueRequest);
  const [teams, teamsReady] = useTable(tables.rescueTeam);
  const [assignments, assignReady] = useTable(tables.dispatchAssignment);
  const [events, eventsReady] = useTable(tables.activityEvent);
  const [floodMarks, floodReady] = useTable(tables.floodMark);
  const [stormPoints, stormReady] = useTable(tables.stormObservation);
  const [gaugeStations, gaugeStationReady] = useTable(tables.gaugeStation);
  const [gaugeReadings, gaugeReadingReady] = useTable(tables.gaugeReading);
  const [siteThreats, threatReady] = useTable(tables.siteThreat);
  const [threatRegions, regionReady] = useTable(tables.threatRegion);

  const [error, setError] = useState(null);
  const [floodCsv, setFloodCsv] = useState([]);
  const [stormCsv, setStormCsv] = useState([]);
  const [usgsPayload, setUsgsPayload] = useState(null);
  const [busy, setBusy] = useState(false);
  const playingRef = useRef(false);

  const ready =
    simReady &&
    reqReady &&
    teamsReady &&
    assignReady &&
    eventsReady &&
    floodReady &&
    stormReady &&
    gaugeStationReady &&
    gaugeReadingReady &&
    threatReady &&
    regionReady;

  const sim = simulations.find((s) => s.regionTag === REGION) ?? simulations[0];

  useEffect(() => {
    loadFloodMarks()
      .then(setFloodCsv)
      .catch((err) => setError(`load flood CSV: ${String(err)}`));
    loadStormTrack()
      .then(setStormCsv)
      .catch((err) => setError(`load storm track: ${String(err)}`));
    loadUsgsGauges()
      .then(setUsgsPayload)
      .catch((err) => setError(`load USGS gauges: ${String(err)}`));
  }, []);

  const pendingSorted = useMemo(
    () =>
      [...requests]
        .filter((r) => r.status === "pending" || r.status === "recommended")
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [requests],
  );

  const threatSummary = useMemo(() => {
    const counts = { none: 0, watch: 0, advisory: 0, warning: 0, critical: 0 };
    for (const t of siteThreats) counts[t.level] = (counts[t.level] ?? 0) + 1;
    return counts;
  }, [siteThreats]);

  const recentEvents = useMemo(
    () =>
      [...events]
        .sort(
          (a, b) =>
            Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch),
        )
        .slice(0, 8),
    [events],
  );

  async function run(label, fn) {
    setError(null);
    try {
      if (!conn || !isActive) throw new Error("Not connected to SpacetimeDB");
      await fn(conn);
    } catch (err) {
      setError(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  async function seedAllHistorical() {
    setBusy(true);
    try {
      await run("seed flood marks", (c) =>
        c.reducers.seedFloodMarks({ marks: floodCsv }),
      );
      await run("seed storm track", (c) =>
        c.reducers.seedStormTrack({ points: stormCsv }),
      );
      if (usgsPayload) {
        await run("seed gauge stations", (c) =>
          c.reducers.seedGaugeStations({ stations: usgsPayload.stations }),
        );
        await run("seed gauge readings", (c) =>
          c.reducers.seedGaugeReadings({ readings: usgsPayload.readings }),
        );
      }
      await run("recompute threats", (c) =>
        c.reducers.recomputeThreats({ regionTag: REGION }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function tickHour() {
    await run("advance 1h", (c) =>
      c.reducers.advanceSimulation({
        regionTag: REGION,
        deltaMicros: HOUR_MICROS,
      }),
    );
    await run("recompute threats", (c) =>
      c.reducers.recomputeThreats({ regionTag: REGION }),
    );
  }

  // Auto-play: when simulation isPlaying, advance one sim-hour + recompute threats.
  useEffect(() => {
    playingRef.current = Boolean(sim?.isPlaying);
  }, [sim?.isPlaying]);

  useEffect(() => {
    if (!sim?.isPlaying || !isActive || !conn) return;

    let cancelled = false;
    const handle = setInterval(() => {
      if (cancelled || !playingRef.current || busy) return;
      void tickHour().catch(() => {
        // Errors surface via setError inside run(); pause on failure.
        void run("pause", (c) =>
          c.reducers.setSimulationPlaying({ regionTag: REGION, isPlaying: false }),
        );
      });
    }, 1200);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim?.isPlaying, isActive, conn, busy]);

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "1.5rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.4,
      }}
    >
      <h1 style={{ marginBottom: 4 }}>The WaterBoard</h1>
      <p style={{ marginTop: 0, color: "#475569" }}>
        Historical Harvey replay · live threat regions from storm track + USGS
        gages + high-water marks. Modelled scores for demo — not official
        forecasts.
      </p>

      <p>
        Connection: <strong>{isActive ? "connected" : "disconnected"}</strong>
        {" · "}
        Data: <strong>{ready ? "ready" : "loading"}</strong>
        {" · "}
        Sim: <strong>{sim ? microsLabel(sim.simTimeMicros) : "—"}</strong>
        {sim?.isPlaying ? " · LIVE" : " · paused"}
      </p>

      <FloodMap
        simTimeMicros={sim?.simTimeMicros}
        stormPoints={stormPoints}
        threatRegions={threatRegions}
        siteThreats={siteThreats}
        floodMarks={floodMarks}
        requests={requests}
        teams={teams}
      />

      <section style={{ marginTop: 20 }}>
        <h2>Threat snapshot</h2>
        <p>
          Sites — none {threatSummary.none ?? 0}, watch {threatSummary.watch ?? 0},
          advisory {threatSummary.advisory ?? 0}, warning {threatSummary.warning ?? 0},
          critical {threatSummary.critical ?? 0}
        </p>
        <ul>
          {threatRegions.map((r) => (
            <li key={r.stationId}>
              <strong>{r.name}</strong>: {r.gageHeightFt.toFixed(1)} ft / stage{" "}
              {r.floodStageFt.toFixed(0)} ({(r.stageRatio * 100).toFixed(0)}%) ·{" "}
              {r.level} · radius {r.radiusKm.toFixed(1)} km
            </li>
          ))}
          {threatRegions.length === 0 && (
            <li>No gauge regions yet — seed historical data first.</li>
          )}
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Historical data</h2>
        <p>
          Flood marks DB/CSV: {floodMarks.length}/{floodCsv.length} · Storm track:{" "}
          {stormPoints.length}/{stormCsv.length} · USGS stations:{" "}
          {gaugeStations.length} · readings: {gaugeReadings.length}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={!isActive || busy || floodCsv.length === 0} onClick={() => void seedAllHistorical()}>
            {busy ? "Seeding..." : "Seed all historical (CSV + USGS)"}
          </button>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("recompute threats", (c) =>
                c.reducers.recomputeThreats({ regionTag: REGION }),
              )
            }
          >
            Recompute threats now
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748b" }}>
          Formula: threat = 0.40·storm(proximity×wind) + 0.45·gauge(height/flood-stage×proximity)
          + 0.15·historical(mark already surveyed by sim time). Regions expand around gages
          as stage rises.
        </p>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Simulation clock (hourly)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("play", (c) =>
                c.reducers.setSimulationPlaying({
                  regionTag: REGION,
                  isPlaying: true,
                }),
              )
            }
          >
            Play (auto +1h)
          </button>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("pause", (c) =>
                c.reducers.setSimulationPlaying({
                  regionTag: REGION,
                  isPlaying: false,
                }),
              )
            }
          >
            Pause
          </button>
          <button disabled={!isActive || busy} onClick={() => void tickHour()}>
            Advance 1 sim-hour
          </button>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("reset", async (c) => {
                await c.reducers.resetSimulation({
                  regionTag: REGION,
                  simTimeMicros: 1503619200000000n,
                });
                await c.reducers.recomputeThreats({ regionTag: REGION });
              })
            }
          >
            Reset to Aug 25
          </button>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Dispatch demo</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("create SOS", (c) =>
                c.reducers.createRescueRequest({
                  lat: 29.75,
                  lon: -95.37,
                  peopleCount: 3,
                  medicalUrgent: true,
                  stranded: true,
                  needsTransport: true,
                  description: "Family stranded on roof, medical need",
                }),
              )
            }
          >
            Create urgent SOS
          </button>
          <button
            disabled={!isActive}
            onClick={() => void run("recommend", (c) => c.reducers.recommendDispatch())}
          >
            Recommend dispatch
          </button>
          <button
            disabled={!isActive || assignments.every((a) => a.status !== "recommended")}
            onClick={() => {
              const next = assignments.find((a) => a.status === "recommended");
              if (!next) return;
              void run("confirm", (c) =>
                c.reducers.confirmDispatch({ assignmentId: next.id }),
              );
            }}
          >
            Confirm first recommendation
          </button>
        </div>
        <h3>Priority queue</h3>
        <ul>
          {pendingSorted.map((req) => (
            <li key={String(req.id)}>
              #{String(req.id)} score={req.priorityScore} · {req.status} · {req.description}
            </li>
          ))}
          {pendingSorted.length === 0 && <li>No open requests</li>}
        </ul>
        <h3>Teams</h3>
        <ul>
          {teams.map((team) => (
            <li key={String(team.id)}>
              {team.name} · {team.status}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Activity</h2>
        <ul>
          {recentEvents.map((e) => (
            <li key={String(e.id)}>
              [{e.kind}] {e.message}
            </li>
          ))}
        </ul>
      </section>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </main>
  );
}
