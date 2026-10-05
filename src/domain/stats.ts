import { addDays, type JournalDate } from './date';
import type { Answer, Question } from './question';
import { averageTime, timeToMinutes, unwrapTimes } from './time';

export type RangeChoice = 7 | 30 | 90 | 'all';
export interface Coverage { answered: number; total: number }
export interface Point { date: JournalDate; value: number }
export interface Counted { option: string; count: number; percent: number }

export type Summary =
  | { kind: 'numeric'; coverage: Coverage; points: Point[]; average: number | null;
      previousAverage: number | null; change: number | null; axisMin: number; axisMax: number; unit?: string }
  | { kind: 'time'; coverage: Coverage; points: Point[]; average: string | null }
  | { kind: 'yesno'; coverage: Coverage; percentYes: number | null; days: { date: JournalDate; value: boolean | null }[] }
  | { kind: 'options'; coverage: Coverage; ranking: Counted[] }
  | { kind: 'choice'; coverage: Coverage; distribution: Counted[] }
  | { kind: 'text'; coverage: Coverage; frequent: { text: string; count: number }[]; recent: { date: JournalDate; text: string }[] };

/** rangeDates lists the days of the window ending on end, ascending. */
export function rangeDates(end: JournalDate, range: RangeChoice, firstAnswer: JournalDate | null): JournalDate[] {
  let n: number;
  if (range === 'all') {
    if (firstAnswer === null || firstAnswer > end) return [end];
    n = 1;
    while (addDays(firstAnswer, n) <= end) n++;
  } else {
    n = range;
  }
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

/** previousDates is the same-length window immediately before dates; none for 'all'. */
export function previousDates(dates: JournalDate[], range: RangeChoice): JournalDate[] {
  if (range === 'all' || dates.length === 0) return [];
  const start = dates[0]!;
  return Array.from({ length: dates.length }, (_, i) => addDays(start, i - dates.length));
}

const mean = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * frequentPhrases splits free text on commas, semicolons and newlines, groups
 * case-insensitively, and returns phrases seen at least twice, most common first.
 */
export function frequentPhrases(texts: string[], limit = 5): { text: string; count: number }[] {
  const seen = new Map<string, { text: string; count: number; first: number }>();
  let order = 0;
  for (const t of texts) {
    for (const raw of t.split(/[,;\n]/)) {
      const text = raw.trim();
      if (text === '') continue;
      const k = text.toLowerCase();
      const e = seen.get(k);
      if (e) e.count++;
      else seen.set(k, { text, count: 1, first: order++ });
    }
  }
  return [...seen.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, limit)
    .map(({ text, count }) => ({ text, count }));
}

function counted(map: Map<string, number>, denominator: number): Counted[] {
  return [...map.entries()]
    .map(([option, count]) => ({ option, count, percent: denominator === 0 ? 0 : (count / denominator) * 100 }))
    .sort((a, b) => b.count - a.count || a.option.localeCompare(b.option));
}

/**
 * summarize reduces one question's answers over a window to what Insights
 * shows. Skipped days are absent from every statistic; they only lower
 * coverage. answers/previous may hold other questions' rows and other dates.
 */
export function summarize(
  q: Question, answers: Answer[], dates: JournalDate[], previous: Answer[], previousWindow: JournalDate[] = [],
): Summary {
  const inWindow = new Set(dates);
  const mine = answers.filter((x) => x.questionId === q.id && inWindow.has(x.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const prevSet = new Set(previousWindow);
  const coverage: Coverage = { answered: mine.length, total: dates.length };

  switch (q.type) {
    case 'scale':
    case 'number': {
      const points = mine.map((x) => ({ date: x.date, value: x.value as number }));
      const average = mean(points.map((p) => p.value));
      const prevAvg = mean(previous.filter((x) => x.questionId === q.id && prevSet.has(x.date)).map((x) => x.value as number));
      let axisMin: number;
      let axisMax: number;
      if (q.type === 'scale') {
        axisMin = q.config.min;
        axisMax = q.config.max;
      } else {
        const vals = points.map((p) => p.value);
        axisMin = q.config.min ?? Math.min(0, ...vals);
        axisMax = q.config.max ?? Math.max(...vals, axisMin);
        if (axisMax <= axisMin) axisMax = axisMin + 1;
      }
      return {
        kind: 'numeric', coverage, points, average, previousAverage: prevAvg,
        change: average !== null && prevAvg !== null ? average - prevAvg : null,
        axisMin, axisMax, unit: q.type === 'number' ? q.config.unit : undefined,
      };
    }
    case 'time': {
      const raw = mine.map((x) => timeToMinutes(x.value as string));
      const mins = unwrapTimes(raw);
      return {
        kind: 'time', coverage,
        points: mine.map((x, i) => ({ date: x.date, value: mins[i]! })),
        average: averageTime(raw),
      };
    }
    case 'yesno': {
      const byDate = new Map(mine.map((x) => [x.date, x.value as boolean]));
      const yes = mine.filter((x) => x.value === true).length;
      return {
        kind: 'yesno', coverage,
        percentYes: mine.length === 0 ? null : (yes / mine.length) * 100,
        days: dates.map((date) => ({ date, value: byDate.has(date) ? byDate.get(date)! : null })),
      };
    }
    case 'checkboxes': {
      const m = new Map<string, number>();
      for (const x of mine) for (const o of x.value as string[]) m.set(o, (m.get(o) ?? 0) + 1);
      return { kind: 'options', coverage, ranking: counted(m, mine.length) };
    }
    case 'choice': {
      const m = new Map<string, number>();
      for (const x of mine) m.set(x.value as string, (m.get(x.value as string) ?? 0) + 1);
      return { kind: 'choice', coverage, distribution: counted(m, mine.length) };
    }
    case 'text': {
      const texts = mine.map((x) => x.value as string);
      return {
        kind: 'text', coverage,
        frequent: q.config.showFrequent ? frequentPhrases(texts) : [],
        recent: [...mine].reverse().slice(0, 5).map((x) => ({ date: x.date, text: x.value as string })),
      };
    }
  }
}
