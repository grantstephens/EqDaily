// src/domain/patterns.ts
import { addDays, type JournalDate } from './date';
import { mean, welch } from './patternStats';
import type { Answer, Question } from './question';
import { minutesToTime, timeToMinutes, unwrapTimes } from './time';

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
      const values = [...series.values.values()];
      const m = median(values);
      // Discrete answers tie at the median. Split strictly above it, or at-or-above
      // it, whichever leaves the groups closest to half and half.
      const above = values.filter((v) => v > m).length;
      const atOrAbove = values.filter((v) => v >= m).length;
      const strict = Math.abs(above / values.length - 0.5) <= Math.abs(atOrAbove / values.length - 0.5);
      binary.push({
        questionId: q.id, label: q.label, sourceType, derived: 'high',
        days: new Map([...series.values].map(([date, v]) => [date, strict ? v > m : v >= m])),
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

/** Each side of a comparison needs this many days. */
export const MIN_SIDE = 5;
/** And the two sides together this many. */
export const MIN_PAIRED = 14;
/** Cohen's d must be at least this large (in either direction). */
export const MIN_EFFECT = 0.5;
/** Family-wise error rate; divided by the number of comparisons actually run. */
export const ALPHA = 0.05;
export const MAX_PATTERNS = 3;

export interface Pattern {
  signal: { questionId: number; label: string; sourceType: SourceType; option?: string; derived?: 'high' };
  outcome: { questionId: number; label: string; type: 'scale' | 'number' | 'time'; unit?: string };
  lag: 0 | 1;
  onMean: number;
  offMean: number;
  onDays: number;
  offDays: number;
  /** Cohen's d for on minus off. */
  d: number;
}

export type PatternsResult =
  | { status: 'insufficient' }
  | { status: 'none' }
  | { status: 'found'; patterns: Pattern[] };

interface Candidate { pattern: Pattern; p: number }

/**
 * findPatterns compares every on/off signal with every numeric outcome from a
 * different question, on the same day and on the following day. A comparison
 * only uses dates where both values exist. Findings must have a meaningful
 * effect size and survive a Bonferroni correction for the number of comparisons
 * actually run; at most one per (signal question, outcome question) pair, at
 * most MAX_PATTERNS overall, strongest first. `dates` must be consecutive days.
 */
export function findPatterns(questions: Question[], answers: Answer[], dates: JournalDate[]): PatternsResult {
  const { binary, numeric } = buildSignals(questions, answers, dates);
  const candidates: Candidate[] = [];
  let run = 0;

  for (const s of binary) {
    for (const o of numeric) {
      if (s.questionId === o.questionId) continue;
      for (const lag of [0, 1] as const) {
        const on: number[] = [];
        const off: number[] = [];
        for (const [date, flag] of s.days) {
          const v = o.values.get(lag === 0 ? date : addDays(date, 1));
          if (v === undefined) continue;
          (flag ? on : off).push(v);
        }
        if (on.length < MIN_SIDE || off.length < MIN_SIDE || on.length + off.length < MIN_PAIRED) continue;
        const w = welch(on, off);
        if (w === null) continue;
        run++;
        candidates.push({
          p: w.p,
          pattern: {
            signal: { questionId: s.questionId, label: s.label, sourceType: s.sourceType, option: s.option, derived: s.derived },
            outcome: { questionId: o.questionId, label: o.label, type: o.type, unit: o.unit },
            lag, onMean: mean(on), offMean: mean(off), onDays: on.length, offDays: off.length, d: w.d,
          },
        });
      }
    }
  }
  if (run === 0) return { status: 'insufficient' };

  const alpha = ALPHA / run;
  const strong = candidates
    .filter((c) => Math.abs(c.pattern.d) >= MIN_EFFECT && c.p < alpha)
    .sort((x, y) => Math.abs(y.pattern.d) - Math.abs(x.pattern.d) || y.pattern.onDays + y.pattern.offDays - x.pattern.onDays - x.pattern.offDays)
    .map((c) => c.pattern);

  const chosen: Pattern[] = [];
  const key = (p: Pattern) => `${p.signal.questionId}>${p.outcome.questionId}`;
  const reverse = (p: Pattern) => `${p.outcome.questionId}>${p.signal.questionId}`;
  for (const p of strong) {
    if (chosen.some((c) => key(c) === key(p))) continue;
    if (p.lag === 0 && chosen.some((c) => c.lag === 0 && key(c) === reverse(p))) continue;
    chosen.push(p);
    if (chosen.length === MAX_PATTERNS) break;
  }
  return chosen.length === 0 ? { status: 'none' } : { status: 'found', patterns: chosen };
}

/**
 * findPatternsWithFallback uses the chosen window, but when that has too little
 * data to compare anything it looks at all of the user's data instead.
 */
export function findPatternsWithFallback(
  questions: Question[], answers: Answer[], windowDates: JournalDate[], allDates: JournalDate[],
): PatternsResult {
  const r = findPatterns(questions, answers, windowDates);
  if (r.status !== 'insufficient' || allDates.length <= windowDates.length) return r;
  return findPatterns(questions, answers, allDates);
}

function formatValue(type: 'scale' | 'number' | 'time', v: number, unit?: string): string {
  if (type === 'time') return minutesToTime(v);
  return unit ? `${v.toFixed(1)} ${unit}` : v.toFixed(1);
}

/** describePattern writes one finding as a sentence. Correlation, never causation. */
export function describePattern(p: Pattern): string {
  const s = p.signal;
  let cond: string;
  let other: string;
  if (s.derived === 'high') {
    cond = `${s.label} was ${s.sourceType === 'time' ? 'later' : 'higher'} than usual`;
    other = 'when it was not';
  } else if (s.option !== undefined) {
    cond = `you picked "${s.option}" for ${s.label}`;
    other = 'on other days';
  } else {
    cond = `${s.label} was Yes`;
    other = 'when it was No';
  }
  const lead = p.lag === 0 ? `On days ${cond}` : `The day after ${cond}`;

  const extra: string[] = [];
  if (p.outcome.type === 'time') {
    const gap = Math.round(p.onMean - p.offMean);
    if (gap !== 0) extra.push(`${Math.abs(gap)} min ${gap > 0 ? 'later' : 'earlier'}`);
  }
  extra.push(`${p.onDays + p.offDays} days`);

  const on = formatValue(p.outcome.type, p.onMean, p.outcome.unit);
  const off = formatValue(p.outcome.type, p.offMean, p.outcome.unit);
  return `${lead}, ${p.outcome.label} averages ${on} vs ${off} ${other} (${extra.join(', ')}).`;
}
