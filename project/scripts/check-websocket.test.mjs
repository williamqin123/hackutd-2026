import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { checkWebSocket } from './check-websocket.mjs';

async function fixture(t, handler) {
  const server = http.createServer();
  server.on('upgrade', handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `ws://127.0.0.1:${server.address().port}`;
}

test('sends the browser Origin and negotiates a SpacetimeDB upgrade', async (t) => {
  const host = await fixture(t, (req, socket) => {
    assert.equal(req.headers.origin, 'http://waterboard.test');
    assert.equal(req.url, '/v1/database/test-db/subscribe?compression=None');
    assert.match(req.headers['sec-websocket-protocol'], /v2\.bsatn\.spacetimedb/);
    const accept = createHash('sha1')
      .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: v2.bsatn.spacetimedb\r\n\r\n`);
  });
  assert.equal((await checkWebSocket({ host, database: 'test-db', origin: 'http://waterboard.test' })).status, 101);
});

test('reports an origin/auth rejection instead of claiming connectivity', async (t) => {
  const host = await fixture(t, (_req, socket) => {
    socket.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
  });
  await assert.rejects(checkWebSocket({ host, database: 'db', origin: 'http://waterboard.test' }), /HTTP 403/);
});

test('rejects an invalid upgrade response', async (t) => {
  const host = await fixture(t, (_req, socket) => {
    socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: invalid\r\nSec-WebSocket-Protocol: v2.bsatn.spacetimedb\r\n\r\n');
  });
  await assert.rejects(checkWebSocket({ host, database: 'db', origin: 'http://waterboard.test' }), /Invalid WebSocket/);
});

test('bounds an unresponsive handshake', async (t) => {
  const host = await fixture(t, (_req, socket) => {
    socket.on('end', () => socket.end());
  });
  await assert.rejects(checkWebSocket({ host, database: 'db', origin: 'http://waterboard.test', timeoutMs: 50 }), /timed out/);
});

test('rejects mixed content before connecting', () => {
  assert.throws(() => checkWebSocket({ host: 'ws://example.test', database: 'db', origin: 'https://waterboard.dev' }), /secure wss/);
});
