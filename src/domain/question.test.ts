import {
  lockViolation, normalizeValue, planAnswerWrite, questionKey,
  normalizeQuestion, validateQuestion, validateValue, type NewQuestion,
} from './question';

const scale = (min = 0, max = 10): NewQuestion =>
  ({ label: 'Mood', type: 'scale', config: { min, max }, hideFromInsights: false });
const checks = (options = ['Headache', 'Asthma'], allowOther = true): NewQuestion =>
  ({ label: 'Symptoms', type: 'checkboxes', config: { options, allowOther }, hideFromInsights: false });
const yesno = (): NewQuestion =>
  ({ label: 'Exercise', type: 'yesno', config: {} as never, hideFromInsights: false });
const time = (): NewQuestion =>
  ({ label: 'Bedtime', type: 'time', config: {} as never, hideFromInsights: false });
const num = (extra = {}): NewQuestion =>
  ({ label: 'Meals', type: 'number', config: { decimals: 0, ...extra }, hideFromInsights: false });
const text = (): NewQuestion =>
  ({ label: 't', type: 'text', config: { multiline: false, showFrequent: false }, hideFromInsights: false });

describe('validateQuestion', () => {
  test.each([
    ['empty label', { ...yesno(), label: '  ' }],
    ['81-char label', { ...yesno(), label: 'x'.repeat(81) }],
    ['scale min >= max', scale(5, 5)],
    ['scale NaN', scale(NaN, 5)],
    ['number min > max', num({ min: 5, max: 1 })],
    ['number decimals 5', num({ decimals: 5 })],
    ['number decimals fractional', num({ decimals: 1.5 })],
    ['no options', checks([])],
    ['41 options', checks(Array.from({ length: 41 }, (_, i) => `o${i}`))],
    ['empty option', checks(['a', ' '])],
    ['option with pipe', checks(['a|b'])],
    ['61-char option', checks(['x'.repeat(61)])],
    ['duplicate options', checks(['a', 'A'])],
  ])('rejects %s', (_n, q) => {
    expect(validateQuestion(q as NewQuestion)).not.toBeNull();
  });

  test('accepts good questions of every type', () => {
    for (const q of [scale(), num(), yesno(), time(), checks(),
      { label: 'Notes', type: 'text', config: { multiline: true, showFrequent: false }, hideFromInsights: false } as NewQuestion,
      { label: 'Energy', type: 'choice', config: { options: ['Low', 'High'], allowOther: false }, hideFromInsights: false } as NewQuestion,
    ]) expect(validateQuestion(q)).toBeNull();
  });
});

describe('validateValue', () => {
  test.each<[string, NewQuestion, unknown, boolean]>([
    ['scale in range', scale(0, 1), 0.5, true],
    ['scale below', scale(0, 1), -0.1, false],
    ['scale above', scale(0, 1), 1.1, false],
    ['scale not a number', scale(), '5', false],
    ['scale NaN', scale(), NaN, false],
    ['number integer ok', num(), 3, true],
    ['number fractional with decimals 0', num(), 2.5, false],
    ['number respects max', num({ max: 5 }), 6, false],
    ['yesno boolean', yesno(), false, true],
    ['yesno string', yesno(), 'yes', false],
    ['time valid', time(), '23:30', true],
    ['time 24:00', time(), '24:00', false],
    ['time 9:5', time(), '9:5', false],
    ['checkboxes empty array = answered none', checks(), [], true],
    ['checkboxes values', checks(), ['Headache', 'Other thing'], true],
    ['checkboxes duplicate', checks(), ['a', 'a'], false],
    ['checkboxes pipe', checks(), ['a|b'], false],
    ['checkboxes not array', checks(), 'a', false],
    ['text too long', text(), 'x'.repeat(5001), false],
  ])('%s', (_n, q, v, ok) => {
    expect(validateValue(q, v) === null).toBe(ok);
  });
});

describe('normalizeValue', () => {
  test('trims strings and dedupes/trims arrays preserving order', () => {
    expect(normalizeValue(checks(), [' a ', 'b', 'a'])).toEqual(['a', 'b']);
    expect(normalizeValue({ label: 'c', type: 'choice', config: { options: ['x'], allowOther: true }, hideFromInsights: false }, ' hi ')).toBe('hi');
  });
});

describe('lockViolation', () => {
  test('nothing locked while unanswered', () => {
    expect(lockViolation(scale(0, 10), yesno(), false)).toBeNull();
    expect(lockViolation(scale(0, 10), scale(1, 5), false)).toBeNull();
  });
  test('type locked once answered', () => {
    expect(lockViolation(scale(), yesno(), true)).toMatch(/type/i);
  });
  test('scale/number bounds locked once answered', () => {
    expect(lockViolation(scale(0, 10), scale(0, 5), true)).toMatch(/min|max|range/i);
    expect(lockViolation(num({ min: 0 }), num({ min: 1 }), true)).not.toBeNull();
  });
  test('label, unit, options stay editable once answered', () => {
    expect(lockViolation({ ...num(), label: 'A' }, { ...num({ unit: 'meals' }), label: 'B' }, true)).toBeNull();
    expect(lockViolation(checks(['a']), checks(['b']), true)).toBeNull();
  });
});

describe('questionKey', () => {
  test('is case/space-insensitive on label, sensitive to type', () => {
    expect(questionKey({ label: ' Mood ', type: 'scale' })).toBe(questionKey({ label: 'mood', type: 'scale' }));
    expect(questionKey({ label: 'Mood', type: 'scale' })).not.toBe(questionKey({ label: 'Mood', type: 'number' }));
  });
});

describe('planAnswerWrite', () => {
  test('checkbox diff', () => {
    expect(planAnswerWrite(checks(), ['a', 'b'], ['b', 'c'])).toEqual({ value: ['b', 'c'], added: ['c'], removed: ['a'] });
  });
  test('null deletes and removes everything', () => {
    expect(planAnswerWrite(checks(), ['a'], null)).toEqual({ value: null, added: [], removed: ['a'] });
  });
  test('re-saving the same value changes nothing', () => {
    expect(planAnswerWrite(checks(), ['a'], ['a'])).toEqual({ value: ['a'], added: [], removed: [] });
  });
  test('non-option types never report usage', () => {
    expect(planAnswerWrite(scale(), 3, 4)).toEqual({ value: 4, added: [], removed: [] });
  });
  test('throws on invalid', () => {
    expect(() => planAnswerWrite(scale(0, 1), null, 5)).toThrow();
  });
  test('whitespace-only text is a skip', () => {
    expect(planAnswerWrite(text(), 'old', '   ').value).toBeNull();
  });
});

describe('normalizeQuestion', () => {
  test('trims the label and every option so what is stored matches what answers will match', () => {
    const q = normalizeQuestion({ ...checks([' x ', 'y ']), label: '  Sym  ' });
    expect(q.label).toBe('Sym');
    expect((q.config as { options: string[] }).options).toEqual(['x', 'y']);
  });
  test('trims a number unit and drops an empty one', () => {
    expect((normalizeQuestion(num({ unit: ' kg ' })).config as { unit?: string }).unit).toBe('kg');
    expect((normalizeQuestion(num({ unit: '  ' })).config as { unit?: string }).unit).toBeUndefined();
  });
  test('leaves other types alone', () => {
    expect(normalizeQuestion(yesno())).toEqual(yesno());
  });
});

describe('text answers', () => {
  test('CRLF line endings are stored as LF so an export/import round trip is lossless', () => {
    expect(planAnswerWrite(text(), null, 'a\r\nb').value).toBe('a\nb');
  });
});

describe('lockViolation decimals', () => {
  test('decimals may increase but not decrease once answered', () => {
    expect(lockViolation(num({ decimals: 1 }), num({ decimals: 2 }), true)).toBeNull();
    expect(lockViolation(num({ decimals: 2 }), num({ decimals: 1 }), true)).toMatch(/decimal/i);
  });
  test('decimals are free while unanswered', () => {
    expect(lockViolation(num({ decimals: 2 }), num({ decimals: 0 }), false)).toBeNull();
  });
});
