import { averageTime, minutesToTime, timeToMinutes, unwrapTimes } from './time';

test('round trip', () => {
  expect(timeToMinutes('00:00')).toBe(0);
  expect(timeToMinutes('23:30')).toBe(1410);
  expect(minutesToTime(1410)).toBe('23:30');
  expect(minutesToTime(1470)).toBe('00:30');
  expect(minutesToTime(-30)).toBe('23:30');
});
describe('unwrapTimes', () => {
  test('series straddling midnight shifts the small values up a day', () => {
    expect(unwrapTimes([1410, 30])).toEqual([1410, 1470]);
  });
  test('late-evening-only series untouched', () => {
    expect(unwrapTimes([1380, 1430])).toEqual([1380, 1430]);
  });
  test('morning wake times untouched', () => {
    expect(unwrapTimes([420, 480])).toEqual([420, 480]);
  });
  test('empty', () => { expect(unwrapTimes([])).toEqual([]); });
  test('22:00 and 06:00 are 8 hours apart through midnight, not 16 across the day', () => {
    expect(unwrapTimes([1320, 360])).toEqual([1320, 1800]);
  });
  test('a single value is untouched', () => { expect(unwrapTimes([30])).toEqual([30]); });
  test('input order is preserved', () => {
    expect(unwrapTimes([30, 1410, 1380])).toEqual([1470, 1410, 1380]);
  });
});
describe('averageTime', () => {
  test('23:30 and 00:30 average to 00:00, not 12:00', () => {
    expect(averageTime([timeToMinutes('23:30'), timeToMinutes('00:30')])).toBe('00:00');
  });
  test('plain average', () => { expect(averageTime([420, 480])).toBe('07:30'); });
  test('22:00 and 06:00 average to 02:00', () => { expect(averageTime([1320, 360])).toBe('02:00'); });
  test('empty is null', () => { expect(averageTime([])).toBeNull(); });
});
