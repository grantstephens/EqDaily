import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, HelperText, Switch, Text, TextInput } from 'react-native-paper';
import { touchButton, touchChip } from '../components/touch';
import { KeyboardAwareScroll } from '../components/KeyboardAwareScroll';

import {
  MAX_OPTION, MAX_OPTIONS, QUESTION_TYPES, validateQuestion,
  type NewQuestion, type QuestionType,
} from '../domain/question';
import type { OptionUsage } from '../domain/store';
import { pickTime } from '../platform/timePicker';
import { TYPE_LABELS } from '../domain/typeLabels';

interface Props {
  /** The question being edited. May be unsaved (e.g. a suggestion in the setup guide). */
  initial?: NewQuestion;
  /** answered locks the type and (for scale/number) the min/max. */
  answered: boolean;
  /** Learned options for an existing checkbox/choice question, so they can be pruned. */
  usage: OptionUsage[];
  /** onSave may reject; the message is shown inline. `removed` lists options the user deleted. */
  onSave: (q: NewQuestion, removed: string[]) => Promise<void>;
  onCancel: () => void;
}

const hasOptions = (t: QuestionType) => t === 'checkboxes' || t === 'choice';
const str = (n: number | undefined) => (n === undefined ? '' : String(n));
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function QuestionForm({ initial, answered, usage, onSave, onCancel }: Props) {
  const cfg = (initial?.config ?? {}) as Record<string, any>;
  const configured: string[] = hasOptions(initial?.type ?? 'yesno') ? [...(cfg.options ?? [])] : [];
  const learned = new Set(usage.map((u) => u.option).filter((o) => !configured.includes(o)));
  const initialListed = [...configured, ...learned];

  const [label, setLabel] = useState(initial?.label ?? '');
  const [type, setType] = useState<QuestionType>(initial?.type ?? 'yesno');
  const [hide, setHide] = useState(initial?.hideFromInsights ?? false);
  const [scaleMin, setScaleMin] = useState(initial?.type === 'scale' ? str(cfg.min) : '1');
  const [scaleMax, setScaleMax] = useState(initial?.type === 'scale' ? str(cfg.max) : '10');
  const [scaleStep, setScaleStep] = useState(initial?.type === 'scale' ? str(cfg.step) : '');
  const [numMin, setNumMin] = useState(initial?.type === 'number' ? str(cfg.min) : '');
  const [numMax, setNumMax] = useState(initial?.type === 'number' ? str(cfg.max) : '');
  const [unit, setUnit] = useState(initial?.type === 'number' ? (cfg.unit ?? '') : '');
  const [decimals, setDecimals] = useState(initial?.type === 'number' ? cfg.decimals : 0);
  const [multiline, setMultiline] = useState(initial?.type === 'text' ? cfg.multiline : false);
  const [frequent, setFrequent] = useState(initial?.type === 'text' ? cfg.showFrequent : false);
  const [defaultTime, setDefaultTime] = useState<string | undefined>(initial?.type === 'time' ? cfg.defaultTime : undefined);
  const [options, setOptions] = useState<string[]>(initialListed);
  const [allowOther, setAllowOther] = useState(hasOptions(initial?.type ?? 'yesno') ? cfg.allowOther : true);
  const [newOption, setNewOption] = useState('');
  const [optionError, setOptionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const optional = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const build = (): NewQuestion => {
    const base = { label, hideFromInsights: hide };
    switch (type) {
      case 'scale':
        return { ...base, type, config: { min: Number(scaleMin), max: Number(scaleMax), step: optional(scaleStep) } };
      case 'number':
        return { ...base, type, config: { min: optional(numMin), max: optional(numMax), unit: unit.trim() || undefined, decimals } };
      case 'text':
        return { ...base, type, config: { multiline, showFrequent: frequent } };
      case 'checkboxes':
      case 'choice':
        return { ...base, type, config: { options: options.filter((o) => !learned.has(o)), allowOther } };
      case 'time':
        return { ...base, type, config: defaultTime === undefined ? {} : { defaultTime } };
      default:
        return { ...base, type, config: {} as never };
    }
  };

  const addOption = () => {
    const t = newOption.trim();
    const fail = (m: string) => setOptionError(m);
    if (t === '') return fail('Type an option first');
    if (t.includes('|')) return fail('Options cannot contain "|"');
    if (t.length > MAX_OPTION) return fail(`Keep options under ${MAX_OPTION} characters`);
    if (options.some((o) => o.toLowerCase() === t.toLowerCase())) return fail(`"${t}" is already an option`);
    if (options.length >= MAX_OPTIONS) return fail(`No more than ${MAX_OPTIONS} options`);
    setOptionError(null);
    setOptions([...options, t]);
    setNewOption('');
  };

  const submit = async () => {
    const q = build();
    const err = validateQuestion(q);
    if (err) { setError(err); return; }
    setError(null);
    setBusy(true);
    try {
      await onSave(q, initialListed.filter((o) => !options.includes(o)));
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  const num = (id: string, lbl: string, value: string, set: (s: string) => void, locked = false) => (
    <TextInput testID={id} label={lbl} dense mode="outlined" keyboardType="numbers-and-punctuation"
      value={value} onChangeText={set} disabled={locked} style={{ flex: 1 }} />
  );

  return (
    <KeyboardAwareScroll contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text variant="titleLarge">{initial ? 'Edit question' : 'New question'}</Text>
      <TextInput testID="form-label" label="Question" mode="outlined" value={label} onChangeText={setLabel} />

      <Text variant="labelLarge">Answer type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {QUESTION_TYPES.map((t) => (
          <Chip {...touchChip} key={t} testID={`form-type-${t}`} selected={type === t} showSelectedCheck disabled={answered && type !== t}
            onPress={() => setType(t)}>{TYPE_LABELS[t]}</Chip>
        ))}
      </View>
      {answered && (
        <HelperText testID="locked-hint" type="info">
          This question has answers, so its type and range are locked. Add a new question to change them.
        </HelperText>
      )}

      {type === 'scale' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {num('scale-min', 'Lowest', scaleMin, setScaleMin, answered)}
          {num('scale-max', 'Highest', scaleMax, setScaleMax, answered)}
          {num('scale-step', 'Step (optional)', scaleStep, setScaleStep)}
        </View>
      )}
      {type === 'number' && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {num('number-min', 'Min (optional)', numMin, setNumMin, answered)}
            {num('number-max', 'Max (optional)', numMax, setNumMax, answered)}
          </View>
          <TextInput testID="number-unit" label="Unit (optional)" dense mode="outlined" value={unit} onChangeText={setUnit} />
          <Text variant="labelLarge">Decimal places</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[0, 1, 2, 3, 4].map((n) => (
              <Chip {...touchChip} key={n} testID={`decimals-${n}`} selected={decimals === n} onPress={() => setDecimals(n)}>{String(n)}</Chip>
            ))}
          </View>
        </View>
      )}
      {type === 'text' && (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Multi-line answer</Text>
            <Switch testID="text-multiline" value={multiline} onValueChange={setMultiline} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Show most frequent entries on Insights</Text>
            <Switch testID="text-frequent" value={frequent} onValueChange={setFrequent} />
          </View>
        </View>
      )}
      {type === 'time' && (
        <View style={{ gap: 4 }}>
          <Text variant="labelLarge">Starting time</Text>
          <Text variant="bodySmall">Where the clock opens on a new day, e.g. your usual wake-up time.</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Button {...touchButton} testID="time-default" mode="outlined" icon="clock-outline" style={{ flex: 1 }}
              onPress={async () => { const t = await pickTime(defaultTime ?? null); if (t !== null) setDefaultTime(t); }}>
              {defaultTime ?? '22:00 (tap to change)'}
            </Button>
            {defaultTime !== undefined && <Button {...touchButton} testID="time-default-clear" compact onPress={() => setDefaultTime(undefined)}>Clear</Button>}
          </View>
        </View>
      )}
      {hasOptions(type) && (
        <View style={{ gap: 8 }}>
          <Text variant="labelLarge">Options</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {options.map((o) => (
              <Chip {...touchChip} key={o} testID={`option-remove-${o}`} onClose={() => setOptions(options.filter((x) => x !== o))}
                onPress={() => setOptions(options.filter((x) => x !== o))}>{learned.has(o) ? `${o} (added by you)` : o}</Chip>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput testID="option-new" label="Add an option" dense mode="outlined" style={{ flex: 1 }}
              value={newOption} onChangeText={(t) => { setNewOption(t); setOptionError(null); }} onSubmitEditing={addOption} />
            <Button {...touchButton} testID="option-add" mode="outlined" onPress={addOption}>Add</Button>
          </View>
          {optionError !== null && <HelperText testID="option-error" type="error">{optionError}</HelperText>}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Let me type my own ("Other")</Text>
            <Switch testID="allow-other" value={allowOther} onValueChange={setAllowOther} />
          </View>
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text>Hide from Insights</Text>
        <Switch testID="hide-insights" value={hide} onValueChange={setHide} />
      </View>

      {error !== null && <HelperText testID="form-error" type="error">{error}</HelperText>}
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
        <Button {...touchButton} testID="form-cancel" onPress={onCancel} disabled={busy}>Cancel</Button>
        <Button {...touchButton} testID="form-save" mode="contained" onPress={submit} disabled={busy}>Save</Button>
      </View>
    </KeyboardAwareScroll>
  );
}
