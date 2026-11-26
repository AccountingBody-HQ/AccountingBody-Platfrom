// lib/mock-exam-question.ts — the rules both mock-exam APIs share for what
// they serve (app/api/mock-exam, app/api/eticpa/mock-exam).

export const MOCK_EXAM_MAX = 50

// The number of questions asked for: a whole number from 1 to 50. Anything
// else (missing, not a number, 0 or below) means the normal 50.
export function parseMockExamCount(raw: string | null): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n) || n < 1) return MOCK_EXAM_MAX
  return Math.min(MOCK_EXAM_MAX, n)
}

export interface QuestionRow {
  set_id: string
  question_text: unknown
  option_a: unknown
  option_b: unknown
  option_c: unknown
  option_d: unknown
  correct_index: unknown
  explanation?: unknown
  difficulty?: unknown
}

export interface PoolQuestion {
  questionText: string
  options:      string[]
  correctIndex: number
  explanation?: string
  difficulty?:  string
  sourceTitle:  string
  topic:        string
}

const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

// A question is served only whole: text, all four options filled in, and an
// answer that points at one of them. Anything else is skipped, so a blank
// option can never shift the letters and mark the wrong answer.
export function toServableQuestion(q: QuestionRow, setTitle: string): PoolQuestion | null {
  if (!filled(q.question_text)) return null
  const options = [q.option_a, q.option_b, q.option_c, q.option_d]
  if (!options.every(filled)) return null
  const answer = q.correct_index
  if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= 4) return null
  return {
    questionText: q.question_text,
    options:      options as string[],
    correctIndex: answer,
    explanation:  typeof q.explanation === 'string' ? q.explanation : undefined,
    difficulty:   typeof q.difficulty === 'string' ? q.difficulty : undefined,
    sourceTitle:  setTitle,
    topic:        setTitle.replace(/ [—-] Practice Questions$/, ''),
  }
}
