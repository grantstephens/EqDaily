import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { addDays } from '../domain/date';
import type { NewQuestion } from '../domain/question';
import { makeHarness } from '../testing/harness';
import { InsightsScreen } from './Insights';

const q = (label: string, type: any, config: any, extra: object = {}): NewQuestion =>
  ({ label, type, config, hideFromInsights: false, ...extra });

async function seeded() {
  const h = await makeHarness();
  const s = h.store;
  const mood = await s.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  const ex = await s.addQuestion(q('Exercise', 'yesno', {}));
  const sym = await s.addQuestion(q('Symptoms', 'checkboxes', { options: ['Headache', 'Asthma'], allowOther: true }));
  const bed = await s.addQuestion(q('Bedtime', 'time', {}));
  const thx = await s.addQuestion(q('Thankful', 'text', { multiline: true, showFrequent: true }));
  const days = ['2026-10-01', '2026-10-03', '2026-10-04'];
  for (const [i, v] of [4, 8, 6].entries()) await s.setAnswer(days[i]!, mood.id, v);
  await s.setAnswer(days[0]!, ex.id, true);
  await s.setAnswer(days[1]!, ex.id, true);
  await s.setAnswer(days[2]!, ex.id, false);
  await s.setAnswer(days[0]!, sym.id, ['Headache']);
  await s.setAnswer(days[1]!, sym.id, ['Headache', 'Asthma']);
  await s.setAnswer(days[2]!, sym.id, []);
  await s.setAnswer(days[0]!, bed.id, '23:30');
  await s.setAnswer(days[1]!, bed.id, '00:30');
  await s.setAnswer(days[0]!, thx.id, 'family, coffee');
  await s.setAnswer(days[1]!, thx.id, 'Family');
  return h;
}

test('cards show coverage, averages, % yes, rankings, average time and frequent phrases', async () => {
  const h = await seeded();
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText('Mood');
  expect(screen.getAllByText('3 of 30 days answered').length).toBeGreaterThanOrEqual(3);
  expect(screen.getByText('6.0')).toBeTruthy();
  expect(screen.getByText('67% yes')).toBeTruthy();
  expect(screen.getByText('2 · 67%')).toBeTruthy();
  expect(screen.getByText('1 · 33%')).toBeTruthy();
  expect(screen.getByText('Average 00:00')).toBeTruthy();
  expect(screen.getByText('family (2×)')).toBeTruthy();
});

test('switching to 7 days changes the denominator', async () => {
  const h = await seeded();
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText('Mood');
  await fireEvent.press(screen.getByTestId('range-7'));
  await screen.findAllByText('3 of 7 days answered');
});

test('with nothing answered the empty state shows', async () => {
  const h = await makeHarness();
  await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText(/Nothing to show yet/);
});

test('a question with no answers in the period says so instead of crashing', async () => {
  const h = await makeHarness();
  const m = await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  await h.store.setAnswer('2026-01-01', m.id, 3);
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText('No answers in this period.');
  await fireEvent.press(screen.getByTestId('range-all'));
  await screen.findByText('1 of 278 days answered');
});

test('hidden and archived questions get no card', async () => {
  const h = await makeHarness();
  const a = await h.store.addQuestion(q('Visible', 'yesno', {}));
  const b = await h.store.addQuestion(q('Hidden', 'yesno', {}, { hideFromInsights: true }));
  const c = await h.store.addQuestion(q('Archived', 'yesno', {}));
  for (const x of [a, b, c]) await h.store.setAnswer('2026-10-04', x.id, true);
  await h.store.setArchived(c.id, true);
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText('Visible');
  expect(screen.queryByText('Hidden')).toBeNull();
  expect(screen.queryByText('Archived')).toBeNull();
});

test('change versus the previous period is shown', async () => {
  const h = await makeHarness();
  const m = await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  await h.store.setAnswer('2026-10-04', m.id, 7);
  await h.store.setAnswer('2026-09-25', m.id, 5);
  await render(h.wrap(<InsightsScreen />));
  await fireEvent.press(await screen.findByTestId('range-7'));
  await screen.findByText('▲ 2.0');
});

test('a change that rounds to zero reads "no change", not "▲ 0.0"', async () => {
  const h = await makeHarness();
  const m = await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  await h.store.setAnswer('2026-10-04', m.id, 7);
  await h.store.setAnswer('2026-09-25', m.id, 6.98);
  await render(h.wrap(<InsightsScreen />));
  await fireEvent.press(await screen.findByTestId('range-7'));
  await screen.findByText('no change');
  expect(screen.queryByText(/▲/)).toBeNull();
});

test('left open past midnight, the window moves on without a foreground event', async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  try {
    let clock = new Date(2026, 9, 5, 23, 58);
    const h = await makeHarness(() => clock);
    const m = await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
    await h.store.setAnswer('2026-10-06', m.id, 5);
    await h.store.setAnswer('2026-10-05', m.id, 5);
    await render(h.wrap(<InsightsScreen />));
    await screen.findByText('1 of 30 days answered');
    clock = new Date(2026, 9, 6, 0, 2);
    await act(async () => { jest.advanceTimersByTime(61000); });
    await screen.findByText('2 of 30 days answered');
  } finally {
    jest.useRealTimers();
  }
});

async function seededPatterns() {
  const h = await makeHarness(); // "now" is 2026-10-05
  const s = h.store;
  const mood = await s.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  const ex = await s.addQuestion(q('Exercise', 'yesno', {}));
  for (let i = 0; i < 28; i++) {
    const day = addDays('2026-10-05', -i);
    const yes = i % 2 === 0;
    await s.setAnswer(day, ex.id, yes);
    await s.setAnswer(day, mood.id, (yes ? 8 : 5) + (((i * 7) % 5) - 2) * 0.2);
  }
  return h;
}

test('Patterns card states a finding in plain English, with the charts still below it', async () => {
  const h = await seededPatterns();
  await render(h.wrap(<InsightsScreen />));
  const finding = await screen.findByTestId('pattern-0');
  expect(finding).toHaveTextContent(/Exercise was Yes, Mood averages/);
  expect(screen.getByTestId('patterns-note')).toHaveTextContent('Patterns are hints, not proof.');
  expect(screen.getAllByText(/of 30 days answered/).length).toBe(2); // both existing cards still render
});

test('with only a few days of data the card asks the user to keep logging', async () => {
  const h = await seeded();
  await render(h.wrap(<InsightsScreen />));
  expect(await screen.findByTestId('patterns-insufficient')).toHaveTextContent(/Keep logging/);
});

test('a short range still finds patterns by falling back to all data', async () => {
  const h = await seededPatterns();
  await render(h.wrap(<InsightsScreen />));
  await screen.findByTestId('pattern-0');
  expect(screen.queryByTestId('patterns-all-data')).toBeNull();
  await fireEvent.press(screen.getByTestId('range-7'));
  expect(await screen.findByTestId('patterns-all-data')).toHaveTextContent(/all your data/i);
});

test('no questions at all shows the empty message and no Patterns card', async () => {
  const h = await makeHarness();
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText(/Nothing to show yet/);
  expect(screen.queryByTestId('patterns-card')).toBeNull();
});

test('only yes/no questions: explains what Patterns needs instead of "keep logging"', async () => {
  const h = await makeHarness();
  const a1 = await h.store.addQuestion(q('Exercise', 'yesno', {}));
  const a2 = await h.store.addQuestion(q('Read', 'yesno', {}));
  for (let i = 0; i < 20; i++) {
    const day = addDays('2026-10-05', -i);
    await h.store.setAnswer(day, a1.id, i % 2 === 0);
    await h.store.setAnswer(day, a2.id, i % 3 === 0);
  }
  await render(h.wrap(<InsightsScreen />));
  expect(await screen.findByTestId('patterns-incomparable')).toHaveTextContent(/yes\/no.*slider/i);
  expect(screen.queryByTestId('patterns-insufficient')).toBeNull();
});

async function seededStreak() {
  const h = await makeHarness(); // now = 2026-10-05
  const s = h.store;
  const mood = await s.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  const ex = await s.addQuestion(q('Exercise', 'yesno', {}));
  // 5 days in a row ending today (5 Oct), a gap, then 3 more days a week earlier
  for (let i = 0; i < 5; i++) {
    const day = addDays('2026-10-05', -i);
    await s.setAnswer(day, mood.id, i < 3 ? 8 : 5);
    await s.setAnswer(day, ex.id, i < 4);
  }
  for (let i = 7; i < 10; i++) {
    const day = addDays('2026-10-05', -i);
    await s.setAnswer(day, mood.id, 4);
    await s.setAnswer(day, ex.id, true);
  }
  return h;
}

test('the strip shows the current and best streak, days logged this week, and what moved', async () => {
  const h = await seededStreak();
  await render(h.wrap(<InsightsScreen />));
  expect(await screen.findByTestId('streak-current')).toHaveTextContent(/5-day streak/);
  expect(screen.getByTestId('streak-best')).toHaveTextContent(/best/i);
  expect(screen.getByTestId('week-logged')).toHaveTextContent(/5 of 7 days logged/);
  expect(screen.getByTestId('week-logged')).toHaveTextContent(/last week 3 of 3/);
});

test('a yes/no card says how many days in a row, only when it is 2 or more', async () => {
  const h = await seededStreak();
  await render(h.wrap(<InsightsScreen />));
  expect(await screen.findByTestId('yes-streak')).toHaveTextContent(/4 days in a row/);
});

test('the strip is not shown when there is nothing yet', async () => {
  const h = await makeHarness();
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText(/Nothing to show yet/);
  expect(screen.queryByTestId('streak-current')).toBeNull();
});

test('with no streak right now, the strip says so rather than showing 0', async () => {
  const h = await makeHarness();
  const mood = await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  await h.store.setAnswer('2026-09-20', mood.id, 5);
  await render(h.wrap(<InsightsScreen />));
  expect(await screen.findByTestId('streak-current')).toHaveTextContent(/no streak/i);
});

test('a brand-new user is not compared with a week before they started', async () => {
  const h = await makeHarness(); // now = 2026-10-05
  const mood = await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  await h.store.setAnswer('2026-10-05', mood.id, 7);
  await render(h.wrap(<InsightsScreen />));
  expect(await screen.findByTestId('week-logged')).toHaveTextContent(/1 of 1 days? logged/);
  expect(screen.getByTestId('week-logged')).not.toHaveTextContent(/last week/);
});

test('after more than two weeks away the strip does not say "0 of 7 (last week 0)"', async () => {
  const h = await makeHarness();
  const mood = await h.store.addQuestion(q('Mood', 'scale', { min: 0, max: 10 }));
  await h.store.setAnswer('2026-08-01', mood.id, 5);
  await render(h.wrap(<InsightsScreen />));
  expect(await screen.findByTestId('week-logged')).toHaveTextContent(/Nothing logged in the last 14 days/);
  expect(screen.getByTestId('week-logged')).not.toHaveTextContent(/0 of 7/);
});

test('yes/no and slider cards get a heatmap on a 30-day range, with the existing charts kept', async () => {
  const h = await seededPatterns(); // 28 days of Mood + Exercise, now = 2026-10-05
  await render(h.wrap(<InsightsScreen />));
  await screen.findAllByTestId('heatmap');
  expect(screen.getAllByTestId('heatmap')).toHaveLength(2); // Mood (slider) and Exercise (yes/no)
  expect(screen.getAllByTestId('heat-2026-10-05')[0]!.props.accessibilityLabel).toMatch(/Mon 5 Oct 2026: /); // one per heatmap
  expect(screen.getAllByText(/of 30 days answered/)).toHaveLength(2); // cards unchanged
});

test('a 7-day range has no heatmap', async () => {
  const h = await seededPatterns();
  await render(h.wrap(<InsightsScreen />));
  await screen.findAllByTestId('heatmap');
  await fireEvent.press(screen.getByTestId('range-7'));
  await screen.findAllByText(/of 7 days answered/);
  expect(screen.queryByTestId('heatmap')).toBeNull();
});

test('number, time, checkbox and text cards never get a heatmap', async () => {
  const h = await makeHarness();
  const water = await h.store.addQuestion(q('Water', 'number', { decimals: 0 }));
  const bed = await h.store.addQuestion(q('Bedtime', 'time', {}));
  for (let i = 0; i < 30; i++) {
    const day = addDays('2026-10-05', -i);
    await h.store.setAnswer(day, water.id, 4 + (i % 3));
    await h.store.setAnswer(day, bed.id, '23:00');
  }
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText('Water');
  expect(screen.queryByTestId('heatmap')).toBeNull();
});

test('the range buttons use short labels that fit a narrow phone, with the full words for screen readers', async () => {
  const h = await seeded();
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText('Mood');
  for (const [id, short, full] of [['7', '7d', '7 days'], ['30', '30d', '30 days'], ['90', '90d', '90 days'], ['all', 'All', 'All time']]) {
    const b = screen.getByTestId(`range-${id}`);
    expect(b).toHaveTextContent(short!);
    expect(b.props.accessibilityLabel).toBe(id === '30' ? `${full}, selected` : full); // 30 days is the default range
  }
});

test('the selected range is spoken as selected, and that follows the choice', async () => {
  const h = await seeded();
  await render(h.wrap(<InsightsScreen />));
  await screen.findByText('Mood');
  expect(screen.getByTestId('range-30').props.accessibilityLabel).toBe('30 days, selected');
  expect(screen.getByTestId('range-7').props.accessibilityLabel).toBe('7 days');
  await fireEvent.press(screen.getByTestId('range-7'));
  await screen.findAllByText('3 of 7 days answered');
  expect(screen.getByTestId('range-7').props.accessibilityLabel).toBe('7 days, selected');
  expect(screen.getByTestId('range-30').props.accessibilityLabel).toBe('30 days');
});
