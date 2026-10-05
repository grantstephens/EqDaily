import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { strToU8, zipSync } from 'fflate';

import { exportBundle, importBundle } from '../csv/bundle';
import { makeHarness } from '../testing/harness';
import { ThemeProvider } from '../ThemeContext';
import { SettingsScreen } from './Settings';

jest.mock('../platform/files', () => ({ pickBundle: jest.fn(), saveBundle: jest.fn(async (name: string) => name) }));
jest.mock('../platform/confirm', () => ({ notify: jest.fn(async () => {}), confirm: jest.fn(async () => true) }));
jest.mock('../platform/onboarding', () => ({ getOnboarded: jest.fn(async () => true), setOnboarded: jest.fn(async () => {}) }));
jest.mock('../platform/themePreference', () => ({ getThemeMode: jest.fn(async () => null), setThemeMode: jest.fn(async () => {}) }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const files = require('../platform/files') as { pickBundle: jest.Mock; saveBundle: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { notify } = require('../platform/confirm') as { notify: jest.Mock };

beforeEach(() => { files.pickBundle.mockReset(); files.saveBundle.mockClear(); notify.mockClear(); });

async function openWithData() {
  const h = await makeHarness();
  const q = await h.store.addQuestion({ label: 'Mood', type: 'scale', config: { min: 0, max: 10 }, hideFromInsights: false });
  await h.store.setAnswer('2026-10-01', q.id, 4);
  await h.store.setAnswer('2026-10-02', q.id, 6);
  await render(h.wrap(<ThemeProvider><SettingsScreen /></ThemeProvider>));
  return { ...h, q };
}

test('shows what is stored', async () => {
  await openWithData();
  await screen.findByText('1 question · 2 answers · since 1 Oct 2026');
});

test('export hands a re-importable bundle to saveBundle under a dated name', async () => {
  await openWithData();
  await fireEvent.press(await screen.findByTestId('export-button'));
  await waitFor(() => expect(files.saveBundle).toHaveBeenCalled());
  const [name, bytes] = files.saveBundle.mock.calls[0]!;
  expect(name).toBe('eqdaily-2026-10-05.zip');
  const fresh = await makeHarness();
  const r = await importBundle(fresh.store, bytes, false);
  expect(r).toMatchObject({ errors: [], questionsAdded: 1, answersAdded: 2 });
});

test('importing a valid bundle writes the data and reports a receipt', async () => {
  const source = await openWithData();
  const bytes = await exportBundle(source.store);
  const h = await makeHarness();
  await render(h.wrap(<ThemeProvider><SettingsScreen /></ThemeProvider>));
  files.pickBundle.mockResolvedValue({ name: 'x.zip', bytes });
  await fireEvent.press((await screen.findByTestId('import-button')));
  await waitFor(() => expect(notify).toHaveBeenCalledWith('Import complete', 'Added 2 answers and 1 question, skipped 0.'));
  expect((await h.store.listQuestions()).map((q) => q.label)).toEqual(['Mood']);
});

test('a malformed bundle reports row-numbered errors and changes nothing', async () => {
  const h = await makeHarness();
  await render(h.wrap(<ThemeProvider><SettingsScreen /></ThemeProvider>));
  const bad = zipSync({
    'questions.csv': strToU8('label,type,config_json,sort,archived\nMood,scale,"{""min"":0,""max"":10}",0,\n'),
    'answers.csv': strToU8('date,question,type,value,updated\n2026-02-30,Mood,scale,5,2026-10-01T00:00:00Z\n'),
  });
  files.pickBundle.mockResolvedValue({ name: 'bad.zip', bytes: bad });
  await fireEvent.press((await screen.findByTestId('import-button')));
  await waitFor(() => expect(notify).toHaveBeenCalled());
  const [title, body] = notify.mock.calls[0]!;
  expect(title).toMatch(/nothing was changed/i);
  expect(body).toMatch(/answers\.csv row 2: invalid date/);
  expect(await h.store.listQuestions({ includeArchived: true })).toEqual([]);
});

test('a cancelled pick does nothing and says nothing', async () => {
  await openWithData();
  files.pickBundle.mockResolvedValue(null);
  await fireEvent.press((await screen.findByTestId('import-button')));
  await new Promise((r) => setTimeout(r, 20));
  expect(notify).not.toHaveBeenCalled();
});

test('the overwrite switch is passed through to the import', async () => {
  const h = await openWithData();
  const bytes = await exportBundle(h.store);
  await h.store.setAnswer('2026-10-01', h.q.id, 9);
  files.pickBundle.mockResolvedValue({ name: 'x.zip', bytes });
  await fireEvent.press((await screen.findByTestId('import-button')));
  await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  expect((await h.store.getAnswers('2026-10-01'))[0]!.value).toBe(9);
  await fireEvent(screen.getByTestId('overwrite-switch'), 'valueChange', true);
  await fireEvent.press(screen.getByTestId('import-button'));
  await waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
  expect((await h.store.getAnswers('2026-10-01'))[0]!.value).toBe(4);
});

test('manage questions opens the editor and back returns', async () => {
  await openWithData();
  await fireEvent.press(await screen.findByTestId('manage-questions'));
  await screen.findByTestId('add-question');
  await fireEvent.press(screen.getByTestId('editor-back'));
  await screen.findByTestId('manage-questions');
});
