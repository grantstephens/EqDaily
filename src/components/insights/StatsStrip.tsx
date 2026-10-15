import React from 'react';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { WeeklySummary } from '../../domain/weekly';

const days = (n: number) => (n === 1 ? 'day' : 'days');

function weekLine({ logged, possible }: WeeklySummary): string {
  if (logged.current === 0 && logged.previous === 0) return 'Nothing logged in the last 14 days.';
  const now = `Last 7 days: ${logged.current} of ${possible.current} ${days(possible.current)} logged`;
  // A window cut short by when you started would read as a bogus "3 of 3", so it is left out.
  return possible.previous === 7 ? `${now} (7 days before: ${logged.previous} of 7)` : now;
}

function bestLabel({ current, best }: { current: number; best: number }): string | null {
  if (best <= 1 && current <= best) return null; // one day is not a record worth showing
  if (current === best) return 'Your best so far';
  return `Best: ${best} ${best === 1 ? 'day' : 'days'}`;
}

interface Props { streak: { current: number; best: number }; week: WeeklySummary }

export function StatsStrip({ streak, week }: Props) {
  return (
    <Card testID="stats-strip">
      <Card.Content style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <Text testID="streak-current" variant="titleMedium">
            {streak.current > 0 ? `${streak.current}-day streak` : 'No streak right now'}
          </Text>
          {bestLabel(streak) !== null && <Text testID="streak-best" variant="bodySmall">{bestLabel(streak)}</Text>}
        </View>
        <Text testID="week-logged">{weekLine(week)}</Text>
        {week.moves.length > 0 && (
          <View>
            <Text variant="labelLarge">{week.possible.previous === 7 ? 'Compared with the 7 days before' : 'Compared with your earlier days'}</Text>
            {week.moves.map((m, i) => <Text key={m.questionId} testID={`week-move-${i}`}>{m.text}</Text>)}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}
