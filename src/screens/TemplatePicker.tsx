import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import { TEMPLATES } from '../domain/templates';
import { TYPE_LABELS } from '../domain/typeLabels';
import { notify } from '../platform/confirm';
import { setOnboarded } from '../platform/onboarding';
import { useTracker } from '../TrackerContext';

/** First-launch choice of starter questions (or none). Always ends in bump(). */
export function TemplatePicker() {
  const { store, bump } = useTracker();
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(TEMPLATES.map((t) => t.id)));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const finish = async (ids: Set<string>) => {
    setBusy(true);
    const failures: string[] = [];
    for (const t of TEMPLATES) {
      if (!ids.has(t.id)) continue;
      try {
        await store.addQuestion(t.question);
      } catch (e) {
        failures.push(`${t.question.label}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    try { await setOnboarded(); } catch { /* the picker may reappear on an empty install; harmless */ }
    if (failures.length > 0) await notify('Some questions were not added', failures.join('\n'));
    bump();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text variant="headlineSmall">Welcome to EqDaily</Text>
      <Text>Pick some questions to start with. You can add, change or remove them any time.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TEMPLATES.map((t) => (
          <Chip key={t.id} testID={`template-${t.id}`} selected={ticked.has(t.id)} showSelectedCheck onPress={() => toggle(t.id)}>
            {`${t.question.label} · ${TYPE_LABELS[t.question.type]}`}
          </Chip>
        ))}
      </View>
      <Button testID="template-start" mode="contained" disabled={busy} onPress={() => finish(ticked)}>Start with these</Button>
      <Button testID="template-blank" disabled={busy} onPress={() => finish(new Set())}>Start blank</Button>
    </ScrollView>
  );
}
