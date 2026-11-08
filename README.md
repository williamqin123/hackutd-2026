# 🌊 WaterBoard

### Connecting people who need help with teams who can respond.

WaterBoard is a flood-response simulation and rescue coordination platform built for **HackUTD 2026**. It brings together SOS requests, rescue teams, and historical flood conditions on one interactive dashboard.

**[Open WaterBoard](https://waterboard.dev)**

## The Problem

During flooding, emergency information can become scattered. Response teams need a clear picture of who needs help, where they are, and which resources are available.

WaterBoard demonstrates how a shared, real-time map can support that coordination.

## Features

### 📍 Mobile SOS Requests

- Submit an SOS with a location and situation description.
- Use device GPS or select a demonstration location in Harris County.
- Add quick situation tags for medical needs, rising water, and evacuation.
- Send requests directly to the shared dispatch dashboard.

### 🗺️ Live Response Dashboard

- View active SOS requests and rescue teams on an interactive map.
- Receive request updates through SpacetimeDB subscriptions.
- Highlight newly arriving SOS icons with a brief animation.
- Track active requests, requests awaiting a team, and available teams.
- Search and filter the SOS queue.

### 🚤 Rescue Coordination

- Recommend or manually select a rescue team.
- Review team capabilities, including boats and medical support.
- Confirm assignments and complete rescues.
- Follow operational updates in the activity feed.

### 🌧️ Historical Flood Simulation

Explore Hurricane Harvey conditions using historical high-water marks, storm-track data, and USGS gauge readings.

Simulation controls allow users to advance through the event and inspect modeled flood-threat signals.

### 🌙 Cyberpunk and Light Themes

Cyberpunk is the default dark theme. A theme switch lets users choose Light mode, and the browser remembers their preference.

## Technology

| Layer | Technology |
| --- | --- |
| Application | Next.js and React |
| Styling | Tailwind CSS 4 and CSS modules |
| Interactive map | Leaflet |
| Real-time backend | SpacetimeDB |
| Synchronization | WebSocket subscriptions |
| Hosting | Railway |

## Run Locally

### Requirements

- Node.js 20.9 or newer
- npm
- Access to a published SpacetimeDB database

### Installation

```bash
git clone https://github.com/williamqin123/hackutd-2026.git
cd hackutd-2026/project
npm install
cp .env.example .env.local
```

Configure the database connection in `.env.local`:

```env
NEXT_PUBLIC_SPACETIMEDB_HOST=https://maincloud.spacetimedb.com
NEXT_PUBLIC_SPACETIMEDB_DB_NAME=hackutd-2026-t3uux
```

Use the host and database name for your own deployment when applicable.

Start the development server:

```bash
npm run dev
```

Open **http://localhost:3001**.

## Application Routes

| Route | Purpose |
| --- | --- |
| `/` | Welcome screen |
| `/mobile/sos` | Mobile SOS interface |
| `/dashboard` | Response dashboard |

## Production Build

Run these commands from `project/`:

```bash
npm run build
PORT=3001 node .next/standalone/server.js
```

Set the public database environment variables before building. Changes to `NEXT_PUBLIC_*` variables require a new build.

## Project Structure

```text
project/
├── app/                  Application routes and global styles
├── components/           Dashboard, map, SOS, and theme components
├── lib/                  Shared utilities
├── public/               Static assets and historical datasets
├── spacetimedb/          Backend schema and reducers
├── src/module_bindings/  Generated SpacetimeDB client bindings
└── docs/                 Architecture and setup documentation
```

## Documentation

- [Frontend guide](project/docs/FRONTEND.md)
- [Architecture and historical data](project/docs/THE_WATERBOARD.md)
- [WebSocket deployment and diagnostics](project/docs/WEBSOCKET_DEPLOYMENT.md)

## Demo Context

WaterBoard is a hackathon demonstration using historical flood observations and simulated rescue operations. Its threat indicators are modeled demonstration signals, not official flood forecasts. SOS submissions are stored in the application's database; they do not contact emergency services.
