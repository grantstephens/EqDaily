// src/components/charts/Heatmap.test.tsx
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';

import { Heatmap } from './Heatmap';

const range = (from: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const t = new Date(`${from}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + i);
    return t.toISOString().slice(0, 10);
  });
const wrap = (ui: React.ReactElement) => <PaperProvider theme={MD3LightTheme}>{ui}</PaperProvider>;
const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

const dates = range('2026-09-07', 35); // Mon 7 Sep .. Sun 11 Oct

test('every day gets a labelled cell, so a screen reader hears the date and the answer', async () => {
  await render(wrap(<Heatmap dates={dates} values={new Map([['2026-10-07', true]])} mode="yesno" />));
  expect(screen.getByTestId('heat-2026-10-07').props.accessibilityLabel).toBe('Wed 7 Oct 2026: yes');
  expect(screen.getByTestId('heat-2026-10-08').props.accessibilityLabel).toBe('Thu 8 Oct 2026: skipped');
  for (const d of dates) expect(screen.getByTestId(`heat-${d}`)).toBeTruthy();
});

test('yes is filled, no is a different fill, and skipped is only an outline (never the "no" look)', async () => {
  const values = new Map<string, boolean | number>([['2026-10-06', true], ['2026-10-07', false]]);
  await render(wrap(<Heatmap dates={dates} values={values} mode="yesno" />));
  const yes = style('heat-2026-10-06');
  const no = style('heat-2026-10-07');
  const skipped = style('heat-2026-10-08');
  expect(yes.backgroundColor).toBe(MD3LightTheme.colors.primary);
  expect(no.backgroundColor).toBe(MD3LightTheme.colors.surfaceVariant);
  expect(no.backgroundColor).not.toBe(yes.backgroundColor);
  expect(skipped.backgroundColor).toBe('transparent');
  expect(skipped.borderWidth).toBeGreaterThan(0);
  expect(no.borderWidth ?? 0).toBe(0);
});

test('slider cells get darker as the value rises, and the labels carry the number', async () => {
  const values = new Map<string, boolean | number>([['2026-10-05', 1], ['2026-10-06', 5], ['2026-10-07', 10]]);
  await render(wrap(<Heatmap dates={dates} values={values} mode="scale" min={1} max={10} />));
  const alpha = (id: string) => Number(/, ([\d.]+)\)$/.exec(style(id).backgroundColor as string)![1]);
  expect(alpha('heat-2026-10-05')).toBeLessThan(alpha('heat-2026-10-06'));
  expect(alpha('heat-2026-10-06')).toBeLessThan(alpha('heat-2026-10-07'));
  expect(screen.getByTestId('heat-2026-10-06').props.accessibilityLabel).toBe('Tue 6 Oct 2026: 5');
});

test('a slider with min equal to max still renders without crashing', async () => {
  await render(wrap(<Heatmap dates={dates} values={new Map([['2026-10-05', 3]])} mode="scale" min={3} max={3} />));
  expect(screen.getByTestId('heat-2026-10-05')).toBeTruthy();
});

test('a long history renders all its cells and stays quick', async () => {
  const long = range('2025-10-12', 365);
  const t0 = Date.now();
  await render(wrap(<Heatmap dates={long} values={new Map()} mode="yesno" />));
  expect(screen.getAllByTestId(/^heat-/)).toHaveLength(365);
  expect(Date.now() - t0).toBeLessThan(3000);
});

test('shows a legend explaining the cells', async () => {
  await render(wrap(<Heatmap dates={dates} values={new Map()} mode="yesno" />));
  expect(screen.getByTestId('heatmap-legend')).toHaveTextContent(/yes/i);
  expect(screen.getByTestId('heatmap-legend')).toHaveTextContent(/skipped/i);
});
