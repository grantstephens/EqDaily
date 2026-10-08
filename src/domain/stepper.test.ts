import { scaleStart, scaleStep, stepTime, stepValue } from './stepper';

const opts = { min: 0, max: 10, step: 1, start: 5, decimals: 0 };

describe('stepValue', () => {
  test('first press from null returns the start value whichever way', () => {
    expect(stepValue(null, 1, opts)).toBe(5);
    expect(stepValue(null, -1, opts)).toBe(5);
  });
  test('steps and clamps at both ends', () => {
    expect(stepValue(5, 1, opts)).toBe(6);
    expect(stepValue(10, 1, opts)).toBe(10);
    expect(stepValue(0, -1, opts)).toBe(0);
  });
  test('rounds float noise to the decimals', () => {
    expect(stepValue(0.2, 1, { ...opts, step: 0.1, decimals: 1 })).toBe(0.3);
    expect(stepValue(0.1, 1, { ...opts, step: 0.2, decimals: 1 })).toBe(0.3);
  });
});

describe('scaleStep', () => {
  test('uses the configured step', () => { expect(scaleStep({ min: 0, max: 10, step: 0.5 })).toBe(0.5); });
  test('whole steps for wide scales', () => { expect(scaleStep({ min: 1, max: 10 })).toBe(1); });
  test('tenths for narrow scales', () => { expect(scaleStep({ min: 0, max: 1 })).toBeCloseTo(0.1); });
});

describe('stepTime', () => {
  test('first press from null just sets the 22:00 start, whichever way', () => {
    expect(stepTime(null, 15)).toBe('22:00');
    expect(stepTime(null, -15)).toBe('22:00');
  });
  test('wraps around midnight both ways', () => {
    expect(stepTime('23:50', 15)).toBe('00:05');
    expect(stepTime('00:05', -15)).toBe('23:50');
  });
});

describe('scaleStart', () => {
  test('midpoint when it is on the grid', () => { expect(scaleStart({ min: 0, max: 10 })).toBe(5); });
  test('snaps an off-grid midpoint onto the step grid from min', () => {
    expect(scaleStart({ min: 1, max: 10 })).toBe(6);
    expect(Number.isInteger(scaleStart({ min: 1, max: 10 }))).toBe(true);
  });
  test('honours a configured step', () => { expect(scaleStart({ min: 0, max: 1, step: 0.25 })).toBe(0.5); });
  test('never leaves the range', () => { expect(scaleStart({ min: 0, max: 1, step: 5 })).toBeLessThanOrEqual(1); });
});

describe('stepTime with a start', () => {
  test('the first press from unanswered lands on the question default', () => {
    expect(stepTime(null, 15, '07:00')).toBe('07:00');
    expect(stepTime(null, -15, '07:00')).toBe('07:00');
  });
  test('an existing answer ignores the default', () => {
    expect(stepTime('08:00', 15, '07:00')).toBe('08:15');
  });
});
