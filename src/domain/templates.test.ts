import { TEMPLATES } from './templates';
import { questionKey, validateQuestion } from './question';

test('every template is a valid question', () => {
  for (const t of TEMPLATES) expect(validateQuestion(t.question)).toBeNull();
});
test('ids and question keys are unique', () => {
  expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  expect(new Set(TEMPLATES.map((t) => questionKey(t.question))).size).toBe(TEMPLATES.length);
});
test('covers all seven types', () => {
  expect(new Set(TEMPLATES.map((t) => t.question.type)).size).toBe(7);
});
