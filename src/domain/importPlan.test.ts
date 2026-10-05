import { planImport } from './importPlan';
import type { Question } from './question';

const ex: Question = { id: 7, label: 'Exercise', type: 'yesno', config: {} as never, hideFromInsights: false, sort: 0, archivedAt: '2026-01-01T00:00:00Z', created: 'T' };
const inc = (label: string, type: any = 'yesno', config: any = {}) => ({ label, type, config, hideFromInsights: false, archivedAt: null });
const ans = (label: string, value: any, row = 2, type: any = 'yesno') => ({ date: '2026-10-01', label, type, value, updated: '2026-10-01T00:00:00Z', row });

test('answers attach to an existing (even archived) question by id; it is not re-created', () => {
  const { plan, errors } = planImport([ex], [inc('exercise')], [ans('Exercise', true)]);
  expect(errors).toEqual([]);
  expect(plan.newQuestions).toEqual([]);
  expect(plan.answers[0]!.ref).toEqual({ id: 7 });
});
test('unknown question is created and answers reference its key', () => {
  const { plan } = planImport([], [inc('Meals', 'number', { decimals: 0 })], [ans('Meals', 3, 2, 'number')]);
  expect(plan.newQuestions).toHaveLength(1);
  expect('key' in plan.answers[0]!.ref).toBe(true);
});
test('answer with no matching question is an error with its row', () => {
  const { errors } = planImport([], [], [ans('Ghost', true, 5)]);
  expect(errors).toEqual([{ row: 5, message: expect.stringMatching(/Ghost/) }]);
});
test('invalid value for the matched question is an error', () => {
  const { errors } = planImport([ex], [], [ans('Exercise', 'maybe', 9)]);
  expect(errors[0]).toMatchObject({ row: 9 });
});
test('invalid incoming question is an error', () => {
  const { errors } = planImport([], [inc('', 'yesno')], []);
  expect(errors).toHaveLength(1);
});
test('duplicate incoming questions collapse', () => {
  const { plan } = planImport([], [inc('A'), inc('a')], []);
  expect(plan.newQuestions).toHaveLength(1);
});
