import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { NewQuestion } from '../domain/question';
import { makeHarness } from '../testing/harness';
import { TEMPLATES } from '../domain/templates';
import { TodayScreen } from './Today';

jest.mock('../platform/onboarding', () => {
  let done = false;
  return {
    getOnboarded: jest.fn(async () => done),
    setOnboarded: jest.fn(async () => { done = true; }),
    __reset: () => { done = false; },
    __set: (v: boolean) => { done = v; },
  };
});
jest.mock('../platform/confirm', () => ({ notify: jest.fn(async () => {}), confirm: jest.fn(async () => true) }));
let mockVisibleCallbacks: (() => void)[] = [];
jest.mock('../platform/lifecycle', () => ({
  onAppHidden: jest.fn(() => () => {}),
  onAppVisible: jest.fn((cb: () => void) => {
    mockVisibleCallbacks.push(cb);
    return () => { mockVisibleCallbacks = mockVisibleCallbacks.filter((c) => c !== cb); };
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const onboarding = require('../platform/onboarding') as { __reset: () => void; __set: (v: boolean) => void };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { notify } = require('../platform/confirm') as { notify: jest.Mock };

beforeEach(() => { onboarding.__reset(); notify.mockClear(); mockVisibleCallbacks = []; });

const yes: NewQuestion = { label: 'Exercise', type: 'yesno', config: {} as never, hideFromInsights: false };
const chk: NewQuestion = { label: 'Symptoms', type: 'checkboxes', config: { options: ['Headache', 'Asthma'], allowOther: true }, hideFromInsights: false };
const mood: NewQuestion = { label: 'Mood', type: 'scale', config: { min: 0, max: 10 }, hideFromInsights: false };

async function open(seed: (h: Awaited<ReturnType<typeof makeHarness>>) => Promise<void> = async () => {}, now?: () => Date) {
  const h = await makeHarness(now);
  onboarding.__set(true);
  await seed(h);
  await render(h.wrap(<TodayScreen />));
  return h;
}

describe('first launch', () => {
  test('the setup guide appears; keeping every suggestion creates them all', async () => {
    const h = await makeHarness();
    await render(h.wrap(<TodayScreen />));
    await fireEvent.press(await screen.findByTestId('guide-start'));
    for (let i = 0; i < TEMPLATES.length; i++) await fireEvent.press(screen.getByTestId('guide-keep'));
    await fireEvent.press(screen.getByTestId('guide-finish'));
    await screen.findByText('Mood');
    expect((await h.store.listQuestions()).map((q) => q.label)).toEqual(TEMPLATES.map((t) => t.question.label));
  });
  test('skipping a suggestion leaves it out', async () => {
    const h = await makeHarness();
    await render(h.wrap(<TodayScreen />));
    await fireEvent.press(await screen.findByTestId('guide-start'));
    await fireEvent.press(screen.getByTestId('guide-skip')); // mood
    for (let i = 1; i < TEMPLATES.length; i++) await fireEvent.press(screen.getByTestId('guide-keep'));
    await fireEvent.press(screen.getByTestId('guide-finish'));
    await screen.findByText('Exercise');
    expect((await h.store.listQuestions()).map((q) => q.label)).not.toContain('Mood');
  });
  test('Start blank shows the empty state and the guide never returns', async () => {
    const h = await makeHarness();
    const view = await render(h.wrap(<TodayScreen />));
    await fireEvent.press(await screen.findByTestId('guide-blank'));
    await screen.findByText(/No questions yet/);
    await view.unmount();
    await render(h.wrap(<TodayScreen />));
    await screen.findByText(/No questions yet/);
    expect(screen.queryByTestId('guide-start')).toBeNull();
  });
});

describe('answering', () => {
  test('answering writes through to the store; Skip removes the row (skipped is not "no")', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(yes); });
    await fireEvent.press(await screen.findByTestId('yesno-no'));
    await waitFor(async () => expect((await h.store.getAnswers('2026-10-05')).map((a) => a.value)).toEqual([false]));
    await fireEvent.press(screen.getByTestId('yesno-skip'));
    await waitFor(async () => expect(await h.store.getAnswers('2026-10-05')).toEqual([]));
  });
  test('counter reflects answered questions', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(yes); await x.store.addQuestion(mood); });
    await screen.findByText('0 of 2 answered');
    await fireEvent.press(screen.getByTestId('yesno-yes'));
    await screen.findByText('1 of 2 answered');
    expect(h).toBeDefined();
  });
  test('a failing save notifies and reverts the UI to what is stored', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(yes); });
    jest.spyOn(h.store, 'setAnswer').mockRejectedValueOnce(new Error('disk full'));
    await fireEvent.press(await screen.findByTestId('yesno-yes'));
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Could not save', 'disk full'));
    await waitFor(() => expect(screen.queryByTestId('yesno-skip')).toBeNull());
  });
  test('two rapid checkbox taps both persist', async () => {
    const h = await open(async (x) => { await x.store.addQuestion(chk); });
    await fireEvent.press(await screen.findByTestId('chip-Headache'));
    await fireEvent.press(screen.getByTestId('chip-Asthma'));
    await waitFor(async () => expect((await h.store.getAnswers('2026-10-05'))[0]?.value).toEqual(['Headache', 'Asthma']));
  });
  test('archived questions do not render', async () => {
    await open(async (x) => {
      const q = await x.store.addQuestion(yes);
      await x.store.addQuestion(mood);
      await x.store.setArchived(q.id, true);
    });
    await screen.findByText('Mood');
    expect(screen.queryByText('Exercise')).toBeNull();
  });
});

describe('date strip', () => {
  test('previous day loads that day; next is disabled on today; answers write to the viewed day', async () => {
    const h = await open(async (x) => {
      const q = await x.store.addQuestion(yes);
      await x.store.setAnswer('2026-10-04', q.id, true);
    });
    await screen.findByText('Mon 5 Oct 2026');
    expect(screen.getByTestId('date-next').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('date-prev'));
    await screen.findByText('Sun 4 Oct 2026');
    await screen.findByText('1 of 1 answered');
    await fireEvent.press(screen.getByTestId('yesno-no'));
    await waitFor(async () => expect((await h.store.getAnswers('2026-10-04'))[0]!.value).toBe(false));
    expect(await h.store.getAnswers('2026-10-05')).toEqual([]);
  });
});

describe('midnight', () => {
  test('returning to the foreground after midnight moves "today" forward', async () => {
    let clock = new Date(2026, 9, 5, 23, 50);
    await open(async (x) => { await x.store.addQuestion(yes); }, () => clock);
    await screen.findByText('Mon 5 Oct 2026');
    clock = new Date(2026, 9, 6, 0, 5);
    await act(async () => { mockVisibleCallbacks.forEach((cb) => cb()); });
    await screen.findByText('Tue 6 Oct 2026');
  });
  test('left open and visible through midnight, today moves on by itself', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      let clock = new Date(2026, 9, 5, 23, 58);
      await open(async (x) => { await x.store.addQuestion(yes); }, () => clock);
      await screen.findByText('Mon 5 Oct 2026');
      clock = new Date(2026, 9, 6, 0, 2);
      await act(async () => { jest.advanceTimersByTime(61000); });
      await screen.findByText('Tue 6 Oct 2026');
    } finally {
      jest.useRealTimers();
    }
  });
  test('but a day the user stepped back to is left alone', async () => {
    let clock = new Date(2026, 9, 5, 23, 50);
    await open(async (x) => { await x.store.addQuestion(yes); }, () => clock);
    await fireEvent.press(await screen.findByTestId('date-prev'));
    await screen.findByText('Sun 4 Oct 2026');
    clock = new Date(2026, 9, 6, 0, 5);
    await act(async () => { mockVisibleCallbacks.forEach((cb) => cb()); });
    expect(screen.getByText('Sun 4 Oct 2026')).toBeTruthy();
  });
});

describe('pending text edit when changing day', () => {
  test('a draft typed on one day is saved to that day, never the day navigated to', async () => {
    const note: NewQuestion = { label: 'Thankful', type: 'text', config: { multiline: false, showFrequent: false }, hideFromInsights: false };
    const h = await open(async (x) => {
      const q = await x.store.addQuestion(note);
      await x.store.setAnswer('2026-10-04', q.id, 'existing yesterday');
    });
    await fireEvent.changeText(await screen.findByTestId('text-input'), 'typed on the 5th');
    await fireEvent.press(screen.getByTestId('date-prev'));
    await screen.findByText('Sun 4 Oct 2026');
    await waitFor(async () => expect((await h.store.getAnswers('2026-10-05')).map((a) => a.value)).toEqual(['typed on the 5th']));
    expect((await h.store.getAnswers('2026-10-04')).map((a) => a.value)).toEqual(['existing yesterday']);
  });
});
