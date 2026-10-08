import { useLayoutEffect, type RefObject } from 'react';

interface TextareaLike {
  style: { height: string; overflowY: string };
  scrollHeight: number;
  offsetHeight?: number;
  clientHeight?: number;
  rows: number;
}

/**
 * autosizeTextarea fits a <textarea> to its content, up to `max` pixels, after
 * which it scrolls inside. It collapses the height first so the box can shrink
 * again when text is deleted.
 */
export function autosizeTextarea(el: TextareaLike | null | undefined, max: number): void {
  if (!el || !el.style || typeof el.scrollHeight !== 'number') return;
  el.rows = 1;
  el.style.height = 'auto';
  const border =
    Number.isFinite(el.offsetHeight) && Number.isFinite(el.clientHeight) ? el.offsetHeight! - el.clientHeight! : 0;
  const content = el.scrollHeight + border;
  el.style.height = `${Math.min(content, max)}px`;
  el.style.overflowY = content > max ? 'auto' : 'hidden';
}

export function useAutosize(containerRef: RefObject<unknown>, dependency: unknown, max: number): void {
  useLayoutEffect(() => {
    const root = containerRef.current as { querySelector?: (s: string) => TextareaLike | null } | null;
    autosizeTextarea(root?.querySelector?.('textarea'), max);
  }, [containerRef, dependency, max]);
}
