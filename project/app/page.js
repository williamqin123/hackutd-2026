"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { tables } from "../src/module_bindings";
import { loadFloodMarks } from "../lib/floods";
import { loadStormTrack, loadUsgsGauges } from "../lib/hazard";
import { REGION, SIM_START_MICROS, microsLabel } from "../lib/sim-clock";
import SimulationClock from "../components/SimulationClock.jsx";
import ThreatSnapshot from "../components/ThreatSnapshot.jsx";
import DispatchBoard from "../components/DispatchBoard.jsx";

const FloodMap = dynamic(() => import("../components/FloodMap.jsx"), {
  ssr: false,
  loading: () => (
    <div className="flood-map-loading">Loading map…</div>
  ),
});

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
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const autoSeededRef = useRef(false);
  const teamsSeededRef = useRef(false);

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
  const needsSeed =
    ready &&
    isActive &&
    (floodMarks.length === 0 ||
      stormPoints.length === 0 ||
      gaugeStations.length === 0 ||
      gaugeReadings.length === 0);

  useEffect(() => {
    loadFloodMarks()
      .then(setFloodCsv)
      .catch((err) => setError(`load flood marks: ${String(err)}`));
    loadStormTrack()
      .then(setStormCsv)
      .catch((err) => setError(`load storm track: ${String(err)}`));
    loadUsgsGauges()
      .then(setUsgsPayload)
      .catch((err) => setError(`load USGS gauges: ${String(err)}`));
  }, []);

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

  const run = useCallback(
    async (label, fn) => {
      setError(null);
      try {
        if (!conn || !isActive) throw new Error("Not connected to SpacetimeDB");
        await fn(conn);
      } catch (err) {
        setError(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    },
    [conn, isActive],
  );

  async function seedAllHistorical() {
    if (!floodCsv.length || !stormCsv.length || !usgsPayload) {
      throw new Error("Historical files still loading — wait a second and retry");
    }
    setBusy(true);
    try {
      await run("seed flood marks", (c) =>
        c.reducers.seedFloodMarks({ marks: floodCsv }),
      );
      await run("seed storm track", (c) =>
        c.reducers.seedStormTrack({ points: stormCsv }),
      );
      await run("seed gauge stations", (c) =>
        c.reducers.seedGaugeStations({ stations: usgsPayload.stations }),
      );
      await run("seed gauge readings", (c) =>
        c.reducers.seedGaugeReadings({ readings: usgsPayload.readings }),
      );
      await run("seek start", (c) =>
        c.reducers.seekSimulation({
          regionTag: REGION,
          simTimeMicros: SIM_START_MICROS,
        }),
      );
      await run("recompute threats", (c) =>
        c.reducers.recomputeThreats({ regionTag: REGION }),
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!needsSeed || autoSeededRef.current || busy) return;
    if (!floodCsv.length || !stormCsv.length || !usgsPayload) return;
    autoSeededRef.current = true;
    void seedAllHistorical().catch(() => {
      autoSeededRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSeed, floodCsv.length, stormCsv.length, usgsPayload, busy]);

  useEffect(() => {
    if (!isActive || !ready || busy || teamsSeededRef.current) return;
    const houstonCount = teams.filter((t) =>
      String(t.name).startsWith("Houston Unit "),
    ).length;
    if (houstonCount >= 15) {
      teamsSeededRef.current = true;
      return;
    }
    teamsSeededRef.current = true;
    void run("seed Houston teams", (c) => c.reducers.seedHoustonRescueTeams()).catch(
      () => {
        teamsSeededRef.current = false;
      },
    );
  }, [isActive, ready, busy, teams, run]);

  return (
    <main>
      <h1>The WaterBoard</h1>
      <p>
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

      {needsSeed && (
        <p role="status" className="notice">
          <strong>No flood layers in the database yet.</strong> Colored regions
          appear only after historical data is seeded.{" "}
          {busy ? "Seeding automatically…" : "Click seed below if this stays empty."}
        </p>
      )}

      <FloodMap
        simTimeMicros={sim?.simTimeMicros}
        stormPoints={stormPoints}
        threatRegions={threatRegions}
        siteThreats={siteThreats}
        floodMarks={floodMarks}
        requests={requests}
        teams={teams}
        assignments={assignments}
        selectedRequestId={selectedRequestId}
      />

      <SimulationClock sim={sim} isActive={isActive} busy={busy} run={run} />

      <ThreatSnapshot threatRegions={threatRegions} siteThreats={siteThreats} />

      <DispatchBoard
        requests={requests}
        teams={teams}
        assignments={assignments}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        isActive={isActive}
        busy={busy}
        run={run}
      />

      <section>
        <h2>Historical data</h2>
        <p>
          Flood marks DB/JSON: {floodMarks.length}/{floodCsv.length} · Storm
          track: {stormPoints.length}/{stormCsv.length} · USGS stations:{" "}
          {gaugeStations.length} · readings: {gaugeReadings.length}
        </p>
        <div className="button-row">
          <button
            disabled={!isActive || busy || floodCsv.length === 0 || !usgsPayload}
            onClick={() => void seedAllHistorical().catch(() => {})}
          >
            {busy ? "Seeding..." : "Seed all historical (JSON + USGS)"}
          </button>
          <button
            disabled={!isActive || busy}
            onClick={() =>
              void run("recompute threats", (c) =>
                c.reducers.recomputeThreats({ regionTag: REGION }),
              )
            }
          >
            Recompute threats now
          </button>
        </div>
      </section>

      <section>
        <h2>Activity</h2>
        <ul>
          {recentEvents.map((e) => (
            <li key={String(e.id)}>
              [{e.kind}] {e.message}
            </li>
          ))}
        </ul>
      </section>

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
