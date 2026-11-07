import { DbConnection, tables } from '../src/module_bindings';
import { Person } from '../src/module_bindings/types';
import type { Infer } from 'spacetimedb';

const HOST = process.env.SPACETIMEDB_HOST ?? 'wss://maincloud.spacetimedb.com';
const DB_NAME = process.env.SPACETIMEDB_DB_NAME ?? 'nextjs-ts';

export type PersonData = Infer<typeof Person>;  

export async function fetchPeople(): Promise<PersonData[]> {
  let connection: DbConnection | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await new Promise<PersonData[]>((resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('SpacetimeDB connection timeout'));
      }, 10000);

      connection = DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .onConnect(conn => {
          try {
            conn
              .subscriptionBuilder()
              .onApplied(() => {
                try {
                  resolve(Array.from(conn.db.person.iter()));
                } catch (error) {
                  reject(error);
                }
              })
              .onError(ctx => {
                reject(ctx.event);
              })
              .subscribe(tables.person);
          } catch (error) {
            reject(error);
          }
        })
        .onConnectError((_ctx, error) => {
          reject(error);
        })
        .onDisconnect((_ctx, error) => {
          reject(
            error ?? new Error('SpacetimeDB disconnected before the subscription was applied')
          );
        })
        .build();
    });
  } finally {
    clearTimeout(timeoutId);
    connection?.disconnect();
  }
}
