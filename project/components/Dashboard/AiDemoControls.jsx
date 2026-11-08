"use client";

import { useEffect, useRef, useState } from "react";
import { HOUR_MICROS, REGION, SIM_START_MICROS } from "../../lib/sim-clock";
import { pickSosAnchors } from "../../lib/sos-anchors";
import styles from "./Dashboard.module.css";

const DRILL_TAG = "[Storm drill]";
const RED_HOLD_HOURS = 3n;
const SPAWN_EVERY_HOURS = 1n;
const SPAWN_BATCH = 2;
const DISPATCH_PER_TICK = 2;
const MAX_PENDING = 12;

function randomRescueHours() {
  return 4 + Math.floor(Math.random() * 5);
}

export default function AiDemoControls({
  sim,
  requests,
  teams,
  assignments,
  threatRegions,
  isActive,
  ready,
  run,
}) {
  const [demoOn, setDemoOn] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");

  const demoOnRef = useRef(false);
  const workingRef = useRef(false);
  const spawnLock = useRef(false);
  const nextSpawnRef = useRef(SIM_START_MICROS);
  const dueRef = useRef(new Map());
  const firstSeenRef = useRef(new Map());
  const simTimeRef = useRef(sim?.simTimeMicros ?? SIM_START_MICROS);
  const requestsRef = useRef(requests);
  const teamsRef = useRef(teams);
  const assignmentsRef = useRef(assignments);
  const threatsRef = useRef(threatRegions);
  const runRef = useRef(run);

  useEffect(() => { demoOnRef.current = demoOn; }, [demoOn]);
  useEffect(() => { workingRef.current = working; }, [working]);
  useEffect(() => { requestsRef.current = requests; }, [requests]);
  useEffect(() => { teamsRef.current = teams; }, [teams]);
  useEffect(() => { assignmentsRef.current = assignments; }, [assignments]);
  useEffect(() => { threatsRef.current = threatRegions; }, [threatRegions]);
  useEffect(() => { runRef.current = run; }, [run]);
  useEffect(() => {
    if (sim?.simTimeMicros != null) simTimeRef.current = sim.simTimeMicros;
  }, [sim?.simTimeMicros]);

  useEffect(() => {
    if (!demoOn || sim?.simTimeMicros == null) return;
    const now = sim.simTimeMicros;
    for (const request of requests) {
      const key = String(request.id);
      if (request.status === "pending" && !firstSeenRef.current.has(key)) {
        firstSeenRef.current.set(key, now);
      }
    }
  }, [requests, demoOn, sim?.simTimeMicros]);

  useEffect(() => {
    if (!demoOn) return;
    const now = sim?.simTimeMicros;
    if (now == null) return;
    for (const assignment of assignments) {
      const key = String(assignment.id);
      if (!["confirmed", "en_route"].includes(assignment.status)) continue;
      if (!dueRef.current.has(key)) {
        dueRef.current.set(key, now + BigInt(randomRescueHours()) * HOUR_MICROS);
      }
    }
  }, [assignments, demoOn, sim?.simTimeMicros]);

  async function createGenerated(count, { drill = false } = {}) {
    const anchors = pickSosAnchors(threatsRef.current, count);
    const response = await fetch("/api/generate-sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        count,
        anchors,
        context: "Hurricane Harvey flooding across Houston",
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.warning || data.error || "Could not generate SOS");
    const messages = Array.isArray(data.messages) ? data.messages : [];
    if (messages.length === 0) throw new Error("No SOS text returned");
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const anchor = anchors[index] || anchors[0];
      await runRef.current("Create SOS", (conn) => conn.reducers.createRescueRequest({
        lat: anchor.lat,
        lon: anchor.lon,
        peopleCount: message.peopleCount || 1,
        medicalUrgent: Boolean(message.medicalUrgent),
        stranded: message.stranded !== false,
        needsTransport: message.needsTransport !== false,
        description: drill ? `${DRILL_TAG} ${message.description}` : message.description,
      }));
    }
    return data.source === "openrouter" ? "OpenRouter" : "fallback text";
  }

  function pendingRequests() {
    const open = new Set(
      assignmentsRef.current
        .filter((assignment) => ["recommended", "confirmed", "en_route"].includes(assignment.status))
        .map((assignment) => String(assignment.requestId)),
    );
    return requestsRef.current.filter((request) =>
      request.status === "pending" && !open.has(String(request.id)));
  }

  async function dispatchAged(now) {
    const free = teamsRef.current.filter((team) => team.status === "available").length;
    if (free === 0) return 0;
    const ready = pendingRequests()
      .filter((request) => String(request.description || "").startsWith(DRILL_TAG))
      .filter((request) => {
        const seen = firstSeenRef.current.get(String(request.id));
        if (seen == null) return false;
        return now >= seen + RED_HOLD_HOURS * HOUR_MICROS;
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);
    let sent = 0;
    for (const request of ready) {
      if (sent >= DISPATCH_PER_TICK || sent >= free) break;
      if (!demoOnRef.current) break;
      await runRef.current("Dispatch aged SOS", (conn) =>
        conn.reducers.dispatchRequest({ requestId: request.id }));
      firstSeenRef.current.delete(String(request.id));
      sent += 1;
    }
    return sent;
  }

  async function spawnBatch() {
    if (!demoOnRef.current || spawnLock.current) return;
    const now = simTimeRef.current ?? SIM_START_MICROS;
    const pending = pendingRequests().length;
    if (pending >= MAX_PENDING) {
      nextSpawnRef.current = now + SPAWN_EVERY_HOURS * HOUR_MICROS;
      setStatus(`Storm drill running · ${pending} red SOS waiting · teams pick them up after ${RED_HOLD_HOURS}h`);
      return;
    }
    spawnLock.current = true;
    nextSpawnRef.current = now + 48n * HOUR_MICROS;
    try {
      const source = await createGenerated(SPAWN_BATCH, { drill: true });
      if (!demoOnRef.current) return;
      const after = simTimeRef.current ?? now;
      nextSpawnRef.current = after + SPAWN_EVERY_HOURS * HOUR_MICROS;
      setStatus(`Storm drill running · ${SPAWN_BATCH} new red SOS via ${source} · dispatch after ${RED_HOLD_HOURS} sim hours`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Storm drill: ${message}`);
      nextSpawnRef.current = now + HOUR_MICROS;
    } finally {
      spawnLock.current = false;
    }
  }

  async function releaseDue(now) {
    const due = [...dueRef.current.entries()].filter(([, at]) => at <= now);
    for (const [key] of due) {
      dueRef.current.delete(key);
      const assignment = assignmentsRef.current.find((item) => String(item.id) === key);
      if (!assignment) continue;
      if (assignment.status !== "confirmed" && assignment.status !== "en_route") continue;
      try {
        await runRef.current("Complete demo rescue", (conn) =>
          conn.reducers.completeDispatch({ assignmentId: assignment.id }));
      } catch {
        /* The board shows reducer errors. */
      }
    }
  }

  useEffect(() => {
    if (!demoOn || sim?.simTimeMicros == null) return;
    const now = sim.simTimeMicros;
    const shouldSpawn = now >= nextSpawnRef.current && !spawnLock.current;
    if (shouldSpawn) nextSpawnRef.current = now + 48n * HOUR_MICROS;
    let cancelled = false;
    void (async () => {
      await releaseDue(now);
      if (cancelled || !demoOnRef.current) return;
      try {
        await dispatchAged(now);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error));
      }
      if (cancelled || !demoOnRef.current) return;
      if (shouldSpawn) await spawnBatch();
    })();
    return () => { cancelled = true; };
    // Spawn loop is keyed to the sim clock only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoOn, sim?.simTimeMicros]);

  async function startDemo() {
    if (!isActive || !ready || workingRef.current) return;
    const ok = window.confirm(
      "Start the storm drill? This deletes current SOS messages and assignments, sends teams home, and rewinds the Harvey clock. Phone SOS sent during the drill stay manual.",
    );
    if (!ok) return;
    setWorking(true);
    dueRef.current = new Map();
    firstSeenRef.current = new Map();
    nextSpawnRef.current = SIM_START_MICROS;
    try {
      await run("Clear SOS board", (conn) => conn.reducers.clearRescueBoard());
      await run("Rewind storm clock", (conn) => conn.reducers.seekSimulation({
        regionTag: REGION,
        simTimeMicros: SIM_START_MICROS,
      }));
      await run("Recompute threats", (conn) => conn.reducers.recomputeThreats({ regionTag: REGION }));
      demoOnRef.current = true;
      simTimeRef.current = SIM_START_MICROS;
      nextSpawnRef.current = SIM_START_MICROS;
      setDemoOn(true);
      setStatus("Storm drill running · generating the first SOS");
      await run("Play storm clock", (conn) => conn.reducers.setSimulationPlaying({
        regionTag: REGION,
        isPlaying: true,
      }));
    } catch (error) {
      demoOnRef.current = false;
      setDemoOn(false);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  async function cancelDemo() {
    demoOnRef.current = false;
    setDemoOn(false);
    dueRef.current = new Map();
    firstSeenRef.current = new Map();
    nextSpawnRef.current = SIM_START_MICROS;
    setWorking(true);
    try {
      await run("Stop storm clock", (conn) => conn.reducers.setSimulationPlaying({
        regionTag: REGION,
        isPlaying: false,
      }));
      await run("Clear SOS board", (conn) => conn.reducers.clearRescueBoard());
      setStatus("Storm drill cancelled. SOS board cleared and teams are home.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  async function dropFive() {
    if (!isActive || !ready || workingRef.current) return;
    setWorking(true);
    try {
      const source = await createGenerated(5);
      setStatus(`Dropped 5 SOS on the map (${source}). Existing requests were kept.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <p className={styles.muted}>
        Storm drill on the Harvey clock. Drill calls stay red for 3 sim hours, then a free team is sent and stays 4–8 sim hours. Playing or scrubbing the clock by itself never assigns a team. Phone and hand-entered SOS always wait for a manual confirm. Starting or cancelling clears the board.
      </p>
      <div className={styles.actions}>
        <button type="button" disabled={!isActive || !ready || working || demoOn} onClick={() => { void startDemo(); }}>
          {working && !demoOn ? "Starting…" : "Start storm drill"}
        </button>
        <button type="button" className={styles.danger} disabled={!demoOn || working} onClick={() => { void cancelDemo(); }}>
          Cancel storm drill
        </button>
        <button type="button" disabled={!isActive || !ready || working} onClick={() => { void dropFive(); }}>
          Drop 5 SOS on map
        </button>
      </div>
      {status && <p className={styles.demoNote} role="status">{status}</p>}
    </div>
  );
}
