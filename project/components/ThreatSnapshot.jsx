"use client";

export default function ThreatSnapshot({ threatRegions = [], siteThreats = [] }) {
  const counts = { none: 0, watch: 0, advisory: 0, warning: 0, critical: 0 };
  for (const t of siteThreats) counts[t.level] = (counts[t.level] ?? 0) + 1;

  return (
    <section className="threat-snapshot" aria-label="Threat snapshot">
      <h2>Threat snapshot</h2>
      <p>
        Sites — none {counts.none ?? 0}, watch {counts.watch ?? 0}, advisory{" "}
        {counts.advisory ?? 0}, warning {counts.warning ?? 0}, critical{" "}
        {counts.critical ?? 0}
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
  );
}
