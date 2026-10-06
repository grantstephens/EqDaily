import { useEffect, useState } from 'react';

import { today, type JournalDate } from './domain/date';
import { onAppVisible } from './platform/lifecycle';

const CHECK_MS = 30_000;

/**
 * useToday is the current local calendar date, kept fresh: it re-reads the
 * clock every 30 s and whenever the app returns to the foreground, so a screen
 * left open past midnight notices the day changed.
 */
export function useToday(now: () => Date): JournalDate {
  const [date, setDate] = useState(() => today(now()));
  useEffect(() => {
    const check = () => setDate(today(now()));
    check();
    const timer = setInterval(check, CHECK_MS);
    const off = onAppVisible(check);
    return () => {
      clearInterval(timer);
      off();
    };
  }, [now]);
  return date;
}
