'use client';

import { useMemo } from 'react';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from '../src/module_bindings';

// Normalize an http(s):// or ws(s):// host into a websocket URI without a
// trailing slash. Lets us reuse the same env values a partner used for an
// http-style SpacetimeDB host.
function toWsUri(raw) {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) return 'wss://maincloud.spacetimedb.com';
  if (value.startsWith('https://')) return `wss://${value.slice('https://'.length)}`;
  if (value.startsWith('http://')) return `ws://${value.slice('http://'.length)}`;
  if (value.startsWith('ws://') || value.startsWith('wss://')) return value;
  return `ws://${value}`;
}

// Use the shared database when build-time env vars are absent. Loopback would
// point to the visitor's own device; local development must opt in via env.
const HOST = toWsUri(process.env.NEXT_PUBLIC_SPACETIMEDB_HOST);
const DB_NAME =
  process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME?.trim() || 'hackutd-2026-t3uux';
const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;

function readSavedToken() {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(TOKEN_KEY) || undefined
      : undefined;
  } catch {
    // Storage can be unavailable in restricted browser contexts. Connecting
    // without a saved token still lets SpacetimeDB issue a session identity.
    return undefined;
  }
}

const onConnect = (_conn, identity, token) => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // Persistence is optional; a storage error must not interrupt onConnect.
  }
  console.log(
    'Connected to SpacetimeDB with identity:',
    identity.toHexString()
  );
};

const onDisconnect = () => {
  console.log('Disconnected from SpacetimeDB');
};

const onConnectError = (_ctx, err) => {
  console.log('Error connecting to SpacetimeDB:', err);
};

export function Providers({ children }) {
  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        // Avoid WebKit DecompressionStream failures on incoming messages.
        // This changes message compression only; the connection still uses TLS.
        .withCompression('none')
        .withToken(readSavedToken())
        .withAutomaticReconnect()
        .onConnect(onConnect)
        .onDisconnect(onDisconnect)
        .onConnectError(onConnectError),
    []
  );

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      {children}
    </SpacetimeDBProvider>
  );
}
