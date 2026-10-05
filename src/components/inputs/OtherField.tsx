import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';

import { MAX_OPTION } from '../../domain/question';

/** OtherField is the free-entry row shared by checkboxes and choice. */
export function OtherField({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const t = text.trim();
    if (t === '') return setError('Type something first');
    if (t.includes('|')) return setError('Options cannot contain "|"');
    if (t.length > MAX_OPTION) return setError(`Keep it under ${MAX_OPTION} characters`);
    setError(null);
    setText('');
    onAdd(t);
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput testID="other-input" dense mode="outlined" label="Other" style={{ flex: 1 }}
          value={text} onChangeText={(t) => { setText(t); setError(null); }} onSubmitEditing={add} />
        <Button testID="other-add" mode="outlined" onPress={add}>Add</Button>
      </View>
      {error !== null && <HelperText testID="other-error" type="error">{error}</HelperText>}
    </View>
  );
}
