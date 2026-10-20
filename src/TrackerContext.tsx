import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Store } from './domain/store';

export interface TrackerValue {
  store: Store;
  /** now is injected so tests can pin "today". */
  now: () => Date;
  /** revision changes whenever stored data changed underneath the screens. */
  revision: number;
  /** bump announces that stored data changed. */
  bump: () => void;
  /**
   * answersVersion changes whenever Today saves an answer. Separate from revision
   * because Today must not reload on its own writes, while Insights and Settings,
   * which stay mounted behind the tab bar, must.
   */
  answersVersion: number;
  /** answersChanged announces that an answer was saved. */
  answersChanged: () => void;
}

const Ctx = createContext<TrackerValue | null>(null);

export function TrackerProvider({ store, now, children }: { store: Store; now: () => Date; children: React.ReactNode }) {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);
  const [answersVersion, setAnswersVersion] = useState(0);
  const answersChanged = useCallback(() => setAnswersVersion((v) => v + 1), []);
  const value = useMemo(
    () => ({ store, now, revision, bump, answersVersion, answersChanged }),
    [store, now, revision, bump, answersVersion, answersChanged],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTracker(): TrackerValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTracker must be used inside TrackerProvider');
  return v;
}
