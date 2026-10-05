import { linePath, scalePoints, segments, shortDate } from './chartGeometry';

const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
const pt = (date: string, value: number) => ({ date, value });

describe('scalePoints', () => {
  test('min maps to the bottom, max to the top, days spread left to right', () => {
    const [a, b] = scalePoints([pt(dates[0]!, 0), pt(dates[3]!, 10)], dates, 100, 50, 0, 10, 0);
    expect(a).toEqual({ x: 0, y: 50 });
    expect(b).toEqual({ x: 100, y: 0 });
  });
  test('padding insets both axes', () => {
    const [a] = scalePoints([pt(dates[0]!, 0)], dates, 100, 50, 0, 10, 8);
    expect(a).toEqual({ x: 8, y: 42 });
  });
  test('a single day window is centred horizontally', () => {
    const [a] = scalePoints([pt('2026-10-01', 5)], ['2026-10-01'], 100, 50, 0, 10, 0);
    expect(a!.x).toBe(50);
  });
  test('equal axis bounds do not divide by zero', () => {
    const [a] = scalePoints([pt(dates[0]!, 5)], dates, 100, 50, 5, 5, 0);
    expect(Number.isFinite(a!.y)).toBe(true);
    expect(a!.y).toBe(25);
  });
  test('points outside the window are dropped', () => {
    expect(scalePoints([pt('2026-01-01', 5)], dates, 100, 50, 0, 10)).toEqual([]);
  });
  test('values beyond the axis are clamped onto it', () => {
    const [a] = scalePoints([pt(dates[0]!, 99)], dates, 100, 50, 0, 10, 0);
    expect(a!.y).toBe(0);
  });
  test('zero width is finite', () => {
    const [a] = scalePoints([pt(dates[0]!, 5)], dates, 0, 50, 0, 10, 0);
    expect(Number.isFinite(a!.x)).toBe(true);
  });
});

describe('linePath', () => {
  test('empty is an empty string', () => { expect(linePath([])).toBe(''); });
  test('one point is a move only', () => { expect(linePath([{ x: 1, y: 2 }])).toBe('M 1 2'); });
  test('several points', () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 10.5, y: 5 }])).toBe('M 0 0 L 10.5 5');
  });
});

describe('segments', () => {
  test('consecutive days form one run', () => {
    expect(segments([pt(dates[0]!, 1), pt(dates[1]!, 2)], dates)).toEqual([[pt(dates[0]!, 1), pt(dates[1]!, 2)]]);
  });
  test('a skipped day splits the line instead of interpolating across it', () => {
    const s = segments([pt(dates[0]!, 1), pt(dates[1]!, 2), pt(dates[3]!, 4)], dates);
    expect(s).toHaveLength(2);
    expect(s[1]).toEqual([pt(dates[3]!, 4)]);
  });
  test('lonely points are their own segments', () => {
    expect(segments([pt(dates[0]!, 1), pt(dates[2]!, 3)], dates)).toHaveLength(2);
  });
  test('no points, no segments', () => { expect(segments([], dates)).toEqual([]); });
});

test('shortDate', () => { expect(shortDate('2026-10-05')).toBe('5 Oct'); });
