import type { AnswerValue, QuestionType } from '../domain/question';

/** encodeValue renders an answer as one CSV cell. Checkbox values join with "|". */
export function encodeValue(type: QuestionType, v: AnswerValue): string {
  switch (type) {
    case 'scale':
    case 'number':
      return String(v);
    case 'yesno':
      return v ? 'true' : 'false';
    case 'checkboxes':
      return (v as string[]).join('|');
    default:
      return v as string;
  }
}

/** decodeValue is encodeValue's inverse; null means the cell cannot be read. */
export function decodeValue(type: QuestionType, s: string): AnswerValue | null {
  switch (type) {
    case 'scale':
    case 'number': {
      if (s.trim() === '') return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    case 'yesno':
      return s === 'true' ? true : s === 'false' ? false : null;
    case 'checkboxes':
      return s === '' ? [] : s.split('|');
    default:
      return s;
  }
}
