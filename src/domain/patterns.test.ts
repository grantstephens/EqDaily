// src/domain/patterns.test.ts
import { addDays } from './date';
import { buildSignals } from './patterns';
import type { Answer, Question } from './question';

const base = { hideFromInsights: false, sort: 0, archivedAt: null, created: 'T' };
const mood: Question = { ...base, id: 1, label: 'Mood', type: 'scale', config: { min: 0, max: 10 } };
const ex: Question = { ...base, id: 2, label: 'Exercise', type: 'yesno', config: {} as never };
const sym: Question = { ...base, id: 3, label: 'Symptoms', type: 'checkboxes', config: { options: ['Headache', 'Asthma'], allowOther: true } };
const bed: Question = { ...base, id: 4, label: 'Bedtime', type: 'time', config: {} as never };
const water: Question = { ...base, id: 5, label: 'Water', type: 'number', config: { decimals: 0, unit: 'glasses' } };
const energy: Question = { ...base, id: 6, label: 'Energy', type: 'choice', config: { options: ['Low', 'High'], allowOther: false } };
const note: Question = { ...base, id: 7, label: 'Note', type: 'text', config: { multiline: false, showFrequent: false } };
const a = (q: Question, date: string, value: Answer['value']): Answer => ({ date, questionId: q.id, value, updated: 'T' });
const START = '2026-10-01';
const span = (n: number, from = START) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('buildSignals', () => {
  test('yes/no becomes a binary signal over answered days only', () => {
    const d = span(4);
    const { binary } = buildSignals([ex], [a(ex, d[0]!, true), a(ex, d[1]!, false), a(ex, d[3]!, true)], d);
    expect(binary).toHaveLength(1);
    expect([...binary[0]!.days.entries()]).toEqual([[d[0], true], [d[1], false], [d[3], true]]); // d[2] skipped: absent
  });

  test('answers outside the window are ignored', () => {
    const d = span(3);
    const { binary } = buildSignals([ex], [a(ex, addDays(START, -1), true), a(ex, d[0]!, true)], d);
    expect(binary[0]!.days.size).toBe(1);
  });

  test('scale and number become numeric series; unit comes from a number config', () => {
    const d = span(3);
    const { numeric } = buildSignals([mood, water], [a(mood, d[0]!, 7), a(water, d[1]!, 6)], d);
    expect(numeric.find((s) => s.label === 'Mood')!.values.get(d[0]!)).toBe(7);
    expect(numeric.find((s) => s.label === 'Water')!.unit).toBe('glasses');
  });

  test('a time series uses the wrap-aware scale so 23:30 and 00:30 are an hour apart', () => {
    const d = span(2);
    const { numeric } = buildSignals([bed], [a(bed, d[0]!, '23:30'), a(bed, d[1]!, '00:30')], d);
    const v = numeric[0]!.values;
    expect(Math.abs(v.get(d[1]!)! - v.get(d[0]!)!)).toBe(60);
  });

  test('text questions and hidden questions produce nothing', () => {
    const d = span(3);
    const hidden = { ...ex, id: 9, hideFromInsights: true };
    const out = buildSignals([note, hidden], [a(note, d[0]!, 'hi'), a(hidden, d[0]!, true)], d);
    expect(out.binary).toEqual([]);
    expect(out.numeric).toEqual([]);
  });

  test('an option becomes a signal only when used on at least 5 days', () => {
    const d = span(8);
    const answers = d.map((day, i) => a(sym, day, i < 5 ? ['Headache'] : i === 5 ? ['Asthma'] : []));
    const { binary } = buildSignals([sym], answers, d);
    expect(binary.map((s) => s.option)).toEqual(['Headache']);
  });

  test('an empty checkbox answer counts as "off" (answered), not as skipped', () => {
    const d = span(8);
    const answers = d.map((day, i) => a(sym, day, i < 5 ? ['Headache'] : []));
    const s = buildSignals([sym], answers, d).binary[0]!;
    expect(s.days.size).toBe(8);
    expect(s.days.get(d[7]!)).toBe(false);
    expect(s.days.get(d[0]!)).toBe(true);
  });

  test('a choice option becomes a signal when used on at least 5 days; other answers are "off"', () => {
    const d = span(8);
    const answers = d.map((day, i) => a(energy, day, i < 5 ? 'High' : 'Low'));
    const { binary } = buildSignals([energy], answers, d);
    expect(binary.map((s) => s.option)).toEqual(['High']); // Low used only 3 days
    expect(binary[0]!.days.get(d[6]!)).toBe(false);
  });

  test('a numeric series with at least 10 answers also yields a "high" signal: above its own median', () => {
    const d = span(10);
    const answers = d.map((day, i) => a(mood, day, i + 1)); // 1..10, median 5.5
    const high = buildSignals([mood], answers, d).binary.find((s) => s.derived === 'high')!;
    expect(high.sourceType).toBe('scale');
    expect(high.days.get(d[5]!)).toBe(true); // 6 > 5.5
    expect(high.days.get(d[4]!)).toBe(false); // 5 < 5.5
  });

  test('fewer than 10 numeric answers: no "high" signal', () => {
    const d = span(9);
    const { binary } = buildSignals([mood], d.map((day, i) => a(mood, day, i)), d);
    expect(binary).toEqual([]);
  });

  test('a time series also yields a "later than usual" signal', () => {
    const d = span(10);
    const answers = d.map((day, i) => a(bed, day, `${String(21 + (i % 4)).padStart(2, '0')}:00`));
    const high = buildSignals([bed], answers, d).binary.find((s) => s.derived === 'high')!;
    expect(high.sourceType).toBe('time');
  });
});
