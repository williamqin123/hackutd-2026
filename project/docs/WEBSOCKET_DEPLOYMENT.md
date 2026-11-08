# Cross-origin SpacetimeDB connections

The browser at `https://waterboard.dev` opens an outbound connection to
`wss://clockworklabsspacetime-production-4e36.up.railway.app`. Its WebSocket
handshake carries `Origin: https://waterboard.dev` (an HTTPS origin, not a WSS
origin). The database does not need to open a reverse connection to the website.

SpacetimeDB's [API CORS layer](https://github.com/clockworklabs/SpacetimeDB/blob/v2.14.1/crates/client-api/src/routes/mod.rs)
already allows browser origins, and its [WebSocket handler](https://github.com/clockworklabs/SpacetimeDB/blob/v2.14.1/crates/client-api/src/routes/subscribe.rs)
negotiates the SDK protocol. Adding `Access-Control-Allow-Origin` headers to
Next.js responses does not change the database's WebSocket policy. WebSocket
upgrades do not use an OPTIONS preflight.

## Configure the Railway database service

1. Restore or generate its public HTTPS domain in Railway's Public Networking
   settings. Confirm that the exact hostname resolves and has valid TLS. An
   `ENOTFOUND` result is a DNS/domain problem, before any Origin validation.
2. Configure the public domain's target port to match the SpacetimeDB listener.
   Bind the listener to `0.0.0.0`, not just `127.0.0.1`. Use the startup flags
   supported by the installed SpacetimeDB version; do not assume that changing
   `PORT` alone changes its listener.
3. Ensure the intended database is published on this Railway server. Database
   names on Maincloud do not automatically exist on a self-hosted server.
4. If a custom reverse proxy is present, preserve the `/v1/database/.../subscribe`
   path and query, `Origin`, `Upgrade`, `Connection`, and `Sec-WebSocket-Protocol`
   headers. Support HTTP/1.1 upgrades and a suitable idle timeout. Any origin
   allowlist at that proxy must include exactly `https://waterboard.dev`.
   Keep authentication enabled and TLS verification intact.

See Railway's [Public Networking documentation](https://docs.railway.com/networking/public-networking)
for public domains, TLS, and target ports.

## Configure the web app service

After the database endpoint is reachable, set these variables on the web app
service and rebuild it:

```dotenv
NEXT_PUBLIC_SPACETIMEDB_HOST=wss://clockworklabsspacetime-production-4e36.up.railway.app
NEXT_PUBLIC_SPACETIMEDB_DB_NAME=hackutd-2026-t3uux
```

Use the actual published database name if different. The existing provider
converts HTTPS hosts to WSS and scopes stored authentication tokens to each
host/database pair. Do not copy a Maincloud authentication token to Railway.

If a Content-Security-Policy is supplied by a hosting layer, its `connect-src`
must include this exact `wss://` endpoint, plus the `https://` endpoint if HTTP
API calls are used. Amend the existing policy rather than adding a second,
conflicting policy. No application CSP currently restricts this repository's
connections.

## Verify the actual upgrade

From `project/`:

```sh
npm run check:websocket
```

This uses the Railway host, `hackutd-2026-t3uux`, and
`Origin: https://waterboard.dev` by default. Override them positionally:

```sh
npm run check:websocket -- wss://maincloud.spacetimedb.com hackutd-2026-t3uux https://waterboard.dev
node --test scripts/check-websocket.test.mjs
```

The check sends no credentials or reducer calls. It verifies TLS, a bounded
HTTP 101 upgrade, the WebSocket accept digest, and a compatible SpacetimeDB
subprotocol. It closes immediately; success does not prove the database's
connection reducer accepts a client or that subscriptions are ready. Check
the browser's Network > WS panel and the SDK's connection/subscription state
after the upgrade passes. The command does not test browser CSP enforcement.

At diagnosis on November 8, 2026, the Railway hostname returned `ENOTFOUND`.
The same origin against Maincloud returned HTTP 101 and negotiated
`v3.bsatn.spacetimedb`. Restore the Railway public domain before investigating
an origin rejection.
