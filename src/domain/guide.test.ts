import {
  addExtra, back, begin, canKeep, collision, currentItem, decide, editExtra, editItem,
  finalEntries, finalQuestions, goToReview, isReview, isWelcome, keepCurrent, removeExtra,
  skipCurrent, startGuide, type GuideState,
} from './guide';
import type { NewQuestion } from './question';
import { TEMPLATES } from './templates';

const yes = (label: string): NewQuestion => ({ label, type: 'yesno', config: {} as never, hideFromInsights: false });
const labels = (qs: NewQuestion[]) => qs.map((q) => q.label);

describe('startGuide', () => {
  test('begins on the welcome step with every suggestion pending, in template order', () => {
    const s = startGuide(TEMPLATES);
    expect(isWelcome(s)).toBe(true);
    expect(s.items.map((i) => i.id)).toEqual(TEMPLATES.map((t) => t.id));
    expect(s.items.every((i) => i.decision === 'pending')).toBe(true);
    expect(s.extras).toEqual([]);
  });
  test('works on copies: editing a suggestion never mutates the shared templates', () => {
    const before = JSON.stringify(TEMPLATES);
    let s = startGuide(TEMPLATES);
    s = editItem(s, 0, { ...s.items[0]!.question, label: 'Changed' });
    expect(JSON.stringify(TEMPLATES)).toBe(before);
    const again = startGuide(TEMPLATES);
    expect(again.items[0]!.question.label).toBe(TEMPLATES[0]!.question.label);
  });
});

describe('moving through the steps', () => {
  test('begin goes to the first suggestion; the current item is that suggestion', () => {
    const s = begin(startGuide(TEMPLATES));
    expect(s.step).toBe(1);
    expect(currentItem(s)!.id).toBe(TEMPLATES[0]!.id);
  });
  test('keepCurrent and skipCurrent record the decision and advance', () => {
    let s = begin(startGuide(TEMPLATES));
    s = keepCurrent(s);
    s = skipCurrent(s);
    expect(s.items[0]!.decision).toBe('keep');
    expect(s.items[1]!.decision).toBe('skip');
    expect(s.step).toBe(3);
  });
  test('after the last suggestion the guide lands on review', () => {
    let s = begin(startGuide(TEMPLATES));
    for (let i = 0; i < TEMPLATES.length; i++) s = keepCurrent(s);
    expect(isReview(s)).toBe(true);
    expect(currentItem(s)).toBeNull();
  });
  test('back goes one step, never below welcome, and remembers decisions', () => {
    let s = begin(startGuide(TEMPLATES));
    s = keepCurrent(s);
    s = back(s);
    expect(s.step).toBe(1);
    expect(s.items[0]!.decision).toBe('keep');
    expect(isWelcome(back(back(s)))).toBe(true);
    expect(back(back(back(s))).step).toBe(0);
  });
  test('goToReview jumps straight to the end', () => {
    expect(isReview(goToReview(startGuide(TEMPLATES)))).toBe(true);
  });
  test('an empty suggestion list goes straight from welcome to review', () => {
    expect(isReview(begin(startGuide([])))).toBe(true);
  });
  test('keepCurrent/skipCurrent do nothing off a suggestion step', () => {
    const w = startGuide(TEMPLATES);
    expect(keepCurrent(w)).toEqual(w);
    expect(skipCurrent(goToReview(w))).toEqual(goToReview(w));
  });
  test('state is immutable', () => {
    const s = begin(startGuide(TEMPLATES));
    const frozen = JSON.stringify(s);
    keepCurrent(s);
    editItem(s, 0, yes('x'));
    addExtra(s, yes('y'));
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe('editing and the final list', () => {
  test('an edit replaces the question but not the decision', () => {
    let s = begin(startGuide(TEMPLATES));
    s = editItem(s, 0, { ...s.items[0]!.question, label: 'Mood today' });
    expect(s.items[0]!.decision).toBe('pending');
    s = keepCurrent(s);
    expect(labels(finalQuestions(s))).toEqual(['Mood today']);
  });
  test('final questions are the kept suggestions in order, then the extras', () => {
    let s = begin(startGuide(TEMPLATES));
    s = keepCurrent(s); // mood
    s = skipCurrent(s); // exercise
    s = keepCurrent(s); // outdoors
    s = goToReview(s);
    s = addExtra(s, yes('Water'));
    expect(labels(finalQuestions(s))).toEqual(['Mood', 'Time outdoors', 'Water']);
    expect(finalEntries(s).map((e) => e.kind)).toEqual(['item', 'item', 'extra']);
  });
  test('a skipped suggestion can be restored from review, and a kept one removed', () => {
    let s = goToReview(startGuide(TEMPLATES));
    s = decide(s, 0, 'keep');
    s = decide(s, 1, 'keep');
    s = decide(s, 0, 'skip');
    expect(labels(finalQuestions(s))).toEqual(['Exercise']);
  });
  test('extras can be edited and removed', () => {
    let s = addExtra(goToReview(startGuide(TEMPLATES)), yes('Water'));
    s = editExtra(s, 0, yes('Hydration'));
    expect(labels(finalQuestions(s))).toEqual(['Hydration']);
    expect(finalQuestions(removeExtra(s, 0))).toEqual([]);
  });
  test('nothing kept means nothing to create', () => {
    expect(finalQuestions(goToReview(startGuide(TEMPLATES)))).toEqual([]);
  });
});

describe('duplicate questions', () => {
  const keepOutdoorsOnly = (): GuideState => {
    let s = begin(startGuide(TEMPLATES));
    s = skipCurrent(s); // mood
    s = skipCurrent(s); // exercise
    return keepCurrent(s); // outdoors (yes/no)
  };

  test('collision finds a kept question with the same label and type, ignoring case and spaces', () => {
    const s = keepOutdoorsOnly();
    expect(collision(s, yes(' time OUTDOORS '))).toMatch(/already/i);
  });
  test('the same label with a different type is fine', () => {
    const s = keepOutdoorsOnly();
    expect(collision(s, { label: 'Time outdoors', type: 'time', config: {} as never, hideFromInsights: false })).toBeNull();
  });
  test('skipped suggestions do not count, and a question never collides with itself', () => {
    const s = keepOutdoorsOnly();
    expect(collision(s, yes('Exercise'))).toBeNull(); // exercise was skipped
    expect(collision(s, s.items[2]!.question, { kind: 'item', index: 2 })).toBeNull();
  });
  test('extras count too', () => {
    const s = addExtra(goToReview(startGuide(TEMPLATES)), yes('Water'));
    expect(collision(s, yes('water'))).toMatch(/already/i);
    expect(collision(s, yes('water'), { kind: 'extra', index: 0 })).toBeNull();
  });
  test('canKeep refuses a suggestion that would duplicate one already kept, and keepCurrent respects it', () => {
    let s = begin(startGuide(TEMPLATES));
    s = keepCurrent(s); // mood
    s = keepCurrent(s); // exercise (yes/no) kept
    s = keepCurrent(s); // outdoors, to be renamed below
    s = goToReview(s);
    s = decide(s, 2, 'skip');
    s = editItem(s, 2, yes('Exercise')); // now clashes with the kept Exercise
    expect(canKeep(s, 2)).toMatch(/already/i);
    const at = { ...s, step: 3 }; // on the outdoors step
    expect(keepCurrent(at).items[2]!.decision).toBe('skip');
    expect(canKeep(s, 3)).toBeNull();
  });
});
