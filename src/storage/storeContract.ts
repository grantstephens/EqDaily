import type { NewQuestion } from '../domain/question';
import type { ImportPlan, Store } from '../domain/store';

const mood = (over: Partial<NewQuestion> = {}): NewQuestion =>
  ({ label: 'Mood', type: 'scale', config: { min: 0, max: 10 }, hideFromInsights: false, ...over } as NewQuestion);
const yesno = (label = 'Exercise'): NewQuestion =>
  ({ label, type: 'yesno', config: {}, hideFromInsights: false } as NewQuestion);
const sym = (): NewQuestion =>
  ({ label: 'Symptoms', type: 'checkboxes', config: { options: ['Headache', 'Asthma'], allowOther: true }, hideFromInsights: false });

/**
 * runStoreContract executes the full behavioural contract against stores
 * produced by newStore. Each test gets a fresh, empty store.
 */
export function runStoreContract(name: string, newStore: () => Promise<Store>): void {
  describe(name, () => {
    let store: Store;
    beforeEach(async () => { store = await newStore(); });
    afterEach(async () => { await store.close(); });

    describe('questions', () => {
      test('add assigns id, created, increasing sort; list is ordered', async () => {
        const a = await store.addQuestion(mood());
        const b = await store.addQuestion(yesno());
        expect(a.sort).toBeLessThan(b.sort);
        expect(a.archivedAt).toBeNull();
        expect(a.created).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
        expect((await store.listQuestions()).map((q) => q.label)).toEqual(['Mood', 'Exercise']);
      });
      test('config and hideFromInsights round-trip', async () => {
        const q = await store.addQuestion(mood({ hideFromInsights: true }));
        expect((await store.listQuestions())[0]).toEqual(q);
        expect(q.hideFromInsights).toBe(true);
        expect(q.config).toEqual({ min: 0, max: 10 });
      });
      test('invalid question rejected', async () => {
        await expect(store.addQuestion({ ...yesno(), label: '' })).rejects.toThrow();
      });
      test('duplicate label+type rejected (case-insensitive), same label other type ok', async () => {
        await store.addQuestion(yesno('Exercise'));
        await expect(store.addQuestion(yesno(' exercise '))).rejects.toThrow(/already/i);
        await expect(store.addQuestion({ label: 'Exercise', type: 'time', config: {} as never, hideFromInsights: false })).resolves.toBeDefined();
      });
      test('archived questions are hidden by default and still count for uniqueness', async () => {
        const q = await store.addQuestion(yesno());
        await store.setArchived(q.id, true);
        expect(await store.listQuestions()).toEqual([]);
        expect((await store.listQuestions({ includeArchived: true }))[0]!.archivedAt).not.toBeNull();
        await expect(store.addQuestion(yesno())).rejects.toThrow();
        await store.setArchived(q.id, false);
        expect(await store.listQuestions()).toHaveLength(1);
      });
      test('reorder', async () => {
        const a = await store.addQuestion(mood());
        const b = await store.addQuestion(yesno());
        await store.reorderQuestions([b.id, a.id]);
        expect((await store.listQuestions()).map((q) => q.id)).toEqual([b.id, a.id]);
      });
      test('type and bounds editable before answers; locked after', async () => {
        const q = await store.addQuestion(mood());
        await expect(store.updateQuestion(q.id, mood({ config: { min: 1, max: 5 } } as never))).resolves.toBeDefined();
        await store.setAnswer('2026-10-01', q.id, 3);
        await expect(store.updateQuestion(q.id, yesno('Mood'))).rejects.toThrow(/type/i);
        await expect(store.updateQuestion(q.id, mood({ config: { min: 1, max: 9 } } as never))).rejects.toThrow(/min|max/i);
        await expect(store.updateQuestion(q.id, mood({ label: 'Mood v2', config: { min: 1, max: 5 } } as never))).resolves.toMatchObject({ label: 'Mood v2' });
      });
      test('renaming onto an existing key is rejected; keeping own key is fine', async () => {
        const a = await store.addQuestion(yesno('A'));
        await store.addQuestion(yesno('B'));
        await expect(store.updateQuestion(a.id, yesno('b'))).rejects.toThrow(/already/i);
        await expect(store.updateQuestion(a.id, yesno('a'))).resolves.toBeDefined();
      });
      test('options and label are stored trimmed', async () => {
        const q = await store.addQuestion({ label: ' Sym ', type: 'checkboxes', config: { options: [' Headache ', 'Asthma'], allowOther: true }, hideFromInsights: false });
        expect(q.label).toBe('Sym');
        expect(q.config).toMatchObject({ options: ['Headache', 'Asthma'] });
        const u = await store.updateQuestion(q.id, { ...sym(), config: { options: [' a ', 'b '], allowOther: true } } as NewQuestion);
        expect(u.config).toMatchObject({ options: ['a', 'b'] });
      });
      test('reorder renumbers every question, so an archived one never ties with an active one', async () => {
        const a = await store.addQuestion(mood());
        const b = await store.addQuestion(yesno());
        const c = await store.addQuestion(sym());
        await store.setArchived(b.id, true);
        await store.reorderQuestions([c.id, a.id]);
        const all = await store.listQuestions({ includeArchived: true });
        expect(new Set(all.map((q) => q.sort)).size).toBe(3);
        expect(all.map((q) => q.id)).toEqual([c.id, a.id, b.id]);
        await store.setArchived(b.id, false);
        expect((await store.listQuestions()).map((q) => q.id)).toEqual([c.id, a.id, b.id]);
      });
      test('a duplicate of an archived question says it is archived', async () => {
        const q = await store.addQuestion(yesno());
        await store.setArchived(q.id, true);
        await expect(store.addQuestion(yesno())).rejects.toThrow(/archived/i);
      });
      test('updateQuestion hides the removed options in the same transaction', async () => {
        const q = await store.addQuestion(sym());
        await store.setAnswer('2026-10-01', q.id, ['Asthma', 'Wheezy']);
        await store.updateQuestion(q.id, { ...sym(), config: { options: ['Headache'], allowOther: true } } as NewQuestion, ['Asthma', 'Wheezy']);
        expect(await store.options(q.id)).toEqual([]);
      });
      test('a rejected update hides nothing', async () => {
        const q = await store.addQuestion(sym());
        await store.setAnswer('2026-10-01', q.id, ['Wheezy']);
        await expect(store.updateQuestion(q.id, yesno(), ['Wheezy'])).rejects.toThrow();
        expect((await store.options(q.id)).map((o) => o.option)).toEqual(['Wheezy']);
      });
      test('number decimals cannot shrink once answered', async () => {
        const q = await store.addQuestion({ label: 'M', type: 'number', config: { decimals: 2 }, hideFromInsights: false });
        await store.setAnswer('2026-10-01', q.id, 1.25);
        await expect(store.updateQuestion(q.id, { label: 'M', type: 'number', config: { decimals: 1 }, hideFromInsights: false })).rejects.toThrow(/decimal/i);
      });
      test('updating an unknown id rejects', async () => {
        await expect(store.updateQuestion(999, yesno())).rejects.toThrow();
      });
    });

    describe('answers', () => {
      test('round-trip for every type', async () => {
        const qs = [
          await store.addQuestion(mood()),
          await store.addQuestion(yesno()),
          await store.addQuestion(sym()),
          await store.addQuestion({ label: 'T', type: 'text', config: { multiline: true, showFrequent: false }, hideFromInsights: false }),
          await store.addQuestion({ label: 'Bed', type: 'time', config: {} as never, hideFromInsights: false }),
          await store.addQuestion({ label: 'M', type: 'number', config: { decimals: 1 }, hideFromInsights: false }),
          await store.addQuestion({ label: 'E', type: 'choice', config: { options: ['Low'], allowOther: true }, hideFromInsights: false }),
        ];
        const vals = [0.25, false, ['Headache', 'Other'], 'multi\nline "quoted" ünï', '23:30', 2.5, 'Low'];
        for (let i = 0; i < qs.length; i++) await store.setAnswer('2026-10-01', qs[i]!.id, vals[i] as never);
        const got = await store.getAnswers('2026-10-01');
        expect(new Map(got.map((a) => [a.questionId, a.value]))).toEqual(new Map(qs.map((q, i) => [q.id, vals[i]])));
        expect(got[0]!.updated).toMatch(/Z$/);
      });
      test('null deletes the row — skipped is not stored', async () => {
        const q = await store.addQuestion(yesno());
        await store.setAnswer('2026-10-01', q.id, false);
        await store.setAnswer('2026-10-01', q.id, null);
        expect(await store.getAnswers('2026-10-01')).toEqual([]);
        expect(await store.hasAnswers(q.id)).toBe(false);
        await expect(store.setAnswer('2026-10-01', q.id, null)).resolves.toBeUndefined();
      });
      test('set replaces rather than duplicating', async () => {
        const q = await store.addQuestion(mood());
        await store.setAnswer('2026-10-01', q.id, 1);
        await store.setAnswer('2026-10-01', q.id, 2);
        expect((await store.getAnswers('2026-10-01')).map((a) => a.value)).toEqual([2]);
      });
      test('out-of-range and wrong-type values reject without writing', async () => {
        const q = await store.addQuestion(mood());
        await expect(store.setAnswer('2026-10-01', q.id, 11)).rejects.toThrow();
        await expect(store.setAnswer('2026-10-01', q.id, 'x' as never)).rejects.toThrow();
        expect(await store.getAnswers('2026-10-01')).toEqual([]);
      });
      test('unknown question rejects', async () => {
        await expect(store.setAnswer('2026-10-01', 999, 1)).rejects.toThrow();
      });
      test('CRLF text is stored with LF endings', async () => {
        const t = await store.addQuestion({ label: 'T', type: 'text', config: { multiline: true, showFrequent: false }, hideFromInsights: false });
        await store.setAnswer('2026-10-01', t.id, 'a\r\nb');
        expect((await store.getAnswers('2026-10-01'))[0]!.value).toBe('a\nb');
      });
      test('whitespace-only text is a skip', async () => {
        const t = await store.addQuestion({ label: 'T', type: 'text', config: { multiline: false, showFrequent: false }, hideFromInsights: false });
        await store.setAnswer('2026-10-01', t.id, 'x');
        await store.setAnswer('2026-10-01', t.id, '   ');
        expect(await store.getAnswers('2026-10-01')).toEqual([]);
      });
      test('answersBetween is inclusive, ordered; firstAnswerDate', async () => {
        const q = await store.addQuestion(mood());
        expect(await store.firstAnswerDate()).toBeNull();
        for (const d of ['2026-10-03', '2026-10-01', '2026-10-02', '2026-10-09']) await store.setAnswer(d, q.id, 1);
        expect((await store.answersBetween('2026-10-01', '2026-10-03')).map((a) => a.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
        expect(await store.firstAnswerDate()).toBe('2026-10-01');
      });
      test('archived questions keep their answers readable', async () => {
        const q = await store.addQuestion(mood());
        await store.setAnswer('2026-10-01', q.id, 4);
        await store.setArchived(q.id, true);
        expect(await store.answersBetween('2026-10-01', '2026-10-01')).toHaveLength(1);
      });
      test('allAnswers ascending and stops when the consumer stops', async () => {
        const q = await store.addQuestion(mood());
        for (const d of ['2026-10-02', '2026-10-01']) await store.setAnswer(d, q.id, 1);
        const seen: string[] = [];
        for await (const a of store.allAnswers()) { seen.push(a.date); break; }
        expect(seen).toEqual(['2026-10-01']);
      });
    });

    describe('option usage', () => {
      test('counts days, not saves: re-saving the same answer does not inflate', async () => {
        const q = await store.addQuestion(sym());
        await store.setAnswer('2026-10-01', q.id, ['Headache', 'Other']);
        await store.setAnswer('2026-10-01', q.id, ['Headache', 'Other']);
        await store.setAnswer('2026-10-02', q.id, ['Headache']);
        const u = await store.options(q.id);
        expect(u.map((x) => [x.option, x.count])).toEqual([['Headache', 2], ['Other', 1]]);
      });
      test('unticking and skipping decrement; zero-count options disappear', async () => {
        const q = await store.addQuestion(sym());
        await store.setAnswer('2026-10-01', q.id, ['Other']);
        await store.setAnswer('2026-10-01', q.id, []);
        expect(await store.options(q.id)).toEqual([]);
        await store.setAnswer('2026-10-01', q.id, ['Other']);
        await store.setAnswer('2026-10-01', q.id, null);
        expect(await store.options(q.id)).toEqual([]);
      });
      test('hideOption hides until the option is used again', async () => {
        const q = await store.addQuestion(sym());
        await store.setAnswer('2026-10-01', q.id, ['Other']);
        await store.hideOption(q.id, 'Other');
        expect(await store.options(q.id)).toEqual([]);
        await store.setAnswer('2026-10-02', q.id, ['Other']);
        expect((await store.options(q.id)).map((x) => x.option)).toEqual(['Other']);
      });
      test('choice answers are tracked too', async () => {
        const q = await store.addQuestion({ label: 'E', type: 'choice', config: { options: ['Low'], allowOther: true }, hideFromInsights: false });
        await store.setAnswer('2026-10-01', q.id, 'Wired');
        await store.setAnswer('2026-10-01', q.id, 'Low');
        expect((await store.options(q.id)).map((x) => [x.option, x.count])).toEqual([['Low', 1]]);
      });
    });

    describe('concurrency', () => {
      test('overlapping autosaves serialise and leave consistent state', async () => {
        const q = await store.addQuestion(sym());
        const sets = [['Headache'], ['Headache', 'Asthma'], ['Asthma'], [], ['Other'], ['Other', 'Headache']];
        await Promise.all(sets.map((v) => store.setAnswer('2026-10-01', q.id, v)));
        const last = sets[sets.length - 1]!;
        expect((await store.getAnswers('2026-10-01'))[0]!.value).toEqual(last);
        expect((await store.options(q.id)).map((x) => x.option).sort()).toEqual([...last].sort());
      });
    });

    describe('applyImport', () => {
      const plan = (answers: ImportPlan['answers'], extra = true): ImportPlan => ({
        newQuestions: extra ? [{ key: 'n1', question: yesno('Imported'), archivedAt: null }] : [],
        answers,
      });
      test('creates new questions and attaches answers via key', async () => {
        const r = await store.applyImport(plan([{ date: '2026-10-01', ref: { key: 'n1' }, value: true, updated: '2026-10-01T00:00:00Z' }]), false);
        expect(r).toEqual({ questionsAdded: 1, answersAdded: 1, answersSkipped: 0 });
        const [q] = await store.listQuestions();
        expect((await store.getAnswers('2026-10-01'))[0]).toMatchObject({ questionId: q!.id, value: true, updated: '2026-10-01T00:00:00Z' });
      });
      test('archived import stays archived', async () => {
        await store.applyImport({ newQuestions: [{ key: 'a', question: yesno('Old'), archivedAt: '2026-01-01T00:00:00Z' }], answers: [] }, false);
        expect((await store.listQuestions({ includeArchived: true }))[0]!.archivedAt).toBe('2026-01-01T00:00:00Z');
      });
      test('skips existing answers unless overwrite', async () => {
        const q = await store.addQuestion(mood());
        await store.setAnswer('2026-10-01', q.id, 1);
        const p: ImportPlan = { newQuestions: [], answers: [{ date: '2026-10-01', ref: { id: q.id }, value: 9, updated: '2026-10-01T00:00:00Z' }] };
        expect(await store.applyImport(p, false)).toMatchObject({ answersAdded: 0, answersSkipped: 1 });
        expect((await store.getAnswers('2026-10-01'))[0]!.value).toBe(1);
        expect(await store.applyImport(p, true)).toMatchObject({ answersAdded: 1, answersSkipped: 0 });
        expect((await store.getAnswers('2026-10-01'))[0]!.value).toBe(9);
      });
      test('imported checkbox answers feed option usage', async () => {
        const q = await store.addQuestion(sym());
        await store.applyImport({ newQuestions: [], answers: [{ date: '2026-10-01', ref: { id: q.id }, value: ['Other'], updated: '2026-10-01T00:00:00Z' }] }, false);
        expect((await store.options(q.id)).map((x) => x.option)).toEqual(['Other']);
      });
      test('is atomic: one bad answer leaves nothing behind', async () => {
        const q = await store.addQuestion(mood());
        const bad = plan([
          { date: '2026-10-01', ref: { id: q.id }, value: 5, updated: 'T' },
          { date: '2026-10-02', ref: { id: q.id }, value: 99, updated: 'T' },
        ]);
        await expect(store.applyImport(bad, false)).rejects.toThrow();
        expect(await store.getAnswers('2026-10-01')).toEqual([]);
        expect((await store.listQuestions()).map((x) => x.label)).toEqual(['Mood']);
      });
      test('unknown ref rejects', async () => {
        await expect(store.applyImport({ newQuestions: [], answers: [{ date: '2026-10-01', ref: { key: 'nope' }, value: 1, updated: 'T' }] }, false)).rejects.toThrow();
      });
    });
  });
}
