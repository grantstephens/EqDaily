import { Platform } from 'react-native';

import type { Store } from '../domain/store';
import { IndexedDbStore } from './IndexedDbStore';
import { SqliteStore } from './SqliteStore';
import { openExpoSqlite } from './expoSqlite';

const DATABASE = 'eqdaily.db';

/**
 * openStore opens the right Store for the platform: SQLite on Android, and
 * IndexedDB on the web, where it needs neither WASM nor cross-origin isolation.
 */
export async function openStore(): Promise<Store> {
  if (Platform.OS === 'web') {
    return IndexedDbStore.open(DATABASE);
  }
  return SqliteStore.open(await openExpoSqlite(DATABASE));
}
