import type { RefObject } from 'react';

/**
 * Auto-grow for a text field on the web, where a multiline <textarea> does not
 * size itself to its content. Native does that on its own, so it is a no-op
 * there. Implementations live in autosize.web.ts and autosize.native.ts.
 *
 * `containerRef` is a view wrapping the TextInput; `dependency` changes whenever
 * the text does; `max` is the tallest the box may get before it scrolls inside.
 */
export declare function useAutosize(containerRef: RefObject<unknown>, dependency: unknown, max: number): void;
