import type { NewQuestion } from './question';

export interface Template { id: string; question: NewQuestion }

const q = (id: string, question: Omit<NewQuestion, 'hideFromInsights'>): Template =>
  ({ id, question: { hideFromInsights: false, ...question } as NewQuestion });

/** Starter questions offered on first launch. */
export const TEMPLATES: Template[] = [
  q('mood', { label: 'Mood', type: 'scale', config: { min: 1, max: 10 } }),
  q('exercise', { label: 'Exercise', type: 'yesno', config: {} }),
  q('outdoors', { label: 'Time outdoors', type: 'yesno', config: {} }),
  q('thankful', { label: 'Thankful for', type: 'text', config: { multiline: true, showFrequent: true } }),
  q('meals', { label: 'Healthy meals', type: 'number', config: { min: 0, max: 10, decimals: 0, unit: 'meals' } }),
  q('snacking', { label: 'Bad snacking', type: 'yesno', config: {} }),
  q('symptoms', { label: 'Symptoms', type: 'checkboxes',
    config: { options: ['Headache', 'Asthma', 'Fatigue', 'Nausea', 'Joint pain'], allowOther: true } }),
  q('energy', { label: 'Energy', type: 'choice', config: { options: ['Low', 'Medium', 'High'], allowOther: false } }),
  q('bedtime', { label: 'Bedtime', type: 'time', config: {} }),
];
