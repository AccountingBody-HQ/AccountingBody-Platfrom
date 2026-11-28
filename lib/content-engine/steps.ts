// Door 2 ("Generate here") asks the AI for a practice set in steps of at most
// STEP_SIZE questions, so no single request runs out of time. A one-step set
// sends exactly the prompt Door 1 copies. The steps' answers are only joined
// together (mergeStepAnswers): no word of any answer is read or changed.
import { isRecord } from './blocks'
import type { CompiledPrompt } from './types'

export const STEP_SIZE = 10

/** index is 0-based; from and to are 1-based question numbers, inclusive. */
export interface StepPlan { index: number; total: number; from: number; to: number }

export interface EarlierQuestion { id: string; questionText: string; correctIndex: number }

const MAX_QUESTIONS = 25
const EARLIER_TEXT_MAX = 300
const LETTERS = ['A', 'B', 'C', 'D'] as const

/** The steps for a question count: 1–10 one step, 11–20 two, 21–25 three; anything else none. */
export function planSteps(questionCount: number): StepPlan[] {
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > MAX_QUESTIONS) return []
  const total = Math.ceil(questionCount / STEP_SIZE)
  const steps: StepPlan[] = []
  for (let index = 0; index < total; index++) {
    const from = index * STEP_SIZE + 1
    steps.push({ index, total, from, to: Math.min(questionCount, from + STEP_SIZE - 1) })
  }
  return steps
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, EARLIER_TEXT_MAX)
}

/** The prompt for one step: the compiled prompt itself for a one-step set, else the prompt and a step block. */
export function stepPromptText(compiled: CompiledPrompt, step: StepPlan, earlier: EarlierQuestion[]): string {
  if (step.total === 1) return compiled.text
  const counts = [0, 0, 0, 0]
  for (const q of earlier) {
    if (Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3) counts[q.correctIndex]++
  }
  const used = LETTERS.map((letter, i) => `${letter} ${counts[i]}`).join(', ')
  const whole = compiled.expected.questionCount ?? step.to
  const lines = [
    `STEP ${step.index + 1} OF ${step.total} (the site asks for this set in ${step.total} steps; everything above still applies to the whole set).`,
    `- Return the complete JSON exactly as the OUTPUT section says, with every envelope field, but put ONLY questions q${step.from} to q${step.to} in "questionSet" (ids exactly q${step.from} to q${step.to}, in order).`,
    `- The whole set has ${whole} questions; balance the correct answer positions across the whole set. Earlier steps used: ${used}.`,
    '- Do not repeat or overlap any question already written in an earlier step:',
    ...(earlier.length
      ? earlier.map(q => `  - [${q.id}] ${oneLine(q.questionText)}`)
      : ['  - (none: this is the first step)']),
  ]
  return compiled.text + '\n\n' + lines.join('\n')
}

/** The questions of a parsed answer that have an id, a question text and an answer position. Never throws. */
export function earlierQuestionsOf(value: unknown): EarlierQuestion[] {
  try {
    if (!isRecord(value) || !isRecord(value.questionSet) || !Array.isArray(value.questionSet.questions)) return []
    const out: EarlierQuestion[] = []
    for (const q of value.questionSet.questions) {
      if (!isRecord(q)) continue
      const { id, questionText, correctIndex } = q
      if (typeof id !== 'string') continue
      if (typeof questionText !== 'string' || questionText.trim() === '') continue
      if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue
      out.push({ id, questionText, correctIndex })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Joins the parsed answers of the steps, in step order, into one answer: the
 * first answer's envelope and every step's questions, the same objects in
 * order. It never reads or edits any text.
 */
export function mergeStepAnswers(values: unknown[]): { value: unknown; problems: string[] } {
  if (!Array.isArray(values) || values.length === 0) return { value: null, problems: ['There is no answer.'] }
  if (values.length === 1) return { value: values[0], problems: [] }
  const problems: string[] = []
  const lists: unknown[][] = []
  values.forEach((v, i) => {
    if (isRecord(v) && isRecord(v.questionSet) && Array.isArray(v.questionSet.questions)) {
      lists.push(v.questionSet.questions)
    } else {
      problems.push(`Step ${i + 1}: the answer has no question list.`)
    }
  })
  if (problems.length) return { value: null, problems }
  const first = values[0] as Record<string, unknown>
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(first)) {
    if (key !== 'questionSet') merged[key] = first[key]
  }
  merged.questionSet = { questions: lists.flat() }
  return { value: merged, problems: [] }
}
