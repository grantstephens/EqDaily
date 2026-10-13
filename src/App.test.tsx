import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import App from './App';
import { SqliteStore } from './storage/SqliteStore';
import { openNodeSqlite } from './storage/nodeSqlite';

jest.mock('./storage/openStore');
jest.mock('./platform/onboarding', () => ({ getOnboarded: jest.fn(async () => true), setOnboarded: jest.fn(async () => {}) }));
jest.mock('./platform/themePreference', () => ({ getThemeMode: jest.fn(async () => null), setThemeMode: jest.fn(async () => {}) }));
jest.mock('./platform/analytics', () => ({ trackScreenView: jest.fn(async () => {}), getAnalyticsEnabled: jest.fn(async () => false), setAnalyticsEnabled: jest.fn(async () => {}) }));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { trackScreenView } = require('./platform/analytics') as { trackScreenView: jest.Mock };
beforeEach(() => trackScreenView.mockClear());
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { openStore } = require('./storage/openStore') as { openStore: jest.Mock };

test('shows the three tabs once the store opens', async () => {
  openStore.mockResolvedValue(await SqliteStore.open(openNodeSqlite(':memory:')));
  await render(<App />);
  // By testID: a text query for "Today" would be ambiguous the moment a screen draws that word.
  await waitFor(() => expect(screen.getByTestId('tab-Today')).toBeTruthy());
  expect(screen.getByTestId('tab-Insights')).toBeTruthy();
  expect(screen.getByTestId('tab-Settings')).toBeTruthy();
});

test('renders an error screen, not a blank one, when the store will not open', async () => {
  openStore.mockRejectedValue(new Error('disk is on fire'));
  await render(<App />);
  await waitFor(() => expect(screen.getByText(/couldn't open its database/i)).toBeTruthy());
  expect(screen.getByText(/disk is on fire/)).toBeTruthy();
});

test('switching tabs shows each screen', async () => {
  openStore.mockResolvedValue(await SqliteStore.open(openNodeSqlite(':memory:')));
  await render(<App />);
  await screen.findByText(/No questions yet/);
  await fireEvent.press(screen.getByTestId('tab-Insights'));
  await screen.findByText(/Nothing to show yet/);
  await fireEvent.press(screen.getByTestId('tab-Settings'));
  await screen.findByTestId('manage-questions');
});

test('reports each screen once as you move between tabs', async () => {
  openStore.mockResolvedValue(await SqliteStore.open(openNodeSqlite(':memory:')));
  await render(<App />);
  await screen.findByText(/No questions yet/);
  await waitFor(() => expect(trackScreenView).toHaveBeenCalledWith('Today'));
  await fireEvent.press(screen.getByTestId('tab-Insights'));
  await waitFor(() => expect(trackScreenView).toHaveBeenCalledWith('Insights'));
  await fireEvent.press(screen.getByTestId('tab-Insights')); // same tab again
  expect(trackScreenView.mock.calls.map((c) => c[0])).toEqual(['Today', 'Insights']);
});
