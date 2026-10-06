import { toRfc3339Utc, type JournalDate } from '../domain/date';
import {
  lockViolation, normalizeQuestion, planAnswerWrite, questionKey, validateQuestion,
  type Answer, type AnswerValue, type NewQuestion, type Question,
} from '../domain/question';
import type { ImportCounts, ImportPlan, OptionUsage, Store } from '../domain/store';

const Q = 'question';
const A = 'answer';
const U = 'usage';

interface UsageRec { questionId: number; option: string; count: number; lastUsed: string; hidden: boolean }

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

const bySortThenId = (a: Question, b: Question) => a.sort - b.sort || a.id - b.id;

/**
 * IndexedDbStore is the web Store. Every mutating method runs in ONE
 * transaction and awaits only IndexedDB requests inside it (a foreign await
 * would let the transaction auto-commit). Overlapping read-write
 * transactions on the same stores run in creation order, so overlapping
 * autosaves serialise naturally.
 */
export class IndexedDbStore implements Store {
  private constructor(private readonly db: IDBDatabase, private readonly now: () => Date) {}

  static open(name: string, now: () => Date = () => new Date()): Promise<IndexedDbStore> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore(Q, { keyPath: 'id', autoIncrement: true });
        db.createObjectStore(A, { keyPath: ['date', 'questionId'] }).createIndex('byQuestion', 'questionId');
        db.createObjectStore(U, { keyPath: ['questionId', 'option'] });
      };
      request.onsuccess = () => resolve(new IndexedDbStore(request.result, now));
      request.onerror = () => reject(request.error ?? new Error(`could not open the database "${name}"`));
      request.onblocked = () => reject(new Error(`the database "${name}" is open in another tab`));
    });
  }

  private stamp(): string { return toRfc3339Utc(this.now()); }

  /** run executes fn in one transaction, aborting it if fn throws. */
  private async run<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const tx = this.db.transaction(stores, mode);
    const finished = done(tx);
    try {
      const result = await fn(tx);
      await finished;
      return result;
    } catch (e) {
      finished.catch(() => undefined);
      try { tx.abort(); } catch { /* already finished */ }
      throw e;
    }
  }

  private async questionById(tx: IDBTransaction, id: number): Promise<Question> {
    const q = (await promisify(tx.objectStore(Q).get(id))) as Question | undefined;
    if (!q) throw new Error(`no question with id ${id}`);
    return q;
  }

  private async assertUnique(tx: IDBTransaction, q: NewQuestion, exceptId: number | null): Promise<void> {
    const all = (await promisify(tx.objectStore(Q).getAll())) as Question[];
    const key = questionKey(q);
    const clash = all.find((x) => x.id !== exceptId && questionKey(x) === key);
    if (clash) {
      const hint = clash.archivedAt !== null ? ' (it is archived - restore it from the Archived list)' : '';
      throw new Error(`a "${q.label.trim()}" ${q.type} question already exists${hint}`);
    }
  }

  private async insertQuestion(tx: IDBTransaction, q: NewQuestion, archivedAt: string | null): Promise<Question> {
    const err = validateQuestion(q);
    if (err) throw new Error(err);
    await this.assertUnique(tx, q, null);
    const store = tx.objectStore(Q);
    const all = (await promisify(store.getAll())) as Question[];
    const sort = all.reduce((m, x) => Math.max(m, x.sort), -1) + 1;
    const record = { ...normalizeQuestion(q), sort, archivedAt, created: this.stamp() };
    const id = (await promisify(store.add(record))) as number;
    const full = { ...record, id } as Question;
    await promisify(store.put(full));
    return full;
  }

  private async writeAnswer(tx: IDBTransaction, q: Question, date: JournalDate, value: AnswerValue | null, updated: string): Promise<void> {
    const as = tx.objectStore(A);
    const us = tx.objectStore(U);
    const prev = (await promisify(as.get([date, q.id]))) as Answer | undefined;
    const plan = planAnswerWrite(q, prev?.value ?? null, value);
    if (plan.value === null) await promisify(as.delete([date, q.id]));
    else await promisify(as.put({ date, questionId: q.id, value: plan.value, updated }));
    for (const option of plan.added) {
      const cur = (await promisify(us.get([q.id, option]))) as UsageRec | undefined;
      await promisify(us.put({ questionId: q.id, option, count: (cur?.count ?? 0) + 1, lastUsed: updated, hidden: false }));
    }
    for (const option of plan.removed) {
      const cur = (await promisify(us.get([q.id, option]))) as UsageRec | undefined;
      if (cur) await promisify(us.put({ ...cur, count: Math.max(cur.count - 1, 0) }));
    }
  }

  listQuestions(opts: { includeArchived?: boolean } = {}): Promise<Question[]> {
    return this.run([Q], 'readonly', async (tx) => {
      const all = (await promisify(tx.objectStore(Q).getAll())) as Question[];
      return all.filter((q) => opts.includeArchived || q.archivedAt === null).sort(bySortThenId);
    });
  }

  addQuestion(q: NewQuestion): Promise<Question> {
    return this.run([Q], 'readwrite', (tx) => this.insertQuestion(tx, q, null));
  }

  updateQuestion(id: number, next: NewQuestion, hideOptions: string[] = []): Promise<Question> {
    return this.run([Q, A, U], 'readwrite', async (tx) => {
      const old = await this.questionById(tx, id);
      const err = validateQuestion(next);
      if (err) throw new Error(err);
      await this.assertUnique(tx, next, id);
      const answered = (await promisify(tx.objectStore(A).index('byQuestion').count(IDBKeyRange.only(id)))) > 0;
      const locked = lockViolation(old, next, answered);
      if (locked) throw new Error(locked);
      const full = { ...normalizeQuestion(next), id, sort: old.sort, archivedAt: old.archivedAt, created: old.created } as Question;
      await promisify(tx.objectStore(Q).put(full));
      const usage = tx.objectStore(U);
      for (const option of hideOptions) {
        const cur = (await promisify(usage.get([id, option]))) as UsageRec | undefined;
        if (cur) await promisify(usage.put({ ...cur, hidden: true }));
      }
      return full;
    });
  }

  reorderQuestions(ids: number[]): Promise<void> {
    return this.run([Q], 'readwrite', async (tx) => {
      const store = tx.objectStore(Q);
      const all = ((await promisify(store.getAll())) as Question[]).sort(bySortThenId);
      const first = ids.map((id) => all.find((q) => q.id === id)).filter((q): q is Question => q !== undefined);
      const order = [...first, ...all.filter((q) => !first.includes(q))];
      for (let i = 0; i < order.length; i++) await promisify(store.put({ ...order[i]!, sort: i }));
    });
  }

  setArchived(id: number, archived: boolean): Promise<void> {
    return this.run([Q], 'readwrite', async (tx) => {
      const store = tx.objectStore(Q);
      const q = (await promisify(store.get(id))) as Question | undefined;
      if (q) await promisify(store.put({ ...q, archivedAt: archived ? this.stamp() : null }));
    });
  }

  hasAnswers(id: number): Promise<boolean> {
    return this.run([A], 'readonly', async (tx) =>
      (await promisify(tx.objectStore(A).index('byQuestion').count(IDBKeyRange.only(id)))) > 0);
  }

  getAnswers(date: JournalDate): Promise<Answer[]> {
    return this.answersBetween(date, date);
  }

  setAnswer(date: JournalDate, questionId: number, value: AnswerValue | null): Promise<void> {
    return this.run([Q, A, U], 'readwrite', async (tx) =>
      this.writeAnswer(tx, await this.questionById(tx, questionId), date, value, this.stamp()));
  }

  answersBetween(from: JournalDate, to: JournalDate): Promise<Answer[]> {
    return this.run([A], 'readonly', async (tx) =>
      (await promisify(tx.objectStore(A).getAll(IDBKeyRange.bound([from, -Infinity], [to, Infinity])))) as Answer[]);
  }

  firstAnswerDate(): Promise<JournalDate | null> {
    return this.run([A], 'readonly', async (tx) => {
      const keys = (await promisify(tx.objectStore(A).getAllKeys(undefined, 1))) as [string, number][];
      return keys[0]?.[0] ?? null;
    });
  }

  options(questionId: number): Promise<OptionUsage[]> {
    return this.run([U], 'readonly', async (tx) => {
      const all = (await promisify(tx.objectStore(U).getAll())) as UsageRec[];
      return all
        .filter((u) => u.questionId === questionId && !u.hidden && u.count > 0)
        .sort((a, b) => b.count - a.count || (a.lastUsed < b.lastUsed ? 1 : a.lastUsed > b.lastUsed ? -1 : 0) || (a.option < b.option ? -1 : 1))
        .map((u) => ({ option: u.option, count: u.count, lastUsed: u.lastUsed }));
    });
  }

  hideOption(questionId: number, option: string): Promise<void> {
    return this.run([U], 'readwrite', async (tx) => {
      const store = tx.objectStore(U);
      const cur = (await promisify(store.get([questionId, option]))) as UsageRec | undefined;
      if (cur) await promisify(store.put({ ...cur, hidden: true }));
    });
  }

  async *allAnswers(): AsyncIterable<Answer> {
    const all = await this.run([A], 'readonly', async (tx) => (await promisify(tx.objectStore(A).getAll())) as Answer[]);
    for (const a of all) yield a;
  }

  applyImport(plan: ImportPlan, overwrite: boolean): Promise<ImportCounts> {
    return this.run([Q, A, U], 'readwrite', async (tx) => {
      const keyToId = new Map<string, number>();
      for (const n of plan.newQuestions) keyToId.set(n.key, (await this.insertQuestion(tx, n.question, n.archivedAt)).id);
      const counts: ImportCounts = { questionsAdded: plan.newQuestions.length, answersAdded: 0, answersSkipped: 0 };
      for (const a of plan.answers) {
        const id = 'id' in a.ref ? a.ref.id : keyToId.get(a.ref.key);
        if (id === undefined) throw new Error(`import refers to an unknown question "${'key' in a.ref ? a.ref.key : ''}"`);
        const q = await this.questionById(tx, id);
        const exists = (await promisify(tx.objectStore(A).get([a.date, id]))) !== undefined;
        if (exists && !overwrite) { counts.answersSkipped++; continue; }
        await this.writeAnswer(tx, q, a.date, a.value, a.updated);
        counts.answersAdded++;
      }
      return counts;
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
