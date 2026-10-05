import React, { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native-paper';

import type { Question } from '../../domain/question';

type Props = {
  question: Extract<Question, { type: 'text' }>;
  value: string | null;
  onChange: (value: string | null) => void;
};

const IDLE_MS = 800;

/**
 * Free text with a local draft: commits on blur and after 800 ms idle, so
 * autosave does not write on every keystroke, and flushes on unmount so
 * leaving the screen mid-sentence loses nothing.
 */
export function TextAnswerInput({ question, value, onChange }: Props) {
  const [draft, setDraft] = useState(value ?? '');
  const draftRef = useRef(draft);
  const committed = useRef(value ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emit = useRef(onChange);
  emit.current = onChange;

  const commit = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const text = draftRef.current;
    if (text === committed.current) return;
    committed.current = text;
    emit.current(text.trim() === '' ? null : text);
  };

  useEffect(() => {
    const incoming = value ?? '';
    if (incoming !== committed.current) {
      committed.current = incoming;
      draftRef.current = incoming;
      setDraft(incoming);
    }
  }, [value]);

  useEffect(() => () => { if (timer.current) commit(); }, []); // flush a pending edit on unmount

  const change = (text: string) => {
    draftRef.current = text;
    setDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, IDLE_MS);
  };

  return (
    <TextInput
      testID="text-input"
      mode="outlined"
      multiline={question.config.multiline}
      value={draft}
      onChangeText={change}
      onBlur={commit}
    />
  );
}
