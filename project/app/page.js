"use client";

import { useEffect, useMemo, useState } from "react";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { tables } from "../src/module_bindings";
import { loadFloodMarks } from "../lib/floods";

export default function Home() {
  const { isActive, getConnection } = useSpacetimeDB();
  const conn = getConnection();

  const [simulations, simReady] = useTable(tables.simulationState);
  const [requests, reqReady] = useTable(tables.rescueRequest);
  const [teams, teamsReady] = useTable(tables.rescueTeam);
  const [assignments, assignReady] = useTable(tables.dispatchAssignment);
  const [events, eventsReady] = useTable(tables.activityEvent);
  const [floodMarks, floodReady] = useTable(tables.floodMark);
  const [error, setError] = useState(null);

  const [floodCsv, setFloodCsv] = useState([]);
  const [seeding, setSeeding] = useState(false);

  const ready =
    simReady && reqReady && teamsReady && assignReady && eventsReady && floodReady;

  useEffect(() => {
    loadFloodMarks()
      .then(setFloodCsv)
      .catch((err) => setError(`load flood CSV: ${String(err)}`));
  }, []);

  const pendingSorted = useMemo(
    () =>
      [...requests]
        .filter((r) => r.status === "pending" || r.status === "recommended")
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [requests],
  );

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

  useEffect(() => {
    setError(null);
  }, [isActive]);

  async function run(label, fn) {
    setError(null);
    try {
      if (!conn || !isActive) throw new Error("Not connected to SpacetimeDB");
      await fn(conn);
    } catch (err) {
      setError(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.4,
      }}
    >
      <h1>FloodWatch</h1>
      <p>
        Minimal Spacetime backend: simulation clock, SOS requests, teams, and
        dispatch recommendations.
      </p>

      <p>
        Connection: <strong>{isActive ? "connected" : "disconnected"}</strong>
        {" · "}
        Data: <strong>{ready ? "ready" : "loading"}</strong>
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Simulation</h2>
        {simulations.map((sim) => (
          <p key={String(sim.id)}>
            {sim.regionTag}: {sim.isPlaying ? "playing" : "paused"} · speed{" "}
            {sim.speedMultiplier}x · simTimeMicros={String(sim.simTimeMicros)}
          </p>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("play", (c) =>
                c.reducers.setSimulationPlaying({
                  regionTag: "houston-harvey",
                  isPlaying: true,
                }),
              )
            }
          >
            Play
          </button>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("pause", (c) =>
                c.reducers.setSimulationPlaying({
                  regionTag: "houston-harvey",
                  isPlaying: false,
                }),
              )
            }
          >
            Pause
          </button>
          <button
            disabled={!isActive}
            onClick={() =>
              void run("advance", (c) =>
                c.reducers.advanceSimulation({
                  regionTag: "houston-harvey",
                  deltaMicros: 3_600_000_000n,
                }),
              )
            }
          >
            Advance 1 sim-hour
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Historical flood marks</h2>
        <p>
          In database: <strong>{floodMarks.length}</strong> · parsed from CSV:{" "}
          <strong>{floodCsv.length}</strong>{" "}
          <span style={{ color: "#6b7280" }}>(real USGS observations)</span>
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            disabled={!isActive || seeding || floodCsv.length === 0}
            onClick={() => {
              setSeeding(true);
              void run("seed flood marks", (c) =>
                c.reducers.seedFloodMarks({ marks: floodCsv }),
              ).finally(() => setSeeding(false));
            }}
          >
            {seeding ? "Seeding..." : "Seed flood marks (one-time)"}
          </button>
          <button
            disabled={!isActive || floodMarks.length === 0}
            onClick={() => void run("clear flood marks", (c) => c.reducers.clearFloodMarks())}
          >
            Clear flood marks
          </button>
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Actions</h2>
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
            onClick={() =>
              void run("create SOS", (c) =>
                c.reducers.createRescueRequest({
                  lat: 29.78,
                  lon: -95.4,
                  peopleCount: 1,
                  medicalUrgent: false,
                  stranded: false,
                  needsTransport: false,
                  description: "Needs sandbags / non-urgent help",
                }),
              )
            }
          >
            Create low-priority SOS
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
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Teams ({teams.length})</h2>
        <ul>
          {teams.map((team) => (
            <li key={String(team.id)}>
              {team.name} · {team.status} · cap {team.capacity}
              {team.hasMedical ? " · medical" : ""}
              {team.hasBoat ? " · boat" : ""}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Priority queue</h2>
        <ul>
          {pendingSorted.map((req) => (
            <li key={String(req.id)}>
              #{String(req.id)} score={req.priorityScore} · {req.status} ·{" "}
              {req.description}
            </li>
          ))}
          {pendingSorted.length === 0 && <li>No open requests</li>}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Assignments</h2>
        <ul>
          {assignments.map((a) => (
            <li key={String(a.id)}>
              #{String(a.id)} request={String(a.requestId)} team={String(a.teamId)} ·{" "}
              {a.status}
            </li>
          ))}
          {assignments.length === 0 && <li>None yet</li>}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
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
