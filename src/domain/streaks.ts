// src/domain/streaks.ts
import { addDays, type JournalDate } from './date';

/**
 * runEndingAt counts consecutive days for which `has` is true, ending today, or
 * yesterday when today does not qualify yet (the day is not over, so an empty
 * today must not wipe out a streak).
 */
function runEndingAt(has: (d: JournalDate) => boolean, today: JournalDate): number {
  let day = has(today) ? today : addDays(today, -1);
  let n = 0;
  while (has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** currentStreak is the number of consecutive days with at least one answer. */
export function currentStreak(days: Iterable<JournalDate>, today: JournalDate): number {
  const set = new Set(days);
  return runEndingAt((d) => set.has(d), today);
}

/** longestStreak is the longest run of consecutive days anywhere in `days`. */
export function longestStreak(days: Iterable<JournalDate>): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: JournalDate | null = null;
  for (const d of sorted) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

/** yesStreak counts consecutive Yes answers; a No or a skipped day ends the run. */
export function yesStreak(values: Map<JournalDate, boolean>, today: JournalDate): number {
  if (values.get(today) === false) return 0; // answered No today: the streak is over, not "still alive from yesterday"
  return runEndingAt((d) => values.get(d) === true, today);
}
