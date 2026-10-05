import { scaleStep, stepTime, stepValue } from './stepper';

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
  test('from null starts at 22:00 then applies the delta', () => {
    expect(stepTime(null, 15)).toBe('22:15');
    expect(stepTime(null, -15)).toBe('21:45');
  });
  test('wraps around midnight both ways', () => {
    expect(stepTime('23:50', 15)).toBe('00:05');
    expect(stepTime('00:05', -15)).toBe('23:50');
  });
});
