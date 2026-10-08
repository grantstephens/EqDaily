import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { touchButton } from '../components/touch';

import type { NewQuestion, Question } from '../domain/question';
import type { OptionUsage } from '../domain/store';
import { TYPE_LABELS } from '../domain/typeLabels';
import { notify } from '../platform/confirm';
import { useTracker } from '../TrackerContext';
import { QuestionForm } from './QuestionForm';

type Editing = { question?: Question; answered: boolean; usage: OptionUsage[] };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Manage questions: add, edit, reorder, archive and restore. */
export function QuestionEditorScreen({ onClose }: { onClose: () => void }) {
  const { store, bump } = useTracker();
  const [active, setActive] = useState<Question[]>([]);
  const [archived, setArchived] = useState<Question[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);

  const reload = useCallback(async () => {
    try {
      const all = await store.listQuestions({ includeArchived: true });
      setActive(all.filter((q) => q.archivedAt === null));
      setArchived(all.filter((q) => q.archivedAt !== null));
    } catch (e) {
      await notify('Could not load questions', message(e));
    }
  }, [store]);

  useEffect(() => { void reload(); }, [reload]);

  const guarded = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await reload();
      bump();
    } catch (e) {
      await notify('Something went wrong', message(e));
    }
  };

  const move = (index: number, dir: -1 | 1) => guarded(async () => {
    const ids = active.map((q) => q.id);
    [ids[index], ids[index + dir]] = [ids[index + dir]!, ids[index]!];
    await store.reorderQuestions(ids);
  });

  const openEdit = async (question?: Question) => {
    try {
      const answered = question ? await store.hasAnswers(question.id) : false;
      const usage = question && (question.type === 'checkboxes' || question.type === 'choice')
        ? await store.options(question.id) : [];
      setEditing({ question, answered, usage });
    } catch (e) {
      await notify('Could not open the question', message(e));
    }
  };

  const save = async (q: NewQuestion, removed: string[]) => {
    const existing = editing?.question;
    if (existing) {
      await store.updateQuestion(existing.id, q, removed);
    } else {
      await store.addQuestion(q);
    }
    setEditing(null);
    await reload();
    bump();
  };

  if (editing) {
    return (
      <QuestionForm
        initial={editing.question}
        answered={editing.answered}
        usage={editing.usage}
        onSave={save}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button {...touchButton} testID="editor-back" onPress={onClose}>Back</Button>
        <Button {...touchButton} testID="add-question" mode="contained" onPress={() => openEdit()}>Add question</Button>
      </View>
      {active.length === 0 && <Text>No questions yet. Add one to get started.</Text>}
      {active.map((q, i) => (
        <Card key={q.id}>
          <Card.Content style={{ gap: 4 }}>
            <Text variant="titleMedium">{q.label}</Text>
            <Text variant="labelSmall">{TYPE_LABELS[q.type]}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Button {...touchButton} testID={`move-up-${q.id}`} accessibilityLabel={`Move ${q.label} up`} compact disabled={i === 0} onPress={() => move(i, -1)}>▲</Button>
              <Button {...touchButton} testID={`move-down-${q.id}`} accessibilityLabel={`Move ${q.label} down`} compact disabled={i === active.length - 1} onPress={() => move(i, 1)}>▼</Button>
              <Button {...touchButton} testID={`edit-${q.id}`} compact onPress={() => openEdit(q)}>Edit</Button>
              <Button {...touchButton} testID={`archive-${q.id}`} compact onPress={() => guarded(() => store.setArchived(q.id, true))}>Archive</Button>
            </View>
          </Card.Content>
        </Card>
      ))}
      {archived.length > 0 && <Text variant="titleMedium">Archived</Text>}
      {archived.map((q) => (
        <Card key={q.id}>
          <Card.Content style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text>{q.label}</Text>
            <Button {...touchButton} testID={`restore-${q.id}`} compact onPress={() => guarded(() => store.setArchived(q.id, false))}>Restore</Button>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}
