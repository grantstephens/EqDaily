import { runStoreContract } from './storeContract';
import { SqliteStore } from './SqliteStore';
import { openNodeSqlite } from './nodeSqlite';

runStoreContract('SqliteStore', async () => SqliteStore.open(openNodeSqlite(':memory:')));
