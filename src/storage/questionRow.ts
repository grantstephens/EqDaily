import type { NewQuestion, Question } from '../domain/question';

export interface QuestionRow {
  id: number; label: string; type: string; config: string;
  sort: number; archived_at: string | null; created: string;
}

/** hideFromInsights lives inside the config JSON so the schema stays as specified. */
export function toConfigJson(q: NewQuestion): string {
  return JSON.stringify({ ...q.config, hideFromInsights: q.hideFromInsights });
}

export function fromRow(r: QuestionRow): Question {
  const { hideFromInsights, ...config } = JSON.parse(r.config) as Record<string, unknown> & { hideFromInsights?: boolean };
  return {
    id: r.id, label: r.label, type: r.type, config, hideFromInsights: hideFromInsights === true,
    sort: r.sort, archivedAt: r.archived_at, created: r.created,
  } as Question;
}
