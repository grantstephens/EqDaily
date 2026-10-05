import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

import { parseRfc3339, tryParseDate, type JournalDate } from '../domain/date';
import { planImport, type IncomingAnswer, type IncomingQuestion } from '../domain/importPlan';
import {
  QUESTION_TYPES, validateQuestion,
  type NewQuestion, type QuestionType,
} from '../domain/question';
import type { ImportCounts, Store } from '../domain/store';
import { parseCsv, writeRow } from './format';
import { decodeValue, encodeValue } from './values';

export const ANSWERS_HEADER = ['date', 'question', 'type', 'value', 'updated'];
export const QUESTIONS_HEADER = ['label', 'type', 'config_json', 'sort', 'archived'];

const BOM = '﻿';

export type BundleFile = 'answers.csv' | 'questions.csv' | 'zip';

/** RowError's row is 1-based and counts the header, matching a spreadsheet. */
export interface RowError { row: number; file: BundleFile; message: string }
export interface BundleImportResult extends ImportCounts { errors: RowError[] }

export function formatRowError(e: RowError): string {
  return e.file === 'zip' ? e.message : `${e.file} row ${e.row}: ${e.message}`;
}

export function exportFileName(today: JournalDate): string {
  return `eqdaily-${today}.zip`;
}

/** exportBundle zips questions.csv (every question, archived included) and answers.csv. */
export async function exportBundle(store: Store): Promise<Uint8Array> {
  const questions = await store.listQuestions({ includeArchived: true });
  const index = new Map(questions.map((q, i) => [q.id, i]));

  let questionsCsv = writeRow(QUESTIONS_HEADER);
  questions.forEach((q, i) => {
    questionsCsv += writeRow([
      q.label, q.type, JSON.stringify({ ...q.config, hideFromInsights: q.hideFromInsights }),
      String(i), q.archivedAt ?? '',
    ]);
  });

  const answers = [];
  for await (const a of store.allAnswers()) answers.push(a);
  answers.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : index.get(a.questionId)! - index.get(b.questionId)!));

  let answersCsv = writeRow(ANSWERS_HEADER);
  for (const a of answers) {
    const q = questions[index.get(a.questionId)!]!;
    answersCsv += writeRow([a.date, q.label, q.type, encodeValue(q.type, a.value), a.updated]);
  }

  return zipSync({ 'questions.csv': strToU8(questionsCsv), 'answers.csv': strToU8(answersCsv) });
}

interface Table { rows: { row: number; f: Record<string, string> }[]; errors: RowError[] }

function parseTable(file: BundleFile, text: string, header: string[]): Table {
  const errors: RowError[] = [];
  const records = parseCsv(text.startsWith(BOM) ? text.slice(1) : text);
  if (records.length === 0) {
    return { rows: [], errors: [{ row: 1, file, message: 'file is empty' }] };
  }
  const head = records[0]!;
  if (head.fields === null) {
    return { rows: [], errors: [{ row: head.row, file, message: head.error ?? 'unreadable header' }] };
  }
  for (const col of head.fields) {
    if (!header.includes(col.trim())) errors.push({ row: 1, file, message: `unknown column "${col}"` });
  }
  for (const col of header) {
    if (!head.fields.map((c) => c.trim()).includes(col)) errors.push({ row: 1, file, message: `missing column "${col}"` });
  }
  if (errors.length > 0) return { rows: [], errors };

  const names = head.fields.map((c) => c.trim());
  const rows: Table['rows'] = [];
  for (const rec of records.slice(1)) {
    if (rec.fields === null) { errors.push({ row: rec.row, file, message: rec.error ?? 'unreadable row' }); continue; }
    if (rec.fields.length !== names.length) {
      errors.push({ row: rec.row, file, message: `expected ${names.length} fields, found ${rec.fields.length}` });
      continue;
    }
    rows.push({ row: rec.row, f: Object.fromEntries(names.map((n, i) => [n, rec.fields![i]!])) });
  }
  return { rows, errors };
}

const isType = (t: string): t is QuestionType => (QUESTION_TYPES as string[]).includes(t);

/**
 * importBundle parses and validates the whole bundle first; if anything is
 * wrong it returns every error and writes nothing. Otherwise the plan is
 * applied atomically.
 */
export async function importBundle(store: Store, bytes: Uint8Array, overwrite: boolean): Promise<BundleImportResult> {
  const none: ImportCounts = { questionsAdded: 0, answersAdded: 0, answersSkipped: 0 };
  const fail = (errors: RowError[]): BundleImportResult => ({ ...none, errors });

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    return fail([{ row: 0, file: 'zip', message: 'This is not a valid EqDaily export (it could not be opened as a zip).' }]);
  }
  const missing = (['questions.csv', 'answers.csv'] as const).filter((f) => !entries[f]);
  if (missing.length > 0) {
    return fail(missing.map((f) => ({ row: 0, file: 'zip' as const, message: `The export is missing ${f}.` })));
  }

  const errors: RowError[] = [];
  const qTable = parseTable('questions.csv', strFromU8(entries['questions.csv']!), QUESTIONS_HEADER);
  const aTable = parseTable('answers.csv', strFromU8(entries['answers.csv']!), ANSWERS_HEADER);
  errors.push(...qTable.errors, ...aTable.errors);

  const incomingQuestions: IncomingQuestion[] = [];
  for (const { row, f } of qTable.rows) {
    const bad = (message: string) => errors.push({ row, file: 'questions.csv', message });
    if (!isType(f.type!)) { bad(`unknown question type "${f.type}"`); continue; }
    let config: unknown;
    try { config = JSON.parse(f.config_json!); } catch { bad('config_json is not valid JSON'); continue; }
    if (typeof config !== 'object' || config === null || Array.isArray(config)) { bad('config_json must be a JSON object'); continue; }
    const { hideFromInsights, ...rest } = config as Record<string, unknown>;
    let archivedAt: string | null = null;
    if (f.archived !== '') {
      archivedAt = parseRfc3339(f.archived!);
      if (archivedAt === null) { bad(`invalid archived timestamp "${f.archived}"`); continue; }
    }
    const nq = { label: f.label!, type: f.type, config: rest, hideFromInsights: hideFromInsights === true } as NewQuestion;
    const err = validateQuestion(nq);
    if (err) { bad(err); continue; }
    incomingQuestions.push({ label: f.label!, type: f.type, config: rest, hideFromInsights: nq.hideFromInsights, archivedAt });
  }

  const incomingAnswers: IncomingAnswer[] = [];
  for (const { row, f } of aTable.rows) {
    const bad = (message: string) => errors.push({ row, file: 'answers.csv', message });
    const date = tryParseDate(f.date!);
    if (date === null) { bad(`invalid date "${f.date}"`); continue; }
    if (!isType(f.type!)) { bad(`unknown question type "${f.type}"`); continue; }
    const value = decodeValue(f.type, f.value!);
    if (value === null) { bad(`cannot read value "${f.value}" as ${f.type}`); continue; }
    const updated = parseRfc3339(f.updated!);
    if (updated === null) { bad(`invalid timestamp "${f.updated}"`); continue; }
    incomingAnswers.push({ date, label: f.question!, type: f.type, value, updated, row });
  }

  const planned = planImport(await store.listQuestions({ includeArchived: true }), incomingQuestions, incomingAnswers);
  for (const e of planned.errors) errors.push({ row: e.row, file: 'answers.csv', message: e.message });

  if (errors.length > 0) return fail(errors);
  return { ...(await store.applyImport(planned.plan, overwrite)), errors: [] };
}
