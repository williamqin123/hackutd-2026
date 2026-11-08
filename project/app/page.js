"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectSpacetimeDB,
  deleteAllFloods,
  getExistingFloodIds,
  getResumeIndex,
  insertFlood,
  INTERVAL_MS,
  loadFloodCsv,
} from "../lib/spacetimedb-server";

export default function Home() {
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const connectionRef = useRef(null);
  const rowsRef = useRef([]);
  const knownIdsRef = useRef(new Set());

  const playingRef = useRef(false);
  const busyRef = useRef(false);
  const resettingRef = useRef(false);
  const readyRef = useRef(false);

  const updatePlaying = useCallback((value) => {
    playingRef.current = value;
    setPlaying(value);
  }, []);

  const syncProgress = useCallback(() => {
    if (resettingRef.current) return;

    const next = getResumeIndex(rowsRef.current, knownIdsRef.current);

    setCursor(next);

    if (next >= rowsRef.current.length) {
      updatePlaying(false);
    }
  }, [updatePlaying]);

  useEffect(() => {
    let cancelled = false;
    let csvLoaded = false;
    let subscriptionLoaded = false;

    function markReady() {
      if (cancelled || !csvLoaded || !subscriptionLoaded) {
        return;
      }

      syncProgress();
      readyRef.current = true;
      setReady(true);
    }

    void loadFloodCsv()
      .then((data) => {
        if (cancelled) return;

        rowsRef.current = data;
        setRows(data);

        csvLoaded = true;
        markReady();
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      });

    const connection = connectSpacetimeDB(
      (ctx) => {
        if (cancelled) return;

        setConnected(true);

        ctx.db.floodData.onInsert((_event, flood) => {
          if (cancelled) return;

          knownIdsRef.current.add(flood.objectid.toString());

          syncProgress();
        });

        ctx.db.floodData.onDelete((_event, flood) => {
          if (cancelled) return;

          knownIdsRef.current.delete(flood.objectid.toString());

          syncProgress();
        });

        ctx
          .subscriptionBuilder()
          .onApplied((subCtx) => {
            if (cancelled) return;

            knownIdsRef.current = getExistingFloodIds(subCtx);

            subscriptionLoaded = true;
            markReady();
          })
          .onError((_ctx, err) => {
            if (!cancelled) setError(String(err));
          })
          .subscribe(["SELECT * FROM floodData"]);
      },
      () => {
        if (cancelled) return;

        setConnected(false);
        setReady(false);
        readyRef.current = false;
        updatePlaying(false);
      },
      (err) => {
        if (!cancelled) setError(err.message);
      },
    );

    connectionRef.current = connection;

    return () => {
      cancelled = true;
      readyRef.current = false;
      playingRef.current = false;
      connectionRef.current = null;
      connection.disconnect();
    };
  }, [syncProgress, updatePlaying]);

  useEffect(() => {
    if (!playing || !ready) return;

    const timer = setInterval(() => {
      const connection = connectionRef.current;

      if (
        !connection ||
        !connection.isActive ||
        !playingRef.current ||
        !readyRef.current ||
        busyRef.current ||
        resettingRef.current
      ) {
        return;
      }

      const index = getResumeIndex(rowsRef.current, knownIdsRef.current);

      const row = rowsRef.current[index];

      if (!row) {
        updatePlaying(false);
        return;
      }

      busyRef.current = true;
      setBusy(true);

      void (async () => {
        try {
          await insertFlood(connection, row);

          knownIdsRef.current.add(row.OBJECTID.trim());

          syncProgress();
        } catch (err) {
          updatePlaying(false);
          setError(String(err));
        } finally {
          busyRef.current = false;
          setBusy(false);
        }
      })();
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [playing, ready, syncProgress, updatePlaying]);

  const reset = async () => {
    const connection = connectionRef.current;

    if (
      !connection ||
      !connection.isActive ||
      !readyRef.current ||
      busyRef.current
    ) {
      return;
    }

    updatePlaying(false);
    resettingRef.current = true;
    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      await deleteAllFloods(connection);

      knownIdsRef.current.clear();
      setCursor(0);
    } catch (err) {
      setError(String(err));
    } finally {
      resettingRef.current = false;
      busyRef.current = false;
      setBusy(false);

      syncProgress();
    }
  };

  const progress = rows.length ? Math.round((cursor / rows.length) * 100) : 0;

  const nextRow = rows[cursor];

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Flood Data Simulation</h1>

      <p>Database: {connected ? "Connected" : "Disconnected"}</p>

      <p>Status: {!ready ? "Loading" : playing ? "Playing" : "Paused"}</p>

      <p>
        Records processed: {cursor} / {rows.length}
      </p>

      <div
        style={{
          height: 12,
          background: "#ddd",
          borderRadius: 6,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "#2563eb",
          }}
        />
      </div>

      <p>Progress: {progress}%</p>

      <p>Next record: {nextRow?.OBJECTID ?? "Complete"}</p>

      <p>Next survey date: {nextRow?.SurveyDate ?? "N/A"}</p>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 24,
        }}
      >
        <button
          disabled={!ready || busy || playing || cursor >= rows.length}
          onClick={() => updatePlaying(true)}
        >
          Play
        </button>

        <button disabled={!playing} onClick={() => updatePlaying(false)}>
          Pause
        </button>

        <button
          disabled={!ready || busy || !connected}
          onClick={() => void reset()}
        >
          {busy ? "Processing..." : "Reset"}
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </main>
  );
}
