import React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';

import { stepTime } from '../../domain/stepper';
import { pickTime } from '../../platform/timePicker';

type Props = { value: string | null; onChange: (value: string | null) => void; start?: string };

export function TimeInput({ value, onChange, start }: Props) {
  const pick = async () => {
    const picked = await pickTime(value ?? start ?? null);
    if (picked !== null && picked !== value) onChange(picked);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Button testID="time-minus" accessibilityLabel="15 minutes earlier" compact mode="outlined" onPress={() => onChange(stepTime(value, -15, start))}>−15</Button>
      <Button testID="time-pick" accessibilityLabel="Set time" mode="contained-tonal" icon="clock-outline"
        style={{ flex: 1 }} contentStyle={{ paddingVertical: 4 }} labelStyle={{ fontSize: 20 }} onPress={pick}>
        {value ?? 'Set time'}
      </Button>
      <Button testID="time-plus" accessibilityLabel="15 minutes later" compact mode="outlined" onPress={() => onChange(stepTime(value, 15, start))}>+15</Button>
      {value !== null && <Button testID="time-skip" compact onPress={() => onChange(null)}>Skip</Button>}
    </View>
  );
}
