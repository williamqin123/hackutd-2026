# Flood dispatcher and developer tools

Next.js and JavaScript interfaces backed by a JavaScript Spacetime module. No TypeScript source, compiler, or generated client bindings are used.

## Routes

| URL | Purpose |
| --- | --- |
| `/dispatcher/floods` | Historical flood table, map and CSV download |
| `/developer/simulations` | Sample data import and simulation controls |
| `/developer/simulations/:id` | Simulation status and results |
| `/` | Redirect to dispatcher |

Next.js listens on public port **3000**. Spacetime listens internally on **127.0.0.1:3001**. Next.js proxies `/v1/*` to Spacetime, so all browser requests use the same host and port. Keep the database port internal when deploying.

## Local startup

Requires a supported Node.js version (see package.json). On macOS and Linux, the startup script downloads Spacetime **2.14.0** from its official GitHub release on first run. A global CLI installation is not required.

```sh
npm install
npm run dev
```

`npm run dev` starts Spacetime, builds and publishes the local JavaScript module, and then starts Next.js on port 3000. Stop both with Ctrl+C. If a compatible backend is already running on port 3001, it is reused. Publishing never deletes existing data; incompatible schema changes fail rather than resetting the database.

Tools, database files, signing keys and the local CLI identity live in `.spacetime/`, which is ignored by Git. This replaces the temporary test server. Keep this folder to retain local data and identity.

Defaults work without configuration. `.env.example` lists the settings for the frontend proxy:

```text
SPACETIMEDB_ORIGIN=http://127.0.0.1:3001
NEXT_PUBLIC_SPACETIMEDB_DATABASE=flood-db
```

The combined development command is for the local `flood-db` on port 3001. To use an explicitly configured remote backend, run `npm run dev:frontend` instead.

For separate terminals or production frontend startup:

```sh
npm run spacetime:start
# In another terminal:
npm run spacetime:publish:local
npm run dev:frontend
```

Publishing uses `--js-path` with an esbuild JavaScript bundle. This deployment option is currently marked unstable by Spacetime. No TypeScript compiler or generated bindings are used. These commands target the local database and do not modify Maincloud.

## Developer access

On initial publication, the publisher's authenticated identity is inserted into the private `developers` table. Imports, scenario submission and simulation reads require that identity. Dispatcher observations can be read anonymously. Page routes themselves are not authorization boundaries; Spacetime enforces access to protected operations.

Retrieve your publisher identity token locally:

```sh
npm run spacetime:token
```

Paste only the token into **Developer access** on the developer page. It is kept in sessionStorage for that browser tab and can be cleared with the provided button. Use the identity that first published the local database. Do not commit tokens.

Import the included Harvey 2017 CSV first, then submit location, rainfall, duration and search radius. Imports are transactional per batch and skip existing source IDs, so interrupted imports can be retried. No external data provider is configured yet.

## Structure

```text
app/dispatcher/                Dispatcher page group
app/developer/                 Developer page group
components/                    Small UI components
lib/spacetime.js               HTTP transport, wire encoding, token handling
lib/flood-service.js           CSV normalization and flood reads/imports
lib/simulation-service.js      Scenario submission and retrieval
shared/validation.js           Shared browser/backend input validation
spacetimedb/src/tables.js       Database definitions
spacetimedb/src/access.js       Backend authorization
spacetimedb/src/floods.js       Flood import logic
spacetimedb/src/simulations.js  Simulation lifecycle
spacetimedb/src/simulator.js    Pure, replaceable calculation model
spacetimedb/src/index.js        Module registration
```

Tables: public `floods`; private `developers`, `simulations`, `simulation_results`, and `simulation_jobs`. Simulation results never overwrite historical dispatcher records.

## API and sequential flow

All calls use `POST /v1/database/flood-db/call/<function>` with a JSON array of positional arguments. The shared transport converts object keys to snake_case for Spacetime's wire format. Backend source uses camelCase.

| Function | Arguments | Access |
| --- | --- | --- |
| `get_floods` | `[]` | Public |
| `import_floods` | `[rows]` (up to 100 normalized records) | Developer |
| `create_simulation` | `[id, latitude, longitude, rainfallMm, durationHours, radiusKm]` | Developer |
| `get_simulation` | `[id]` | Developer |

Read procedures return JSON encoded as a Spacetime string; the transport decodes both layers. Mutation reducers return no data. Each scenario has a client-generated ID: identical resubmissions are idempotent and conflicting inputs are rejected.

1. Developer imports CSV observations into Spacetime.
2. Dispatcher polls observations every five seconds and renders the same record set in the table and map.
3. Developer submits a scenario. Spacetime validates inputs and atomically stores a queued request and scheduled job.
4. Spacetime executes the scheduled reducer. Calculation, result storage and final status commit atomically. These short jobs do not have a separately observable running state.
5. The developer results page polls every 1.5 seconds until completed or failed. Polling stops on navigation or request errors. Reload to retry a failed read; saving a new token also retries.

## Model scope

The baseline `historical-proximity-screening-v1` finds historical observations within the selected radius, calculates mean rainfall intensity in mm/hour, and calculates rainfall volume over the circular search area in cubic meters. This volume is not runoff. Historical points are not predicted inundation. The UI identifies these limitations.

A calibrated flood-depth or flood-extent model requires terrain, drainage data and a validated algorithm. Replace the pure `simulate()` function when those are supplied. The current scheduled transaction is suitable for the included 365 observations; large datasets or expensive models need indexed spatial selection and chunked scheduled jobs.

The map uses OpenStreetMap raster tiles and requires internet access and WebGL. The table remains available if the map fails. Use an appropriate tile provider for production traffic.

## Verification

```sh
npm test
npm run spacetime:build
npm run build
```

For integration checks against a local test database published by your CLI identity:

```sh
node scripts/test-integration.js .spacetime/cli/config/cli.toml
```

Alternatively, set `TEST_DEVELOPER_TOKEN` privately. The script imports the sample records and creates a test simulation. It checks duplicate imports, authorization, invalid inputs, request idempotency, scheduled execution and stored results. Tokens are never printed. `TEST_ORIGIN` defaults to `http://127.0.0.1:3001`; use `http://localhost:3000` to check the Next.js proxy.

Verified during implementation: JavaScript bundle publication to a temporary local Spacetime 2.14 server, backend integration checks with all 365 observations, unit tests and the Next.js production build. Browser behavior and the running Next.js proxy were not verified because starting Next.js was declined.
