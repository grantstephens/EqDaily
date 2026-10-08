# EqDaily — Agent guidance

Guidance for coding agents working in this repository.

## What this is

An offline daily check-in app (React Native + Expo, Android and web). The user defines
their own questions (slider, number, yes/no, text, checkboxes, single choice, time); Today
records one set of answers per calendar day and Insights summarises them.

Design specs and plans live under `docs/` in the local working tree and are deliberately
**not committed** (`docs/` is gitignored). Do not link to them from published docs.

## Expo version

Expo SDK **57**. Read https://docs.expo.dev/versions/v57.0.0/ before writing Expo API code.

## Commands

```bash
make check                          # tsc --noEmit && jest
npx jest src/domain/stats.test.ts   # one file
npm run web                         # browser build
```

## Architecture

Layered, dependencies pointing inward. Only `App.tsx` imports from `src/screens`.

| Directory | Role |
|---|---|
| `src/domain` | Pure logic, no React/Expo: dates, the question model and validation (`question.ts`), lock rules, answer normalisation (`planAnswerWrite`), option ranking, time maths, stepping, statistics (`stats.ts`), Patterns (`patterns.ts`, `patternStats.ts`), streaks and the weekly summary (`streaks.ts`, `weekly.ts`), starter templates and the setup-guide state machine (`guide.ts`), import planning, and the `Store` interface. Runs in plain Node Jest. |
| `src/storage` | `SqliteStore` (Android, via the `SqlDatabase` seam: `expo-sqlite` on device, `node:sqlite` in tests) and `IndexedDbStore` (web), both held to one behavioural contract (`storeContract.ts`) run against each. |
| `src/csv` | `bundle.ts` zips `questions.csv` + `answers.csv`; `values.ts` encodes answer values; `format.ts` is the RFC 4180 reader/writer. |
| `src/platform` | Per-target shims chosen by Metro's extension: file pick/save (bytes), dialogs, app foreground/background, theme preference, onboarding flag. |
| `src/components` | `inputs/` (one component per question type + `AnswerInput` dispatcher), `charts/` (`chartGeometry.ts` and `heatmapGeometry.ts` are pure and unit-tested; `Heatmap` is the calendar view), `insights/`. |
| `src/screens` | Today, Insights, Settings, QuestionEditor/Form, SetupGuide (first-launch stepper over `domain/guide.ts`). |
| `src/testing/harness.tsx` | A real `SqliteStore` on in-memory SQLite plus providers, for screen tests. |

### Invariants worth not breaking

- **Skipped is not "no".** A skipped question has no `answer` row. Statistics only ever
  see answered days; coverage ("n of m") carries the rest. `setAnswer(…, null)` deletes the row.
  An empty checkbox array `[]` *is* an answer ("none today").
- **Locks.** Type, and scale/number `min`/`max`, cannot change once a question has any
  answer (`lockViolation`, enforced in both stores' `updateQuestion`).
- **Uniqueness.** `label.trim().toLowerCase() + '|' + type` is unique across all questions,
  archived included. Import matches on the same key.
- **Writes serialise.** Autosave fires overlapping writes. `SqliteStore` chains every
  operation; `IndexedDbStore` relies on one transaction per method. Never await a
  non-IndexedDB promise inside an IndexedDB transaction.
- **Option usage counts days, not saves.** `planAnswerWrite` diffs previous vs new answer;
  `option_usage.count` is the number of day-answers containing the option. `hidden` is set by
  `hideOption` and cleared when the option is used again.
- **Option text never contains `|`** (the CSV checkbox separator), is trimmed, non-empty,
  ≤ 60 chars.
- **Import is all-or-nothing.** The whole bundle is parsed and validated first; any error
  returns every error and writes nothing; `applyImport` is one transaction (and, on web,
  aborts the IndexedDB transaction on a synchronous throw).
- **Dates** are `"YYYY-MM-DD"` strings built only via `parseDate`/`today`/`addDays`;
  arithmetic is in UTC; `today()` reads local fields. Timestamps are RFC3339 UTC.
- **Nothing crashes on a user's device.** Store methods reject; screens `notify()`. A failed
  database open renders an error screen.
- **No network, no Android permissions.** All five injectable permissions (including
  `INTERNET`) are in `android.blockedPermissions`. Verify a real build with
  `aapt dump permissions <apk>`.

### Testing gotchas

- The Jest `logic` project is pinned to `TZ=America/Los_Angeles` (a negative offset, on
  purpose — a positive one hides local-time leaks in date code). Don't change it.
- In screen tests, `await` every `fireEvent` and `await render`; an un-awaited one corrupts
  React's act bookkeeping and later renders come out empty.
- `jest.mock` factories may only reference variables prefixed `mock`.
- Screen tests that render Settings need `ThemeProvider` (it calls `useTheme`).
- Install dependencies with `npm ci` from the lockfile; plain `npm install` hits an
  `ERESOLVE` on `@react-native/jest-preset`.

## Assets

The icon is an "Eq" monogram built from plain geometry (rects, a ring, a polyline — no fonts to
outline): a white capital E and lowercase q on vivid indigo (`#4326D9`), with the q's descender
turning into an amber rising line graph. `assets/icon.svg` is the full-bleed source;
`icon-foreground.svg` (transparent) and `icon-monochrome.svg` are the Android adaptive layers —
the background is a flat `backgroundColor` in `app.json`, not an image. Keep the mark inside the
central ~60% so the adaptive-icon crop never clips it.

Regenerate every raster after changing an SVG:

```bash
cd assets
rsvg-convert -w 1024 -h 1024 icon.svg -o icon.png
rsvg-convert -w 1024 -h 1024 icon-foreground.svg -o splash-icon.png
rsvg-convert -w 1024 -h 1024 icon-foreground.svg -o android-icon-foreground.png
rsvg-convert -w 1024 -h 1024 icon-monochrome.svg -o android-icon-monochrome.png
rsvg-convert -w 48 -h 48 icon.svg -o favicon.png
```
