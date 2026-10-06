import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip } from 'react-native-paper';

import { rankOptions } from '../../domain/options';
import type { Question } from '../../domain/question';
import { OtherField } from './OtherField';

type Props = {
  question: Extract<Question, { type: 'checkboxes' }>;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  optionUsage: { option: string; count: number }[];
};

export function CheckboxesInput({ question, value, onChange, optionUsage }: Props) {
  const [expanded, setExpanded] = useState(false);
  const selected = value ?? [];
  const { shown, more } = rankOptions(question.config.options, optionUsage);
  const listed = expanded ? [...shown, ...more] : shown;
  // Selections no longer in the list (a just-typed Other, a removed option)
  // must still be visible so they can be unticked.
  const extras = selected.filter((s) => !shown.includes(s) && !more.includes(s));

  const toggle = (o: string) =>
    onChange(selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o]);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...listed, ...extras].map((o) => (
          <Chip key={o} testID={`chip-${o}`} selected={selected.includes(o)} showSelectedCheck onPress={() => toggle(o)}>{o}</Chip>
        ))}
        {!expanded && more.length > 0 && (
          <Chip testID="chip-more" onPress={() => setExpanded(true)}>{`More (${more.length})`}</Chip>
        )}
        <Chip testID="chip-none" selected={value !== null && value.length === 0} showSelectedCheck
          onPress={() => { if (!(value !== null && value.length === 0)) onChange([]); }}>None</Chip>
      </View>
      {question.config.allowOther && (
        <OtherField onAdd={(typed) => {
          // "gym" when "Gym" exists is the same option, not a lookalike.
          const t = [...shown, ...more, ...selected].find((o) => o.toLowerCase() === typed.toLowerCase()) ?? typed;
          if (!selected.includes(t)) onChange([...selected, t]);
        }} />
      )}
      {value !== null && <Button testID="checks-skip" compact onPress={() => onChange(null)}>Skip</Button>}
    </View>
  );
}
