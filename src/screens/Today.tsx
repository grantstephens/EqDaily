import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';

import { AnswerInput } from '../components/inputs/AnswerInput';
import { addDays, displayDate, type JournalDate } from '../domain/date';
import type { AnswerValue, Question } from '../domain/question';
import type { OptionUsage } from '../domain/store';
import { notify } from '../platform/confirm';
import { getOnboarded } from '../platform/onboarding';
import { useToday } from '../useToday';
import { useTracker } from '../TrackerContext';
import { TemplatePicker } from './TemplatePicker';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const usesOptions = (q: Question) => q.type === 'checkboxes' || q.type === 'choice';

/**
 * Today: one card per active question, autosaving. Untouched questions are
 * never stored; Skip removes the row. A past day can be backfilled, a future
 * one cannot be reached.
 */
export function TodayScreen() {
  const { store, now, revision } = useTracker();
  const todayDate = useToday(now);
  const [date, setDate] = useState<JournalDate>(todayDate);
  const dateRef = useRef(date);
  dateRef.current = date;
  const lastToday = useRef(todayDate);

  const [loaded, setLoaded] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [onboarded, setOnboardedState] = useState(true);
  const [answers, setAnswers] = useState<Map<number, AnswerValue>>(new Map());
  const [usage, setUsage] = useState<Record<number, OptionUsage[]>>({});

  const loadAnswers = useCallback(async (d: JournalDate) => {
    try {
      const rows = await store.getAnswers(d);
      if (dateRef.current === d) setAnswers(new Map(rows.map((a) => [a.questionId, a.value])));
    } catch (e) {
      await notify('Could not load answers', message(e));
    }
  }, [store]);

  // Questions, option usage and the onboarding flag reload when other screens
  // change stored data. Own writes do not bump, so a fast second tap is never
  // overwritten by a reload of the first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [active, all, done] = await Promise.all([
          store.listQuestions(), store.listQuestions({ includeArchived: true }), getOnboarded(),
        ]);
        const u: Record<number, OptionUsage[]> = {};
        for (const q of active) if (usesOptions(q)) u[q.id] = await store.options(q.id);
        if (cancelled) return;
        setQuestions(active);
        setTotalQuestions(all.length);
        setOnboardedState(done);
        setUsage(u);
        setLoaded(true);
      } catch (e) {
        await notify('Could not load questions', message(e));
      }
    })();
    return () => { cancelled = true; };
  }, [store, revision]);

  useEffect(() => { void loadAnswers(date); }, [date, revision, loadAnswers]);

  // Left open overnight: if the user was looking at "today", follow it. A day
  // they deliberately stepped back to is left alone.
  useEffect(() => {
    const previous = lastToday.current;
    lastToday.current = todayDate;
    if (previous !== todayDate && dateRef.current === previous) setDate(todayDate);
  }, [todayDate]);

  // d is the day the card was rendered for, captured at render time. A pending
  // text draft flushes during unmount, after dateRef has already moved on; reading
  // the ref here would write it into the day being navigated to.
  const save = async (d: JournalDate, q: Question, value: AnswerValue | null) => {
    if (dateRef.current === d) {
      setAnswers((prev) => {
        const next = new Map(prev);
        if (value === null) next.delete(q.id);
        else next.set(q.id, value);
        return next;
      });
    }
    try {
      await store.setAnswer(d, q.id, value);
      if (usesOptions(q)) {
        const options = await store.options(q.id);
        setUsage((u) => ({ ...u, [q.id]: options }));
      }
    } catch (e) {
      await notify('Could not save', message(e));
      await loadAnswers(d);
    }
  };

  if (!loaded) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (totalQuestions === 0 && !onboarded) return <TemplatePicker />;

  const answered = questions.filter((q) => answers.has(q.id)).length;
  const isToday = date >= todayDate;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button testID="date-prev" accessibilityLabel="Previous day" compact onPress={() => setDate(addDays(date, -1))}>‹</Button>
        <Text variant="titleMedium">{displayDate(date)}</Text>
        <Button testID="date-next" accessibilityLabel="Next day" compact disabled={isToday} onPress={() => setDate(addDays(date, 1))}>›</Button>
      </View>
      {questions.length > 0 && <Text style={{ textAlign: 'center' }}>{`${answered} of ${questions.length} answered`}</Text>}
      {totalQuestions === 0 && <Text>No questions yet — add some in Settings → Questions.</Text>}
      {totalQuestions > 0 && questions.length === 0 && (
        <Text>All your questions are archived. Restore one in Settings → Questions.</Text>
      )}
      {questions.map((q) => (
        // Keyed by date too, so a pending text edit flushes into the day it was typed on.
        <Card key={`${date}:${q.id}`}>
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">{q.label}</Text>
            <AnswerInput
              question={q}
              value={answers.get(q.id) ?? null}
              onChange={(v) => save(date, q, v)}
              optionUsage={usage[q.id] ?? []}
            />
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}
