'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from '../../../src/module_bindings';

// Diverse curated locations across Harris County (flood areas during Hurricane Harvey)
const HARRIS_COUNTY_LOCATIONS = [
  {
    name: 'Meyerland (Brays Bayou)',
    address: '4920 S Braeswood Blvd, Meyerland, Harris County, TX',
    lat: 29.6741,
    lon: -95.4678,
  },
  {
    name: 'Cypress Creek',
    address: '11900 Huffmeister Rd, Cypress, Harris County, TX',
    lat: 29.9691,
    lon: -95.6972,
  },
  {
    name: 'Greenspoint (Greens Bayou)',
    address: '12250 Greenspoint Dr, Greenspoint, Harris County, TX',
    lat: 29.9167,
    lon: -95.4089,
  },
  {
    name: 'Kingwood (San Jacinto River)',
    address: '2800 Kingwood Dr, Kingwood, Harris County, TX',
    lat: 30.0505,
    lon: -95.1847,
  },
  {
    name: 'Memorial / Buffalo Bayou',
    address: '9400 Memorial Dr, Memorial, Harris County, TX',
    lat: 29.7628,
    lon: -95.5342,
  },
  {
    name: 'The Heights (White Oak Bayou)',
    address: '1200 Heights Blvd, The Heights, Harris County, TX',
    lat: 29.7997,
    lon: -95.3982,
  },
  {
    name: 'Addicks Reservoir Area',
    address: '19800 Park Row Dr, Katy, Harris County, TX',
    lat: 29.7858,
    lon: -95.7725,
  },
  {
    name: 'Bellaire / Brays Bayou',
    address: '5100 Bellaire Blvd, Bellaire, Harris County, TX',
    lat: 29.7058,
    lon: -95.4588,
  },
  {
    name: 'Spring Branch',
    address: '8200 Long Point Rd, Spring Branch, Harris County, TX',
    lat: 29.8055,
    lon: -95.5133,
  },
  {
    name: 'Pasadena (Armand Bayou)',
    address: '3400 Fairmont Pkwy, Pasadena, Harris County, TX',
    lat: 29.6911,
    lon: -95.2091,
  },
  {
    name: 'Baytown (Cedar Bayou)',
    address: '1600 Garth Rd, Baytown, Harris County, TX',
    lat: 29.7355,
    lon: -94.9774,
  },
  {
    name: 'Humble (Lake Houston)',
    address: '19500 US-59, Humble, Harris County, TX',
    lat: 29.9988,
    lon: -95.2622,
  },
  {
    name: 'Aldine (Halls Bayou)',
    address: '11100 Airline Dr, Aldine, Harris County, TX',
    lat: 29.9016,
    lon: -95.3783,
  },
  {
    name: 'Kashmere Gardens (Hunting Bayou)',
    address: '4100 Lockwood Dr, Kashmere Gardens, Harris County, TX',
    lat: 29.8030,
    lon: -95.3250,
  },
  {
    name: 'Sunnyside (Sims Bayou)',
    address: '4500 Reed Rd, Sunnyside, Harris County, TX',
    lat: 29.6631,
    lon: -95.3683,
  },
  {
    name: 'Clear Lake / NASA Area',
    address: '18100 Upper Bay Rd, Clear Lake, Harris County, TX',
    lat: 29.5544,
    lon: -95.1219,
  },
  {
    name: 'Tomball (Spring Creek)',
    address: '600 W Main St, Tomball, Harris County, TX',
    lat: 30.0972,
    lon: -95.6161,
  },
  {
    name: 'Barker Reservoir Area',
    address: '1500 Barker Cypress Rd, Harris County, TX',
    lat: 29.7780,
    lon: -95.6880,
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
  const [randomInit] = useState(() => getRandomHarrisCountyLocation());
  const [location, setLocation] = useState(randomInit.label);
  const [coords, setCoords] = useState({ lat: randomInit.lat, lon: randomInit.lon });
  const [activeAreaName, setActiveAreaName] = useState(randomInit.name);

  // Geolocation states
  const [geoStatus, setGeoStatus] = useState('idle'); // 'idle' | 'locating' | 'success' | 'error' | 'harris'
  const [geoErrorMsg, setGeoErrorMsg] = useState('');
  const [geoAccuracy, setGeoAccuracy] = useState(null);

  // Dialog & SOS submit states
  const [showDialog, setShowDialog] = useState(false);
  const [sosText, setSosText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  // Quick emergency tags
  const quickTags = [
    '🌊 Rising Floodwater',
    '🏠 Trapped on Roof',
    '🏥 Medical Emergency',
    '👶 Elderly / Infant Present',
    '🚤 Need Boat Evacuation',
    '⚡ Power Outage',
  ];

  // Re-roll random Harris County location
  const handleShuffleHarrisLocation = useCallback(() => {
    const nextLoc = getRandomHarrisCountyLocation();
    setLocation(nextLoc.label);
    setCoords({ lat: nextLoc.lat, lon: nextLoc.lon });
    setActiveAreaName(nextLoc.name);
    setGeoStatus('harris');
    setGeoErrorMsg('');
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
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('error');
      setGeoErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setGeoStatus('locating');
    setGeoErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const lat = Number(latitude.toFixed(5));
        const lon = Number(longitude.toFixed(5));
        setCoords({ lat, lon });
        setGeoAccuracy(Math.round(accuracy));
        setActiveAreaName('Current Device GPS');

        const coordString = `${lat}, ${lon}`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2800);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            const addressParts = [];
            if (data.address) {
              if (data.address.road) addressParts.push(data.address.road);
              if (data.address.neighbourhood || data.address.suburb) {
                addressParts.push(data.address.neighbourhood || data.address.suburb);
              }
              if (data.address.city || data.address.town || data.address.county) {
                addressParts.push(data.address.city || data.address.town || data.address.county);
              }
              if (data.address.state) addressParts.push(data.address.state);
            }
            if (addressParts.length > 0) {
              setLocation(`${addressParts.join(', ')} (${coordString})`);
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

        setGeoStatus('success');
      },
      (err) => {
        setGeoStatus('error');
        let msg = 'Unable to determine GPS location.';
        if (err.code === 1) msg = 'Location permission denied. Please enter your address.';
        else if (err.code === 2) msg = 'Position unavailable.';
        else if (err.code === 3) msg = 'Location request timed out.';
        setGeoErrorMsg(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
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

    const targetLocation = location.trim() || 'Harris County, Texas';
    const targetText = sosText.trim() || 'Emergency SOS distress broadcast';
    const nowTimestamp = new Date();

    // Parse urgency flags from description
    const isMedical = /medic|doctor|injur|oxygen|hospital|sick|ambulance/i.test(targetText);
    const isStranded = /strand|trap|roof|attic|water rising|stuck|second floor/i.test(targetText) || true;
    const isTransport = /boat|evac|transport|rescue team/i.test(targetText) || true;

    // Detect people count
    let peopleCount = 1;
    const peopleMatch = targetText.match(/(\d+)\s*(?:people|persons|adults|kids|children|family members)/i);
    if (peopleMatch) {
      const p = parseInt(peopleMatch[1], 10);
      if (!isNaN(p) && p >= 1 && p <= 50) peopleCount = p;
    }

    try {
      const conn = getConnection();
      if (!conn) {
        throw new Error('Waiting for connection to SpacetimeDB… please check your connection and try again.');
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
      console.error('Failed to submit SOS:', err);
      setSubmitError(err?.message || 'Failed to transmit SOS to SpacetimeDB.');
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
      <style jsx global>{`
        @keyframes pulseWave {
          0% {
            transform: translate(-50%, -50%) scale(0.85);
            opacity: 0.9;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.8), inset 0 0 15px rgba(255, 100, 100, 0.4);
          }
          40% {
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(2.4);
            opacity: 0;
            box-shadow: 0 0 40px rgba(255, 255, 255, 0);
          }
        }

        @keyframes sosBreathing {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 0 35px rgba(255, 255, 255, 0.45),
              0 14px 45px rgba(0, 0, 0, 0.65),
              inset 0 4px 10px rgba(255, 255, 255, 0.6);
          }
          50% {
            transform: scale(1.042);
            box-shadow:
              0 0 65px rgba(255, 255, 255, 0.85),
              0 22px 60px rgba(0, 0, 0, 0.75),
              inset 0 6px 16px rgba(255, 255, 255, 0.8);
          }
        }

        @keyframes beaconGlow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        @keyframes modalPop {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes radarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .mobile-sos-root {
          min-height: 100vh;
          min-height: 100dvh;
          width: 100%;
          background: radial-gradient(circle at 50% 25%, #ef4444 0%, #dc2626 35%, #991b1b 75%, #450a0a 100%);
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 24px;
          box-sizing: border-box;
          overflow-x: hidden;
          position: relative;
        }

        .mobile-sos-root::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 0);
          background-size: 24px 24px;
          pointer-events: none;
          opacity: 0.6;
        }

        .sos-pulse-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.75);
          pointer-events: none;
        }

        .sos-btn-interactive:active {
          transform: scale(0.94) !important;
          transition: transform 0.1s ease;
        }
      `}</style>

      {/* Top Header / Status bar */}
      <header
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '4px 2px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: isActive ? '#22c55e' : '#f59e0b',
                boxShadow: isActive ? '0 0 8px #22c55e' : '0 0 8px #f59e0b',
                animation: 'beaconGlow 1.8s infinite ease-in-out',
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.9)',
              }}
            >
              {isActive ? 'SPACETIMEDB ONLINE' : 'CONNECTING TO GRID…'}
            </span>
          </div>

          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              padding: '3px 8px',
              borderRadius: 20,
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              textTransform: 'uppercase',
            }}
          >
            HARRIS COUNTY
          </span>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: -0.5,
            margin: '4px 0 0',
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
          }}
        >
          Emergency Distress Beacon
        </h1>
        <p
          style={{
            fontSize: 13,
            color: 'rgba(255, 255, 255, 0.85)',
            margin: 0,
            textAlign: 'center',
          }}
        >
          Direct link to WaterBoard & Rescue Dispatch
        </p>
      </header>

      {/* Geolocation Section */}
      <section
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: 'rgba(0, 0, 0, 0.42)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          borderRadius: 20,
          padding: '16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <label
            htmlFor="geo-input"
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.95)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
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

          <span
            style={{
              fontSize: 11,
              color: '#fef08a',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            📍 {activeAreaName || 'Harris County'}
          </span>
        </div>

        {/* Location input row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              id="geo-input"
              type="text"
              value={location}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              placeholder="Harris County address or coordinates"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'rgba(255, 255, 255, 0.14)',
                border: '1.5px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 12,
                padding: '12px 14px',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                outline: 'none',
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#ffffff';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.22)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.14)';
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleUseGeolocation}
            disabled={geoStatus === 'locating'}
            title="Detect device GPS location"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '0 14px',
              backgroundColor: geoStatus === 'locating' ? 'rgba(255, 255, 255, 0.18)' : '#ffffff',
              color: geoStatus === 'locating' ? '#ffffff' : '#991b1b',
              border: 'none',
              borderRadius: 12,
              fontWeight: 800,
              fontSize: 13,
              cursor: geoStatus === 'locating' ? 'wait' : 'pointer',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            {geoStatus === 'locating' ? (
              <>
                <svg
                  style={{ animation: 'radarSweep 1s linear infinite' }}
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" strokeDasharray="16" strokeDashoffset="4" />
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.85)',
          }}
        >
          <span style={{ fontSize: 11, color: '#e2e8f0' }}>
            Coords: <strong>{coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}</strong>
            {geoAccuracy ? ` (±${geoAccuracy}m)` : ''}
          </span>

          <button
            type="button"
            onClick={handleShuffleHarrisLocation}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 8,
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            🎲 Pick Random Harris Co.
          </button>
        </div>

        {geoErrorMsg && (
          <div
            style={{
              fontSize: 12,
              color: '#fecaca',
              backgroundColor: 'rgba(185, 28, 28, 0.65)',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(254, 202, 202, 0.3)',
            }}
          >
            {geoErrorMsg}
          </div>
        )}
      </section>

      {/* Giant SOS Button Area with concentric pulse rings */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          height: 290,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '12px 0',
          zIndex: 2,
        }}
      >
        <div
          className="sos-pulse-ring"
          style={{
            width: 200,
            height: 200,
            animation: 'pulseWave 3.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite',
            animationDelay: '0s',
          }}
        />
        <div
          className="sos-pulse-ring"
          style={{
            width: 200,
            height: 200,
            animation: 'pulseWave 3.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite',
            animationDelay: '0.8s',
          }}
        />
        <div
          className="sos-pulse-ring"
          style={{
            width: 200,
            height: 200,
            animation: 'pulseWave 3.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite',
            animationDelay: '1.6s',
          }}
        />
        <div
          className="sos-pulse-ring"
          style={{
            width: 200,
            height: 200,
            animation: 'pulseWave 3.2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite',
            animationDelay: '2.4s',
          }}
        />

        <button
          type="button"
          onClick={() => {
            setShowDialog(true);
            setSubmitSuccess(false);
            setSubmitError(null);
          }}
          className="sos-btn-interactive"
          aria-label="Trigger Emergency SOS Dialog"
          style={{
            position: 'relative',
            width: 'clamp(180px, 48vw, 216px)',
            height: 'clamp(180px, 48vw, 216px)',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 36% 32%, #ff4d4d 0%, #dc2626 50%, #881337 100%)',
            border: '5px solid #ffffff',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            outline: 'none',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            animation: 'sosBreathing 2.4s ease-in-out infinite',
            zIndex: 10,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}
          >
            <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
            <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
            <circle cx="12" cy="12" r="2" fill="#ffffff" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>

          <span
            style={{
              fontSize: 'clamp(44px, 12vw, 54px)',
              fontWeight: 950,
              lineHeight: 1,
              letterSpacing: 4,
              textShadow: '0 4px 14px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 255, 255, 0.4)',
            }}
          >
            SOS
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.95)',
              textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
            }}
          >
            TAP TO TRANSMIT
          </span>
        </button>
      </section>

      {/* Bottom Footer & Stats */}
      <footer
        style={{
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          textAlign: 'center',
          zIndex: 2,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.32)',
            backdropFilter: 'blur(8px)',
            borderRadius: 14,
            padding: '10px 16px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              margin: '0 0 4px',
              color: '#ffffff',
            }}
          >
            ⚠️ Tap SOS button to transmit rescue coordinates & situation
          </p>
          <p
            style={{
              fontSize: 11,
              margin: 0,
              color: 'rgba(255, 255, 255, 0.75)',
            }}
          >
            Calls SpacetimeDB to create <strong>rescue_request</strong> & <strong>sos</strong> records.
          </p>
        </div>

        {/* Live Counters */}
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.85)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <strong>{rescueRequests?.length ?? 0}</strong> rescue requests
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#38bdf8' }} />
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
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              handleCloseDialog();
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 440,
              backgroundColor: '#170505',
              backgroundImage: 'radial-gradient(circle at top right, #3b0707 0%, #170505 100%)',
              border: '1.5px solid rgba(239, 68, 68, 0.45)',
              borderRadius: 24,
              padding: '24px 20px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(220, 38, 38, 0.3)',
              boxSizing: 'border-box',
              animation: 'modalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleCloseDialog}
              disabled={isSubmitting}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>

            {submitSuccess ? (
              /* Success confirmation state */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '12px 0 6px',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    backgroundColor: '#16a34a',
                    boxShadow: '0 0 30px rgba(34, 197, 94, 0.6)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
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
                  <h2
                    id="dialog-title"
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color: '#ffffff',
                      margin: '0 0 6px',
                    }}
                  >
                    SOS Transmitted Successfully!
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'rgba(255, 255, 255, 0.85)',
                      margin: 0,
                    }}
                  >
                    Created <strong>rescue_request</strong> record on WaterBoard dispatch & saved to <strong>sos</strong> table.
                  </p>
                </div>

                {/* Broadcast details card */}
                {lastSubmission && (
                  <div
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(0, 0, 0, 0.45)',
                      borderRadius: 14,
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '14px',
                      textAlign: 'left',
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <div>
                      <span style={{ color: '#86efac', fontWeight: 800 }}>✓ Rescue Request: </span>
                      <span style={{ color: '#ffffff' }}>Pending dispatch queue</span>
                    </div>
                    <div>
                      <span style={{ color: '#fca5a5', fontWeight: 700 }}>Coordinates: </span>
                      <span style={{ color: '#ffffff' }}>{lastSubmission.lat}, {lastSubmission.lon}</span>
                    </div>
                    <div>
                      <span style={{ color: '#fca5a5', fontWeight: 700 }}>Location: </span>
                      <span style={{ color: '#ffffff' }}>{lastSubmission.location}</span>
                    </div>
                    <div>
                      <span style={{ color: '#fca5a5', fontWeight: 700 }}>Message: </span>
                      <span style={{ color: '#ffffff' }}>{lastSubmission.text}</span>
                    </div>
                    <div>
                      <span style={{ color: '#fca5a5', fontWeight: 700 }}>Timestamp: </span>
                      <span style={{ color: '#ffffff' }}>{lastSubmission.timestamp}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitSuccess(false);
                      setSosText('');
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 12,
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Send Another
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 12,
                      backgroundColor: '#22c55e',
                      border: 'none',
                      color: '#052e16',
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(34, 197, 94, 0.4)',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Dialog form: Text box + submit button */
              <form onSubmit={handleSubmitSos} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: '#dc2626',
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: '#ffffff',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ffffff' }} />
                    Distress Broadcast
                  </div>
                  <h2
                    id="dialog-title"
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: '#ffffff',
                      margin: '0 0 4px',
                    }}
                  >
                    Emergency Details
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: 'rgba(255, 255, 255, 0.75)',
                      margin: 0,
                    }}
                  >
                    Enter situation info to create a priority rescue request.
                  </p>
                </div>

                {/* Confirmed Location snippet */}
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
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
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 10, color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase' }}>
                      Transmitting From (Harris County)
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {location}
                    </div>
                  </div>
                </div>

                {/* Quick situation chips */}
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'rgba(255, 255, 255, 0.8)',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Quick Situation Tap:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {quickTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: 16,
                          padding: '5px 10px',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Box for Emergency Message */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label
                    htmlFor="sos-text-input"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      color: '#ffffff',
                    }}
                  >
                    Situation Description & Needs:
                  </label>
                  <textarea
                    id="sos-text-input"
                    rows={4}
                    value={sosText}
                    onChange={(e) => setSosText(e.target.value)}
                    placeholder="Describe your situation: e.g. 3 people trapped on roof, floodwater at 4ft, elderly diabetic needs medicine, roof accessible..."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      border: '1.5px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: 14,
                      padding: '12px 14px',
                      color: '#ffffff',
                      fontSize: 15,
                      lineHeight: 1.4,
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ef4444';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                    }}
                  />
                </div>

                {submitError && (
                  <div
                    style={{
                      backgroundColor: 'rgba(220, 38, 38, 0.4)',
                      border: '1px solid #ef4444',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 12,
                      color: '#fecaca',
                    }}
                  >
                    ⚠️ {submitError}
                  </div>
                )}

                {/* Actions: Cancel & Submit Button */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: 14,
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      flex: 2,
                      padding: '14px',
                      borderRadius: 14,
                      backgroundColor: '#ef4444',
                      backgroundImage: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)',
                      border: '2px solid #ffffff',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: 15,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      cursor: isSubmitting ? 'wait' : 'pointer',
                      boxShadow: '0 6px 20px rgba(220, 38, 38, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          style={{ animation: 'radarSweep 1s linear infinite' }}
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <circle cx="12" cy="12" r="10" strokeDasharray="16" strokeDashoffset="4" />
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
                        Submit SOS
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
