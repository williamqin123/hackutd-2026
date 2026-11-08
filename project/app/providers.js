'use client';

import { useMemo } from 'react';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from '../src/module_bindings';

const HOST =
  process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? 'wss://maincloud.spacetimedb.com';
const DB_NAME = process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? 'nextjs-ts';
const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;

const onConnect = (_conn, identity, token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
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
        .withToken(
          typeof window !== 'undefined'
            ? localStorage.getItem(TOKEN_KEY) || undefined
            : undefined
        )
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
