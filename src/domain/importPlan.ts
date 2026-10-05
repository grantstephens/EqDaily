import type { JournalDate } from './date';
import {
  questionKey, validateQuestion, validateValue,
  type AnswerValue, type NewQuestion, type Question, type QuestionType,
} from './question';
import type { ImportPlan } from './store';

export interface IncomingQuestion {
  label: string; type: QuestionType; config: unknown; hideFromInsights: boolean; archivedAt: string | null;
}
export interface IncomingAnswer {
  date: JournalDate; label: string; type: QuestionType; value: AnswerValue; updated: string; row: number;
}
export interface PlanError { row: number; message: string }

/**
 * planImport matches incoming questions to existing ones (archived included)
 * by label+type, creates the rest, and resolves every answer to a question.
 * Anything invalid is reported, not planned; callers abort when errors exist.
 * A questions.csv error carries row 0 for the caller to relocate.
 */
export function planImport(
  existing: Question[], questions: IncomingQuestion[], answers: IncomingAnswer[],
): { plan: ImportPlan; errors: PlanError[] } {
  const errors: PlanError[] = [];
  const byKey = new Map<string, { id: number } | { key: string }>();
  const specs = new Map<string, NewQuestion>();
  for (const e of existing) { byKey.set(questionKey(e), { id: e.id }); specs.set(questionKey(e), e); }

  const plan: ImportPlan = { newQuestions: [], answers: [] };
  let n = 0;
  for (const q of questions) {
    const k = questionKey(q);
    if (byKey.has(k)) continue;
    const nq = { label: q.label, type: q.type, config: q.config, hideFromInsights: q.hideFromInsights } as NewQuestion;
    const err = validateQuestion(nq);
    if (err) { errors.push({ row: 0, message: `question "${q.label}": ${err}` }); continue; }
    const key = `new${n++}`;
    byKey.set(k, { key });
    specs.set(k, nq);
    plan.newQuestions.push({ key, question: nq, archivedAt: q.archivedAt });
  }

  for (const a of answers) {
    const k = questionKey(a);
    const ref = byKey.get(k);
    if (!ref) { errors.push({ row: a.row, message: `no question named "${a.label}" (${a.type})` }); continue; }
    const err = validateValue(specs.get(k)!, a.value);
    if (err) { errors.push({ row: a.row, message: err }); continue; }
    plan.answers.push({ date: a.date, ref, value: a.value, updated: a.updated });
  }
  return { plan, errors };
}
