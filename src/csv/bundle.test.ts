import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { SqliteStore } from '../storage/SqliteStore';
import { openNodeSqlite } from '../storage/nodeSqlite';
import { exportBundle, exportFileName, formatRowError, importBundle } from './bundle';
import type { Store } from '../domain/store';

const open = () => SqliteStore.open(openNodeSqlite(':memory:'));
async function seeded(): Promise<Store> {
  const s = await open();
  const mood = await s.addQuestion({ label: 'Mood', type: 'scale', config: { min: 0, max: 1 }, hideFromInsights: true });
  const sym = await s.addQuestion({ label: 'Symptoms, "misc"', type: 'checkboxes', config: { options: ['Headache', 'Asthma'], allowOther: true }, hideFromInsights: false });
  const note = await s.addQuestion({ label: 'Thankful', type: 'text', config: { multiline: true, showFrequent: true }, hideFromInsights: false });
  const old = await s.addQuestion({ label: 'Old', type: 'yesno', config: {} as never, hideFromInsights: false });
  await s.setAnswer('2026-10-01', mood.id, 0.7);
  await s.setAnswer('2026-10-01', sym.id, ['Headache', 'Wheezy']);
  await s.setAnswer('2026-10-02', sym.id, []);
  await s.setAnswer('2026-10-02', note.id, 'family,\n"coffee"');
  await s.setAnswer('2026-10-02', old.id, false);
  await s.setArchived(old.id, true);
  return s;
}
const files = (b: Uint8Array) => ({ q: strFromU8(unzipSync(b)['questions.csv']!), a: strFromU8(unzipSync(b)['answers.csv']!) });

test('export → import into empty → export is byte-identical', async () => {
  const a = await seeded();
  const first = await exportBundle(a);
  const b = await open();
  const r = await importBundle(b, first, false);
  expect(r.errors).toEqual([]);
  expect(r).toMatchObject({ questionsAdded: 4, answersAdded: 5 });
  expect(files(await exportBundle(b))).toEqual(files(first));
});
test('round trip preserves archived state, hideFromInsights, empty-array answers and awkward text', async () => {
  const b = await open();
  await importBundle(b, await exportBundle(await seeded()), false);
  const qs = await b.listQuestions({ includeArchived: true });
  expect(qs.find((q) => q.label === 'Old')!.archivedAt).not.toBeNull();
  expect(qs.find((q) => q.label === 'Mood')!.hideFromInsights).toBe(true);
  const day2 = await b.getAnswers('2026-10-02');
  expect(day2.map((x) => x.value)).toContainEqual([]);
  expect(day2.map((x) => x.value)).toContain('family,\n"coffee"');
});
test('importing twice skips, overwrite replaces', async () => {
  const s = await seeded();
  const bytes = await exportBundle(s);
  expect(await importBundle(s, bytes, false)).toMatchObject({ questionsAdded: 0, answersAdded: 0, answersSkipped: 5 });
  expect(await importBundle(s, bytes, true)).toMatchObject({ answersAdded: 5, answersSkipped: 0 });
});
test('answers attach to an existing archived question instead of duplicating it', async () => {
  const s = await seeded();
  const bytes = await exportBundle(s);
  await importBundle(s, bytes, true);
  expect((await s.listQuestions({ includeArchived: true })).filter((q) => q.label === 'Old')).toHaveLength(1);
});
test('exportFileName', () => { expect(exportFileName('2026-10-05')).toBe('eqdaily-2026-10-05.zip'); });

describe('malformed input aborts with nothing written', () => {
  const zip = (a: string, q: string) => zipSync({ 'answers.csv': strToU8(a), 'questions.csv': strToU8(q) });
  const Q = 'label,type,config_json,sort,archived\nMood,scale,"{""min"":0,""max"":10,""hideFromInsights"":false}",0,\n';
  const H = 'date,question,type,value,updated\n';
  const T = '2026-10-01T00:00:00Z';

  test('not a zip', async () => {
    const r = await importBundle(await open(), strToU8('date,body\n'), false);
    expect(r.errors[0]).toMatchObject({ file: 'zip' });
  });
  test('missing file', async () => {
    const r = await importBundle(await open(), zipSync({ 'answers.csv': strToU8(H) }), false);
    expect(r.errors[0]!.message).toMatch(/questions\.csv/);
  });
  test.each([
    ['bad date', `2026-02-30,Mood,scale,5,${T}`],
    ['out-of-range value', `2026-10-01,Mood,scale,50,${T}`],
    ['unparseable value', `2026-10-01,Mood,scale,abc,${T}`],
    ['bad timestamp', '2026-10-01,Mood,scale,5,yesterday'],
    ['unknown question', `2026-10-01,Ghost,scale,5,${T}`],
    ['wrong field count', `2026-10-01,Mood,scale`],
  ])('%s → error with row number, store untouched', async (_n, row) => {
    const s = await open();
    const r = await importBundle(s, zip(`${H}2026-10-01,Mood,scale,5,${T}\n${row}\n`, Q), false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ file: 'answers.csv', row: 3 });
    expect(formatRowError(r.errors[0]!)).toMatch(/^answers\.csv row 3: /);
    expect(r.answersAdded).toBe(0);
    expect(await s.listQuestions({ includeArchived: true })).toEqual([]);
  });
  test('unknown header column rejected by name', async () => {
    const r = await importBundle(await open(), zip('date,question,type,value,updated,extra\n', Q), false);
    expect(r.errors[0]!.message).toMatch(/extra/);
  });
  test('BOM and CRLF tolerated', async () => {
    const s = await open();
    const r = await importBundle(s, zip(`﻿${H.replace(/\n/g, '\r\n')}2026-10-01,Mood,scale,5,${T}\r\n`, `﻿${Q.replace(/\n/g, '\r\n')}`), false);
    expect(r.errors).toEqual([]);
    expect(r.answersAdded).toBe(1);
  });
  test('config_json that is not an object', async () => {
    const r = await importBundle(await open(), zip(H, 'label,type,config_json,sort,archived\nMood,scale,5,0,\n'), false);
    expect(r.errors[0]).toMatchObject({ file: 'questions.csv', row: 2 });
  });
  test('invalid question definition reports its questions.csv row', async () => {
    const r = await importBundle(await open(), zip(H, 'label,type,config_json,sort,archived\nBad,scale,"{""min"":5,""max"":1}",0,\n'), false);
    expect(r.errors[0]).toMatchObject({ file: 'questions.csv', row: 2 });
  });
});
