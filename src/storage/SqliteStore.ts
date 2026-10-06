import { toRfc3339Utc, type JournalDate } from '../domain/date';
import {
  lockViolation, normalizeQuestion, planAnswerWrite, questionKey, validateQuestion,
  type Answer, type AnswerValue, type NewQuestion, type Question,
} from '../domain/question';
import type { ImportCounts, ImportPlan, OptionUsage, Store } from '../domain/store';
import { fromRow, toConfigJson, type QuestionRow } from './questionRow';
import type { SqlDatabase } from './sql';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS question (
  id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, type TEXT NOT NULL,
  config TEXT NOT NULL, sort INTEGER NOT NULL, archived_at TEXT, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS answer (
  date TEXT NOT NULL, question_id INTEGER NOT NULL REFERENCES question(id),
  value TEXT NOT NULL, updated TEXT NOT NULL, PRIMARY KEY (date, question_id));
CREATE INDEX IF NOT EXISTS answer_by_question ON answer(question_id, date);
CREATE TABLE IF NOT EXISTS option_usage (
  question_id INTEGER NOT NULL, option TEXT NOT NULL, count INTEGER NOT NULL,
  last_used TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (question_id, option));
`;

interface AnswerRow { date: string; question_id: number; value: string; updated: string }
const toAnswer = (r: AnswerRow): Answer =>
  ({ date: r.date, questionId: r.question_id, value: JSON.parse(r.value) as AnswerValue, updated: r.updated });

/**
 * SqliteStore is the Android Store, written against the SqlDatabase seam so
 * the shared contract runs it against real SQLite (node:sqlite) in tests.
 */
export class SqliteStore implements Store {
  private chain: Promise<unknown> = Promise.resolve();
  private constructor(private readonly db: SqlDatabase, private readonly now: () => Date) {}

  static async open(db: SqlDatabase, now: () => Date = () => new Date()): Promise<SqliteStore> {
    await db.exec(SCHEMA);
    return new SqliteStore(db, now);
  }

  /** One operation at a time: overlapping autosaves must not interleave BEGINs. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private tx<T>(fn: () => Promise<T>): Promise<T> {
    return this.serial(async () => {
      await this.db.exec('BEGIN');
      try {
        const r = await fn();
        await this.db.exec('COMMIT');
        return r;
      } catch (e) {
        try { await this.db.exec('ROLLBACK'); } catch { /* already auto-aborted */ }
        throw e;
      }
    });
  }

  private stamp(): string { return toRfc3339Utc(this.now()); }

  private async questionById(id: number): Promise<Question> {
    const rows = await this.db.all<QuestionRow>('SELECT * FROM question WHERE id = ?', [id]);
    if (rows.length === 0) throw new Error(`no question with id ${id}`);
    return fromRow(rows[0]!);
  }

  private async assertUnique(q: NewQuestion, exceptId: number | null): Promise<void> {
    const rows = await this.db.all<QuestionRow>('SELECT * FROM question');
    const key = questionKey(q);
    const clash = rows.find((r) => r.id !== exceptId && questionKey(fromRow(r)) === key);
    if (clash) {
      const hint = clash.archived_at !== null ? ' (it is archived - restore it from the Archived list)' : '';
      throw new Error(`a "${q.label.trim()}" ${q.type} question already exists${hint}`);
    }
  }

  private async insertQuestion(q: NewQuestion, archivedAt: string | null): Promise<Question> {
    const err = validateQuestion(q);
    if (err) throw new Error(err);
    await this.assertUnique(q, null);
    q = normalizeQuestion(q);
    const next = (await this.db.all<{ next: number }>('SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM question'))[0]!.next;
    await this.db.run(
      'INSERT INTO question (label, type, config, sort, archived_at, created) VALUES (?, ?, ?, ?, ?, ?)',
      [q.label, q.type, toConfigJson(q), next, archivedAt, this.stamp()],
    );
    const id = (await this.db.all<{ id: number }>('SELECT last_insert_rowid() AS id'))[0]!.id;
    return this.questionById(id);
  }

  /** Shared by setAnswer and applyImport; must run inside a transaction. */
  private async writeAnswer(q: Question, date: JournalDate, value: AnswerValue | null, updated: string): Promise<void> {
    const prevRows = await this.db.all<AnswerRow>('SELECT * FROM answer WHERE date = ? AND question_id = ?', [date, q.id]);
    const prev = prevRows[0] ? toAnswer(prevRows[0]).value : null;
    const plan = planAnswerWrite(q, prev, value);
    if (plan.value === null) {
      await this.db.run('DELETE FROM answer WHERE date = ? AND question_id = ?', [date, q.id]);
    } else {
      await this.db.run(
        'INSERT INTO answer (date, question_id, value, updated) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(date, question_id) DO UPDATE SET value = excluded.value, updated = excluded.updated',
        [date, q.id, JSON.stringify(plan.value), updated],
      );
    }
    for (const option of plan.added) {
      await this.db.run(
        'INSERT INTO option_usage (question_id, option, count, last_used, hidden) VALUES (?, ?, 1, ?, 0) ' +
        'ON CONFLICT(question_id, option) DO UPDATE SET count = count + 1, last_used = excluded.last_used, hidden = 0',
        [q.id, option, updated],
      );
    }
    for (const option of plan.removed) {
      await this.db.run('UPDATE option_usage SET count = MAX(count - 1, 0) WHERE question_id = ? AND option = ?', [q.id, option]);
    }
  }

  listQuestions(opts: { includeArchived?: boolean } = {}): Promise<Question[]> {
    return this.serial(async () => {
      const rows = await this.db.all<QuestionRow>(
        `SELECT * FROM question ${opts.includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY sort, id`);
      return rows.map(fromRow);
    });
  }

  addQuestion(q: NewQuestion): Promise<Question> {
    return this.tx(() => this.insertQuestion(q, null));
  }

  updateQuestion(id: number, next: NewQuestion, hideOptions: string[] = []): Promise<Question> {
    return this.tx(async () => {
      const old = await this.questionById(id);
      const err = validateQuestion(next);
      if (err) throw new Error(err);
      await this.assertUnique(next, id);
      const answered = (await this.db.all('SELECT 1 FROM answer WHERE question_id = ? LIMIT 1', [id])).length > 0;
      const locked = lockViolation(old, next, answered);
      if (locked) throw new Error(locked);
      const clean = normalizeQuestion(next);
      await this.db.run('UPDATE question SET label = ?, type = ?, config = ? WHERE id = ?',
        [clean.label, clean.type, toConfigJson(clean), id]);
      for (const option of hideOptions) {
        await this.db.run('UPDATE option_usage SET hidden = 1 WHERE question_id = ? AND option = ?', [id, option]);
      }
      return this.questionById(id);
    });
  }

  reorderQuestions(ids: number[]): Promise<void> {
    return this.tx(async () => {
      const all = (await this.db.all<{ id: number }>('SELECT id FROM question ORDER BY sort, id')).map((r) => r.id);
      const first = ids.filter((id) => all.includes(id));
      const order = [...first, ...all.filter((id) => !first.includes(id))];
      for (let i = 0; i < order.length; i++) await this.db.run('UPDATE question SET sort = ? WHERE id = ?', [i, order[i]!]);
    });
  }

  setArchived(id: number, archived: boolean): Promise<void> {
    return this.serial(() => this.db.run('UPDATE question SET archived_at = ? WHERE id = ?', [archived ? this.stamp() : null, id]));
  }

  hasAnswers(id: number): Promise<boolean> {
    return this.serial(async () => (await this.db.all('SELECT 1 FROM answer WHERE question_id = ? LIMIT 1', [id])).length > 0);
  }

  getAnswers(date: JournalDate): Promise<Answer[]> {
    return this.serial(async () =>
      (await this.db.all<AnswerRow>('SELECT * FROM answer WHERE date = ? ORDER BY question_id', [date])).map(toAnswer));
  }

  setAnswer(date: JournalDate, questionId: number, value: AnswerValue | null): Promise<void> {
    return this.tx(async () => this.writeAnswer(await this.questionById(questionId), date, value, this.stamp()));
  }

  answersBetween(from: JournalDate, to: JournalDate): Promise<Answer[]> {
    return this.serial(async () =>
      (await this.db.all<AnswerRow>('SELECT * FROM answer WHERE date BETWEEN ? AND ? ORDER BY date, question_id', [from, to])).map(toAnswer));
  }

  firstAnswerDate(): Promise<JournalDate | null> {
    return this.serial(async () => (await this.db.all<{ d: string | null }>('SELECT MIN(date) AS d FROM answer'))[0]?.d ?? null);
  }

  options(questionId: number): Promise<OptionUsage[]> {
    return this.serial(async () =>
      (await this.db.all<{ option: string; count: number; last_used: string }>(
        'SELECT option, count, last_used FROM option_usage WHERE question_id = ? AND hidden = 0 AND count > 0 ' +
        'ORDER BY count DESC, last_used DESC, option', [questionId]))
        .map((r) => ({ option: r.option, count: r.count, lastUsed: r.last_used })));
  }

  hideOption(questionId: number, option: string): Promise<void> {
    return this.serial(() => this.db.run('UPDATE option_usage SET hidden = 1 WHERE question_id = ? AND option = ?', [questionId, option]));
  }

  async *allAnswers(): AsyncIterable<Answer> {
    // Read through the serial queue like every other call: streaming rows from
    // an open cursor while an autosave runs BEGIN..COMMIT on the same
    // connection would interleave them.
    const rows = await this.serial(async () =>
      (await this.db.all<AnswerRow>('SELECT * FROM answer ORDER BY date, question_id')).map(toAnswer));
    for (const a of rows) yield a;
  }

  applyImport(plan: ImportPlan, overwrite: boolean): Promise<ImportCounts> {
    return this.tx(async () => {
      const keyToId = new Map<string, number>();
      for (const n of plan.newQuestions) keyToId.set(n.key, (await this.insertQuestion(n.question, n.archivedAt)).id);
      const counts: ImportCounts = { questionsAdded: plan.newQuestions.length, answersAdded: 0, answersSkipped: 0 };
      for (const a of plan.answers) {
        const id = 'id' in a.ref ? a.ref.id : keyToId.get(a.ref.key);
        if (id === undefined) throw new Error(`import refers to an unknown question "${'key' in a.ref ? a.ref.key : ''}"`);
        const q = await this.questionById(id);
        const exists = (await this.db.all('SELECT 1 FROM answer WHERE date = ? AND question_id = ?', [a.date, id])).length > 0;
        if (exists && !overwrite) { counts.answersSkipped++; continue; }
        await this.writeAnswer(q, a.date, a.value, a.updated);
        counts.answersAdded++;
      }
      return counts;
    });
  }

  close(): Promise<void> {
    return this.serial(() => this.db.close());
  }
}
