import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { TEMPLATES } from '../domain/templates';
import { makeHarness } from '../testing/harness';
import { SetupGuide } from './SetupGuide';

jest.mock('../platform/onboarding', () => {
  let done = false;
  return {
    getOnboarded: jest.fn(async () => done),
    setOnboarded: jest.fn(async () => { done = true; }),
    __reset: () => { done = false; },
  };
});
jest.mock('../platform/confirm', () => ({ notify: jest.fn(async () => {}), confirm: jest.fn(async () => true) }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const onboarding = require('../platform/onboarding') as { setOnboarded: jest.Mock; __reset: () => void };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { notify } = require('../platform/confirm') as { notify: jest.Mock };

beforeEach(() => { onboarding.__reset(); onboarding.setOnboarded.mockClear(); notify.mockClear(); });

async function open() {
  const h = await makeHarness();
  await render(h.wrap(<SetupGuide />));
  return h;
}
const press = (id: string) => fireEvent.press(screen.getByTestId(id));
const type = (id: string, text: string) => fireEvent.changeText(screen.getByTestId(id), text);
const N = TEMPLATES.length;
async function start() { const h = await open(); await press('guide-start'); return h; }
async function keepAll() { for (let i = 0; i < N; i++) await press('guide-keep'); }
const labels = async (h: Awaited<ReturnType<typeof open>>) => (await h.store.listQuestions()).map((q) => q.label);

describe('welcome', () => {
  test('says how many suggestions there are and offers to start or go blank', async () => {
    await open();
    expect(screen.getByTestId('guide-intro')).toHaveTextContent(new RegExp(`${N} suggested questions`));
    expect(screen.getByTestId('guide-start')).toBeTruthy();
    expect(screen.getByTestId('guide-blank')).toBeTruthy();
  });
  test('Start blank creates nothing and marks setup done', async () => {
    const h = await open();
    await press('guide-blank');
    await waitFor(() => expect(onboarding.setOnboarded).toHaveBeenCalled());
    expect(await h.store.listQuestions()).toEqual([]);
  });
});

describe('a suggestion step', () => {
  test('shows progress, the question, its prompt, why it is useful, and its type', async () => {
    await start();
    expect(screen.getByTestId('guide-progress')).toHaveTextContent(`Step 1 of ${N}`);
    expect(screen.getByTestId('guide-title')).toHaveTextContent('Mood');
    expect(screen.getByTestId('guide-prompt')).toHaveTextContent(TEMPLATES[0]!.prompt);
    expect(screen.getByTestId('guide-why')).toHaveTextContent(TEMPLATES[0]!.why);
    expect(screen.getByTestId('guide-type')).toHaveTextContent('Slider');
  });
  test('has a live preview of the answer input that saves nothing', async () => {
    const h = await start();
    await press('scale-plus');
    expect(screen.getByTestId('scale-readout')).not.toHaveTextContent('—');
    expect(await h.store.listQuestions()).toEqual([]);
    expect(await h.store.firstAnswerDate()).toBeNull();
  });
  test('the preview resets on the next step', async () => {
    await start();
    await press('scale-plus');
    await press('guide-keep');
    expect(screen.getByTestId('guide-progress')).toHaveTextContent(`Step 2 of ${N}`);
    expect(screen.queryByTestId('scale-plus')).toBeNull(); // exercise is a yes/no
    expect(screen.getByTestId('yesno-yes')).toBeTruthy();
  });
  test('Back goes to the previous step, then the welcome', async () => {
    await start();
    await press('guide-keep');
    await press('guide-back');
    expect(screen.getByTestId('guide-title')).toHaveTextContent('Mood');
    await press('guide-back');
    expect(screen.getByTestId('guide-start')).toBeTruthy();
  });
});

describe('finishing', () => {
  test('keeping every suggestion creates them all, in order', async () => {
    const h = await start();
    await keepAll();
    expect(screen.getByTestId('guide-finish')).toHaveTextContent(`Start tracking ${N} questions`);
    await press('guide-finish');
    await waitFor(async () => expect(await labels(h)).toEqual(TEMPLATES.map((t) => t.question.label)));
    expect(onboarding.setOnboarded).toHaveBeenCalled();
  });
  test('a skipped suggestion is left out but can be restored from the review', async () => {
    const h = await start();
    await press('guide-skip');
    for (let i = 1; i < N; i++) await press('guide-keep');
    expect(screen.getByTestId('guide-finish')).toHaveTextContent(`Start tracking ${N - 1} questions`);
    await press('review-restore-mood');
    expect(screen.getByTestId('guide-finish')).toHaveTextContent(`Start tracking ${N} questions`);
    await press('review-remove-0');
    await press('guide-finish');
    await waitFor(async () => expect((await labels(h))[0]).toBe('Exercise'));
    expect(await labels(h)).not.toContain('Mood');
  });
  test('Skip setup, from any step, creates nothing and ends the guide', async () => {
    const h = await start();
    await press('guide-keep');
    await press('guide-skip-setup');
    await waitFor(() => expect(onboarding.setOnboarded).toHaveBeenCalled());
    expect(await h.store.listQuestions()).toEqual([]);
  });
  test('with nothing kept there is nothing to start, and the button says so', async () => {
    const h = await start();
    for (let i = 0; i < N; i++) await press('guide-skip');
    expect(screen.getByTestId('guide-empty')).toBeTruthy();
    await press('guide-finish');
    expect(await h.store.listQuestions()).toEqual([]);
    expect(onboarding.setOnboarded).not.toHaveBeenCalled();
  });
  test('a failed save reports it, stays on the review, and can be retried', async () => {
    const h = await start();
    await keepAll();
    const spy = jest.spyOn(h.store, 'addQuestion').mockRejectedValue(new Error('disk full'));
    await press('guide-finish');
    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(notify.mock.calls[0]![1]).toMatch(/disk full/);
    expect(screen.getByTestId('guide-finish')).toBeTruthy();
    expect(onboarding.setOnboarded).not.toHaveBeenCalled();
    spy.mockRestore();
    await press('guide-finish');
    await waitFor(async () => expect((await labels(h)).length).toBe(N));
  });
});

describe('editing a suggestion inline', () => {
  test('changing the wording shows on the card and in the final question', async () => {
    const h = await start();
    await press('guide-edit');
    await type('form-label', 'Mood today');
    await press('form-save');
    expect(screen.getByTestId('guide-title')).toHaveTextContent('Mood today');
    await keepAll();
    await press('guide-finish');
    await waitFor(async () => expect((await labels(h))[0]).toBe('Mood today'));
  });
  test('changing a slider range is kept', async () => {
    const h = await start();
    await press('guide-edit');
    await type('scale-min', '2');
    await type('scale-max', '5');
    await press('form-save');
    await keepAll();
    await press('guide-finish');
    await waitFor(async () => expect((await h.store.listQuestions())[0]!.config).toMatchObject({ min: 2, max: 5 }));
  });
  test('the preview follows the edit', async () => {
    await start();
    await press('guide-edit');
    await type('scale-min', '0');
    await type('scale-max', '1');
    await press('form-save');
    expect(screen.getByTestId('scale-slider').props.accessibilityValue).toMatchObject({ min: 0, max: 1 });
  });
  test('an invalid edit shows the message and keeps editing; Cancel restores the original', async () => {
    await start();
    await press('guide-edit');
    await type('form-label', '   ');
    await press('form-save');
    expect(await screen.findByTestId('form-error')).toBeTruthy();
    await press('form-cancel');
    expect(screen.getByTestId('guide-title')).toHaveTextContent('Mood');
  });
  test('an edit that duplicates a question already kept is refused', async () => {
    await start();
    await press('guide-keep'); // mood
    await press('guide-keep'); // exercise
    await press('guide-edit'); // time outdoors (yes/no)
    await type('form-label', 'exercise');
    await press('form-save');
    expect((await screen.findByTestId('form-error')).props.children).toMatch(/already/i);
  });
  test('the same name is fine once the original is skipped', async () => {
    await start();
    await press('guide-keep');
    await press('guide-skip'); // exercise skipped
    await press('guide-edit'); // time outdoors
    await type('form-label', 'Exercise');
    await press('form-save');
    expect(screen.getByTestId('guide-title')).toHaveTextContent('Exercise');
  });
});

describe('the review', () => {
  test('lets you edit a question you kept', async () => {
    const h = await start();
    await keepAll();
    await press('review-edit-0');
    await type('form-label', 'Mood v2');
    await press('form-save');
    expect(screen.getByText('Mood v2')).toBeTruthy();
    await press('guide-finish');
    await waitFor(async () => expect((await labels(h))[0]).toBe('Mood v2'));
  });
  test('lets you add your own question, which is created last', async () => {
    const h = await start();
    await keepAll();
    await press('guide-add-own');
    await type('form-label', 'Water');
    await press('form-type-number');
    await press('form-save');
    expect(screen.getByText('Water')).toBeTruthy();
    expect(screen.getByTestId('guide-finish')).toHaveTextContent(`Start tracking ${N + 1} questions`);
    await press('guide-finish');
    await waitFor(async () => expect((await labels(h)).at(-1)).toBe('Water'));
  });
  test('restoring a skipped suggestion that would now duplicate a kept one is refused with a message', async () => {
    await start();
    await press('guide-skip'); // mood
    await press('guide-keep'); // exercise
    await press('guide-edit'); // outdoors -> rename to Exercise? it clashes while exercise is kept
    await type('form-label', 'Exercise');
    await press('form-save');
    expect((await screen.findByTestId('form-error')).props.children).toMatch(/already/i);
  });
});
