import 'fake-indexeddb/auto';

import { runStoreContract } from './storeContract';
import { SqliteStore } from './SqliteStore';
import { IndexedDbStore } from './IndexedDbStore';
import { openNodeSqlite } from './nodeSqlite';

runStoreContract('SqliteStore', async () => SqliteStore.open(openNodeSqlite(':memory:')));

// A fresh database name per store keeps the tests isolated without tearing
// IndexedDB down between them.
let dbCounter = 0;
runStoreContract('IndexedDbStore', async () => IndexedDbStore.open(`eqdaily-test-${dbCounter++}`));
