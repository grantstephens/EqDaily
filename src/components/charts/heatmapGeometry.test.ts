// src/components/charts/heatmapGeometry.test.ts
import {
  calendarGrid, cellLabel, HEATMAP_MAX_DAYS, HEATMAP_MIN_DAYS, heatmapDates, heatmapSummary, LEVELS, levelAlpha, scaleLevel, withAlpha,
} from './heatmapGeometry';

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
    const { months } = calendarGrid(range('2026-10-05', 35)); // Mon 5 Oct .. Sun 8 Nov
    expect(months).toEqual([
      { column: 0, label: 'Oct' },
      { column: 4, label: 'Nov' },
    ]);
  });
  test('a partial first month right next to the next one gives way, so labels never collide', () => {
    // range starts Mon 28 Sep: Sep would sit one column before Oct (17px apart, labels ~24px wide)
    const { months } = calendarGrid(range('2026-09-28', 42));
    expect(months).toEqual([
      { column: 1, label: 'Oct' },
      { column: 5, label: 'Nov' },
    ]);
  });
  test('labels are always at least 3 columns apart', () => {
    for (let start = 0; start < 60; start++) {
      const { months } = calendarGrid(range(new Date(Date.UTC(2026, 0, 1 + start)).toISOString().slice(0, 10), 90));
      for (let i = 1; i < months.length; i++) expect(months[i]!.column - months[i - 1]!.column).toBeGreaterThanOrEqual(3);
    }
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

describe('heatmapDates', () => {
  test('short and year-long histories are untouched', () => {
    expect(heatmapDates(range('2026-01-01', 90))).toEqual(range('2026-01-01', 90));
    expect(heatmapDates(range('2025-10-01', HEATMAP_MAX_DAYS))).toHaveLength(HEATMAP_MAX_DAYS);
  });
  test('a longer history keeps only the most recent year of days', () => {
    const long = range('2022-01-01', 1500);
    const kept = heatmapDates(long);
    expect(kept).toHaveLength(HEATMAP_MAX_DAYS);
    expect(kept.at(-1)).toBe(long.at(-1));
  });
});

describe('heatmapSummary', () => {
  const d = range('2026-10-01', 10);
  test('yes/no: counts yes, no and skipped', () => {
    const v = new Map<string, boolean | number>([[d[0]!, true], [d[1]!, true], [d[2]!, false]]);
    expect(heatmapSummary(d, v, 'yesno')).toBe('Calendar of 10 days: 2 yes, 1 no, 7 skipped');
  });
  test('slider: answered days, average and skipped', () => {
    const v = new Map<string, boolean | number>([[d[0]!, 4], [d[1]!, 7]]);
    expect(heatmapSummary(d, v, 'scale')).toBe('Calendar of 10 days: 2 answered, average 5.5, 8 skipped');
  });
  test('answers outside the dates are ignored, and nothing answered says so without NaN', () => {
    expect(heatmapSummary(d, new Map([['2025-01-01', true]]), 'yesno')).toBe('Calendar of 10 days: 0 yes, 0 no, 10 skipped');
    expect(heatmapSummary(d, new Map(), 'scale')).toBe('Calendar of 10 days: 0 answered, 10 skipped');
  });
});

test('the heatmap only shows for ranges of at least 28 days', () => {
  expect(HEATMAP_MIN_DAYS).toBe(28);
});
