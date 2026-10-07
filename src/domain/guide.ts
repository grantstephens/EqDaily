import { questionKey, type NewQuestion } from './question';
import type { Template } from './templates';

/**
 * The first-launch setup guide as a pure state machine, so the screen is a thin
 * view over it. Steps: 0 is the welcome, 1..n are the suggestions in order, and
 * n+1 is the review. Nothing here touches storage; the screen creates the final
 * questions only when the user finishes.
 */
export type Decision = 'pending' | 'keep' | 'skip';

export interface GuideItem {
  id: string;
  prompt: string;
  why: string;
  question: NewQuestion;
  decision: Decision;
}

export interface GuideState {
  items: GuideItem[];
  /** Questions the user wrote themselves on the review step. */
  extras: NewQuestion[];
  step: number;
}

export type Ref = { kind: 'item' | 'extra'; index: number };
export interface FinalEntry extends Ref { question: NewQuestion }

const copy = (q: NewQuestion): NewQuestion => JSON.parse(JSON.stringify(q)) as NewQuestion;

export function startGuide(templates: Template[]): GuideState {
  return {
    items: templates.map((t) => ({
      id: t.id, prompt: t.prompt, why: t.why, question: copy(t.question), decision: 'pending' as const,
    })),
    extras: [],
    step: 0,
  };
}

const reviewStep = (s: GuideState) => s.items.length + 1;

export const isWelcome = (s: GuideState) => s.step === 0;
export const isReview = (s: GuideState) => s.step >= reviewStep(s);

/** The suggestion being shown, or null on the welcome and review steps. */
export function currentItem(s: GuideState): GuideItem | null {
  return s.step >= 1 && s.step <= s.items.length ? s.items[s.step - 1]! : null;
}

const at = (s: GuideState, step: number): GuideState => ({ ...s, step: Math.min(Math.max(step, 0), reviewStep(s)) });

export const begin = (s: GuideState): GuideState => at(s, 1);
export const back = (s: GuideState): GuideState => at(s, s.step - 1);
export const goToReview = (s: GuideState): GuideState => at(s, reviewStep(s));

export function decide(s: GuideState, index: number, decision: 'keep' | 'skip'): GuideState {
  return { ...s, items: s.items.map((it, i) => (i === index ? { ...it, decision } : it)) };
}

/** Keep the current suggestion and move on. Refused (state unchanged) if it would duplicate another kept question. */
export function keepCurrent(s: GuideState): GuideState {
  if (!currentItem(s) || canKeep(s, s.step - 1) !== null) return s;
  return at(decide(s, s.step - 1, 'keep'), s.step + 1);
}

export function skipCurrent(s: GuideState): GuideState {
  if (!currentItem(s)) return s;
  return at(decide(s, s.step - 1, 'skip'), s.step + 1);
}

/** Replace a suggestion's working copy. The decision is untouched. */
export function editItem(s: GuideState, index: number, question: NewQuestion): GuideState {
  return { ...s, items: s.items.map((it, i) => (i === index ? { ...it, question } : it)) };
}

export const addExtra = (s: GuideState, q: NewQuestion): GuideState => ({ ...s, extras: [...s.extras, q] });
export const editExtra = (s: GuideState, index: number, q: NewQuestion): GuideState =>
  ({ ...s, extras: s.extras.map((e, i) => (i === index ? q : e)) });
export const removeExtra = (s: GuideState, index: number): GuideState =>
  ({ ...s, extras: s.extras.filter((_, i) => i !== index) });

/** What will be created: kept suggestions in order, then the user's own. */
export function finalEntries(s: GuideState): FinalEntry[] {
  const kept: FinalEntry[] = s.items
    .map((it, index) => ({ kind: 'item' as const, index, question: it.question, decision: it.decision }))
    .filter((e) => e.decision === 'keep')
    .map(({ kind, index, question }) => ({ kind, index, question }));
  return [...kept, ...s.extras.map((question, index) => ({ kind: 'extra' as const, index, question }))];
}

export const finalQuestions = (s: GuideState): NewQuestion[] => finalEntries(s).map((e) => e.question);

/**
 * collision reports a message if candidate would duplicate (same label and type,
 * ignoring case and spacing) a question that will be created. `ignore` is the
 * entry being edited, so a question never collides with itself.
 */
export function collision(s: GuideState, candidate: NewQuestion, ignore?: Ref): string | null {
  const key = questionKey(candidate);
  const clash = finalEntries(s).find(
    (e) => !(ignore && e.kind === ignore.kind && e.index === ignore.index) && questionKey(e.question) === key,
  );
  return clash ? `You already have a "${clash.question.label.trim()}" question of this type.` : null;
}

/** Whether suggestion `index` can be kept without duplicating another kept question. */
export function canKeep(s: GuideState, index: number): string | null {
  const it = s.items[index];
  return it ? collision(s, it.question, { kind: 'item', index }) : null;
}
