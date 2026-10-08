// src/components/charts/heatmapGeometry.test.ts
import { calendarGrid, cellLabel, HEATMAP_MIN_DAYS, LEVELS, levelAlpha, scaleLevel, withAlpha } from './heatmapGeometry';

const range = (from: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const t = new Date(`${from}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + i);
    return t.toISOString().slice(0, 10);
  });

// 2026-10-05 is a Monday, 2026-10-11 a Sunday.
describe('calendarGrid', () => {
  test('a whole number of Monday-to-Sunday weeks has no padding', () => {
    const { columns } = calendarGrid(range('2026-10-05', 14));
    expect(columns).toHaveLength(2);
    expect(columns[0]).toEqual(range('2026-10-05', 7));
    expect(columns[1]).toEqual(range('2026-10-12', 7));
  });
  test('a range starting mid-week is padded at the top of its first column', () => {
    const { columns } = calendarGrid(range('2026-10-08', 5)); // Thu 8 .. Mon 12
    expect(columns[0]).toEqual([null, null, null, '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(columns[1]).toEqual(['2026-10-12', null, null, null, null, null, null]);
  });
  test('every column always has exactly 7 slots', () => {
    for (const n of [1, 2, 6, 7, 8, 13, 29, 30, 91]) {
      const { columns } = calendarGrid(range('2026-10-03', n));
      expect(columns.every((c) => c.length === 7)).toBe(true);
      expect(columns.flat().filter((d) => d !== null)).toEqual(range('2026-10-03', n));
    }
  });
  test('a single day', () => {
    expect(calendarGrid(['2026-10-08']).columns).toEqual([[null, null, null, '2026-10-08', null, null, null]]);
  });
  test('no dates gives an empty grid', () => {
    expect(calendarGrid([])).toEqual({ columns: [], months: [] });
  });
  test('weekday rows are right across a month and year end and a US DST change', () => {
    const { columns } = calendarGrid(range('2026-10-26', 14)); // Mon 26 Oct .. Sun 8 Nov (DST ended 1 Nov)
    expect(columns[0]![6]).toBe('2026-11-01'); // Sunday
    expect(columns[1]![0]).toBe('2026-11-02'); // Monday
    const ny = calendarGrid(range('2026-12-28', 7)); // Mon 28 Dec .. Sun 3 Jan
    expect(ny.columns[0]![4]).toBe('2027-01-01'); // Friday
  });
  test('month labels sit on the first column of each month', () => {
    const { months } = calendarGrid(range('2026-09-28', 42)); // Mon 28 Sep .. Sun 8 Nov
    expect(months).toEqual([
      { column: 0, label: 'Sep' },
      { column: 1, label: 'Oct' },
      { column: 5, label: 'Nov' },
    ]);
  });
});

describe('scaleLevel', () => {
  test('min is the lowest level, max the highest, and it rises monotonically', () => {
    expect(scaleLevel(0, 0, 10)).toBe(1);
    expect(scaleLevel(10, 0, 10)).toBe(LEVELS);
    const levels = [0, 2, 4, 6, 8, 10].map((v) => scaleLevel(v, 0, 10));
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });
  test('the middle of the scale is the middle level', () => {
    expect(scaleLevel(5, 0, 10)).toBe(3);
  });
  test('out-of-range values clamp; equal bounds and NaN do not blow up', () => {
    expect(scaleLevel(-5, 0, 10)).toBe(1);
    expect(scaleLevel(99, 0, 10)).toBe(LEVELS);
    expect(scaleLevel(3, 5, 5)).toBe(3);
    expect(scaleLevel(NaN, 0, 10)).toBe(3);
  });
});

describe('levelAlpha / withAlpha', () => {
  test('alpha climbs from faint to solid', () => {
    expect(levelAlpha(1)).toBe(0.25);
    expect(levelAlpha(LEVELS)).toBe(1);
    expect(levelAlpha(3)).toBeGreaterThan(levelAlpha(2));
  });
  test('withAlpha turns a hex colour into rgba', () => {
    expect(withAlpha('#4326D9', 0.5)).toBe('rgba(67, 38, 217, 0.5)');
    expect(withAlpha('#C6BFFF', 1)).toBe('rgba(198, 191, 255, 1)');
  });
});

describe('cellLabel', () => {
  test('yes, no, skipped and a number', () => {
    expect(cellLabel('2026-10-07', true)).toBe('Wed 7 Oct 2026: yes');
    expect(cellLabel('2026-10-07', false)).toBe('Wed 7 Oct 2026: no');
    expect(cellLabel('2026-10-07', undefined)).toBe('Wed 7 Oct 2026: skipped');
    expect(cellLabel('2026-10-07', 7.5)).toBe('Wed 7 Oct 2026: 7.5');
    expect(cellLabel('2026-10-07', 7)).toBe('Wed 7 Oct 2026: 7');
    expect(cellLabel('2026-10-07', 7.26)).toBe('Wed 7 Oct 2026: 7.3');
  });
});

test('the heatmap only shows for ranges of at least 28 days', () => {
  expect(HEATMAP_MIN_DAYS).toBe(28);
});
