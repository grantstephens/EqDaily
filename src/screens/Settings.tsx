import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { Button, Divider, SegmentedButtons, Switch, Text } from 'react-native-paper';

import { exportBundle, exportFileName, formatRowError, importBundle } from '../csv/bundle';
import { displayDate, today } from '../domain/date';
import { notify } from '../platform/confirm';
import { pickBundle, saveBundle } from '../platform/files';
import { useTracker } from '../TrackerContext';
import { useTheme } from '../ThemeContext';
import type { ThemeMode } from '../theme';
import { QuestionEditorScreen } from './QuestionEditor';

const APPEARANCE: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

const MAX_SHOWN_ERRORS = 5;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Stats { questions: number; answers: number; since: string | null }

export function SettingsScreen() {
  const { store, now, revision, bump } = useTracker();
  const { mode, setMode } = useTheme();
  const [editing, setEditing] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const questions = (await store.listQuestions({ includeArchived: true })).length;
        let answers = 0;
        for await (const _ of store.allAnswers()) answers++;
        const since = await store.firstAnswerDate();
        if (!cancelled) setStats({ questions, answers, since });
      } catch (e) {
        await notify('Could not read your data', message(e));
      }
    })();
    return () => { cancelled = true; };
  }, [store, revision, editing]);

  const doExport = async () => {
    setBusy(true);
    try {
      const bytes = await exportBundle(store);
      const name = await saveBundle(exportFileName(today(now())), bytes);
      await notify('Export ready', `${name} — keep it somewhere safe. You can import it back here at any time.`);
    } catch (e) {
      await notify('Export failed', message(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const file = await pickBundle();
      if (file === null) return;
      const r = await importBundle(store, file.bytes, overwrite);
      if (r.errors.length > 0) {
        const shown = r.errors.slice(0, MAX_SHOWN_ERRORS).map(formatRowError);
        if (r.errors.length > MAX_SHOWN_ERRORS) shown.push(`…and ${r.errors.length - MAX_SHOWN_ERRORS} more`);
        await notify('Import failed — nothing was changed', shown.join('\n'));
        return;
      }
      bump();
      await notify('Import complete',
        `Added ${plural(r.answersAdded, 'answer')} and ${plural(r.questionsAdded, 'question')}, skipped ${r.answersSkipped}.`);
    } catch (e) {
      await notify('Import failed', message(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing) return <QuestionEditorScreen onClose={() => setEditing(false)} />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text variant="titleLarge">Settings</Text>

      <Text variant="titleMedium">Questions</Text>
      <Button testID="manage-questions" mode="contained-tonal" onPress={() => setEditing(true)}>Manage questions</Button>
      <Divider />

      <Text variant="titleMedium">Your data</Text>
      {stats && (
        <Text>
          {`${plural(stats.questions, 'question')} · ${plural(stats.answers, 'answer')}`}
          {/* displayDate is "Thu 1 Oct 2026"; the weekday is always 3 chars + a space. */}
          {stats.since ? ` · since ${displayDate(stats.since).slice(4)}` : ''}
        </Text>
      )}
      <Text>Everything stays on this device. Uninstalling the app deletes it, so export a backup first.</Text>
      <Button testID="export-button" mode="contained-tonal" disabled={busy} onPress={doExport}>Export backup (.zip)</Button>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text>Overwrite existing answers</Text>
        <Switch testID="overwrite-switch" value={overwrite} onValueChange={setOverwrite} />
      </View>
      <Button testID="import-button" mode="contained-tonal" disabled={busy} onPress={doImport}>Import backup</Button>

      {Platform.OS !== 'web' && (
        <>
          <Divider />
          <Text variant="titleMedium">Appearance</Text>
          <SegmentedButtons
            value={mode}
            onValueChange={(v) => setMode(v as ThemeMode)}
            buttons={APPEARANCE.map((o) => ({ value: o.mode, label: o.label, testID: `appearance-${o.mode}` }))}
          />
        </>
      )}
    </ScrollView>
  );
}
