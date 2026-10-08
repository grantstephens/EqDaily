const DAY = 1440;

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h! * 60 + m!;
}

/** minutesToTime renders minutes past midnight as HH:MM, wrapping around the day. */
export function minutesToTime(m: number): string {
  const w = ((Math.round(m) % DAY) + DAY) % DAY;
  return `${String(Math.floor(w / 60)).padStart(2, '0')}:${String(w % 60).padStart(2, '0')}`;
}

/**
 * unwrapTimes puts a series of times-of-day on one continuous scale. Times are
 * points on a 24h circle; the series' natural "start" is the point right after
 * its largest empty gap. Values before that start are shifted up a day, so
 * 23:30 and 00:30 read as 1410 and 1470 (an hour apart) instead of 1410 and 30,
 * and 22:00 / 06:00 read as 8 hours apart rather than 16. A series that does
 * not cross midnight keeps its values. Input order is preserved.
 */
export function unwrapTimes(minutes: number[]): number[] {
  const sorted = [...new Set(minutes)].sort((a, b) => a - b);
  if (sorted.length < 2) return minutes;
  let widest = -1;
  let start = sorted[0]!;
  sorted.forEach((m, i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1]! : sorted[0]! + DAY;
    if (next - m > widest) {
      widest = next - m;
      start = sorted[(i + 1) % sorted.length]!;
    }
  });
  return minutes.map((m) => (m < start ? m + DAY : m));
}

export function averageTime(minutes: number[]): string | null {
  if (minutes.length === 0) return null;
  const u = unwrapTimes(minutes);
  return minutesToTime(u.reduce((a, b) => a + b, 0) / u.length);
}

/** dateFromTime is a local Date at HH:MM (22:00 when unset), for a native clock dialog. */
export function dateFromTime(t: string | null, base: Date = new Date()): Date {
  const m = t === null ? 22 * 60 : timeToMinutes(t);
  const d = new Date(base);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

/** timeFromDate reads a Date's local hour and minute back as HH:MM. */
export function timeFromDate(d: Date): string {
  return minutesToTime(d.getHours() * 60 + d.getMinutes());
}
