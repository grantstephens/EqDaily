/**
 * Pure maths for keeping a focused text field visible above the on-screen keyboard.
 * The app is edge-to-edge (mandatory on current Android), where the system no
 * longer pans or resizes the window for the keyboard, so screens do it themselves.
 */

/**
 * keyboardOverlap is how many pixels of a view the keyboard covers, from the
 * view's on-screen position and the keyboard's top edge. Measuring the real
 * overlap (rather than trusting the keyboard's height) stays correct whether
 * or not the system also moved the window.
 */
export function keyboardOverlap(a: { viewY: number; viewH: number; keyboardTop: number | null }): number {
  if (a.keyboardTop === null || ![a.viewY, a.viewH, a.keyboardTop].every(Number.isFinite)) return 0;
  return Math.min(a.viewH, Math.max(0, a.viewY + a.viewH - a.keyboardTop));
}

/**
 * scrollTarget is the scroll offset that brings a field into the part of the
 * scroll view the keyboard leaves free, or null if it is already there. A field
 * taller than that space (a long note) aligns its bottom, where you are typing.
 */
export function scrollTarget(a: {
  fieldY: number; fieldH: number; scrollY: number; viewportH: number; keyboardH: number; margin: number;
}): number | null {
  const visibleH = a.viewportH - a.keyboardH;
  if (visibleH <= a.margin * 2) return null;
  const bottomLimit = a.scrollY + visibleH - a.margin;
  const topLimit = a.scrollY + a.margin;
  if (a.fieldH > visibleH - a.margin * 2 || a.fieldY + a.fieldH > bottomLimit) {
    return Math.max(0, a.fieldY + a.fieldH - (visibleH - a.margin));
  }
  if (a.fieldY < topLimit) return Math.max(0, a.fieldY - a.margin);
  return null;
}

/** The tallest an auto-growing text field gets before it scrolls inside itself. */
export const FIELD_MAX_HEIGHT = 240;
