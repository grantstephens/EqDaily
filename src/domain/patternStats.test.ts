// src/domain/patternStats.test.ts
import { mean, tTwoSidedP, welch } from './patternStats';

describe('tTwoSidedP', () => {
  test.each([
    [2.0, 10, 0.0734],
    [3.0, 5, 0.0301],
    [1.0, 1, 0.5],
    [2.228139, 10, 0.05],
    [1.959964, 100000, 0.05],
  ])('t=%p df=%p -> p≈%p', (t, df, p) => {
    expect(tTwoSidedP(t, df)).toBeCloseTo(p, 3);
  });
  test('t=0 is certain, and the sign does not matter', () => {
    expect(tTwoSidedP(0, 7)).toBeCloseTo(1, 10);
    expect(tTwoSidedP(-2, 10)).toBeCloseTo(tTwoSidedP(2, 10), 12);
  });
  test('a huge t gives a tiny but valid probability', () => {
    const p = tTwoSidedP(50, 20);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1e-15);
  });
});

describe('welch', () => {
  test('identical groups: no difference', () => {
    const w = welch([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])!;
    expect(w.t).toBeCloseTo(0, 10);
    expect(w.d).toBeCloseTo(0, 10);
    expect(w.p).toBeCloseTo(1, 6);
  });
  test('a clear difference has a large effect, a tiny p, and the sign of a - b', () => {
    const w = welch([10, 11, 12, 13, 14], [1, 2, 3, 4, 5])!;
    expect(w.t).toBeCloseTo(9, 6);
    expect(w.df).toBeCloseTo(8, 6);
    expect(w.d).toBeCloseTo(9 / Math.sqrt(2.5), 6);
    expect(w.p).toBeLessThan(1e-4);
    expect(welch([1, 2, 3, 4, 5], [10, 11, 12, 13, 14])!.d).toBeLessThan(0);
  });
  test('two constant groups cannot be compared', () => {
    expect(welch([3, 3, 3], [5, 5, 5])).toBeNull();
  });
  test('one constant group is still comparable', () => {
    const w = welch([3, 3, 3, 3], [1, 2, 3, 4, 5, 6])!;
    expect(Number.isFinite(w.t) && Number.isFinite(w.p) && Number.isFinite(w.d)).toBe(true);
  });
  test('identical decimals are constant: no float-noise "effect"', () => {
    expect(welch(Array(6).fill(7.1), Array(24).fill(7.1))).toBeNull();
    expect(welch(Array(6).fill(72.4), Array(24).fill(72.4))).toBeNull();
    const w = welch(Array(5).fill(0.1), [0.1, 0.2, 0.3, 0.4, 0.5])!; // one constant group, one varying: still fine
    expect(Number.isFinite(w.d)).toBe(true);
  });
  test('fewer than two values in a group cannot be compared', () => {
    expect(welch([1], [1, 2, 3])).toBeNull();
    expect(welch([], [1, 2, 3])).toBeNull();
  });
});

test('mean', () => {
  expect(mean([1, 2, 3, 6])).toBe(3);
});
