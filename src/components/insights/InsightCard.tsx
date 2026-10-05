import React from 'react';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import type { Question } from '../../domain/question';
import type { Summary } from '../../domain/stats';
import { minutesToTime } from '../../domain/time';
import { BarList } from '../charts/BarList';
import { DotStrip } from '../charts/DotStrip';
import { LineChart } from '../charts/LineChart';

interface Props { question: Question; summary: Summary; dates: string[] }

function Body({ summary, dates }: { summary: Summary; dates: string[] }) {
  switch (summary.kind) {
    case 'numeric': {
      const { average, change, unit, points, axisMin, axisMax } = summary;
      return (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text variant="headlineMedium">{average!.toFixed(1)}</Text>
            {unit ? <Text>{unit}</Text> : null}
            {change !== null && (
              <Text>{change === 0 ? 'no change' : `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}`}</Text>
            )}
          </View>
          <LineChart points={points} dates={dates} axisMin={axisMin} axisMax={axisMax} />
        </View>
      );
    }
    case 'time': {
      const mins = summary.points.map((p) => p.value);
      const lo = Math.min(...mins) - 30;
      const hi = Math.max(...mins) + 30;
      return (
        <View style={{ gap: 8 }}>
          <Text variant="headlineMedium">{`Average ${summary.average}`}</Text>
          <LineChart points={summary.points} dates={dates} axisMin={lo} axisMax={hi} yLabel={minutesToTime} />
        </View>
      );
    }
    case 'yesno':
      return (
        <View style={{ gap: 8 }}>
          <Text variant="headlineMedium">{`${Math.round(summary.percentYes!)}% yes`}</Text>
          <DotStrip days={summary.days} />
        </View>
      );
    case 'options':
      return <BarList items={summary.ranking} />;
    case 'choice':
      return <BarList items={summary.distribution} />;
    case 'text':
      return (
        <View style={{ gap: 8 }}>
          {summary.frequent.length > 0 && (
            <View>
              <Text variant="labelLarge">Most frequent</Text>
              {summary.frequent.map((f) => <Text key={f.text}>{`${f.text} (${f.count}×)`}</Text>)}
            </View>
          )}
          <View>
            <Text variant="labelLarge">Recent</Text>
            {summary.recent.map((r) => <Text key={r.date} numberOfLines={2}>{`${r.date} — ${r.text}`}</Text>)}
          </View>
        </View>
      );
  }
}

/** One Insights card: coverage line, then a body shaped by the question type. */
export function InsightCard({ question, summary, dates }: Props) {
  const { answered, total } = summary.coverage;
  return (
    <Card>
      <Card.Content style={{ gap: 8 }}>
        <Text variant="titleMedium">{question.label}</Text>
        <Text variant="labelSmall">{`${answered} of ${total} days answered`}</Text>
        {answered === 0 ? <Text>No answers in this period.</Text> : <Body summary={summary} dates={dates} />}
      </Card.Content>
    </Card>
  );
}
