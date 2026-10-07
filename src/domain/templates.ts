import type { NewQuestion } from './question';

/**
 * A suggested starter question. `prompt` and `why` are the guide's copy: how the
 * question reads as a card, and one line on why it is worth tracking.
 */
export interface Template {
  id: string;
  prompt: string;
  why: string;
  question: NewQuestion;
}

const q = (
  id: string, prompt: string, why: string, question: Omit<NewQuestion, 'hideFromInsights'>,
): Template => ({ id, prompt, why, question: { hideFromInsights: false, ...question } as NewQuestion });

/** Starter questions offered by the first-launch guide. */
export const TEMPLATES: Template[] = [
  q('mood', 'How was your mood today?',
    'One number a day makes the ups and downs easy to see over weeks.',
    { label: 'Mood', type: 'scale', config: { min: 1, max: 10 } }),
  q('exercise', 'Did you exercise today?',
    'The simplest habit to spot a trend in, and the first to line up with your mood.',
    { label: 'Exercise', type: 'yesno', config: {} }),
  q('outdoors', 'Did you get outside today?',
    'Fresh air tends to show up in how you feel. This lets you check.',
    { label: 'Time outdoors', type: 'yesno', config: {} }),
  q('thankful', 'What are you thankful for today?',
    'A line a day builds something worth reading back, and Insights surfaces what you mention most.',
    { label: 'Thankful for', type: 'text', config: { multiline: true, showFrequent: true } }),
  q('meals', 'How many healthy meals did you have?',
    'Counting beats guessing when you look back at a month.',
    { label: 'Healthy meals', type: 'number', config: { min: 0, max: 10, decimals: 0, unit: 'meals' } }),
  q('snacking', 'Any bad snacking today?',
    'Handy for spotting what sets it off: compare it with your mood and sleep.',
    { label: 'Bad snacking', type: 'yesno', config: {} }),
  q('symptoms', 'Any symptoms today?',
    'Track headaches, asthma and anything else, and see which come up most often.',
    { label: 'Symptoms', type: 'checkboxes',
      config: { options: ['Headache', 'Asthma', 'Fatigue', 'Nausea', 'Joint pain'], allowOther: true } }),
  q('energy', 'How was your energy?',
    'Often tells a different story from mood, and is worth tracking separately.',
    { label: 'Energy', type: 'choice', config: { options: ['Low', 'Medium', 'High'], allowOther: false } }),
  q('bedtime', 'What time did you go to bed?',
    'Late nights show up in the next day. Bedtimes either side of midnight average correctly.',
    { label: 'Bedtime', type: 'time', config: {} }),
];
