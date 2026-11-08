"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const LEVEL_COLORS = {
  none: "#94a3b8",
  watch: "#38bdf8",
  advisory: "#facc15",
  warning: "#fb923c",
  critical: "#ef4444",
};

function microsToLabel(micros) {
  if (micros === undefined || micros === null) return "—";
  const ms = Number(micros / 1000n);
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

/**
 * Live Houston flood map.
 * Layers: OSM basemap, storm track (past), storm eye, gauge threat regions,
 * colored flood-mark threats, rescue requests/teams.
 */
export default function FloodMap({
  simTimeMicros,
  stormPoints = [],
  threatRegions = [],
  siteThreats = [],
  floodMarks = [],
  requests = [],
  teams = [],
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);

  const stormPath = useMemo(() => {
    if (!simTimeMicros) return [];
    return [...stormPoints]
      .filter((p) => p.timeMicros <= simTimeMicros)
      .sort((a, b) => (a.timeMicros < b.timeMicros ? -1 : 1));
  }, [stormPoints, simTimeMicros]);

  const currentStorm = stormPath.length ? stormPath[stormPath.length - 1] : null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [29.76, -95.37],
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 18,
    }).addTo(map);

    layersRef.current = {
      regions: L.layerGroup().addTo(map),
      track: L.layerGroup().addTo(map),
      marks: L.layerGroup().addTo(map),
      units: L.layerGroup().addTo(map),
    };
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    layers.regions.clearLayers();
    layers.track.clearLayers();
    layers.marks.clearLayers();
    layers.units.clearLayers();

    // Threat regions around gauges (modelled live flood influence)
    for (const region of threatRegions) {
      const color = LEVEL_COLORS[region.level] ?? LEVEL_COLORS.none;
      const circle = L.circle([region.lat, region.lon], {
        radius: Math.max(500, region.radiusKm * 1000),
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: region.level === "none" ? 0.05 : 0.22,
      });
      circle.bindPopup(
        `<strong>${region.name}</strong><br/>` +
          `Gage ${region.gageHeightFt.toFixed(1)} ft / stage ${region.floodStageFt.toFixed(0)} ft<br/>` +
          `Ratio ${(region.stageRatio * 100).toFixed(0)}% · ${region.level}<br/>` +
          `<em>Modelled threat region (not official inundation)</em>`,
      );
      layers.regions.addLayer(circle);

      L.circleMarker([region.lat, region.lon], {
        radius: 6,
        color: "#0f172a",
        weight: 1,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(region.name)
        .addTo(layers.regions);
    }

    // Storm track up to current sim time
    if (stormPath.length >= 2) {
      const latlngs = stormPath.map((p) => [p.lat, p.lon]);
      L.polyline(latlngs, { color: "#7c3aed", weight: 3, opacity: 0.85 }).addTo(
        layers.track,
      );
    }
    if (currentStorm) {
      L.circleMarker([currentStorm.lat, currentStorm.lon], {
        radius: 10,
        color: "#4c1d95",
        fillColor: "#a78bfa",
        fillOpacity: 0.95,
        weight: 2,
      })
        .bindPopup(
          `<strong>Harvey eye (sim)</strong><br/>` +
            `${microsToLabel(currentStorm.timeMicros)}<br/>` +
            `Wind ${currentStorm.windKt} kt · SSHS ${currentStorm.sshs}`,
        )
        .addTo(layers.track);

      // Storm influence halo (visual only; scoring uses same idea server-side)
      const wind = currentStorm.windKt || 0;
      L.circle([currentStorm.lat, currentStorm.lon], {
        radius: (40 + wind * 0.8) * 1000,
        color: "#a78bfa",
        weight: 1,
        dashArray: "4 6",
        fillColor: "#a78bfa",
        fillOpacity: 0.06,
      }).addTo(layers.track);
    }

    // Site threats / flood marks
    const threatById = new Map(
      siteThreats.map((t) => [t.objectId.toString(), t]),
    );
    for (const mark of floodMarks) {
      const threat = threatById.get(mark.objectId.toString());
      const level = threat?.level ?? "none";
      const color = LEVEL_COLORS[level] ?? LEVEL_COLORS.none;
      const radius = level === "critical" ? 7 : level === "warning" ? 6 : 4;
      const marker = L.circleMarker([mark.lat, mark.lon], {
        radius,
        color: "#0f172a",
        weight: 1,
        fillColor: color,
        fillOpacity: level === "none" ? 0.35 : 0.9,
      });
      const score = threat ? threat.threatScore.toFixed(0) : "—";
      marker.bindPopup(
        `<strong>Flood mark #${mark.objectId}</strong><br/>` +
          `${mark.waterbody ?? mark.label ?? "High-water mark"}<br/>` +
          `Threat ${level} (score ${score})<br/>` +
          (threat
            ? `storm ${threat.stormComponent.toFixed(0)} · gauge ${threat.gaugeComponent.toFixed(0)} · hist ${threat.historicalComponent.toFixed(0)}`
            : "Run recompute to score"),
      );
      layers.marks.addLayer(marker);
    }

    for (const req of requests) {
      L.marker([req.lat, req.lon], {
        title: `SOS #${req.id}`,
      })
        // Use a divIcon so we don't depend on Leaflet default image assets.
        .setIcon(
          L.divIcon({
            className: "",
            html: `<div style="background:#b91c1c;color:white;border-radius:999px;padding:2px 6px;font:12px system-ui;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)">SOS</div>`,
            iconSize: [36, 20],
            iconAnchor: [18, 10],
          }),
        )
        .bindPopup(`SOS #${req.id}<br/>${req.description}<br/>${req.status}`)
        .addTo(layers.units);
    }

    for (const team of teams) {
      L.marker([team.lat, team.lon])
        .setIcon(
          L.divIcon({
            className: "",
            html: `<div style="background:#0369a1;color:white;border-radius:6px;padding:2px 6px;font:12px system-ui;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)">TEAM</div>`,
            iconSize: [44, 20],
            iconAnchor: [22, 10],
          }),
        )
        .bindPopup(`${team.name}<br/>${team.status}`)
        .addTo(layers.units);
    }
  }, [
    stormPath,
    currentStorm,
    threatRegions,
    siteThreats,
    floodMarks,
    requests,
    teams,
  ]);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          height: 480,
          width: "100%",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #cbd5e1",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          background: "rgba(15,23,42,0.86)",
          color: "white",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.35,
          maxWidth: 280,
        }}
      >
        <div>
          <strong>Sim time:</strong> {microsToLabel(simTimeMicros)}
        </div>
        <div style={{ marginTop: 6 }}>
          {Object.entries(LEVEL_COLORS).map(([level, color]) => (
            <span key={level} style={{ marginRight: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: color,
                  marginRight: 4,
                }}
              />
              {level}
            </span>
          ))}
        </div>
        <div style={{ opacity: 0.8, marginTop: 6 }}>
          Circles = gauge threat regions · dots = flood-mark scores · purple =
          Harvey track
        </div>
      </div>
    </div>
  );
}
