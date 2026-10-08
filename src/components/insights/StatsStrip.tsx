import React from 'react';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { WeeklySummary } from '../../domain/weekly';

const days = (n: number) => (n === 1 ? 'day' : 'days');

function weekLine({ logged, possible }: WeeklySummary): string {
  if (logged.current === 0 && logged.previous === 0) return 'Nothing logged in the last 14 days.';
  const now = `This week: ${logged.current} of ${possible.current} ${days(possible.current)} logged`;
  return possible.previous > 0 ? `${now} (last week ${logged.previous} of ${possible.previous})` : now;
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
          {streak.best > 0 && <Text testID="streak-best" variant="bodySmall">{`Best: ${streak.best} ${streak.best === 1 ? 'day' : 'days'}`}</Text>}
        </View>
        <Text testID="week-logged">{weekLine(week)}</Text>
        {week.moves.length > 0 && (
          <View>
            <Text variant="labelLarge">Compared with last week</Text>
            {week.moves.map((m, i) => <Text key={m.questionId} testID={`week-move-${i}`}>{m.text}</Text>)}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}
