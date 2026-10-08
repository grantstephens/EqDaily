// src/domain/patterns.ts
import type { JournalDate } from './date';
import type { Answer, Question } from './question';
import { timeToMinutes, unwrapTimes } from './time';

/** A comparison group needs this many days of an option before it is worth testing. */
export const MIN_OPTION_DAYS = 5;
/** A numeric series needs this many answers before "higher than usual" means anything. */
export const MIN_HIGH_DAYS = 10;

export type SourceType = 'scale' | 'number' | 'time' | 'yesno' | 'choice' | 'checkboxes';

/** A per-day on/off fact. Days with no answer are absent (skipped is not "no"). */
export interface BinarySignal {
  questionId: number;
  label: string;
  sourceType: SourceType;
  option?: string;
  derived?: 'high';
  days: Map<JournalDate, boolean>;
}

/** A per-day number: a slider, a count, or a time of day on the wrap-aware scale. */
export interface NumericSeries {
  questionId: number;
  label: string;
  type: 'scale' | 'number' | 'time';
  unit?: string;
  values: Map<JournalDate, number>;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * buildSignals turns the answers inside `dates` into the facts Patterns compares.
 * Hidden questions and text questions are ignored.
 */
export function buildSignals(
  questions: Question[], answers: Answer[], dates: JournalDate[],
): { binary: BinarySignal[]; numeric: NumericSeries[] } {
  const inWindow = new Set(dates);
  const binary: BinarySignal[] = [];
  const numeric: NumericSeries[] = [];

  for (const q of questions) {
    if (q.hideFromInsights || q.type === 'text') continue;
    const rows = answers
      .filter((x) => x.questionId === q.id && inWindow.has(x.date))
      .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
    if (rows.length === 0) continue;

    const addHigh = (series: NumericSeries, sourceType: SourceType) => {
      if (rows.length < MIN_HIGH_DAYS) return;
      const m = median([...series.values.values()]);
      binary.push({
        questionId: q.id, label: q.label, sourceType, derived: 'high',
        days: new Map([...series.values].map(([date, v]) => [date, v > m])),
      });
    };

    switch (q.type) {
      case 'yesno':
        binary.push({
          questionId: q.id, label: q.label, sourceType: 'yesno',
          days: new Map(rows.map((r) => [r.date, r.value === true])),
        });
        break;
      case 'scale':
      case 'number': {
        const series: NumericSeries = {
          questionId: q.id, label: q.label, type: q.type,
          unit: q.type === 'number' ? q.config.unit : undefined,
          values: new Map(rows.map((r) => [r.date, r.value as number])),
        };
        numeric.push(series);
        addHigh(series, q.type);
        break;
      }
      case 'time': {
        const unwrapped = unwrapTimes(rows.map((r) => timeToMinutes(r.value as string)));
        const series: NumericSeries = {
          questionId: q.id, label: q.label, type: 'time',
          values: new Map(rows.map((r, i) => [r.date, unwrapped[i]!])),
        };
        numeric.push(series);
        addHigh(series, 'time');
        break;
      }
      case 'choice':
      case 'checkboxes': {
        const has = (v: Answer['value'], option: string) =>
          q.type === 'choice' ? v === option : (v as string[]).includes(option);
        const options = new Set<string>();
        for (const r of rows) for (const o of q.type === 'choice' ? [r.value as string] : (r.value as string[])) options.add(o);
        for (const option of options) {
          const used = rows.filter((r) => has(r.value, option)).length;
          if (used < MIN_OPTION_DAYS) continue;
          binary.push({
            questionId: q.id, label: q.label, sourceType: q.type, option,
            days: new Map(rows.map((r) => [r.date, has(r.value, option)])),
          });
        }
        break;
      }
    }
  }
  return { binary, numeric };
}
