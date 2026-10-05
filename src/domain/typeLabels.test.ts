import { QUESTION_TYPES } from './question';
import { TYPE_LABELS } from './typeLabels';

test('every question type has a distinct human label', () => {
  const labels = QUESTION_TYPES.map((t) => TYPE_LABELS[t]);
  expect(labels.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
  expect(new Set(labels).size).toBe(QUESTION_TYPES.length);
});
