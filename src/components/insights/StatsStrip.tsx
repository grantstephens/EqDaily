import React from 'react';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { WeeklySummary } from '../../domain/weekly';

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
        <Text testID="week-logged">{`This week: ${week.logged.current} of 7 days logged (last week ${week.logged.previous})`}</Text>
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
