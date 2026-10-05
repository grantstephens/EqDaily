import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { NewQuestion } from '../domain/question';
import { makeHarness } from '../testing/harness';
import { QuestionEditorScreen } from './QuestionEditor';

jest.mock('../platform/confirm', () => ({ notify: jest.fn(async () => {}), confirm: jest.fn(async () => true) }));

const yes: NewQuestion = { label: 'Exercise', type: 'yesno', config: {} as never, hideFromInsights: false };
const mood: NewQuestion = { label: 'Mood', type: 'scale', config: { min: 0, max: 10 }, hideFromInsights: false };
const sym: NewQuestion = { label: 'Symptoms', type: 'checkboxes', config: { options: ['Headache', 'Asthma'], allowOther: true }, hideFromInsights: false };

async function open(seed: (h: Awaited<ReturnType<typeof makeHarness>>) => Promise<void> = async () => {}) {
  const h = await makeHarness();
  await seed(h);
  const onClose = jest.fn();
  await render(h.wrap(<QuestionEditorScreen onClose={onClose} />));
  return { ...h, onClose };
}
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);

describe('adding', () => {
  test('a scale question with custom bounds appears in the list and is stored', async () => {
    const h = await open();
    await press('add-question');
    await type('form-label', 'Sleep quality');
    await press('form-type-scale');
    await type('scale-min', '1');
    await type('scale-max', '5');
    await press('form-save');
    await screen.findByText('Sleep quality');
    const [q] = await h.store.listQuestions();
    expect(q).toMatchObject({ label: 'Sleep quality', type: 'scale', config: { min: 1, max: 5 } });
  });
  test('min >= max shows the validation message and writes nothing', async () => {
    const h = await open();
    await press('add-question');
    await type('form-label', 'Bad');
    await press('form-type-scale');
    await type('scale-min', '5');
    await type('scale-max', '5');
    await press('form-save');
    expect((await screen.findByTestId('form-error')).props.children).toMatch(/min/);
    expect(await h.store.listQuestions()).toEqual([]);
  });
  test('a duplicate shows the store message', async () => {
    await open(async (h) => { await h.store.addQuestion(yes); });
    await press('add-question');
    await type('form-label', 'exercise');
    await press('form-save');
    expect((await screen.findByTestId('form-error')).props.children).toMatch(/already exists/);
  });
  test('a checkbox question collects options and the Other switch', async () => {
    const h = await open();
    await press('add-question');
    await type('form-label', 'Symptoms');
    await press('form-type-checkboxes');
    await type('option-new', 'Headache');
    await press('option-add');
    await type('option-new', 'Asthma');
    await press('option-add');
    await press('form-save');
    await screen.findByText('Symptoms');
    expect((await h.store.listQuestions())[0]).toMatchObject({ type: 'checkboxes', config: { options: ['Headache', 'Asthma'] } });
  });
  test.each([['a|b'], ['   '], ['headache']])('options editor rejects %j with a message', async (bad) => {
    await open();
    await press('add-question');
    await press('form-type-checkboxes');
    await type('option-new', 'Headache');
    await press('option-add');
    await type('option-new', bad);
    await press('option-add');
    expect(screen.getByTestId('option-error')).toBeTruthy();
    expect(screen.queryByTestId('option-remove-a|b')).toBeNull();
  });
  test('cancel returns to the list without writing', async () => {
    const h = await open();
    await press('add-question');
    await type('form-label', 'Nope');
    await press('form-cancel');
    await screen.findByTestId('add-question');
    expect(await h.store.listQuestions()).toEqual([]);
  });
});

describe('list management', () => {
  test('up/down reorder persists', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(yes); await x.store.addQuestion(mood); });
    const [a, b] = await h.store.listQuestions();
    await press(`move-up-${b!.id}`);
    await waitFor(async () => expect((await h.store.listQuestions()).map((q) => q.id)).toEqual([b!.id, a!.id]));
    await press(`move-down-${b!.id}`);
    await waitFor(async () => expect((await h.store.listQuestions()).map((q) => q.id)).toEqual([a!.id, b!.id]));
  });
  test('archive moves a question to the Archived section; restore brings it back', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(yes); });
    const [q] = await h.store.listQuestions();
    await press(`archive-${q!.id}`);
    await screen.findByTestId(`restore-${q!.id}`);
    expect(await h.store.listQuestions()).toEqual([]);
    await press(`restore-${q!.id}`);
    await screen.findByTestId(`archive-${q!.id}`);
    expect(await h.store.listQuestions()).toHaveLength(1);
  });
  test('back calls onClose', async () => {
    const h = await open();
    await press('editor-back');
    expect(h.onClose).toHaveBeenCalled();
  });
});

describe('editing', () => {
  test('answered question: type and bounds are locked, label still saves', async () => {
    const h = await open(async (x) => {
      const q = await x.store.addQuestion(mood);
      await x.store.setAnswer('2026-10-05', q.id, 4);
    });
    const [q] = await h.store.listQuestions();
    await press(`edit-${q!.id}`);
    await screen.findByTestId('locked-hint');
    await press('form-type-yesno');
    await type('scale-max', '5');
    await type('form-label', 'Mood v2');
    await press('form-save');
    await screen.findByText('Mood v2');
    expect((await h.store.listQuestions())[0]).toMatchObject({ label: 'Mood v2', type: 'scale', config: { min: 0, max: 10 } });
  });
  test('unanswered question: type and bounds are editable', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(mood); });
    const [q] = await h.store.listQuestions();
    await press(`edit-${q!.id}`);
    await press('form-type-yesno');
    await press('form-save');
    await waitFor(async () => expect((await h.store.listQuestions())[0]!.type).toBe('yesno'));
  });
  test('removing options hides them without touching old answers, learned ones included', async () => {
    const h = await open(async (x) => {
      const q = await x.store.addQuestion(sym);
      await x.store.setAnswer('2026-10-05', q.id, ['Asthma', 'Wheezy']);
    });
    const [q] = await h.store.listQuestions();
    await press(`edit-${q!.id}`);
    await press('option-remove-Asthma');
    await press('option-remove-Wheezy');
    await press('form-save');
    await screen.findByTestId(`edit-${q!.id}`);
    const [after] = await h.store.listQuestions();
    expect(after!.config).toMatchObject({ options: ['Headache'] });
    expect((await h.store.options(q!.id)).map((o) => o.option)).toEqual([]);
    expect((await h.store.getAnswers('2026-10-05'))[0]!.value).toEqual(['Asthma', 'Wheezy']);
  });
  test('renaming onto an existing question shows the store message', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(yes); await x.store.addQuestion(mood); });
    const qs = await h.store.listQuestions();
    await press(`edit-${qs[1]!.id}`);
    await type('form-label', 'Exercise');
    await press('form-type-yesno');
    await press('form-save');
    expect((await screen.findByTestId('form-error')).props.children).toMatch(/already exists/);
  });
});
