"use client";

import { useEffect, useRef, useState } from "react";
import {
  EIGHT_HOUR_MICROS,
  HOUR_MICROS,
  PEAK_MICROS,
  PLAY_INTERVAL_MS,
  REGION,
  SIM_END_MICROS,
  SIM_START_MICROS,
  clampMicros,
  microsLabel,
  microsToSlider,
  sliderToMicros,
} from "../lib/sim-clock";

export default function SimulationClock({ sim, isActive, busy, run }) {
  const [sliderValue, setSliderValue] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const playingRef = useRef(false);
  const tickingRef = useRef(false);
  const simTimeRef = useRef(SIM_START_MICROS);
  const busyRef = useRef(busy);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (sim?.simTimeMicros != null) simTimeRef.current = sim.simTimeMicros;
    if (scrubbing || !sim) return;
    setSliderValue(microsToSlider(sim.simTimeMicros));
  }, [sim?.simTimeMicros, scrubbing]);

  useEffect(() => {
    playingRef.current = Boolean(sim?.isPlaying);
  }, [sim?.isPlaying]);

  async function advanceBy(deltaMicros, label) {
    const current = simTimeRef.current ?? SIM_START_MICROS;
    const next = clampMicros(current + deltaMicros);
    if (next === current) {
      await run("end of cycle", async (c) => {
        await c.reducers.setSimulationPlaying({
          regionTag: REGION,
          isPlaying: false,
        });
        if (c.reducers.clearRescueOps) {
          await c.reducers.clearRescueOps();
        }
      });
      return;
    }
    await run(label, async (c) => {
      await c.reducers.advanceSimulation({
        regionTag: REGION,
        deltaMicros: next - current,
      });
      await c.reducers.recomputeThreats({ regionTag: REGION });
      if (next >= SIM_END_MICROS && c.reducers.clearRescueOps) {
        await c.reducers.clearRescueOps();
        await c.reducers.setSimulationPlaying({
          regionTag: REGION,
          isPlaying: false,
        });
      }
    });
  }

  async function seekTo(micros) {
    const target = clampMicros(micros);
    await run("seek", async (c) => {
      await c.reducers.seekSimulation({
        regionTag: REGION,
        simTimeMicros: target,
      });
      await c.reducers.recomputeThreats({ regionTag: REGION });
    });
  }

  useEffect(() => {
    if (!sim?.isPlaying || !isActive) return;

    let cancelled = false;
    const handle = setInterval(() => {
      if (cancelled || !playingRef.current || busyRef.current || tickingRef.current) {
        return;
      }
      tickingRef.current = true;
      void advanceBy(HOUR_MICROS, "play tick +1h")
        .catch(() =>
          run("pause", (c) =>
            c.reducers.setSimulationPlaying({
              regionTag: REGION,
              isPlaying: false,
            }),
          ),
        )
        .finally(() => {
          tickingRef.current = false;
        });
    }, PLAY_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim?.isPlaying, isActive, run]);

  function commitSlider(value) {
    setScrubbing(false);
    void seekTo(sliderToMicros(value));
  }

  return (
    <section className="simulation-clock" aria-label="Simulation clock">
      <h2>Simulation clock</h2>
      <p>
        {microsLabel(sim?.simTimeMicros)} ·{" "}
        {sim?.isPlaying ? "LIVE (+1h ticks)" : "paused"}
      </p>
      <p className="muted">
        {microsLabel(SIM_START_MICROS)} → {microsLabel(SIM_END_MICROS)}
      </p>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={sliderValue}
        disabled={!isActive || busy}
        onMouseDown={() => setScrubbing(true)}
        onTouchStart={() => setScrubbing(true)}
        onChange={(e) => setSliderValue(Number(e.target.value))}
        onMouseUp={(e) => commitSlider(Number(e.target.value))}
        onTouchEnd={(e) => commitSlider(Number(e.target.value))}
        aria-label="Harvey timeline"
      />
      <div className="button-row">
        <button
          disabled={!isActive || busy}
          onClick={() =>
            void run("play", (c) =>
              c.reducers.setSimulationPlaying({
                regionTag: REGION,
                isPlaying: true,
              }),
            )
          }
        >
          Play (+1h)
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
        <button
          disabled={!isActive || busy}
          onClick={() => void advanceBy(EIGHT_HOUR_MICROS, "advance 8h")}
        >
          Advance 8 hours
        </button>
        <button
          disabled={!isActive || busy}
          onClick={() =>
            void run("reset", async (c) => {
              await c.reducers.resetSimulation({
                regionTag: REGION,
                simTimeMicros: SIM_START_MICROS,
              });
              await c.reducers.recomputeThreats({ regionTag: REGION });
            })
          }
        >
          Reset to Aug 25
        </button>
        <button
          disabled={!isActive || busy}
          onClick={() => void seekTo(PEAK_MICROS)}
        >
          Jump to Aug 28 peak
        </button>
      </div>
    </section>
  );
}
