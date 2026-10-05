const DAY = 1440;
const EVENING = 18 * 60;
const EARLY = 6 * 60;
const NOON = 12 * 60;

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
 * A series with both a late-evening and an early-morning value is a
 * bedtime-style series crossing midnight: shift every pre-noon value up a day
 * so 23:30 -> 00:30 reads as +60 minutes, not -1380.
 */
export function unwrapTimes(minutes: number[]): number[] {
  const straddles = minutes.some((m) => m >= EVENING) && minutes.some((m) => m < EARLY);
  return straddles ? minutes.map((m) => (m < NOON ? m + DAY : m)) : minutes;
}

export function averageTime(minutes: number[]): string | null {
  if (minutes.length === 0) return null;
  const u = unwrapTimes(minutes);
  return minutesToTime(u.reduce((a, b) => a + b, 0) / u.length);
}
