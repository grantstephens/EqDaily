import type { RefObject } from 'react';

// A multiline TextInput already grows with its content on iOS and Android
// (capped with maxHeight), so there is nothing to do.
export function useAutosize(_containerRef: RefObject<unknown>, _dependency: unknown, _max: number): void {}
