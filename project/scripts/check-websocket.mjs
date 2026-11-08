import http from 'node:http';
import https from 'node:https';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const protocols = ['v3.bsatn.spacetimedb', 'v2.bsatn.spacetimedb'];
const railwayHost = 'wss://clockworklabsspacetime-production-4e36.up.railway.app';

// Test the actual cross-origin upgrade, not an OPTIONS request. No credentials
// or database writes are sent. A successful upgrade is not a subscription test.
export function checkWebSocket({ host, database, origin, timeoutMs = 10000 }) {
  const url = new URL(host);
  if (!['ws:', 'wss:', 'http:', 'https:'].includes(url.protocol)) {
    throw new Error('Host must use ws, wss, http, or https.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Host must not contain credentials, a query, or a fragment.');
  }
  if (!database?.trim()) throw new Error('A published database name is required.');
  const originUrl = new URL(origin);
  if (!['http:', 'https:'].includes(originUrl.protocol) || originUrl.origin !== origin) {
    throw new Error('Origin must be an HTTP(S) origin without a path or trailing slash.');
  }
  if (originUrl.protocol === 'https:' && ['ws:', 'http:'].includes(url.protocol)) {
    throw new Error('An HTTPS page requires a secure wss:// endpoint.');
  }
  url.protocol = ['wss:', 'https:'].includes(url.protocol) ? 'https:' : 'http:';
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/v1/database/${encodeURIComponent(database)}/subscribe`;
  url.searchParams.set('compression', 'None');
  const key = randomBytes(16).toString('base64');
  const accept = createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');

  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(url, {
      method: 'GET',
      headers: {
        Origin: origin,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Protocol': protocols.join(', '),
      },
    });
    // Bound DNS, TLS, and upgrade together; socket inactivity alone doesn't
    // bound DNS lookup or a peer that keeps trickling HTTP response bytes.
    const deadline = setTimeout(() => {
      req.destroy(new Error('WebSocket handshake timed out.'));
    }, timeoutMs);
    const finish = (err, result) => {
      clearTimeout(deadline);
      if (err) reject(err);
      else resolve(result);
    };
    req.on('upgrade', (res, socket) => {
      socket.destroy();
      const protocol = res.headers['sec-websocket-protocol'];
      if (res.statusCode !== 101 ||
          res.headers.upgrade?.toLowerCase() !== 'websocket' ||
          res.headers['sec-websocket-accept'] !== accept ||
          !protocols.includes(protocol)) {
        finish(new Error('Invalid WebSocket upgrade or incompatible SpacetimeDB protocol.'));
        return;
      }
      finish(null, { status: 101, origin, protocol });
    });
    req.on('response', (res) => {
      res.destroy();
      finish(new Error(`HTTP ${res.statusCode}: WebSocket upgrade rejected. Check the database name, server authentication, and proxy routing/origin policy.`));
    });
    req.on('error', (err) => finish(err));
    req.end();
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [host = railwayHost, database = 'hackutd-2026-t3uux', origin = 'https://waterboard.dev'] = process.argv.slice(2);
  try {
    const result = await checkWebSocket({ host, database, origin });
    console.log(`PASS: HTTP ${result.status}, ${result.protocol}, Origin: ${result.origin}`);
    console.log('The cross-origin upgrade succeeded. Verify SDK authentication and subscriptions in the browser separately.');
  } catch (err) {
    console.error(`FAIL: ${err.code ? `${err.code}: ` : ''}${err.message}`);
    if (['ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) {
      console.error('DNS failed before the Origin header could reach the server. Restore/correct the Railway public domain first.');
    }
    process.exitCode = 1;
  }
}
