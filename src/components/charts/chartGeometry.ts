import { dayOf, monthOf } from '../../domain/date';

export interface XY { x: number; y: number }
export interface DatedPoint { date: string; value: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** shortDate renders "5 Oct" for chart axis labels. */
export function shortDate(d: string): string {
  return `${dayOf(d)} ${MONTHS[monthOf(d) - 1]}`;
}

/**
 * scalePoints maps dated values to pixel coordinates: days spread evenly
 * left to right, values bottom to top, clamped onto the axis. Points whose
 * date is outside the window are dropped. Degenerate sizes and axes yield
 * finite numbers, never NaN/Infinity (they would blank an SVG).
 */
export function scalePoints(
  points: DatedPoint[], dates: string[], width: number, height: number,
  axisMin: number, axisMax: number, pad = 8,
): XY[] {
  const index = new Map(dates.map((d, i) => [d, i]));
  const n = dates.length;
  const innerW = Math.max(0, width - 2 * pad);
  const innerH = Math.max(0, height - 2 * pad);
  const out: XY[] = [];
  for (const p of points) {
    const i = index.get(p.date);
    if (i === undefined) continue;
    const x = n <= 1 ? width / 2 : pad + (i / (n - 1)) * innerW;
    const ratio = axisMax === axisMin ? 0.5 : Math.min(1, Math.max(0, (p.value - axisMin) / (axisMax - axisMin)));
    out.push({ x, y: pad + (1 - ratio) * innerH });
  }
  return out;
}

const fmt = (n: number) => String(Number(n.toFixed(2)));

/** linePath is an SVG path through the points; '' when there are none. */
export function linePath(pts: XY[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${fmt(p.x)} ${fmt(p.y)}`).join(' ');
}

/**
 * segments splits points into runs of consecutive days. A skipped day ends a
 * run: the chart must not draw a line across a day with no answer.
 */
export function segments(points: DatedPoint[], dates: string[]): DatedPoint[][] {
  const index = new Map(dates.map((d, i) => [d, i]));
  const sorted = points.filter((p) => index.has(p.date)).sort((a, b) => index.get(a.date)! - index.get(b.date)!);
  const runs: DatedPoint[][] = [];
  let prev = -2;
  for (const p of sorted) {
    const i = index.get(p.date)!;
    if (i === prev + 1 && runs.length > 0) runs[runs.length - 1]!.push(p);
    else runs.push([p]);
    prev = i;
  }
  return runs;
}
