import React from 'react';

import type { AnswerValue, Question } from '../../domain/question';
import { CheckboxesInput } from './CheckboxesInput';
import { ChoiceInput } from './ChoiceInput';
import { NumberInput } from './NumberInput';
import { ScaleInput } from './ScaleInput';
import { TextAnswerInput } from './TextAnswerInput';
import { TimeInput } from './TimeInput';
import { YesNoInput } from './YesNoInput';

interface Props {
  question: Question;
  value: AnswerValue | null;
  onChange: (value: AnswerValue | null) => void;
  /** Learned option usage, used only by checkbox and choice questions. */
  optionUsage: { option: string; count: number }[];
}

/** AnswerInput renders the right input for a question's type. null always means skip. */
export function AnswerInput({ question, value, onChange, optionUsage }: Props) {
  switch (question.type) {
    case 'scale':
      return <ScaleInput question={question} value={value as number | null} onChange={onChange} />;
    case 'number':
      return <NumberInput question={question} value={value as number | null} onChange={onChange} />;
    case 'yesno':
      return <YesNoInput value={value as boolean | null} onChange={onChange} />;
    case 'text':
      return <TextAnswerInput question={question} value={value as string | null} onChange={onChange} />;
    case 'checkboxes':
      return <CheckboxesInput question={question} value={value as string[] | null} onChange={onChange} optionUsage={optionUsage} />;
    case 'choice':
      return <ChoiceInput question={question} value={value as string | null} onChange={onChange} optionUsage={optionUsage} />;
    case 'time':
      return <TimeInput value={value as string | null} onChange={onChange} start={question.config.defaultTime} />;
  }
}
