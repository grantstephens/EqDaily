import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { ActivityIndicator, SegmentedButtons, Text } from 'react-native-paper';

import { InsightCard } from '../components/insights/InsightCard';
import { PatternsCard } from '../components/insights/PatternsCard';
import type { JournalDate } from '../domain/date';
import { findPatternsWithFallback, type PatternsResult } from '../domain/patterns';
import type { Question } from '../domain/question';
import { previousDates, rangeDates, summarize, type RangeChoice, type Summary } from '../domain/stats';
import { notify } from '../platform/confirm';
import { useToday } from '../useToday';
import { useTracker } from '../TrackerContext';

interface CardData { question: Question; summary: Summary }

const RANGES: { value: string; label: string; choice: RangeChoice }[] = [
  { value: '7', label: '7 days', choice: 7 },
  { value: '30', label: '30 days', choice: 30 },
  { value: '90', label: '90 days', choice: 90 },
  { value: 'all', label: 'All', choice: 'all' },
];

/** Insights: per-question graphs and summaries over a chosen window. */
export function InsightsScreen() {
  const { store, now, revision } = useTracker();
  const end = useToday(now);
  const [range, setRange] = useState<RangeChoice>(30);
  const [state, setState] = useState<{ cards: CardData[]; dates: JournalDate[]; empty: boolean; patterns: PatternsResult } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const questions = (await store.listQuestions()).filter((q) => !q.hideFromInsights);
        const first = await store.firstAnswerDate();
        const dates = rangeDates(end, range, first);
        const prev = previousDates(dates, range);
        const allDates = rangeDates(end, 'all', first);
        const from = prev[0] ?? dates[0]!;
        const answers = await store.answersBetween(first !== null && first < from ? first : from, end);
        const cards = questions.map((question) => ({ question, summary: summarize(question, answers, dates, answers, prev) }));
        const patterns = findPatternsWithFallback(questions, answers, dates, allDates);
        if (!cancelled) setState({ cards, dates, empty: questions.length === 0 || first === null, patterns });
      } catch (e) {
        await notify('Could not load Insights', e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [store, end, range, revision]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <SegmentedButtons
        value={String(range)}
        onValueChange={(v) => setRange(RANGES.find((r) => r.value === v)!.choice)}
        buttons={RANGES.map((r) => ({ value: r.value, label: r.label, testID: `range-${r.value}` }))}
      />
      {state === null && <ActivityIndicator style={{ marginTop: 32 }} />}
      {state?.empty && <Text>Nothing to show yet — answer some questions on Today.</Text>}
      {state && !state.empty && <PatternsCard result={state.patterns} />}
      {state && !state.empty && state.cards.map((c) => (
        <InsightCard key={c.question.id} question={c.question} summary={c.summary} dates={state.dates} />
      ))}
    </ScrollView>
  );
}
