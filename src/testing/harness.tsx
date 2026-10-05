import React from 'react';

import type { Store } from '../domain/store';
import { SqliteStore } from '../storage/SqliteStore';
import { openNodeSqlite } from '../storage/nodeSqlite';
import { TrackerProvider } from '../TrackerContext';

/** A real store on in-memory SQLite plus a provider wrapper, for screen tests. */
export async function makeHarness(now: () => Date = () => new Date(2026, 9, 5, 12)) {
  const store: Store = await SqliteStore.open(openNodeSqlite(':memory:'));
  const wrap = (ui: React.ReactElement) => (
    <TrackerProvider store={store} now={now}>{ui}</TrackerProvider>
  );
  return { store, now, wrap };
}
