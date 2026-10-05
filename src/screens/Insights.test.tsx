import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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
