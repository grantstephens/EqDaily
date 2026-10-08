// src/domain/weekly.test.ts
import { addDays } from './date';
import type { Answer, Question } from './question';
import { weeklySummary } from './weekly';

const base = { hideFromInsights: false, sort: 0, archivedAt: null, created: 'T' };
const mood: Question = { ...base, id: 1, label: 'Mood', type: 'scale', config: { min: 0, max: 10 } };
const water: Question = { ...base, id: 2, label: 'Water', type: 'number', config: { decimals: 1, unit: 'glasses' } };
const bed: Question = { ...base, id: 3, label: 'Bedtime', type: 'time', config: {} as never };
const ex: Question = { ...base, id: 4, label: 'Exercise', type: 'yesno', config: {} as never };
const a = (q: Question, date: string, value: Answer['value']): Answer => ({ date, questionId: q.id, value, updated: 'T' });
const T = '2026-10-14'; // current window 8..14 Oct, previous 1..7 Oct
const cur = (n: number) => addDays(T, -n); // n = 0..6
const prv = (n: number) => addDays(T, -7 - n); // n = 0..6
const days = (f: (n: number) => string, count: number) => Array.from({ length: count }, (_, n) => f(n));

describe('logged days', () => {
  test('counts distinct days with any answer in each window', () => {
    const answers = [a(mood, cur(0), 5), a(ex, cur(0), true), a(mood, cur(1), 5), a(mood, prv(0), 5)];
    expect(weeklySummary([mood, ex], answers, T).logged).toEqual({ current: 2, previous: 1 });
  });
  test('answers outside both windows are ignored', () => {
    expect(weeklySummary([mood], [a(mood, addDays(T, -20), 5), a(mood, addDays(T, 1), 5)], T).logged).toEqual({ current: 0, previous: 0 });
  });
  test('no data at all is zeros and no moves, never NaN', () => {
    expect(weeklySummary([mood, bed], [], T)).toMatchObject({ logged: { current: 0, previous: 0 }, moves: [] });
  });
});

describe('possible days (windows clamped to when the user started)', () => {
  test('a user who started today has 1 possible day and no previous week', () => {
    expect(weeklySummary([mood], [a(mood, T, 5)], T, T).possible).toEqual({ current: 1, previous: 0 });
  });
  test('started 3 days ago: 4 possible days now, still no previous week', () => {
    expect(weeklySummary([mood], [a(mood, cur(3), 5)], T, cur(3)).possible).toEqual({ current: 4, previous: 0 });
  });
  test('started 9 days ago: full current week, partial previous week', () => {
    expect(weeklySummary([mood], [a(mood, cur(9), 5)], T, cur(9)).possible).toEqual({ current: 7, previous: 3 });
  });
  test('started long ago, or unknown: both windows are a full 7 days', () => {
    expect(weeklySummary([mood], [], T, '2026-01-01').possible).toEqual({ current: 7, previous: 7 });
    expect(weeklySummary([mood], [], T, null).possible).toEqual({ current: 7, previous: 7 });
    expect(weeklySummary([mood], [], T).possible).toEqual({ current: 7, previous: 7 });
  });
});

describe('moves', () => {
  test('a slider that went up is reported with the size of the change', () => {
    const answers = [
      ...days(prv, 5).map((d) => a(mood, d, 5)),
      ...days(cur, 5).map((d) => a(mood, d, 7)),
    ];
    const { moves } = weeklySummary([mood], answers, T);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.text).toBe('Mood up 2.0');
  });
  test('down, and a number question carries its unit', () => {
    const answers = [
      ...days(prv, 4).map((d) => a(water, d, 8)),
      ...days(cur, 4).map((d) => a(water, d, 6.5)),
    ];
    expect(weeklySummary([water], answers, T).moves[0]!.text).toBe('Water down 1.5 glasses');
  });
  test('a time question reports minutes later/earlier', () => {
    const answers = [
      ...days(prv, 4).map((d) => a(bed, d, '23:00')),
      ...days(cur, 4).map((d) => a(bed, d, '23:25')),
    ];
    expect(weeklySummary([bed], answers, T).moves[0]!.text).toBe('Bedtime later by 25 min');
  });
  test('times either side of midnight compare on the wrap-aware scale', () => {
    const answers = [
      ...days(prv, 4).map((d) => a(bed, d, '23:50')),
      ...days(cur, 4).map((d) => a(bed, d, '00:20')),
    ];
    expect(weeklySummary([bed], answers, T).moves[0]!.text).toBe('Bedtime later by 30 min');
  });
  test('an hour or more reads as hours and minutes', () => {
    const answers = [
      ...days(prv, 4).map((d) => a(bed, d, '22:00')),
      ...days(cur, 4).map((d) => a(bed, d, '20:35')),
    ];
    expect(weeklySummary([bed], answers, T).moves[0]!.text).toBe('Bedtime earlier by 1 h 25 min');
  });
  test('fewer than 3 answered days in either window: no move', () => {
    const only2 = [...days(prv, 5).map((d) => a(mood, d, 5)), ...days(cur, 2).map((d) => a(mood, d, 9))];
    expect(weeklySummary([mood], only2, T).moves).toEqual([]);
    const prev2 = [...days(prv, 2).map((d) => a(mood, d, 5)), ...days(cur, 5).map((d) => a(mood, d, 9))];
    expect(weeklySummary([mood], prev2, T).moves).toEqual([]);
  });
  test('a change under 5% of the scale is not a move', () => {
    const answers = [...days(prv, 5).map((d) => a(mood, d, 5)), ...days(cur, 5).map((d) => a(mood, d, 5.2))];
    expect(weeklySummary([mood], answers, T).moves).toEqual([]);
  });
  test('a change that would display as zero is never shown', () => {
    const tiny: Question = { ...base, id: 9, label: 'Tiny', type: 'scale', config: { min: 0, max: 1 } };
    const answers = [...days(prv, 5).map((d) => a(tiny, d, 0.5)), ...days(cur, 5).map((d) => a(tiny, d, 0.54))];
    expect(weeklySummary([tiny], answers, T).moves).toEqual([]);
  });
  test('hidden questions and yes/no questions are never moves', () => {
    const hidden = { ...mood, id: 8, hideFromInsights: true };
    const answers = [
      ...days(prv, 5).map((d) => a(hidden, d, 2)), ...days(cur, 5).map((d) => a(hidden, d, 9)),
      ...days(prv, 5).map((d) => a(ex, d, false)), ...days(cur, 5).map((d) => a(ex, d, true)),
    ];
    expect(weeklySummary([hidden, ex], answers, T).moves).toEqual([]);
  });
  test('the biggest relative movers come first, at most 3', () => {
    const q = (id: number, label: string): Question => ({ ...base, id, label, type: 'scale', config: { min: 0, max: 10 } });
    const qs = [q(11, 'A'), q(12, 'B'), q(13, 'C'), q(14, 'D')];
    const shifts = [1, 4, 2, 3]; // A 1, B 4, C 2, D 3
    const answers = qs.flatMap((qq, i) => [
      ...days(prv, 4).map((d) => a(qq, d, 3)), ...days(cur, 4).map((d) => a(qq, d, 3 + shifts[i]!)),
    ]);
    expect(weeklySummary(qs, answers, T).moves.map((m) => m.label)).toEqual(['B', 'D', 'C']);
  });
});
