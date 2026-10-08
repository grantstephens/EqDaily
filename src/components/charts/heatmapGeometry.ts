// src/components/charts/heatmapGeometry.ts
import { displayDate, monthOf, toUtcTime } from '../../domain/date';

/** Ranges shorter than this do not get a heatmap (too few cells to read). */
export const HEATMAP_MIN_DAYS = 28;
/** Number of intensity steps in the slider ramp. */
export const LEVELS = 5;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Monday = 0 … Sunday = 6, from the UTC weekday so DST can never shift a day. */
const weekdayRow = (date: string): number => (toUtcTime(date).getUTCDay() + 6) % 7;

/**
 * calendarGrid lays consecutive ascending dates out as weeks: one column per
 * Monday-to-Sunday week, seven slots tall, `null` where the week has no date
 * from the range. `months` says which column starts each month (for labels).
 */
export function calendarGrid(dates: string[]): { columns: (string | null)[][]; months: { column: number; label: string }[] } {
  if (dates.length === 0) return { columns: [], months: [] };
  const columns: (string | null)[][] = [];
  let column: (string | null)[] = Array(weekdayRow(dates[0]!)).fill(null);
  for (const d of dates) {
    column.push(d);
    if (column.length === 7) {
      columns.push(column);
      column = [];
    }
  }
  if (column.length > 0) {
    while (column.length < 7) column.push(null);
    columns.push(column);
  }

  const months: { column: number; label: string }[] = [];
  let lastMonth = -1;
  columns.forEach((c, i) => {
    const first = c.find((d) => d !== null)!;
    const m = monthOf(first);
    if (m !== lastMonth) months.push({ column: i, label: MONTHS[m - 1]! });
    lastMonth = m;
  });
  return { columns, months };
}

/**
 * scaleLevel maps a slider value onto 1…LEVELS across the question's range.
 * Out-of-range values clamp; a degenerate range or a NaN gives the middle level.
 */
export function scaleLevel(value: number, min: number, max: number): number {
  const mid = Math.ceil(LEVELS / 2);
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return mid;
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return 1 + Math.round(ratio * (LEVELS - 1));
}

/** levelAlpha is the opacity of the primary colour for a level: faint (1) to solid (LEVELS). */
export function levelAlpha(level: number): number {
  return 0.25 + (0.75 * (level - 1)) / (LEVELS - 1);
}

/** withAlpha turns "#RRGGBB" into an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** cellLabel is the screen-reader text for one day's cell. */
export function cellLabel(date: string, value: boolean | number | undefined): string {
  const what =
    value === undefined ? 'skipped'
      : typeof value === 'boolean' ? (value ? 'yes' : 'no')
        : String(Number(value.toFixed(1)));
  return `${displayDate(date)}: ${what}`;
}
