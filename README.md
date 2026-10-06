# EqDaily

A daily check-in for Android and the web where **you** decide the questions. Answer them
once a day, then see how your mood, habits and symptoms move over time.

Everything lives on your device. No account, no sync, no network access, no Android
permissions. Export a backup any time and your data stays yours.

Built with [React Native](https://reactnative.dev) (Expo), targeting Android and the web.

## Using it

Three tabs:

- **Today** — one card per question, saved as you answer. Step back a day with `‹` to
  backfill (future days are not reachable). A question you leave alone is *skipped*, not
  "no": skipped answers are never stored and never counted in any statistic.
- **Insights** — per-question graphs and summaries over 7, 30, 90 days or all time, each
  card showing "n of m days answered" so a figure built on three days doesn't look as
  solid as one built on thirty.
- **Settings** — manage questions, export/import, appearance.

### Question types

| Type | You choose | Insights shows |
|---|---|---|
| Slider | lowest and highest value (and optional step) | line chart, average, change vs the previous period |
| Number | optional min/max, unit, 0–4 decimals | line chart, average, change |
| Yes / No | — | % yes and a dot per day |
| Text | multi-line, show most-frequent entries | recent entries, optionally most frequent phrases |
| Checkboxes | options, allow "Other" | each option as a % of answered days |
| Single choice | options, allow "Other" | distribution |
| Time | — | line chart and average time (bedtimes across midnight are handled) |

Things you type into **Other** are remembered and offered next time (most-used first, the
rest behind "More…"). Remove one in the question editor and it stays out of the list but
your old answers keep it.

A question's **type**, and a slider/number's **min/max**, are locked once it has answers —
changing them would silently rewrite your history. Add a new question instead. Labels,
units, options and order stay editable. Archiving a question hides it but keeps its history.

### Your data

On Android the database lives in the app's private storage, so **uninstalling the app
deletes your answers**. On the web it lives in the browser's IndexedDB, so clearing site
data deletes it. Export a backup from Settings before either.

Export produces `eqdaily-YYYY-MM-DD.zip` containing two CSV files:

`questions.csv`
```csv
label,type,config_json,sort,archived
Mood,scale,"{""min"":1,""max"":10,""hideFromInsights"":false}",0,
```

`answers.csv`
```csv
date,question,type,value,updated
2026-10-05,Mood,scale,7,2026-10-05T18:42:00Z
```

`value` is a number for sliders/numbers, `true`/`false` for yes/no, the text as typed for
text/choice/time (`HH:MM`), and options joined with `|` for checkboxes (empty = "none
today"). Import matches questions by label + type, creates any that are missing, skips
days you already answered unless **Overwrite** is on, and is all-or-nothing: the whole
file is validated first and any problem is reported as `answers.csv row 14: …` with
nothing changed.

## Development

Toolchain is pinned in `mise.toml` (`mise install`). Expo SDK 57.

```bash
make check     # tsc --noEmit && jest — the gate before any commit
make test
make web       # browser build, the no-device iteration story
make android   # Expo dev server, opening on a connected device
```

## Releases

Pushing a tag like `v0.1.0-beta.1` runs `.github/workflows/release.yml`: it runs the tests,
builds a signed APK (arm64 + 32-bit arm) and attaches it to a GitHub Release (a pre-release
when the tag has a `-beta`/`-rc` suffix). Install it directly, or point
[Obtainium](https://github.com/ImranR98/Obtainium) at the repository.

> Every release must be signed with the *same* key or existing users cannot upgrade without
> uninstalling — which deletes their answers. Generate it once, back it up, never commit it.

Signing setup (once):

```bash
openssl req -x509 -newkey rsa:4096 -nodes -keyout key.pem -out cert.pem -days 10000 -subj "/CN=EqDaily"
openssl pkcs12 -export -inkey key.pem -in cert.pem -name eqdaily -out eqdaily.keystore
base64 -w0 eqdaily.keystore | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD   # the export password
gh secret set ANDROID_KEY_PASSWORD        # same value (PKCS12 uses one password)
gh secret set ANDROID_KEY_ALIAS           # eqdaily
```
(`keytool -genkeypair -keystore eqdaily.keystore -storetype PKCS12 -alias eqdaily …` works too.)

## Licence

[GPL-3.0-or-later](LICENSE). If you distribute a modified version, you must publish your
changes under the same licence.
