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

const LEVEL_FILL = {
  none: 0.04,
  watch: 0.12,
  advisory: 0.16,
  warning: 0.2,
  critical: 0.22,
};

/** Victim urgency palette — separate from flood LEVEL_COLORS. */
const SOS_URGENCY = {
  critical: { bg: "#b91c1c", border: "#7f1d1d" }, // score >= 1000
  high: { bg: "#ea580c", border: "#9a3412" }, // >= 500
  medium: { bg: "#ca8a04", border: "#854d0e" }, // >= 200
  low: { bg: "#64748b", border: "#334155" },
};

function sosUrgency(score) {
  if (score >= 1000) return SOS_URGENCY.critical;
  if (score >= 500) return SOS_URGENCY.high;
  if (score >= 200) return SOS_URGENCY.medium;
  return SOS_URGENCY.low;
}

function microsToLabel(micros) {
  if (micros === undefined || micros === null) return "—";
  const ms = Number(micros / 1000n);
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

/**
 * Live Houston flood map for The WaterBoard.
 * Layers: OSM basemap, storm track, gauge flood zones, active flood sites.
 */
export default function FloodMap({
  simTimeMicros,
  stormPoints = [],
  threatRegions = [],
  siteThreats = [],
  floodMarks = [],
  requests = [],
  teams = [],
  assignments = [],
  selectedRequestId = null,
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

  const hotGages = useMemo(
    () =>
      threatRegions.filter((r) => r.level === "warning" || r.level === "critical")
        .length,
    [threatRegions],
  );
  const hotSites = useMemo(
    () =>
      siteThreats.filter((t) => t.level === "warning" || t.level === "critical")
        .length,
    [siteThreats],
  );

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

    // Hover-only stage discs. pointer-events none so they never steal the gage-dot hover.
    map.createPane("floodZones");
    const floodPane = map.getPane("floodZones");
    if (floodPane) {
      floodPane.style.zIndex = "350";
      floodPane.style.pointerEvents = "none";
    }

    // Keep popups above overlays / legend.
    const popupPane = map.getPane("popupPane");
    if (popupPane) popupPane.style.zIndex = "1000";
    const tooltipPane = map.getPane("tooltipPane");
    if (tooltipPane) tooltipPane.style.zIndex = "950";

    layersRef.current = {
      floods: L.layerGroup().addTo(map),
      regions: L.layerGroup().addTo(map),
      track: L.layerGroup().addTo(map),
      marks: L.layerGroup().addTo(map),
      units: L.layerGroup().addTo(map),
      labels: L.layerGroup().addTo(map),
    };
    mapRef.current = map;

    // Invalidate size after layout so tiles/popups position correctly.
    setTimeout(() => map.invalidateSize(), 50);

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
    layers.floods.clearLayers();
    layers.track.clearLayers();
    layers.marks.clearLayers();
    layers.units.clearLayers();
    layers.labels.clearLayers();

    // USGS gages: 4 imported sensors. Color follows live stage ratio — not hardcoded.
    // Stage discs appear only while hovering that gage's center dot.
    const showGageHalo = (region) => {
      layers.floods.clearLayers();
      const color = LEVEL_COLORS[region.level] ?? LEVEL_COLORS.none;
      const isHot = region.level === "warning" || region.level === "critical";
      L.circle([region.lat, region.lon], {
        radius: Math.max(800, region.radiusKm * 1000),
        pane: "floodZones",
        color,
        weight: isHot ? 2 : 1.5,
        fillColor: color,
        fillOpacity: LEVEL_FILL[region.level] ?? 0.1,
        interactive: false,
      }).addTo(layers.floods);
      if (isHot) {
        L.circle([region.lat, region.lon], {
          radius: Math.max(1200, region.radiusKm * 1400),
          pane: "floodZones",
          color,
          weight: 1,
          opacity: 0.35,
          fillColor: color,
          fillOpacity: 0.07,
          interactive: false,
        }).addTo(layers.floods);
      }
    };

    for (const region of threatRegions) {
      const color = LEVEL_COLORS[region.level] ?? LEVEL_COLORS.none;
      const isHot = region.level === "warning" || region.level === "critical";
      const gageLabel =
        `USGS gage · ${region.name}: ${region.level.toUpperCase()} ` +
        `(${region.gageHeightFt.toFixed(1)} ft)`;

      L.circleMarker([region.lat, region.lon], {
        radius: isHot ? 8 : 6,
        color: "#0f172a",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(gageLabel, {
          direction: "top",
          offset: [0, -8],
          opacity: 0.95,
        })
        .bindPopup(
          `<strong>USGS gage</strong> · ${region.name}<br/>` +
            `<span style="color:${color};font-weight:700;text-transform:uppercase">${region.level}</span><br/>` +
            `${region.gageHeightFt.toFixed(1)} ft / flood stage ${region.floodStageFt.toFixed(0)} ft ` +
            `(${(region.stageRatio * 100).toFixed(0)}%)<br/>` +
            `<em>Sensor reading at this sim time — not a mapped flood extent</em>`,
          { maxWidth: 280, autoPan: true },
        )
        .on("mouseover", () => showGageHalo(region))
        .on("mouseout", () => layers.floods.clearLayers())
        .addTo(layers.labels);
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
          `<strong>Harvey center (sim)</strong><br/>` +
            `${microsToLabel(currentStorm.timeMicros)}<br/>` +
            `Wind ${currentStorm.windKt} kt · SSHS ${currentStorm.sshs}`,
          { autoPan: true },
        )
        .addTo(layers.track);

      const wind = currentStorm.windKt || 0;
      L.circle([currentStorm.lat, currentStorm.lon], {
        radius: (40 + wind * 0.8) * 1000,
        color: "#a78bfa",
        weight: 1,
        dashArray: "4 6",
        fillColor: "#a78bfa",
        fillOpacity: 0.05,
        interactive: false,
      }).addTo(layers.track);
    }

    // Active flood-mark sites (skip quiet "none" dots so flooding stands out)
    const threatById = new Map(
      siteThreats.map((t) => [t.objectId.toString(), t]),
    );
    for (const mark of floodMarks) {
      const threat = threatById.get(mark.objectId.toString());
      const level = threat?.level ?? "none";
      if (level === "none") continue;

      const color = LEVEL_COLORS[level] ?? LEVEL_COLORS.none;
      const isHot = level === "warning" || level === "critical";
      const radius = isHot ? 8 : level === "advisory" ? 6 : 5;
      const marker = L.circleMarker([mark.lat, mark.lon], {
        radius,
        color: "#7f1d1d",
        weight: isHot ? 2 : 1,
        fillColor: color,
        fillOpacity: 0.95,
      });
      const score = threat ? threat.threatScore.toFixed(0) : "—";
      marker.bindPopup(
        `<strong>Flooding signal · mark #${mark.objectId}</strong><br/>` +
          `${mark.waterbody ?? mark.label ?? "High-water site"}<br/>` +
          `<span style="color:${color};font-weight:700;text-transform:uppercase">${level}</span> (score ${score})<br/>` +
          (threat
            ? `storm ${threat.stormComponent.toFixed(0)} · gauge ${threat.gaugeComponent.toFixed(0)} · hist ${threat.historicalComponent.toFixed(0)}`
            : "Run recompute to score"),
        { maxWidth: 280, autoPan: true },
      );
      layers.marks.addLayer(marker);
    }

    const openStatuses = new Set(["pending", "recommended", "assigned"]);
    const rankedOpen = [...requests]
      .filter((r) => openStatuses.has(r.status))
      .sort((a, b) => b.priorityScore - a.priorityScore);
    const rankById = new Map(
      rankedOpen.map((r, i) => [r.id.toString(), i + 1]),
    );

    const teamById = new Map(teams.map((t) => [t.id.toString(), t]));
    const requestById = new Map(requests.map((r) => [r.id.toString(), r]));

    // Discrete TEAM↔SOS match lines (no live travel).
    for (const a of assignments) {
      if (a.status !== "recommended" && a.status !== "confirmed" && a.status !== "en_route") {
        continue;
      }
      const team = teamById.get(a.teamId.toString());
      const req = requestById.get(a.requestId.toString());
      if (!team || !req) continue;
      const isConfirmed = a.status === "confirmed" || a.status === "en_route";
      L.polyline(
        [
          [team.lat, team.lon],
          [req.lat, req.lon],
        ],
        {
          color: isConfirmed ? "#0369a1" : "#94a3b8",
          weight: isConfirmed ? 3 : 2,
          opacity: isConfirmed ? 0.9 : 0.7,
          dashArray: isConfirmed ? null : "6 6",
        },
      )
        .bindTooltip(
          `${team.name} → SOS #${req.id} · ${a.status}`,
          { sticky: true, opacity: 0.95 },
        )
        .addTo(layers.units);
    }

    for (const req of requests) {
      const score = req.priorityScore ?? 0;
      const urgency = sosUrgency(score);
      const rank = rankById.get(req.id.toString());
      const isSelected =
        selectedRequestId != null &&
        String(selectedRequestId) === String(req.id);
      const isDone = req.status === "completed" || req.status === "cancelled";
      const isAssigned = req.status === "assigned";
      const opacity = isDone ? 0.4 : isAssigned ? 0.75 : 1;
      const label = rank
        ? `#${rank} SOS`
        : isDone
          ? "DONE"
          : "SOS";
      const border = isSelected ? "3px solid #fbbf24" : `2px solid ${urgency.border}`;
      const flags = [
        req.medicalUrgent ? "medical" : null,
        req.stranded ? "stranded" : null,
        req.needsTransport ? "transport" : null,
        `${req.peopleCount ?? "?"} people`,
      ]
        .filter(Boolean)
        .join(" · ");

      L.marker([req.lat, req.lon], {
        title: `SOS #${req.id}`,
        zIndexOffset: isSelected ? 700 : 500 + (rank ? 50 - Math.min(rank, 49) : 0),
        opacity,
      })
        .setIcon(
          L.divIcon({
            className: "waterboard-divicon",
            html: `<div style="background:${urgency.bg};color:white;border-radius:999px;padding:3px 8px;font:12px/1.2 system-ui;border:${border};box-shadow:0 1px 4px rgba(0,0,0,.4);opacity:${opacity}">${label}</div>`,
            iconSize: [rank ? 52 : 40, 22],
            iconAnchor: [rank ? 26 : 20, 11],
          }),
        )
        .bindPopup(
          `<strong>SOS #${req.id}</strong> · score ${score}<br/>` +
            `<span style="text-transform:uppercase;font-weight:700">${req.status}</span>` +
            (rank ? ` · queue #${rank}` : "") +
            `<br/>${flags}<br/>` +
            `${req.description ?? ""}`,
          { maxWidth: 280, autoPan: true },
        )
        .addTo(layers.units);
    }

    const redCrossIcon = L.icon({
      iconUrl: "/redcross.png",
      iconRetinaUrl: "/redcross.png",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -12],
      className: "waterboard-redcross-icon",
    });

    for (const team of teams) {
      const busy = team.status === "busy";
      L.marker([team.lat, team.lon], {
        zIndexOffset: 400,
        opacity: busy ? 0.55 : 1,
        title: team.name,
      })
        .setIcon(redCrossIcon)
        .bindPopup(
          `<strong>${team.name}</strong><br/>${team.status}` +
            (team.hasMedical ? " · medical" : "") +
            (team.hasBoat ? " · boat" : "") +
            `<br/>capacity ${team.capacity}`,
          { autoPan: true },
        )
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
    assignments,
    selectedRequestId,
  ]);

  return (
    <div className="waterboard-map-shell" style={{ position: "relative" }}>
      <style>{`
        .waterboard-map-shell .leaflet-container {
          font: 13px/1.35 system-ui, sans-serif;
        }
        .waterboard-map-shell .leaflet-popup-pane {
          z-index: 1000 !important;
        }
        .waterboard-map-shell .leaflet-tooltip-pane {
          z-index: 950 !important;
        }
        .waterboard-map-shell .leaflet-popup {
          margin-bottom: 16px;
        }
        .waterboard-map-shell .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
        }
        .waterboard-map-shell .leaflet-tooltip {
          background: rgba(15, 23, 42, 0.92);
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,.35);
        }
        .waterboard-map-shell .leaflet-tooltip-top:before {
          border-top-color: rgba(15, 23, 42, 0.92);
        }
        .waterboard-divicon {
          background: transparent;
          border: 0;
        }
      `}</style>

      {(hotGages > 0 || hotSites > 0) && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 900,
            background: "#b91c1c",
            color: "white",
            padding: "8px 14px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.3,
            boxShadow: "0 4px 16px rgba(185,28,28,.45)",
            pointerEvents: "none",
          }}
        >
          {hotGages > 0
            ? `${hotGages} USGS gage${hotGages === 1 ? "" : "s"} above flood stage`
            : null}
          {hotGages > 0 && hotSites > 0 ? " · " : null}
          {hotSites > 0
            ? `${hotSites} high-water site${hotSites === 1 ? "" : "s"}`
            : null}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          height: 520,
          width: "100%",
          borderRadius: 12,
          // Do NOT use overflow:hidden — it clips Leaflet popups.
          border: "1px solid #cbd5e1",
          background: "#e2e8f0",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          zIndex: 800,
          background: "rgba(15,23,42,0.9)",
          color: "white",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.35,
          maxWidth: 300,
          pointerEvents: "none",
        }}
      >
        <div>
          <strong>Sim time:</strong> {microsToLabel(simTimeMicros)}
        </div>
        <div style={{ marginTop: 6 }}>
          {Object.entries(LEVEL_COLORS).map(([level, color]) => (
            <span key={level} style={{ marginRight: 8, whiteSpace: "nowrap" }}>
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
        <div style={{ opacity: 0.85, marginTop: 6 }}>
          Dots = surveyed high-water marks · hover a gage center for its stage
          halo · purple = Harvey track
        </div>
      </div>
    </div>
  );
}
