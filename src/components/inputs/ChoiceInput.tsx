import React, { useState } from 'react';
import { View } from 'react-native';
import { Chip } from 'react-native-paper';
import { touchChip } from '../touch';

import { rankOptions } from '../../domain/options';
import type { Question } from '../../domain/question';
import { OtherField } from './OtherField';

type Props = {
  question: Extract<Question, { type: 'choice' }>;
  value: string | null;
  onChange: (value: string | null) => void;
  optionUsage: { option: string; count: number }[];
};

export function ChoiceInput({ question, value, onChange, optionUsage }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { shown, more } = rankOptions(question.config.options, optionUsage);
  const listed = expanded ? [...shown, ...more] : shown;
  const extras = value !== null && !shown.includes(value) && !more.includes(value) ? [value] : [];

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...listed, ...extras].map((o) => (
          <Chip {...touchChip} key={o} testID={`chip-${o}`} selected={value === o} showSelectedCheck
            onPress={() => onChange(value === o ? null : o)}>{o}</Chip>
        ))}
        {!expanded && more.length > 0 && (
          <Chip {...touchChip} testID="chip-more" onPress={() => setExpanded(true)}>{`More (${more.length})`}</Chip>
        )}
      </View>
      {question.config.allowOther && (
        <OtherField onAdd={(typed) =>
          onChange([...shown, ...more, ...extras].find((o) => o.toLowerCase() === typed.toLowerCase()) ?? typed)} />
      )}
    </View>
  );
}
