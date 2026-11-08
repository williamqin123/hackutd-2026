"use client";

import { useState, useEffect, useCallback } from "react";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { tables } from "../../../src/module_bindings";
import ThemeToggle from "../../../components/ThemeToggle";
import "../sos.css";

// Diverse curated locations across Harris County (flood areas during Hurricane Harvey)
const HARRIS_COUNTY_LOCATIONS = [
  {
    name: "Meyerland (Brays Bayou)",
    address: "4920 S Braeswood Blvd, Meyerland, Harris County, TX",
    lat: 29.6741,
    lon: -95.4678,
  },
  {
    name: "Cypress Creek",
    address: "11900 Huffmeister Rd, Cypress, Harris County, TX",
    lat: 29.9691,
    lon: -95.6972,
  },
  {
    name: "Greenspoint (Greens Bayou)",
    address: "12250 Greenspoint Dr, Greenspoint, Harris County, TX",
    lat: 29.9167,
    lon: -95.4089,
  },
  {
    name: "Kingwood (San Jacinto River)",
    address: "2800 Kingwood Dr, Kingwood, Harris County, TX",
    lat: 30.0505,
    lon: -95.1847,
  },
  {
    name: "Memorial / Buffalo Bayou",
    address: "9400 Memorial Dr, Memorial, Harris County, TX",
    lat: 29.7628,
    lon: -95.5342,
  },
  {
    name: "The Heights (White Oak Bayou)",
    address: "1200 Heights Blvd, The Heights, Harris County, TX",
    lat: 29.7997,
    lon: -95.3982,
  },
  {
    name: "Addicks Reservoir Area",
    address: "19800 Park Row Dr, Katy, Harris County, TX",
    lat: 29.7858,
    lon: -95.7725,
  },
  {
    name: "Bellaire / Brays Bayou",
    address: "5100 Bellaire Blvd, Bellaire, Harris County, TX",
    lat: 29.7058,
    lon: -95.4588,
  },
  {
    name: "Spring Branch",
    address: "8200 Long Point Rd, Spring Branch, Harris County, TX",
    lat: 29.8055,
    lon: -95.5133,
  },
  {
    name: "Pasadena (Armand Bayou)",
    address: "3400 Fairmont Pkwy, Pasadena, Harris County, TX",
    lat: 29.6911,
    lon: -95.2091,
  },
  {
    name: "Baytown (Cedar Bayou)",
    address: "1600 Garth Rd, Baytown, Harris County, TX",
    lat: 29.7355,
    lon: -94.9774,
  },
  {
    name: "Humble (Lake Houston)",
    address: "19500 US-59, Humble, Harris County, TX",
    lat: 29.9988,
    lon: -95.2622,
  },
  {
    name: "Aldine (Halls Bayou)",
    address: "11100 Airline Dr, Aldine, Harris County, TX",
    lat: 29.9016,
    lon: -95.3783,
  },
  {
    name: "Kashmere Gardens (Hunting Bayou)",
    address: "4100 Lockwood Dr, Kashmere Gardens, Harris County, TX",
    lat: 29.803,
    lon: -95.325,
  },
  {
    name: "Sunnyside (Sims Bayou)",
    address: "4500 Reed Rd, Sunnyside, Harris County, TX",
    lat: 29.6631,
    lon: -95.3683,
  },
  {
    name: "Clear Lake / NASA Area",
    address: "18100 Upper Bay Rd, Clear Lake, Harris County, TX",
    lat: 29.5544,
    lon: -95.1219,
  },
  {
    name: "Tomball (Spring Creek)",
    address: "600 W Main St, Tomball, Harris County, TX",
    lat: 30.0972,
    lon: -95.6161,
  },
  {
    name: "Barker Reservoir Area",
    address: "1500 Barker Cypress Rd, Harris County, TX",
    lat: 29.778,
    lon: -95.688,
  },
];

function getRandomHarrisCountyLocation() {
  const index = Math.floor(Math.random() * HARRIS_COUNTY_LOCATIONS.length);
  const loc = HARRIS_COUNTY_LOCATIONS[index];
  // Subtle realistic jitter within ~150 meters
  const jitterLat = (Math.random() - 0.5) * 0.003;
  const jitterLon = (Math.random() - 0.5) * 0.003;
  const lat = Number((loc.lat + jitterLat).toFixed(5));
  const lon = Number((loc.lon + jitterLon).toFixed(5));
  return {
    label: `${loc.address} (${lat}, ${lon})`,
    name: loc.name,
    lat,
    lon,
  };
}

export default function MobileSosPage() {
  const { isActive, getConnection } = useSpacetimeDB();

  // Subscriptions to both tables
  const [sosRecords] = useTable(tables.sos);
  const [rescueRequests] = useTable(tables.rescueRequest);

  // Initialize with a random location in Harris County
  const [randomInit] = useState(() => {
    const { address, name, lat, lon } = HARRIS_COUNTY_LOCATIONS[0];
    return { label: `${address} (${lat}, ${lon})`, name, lat, lon };
  });
  const [location, setLocation] = useState(randomInit.label);
  const [coords, setCoords] = useState({
    lat: randomInit.lat,
    lon: randomInit.lon,
  });
  const [activeAreaName, setActiveAreaName] = useState(randomInit.name);

  // Geolocation states
  const [geoStatus, setGeoStatus] = useState("idle"); // 'idle' | 'locating' | 'success' | 'error' | 'harris'
  const [geoErrorMsg, setGeoErrorMsg] = useState("");
  const [geoAccuracy, setGeoAccuracy] = useState(null);

  // Dialog & SOS submit states
  const [showDialog, setShowDialog] = useState(false);
  const [sosText, setSosText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Keep the server and first browser render identical, then choose a demo
  // location. A hydration reset would also discard the restored theme.
  useEffect(() => {
    const next = getRandomHarrisCountyLocation();
    setLocation(next.label);
    setCoords({ lat: next.lat, lon: next.lon });
    setActiveAreaName(next.name);
  }, []);

  // Quick emergency tags
  const quickTags = [
    "🌊 Rising Floodwater",
    "🏠 Trapped on Roof",
    "🏥 Medical Emergency",
    "👶 Elderly / Infant Present",
    "🚤 Need Boat Evacuation",
    "⚡ Power Outage",
  ];

  // Ensure body and html background fill screen edge-to-edge on wide desktop viewports
  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = "var(--sos-page-bg)";
    document.documentElement.style.backgroundColor = "var(--sos-page-bg)";
    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, []);

  // Re-roll random Harris County location
  const handleShuffleHarrisLocation = useCallback(() => {
    const nextLoc = getRandomHarrisCountyLocation();
    setLocation(nextLoc.label);
    setCoords({ lat: nextLoc.lat, lon: nextLoc.lon });
    setActiveAreaName(nextLoc.name);
    setGeoStatus("harris");
    setGeoErrorMsg("");
    setGeoAccuracy(null);
  }, []);

  // Update coords if user manually types coordinates into the input
  const handleLocationInputChange = (newVal) => {
    setLocation(newVal);
    const match = newVal.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lon = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lon)) {
        setCoords({ lat, lon });
      }
    }
  };

  // Device GPS Geolocation trigger
  const handleUseGeolocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoStatus("error");
      setGeoErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    setGeoStatus("locating");
    setGeoErrorMsg("");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const lat = Number(latitude.toFixed(5));
        const lon = Number(longitude.toFixed(5));
        setCoords({ lat, lon });
        setGeoAccuracy(Math.round(accuracy));
        setActiveAreaName("Current Device GPS");

        const coordString = `${lat}, ${lon}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2800);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { signal: controller.signal },
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            const addressParts = [];
            if (data.address) {
              if (data.address.road) addressParts.push(data.address.road);
              if (data.address.neighbourhood || data.address.suburb) {
                addressParts.push(
                  data.address.neighbourhood || data.address.suburb,
                );
              }
              if (
                data.address.city ||
                data.address.town ||
                data.address.county
              ) {
                addressParts.push(
                  data.address.city || data.address.town || data.address.county,
                );
              }
              if (data.address.state) addressParts.push(data.address.state);
            }
            if (addressParts.length > 0) {
              setLocation(`${addressParts.join(", ")} (${coordString})`);
            } else if (data.display_name) {
              setLocation(`${data.display_name.slice(0, 75)} (${coordString})`);
            } else {
              setLocation(`Device Location (${coordString})`);
            }
          } else {
            setLocation(`Device Location (${coordString})`);
          }
        } catch {
          setLocation(`Device Location (${coordString})`);
        }

        setGeoStatus("success");
      },
      (err) => {
        setGeoStatus("error");
        let msg = "Unable to determine GPS location.";
        if (err.code === 1)
          msg = "Location permission denied. Please enter your address.";
        else if (err.code === 2) msg = "Position unavailable.";
        else if (err.code === 3) msg = "Location request timed out.";
        setGeoErrorMsg(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }, []);

  // Quick tag append handler
  const handleAddTag = (tag) => {
    setSosText((prev) => {
      if (!prev.trim()) return tag;
      if (prev.includes(tag)) return prev;
      return `${prev.trim()}, ${tag}`;
    });
  };

  // Submit SOS: explicitly calls both createRescueRequest AND addSos
  const handleSubmitSos = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const targetLocation = location.trim() || "Harris County, Texas";
    const targetText = sosText.trim() || "Emergency SOS distress broadcast";
    const nowTimestamp = new Date();

    // Parse urgency flags from description
    const isMedical = /medic|doctor|injur|oxygen|hospital|sick|ambulance/i.test(
      targetText,
    );
    const isStranded =
      /strand|trap|roof|attic|water rising|stuck|second floor/i.test(
        targetText,
      ) || true;
    const isTransport =
      /boat|evac|transport|rescue team/i.test(targetText) || true;

    // Detect people count
    let peopleCount = 1;
    const peopleMatch = targetText.match(
      /(\d+)\s*(?:people|persons|adults|kids|children|family members)/i,
    );
    if (peopleMatch) {
      const p = parseInt(peopleMatch[1], 10);
      if (!isNaN(p) && p >= 1 && p <= 50) peopleCount = p;
    }

    try {
      const conn = getConnection();
      if (!conn || !isActive) {
        throw new Error(
          "Waiting for connection to SpacetimeDB… please check your connection and try again.",
        );
      }

      // 1. Explicitly invoke createRescueRequest reducer to create the rescue_request record
      if (conn.reducers.createRescueRequest) {
        await conn.reducers.createRescueRequest({
          lat: coords.lat,
          lon: coords.lon,
          peopleCount: peopleCount,
          medicalUrgent: isMedical,
          stranded: isStranded,
          needsTransport: isTransport,
          description: `[Mobile SOS] ${targetText} (Loc: ${targetLocation})`,
        });
      }

      // 2. Explicitly invoke addSos reducer to create the record in the 'sos' table
      if (conn.reducers.addSos) {
        await conn.reducers.addSos({
          location: targetLocation,
          text: targetText,
        });
      } else if (conn.reducers.createSos) {
        await conn.reducers.createSos({
          location: targetLocation,
          text: targetText,
        });
      }

      setLastSubmission({
        location: targetLocation,
        text: targetText,
        lat: coords.lat,
        lon: coords.lon,
        peopleCount,
        medicalUrgent: isMedical,
        timestamp: nowTimestamp.toLocaleString(),
      });
      setSubmitSuccess(true);
    } catch (err) {
      console.error("Failed to submit SOS:", err);
      setSubmitError(err?.message || "Failed to transmit SOS to SpacetimeDB.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSubmitSuccess(false);
    setSubmitError(null);
  };

  return (
    <main className="mobile-sos-root">
      {/* Top Header / Status bar */}
      <header className="sos-header">
        <div className="sos-top-bar">
          <div className="sos-status-indicator">
            <span
              className={`sos-status-dot ${isActive ? "online" : "connecting"}`}
            />
            <span className="sos-status-label">
              {isActive ? "SPACETIMEDB ONLINE" : "CONNECTING TO GRID…"}
            </span>
          </div>

          <span className="sos-grid-badge">HARRIS COUNTY</span>
        </div>

        <h1 className="sos-title">Emergency Distress Beacon</h1>
        <p className="sos-subtitle">
          Direct link to The WaterBoard & Rescue Dispatch
        </p>
        <ThemeToggle />
      </header>

      <section className="sos-geo-section">
        <div className="sos-geo-header">
          <label htmlFor="geo-input" className="sos-geo-label">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fca5a5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Beacon Location
          </label>

          <span className="sos-geo-area-tag">
            📍 {activeAreaName || "Harris County"}
          </span>
        </div>

        {/* Location input row */}
        <div className="sos-geo-input-row">
          <div className="sos-geo-input-wrap">
            <input
              id="geo-input"
              type="text"
              value={location}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              placeholder="Harris County address or coordinates"
              className="sos-geo-input"
            />
          </div>

          <button
            type="button"
            onClick={handleUseGeolocation}
            disabled={geoStatus === "locating"}
            title="Detect device GPS location"
            className={`sos-gps-btn ${geoStatus === "locating" ? "locating" : ""}`}
          >
            {geoStatus === "locating" ? (
              <>
                <svg
                  className="sos-radar-spinner"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    strokeDasharray="16"
                    strokeDashoffset="4"
                  />
                </svg>
                Locating…
              </>
            ) : (
              <>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <line x1="12" y1="2" x2="12" y2="5" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="5" y2="12" />
                  <line x1="19" y1="12" x2="22" y2="12" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                GPS
              </>
            )}
          </button>
        </div>

        {/* Harris County controls & status */}
        <div className="sos-geo-footer">
          <span className="sos-coords-label">
            Coords:{" "}
            <strong>
              {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
            </strong>
            {geoAccuracy ? ` (±${geoAccuracy}m)` : ""}
          </span>

          <button
            type="button"
            onClick={handleShuffleHarrisLocation}
            className="sos-shuffle-btn"
          >
            🎲 Pick Random Harris Co.
          </button>
        </div>

        {geoErrorMsg && <div className="sos-geo-error">{geoErrorMsg}</div>}
      </section>

      {/* Giant SOS Button Area with concentric pulse rings */}
      <section className="sos-button-section">
        <div className="sos-pulse-ring ring-1" />
        <div className="sos-pulse-ring ring-2" />
        <div className="sos-pulse-ring ring-3" />
        <div className="sos-pulse-ring ring-4" />

        <button
          type="button"
          onClick={() => {
            setShowDialog(true);
            setSubmitSuccess(false);
            setSubmitError(null);
          }}
          className="sos-giant-button"
          aria-label="Trigger Emergency SOS Dialog"
        >
          <svg
            className="sos-btn-icon"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
            <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
            <circle cx="12" cy="12" r="2" fill="#ffffff" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>

          <span className="sos-btn-text">SOS</span>

          <span className="sos-btn-subtext">TAP TO TRANSMIT</span>
        </button>
      </section>

      {/* Bottom Footer & Stats */}
      <footer className="sos-footer">
        <div className="sos-footer-card">
          <p className="sos-footer-title">
            ⚠️ Tap SOS button to transmit rescue coordinates & situation
          </p>
          <p className="sos-footer-desc">
            Calls SpacetimeDB to create <strong>rescue_request</strong> &{" "}
            <strong>sos</strong> records.
          </p>
        </div>

        {/* Live Counters */}
        <div className="sos-counters-row">
          <span className="sos-counter-item">
            <span className="sos-counter-dot requests" />
            <strong>{rescueRequests?.length ?? 0}</strong> rescue requests
          </span>
          <span className="sos-counter-item">
            <span className="sos-counter-dot logs" />
            <strong>{sosRecords?.length ?? 0}</strong> SOS logs
          </span>
        </div>
      </footer>

      {/* SOS Modal Dialog */}
      {showDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          className="sos-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              handleCloseDialog();
            }
          }}
        >
          <div className="sos-modal-card">
            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseDialog}
              disabled={isSubmitting}
              className="sos-modal-close-btn"
            >
              ✕
            </button>

            {submitSuccess ? (
              /* Success confirmation state */
              <div className="sos-success-view">
                <div className="sos-success-icon-wrap">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>

                <div>
                  <h2 id="dialog-title" className="sos-modal-title">
                    SOS Transmitted Successfully!
                  </h2>
                  <p className="sos-modal-subtitle">
                    Created <strong>rescue_request</strong> record on The
                    WaterBoard dispatch & saved to <strong>sos</strong> table.
                  </p>
                </div>

                {/* Broadcast details card */}
                {lastSubmission && (
                  <div className="sos-success-card">
                    <div>
                      <span className="sos-success-row-label-green">
                        ✓ Rescue Request:{" "}
                      </span>
                      <span className="sos-success-row-value">
                        Pending dispatch queue
                      </span>
                    </div>
                    <div>
                      <span className="sos-success-row-label">
                        Coordinates:{" "}
                      </span>
                      <span className="sos-success-row-value">
                        {lastSubmission.lat}, {lastSubmission.lon}
                      </span>
                    </div>
                    <div>
                      <span className="sos-success-row-label">Location: </span>
                      <span className="sos-success-row-value">
                        {lastSubmission.location}
                      </span>
                    </div>
                    <div>
                      <span className="sos-success-row-label">Message: </span>
                      <span className="sos-success-row-value">
                        {lastSubmission.text}
                      </span>
                    </div>
                    <div>
                      <span className="sos-success-row-label">Timestamp: </span>
                      <span className="sos-success-row-value">
                        {lastSubmission.timestamp}
                      </span>
                    </div>
                  </div>
                )}

                <div className="sos-success-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitSuccess(false);
                      setSosText("");
                    }}
                    className="sos-send-another-btn"
                  >
                    Send Another
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    className="sos-done-btn"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Dialog form: Text box + submit button */
              <form onSubmit={handleSubmitSos} className="sos-form">
                <div>
                  <div className="sos-distress-badge">
                    <span className="sos-distress-dot" />
                    Distress Broadcast
                  </div>
                  <h2 id="dialog-title" className="sos-modal-title">
                    Emergency Details
                  </h2>
                  <p className="sos-modal-subtitle">
                    Enter situation info to create a priority rescue request.
                  </p>
                </div>

                {/* Confirmed Location snippet */}
                <div className="sos-location-preview-box">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div className="sos-loc-preview-title">
                      Transmitting From (Harris County)
                    </div>
                    <div className="sos-loc-preview-value">{location}</div>
                  </div>
                </div>

                {/* Quick situation chips */}
                <div className="sos-quick-tags-section">
                  <div className="sos-quick-tags-title">
                    Quick Situation Tap:
                  </div>
                  <div className="sos-quick-tags-list">
                    {quickTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="sos-tag-chip"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Box for Emergency Message */}
                <div className="sos-textarea-wrap">
                  <label
                    htmlFor="sos-text-input"
                    className="sos-textarea-label"
                  >
                    Situation Description & Needs:
                  </label>
                  <textarea
                    id="sos-text-input"
                    rows={4}
                    value={sosText}
                    onChange={(e) => setSosText(e.target.value)}
                    placeholder="Describe your situation: e.g. 3 people trapped on roof, floodwater at 4ft, elderly diabetic needs medicine, roof accessible..."
                    className="sos-textarea"
                  />
                </div>

                {submitError && (
                  <div className="sos-form-error">⚠️ {submitError}</div>
                )}

                {/* Actions: Cancel & Submit Button */}
                <div className="sos-modal-actions">
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                    className="sos-cancel-btn"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !isActive}
                    className="sos-submit-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="sos-radar-spinner"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            strokeDasharray="16"
                            strokeDashoffset="4"
                          />
                        </svg>
                        Transmitting…
                      </>
                    ) : (
                      <>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        {isActive ? "Submit SOS" : "Connecting…"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
