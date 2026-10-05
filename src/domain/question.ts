import type { JournalDate } from './date';

export type QuestionType = 'scale' | 'number' | 'yesno' | 'text' | 'checkboxes' | 'choice' | 'time';
export const QUESTION_TYPES: QuestionType[] =
  ['scale', 'number', 'yesno', 'text', 'checkboxes', 'choice', 'time'];

export interface ScaleConfig { min: number; max: number; step?: number }
export interface NumberConfig { min?: number; max?: number; unit?: string; decimals: number }
export interface TextConfig { multiline: boolean; showFrequent: boolean }
export interface OptionsConfig { options: string[]; allowOther: boolean }
export type EmptyConfig = Record<string, never>;

export type QuestionSpec =
  | { type: 'scale'; config: ScaleConfig }
  | { type: 'number'; config: NumberConfig }
  | { type: 'yesno'; config: EmptyConfig }
  | { type: 'text'; config: TextConfig }
  | { type: 'checkboxes'; config: OptionsConfig }
  | { type: 'choice'; config: OptionsConfig }
  | { type: 'time'; config: EmptyConfig };

export type NewQuestion = { label: string; hideFromInsights: boolean } & QuestionSpec;
export type Question = NewQuestion & {
  id: number;
  sort: number;
  archivedAt: string | null;
  created: string;
};

export type AnswerValue = number | boolean | string | string[];
export interface Answer {
  date: JournalDate;
  questionId: number;
  value: AnswerValue;
  updated: string;
}

export const MAX_LABEL = 80;
export const MAX_OPTION = 60;
export const MAX_OPTIONS = 40;
export const MAX_TEXT = 5000;
export const MAX_CHECKED = 50;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** questionKey identifies a question for uniqueness and import matching. */
export function questionKey(q: { label: string; type: QuestionType }): string {
  return `${q.label.trim().toLowerCase()}|${q.type}`;
}

function validateOptionText(o: unknown): string | null {
  if (typeof o !== 'string') return 'option must be text';
  const t = o.trim();
  if (t === '') return 'option cannot be empty';
  if (t.length > MAX_OPTION) return `option longer than ${MAX_OPTION} characters`;
  if (t.includes('|')) return 'option cannot contain "|"';
  return null;
}

export function validateQuestion(q: NewQuestion): string | null {
  const label = q.label.trim();
  if (label === '') return 'label cannot be empty';
  if (label.length > MAX_LABEL) return `label longer than ${MAX_LABEL} characters`;
  switch (q.type) {
    case 'scale': {
      const { min, max, step } = q.config;
      if (!isNum(min) || !isNum(max)) return 'scale needs a min and a max';
      if (min >= max) return 'scale min must be below max';
      if (step !== undefined && (!isNum(step) || step <= 0)) return 'scale step must be positive';
      return null;
    }
    case 'number': {
      const { min, max, decimals } = q.config;
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) return 'decimals must be 0 to 4';
      if (min !== undefined && !isNum(min)) return 'min must be a number';
      if (max !== undefined && !isNum(max)) return 'max must be a number';
      if (min !== undefined && max !== undefined && min > max) return 'min must not exceed max';
      return null;
    }
    case 'checkboxes':
    case 'choice': {
      const { options } = q.config;
      if (!Array.isArray(options) || options.length === 0) return 'add at least one option';
      if (options.length > MAX_OPTIONS) return `no more than ${MAX_OPTIONS} options`;
      const seen = new Set<string>();
      for (const o of options) {
        const err = validateOptionText(o);
        if (err) return err;
        const k = o.trim().toLowerCase();
        if (seen.has(k)) return `duplicate option "${o.trim()}"`;
        seen.add(k);
      }
      return null;
    }
    default:
      return null;
  }
}

export function validateValue(q: NewQuestion, value: unknown): string | null {
  switch (q.type) {
    case 'scale': {
      if (!isNum(value)) return 'answer must be a number';
      return value < q.config.min || value > q.config.max
        ? `answer must be between ${q.config.min} and ${q.config.max}` : null;
    }
    case 'number': {
      if (!isNum(value)) return 'answer must be a number';
      const { min, max, decimals } = q.config;
      if (min !== undefined && value < min) return `answer must be at least ${min}`;
      if (max !== undefined && value > max) return `answer must be at most ${max}`;
      const f = 10 ** decimals;
      if (Math.abs(Math.round(value * f) / f - value) > 1e-9) return `at most ${decimals} decimal places`;
      return null;
    }
    case 'yesno':
      return typeof value === 'boolean' ? null : 'answer must be yes or no';
    case 'text':
      if (typeof value !== 'string') return 'answer must be text';
      return value.length > MAX_TEXT ? `answer longer than ${MAX_TEXT} characters` : null;
    case 'time':
      return typeof value === 'string' && TIME_RE.test(value) ? null : 'time must be HH:MM';
    case 'choice':
      return validateOptionText(value);
    case 'checkboxes': {
      if (!Array.isArray(value)) return 'answer must be a list';
      if (value.length > MAX_CHECKED) return `no more than ${MAX_CHECKED} selections`;
      const seen = new Set<string>();
      for (const v of value) {
        const err = validateOptionText(v);
        if (err) return err;
        if (seen.has(v as string)) return 'duplicate selection';
        seen.add(v as string);
      }
      return null;
    }
  }
}

export function normalizeValue(q: NewQuestion, value: AnswerValue): AnswerValue {
  if (q.type === 'choice' || q.type === 'text') return (value as string).trim();
  if (q.type === 'checkboxes') {
    const out: string[] = [];
    for (const v of value as string[]) {
      const t = v.trim();
      if (t !== '' && !out.includes(t)) out.push(t);
    }
    return out;
  }
  return value;
}

export function lockViolation(old: NewQuestion, next: NewQuestion, answered: boolean): string | null {
  if (!answered) return null;
  if (old.type !== next.type) return 'the type cannot change once a question has answers - add a new question instead';
  if ((old.type === 'scale' && next.type === 'scale') || (old.type === 'number' && next.type === 'number')) {
    const a = old.config as { min?: number; max?: number };
    const b = next.config as { min?: number; max?: number };
    if (a.min !== b.min || a.max !== b.max) return 'min/max cannot change once a question has answers - add a new question instead';
  }
  return null;
}

/** The option strings an answer "uses", for usage counting. */
export function optionsOf(type: QuestionType, value: AnswerValue | null): string[] {
  if (value === null) return [];
  if (type === 'checkboxes') return value as string[];
  if (type === 'choice') return [value as string];
  return [];
}

/**
 * planAnswerWrite validates and normalises next, and reports which options the
 * write adds to / removes from the day's usage. next === null means skip.
 */
export function planAnswerWrite(
  q: NewQuestion, prev: AnswerValue | null, next: AnswerValue | null,
): { value: AnswerValue | null; added: string[]; removed: string[] } {
  let value: AnswerValue | null = null;
  if (next !== null) {
    const err = validateValue(q, next);
    if (err) throw new Error(err);
    value = normalizeValue(q, next);
    // Normalising can empty a text answer; that is a skip, not an answer.
    if ((q.type === 'text' || q.type === 'choice') && value === '') value = null;
  }
  const before = optionsOf(q.type, prev);
  const after = optionsOf(q.type, value);
  return {
    value,
    added: after.filter((o) => !before.includes(o)),
    removed: before.filter((o) => !after.includes(o)),
  };
}
