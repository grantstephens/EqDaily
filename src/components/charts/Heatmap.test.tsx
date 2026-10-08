// src/components/charts/Heatmap.test.tsx
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { DarkTheme, LightTheme } from '../../theme';

import { Heatmap } from './Heatmap';

const range = (from: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => {
    const t = new Date(`${from}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + i);
    return t.toISOString().slice(0, 10);
  });
const MD3LightTheme = LightTheme;
const wrap = (ui: React.ReactElement, theme = LightTheme) => <PaperProvider theme={theme}>{ui}</PaperProvider>;

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
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
  expect(no.backgroundColor).toBe(MD3LightTheme.colors.outline);
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

test.each([['light', LightTheme], ['dark', DarkTheme]] as const)(
  'in %s mode "no" is clearly visible on the card and clearly different from yes, and skipped is a quieter ring',
  async (_name, theme) => {
    const values = new Map<string, boolean | number>([['2026-10-06', true], ['2026-10-07', false]]);
    await render(wrap(<Heatmap dates={dates} values={values} mode="yesno" />, theme));
    const no = style('heat-2026-10-07');
    const yes = style('heat-2026-10-06');
    const skipped = style('heat-2026-10-08');
    const card = theme.colors.elevation.level1;
    expect(contrast(no.backgroundColor as string, card)).toBeGreaterThanOrEqual(3);
    expect(contrast(no.backgroundColor as string, yes.backgroundColor as string)).toBeGreaterThanOrEqual(1.5);
    expect(contrast(skipped.borderColor as string, card)).toBeLessThan(contrast(no.backgroundColor as string, card));
    expect(skipped.borderColor).not.toBe(no.backgroundColor);
    expect(skipped.borderWidth).toBeGreaterThanOrEqual(1.5);
  },
);

test('a screen reader gets one summary for the whole calendar, not a stop per day', async () => {
  const values = new Map<string, boolean | number>([['2026-10-06', true], ['2026-10-07', false]]);
  await render(wrap(<Heatmap dates={dates} values={values} mode="yesno" />));
  const root = screen.getByTestId('heatmap');
  expect(root.props.accessible).toBe(true);
  expect(root.props.accessibilityLabel).toBe('Calendar of 35 days: 1 yes, 1 no, 33 skipped');
  expect(screen.getByTestId('heat-2026-10-06').props.accessible).toBe(false);
});

test('the month row has room past the last column so a label there is not clipped', async () => {
  await render(wrap(<Heatmap dates={dates} values={new Map()} mode="yesno" />));
  expect(StyleSheet.flatten(screen.getByTestId('heatmap-months', { includeHiddenElements: true }).props.style).width).toBeGreaterThanOrEqual(5 * 17 + 20);
});

test('a multi-year history only draws the most recent year', async () => {
  const long = range('2022-01-01', 1500);
  await render(wrap(<Heatmap dates={long} values={new Map()} mode="yesno" />));
  expect(screen.getAllByTestId(/^heat-\d/)).toHaveLength(366);
  expect(screen.getByTestId('heat-2026-02-08')).toBeTruthy(); // last of the 1500 days
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
