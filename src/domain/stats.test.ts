import type { Answer, Question } from './question';
import { frequentPhrases, previousDates, rangeDates, summarize } from './stats';

const base = { hideFromInsights: false, sort: 0, archivedAt: null, created: 'T' };
const mood: Question = { ...base, id: 1, label: 'Mood', type: 'scale', config: { min: 0, max: 10 } };
const ex: Question = { ...base, id: 2, label: 'Exercise', type: 'yesno', config: {} as never };
const sym: Question = { ...base, id: 3, label: 'Sym', type: 'checkboxes', config: { options: ['a', 'b'], allowOther: true } };
const en: Question = { ...base, id: 4, label: 'Energy', type: 'choice', config: { options: ['Low', 'High'], allowOther: false } };
const bed: Question = { ...base, id: 5, label: 'Bed', type: 'time', config: {} as never };
const note: Question = { ...base, id: 6, label: 'Thx', type: 'text', config: { multiline: true, showFrequent: true } };
const a = (q: Question, date: string, value: Answer['value']): Answer => ({ date, questionId: q.id, value, updated: 'T' });
const D = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']; // 4-day window

describe('rangeDates / previousDates', () => {
  test('7 days ends on end and is ascending', () => {
    const r = rangeDates('2026-10-07', 7, null);
    expect(r).toHaveLength(7);
    expect(r[0]).toBe('2026-10-01'); expect(r[6]).toBe('2026-10-07');
  });
  test('all runs from first answer', () => {
    expect(rangeDates('2026-10-03', 'all', '2026-10-01')).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });
  test('all with no answers is just today', () => {
    expect(rangeDates('2026-10-03', 'all', null)).toEqual(['2026-10-03']);
  });
  test('all with a first answer after today is just today', () => {
    expect(rangeDates('2026-10-03', 'all', '2026-10-09')).toEqual(['2026-10-03']);
  });
  test('previous window is the same length, immediately before', () => {
    expect(previousDates(['2026-10-03', '2026-10-04'], 7)).toEqual(['2026-10-01', '2026-10-02']);
    expect(previousDates(['2026-10-03'], 'all')).toEqual([]);
  });
});

describe('numeric', () => {
  test('average over answered days only; coverage counts skips', () => {
    const s = summarize(mood, [a(mood, D[0]!, 4), a(mood, D[2]!, 8)], D, []);
    expect(s).toMatchObject({ kind: 'numeric', average: 6, previousAverage: null, change: null, coverage: { answered: 2, total: 4 }, axisMin: 0, axisMax: 10 });
    if (s.kind === 'numeric') expect(s.points.map((p) => p.date)).toEqual([D[0], D[2]]);
  });
  test('change vs previous window', () => {
    const s = summarize(mood, [a(mood, D[0]!, 6)], D, [a(mood, '2026-09-30', 4)], ['2026-09-30']);
    expect(s).toMatchObject({ average: 6, previousAverage: 4, change: 2 });
  });
  test('previous answers outside the previous window are ignored', () => {
    const s = summarize(mood, [a(mood, D[0]!, 6)], D, [a(mood, '2026-01-01', 4)], ['2026-09-30']);
    expect(s).toMatchObject({ previousAverage: null, change: null });
  });
  test('no answers: null average, no NaN', () => {
    const s = summarize(mood, [], D, []);
    expect(s).toMatchObject({ average: null, change: null, coverage: { answered: 0, total: 4 } });
  });
  test('ignores other questions and out-of-window dates', () => {
    const s = summarize(mood, [a(ex, D[0]!, true), a(mood, '2026-01-01', 9)], D, []);
    expect(s).toMatchObject({ average: null, coverage: { answered: 0, total: 4 } });
  });
  test('number axis derives from data when config has no bounds', () => {
    const meals: Question = { ...base, id: 9, label: 'M', type: 'number', config: { decimals: 0, unit: 'meals' } };
    const s = summarize(meals, [a(meals, D[0]!, 2), a(meals, D[1]!, 5)], D, []);
    expect(s).toMatchObject({ axisMin: 0, axisMax: 5, unit: 'meals' });
  });
  test('single point has a non-degenerate axis', () => {
    const meals: Question = { ...base, id: 9, label: 'M', type: 'number', config: { decimals: 0 } };
    const s = summarize(meals, [a(meals, D[0]!, 3)], D, []);
    if (s.kind !== 'numeric') throw new Error();
    expect(s.axisMax).toBeGreaterThan(s.axisMin);
  });
  test('all-zero data has a non-degenerate axis', () => {
    const meals: Question = { ...base, id: 9, label: 'M', type: 'number', config: { decimals: 0 } };
    const s = summarize(meals, [a(meals, D[0]!, 0)], D, []);
    if (s.kind !== 'numeric') throw new Error();
    expect(s.axisMax).toBeGreaterThan(s.axisMin);
  });
});

describe('yesno', () => {
  test('percent yes is over answered days; skipped days are null in the strip', () => {
    const s = summarize(ex, [a(ex, D[0]!, true), a(ex, D[1]!, false), a(ex, D[2]!, true)], D, []);
    expect(s).toMatchObject({ kind: 'yesno', percentYes: (2 / 3) * 100, coverage: { answered: 3, total: 4 } });
    if (s.kind === 'yesno') expect(s.days.map((d) => d.value)).toEqual([true, false, true, null]);
  });
  test('no answers → percentYes null (not 0)', () => {
    expect(summarize(ex, [], D, [])).toMatchObject({ percentYes: null });
  });
});

describe('options', () => {
  test('checkbox ranking: % of answered days; [] counts as answered', () => {
    const s = summarize(sym, [a(sym, D[0]!, ['a', 'b']), a(sym, D[1]!, ['a']), a(sym, D[2]!, [])], D, []);
    expect(s).toMatchObject({ kind: 'options', coverage: { answered: 3, total: 4 } });
    if (s.kind === 'options') expect(s.ranking).toEqual([
      { option: 'a', count: 2, percent: (2 / 3) * 100 },
      { option: 'b', count: 1, percent: (1 / 3) * 100 },
    ]);
  });
  test('choice distribution sums to 100 over answered', () => {
    const s = summarize(en, [a(en, D[0]!, 'Low'), a(en, D[1]!, 'Low'), a(en, D[2]!, 'High')], D, []);
    if (s.kind !== 'choice') throw new Error();
    expect(s.distribution.map((d) => d.option)).toEqual(['Low', 'High']);
    expect(s.distribution.reduce((t, d) => t + d.percent, 0)).toBeCloseTo(100);
  });
});

describe('time', () => {
  test('bedtimes across midnight average to 00:00 and unwrap in points', () => {
    const s = summarize(bed, [a(bed, D[0]!, '23:30'), a(bed, D[1]!, '00:30')], D, []);
    if (s.kind !== 'time') throw new Error();
    expect(s.average).toBe('00:00');
    expect(s.points.map((p) => p.value)).toEqual([1410, 1470]);
  });
});

describe('text', () => {
  test('frequentPhrases splits, groups case-insensitively, needs count>=2', () => {
    expect(frequentPhrases(['Family, coffee', 'family; Sun', 'coffee\nfamily'])).toEqual([
      { text: 'Family', count: 3 }, { text: 'coffee', count: 2 },
    ]);
  });
  test('summary exposes frequent only when showFrequent, plus recent newest first', () => {
    const s = summarize(note, [a(note, D[0]!, 'x'), a(note, D[1]!, 'y')], D, []);
    if (s.kind !== 'text') throw new Error();
    expect(s.recent.map((r) => r.date)).toEqual([D[1], D[0]]);
    const off = summarize({ ...note, config: { multiline: true, showFrequent: false } }, [a(note, D[0]!, 'x, x')], D, []);
    if (off.kind === 'text') expect(off.frequent).toEqual([]);
    else throw new Error();
  });
});
