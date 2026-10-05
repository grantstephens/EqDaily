import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { stepTime } from '../../domain/stepper';

type Props = { value: string | null; onChange: (value: string | null) => void };

const LOOSE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function TimeInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);

  const commit = () => {
    const m = LOOSE.exec(draft.trim());
    if (!m) { setDraft(value ?? ''); return; }
    const next = `${m[1]!.padStart(2, '0')}:${m[2]}`;
    setDraft(next);
    if (next !== value) onChange(next);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Button testID="time-minus" accessibilityLabel="15 minutes earlier" compact mode="outlined" onPress={() => onChange(stepTime(value, -15))}>−15</Button>
      <TextInput testID="time-input" dense mode="outlined" placeholder="HH:MM" keyboardType="numbers-and-punctuation"
        style={{ flex: 1, textAlign: 'center' }} value={draft} onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit} />
      <Button testID="time-plus" accessibilityLabel="15 minutes later" compact mode="outlined" onPress={() => onChange(stepTime(value, 15))}>+15</Button>
      {value !== null && <Button testID="time-skip" compact onPress={() => onChange(null)}>Skip</Button>}
    </View>
  );
}
