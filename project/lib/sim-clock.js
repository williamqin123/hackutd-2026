export const REGION = "houston-harvey";
export const HOUR_MICROS = 3_600_000_000n;
export const EIGHT_HOUR_MICROS = 8n * HOUR_MICROS;
export const SIM_START_MICROS = 1503619200000000n; // 2017-08-25T00:00:00Z
export const SIM_END_MICROS = 1504310400000000n; // 2017-09-02T00:00:00Z
export const PEAK_MICROS = 1503921600000000n; // 2017-08-28T12:00:00Z
export const PLAY_INTERVAL_MS = 2500;

export function microsLabel(micros) {
  if (micros === undefined || micros === null) return "—";
  return (
    new Date(Number(micros / 1000n)).toISOString().replace("T", " ").slice(0, 16) +
    "Z"
  );
}

export function clampMicros(value) {
  if (value < SIM_START_MICROS) return SIM_START_MICROS;
  if (value > SIM_END_MICROS) return SIM_END_MICROS;
  return value;
}

export function microsToSlider(micros) {
  const span = Number(SIM_END_MICROS - SIM_START_MICROS);
  const offset = Number((micros ?? SIM_START_MICROS) - SIM_START_MICROS);
  return Math.max(0, Math.min(1000, Math.round((offset / span) * 1000)));
}

export function sliderToMicros(sliderValue) {
  const span = SIM_END_MICROS - SIM_START_MICROS;
  return clampMicros(SIM_START_MICROS + (span * BigInt(sliderValue)) / 1000n);
}
