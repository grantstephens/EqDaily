// src/domain/patterns.test.ts
import { addDays } from './date';
import { buildSignals, describePattern, findPatterns, findPatternsWithFallback, type Pattern } from './patterns';
import type { Answer, Question } from './question';

const base = { hideFromInsights: false, sort: 0, archivedAt: null, created: 'T' };
const mood: Question = { ...base, id: 1, label: 'Mood', type: 'scale', config: { min: 0, max: 10 } };
const ex: Question = { ...base, id: 2, label: 'Exercise', type: 'yesno', config: {} as never };
const sym: Question = { ...base, id: 3, label: 'Symptoms', type: 'checkboxes', config: { options: ['Headache', 'Asthma'], allowOther: true } };
const bed: Question = { ...base, id: 4, label: 'Bedtime', type: 'time', config: {} as never };
const water: Question = { ...base, id: 5, label: 'Water', type: 'number', config: { decimals: 0, unit: 'glasses' } };
const energy: Question = { ...base, id: 6, label: 'Energy', type: 'choice', config: { options: ['Low', 'High'], allowOther: false } };
const note: Question = { ...base, id: 7, label: 'Note', type: 'text', config: { multiline: false, showFrequent: false } };
const a = (q: Question, date: string, value: Answer['value']): Answer => ({ date, questionId: q.id, value, updated: 'T' });
const START = '2026-10-01';
const span = (n: number, from = START) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('buildSignals', () => {
  test('yes/no becomes a binary signal over answered days only', () => {
    const d = span(4);
    const { binary } = buildSignals([ex], [a(ex, d[0]!, true), a(ex, d[1]!, false), a(ex, d[3]!, true)], d);
    expect(binary).toHaveLength(1);
    expect([...binary[0]!.days.entries()]).toEqual([[d[0], true], [d[1], false], [d[3], true]]); // d[2] skipped: absent
  });

  test('answers outside the window are ignored', () => {
    const d = span(3);
    const { binary } = buildSignals([ex], [a(ex, addDays(START, -1), true), a(ex, d[0]!, true)], d);
    expect(binary[0]!.days.size).toBe(1);
  });

  test('scale and number become numeric series; unit comes from a number config', () => {
    const d = span(3);
    const { numeric } = buildSignals([mood, water], [a(mood, d[0]!, 7), a(water, d[1]!, 6)], d);
    expect(numeric.find((s) => s.label === 'Mood')!.values.get(d[0]!)).toBe(7);
    expect(numeric.find((s) => s.label === 'Water')!.unit).toBe('glasses');
  });

  test('a time series uses the wrap-aware scale so 23:30 and 00:30 are an hour apart', () => {
    const d = span(2);
    const { numeric } = buildSignals([bed], [a(bed, d[0]!, '23:30'), a(bed, d[1]!, '00:30')], d);
    const v = numeric[0]!.values;
    expect(Math.abs(v.get(d[1]!)! - v.get(d[0]!)!)).toBe(60);
  });

  test('text questions and hidden questions produce nothing', () => {
    const d = span(3);
    const hidden = { ...ex, id: 9, hideFromInsights: true };
    const out = buildSignals([note, hidden], [a(note, d[0]!, 'hi'), a(hidden, d[0]!, true)], d);
    expect(out.binary).toEqual([]);
    expect(out.numeric).toEqual([]);
  });

  test('an option becomes a signal only when used on at least 5 days', () => {
    const d = span(8);
    const answers = d.map((day, i) => a(sym, day, i < 5 ? ['Headache'] : i === 5 ? ['Asthma'] : []));
    const { binary } = buildSignals([sym], answers, d);
    expect(binary.map((s) => s.option)).toEqual(['Headache']);
  });

  test('an empty checkbox answer counts as "off" (answered), not as skipped', () => {
    const d = span(8);
    const answers = d.map((day, i) => a(sym, day, i < 5 ? ['Headache'] : []));
    const s = buildSignals([sym], answers, d).binary[0]!;
    expect(s.days.size).toBe(8);
    expect(s.days.get(d[7]!)).toBe(false);
    expect(s.days.get(d[0]!)).toBe(true);
  });

  test('a choice option becomes a signal when used on at least 5 days; other answers are "off"', () => {
    const d = span(8);
    const answers = d.map((day, i) => a(energy, day, i < 5 ? 'High' : 'Low'));
    const { binary } = buildSignals([energy], answers, d);
    expect(binary.map((s) => s.option)).toEqual(['High']); // Low used only 3 days
    expect(binary[0]!.days.get(d[6]!)).toBe(false);
  });

  test('a numeric series with at least 10 answers also yields a "high" signal: above its own median', () => {
    const d = span(10);
    const answers = d.map((day, i) => a(mood, day, i + 1)); // 1..10, median 5.5
    const high = buildSignals([mood], answers, d).binary.find((s) => s.derived === 'high')!;
    expect(high.sourceType).toBe('scale');
    expect(high.days.get(d[5]!)).toBe(true); // 6 > 5.5
    expect(high.days.get(d[4]!)).toBe(false); // 5 < 5.5
  });

  test('tied values at the median still split the days (the majority value is "high" when nothing is above it)', () => {
    const d = span(10);
    const answers = d.map((day, i) => a(mood, day, i < 7 ? 8 : 4)); // median is 8: nothing is strictly above it
    const high = buildSignals([mood], answers, d).binary.find((s) => s.derived === 'high')!;
    expect([...high.days.values()].filter(Boolean)).toHaveLength(7);
    expect(high.days.get(d[0]!)).toBe(true);
    expect(high.days.get(d[9]!)).toBe(false);
  });

  test('fewer than 10 numeric answers: no "high" signal', () => {
    const d = span(9);
    const { binary } = buildSignals([mood], d.map((day, i) => a(mood, day, i)), d);
    expect(binary).toEqual([]);
  });

  test('a time series also yields a "later than usual" signal', () => {
    const d = span(10);
    const answers = d.map((day, i) => a(bed, day, `${String(21 + (i % 4)).padStart(2, '0')}:00`));
    const high = buildSignals([bed], answers, d).binary.find((s) => s.derived === 'high')!;
    expect(high.sourceType).toBe('time');
  });
});

// deterministic PRNG so "random" data is reproducible
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const flagsFor = (n: number, seed = 11) => { const r = mulberry32(seed); return Array.from({ length: n }, () => r() < 0.5); };
const jitter = (i: number) => ((i * 7) % 5 - 2) * 0.2; // small deterministic wobble

describe('findPatterns', () => {
  test('a planted same-day effect is found', () => {
    const d = span(40);
    const answers: Answer[] = [];
    const F = flagsFor(d.length);
    d.forEach((day, i) => {
      const yes = F[i]!;
      answers.push(a(ex, day, yes), a(mood, day, (yes ? 8 : 5) + jitter(i)));
    });
    const r = findPatterns([mood, ex], answers, d);
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    const p = r.patterns[0]!;
    expect(p.signal.label).toBe('Exercise');
    expect(p.outcome.label).toBe('Mood');
    expect(p.lag).toBe(0);
    expect(p.onMean).toBeGreaterThan(p.offMean);
    expect(p.onDays + p.offDays).toBe(40);
  });

  test('a planted next-day effect is found with lag 1', () => {
    const d = span(40);
    const answers: Answer[] = [];
    const F = flagsFor(d.length);
    d.forEach((day, i) => {
      const yes = F[i]!;
      answers.push(a(ex, day, yes));
      const prevYes = i > 0 && F[i - 1]!;
      answers.push(a(mood, day, (prevYes ? 8 : 5) + jitter(i)));
    });
    const r = findPatterns([mood, ex], answers, d);
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    expect(r.patterns[0]!.lag).toBe(1);
  });

  test('lag-1 pairing crosses a month boundary using real calendar days', () => {
    const d = span(40, '2026-10-01'); // runs through 1 Nov and beyond
    const answers: Answer[] = [];
    const F = flagsFor(d.length);
    d.forEach((day, i) => {
      const yes = F[i]!;
      answers.push(a(ex, day, yes));
      const prevYes = i > 0 && F[i - 1]!;
      answers.push(a(mood, day, (prevYes ? 8 : 5) + jitter(i)));
    });
    const r = findPatterns([mood, ex], answers, d);
    expect(r.status === 'found' && r.patterns[0]!.lag).toBe(1);
  });

  test('skipped days are never counted as "no"', () => {
    const d = span(40);
    const answers: Answer[] = [];
    d.forEach((day, i) => {
      const yes = i % 2 === 0;
      if (yes) answers.push(a(ex, day, true)); // "no" days are skipped, not answered false
      answers.push(a(mood, day, (yes ? 8 : 5) + jitter(i)));
    });
    // only "yes" days have an answer, so there is no "off" group at all
    expect(findPatterns([mood, ex], answers, d).status).toBe('none');
  });

  test('fewer than 14 paired days is insufficient', () => {
    const d = span(12);
    const answers: Answer[] = [];
    d.forEach((day, i) => answers.push(a(ex, day, i % 2 === 0), a(mood, day, i % 2 === 0 ? 8 : 5)));
    expect(findPatterns([mood, ex], answers, d).status).toBe('insufficient');
  });

  test('fewer than 5 days on one side is insufficient', () => {
    const d = span(30);
    const answers: Answer[] = [];
    d.forEach((day, i) => answers.push(a(ex, day, i < 4), a(mood, day, i < 4 ? 9 : 4 + jitter(i))));
    expect(findPatterns([mood, ex], answers, d).status).toBe('none');
  });

  test('no data and no questions are insufficient, never an error', () => {
    expect(findPatterns([], [], span(5)).status).toBe('insufficient');
    expect(findPatterns([mood, ex], [], span(30)).status).toBe('insufficient');
    expect(findPatterns([mood, ex], [], []).status).toBe('insufficient');
  });

  test('an answer that never varies yields no finding and no NaN', () => {
    const d = span(30);
    const answers: Answer[] = [];
    d.forEach((day, i) => answers.push(a(ex, day, true), a(mood, day, 5 + jitter(i))));
    expect(findPatterns([mood, ex], answers, d).status).toBe('none'); // no "off" days
    const constant: Answer[] = [];
    d.forEach((day, i) => constant.push(a(ex, day, i % 2 === 0), a(mood, day, 5)));
    const r = findPatterns([mood, ex], constant, d);
    expect(r.status).toBe('none'); // both groups constant: welch is null, nothing ran
  });

  test('comparable data with no real link reports "none"', () => {
    const d = span(40);
    const flat: Answer[] = [];
    d.forEach((day, i) => flat.push(a(ex, day, i % 2 === 0), a(mood, day, i % 4 < 2 ? 4 : 6))); // balanced across both groups
    expect(findPatterns([mood, ex], flat, d).status).toBe('none');
  });

  test('hidden questions never appear in findings', () => {
    const d = span(40);
    const hiddenEx = { ...ex, hideFromInsights: true };
    const answers: Answer[] = [];
    d.forEach((day, i) => answers.push(a(hiddenEx, day, i % 2 === 0), a(mood, day, (i % 2 === 0 ? 8 : 5) + jitter(i))));
    expect(findPatterns([mood, hiddenEx], answers, d).status).toBe('incomparable'); // only Mood is left
  });

  test('late bedtime followed by a lower mood next day is found via the time series', () => {
    const d = span(40);
    const answers: Answer[] = [];
    const F = flagsFor(d.length, 5);
    d.forEach((day, i) => {
      const late = F[i]!;
      answers.push(a(bed, day, late ? '01:00' : '22:30'));
      const prevLate = i > 0 && F[i - 1]!;
      answers.push(a(mood, day, (prevLate ? 4 : 7) + jitter(i)));
    });
    const r = findPatterns([mood, bed], answers, d);
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    const p = r.patterns.find((x) => x.signal.label === 'Bedtime' && x.outcome.label === 'Mood' && x.lag === 1)!;
    expect(p.signal.derived).toBe('high');
    expect(p.onMean).toBeLessThan(p.offMean);
  });

  test('keeps at most 3 findings, at most one per question pair, strongest first', () => {
    const d = span(40);
    const qs: Question[] = [mood, water, ex];
    const answers: Answer[] = [];
    const F = flagsFor(d.length, 3);
    d.forEach((day, i) => {
      const yes = F[i]!;
      answers.push(a(ex, day, yes), a(mood, day, (yes ? 8 : 5) + jitter(i)), a(water, day, (yes ? 7 : 3) + jitter(i + 2)));
    });
    const r = findPatterns(qs, answers, d);
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    expect(r.patterns.length).toBeLessThanOrEqual(3);
    const pairs = r.patterns.map((p) => `${p.signal.questionId}>${p.outcome.questionId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    const ds = r.patterns.map((p) => Math.abs(p.d));
    expect([...ds].sort((x, y) => y - x)).toEqual(ds);
  });

  test('pure noise almost never produces a finding (multiple-testing correction works)', () => {
    let hits = 0;
    const runs = 300;
    for (let seed = 1; seed <= runs; seed++) {
      const rnd = mulberry32(seed);
      const d = span(40);
      const answers: Answer[] = [];
      d.forEach((day) => {
        answers.push(a(ex, day, rnd() < 0.5));
        answers.push(a(mood, day, Math.floor(rnd() * 11)));
        answers.push(a(water, day, Math.floor(rnd() * 9)));
        answers.push(a(bed, day, `${String(Math.floor(21 + rnd() * 5) % 24).padStart(2, '0')}:00`));
        answers.push(a(sym, day, rnd() < 0.4 ? ['Headache'] : []));
      });
      if (findPatterns([mood, ex, water, bed, sym], answers, d).status === 'found') hits++;
    }
    // Family-wise error is held at about 5% (measured 5.0% over 1000 runs); expect ~15 of 300.
    // Uncorrected, this would be several times higher, so 27 (9%) still catches a broken correction.
    expect(hits).toBeLessThanOrEqual(27);
  });

  test('a large history stays fast', () => {
    const qs: Question[] = Array.from({ length: 100 }, (_, i) =>
      ({ ...base, id: 100 + i, label: `Q${i}`, type: i % 2 === 0 ? 'yesno' : 'scale', config: (i % 2 === 0 ? {} : { min: 0, max: 10 }) as never }));
    const d = span(200);
    const rnd = mulberry32(7);
    const answers: Answer[] = [];
    for (const q of qs) for (const day of d) answers.push(a(q, day, q.type === 'yesno' ? rnd() < 0.5 : Math.floor(rnd() * 11)));
    // best of three: a loaded CI box slows one run, but a real regression slows all of them
    let best = Infinity;
    let r = findPatterns(qs, answers, d);
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      r = findPatterns(qs, answers, d);
      best = Math.min(best, Date.now() - t0);
    }
    expect(best).toBeLessThan(1200); // ~300ms alone; the unoptimised loop took 2000+
    if (r.status === 'found') expect(r.patterns.length).toBeLessThanOrEqual(3);
  });
});

describe('findPatterns: states for data that can never be compared', () => {
  const d = span(60);
  test('only yes/no questions, however long you log, is "incomparable" (not "keep logging")', () => {
    const ex2 = { ...ex, id: 8, label: 'Read' };
    const answers = d.flatMap((day, i) => [a(ex, day, i % 3 === 0), a(ex2, day, i % 2 === 0)]);
    expect(findPatterns([ex, ex2], answers, d).status).toBe('incomparable');
  });
  test('a single slider on its own is "incomparable"', () => {
    expect(findPatterns([mood], d.map((day, i) => a(mood, day, i % 10)), d).status).toBe('incomparable');
  });
  test('a few days of data is still "insufficient", whatever the questions', () => {
    const few = span(5);
    expect(findPatterns([ex], few.map((day) => a(ex, day, true)), few).status).toBe('insufficient');
  });
  test('a number that never varies but has decimals produces no finding', () => {
    const kg: Question = { ...base, id: 20, label: 'Weight', type: 'number', config: { decimals: 1, unit: 'kg' } };
    for (const v of [72.4, 0.1, 98.6, 7.1]) {
      const r = mulberry32(3);
      const answers = d.flatMap((day) => [a(ex, day, r() < 0.5), a(kg, day, v)]);
      expect(findPatterns([kg, ex], answers, d).status).not.toBe('found');
    }
  });
});

describe('findPatternsWithFallback', () => {
  test('uses all data when the chosen window is too short to compare', () => {
    const all = span(40);
    const answers: Answer[] = [];
    all.forEach((day, i) => answers.push(a(ex, day, i % 2 === 0), a(mood, day, (i % 2 === 0 ? 8 : 5) + jitter(i))));
    const shortWindow = all.slice(-7);
    expect(findPatterns([mood, ex], answers, shortWindow).status).toBe('insufficient');
    const r = findPatternsWithFallback([mood, ex], answers, shortWindow, all);
    expect(r.status).toBe('found');
    expect(r.status === 'found' && r.fromAllData).toBe(true);
  });
  test('a finding from the chosen window itself is not flagged as from all data', () => {
    const all = span(40);
    const answers: Answer[] = [];
    all.forEach((day, i) => answers.push(a(ex, day, i % 2 === 0), a(mood, day, (i % 2 === 0 ? 8 : 5) + jitter(i))));
    const r = findPatternsWithFallback([mood, ex], answers, all, all);
    expect(r.status === 'found' && r.fromAllData).toBeFalsy();
  });
  test('stays insufficient when even all data is too little', () => {
    const all = span(6);
    expect(findPatternsWithFallback([mood, ex], [], all.slice(-3), all).status).toBe('insufficient');
  });
});

const pat = (over: Partial<Pattern> = {}): Pattern => ({
  signal: { questionId: 2, label: 'Exercise', sourceType: 'yesno' },
  outcome: { questionId: 1, label: 'Mood', type: 'scale' },
  lag: 0, onMean: 7.4, offMean: 5.8, onDays: 15, offDays: 16, d: 1.2,
  ...over,
});

describe('describePattern', () => {
  test('yes/no, same day', () => {
    expect(describePattern(pat())).toBe('On days Exercise was Yes, Mood averages 7.4 vs 5.8 when it was No (31 days).');
  });
  test('next day', () => {
    expect(describePattern(pat({ lag: 1 }))).toBe('The day after Exercise was Yes, Mood averages 7.4 vs 5.8 when it was No (31 days).');
  });
  test('an option of a checkbox or choice question', () => {
    const p = pat({ signal: { questionId: 3, label: 'Symptoms', sourceType: 'checkboxes', option: 'Headache' }, onMean: 4.1, offMean: 6 });
    expect(describePattern(p)).toBe('On days you picked "Headache" for Symptoms, Mood averages 4.1 vs 6.0 on other days (31 days).');
    expect(describePattern({ ...p, lag: 1 })).toMatch(/^The day after you picked "Headache" for Symptoms, /);
  });
  test('higher than usual, and later than usual for a time question', () => {
    const hi = pat({ signal: { questionId: 5, label: 'Water', sourceType: 'number', derived: 'high' } });
    expect(describePattern(hi)).toMatch(/^On days Water was higher than usual, .* when it was not \(31 days\)\.$/);
    const late = pat({ signal: { questionId: 4, label: 'Bedtime', sourceType: 'time', derived: 'high' }, lag: 1 });
    expect(describePattern(late)).toMatch(/^The day after Bedtime was later than usual, /);
  });
  test('a number outcome carries its unit', () => {
    const p = pat({ outcome: { questionId: 5, label: 'Water', type: 'number', unit: 'glasses' }, onMean: 6, offMean: 4 });
    expect(describePattern(p)).toBe('On days Exercise was Yes, Water averages 6.0 glasses vs 4.0 glasses when it was No (31 days).');
  });
  test('a time outcome is shown as clock times with the gap', () => {
    const p = pat({ outcome: { questionId: 4, label: 'Bedtime', type: 'time' }, onMean: 23 * 60 + 40, offMean: 23 * 60 + 15 });
    expect(describePattern(p)).toBe('On days Exercise was Yes, Bedtime averages 23:40 vs 23:15 when it was No (25 min later, 31 days).');
  });
  test('a time outcome past midnight wraps to a clock time and reads "earlier" when lower', () => {
    const p = pat({ outcome: { questionId: 4, label: 'Bedtime', type: 'time' }, onMean: 24 * 60 + 10, offMean: 24 * 60 + 40 });
    expect(describePattern(p)).toBe('On days Exercise was Yes, Bedtime averages 00:10 vs 00:40 when it was No (30 min earlier, 31 days).');
  });
  test('a sub-minute time gap is not mentioned', () => {
    const p = pat({ outcome: { questionId: 4, label: 'Bedtime', type: 'time' }, onMean: 23 * 60, offMean: 23 * 60 + 0.4 });
    expect(describePattern(p)).not.toContain('earlier');
    expect(describePattern(p)).not.toContain('later');
  });
});
