import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, HelperText, Text, useTheme } from 'react-native-paper';

import { AnswerInput } from '../components/inputs/AnswerInput';
import { KeyboardAwareScroll } from '../components/KeyboardAwareScroll';
import {
  addExtra, back, begin, canKeep, collision, currentItem, decide, editExtra, editItem,
  finalEntries, goToReview, isReview, isWelcome, keepCurrent, removeExtra, skipCurrent,
  startGuide, type GuideState, type Ref,
} from '../domain/guide';
import type { AnswerValue, NewQuestion, Question } from '../domain/question';
import { TEMPLATES } from '../domain/templates';
import { TYPE_LABELS } from '../domain/typeLabels';
import { notify } from '../platform/confirm';
import { setOnboarded } from '../platform/onboarding';
import { useTracker } from '../TrackerContext';
import { QuestionForm } from './QuestionForm';

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const plural = (n: number) => `${n} question${n === 1 ? '' : 's'}`;

/** A try-it version of the question's real input. Nothing it records is saved. */
function Preview({ question }: { question: NewQuestion }) {
  const [value, setValue] = useState<AnswerValue | null>(null);
  const q = { ...question, id: -1, sort: 0, archivedAt: null, created: '' } as Question;
  return <AnswerInput question={q} value={value} onChange={setValue} optionUsage={[]} />;
}

type Editing = { ref: Ref | 'new' } | null;

/**
 * First-launch setup: a step per suggested question (keep, edit or skip), then a
 * review where you can tweak the set and add your own. Nothing is stored until
 * "Start tracking", so backing out leaves no half-created set.
 */
export function SetupGuide() {
  const { store, bump } = useTracker();
  const theme = useTheme();
  const [g, setG] = useState<GuideState>(() => startGuide(TEMPLATES));
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (next: GuideState) => { setNotice(null); setG(next); };

  const endSetup = async () => {
    try { await setOnboarded(); } catch { /* the guide may reappear on an empty install; harmless */ }
    bump();
  };

  const finish = async () => {
    const questions = finalEntries(g).map((e) => e.question);
    if (questions.length === 0) return;
    setBusy(true);
    const failures: string[] = [];
    let created = 0;
    for (const q of questions) {
      try {
        await store.addQuestion(q);
        created++;
      } catch (e) {
        failures.push(`${q.label}: ${message(e)}`);
      }
    }
    setBusy(false);
    if (failures.length > 0) {
      await notify('Could not add every question', failures.join('\n'));
      if (created === 0) return; // stay on the review so nothing is lost; the user can retry
    }
    await endSetup();
  };

  // ---- inline editor (a suggestion, a kept question, or a brand-new one)
  if (editing) {
    const ref = editing.ref;
    const initial = ref === 'new' ? undefined : ref.kind === 'item' ? g.items[ref.index]!.question : g.extras[ref.index]!;
    return (
      <QuestionForm
        key={ref === 'new' ? 'new' : `${ref.kind}-${ref.index}`}
        initial={initial}
        answered={false}
        usage={[]}
        onCancel={() => setEditing(null)}
        onSave={async (q) => {
          const clash = collision(g, q, ref === 'new' ? undefined : ref);
          if (clash) throw new Error(clash);
          if (ref === 'new') go(addExtra(g, q));
          else if (ref.kind === 'item') go(editItem(g, ref.index, q));
          else go(editExtra(g, ref.index, q));
          setEditing(null);
        }}
      />
    );
  }

  const n = g.items.length;

  // ---- welcome
  if (isWelcome(g)) {
    return (
      <KeyboardAwareScroll contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="headlineSmall">Welcome to EqDaily</Text>
        <Text testID="guide-intro">
          {`${n} suggested questions, about a minute. Keep each one, change it, or skip it. Nothing is saved until the end, and you can add or change questions any time.`}
        </Text>
        <Button testID="guide-start" mode="contained" onPress={() => go(begin(g))}>Let's go</Button>
        <Button testID="guide-blank" onPress={endSetup}>Start blank</Button>
      </KeyboardAwareScroll>
    );
  }

  // ---- review
  if (isReview(g)) {
    const entries = finalEntries(g);
    const notIncluded = g.items.map((it, index) => ({ it, index })).filter(({ it }) => it.decision !== 'keep');
    return (
      <KeyboardAwareScroll contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall">Your questions</Text>
        {entries.length === 0 && (
          <Text testID="guide-empty">Nothing to track yet. Restore a suggestion below or add your own.</Text>
        )}
        {entries.map((e, pos) => (
          <Card key={`${e.kind}-${e.index}`}>
            <Card.Content style={{ gap: 4 }}>
              <Text variant="titleMedium">{e.question.label}</Text>
              <Text variant="labelSmall">{TYPE_LABELS[e.question.type]}</Text>
              <View style={{ flexDirection: 'row' }}>
                <Button testID={`review-edit-${pos}`} compact onPress={() => setEditing({ ref: { kind: e.kind, index: e.index } })}>Edit</Button>
                <Button
                  testID={`review-remove-${pos}`}
                  compact
                  onPress={() => go(e.kind === 'item' ? decide(g, e.index, 'skip') : removeExtra(g, e.index))}
                >Remove</Button>
              </View>
            </Card.Content>
          </Card>
        ))}
        <Button testID="guide-add-own" mode="outlined" onPress={() => setEditing({ ref: 'new' })}>Add your own question</Button>

        {notIncluded.length > 0 && (
          <View style={{ gap: 4 }}>
            <Text variant="titleSmall">Not included</Text>
            {notIncluded.map(({ it, index }) => (
              <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text>{it.question.label}</Text>
                <Button
                  testID={`review-restore-${it.id}`}
                  compact
                  onPress={() => {
                    const clash = canKeep(g, index);
                    if (clash) setNotice(clash);
                    else go(decide(g, index, 'keep'));
                  }}
                >Add back</Button>
              </View>
            ))}
          </View>
        )}
        {notice !== null && <HelperText testID="guide-notice" type="error">{notice}</HelperText>}

        <Button testID="guide-finish" mode="contained" disabled={busy || entries.length === 0} onPress={finish}>
          {entries.length === 0 ? 'Nothing to start yet' : `Start tracking ${plural(entries.length)}`}
        </Button>
        <Button testID="guide-back" onPress={() => go(back(g))}>Back</Button>
        <Button testID="guide-skip-setup" onPress={endSetup}>Skip setup</Button>
      </KeyboardAwareScroll>
    );
  }

  // ---- a suggestion
  const item = currentItem(g)!;
  const q = item.question;
  return (
    <KeyboardAwareScroll contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text testID="guide-progress" variant="labelLarge">{`Step ${g.step} of ${n}`}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceVariant }}>
        <View style={{ height: 6, borderRadius: 3, width: `${(g.step / n) * 100}%`, backgroundColor: theme.colors.primary }} />
      </View>

      <Card>
        <Card.Content style={{ gap: 8 }}>
          <Text testID="guide-title" variant="headlineSmall">{q.label}</Text>
          <Text testID="guide-type" variant="labelSmall">{TYPE_LABELS[q.type]}</Text>
          <Text testID="guide-prompt" variant="titleMedium">{item.prompt}</Text>
          <Text testID="guide-why" style={{ color: theme.colors.onSurfaceVariant }}>{item.why}</Text>
          {/* keyed on the question so an edit gives a fresh preview */}
          <Preview key={`${item.id}:${JSON.stringify(q)}`} question={q} />
        </Card.Content>
      </Card>

      {notice !== null && <HelperText testID="guide-notice" type="error">{notice}</HelperText>}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button testID="guide-back" onPress={() => go(back(g))}>Back</Button>
        <Button testID="guide-edit" mode="outlined" onPress={() => setEditing({ ref: { kind: 'item', index: g.step - 1 } })}>Edit</Button>
        <Button testID="guide-skip" mode="outlined" onPress={() => go(skipCurrent(g))}>Skip</Button>
        <Button
          testID="guide-keep"
          mode="contained"
          onPress={() => {
            const clash = canKeep(g, g.step - 1);
            if (clash) setNotice(clash);
            else go(keepCurrent(g));
          }}
        >Keep & next</Button>
      </View>
      <Button testID="guide-skip-setup" onPress={endSetup}>Skip setup</Button>
      <Button testID="guide-to-review" compact onPress={() => go(goToReview(g))}>Jump to review</Button>
    </KeyboardAwareScroll>
  );
}
