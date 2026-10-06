import type { SqlDatabase } from './sql';
import { SqliteStore } from './SqliteStore';
import { openNodeSqlite } from './nodeSqlite';

/** Wraps a real database and records the order statements start in. */
function recording(inner: SqlDatabase): SqlDatabase & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    exec: (sql) => { log.push(sql.trim().split(/\s+/)[0]!.toUpperCase()); return inner.exec(sql); },
    run: (sql, params) => inner.run(sql, params),
    all: (sql, params) => { log.push('ALL'); return inner.all(sql, params); },
    each: (sql, params) => {
      log.push('EACH');
      const rows = inner.each<any>(sql, params);
      return (async function* () {
        for await (const r of rows) { log.push('ROW'); yield r; }
      })();
    },
    close: () => inner.close(),
  };
}

describe('SqliteStore.allAnswers', () => {
  test('never streams while a write transaction is open (it is serialised like every other call)', async () => {
    const db = recording(openNodeSqlite(':memory:'));
    const store = await SqliteStore.open(db);
    const q = await store.addQuestion({ label: 'Mood', type: 'scale', config: { min: 0, max: 10 }, hideFromInsights: false });
    await store.setAnswer('2026-10-01', q.id, 1);
    db.log.length = 0;

    const reading = (async () => {
      const seen: string[] = [];
      for await (const a of store.allAnswers()) seen.push(a.date);
      return seen;
    })();
    const writing = Promise.all([2, 3, 4].map((d) => store.setAnswer(`2026-10-0${d}`, q.id, d)));
    await Promise.all([reading, writing]);

    let open = false;
    for (const entry of db.log) {
      if (entry === 'BEGIN') open = true;
      else if (entry === 'COMMIT' || entry === 'ROLLBACK') open = false;
      else if (entry === 'EACH' || entry === 'ROW') expect(open).toBe(false);
    }
  });
});
