import React from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { touchButton } from '../touch';

import type { Question } from '../../domain/question';
import { scaleStart, scaleStep, stepValue } from '../../domain/stepper';
import { Slider } from './Slider';

type Props = {
  question: Extract<Question, { type: 'scale' }>;
  value: number | null;
  onChange: (value: number | null) => void;
};

export function ScaleInput({ question, value, onChange }: Props) {
  const { min, max } = question.config;
  const step = scaleStep(question.config);
  const opts = { min, max, step, start: scaleStart(question.config), decimals: 4 };
  const readout = value === null ? '—' : String(Number(value.toFixed(2)));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Button testID="scale-minus" accessibilityLabel="Decrease" compact mode="outlined" {...touchButton} onPress={() => onChange(stepValue(value, -1, opts))}>−</Button>
        <View style={{ flex: 1 }}>
          <Slider testID="scale-slider" value={value} min={min} max={max} step={step} start={opts.start} onChange={onChange} />
        </View>
        <Button testID="scale-plus" accessibilityLabel="Increase" compact mode="outlined" {...touchButton} onPress={() => onChange(stepValue(value, 1, opts))}>+</Button>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="labelSmall">{min}</Text>
        <Text testID="scale-readout" variant="titleMedium">{readout}</Text>
        <Text variant="labelSmall">{max}</Text>
      </View>
      {value !== null && (
        <Button testID="scale-skip" compact {...touchButton} onPress={() => onChange(null)}>Skip</Button>
      )}
    </View>
  );
}
