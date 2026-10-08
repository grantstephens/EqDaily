import React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-paper';
import { touchButton } from '../touch';

type Props = { value: boolean | null; onChange: (value: boolean | null) => void };

export function YesNoInput({ value, onChange }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button testID="yesno-yes" {...touchButton} mode={value === true ? 'contained' : 'outlined'}
        onPress={() => { if (value !== true) onChange(true); }}>Yes</Button>
      <Button testID="yesno-no" {...touchButton} mode={value === false ? 'contained' : 'outlined'}
        onPress={() => { if (value !== false) onChange(false); }}>No</Button>
      {value !== null && <Button testID="yesno-skip" {...touchButton} onPress={() => onChange(null)}>Skip</Button>}
    </View>
  );
}
