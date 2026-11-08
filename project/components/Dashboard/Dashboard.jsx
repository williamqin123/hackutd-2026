"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSpacetimeDB, useTable } from "spacetimedb/react";

import { tables } from "../../src/module_bindings";
import { loadFloodMarks } from "../../lib/floods";
import { loadStormTrack, loadUsgsGauges } from "../../lib/hazard";
import {
  REGION,
  SIM_START_MICROS,
} from "../../lib/sim-clock";

import SimulationClock from "../SimulationClock";
import ThreatSnapshot from "../ThreatSnapshot";
import DashboardHeader from "./DashboardHeader";
import SummaryCards from "./SummaryCards";
import OperationsCards from "./OperationsCards";
import SosList from "./SosList";
import DeveloperPanel from "./DeveloperPanel";
import styles from "./Dashboard.module.css";

const FloodMap = dynamic(() => import("../FloodMap"), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading}>Loading map…</div>
  ),
});

export default function Dashboard() {
  const { isActive, getConnection } = useSpacetimeDB();
  const conn = getConnection();

  const [simulations, simReady] = useTable(tables.simulationState);
  const [requests, reqReady] = useTable(tables.rescueRequest);
  const [shelters, sheltersReady] = useTable(tables.shelter);
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

  const autoSeededRef = useRef(false);

  const ready =
    simReady &&
    reqReady &&
    sheltersReady &&
    teamsReady &&
    assignReady &&
    eventsReady &&
    floodReady &&
    stormReady &&
    gaugeStationReady &&
    gaugeReadingReady &&
    threatReady &&
    regionReady;

  const sim =
    simulations.find((item) => item.regionTag === REGION) ??
    simulations[0];

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
      .catch((err) => setError(`Load flood marks: ${String(err)}`));

    loadStormTrack()
      .then(setStormCsv)
      .catch((err) => setError(`Load storm track: ${String(err)}`));

    loadUsgsGauges()
      .then(setUsgsPayload)
      .catch((err) => setError(`Load USGS gauges: ${String(err)}`));
  }, []);

  const pendingSorted = useMemo(
    () =>
      [...requests]
        .filter(
          (request) =>
            request.status === "pending" ||
            request.status === "recommended",
        )
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [requests],
  );

  const recentEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) =>
          Number(
            b.createdAt.microsSinceUnixEpoch -
              a.createdAt.microsSinceUnixEpoch,
          ),
        )
        .slice(0, 8),
    [events],
  );

  const run = useCallback(
    async (label, fn) => {
      setError(null);

      try {
        if (!conn || !isActive) {
          throw new Error("Not connected to SpacetimeDB");
        }

        await fn(conn);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);

        setError(`${label}: ${message}`);
        throw err;
      }
    },
    [conn, isActive],
  );

  async function seedAllHistorical() {
    if (!floodCsv.length || !stormCsv.length || !usgsPayload) {
      setError("Historical files are still loading. Try again shortly.");
      return;
    }

    setBusy(true);

    try {
      await run("Seed flood marks", (c) =>
        c.reducers.seedFloodMarks({ marks: floodCsv }),
      );

      await run("Seed storm track", (c) =>
        c.reducers.seedStormTrack({ points: stormCsv }),
      );

      await run("Seed gauge stations", (c) =>
        c.reducers.seedGaugeStations({
          stations: usgsPayload.stations,
        }),
      );

      await run("Seed gauge readings", (c) =>
        c.reducers.seedGaugeReadings({
          readings: usgsPayload.readings,
        }),
      );

      await run("Seek start", (c) =>
        c.reducers.seekSimulation({
          regionTag: REGION,
          simTimeMicros: SIM_START_MICROS,
        }),
      );

      await run("Recompute threats", (c) =>
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

  function recommendDispatch() {
    return run("Recommend dispatch", (c) => c.reducers.recommendDispatch());
  }

  function confirmRecommendation(assignmentId) {
    return run("Confirm dispatch", (c) => c.reducers.confirmDispatch({ assignmentId }));
  }

  return (
    <main className={styles.dashboard}>
      <DashboardHeader
        isConnected={isActive}
        isReady={ready}
      />

      <div className={styles.intro}>
        <h1>Every request. A coordinated response.</h1>
        <p>Houston, Texas / Emergency response operations</p>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {needsSeed && (
        <p className={styles.notice} role="status">
          {busy
            ? "Preparing demo conditions…"
            : "Demo data is missing. Open the developer override panel to load it."}
        </p>
      )}

      <SummaryCards
        shelters={shelters}
        sheltersReady={sheltersReady}
        requests={pendingSorted}
        teams={teams}
        requestsReady={reqReady}
        teamsReady={teamsReady}
      />

      <div className={styles.workspace}>
        <div className={styles.mapColumn}>
          <section className={styles.card}>
            <h2>Flood & rescue map</h2>
            <p className={styles.muted}>
              Flood conditions, rescue teams, and incoming SOS requests
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


          </section>

          <OperationsCards
            shelters={shelters}
            sheltersReady={sheltersReady}
            teams={teams}
            teamsReady={teamsReady}
            events={recentEvents}
            eventsReady={eventsReady}
          />
        </div>

        <SosList
          requests={pendingSorted}
          teams={teams}
          assignments={assignments}
          ready={reqReady && teamsReady && assignReady}
          connected={isActive}
          onRecommend={recommendDispatch}
          onConfirm={confirmRecommendation}
        />
      </div>

      <DeveloperPanel isPlaying={Boolean(sim?.isPlaying)}>
        <p className={styles.muted}>
          Historical sensor data stands in for incoming conditions. These
          controls change the shared demo state across the dashboard.
        </p>

        <SimulationClock
          sim={sim}
          isActive={isActive}
          busy={busy}
          run={run}
        />

        <ThreatSnapshot
          threatRegions={threatRegions}
          siteThreats={siteThreats}
        />

        <p className={styles.muted}>
          Modelled scores for the simulation, not official forecasts.
        </p>

        <p>
          Flood marks: {floodMarks.length} / {floodCsv.length}
          <br />
          Storm points: {stormPoints.length} / {stormCsv.length}
          <br />
          USGS stations: {gaugeStations.length}
          <br />
          Gauge readings: {gaugeReadings.length}
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            disabled={
              !isActive ||
              !ready ||
              busy ||
              !floodCsv.length ||
              !stormCsv.length ||
              !usgsPayload
            }
            onClick={() => {
              void seedAllHistorical().catch(() => {});
            }}
          >
            {busy ? "Loading…" : "Reload demo data"}
          </button>

          <button
            type="button"
            disabled={!isActive || !ready || busy}
            onClick={() => {
              void run("Recompute threats", (c) =>
                c.reducers.recomputeThreats({
                  regionTag: REGION,
                }),
              ).catch(() => {});
            }}
          >
            Recompute threats
          </button>
        </div>
      </DeveloperPanel>
    </main>
  );
}
