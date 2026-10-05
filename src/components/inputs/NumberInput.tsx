import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import type { Question } from '../../domain/question';
import { stepValue } from '../../domain/stepper';

type Props = {
  question: Extract<Question, { type: 'number' }>;
  value: number | null;
  onChange: (value: number | null) => void;
};

export function NumberInput({ question, value, onChange }: Props) {
  const { min, max, unit, decimals } = question.config;
  const lo = min ?? -Infinity;
  const hi = max ?? Infinity;
  const opts = { min: lo, max: hi, step: 10 ** -decimals, start: Math.min(hi, Math.max(lo, 0)), decimals };
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  useEffect(() => setDraft(value === null ? '' : String(value)), [value]);

  const commit = () => {
    // Only an emptied field means "skip". Text that does not parse ("-", "1e")
    // is a typo: revert it, and leave the saved answer alone.
    if (draft.trim() === '') {
      if (value !== null) onChange(null);
      return;
    }
    const n = Number(draft.trim().replace(',', '.'));
    if (!Number.isFinite(n)) {
      setDraft(value === null ? '' : String(value));
      return;
    }
    const f = 10 ** decimals;
    const next = Math.min(hi, Math.max(lo, Math.round(n * f) / f));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Button testID="number-minus" accessibilityLabel="Decrease" compact mode="outlined" onPress={() => onChange(stepValue(value, -1, opts))}>−</Button>
      <TextInput
        testID="number-input"
        dense
        mode="outlined"
        keyboardType="decimal-pad"
        style={{ flex: 1, textAlign: 'center' }}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
      />
      <Button testID="number-plus" accessibilityLabel="Increase" compact mode="outlined" onPress={() => onChange(stepValue(value, 1, opts))}>+</Button>
      {unit ? <Text>{unit}</Text> : null}
      {value !== null && <Button testID="number-skip" compact onPress={() => onChange(null)}>Skip</Button>}
    </View>
  );
}
