// src/domain/streaks.test.ts
import { currentStreak, longestStreak, yesStreak } from './streaks';

const T = '2026-10-14';

describe('currentStreak', () => {
  test('counts consecutive days ending today', () => {
    expect(currentStreak(['2026-10-14', '2026-10-13', '2026-10-12'], T)).toBe(3);
  });
  test('an empty today does not break it yet: count from yesterday', () => {
    expect(currentStreak(['2026-10-13', '2026-10-12'], T)).toBe(2);
  });
  test('but nothing today or yesterday means no streak', () => {
    expect(currentStreak(['2026-10-12', '2026-10-11'], T)).toBe(0);
  });
  test('a gap ends the run', () => {
    expect(currentStreak(['2026-10-14', '2026-10-13', '2026-10-11'], T)).toBe(2);
  });
  test('no days, duplicates, and future days', () => {
    expect(currentStreak([], T)).toBe(0);
    expect(currentStreak(['2026-10-14', '2026-10-14'], T)).toBe(1);
    expect(currentStreak(['2026-10-15', '2026-10-16'], T)).toBe(0);
  });
  test('runs across month, year and DST boundaries', () => {
    expect(currentStreak(['2026-11-02', '2026-11-01', '2026-10-31'], '2026-11-02')).toBe(3);
    expect(currentStreak(['2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01')).toBe(3);
    expect(currentStreak(['2026-11-02', '2026-11-01', '2026-10-31'], '2026-11-02')).toBe(3); // US DST ends 1 Nov 2026
  });
});

describe('longestStreak', () => {
  test('finds the longest run anywhere', () => {
    expect(longestStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06'])).toBe(3);
  });
  test('order and duplicates do not matter', () => {
    expect(longestStreak(['2026-10-03', '2026-10-01', '2026-10-02', '2026-10-02'])).toBe(3);
  });
  test('empty is 0 and a single day is 1', () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-10-01'])).toBe(1);
  });
  test('crosses a month and year end', () => {
    expect(longestStreak(['2026-12-30', '2026-12-31', '2027-01-01'])).toBe(3);
  });
});

describe('yesStreak', () => {
  const m = (entries: [string, boolean][]) => new Map(entries);
  test('counts consecutive Yes days ending today', () => {
    expect(yesStreak(m([['2026-10-14', true], ['2026-10-13', true], ['2026-10-12', true]]), T)).toBe(3);
  });
  test('a No ends the run', () => {
    expect(yesStreak(m([['2026-10-14', true], ['2026-10-13', false], ['2026-10-12', true]]), T)).toBe(1);
  });
  test('a skipped day (absent) ends the run and is never a Yes', () => {
    expect(yesStreak(m([['2026-10-14', true], ['2026-10-12', true]]), T)).toBe(1);
  });
  test('today not answered yet: count from yesterday; today answered No: zero', () => {
    expect(yesStreak(m([['2026-10-13', true], ['2026-10-12', true]]), T)).toBe(2);
    expect(yesStreak(m([['2026-10-14', false], ['2026-10-13', true]]), T)).toBe(0);
  });
});
