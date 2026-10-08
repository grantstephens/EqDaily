import React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';

import { stepTime } from '../../domain/stepper';
import { touchButton } from '../touch';
import { pickTime } from '../../platform/timePicker';

type Props = { value: string | null; onChange: (value: string | null) => void; start?: string };

export function TimeInput({ value, onChange, start }: Props) {
  const home = start ?? '22:00';
  const pick = async () => {
    const picked = await pickTime(value ?? start ?? null);
    if (picked !== null && picked !== value) onChange(picked);
  };

  return (
    <View style={{ gap: 8 }}>
      <Button testID="time-pick" accessibilityLabel="Set time" mode="contained-tonal" icon="clock-outline"
        style={{ alignSelf: 'stretch' }} contentStyle={{ paddingVertical: 4 }} labelStyle={{ fontSize: 20 }} onPress={pick}>
        {value ?? 'Set time'}
      </Button>
      <View testID="time-actions" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button testID="time-minus" accessibilityLabel="15 minutes earlier" compact mode="outlined" {...touchButton} onPress={() => onChange(stepTime(value, -15, start))}>−15</Button>
        <Button testID="time-plus" accessibilityLabel="15 minutes later" compact mode="outlined" {...touchButton} onPress={() => onChange(stepTime(value, 15, start))}>+15</Button>
        {value !== null && value !== home && <Button testID="time-reset" accessibilityLabel={`Reset to ${home}`} compact {...touchButton} onPress={() => onChange(home)}>Reset</Button>}
        {value !== null && <Button testID="time-skip" compact {...touchButton} onPress={() => onChange(null)}>Skip</Button>}
      </View>
    </View>
  );
}
