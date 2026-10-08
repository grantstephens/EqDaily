import React from 'react';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { describePattern, type PatternsResult } from '../../domain/patterns';

export function PatternsCard({ result }: { result: PatternsResult }) {
  return (
    <Card testID="patterns-card">
      <Card.Content style={{ gap: 8 }}>
        <Text variant="titleMedium">Patterns</Text>
        {result.status === 'found' && (
          <View style={{ gap: 8 }}>
            {result.patterns.map((p, i) => (
              <Text key={i} testID={`pattern-${i}`}>{describePattern(p)}</Text>
            ))}
            <Text testID="patterns-note" variant="bodySmall">Patterns are hints, not proof.</Text>
          </View>
        )}
        {result.status === 'none' && (
          <Text testID="patterns-none">No clear patterns yet — they show up when something clearly goes with a better or worse day.</Text>
        )}
        {result.status === 'incomparable' && (
          <Text testID="patterns-incomparable">
            Patterns compares a yes/no or choice question with a slider, number or time question. Add one of each to see how they move together.
          </Text>
        )}
        {result.status === 'insufficient' && (
          <Text testID="patterns-insufficient">Keep logging — Patterns needs about two weeks of answers.</Text>
        )}
      </Card.Content>
    </Card>
  );
}
