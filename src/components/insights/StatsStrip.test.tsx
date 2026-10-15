import { render, screen } from '@testing-library/react-native';
import React from 'react';

import type { WeeklySummary } from '../../domain/weekly';
import { StatsStrip } from './StatsStrip';

const move = { questionId: 1, label: 'Mood', text: 'Mood up 1.0', magnitude: 0.1 };
const week = (over: Partial<WeeklySummary> = {}): WeeklySummary => ({
  logged: { current: 7, previous: 5 }, possible: { current: 7, previous: 7 }, moves: [], ...over,
});
const show = (streak: { current: number; best: number }, w: WeeklySummary) =>
  render(<StatsStrip streak={streak} week={w} />);

test('the windows are named for what they are, rolling 7 days', async () => {
  await show({ current: 3, best: 9 }, week());
  expect(screen.getByTestId('week-logged')).toHaveTextContent('Last 7 days: 7 of 7 days logged (7 days before: 5 of 7)');
});

test('a partial earlier window is not shown as a ratio like "3 of 3"', async () => {
  await show({ current: 3, best: 9 }, week({ logged: { current: 7, previous: 3 }, possible: { current: 7, previous: 3 } }));
  expect(screen.getByTestId('week-logged')).toHaveTextContent(/^Last 7 days: 7 of 7 days logged$/);
});

test('moves are headed by the window they are compared with', async () => {
  await show({ current: 3, best: 9 }, week({ moves: [move] }));
  expect(screen.getByText('Compared with the 7 days before')).toBeTruthy();
});

test('moves against a partial window say "your earlier days"', async () => {
  await show({ current: 3, best: 9 }, week({ possible: { current: 7, previous: 3 }, moves: [move] }));
  expect(screen.getByText('Compared with your earlier days')).toBeTruthy();
});

test('best streak is shown when it beats the current one', async () => {
  await show({ current: 3, best: 9 }, week());
  expect(screen.getByTestId('streak-best')).toHaveTextContent('Best: 9 days');
});

test('when the current streak is the best, it says so instead of repeating the number', async () => {
  await show({ current: 10, best: 10 }, week());
  expect(screen.getByTestId('streak-best')).toHaveTextContent('Your best so far');
  expect(screen.getByTestId('streak-best')).not.toHaveTextContent('10');
});

test('a 1-day streak that is also the best is not called a record', async () => {
  await show({ current: 1, best: 1 }, week());
  expect(screen.queryByTestId('streak-best')).toBeNull();
});
