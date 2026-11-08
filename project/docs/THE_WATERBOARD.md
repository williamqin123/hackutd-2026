# The WaterBoard — Architecture & Data Documentation

HackUTD 2026 project docs for teammates and judges.

**What this app is:** a historically informed Hurricane Harvey (Houston, Aug 2017) flood-response simulator. SpacetimeDB is the backend (tables + reducers + live sync). The Next.js UI is a command-style dashboard with a map, timeline, and rescue dispatch demo.

**Important disclaimer:** threat scores and map circles are **modelled demonstration signals**, not official inundation maps or forecasts. High-water marks and USGS gage readings are real historical observations; SOS/teams are demo/mock operational data.

---

## 1. Big picture — how data interacts

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ SOURCE DATA (seeded once)                                               │
│  • harvey_flood_marks.json     →  flood_mark                            │
│  • harvey_storm_track.json     →  storm_observation                     │
│  • usgs_harvey_gauges.json     →  gauge_station + gauge_reading         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ seed reducers (idempotent)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SPACETIMEDB MODULE  (project/spacetimedb/src/index.ts)                  │
│                                                                         │
│  simulation_state  ──sim time T──►  recomputeThreats()                  │
│                                         │                               │
│                    ┌────────────────────┼────────────────────┐          │
│                    ▼                    ▼                    ▼          │
│              storm at T          gage height at T     marks surveyed   │
│              (track)             (USGS series)        by time T         │
│                    └────────────────────┼────────────────────┘          │
│                                         ▼                               │
│                              site_threat  +  threat_region              │
│                                                                         │
│  rescue_request / rescue_team / dispatch_assignment  (ops demo)         │
│  activity_event  (audit log)                                            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ subscriptions (live)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND  (Next.js, plain JS)                                           │
│  FloodMap — colored zones + threatened sites + storm track              │
│  Timeline scrubber / play (+8h ticks)                                   │
│  SOS → recommend → confirm dispatch                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Runtime loop

1. **Seed** historical layers into Spacetime (CSV + USGS JSON), once.
2. Move the **simulation clock** (`simulation_state.simTimeMicros`) with play, advance, reset, or scrubber.
3. Call **`recomputeThreats`** for the current time.
4. Clients **subscribe** to tables; the map and panels update automatically when rows change.

There is **no separate REST API server**. Spacetime *is* the backend.

---

## 2. Threat calculation (where it lives)

**Code location:** `project/spacetimedb/src/index.ts`  
**Reducer:** `recomputeThreats`  
**Helpers in the same file:** `levelFromScore`, `levelFromStageRatio`, `haversineKm`, `clamp01`

### 2.1 Inputs at simulation time `T`

| Input | Table | How we pick the value at `T` |
| --- | --- | --- |
| Storm center + wind | `storm_observation` | Latest track point with `timeMicros ≤ T` |
| River/bayou stage | `gauge_reading` + `gauge_station` | Latest reading per station with `timeMicros ≤ T` |
| Confirmed high water | `flood_mark` | Mark counts if `surveyTimeMicros ≤ T` |

### 2.2 Per–flood-mark score (`site_threat`)

For each row in `flood_mark`:

**Storm component (0–100)**

```text
windNorm = clamp(windKt / 130, 0, 1)
prox     = exp(-distance_km_to_storm / 90)
storm    = 100 * windNorm * prox
```

**Gauge component (0–100)**  
For each USGS station, compute a contribution and keep the **max**:

```text
ratio = clamp(gageHeightFt / floodStageFt, 0, 1)
prox  = exp(-distance_km_to_station / 25)
contrib = 100 * ratio * prox
gauge = max(contrib over stations)
```

**Historical component (0–40)**  
Only if the mark’s survey time is already reached by `T`:

```text
historical = 20 + clamp(heightAboveGnd / 8, 0, 1) * 20
```

**Final weighted score**

```text
threatScore =
    0.40 * storm
  + 0.45 * gauge
  + 0.15 * historical
```

**Level from score** (`levelFromScore`)

| Score | Level |
| --- | --- |
| ≥ 75 | `critical` |
| ≥ 55 | `warning` |
| ≥ 35 | `advisory` |
| ≥ 15 | `watch` |
| else | `none` |

Written to **`site_threat`** (one row per `objectId`).

### 2.3 Gauge-centered flood zones (`threat_region`)

For each `gauge_station`:

```text
ratio    = gageHeightFt / floodStageFt
radiusKm = 2 + max(0, ratio - 0.6) * 18
```

**Level from stage ratio** (`levelFromStageRatio`)

| Stage ratio | Level |
| --- | --- |
| ≥ 1.05 | `critical` |
| ≥ 0.90 | `warning` |
| ≥ 0.75 | `advisory` |
| ≥ 0.50 | `watch` |
| else | `none` |

These circles are what the map draws as **“live flooding” zones**. They grow as gages rise.

### 2.4 What this is *not*

- Not a hydrodynamic flood model  
- Not official NWS flood stages (our `floodStageFt` values are **demo thresholds** chosen from Harvey ranges)  
- Not individual victim urgency (that’s the separate SOS priority score)

---

## 3. Current Spacetime schema

Defined in `project/spacetimedb/src/index.ts`, registered in one `schema({ ... })` object.

### 3.1 Table reference

| Table | Purpose | Data origin | Static or live? |
| --- | --- | --- | --- |
| **`simulation_state`** | Disaster clock for the Houston Harvey scenario (`regionTag`, `simTimeMicros`, play flag, speed) | **App / mock seed** on module `init` (`houston-harvey` starting Aug 25, 2017) | **Live** — changed by play/seek/advance |
| **`flood_mark`** | Historical USGS high-water mark sites (slim fields for map + scoring) | **JSON extract:** `public/harvey_flood_marks.json` (from original USGS HWM CSV) via `seedFloodMarks` | **Static** after seed (real observations) |
| **`storm_observation`** | Harvey track points (time, lat/lon, wind, SSHS) | **JSON extract:** `public/harvey_storm_track.json` (from original IBTrACS/best-track CSV) via `seedStormTrack` | **Static** after seed (real track) |
| **`gauge_station`** | USGS monitoring locations + demo flood-stage thresholds | **USGS Water Data API** metadata, packaged in `public/usgs_harvey_gauges.json` via `seedGaugeStations` | Mostly **static**; stage thresholds are demo constants |
| **`gauge_reading`** | Hourly gage height (param `00065`) during Harvey | **USGS API** `.../collections/continuous/items`, cached in `usgs_harvey_gauges.json` via `seedGaugeReadings` | **Static** time series after seed (real historical) |
| **`site_threat`** | Per–flood-mark threat score/level at current sim time | **Computed** by `recomputeThreats` from storm + gages + marks | **Live / modelled** |
| **`threat_region`** | Per-gage visual flood zone (radius, stage ratio, level) | **Computed** by `recomputeThreats` | **Live / modelled** |
| **`rescue_request`** | Simulated SOS incidents | **Mock / UI** (`createRescueRequest`) | **Live** demo ops |
| **`rescue_team`** | Available rescue assets | **Mock** — two demo teams on `init`; more via `createRescueTeam` | **Live** demo ops |
| **`dispatch_assignment`** | Recommended/confirmed team↔request links | **Computed / mock ops** (`recommendDispatch`, `confirmDispatch`) | **Live** demo ops |
| **`activity_event`** | Human-readable activity feed | **Generated** by reducers (init, seed, threat, dispatch, …) | **Live** log |

### 3.2 Source files on disk

| File | Used for |
| --- | --- |
| `public/harvey_flood_marks.json` | Slim high-water marks → `flood_mark` |
| `public/harvey_storm_track.json` | Slim storm track → `storm_observation` |
| `public/usgs_harvey_gauges.json` | Stations + hourly readings → `gauge_station`, `gauge_reading` |
| `lib/floods.js` | Loads flood-mark JSON in the browser |
| `lib/hazard.js` | Loads storm + USGS JSON for seeding |

Raw CSVs are **not** kept in the repo; only these slim JSON extracts are.

**USGS endpoint used for the extract:**  
`https://api.waterdata.usgs.gov/ogcapi/v1/collections/continuous/items`  
Stations include Buffalo Bayou, White Oak Bayou, Brays Bayou, Cypress Creek (gage height `00065`, ~Aug 25–Sep 2 2017).

### 3.3 Key reducers

| Reducer | Role |
| --- | --- |
| `seedFloodMarks` / `seedStormTrack` / `seedGaugeStations` / `seedGaugeReadings` | One-time (or idempotent) historical import |
| `setSimulationPlaying` / `advanceSimulation` / `seekSimulation` / `resetSimulation` | Clock control |
| `recomputeThreats` | Rebuild `site_threat` + `threat_region` for current `T` |
| `createRescueRequest` / `recommendDispatch` / `confirmDispatch` | SOS prioritization + dispatch demo |
| `setTeamStatus` / `createRescueTeam` | Team management |

SOS **priority** (separate from flood threat) is a simple deterministic score in `computePriorityScore`: medical (+1000), stranded (+400), transport (+150), people count.

---

## 4. Frontend ↔ backend wiring

| UI piece | Reads (subscribe) | Writes (reducers) |
| --- | --- | --- |
| Map (`app/FloodMap.js`) | `threat_region`, `site_threat`, `flood_mark`, `storm_observation`, SOS/teams | — |
| Timeline / play | `simulation_state` | `seekSimulation`, `advanceSimulation`, `setSimulationPlaying`, then `recomputeThreats` |
| Seed button / auto-seed | — | seed\* reducers + `recomputeThreats` |
| Dispatch panel | `rescue_request`, `rescue_team`, `dispatch_assignment`, `activity_event` | create / recommend / confirm |

Local defaults: SpacetimeDB DB name `waterboard`, Next on **port 3001**, Spacetime on **3000**.

---

## 5. What we might need next

Ordered by demo value vs effort:

1. **Shelter table** — static or lightly mocked shelter locations on the map; link completed rescues to shelters.  
2. **CDC SVI / tract layer** — regional vulnerability context for planning (not per-person urgency). Keep clearly labeled.  
3. **Stronger flood visualization** — bayou polygons / heatmap instead of only gage circles; optional “revealed marks only ≤ T” filter.  
4. **Scheduled sim tick in Spacetime** — move auto-advance off the browser interval onto a schedule table so all clients share one clock driver.  
5. **Dispatcher roles / auth** — SpacetimeAuth or OIDC so only operators can confirm dispatch.  
6. **Compare baselines** — side-by-side FCFS vs priority dispatch metrics for the State Farm story.  
7. **Richer SOS generation** — scripted incidents that spawn as threat levels rise (still labeled synthetic).  
8. **Maincloud publish + shared env** — one team database for multi-laptop demos.  
9. **Road/access constraints** — only if kept extremely simple and labeled as mock; avoid claiming verified safe routes.  
10. **Procedure-based live USGS pull** — optional refresh path; MVP correctly prefers the cached Harvey extract.

---

## 6. Quick verification checklist

1. `spacetime start` (local)  
2. `cd project && spacetime publish waterboard --server local --yes`  
3. `npm run dev` → http://localhost:3001  
4. Ensure seed completed (banner gone; Threat snapshot lists gages)  
5. Scrub to **late Aug 27–29** or click **Jump to Aug 28 peak**  
6. Confirm colored circles on the map and non-empty `threat_region` / `site_threat`

---

## 7. File map for developers

```text
project/
  spacetimedb/src/index.ts      ← schema + threat + dispatch logic
  app/page.js                   ← dashboard composition / seed / dispatch
  components/FloodMap.jsx       ← Leaflet threat map
  components/SimulationClock.jsx← 1h play ticks, slider, 8h jump
  components/ThreatSnapshot.jsx ← gage/site threat summary
  lib/floods.js                 ← flood-mark JSON loader
  lib/hazard.js                 ← storm + USGS JSON loaders
  lib/sim-clock.js              ← Harvey window + tick helpers
  public/                       ← JSON historical assets
  docs/THE_WATERBOARD.md        ← this document (architecture / threat / schema)
  docs/FRONTEND.md              ← where to edit UI code
```

Frontend-only edit guide: [`FRONTEND.md`](./FRONTEND.md).

For Spacetime concepts (tables, reducers, subscriptions), also see `project/AGENTS.md` and the official docs at https://spacetimedb.com/docs/.
