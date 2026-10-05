import type { QuestionType } from './question';

export const TYPE_LABELS: Record<QuestionType, string> = {
  scale: 'Slider',
  number: 'Number',
  yesno: 'Yes / No',
  text: 'Text',
  checkboxes: 'Checkboxes',
  choice: 'Single choice',
  time: 'Time',
};
