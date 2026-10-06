import type { ScaleConfig } from './question';
import { minutesToTime, timeToMinutes } from './time';

export interface StepOptions { min: number; max: number; step: number; start: number; decimals: number }

/**
 * stepValue moves a value one step up (dir 1) or down (-1), clamped. From an
 * unanswered state the first press just sets the start value: pressing "+" on
 * nothing should land somewhere sensible, not at start+step.
 */
export function stepValue(current: number | null, dir: 1 | -1, o: StepOptions): number {
  if (current === null) return o.start;
  const f = 10 ** o.decimals;
  const next = Math.round((current + dir * o.step) * f) / f;
  return Math.min(o.max, Math.max(o.min, next));
}

/** scaleStep is the +/- step: the configured one, else whole numbers or tenths. */
export function scaleStep(c: ScaleConfig): number {
  if (c.step !== undefined) return c.step;
  return c.max - c.min >= 5 ? 1 : (c.max - c.min) / 10;
}

/**
 * stepTime moves an HH:MM by delta minutes, wrapping. Like the other steppers,
 * the first press from unanswered just sets the start value (22:00).
 */
export function stepTime(current: string | null, delta: number): string {
  if (current === null) return '22:00';
  return minutesToTime(timeToMinutes(current) + delta);
}

/**
 * scaleStart is where an unanswered slider first lands: the midpoint snapped
 * onto the step grid anchored at min, so a 1-10 whole-number scale never
 * stores 5.5.
 */
export function scaleStart(c: ScaleConfig): number {
  const step = scaleStep(c);
  const snapped = c.min + Math.round((c.max - c.min) / 2 / step) * step;
  return Number(Math.min(c.max, Math.max(c.min, snapped)).toFixed(6));
}
