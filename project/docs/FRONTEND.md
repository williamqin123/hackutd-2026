# The WaterBoard — Frontend edit guide

Plain **React / Next.js JavaScript** (no TypeScript in the UI).  
Backend / schema work lives in SpacetimeDB — see [`THE_WATERBOARD.md`](./THE_WATERBOARD.md).

**Run the UI**

```bash
# terminal 1
spacetime start

# terminal 2
cd project
npm install
npm run dev
# → http://localhost:3001
```

SpacetimeDB uses port **3000**; Next is on **3001** on purpose.

---

## 1. Where to edit (cheat sheet)

| I want to change… | Edit this file |
| --- | --- |
| Page layout, seed/dispatch panels, copy/headings | `app/page.js` |
| Map look, flood circles, markers, popups, legend, LIVE banner | `components/FloodMap.jsx` |
| Play / pause / 8-hour jump / timeline slider | `components/SimulationClock.jsx` |
| Threat snapshot list under the map | `components/ThreatSnapshot.jsx` |
| Clock constants (1h tick, Harvey window) | `lib/sim-clock.js` |
| App title / HTML metadata / wrap providers | `app/layout.js` |
| Spacetime connection host / DB name | `app/providers.js` + `.env.local` |
| Global CSS (fonts, body, buttons, sections) | `app/globals.css` |
| How flood-mark JSON is loaded for seeding | `lib/floods.js` |
| How storm track / USGS JSON is loaded for seeding | `lib/hazard.js` |
| Historical assets the UI fetches | `public/*.json` |
| Env defaults / teammate Maincloud hints | `.env.example` |

### Do **not** hand-edit

| Path | Why |
| --- | --- |
| `src/module_bindings/**` | Auto-generated from the Spacetime module. Regenerate with `spacetime generate` after backend changes. |
| `spacetimedb/src/index.ts` | Backend schema/reducers — not frontend. |

---

## 2. Frontend file map

```text
project/
├── app/
│   ├── page.js          ← dashboard: wires data + composes components
│   ├── providers.js     ← SpacetimeDB React provider / connection
│   ├── layout.js        ← root layout + document title
│   └── globals.css      ← global styles
├── components/
│   ├── FloodMap.jsx         ← Leaflet threat map (browser-only)
│   ├── SimulationClock.jsx  ← play / slider / 8-hour advance
│   └── ThreatSnapshot.jsx   ← gage/site threat summary
├── lib/
│   ├── sim-clock.js     ← Harvey window + 1h tick helpers
│   ├── floods.js        ← load /harvey_flood_marks.json
│   └── hazard.js        ← load storm + USGS JSON
├── public/
│   ├── harvey_flood_marks.json
│   ├── harvey_storm_track.json
│   └── usgs_harvey_gauges.json
├── src/module_bindings/ ← generated client SDK (read-only for UI work)
└── docs/
    ├── FRONTEND.md      ← this file
    └── THE_WATERBOARD.md
```

---

## 3. `app/page.js` — the control center

This is the home page. It:

1. Subscribes to Spacetime tables with `useTable(...)`
2. Loads JSON historical files once
3. Seeds historical layers
4. Renders map → simulation clock → threat snapshot, then dispatch panels

### Clock knobs (`lib/sim-clock.js`)

```js
export const HOUR_MICROS = 3_600_000_000n;     // Play tick = 1 sim-hour
export const EIGHT_HOUR_MICROS = 8n * HOUR_MICROS;
export const SIM_START_MICROS = 1503619200000000n; // Aug 25, 2017
export const SIM_END_MICROS = 1504310400000000n;   // Sep 2, 2017
export const PLAY_INTERVAL_MS = 400;               // how fast Play ticks
```

### Page composition (top to bottom)

| Block | Component / section |
| --- | --- |
| Title / intro / connection | `app/page.js` |
| Map | `components/FloodMap.jsx` |
| Simulation clock + slider | `components/SimulationClock.jsx` |
| Threat snapshot | `components/ThreatSnapshot.jsx` |
| Historical data / seed | `app/page.js` |
| Dispatch demo / activity | `app/page.js` |

### Calling the backend from the UI

Use the shared helper pattern already in the file:

```js
await run("label", (c) => c.reducers.someReducer({ ... }));
```

Examples already present: `seedFloodMarks`, `recomputeThreats`, `seekSimulation`, `createRescueRequest`, `recommendDispatch`, `confirmDispatch`.

Reading live data:

```js
const [threatRegions] = useTable(tables.threatRegion);
const [siteThreats] = useTable(tables.siteThreat);
// …etc
```

After backend adds a new public table/reducer, regenerate bindings, then import `tables` / call `conn.reducers.*` the same way.

---

## 4. `components/FloodMap.jsx` — map visuals

Loaded with `next/dynamic(..., { ssr: false })` from `page.js` because Leaflet needs `window`.

### Props from `page.js`

| Prop | Meaning |
| --- | --- |
| `simTimeMicros` | Current disaster clock (legend time) |
| `stormPoints` | Full storm track; map filters to `≤ sim time` |
| `threatRegions` | Gage flood circles (`threat_region` table) |
| `siteThreats` | Per-mark scores (`site_threat`) |
| `floodMarks` | Mark locations |
| `requests` / `teams` | SOS + team markers |

### Where visuals are defined

| Visual | Look for in `FloodMap.jsx` |
| --- | --- |
| Threat colors | `LEVEL_COLORS` / `LEVEL_FILL` |
| Flood zone circles | loop over `threatRegions` |
| Permanent labels on hot gages | `bindTooltip(..., { permanent: isHot })` |
| Storm track + eye | `stormPath` / `currentStorm` |
| Threatened flood-mark dots | loop over `floodMarks` + `siteThreats` (skips `none`) |
| SOS / TEAM pins | `L.divIcon` markers |
| “LIVE FLOODING SIGNAL” banner | `activeFloodCount` block |
| Bottom legend | absolute-positioned legend `div` |
| Popup stacking | CSS under `.waterboard-map-shell` |

**Tip:** don’t put `overflow: hidden` on the map container — it clips Leaflet popups.

---

## 5. Connection & env (`providers.js`)

`app/providers.js` builds the Spacetime connection:

- Host: `NEXT_PUBLIC_SPACETIMEDB_HOST` (http/https auto-converted to ws/wss)
- DB: `NEXT_PUBLIC_SPACETIMEDB_DB_NAME` (local default `waterboard`)

Local overrides go in **`.env.local`** (gitignored). Shared examples are in **`.env.example`**.

Restart `npm run dev` after changing env files.

---

## 6. Styling

| Approach | Where |
| --- | --- |
| Dashboard layout / buttons | `app/globals.css` |
| Map-only CSS | `<style>` inside `FloodMap.jsx` (popup z-index) |

There is no Tailwind / component library in this project yet — add one only if the team agrees.

---

## 7. Common frontend tasks

### Change branding / title

1. `app/page.js` — `<h1>The WaterBoard</h1>` and intro text  
2. `app/layout.js` — `metadata.title` / `description`

### Make Play slower/faster or change step size

Edit `PLAY_INTERVAL_MS` and `HOUR_MICROS` / `EIGHT_HOUR_MICROS` in `lib/sim-clock.js`. Play always advances **1 sim-hour**; use **Advance 8 hours** for a jump.

### Add a new panel on the dashboard

Add a `<section>` in `app/page.js` near the other sections. Subscribe with `useTable` if it needs live Spacetime data.

### Change flood colors / circle size

Edit `LEVEL_COLORS`, `LEVEL_FILL`, and the `L.circle` / `L.circleMarker` options in `components/FloodMap.jsx`.

### Show more markers when threat is low

In `FloodMap.jsx`, the mark loop currently `continue`s when `level === "none"`. Remove or soften that filter.

### Point at Maincloud instead of local

Update `.env.local`:

```bash
NEXT_PUBLIC_SPACETIMEDB_HOST=https://maincloud.spacetimedb.com/
NEXT_PUBLIC_SPACETIMEDB_DB_NAME=your-published-db-name
```

Only works if that database has The WaterBoard module published.

---

## 8. Conventions for teammates

- Prefer **`.js`** for UI files (team preference: not TypeScript on the frontend).
- Keep map code in `components/FloodMap.jsx`; clock in `SimulationClock.jsx`; page.js only wires data.
- Don’t commit secrets; use `.env.local`.
- If the UI can’t see a new reducer/table, regenerate bindings from `project/`:

  ```bash
  spacetime generate --lang typescript --out-dir src/module_bindings --module-path spacetimedb --yes
  ```

- Architecture / threat math / table sources: [`THE_WATERBOARD.md`](./THE_WATERBOARD.md).
