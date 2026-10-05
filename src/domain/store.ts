import type { JournalDate } from './date';
import type { Answer, AnswerValue, NewQuestion, Question } from './question';

export interface OptionUsage { option: string; count: number; lastUsed: string }

/**
 * ImportPlan is a fully-resolved import: which questions to create (keyed so
 * answers can refer to them before they have ids) and which answers to write.
 */
export interface ImportPlan {
  newQuestions: { key: string; question: NewQuestion; archivedAt: string | null }[];
  answers: { date: JournalDate; ref: { id: number } | { key: string }; value: AnswerValue; updated: string }[];
}
export interface ImportCounts { questionsAdded: number; answersAdded: number; answersSkipped: number }

/**
 * Store persists questions and their per-day answers.
 *
 * A skipped question has no answer row: "unanswered" is never "no". Every
 * method rejects with an Error rather than throwing synchronously, because a
 * failure on a user's phone must become an alert, not a dead app. Overlapping
 * calls (two quick taps = two autosaves) must be safe: implementations
 * serialise their own writes.
 */
export interface Store {
  /** listQuestions returns questions ordered by (sort, id); archived ones only on request. */
  listQuestions(opts?: { includeArchived?: boolean }): Promise<Question[]>;
  /** addQuestion validates, enforces label+type uniqueness, and appends at the end. */
  addQuestion(q: NewQuestion): Promise<Question>;
  /** updateQuestion replaces label/type/config, enforcing the post-answer locks. */
  updateQuestion(id: number, next: NewQuestion): Promise<Question>;
  /** reorderQuestions sets sort to each id's index in ids. */
  reorderQuestions(ids: number[]): Promise<void>;
  setArchived(id: number, archived: boolean): Promise<void>;
  hasAnswers(id: number): Promise<boolean>;
  getAnswers(date: JournalDate): Promise<Answer[]>;
  /** setAnswer writes an answer; null skips (deletes the row). */
  setAnswer(date: JournalDate, questionId: number, value: AnswerValue | null): Promise<void>;
  /** answersBetween is inclusive at both ends, ordered by (date, question). */
  answersBetween(from: JournalDate, to: JournalDate): Promise<Answer[]>;
  firstAnswerDate(): Promise<JournalDate | null>;
  /** options lists non-hidden options with a positive count, most used first. */
  options(questionId: number): Promise<OptionUsage[]>;
  /** hideOption stops offering a learned option until it is used again. */
  hideOption(questionId: number, option: string): Promise<void>;
  /** allAnswers yields every answer in ascending (date, question) order. */
  allAnswers(): AsyncIterable<Answer>;
  /** applyImport writes the whole plan atomically or not at all. */
  applyImport(plan: ImportPlan, overwrite: boolean): Promise<ImportCounts>;
  close(): Promise<void>;
}
