// src/domain/weekly.ts
import { addDays, type JournalDate } from './date';
import type { Answer, Question } from './question';
import { timeToMinutes, unwrapTimes } from './time';

export const MIN_WEEK_DAYS = 3;
/** A change must be at least this fraction of the question's scale to be worth saying. */
export const MIN_MOVE = 0.05;
export const MAX_MOVES = 3;

export interface Move { questionId: number; label: string; text: string; magnitude: number }
export interface WeeklySummary {
  logged: { current: number; previous: number };
  /** How many days each window could have had answers, given when the user started (at most 7). */
  possible: { current: number; previous: number };
  moves: Move[];
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const duration = (minutes: number): string => {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${m} min`;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
};

/**
 * weeklySummary compares the 7 days ending `today` with the 7 days before them:
 * how many days had any answer, and which slider/number/time questions moved
 * most. Yes/no, choice, checkbox and text questions, and hidden questions, are
 * never moves.
 */
export function weeklySummary(
  questions: Question[], answers: Answer[], today: JournalDate, first: JournalDate | null = null,
): WeeklySummary {
  const curDays = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  const prevDays = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -7 - i)));

  const loggedCur = new Set<JournalDate>();
  const loggedPrev = new Set<JournalDate>();
  for (const x of answers) {
    if (curDays.has(x.date)) loggedCur.add(x.date);
    else if (prevDays.has(x.date)) loggedPrev.add(x.date);
  }

  const moves: Move[] = [];
  for (const q of questions) {
    if (q.hideFromInsights || (q.type !== 'scale' && q.type !== 'number' && q.type !== 'time')) continue;
    const curRows = answers.filter((x) => x.questionId === q.id && curDays.has(x.date));
    const prevRows = answers.filter((x) => x.questionId === q.id && prevDays.has(x.date));
    if (curRows.length < MIN_WEEK_DAYS || prevRows.length < MIN_WEEK_DAYS) continue;

    let curVals: number[];
    let prevVals: number[];
    if (q.type === 'time') {
      // one wrap-aware scale across both weeks, so 23:50 and 00:20 are 30 minutes apart
      const all = unwrapTimes([...prevRows, ...curRows].map((x) => timeToMinutes(x.value as string)));
      prevVals = all.slice(0, prevRows.length);
      curVals = all.slice(prevRows.length);
    } else {
      curVals = curRows.map((x) => x.value as number);
      prevVals = prevRows.map((x) => x.value as number);
    }
    const delta = mean(curVals) - mean(prevVals);

    let magnitude: number;
    let text: string;
    if (q.type === 'scale') {
      magnitude = Math.abs(delta) / (q.config.max - q.config.min);
      if (Number(Math.abs(delta).toFixed(1)) === 0) continue;
      text = `${q.label} ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}`;
    } else if (q.type === 'number') {
      magnitude = Math.abs(delta) / Math.max(Math.abs(mean(prevVals)), Math.abs(mean(curVals)), 1);
      if (Number(Math.abs(delta).toFixed(1)) === 0) continue;
      const unit = q.config.unit ? ` ${q.config.unit}` : '';
      text = `${q.label} ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}${unit}`;
    } else {
      magnitude = Math.abs(delta) / 120; // two hours is a full-size move
      if (Math.round(Math.abs(delta)) === 0) continue;
      text = `${q.label} ${delta > 0 ? 'later' : 'earlier'} by ${duration(Math.abs(delta))}`;
    }
    if (magnitude < MIN_MOVE) continue;
    moves.push({ questionId: q.id, label: q.label, text, magnitude });
  }
  moves.sort((x, y) => y.magnitude - x.magnitude);

  // Days before the user's first answer cannot have been logged, so they do not count as missed.
  const possible = (days: Set<JournalDate>) => (first === null ? 7 : [...days].filter((d) => d >= first).length);
  return {
    logged: { current: loggedCur.size, previous: loggedPrev.size },
    possible: { current: possible(curDays), previous: possible(prevDays) },
    moves: moves.slice(0, MAX_MOVES),
  };
}
