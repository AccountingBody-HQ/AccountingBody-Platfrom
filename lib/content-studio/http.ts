// The Content Studio's four admin API handlers. Each checks the session first,
// reads its body field by field, rebuilds the brief from the database and
// recompiles the prompt; nothing the browser sends is trusted as a prompt.
// None of them writes to the database: publishing goes through the existing
// publish route.
import { NextResponse, type NextRequest } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import {
  compilePrompt,
  compileReviewerPrompt,
  earlierQuestionsOf,
  extractJson,
  isCompiled,
  mergeStepAnswers,
  parseReviewerNotes,
  planSteps,
  runGate,
  stepPromptText,
} from '@/lib/content-engine'
import type { Brief, CompiledPrompt, Finding, Scorecard } from '@/lib/content-engine'
import { alreadyHasSetMessage } from '@/lib/question-publish-checks'
import { reportServerError } from '@/lib/report-error'
import { askAi } from './ai'
import { briefFor, defaultLevelOf, needsValidAsAt, parseChoices } from './brief'
import { MAX_ANSWER_CHARS, MAX_OUTPUT_TOKENS_QUESTIONS, MAX_OUTPUT_TOKENS_REVIEW, MAX_STEPS, PLAN_PAGE_SIZE } from './config'
import { estimateUsd, formatUsd, stepInputSizes } from './cost'
import { normaliseNoteId, readStudyNote, type StudyNote } from './note'
import { buildPlan, moduleTitleOf } from './plan'
import { publishPayloadOf, type Door } from './publish'
import { NO_MODULE_LABEL, WORDING } from './wording'

export const MAX_BODY_CHARS = 2000000

type Body = Record<string, unknown>

const CHOICE_FIELDS = ['noteId', 'level', 'questionCount', 'validAsAt']
const OPTIONAL_FIELDS = ['validAsAt', 'answer', 'parts']

/** The allowed fields of each request kind (the mode or kind field included). */
export const FIELDS = {
  promptFind: ['mode', 'noteId'],
  promptQuestions: ['mode', ...CHOICE_FIELDS],
  promptReview: ['mode', ...CHOICE_FIELDS, 'answer', 'parts'],
  checkQuestions: ['mode', ...CHOICE_FIELDS, 'door', 'answer', 'parts'],
  checkReview: ['mode', 'reviewAnswer'],
  generateQuestions: ['kind', ...CHOICE_FIELDS, 'step', 'earlier'],
  generateReview: ['kind', ...CHOICE_FIELDS, 'answer', 'parts'],
} as const

// ── Answers ──────────────────────────────────────────────────────────────────

function reply(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** An expected refusal with its own answer; never reported. */
class Refusal extends Error {
  constructor(readonly status: number, readonly error: string) {
    super('content studio: refused')
    this.name = 'Refusal'
  }
}

const bad = () => new Refusal(400, WORDING.somethingWrong)

function refusal(r: Refusal): NextResponse {
  return reply({ error: r.error }, r.status)
}

async function guarded(run: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof Refusal) return refusal(error)
    reportServerError('admin content studio request failed', error, { area: 'admin' })
    return reply({ error: WORDING.somethingWrong }, 500)
  }
}

// ── Reading the body ─────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Body {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readBody(req: NextRequest): Promise<Body> {
  const raw = await req.text()
  if (raw.length > MAX_BODY_CHARS) throw bad()
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw bad()
  }
  if (!isRecord(value)) throw bad()
  return value
}

/** Only the listed fields, and every listed field that is not optional. */
function onlyFields(body: Body, fields: readonly string[]): void {
  for (const key of Object.keys(body)) if (!fields.includes(key)) throw bad()
  for (const key of fields) if (!OPTIONAL_FIELDS.includes(key) && !(key in body)) throw bad()
}

function answerText(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_ANSWER_CHARS) throw bad()
  if (value.trim() === '') throw new Refusal(400, WORDING.pasteFirst)
  return value
}

function partTexts(value: unknown, count: number): string[] {
  if (!Array.isArray(value) || value.length !== count || value.length > MAX_STEPS) throw bad()
  return value.map(answerText)
}

// ── The note, the brief and the prompt ───────────────────────────────────────

async function noteFor(rawId: unknown): Promise<StudyNote> {
  const id = normaliseNoteId(rawId)
  if (!id) throw new Refusal(404, WORDING.notFound)
  const read = await readStudyNote(id)
  if (read.kind === 'error') throw new Refusal(500, WORDING.somethingWrong)
  if (read.kind === 'not-found') throw new Refusal(404, WORDING.notFound)
  return read.note
}

interface Prepared { note: StudyNote; brief: Brief; compiled: CompiledPrompt; questionCount: number }

async function prepare(body: Body): Promise<Prepared> {
  const choices = parseChoices(body)
  if (!choices) throw bad()
  const note = await noteFor(body.noteId)
  const made = briefFor(note, choices)
  if (!made.ok) throw new Refusal(400, made.message)
  const compiled = compilePrompt(made.brief)
  if (!isCompiled(compiled)) throw new Refusal(500, WORDING.somethingWrong)
  return { note, brief: made.brief, compiled, questionCount: choices.questionCount }
}

// ── Checking an answer ───────────────────────────────────────────────────────

interface Checked { card: Scorecard; extraProblems: string[] }

/** The answer of one door: pasted (copy) or the steps' answers joined (generate). */
function checkAnswer(compiled: CompiledPrompt, questionCount: number, answer: string | null, parts: string[] | null): Checked {
  if (answer !== null) return { card: runGate(answer, compiled), extraProblems: [] }
  const steps = planSteps(questionCount).length
  const texts = parts ?? []
  if (texts.length !== steps) throw bad()
  const problems: string[] = []
  const values = texts.map((text, i) => {
    const parsed = extractJson(text)
    const failed = parsed.findings.find(f => f.check === 'parse.json')
    if (failed) problems.push(`Step ${i + 1}: ${failed.message}`)
    return parsed.value
  })
  if (problems.length === 0) {
    const merged = mergeStepAnswers(values)
    problems.push(...merged.problems)
    if (problems.length === 0) return { card: runGate(merged.value, compiled), extraProblems: [] }
  }
  // Not ready: the empty scorecard keeps the "not checked" lines.
  const empty = runGate('', compiled)
  return { card: { ...empty, findings: [], output: null }, extraProblems: problems }
}

/** Exactly one of answer / parts, for a review. */
function oneAnswer(body: Body, questionCount: number): { answer: string | null; parts: string[] | null } {
  const hasAnswer = body.answer !== undefined
  const hasParts = body.parts !== undefined
  if (hasAnswer === hasParts) throw bad()
  return hasAnswer
    ? { answer: answerText(body.answer), parts: null }
    : { answer: null, parts: partTexts(body.parts, planSteps(questionCount).length) }
}

function shown(findings: Finding[], severity: 'error' | 'warning') {
  return findings
    .filter(f => f.severity === severity)
    .map(f => (f.path !== undefined ? { message: f.message, path: f.path } : { message: f.message }))
}

function previewOf(card: Scorecard) {
  const output = card.output
  if (!output || !('questionSet' in output)) return null
  return output.questionSet.questions.map(q => ({
    questionText: q.questionText,
    options: q.options,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  }))
}

/** The reviewer's prompt for an answer that has the right shape. */
function reviewerText(p: Prepared, body: Body): string {
  const { answer, parts } = oneAnswer(body, p.questionCount)
  const { card, extraProblems } = checkAnswer(p.compiled, p.questionCount, answer, parts)
  if (extraProblems.length > 0 || !card.output) throw new Refusal(400, WORDING.notReady)
  const reviewer = compileReviewerPrompt(p.brief, JSON.stringify(card.output))
  if (!isCompiled(reviewer)) throw new Refusal(500, WORDING.somethingWrong)
  return reviewer.text
}

// ── The handlers ─────────────────────────────────────────────────────────────

export async function handlePlan(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated(req))) return signedOutResponse()
  return guarded(async () => {
    const params = req.nextUrl.searchParams
    const group = params.get('group')
    const offsetText = params.get('offset')
    params.forEach((_value, key) => {
      if (key !== 'group' && key !== 'offset') throw bad()
    })
    if ((group === null) !== (offsetText === null)) throw bad()
    let offset = 0
    if (group !== null) {
      if (group !== '1' && group !== '2') throw bad()
      if (!/^[0-9]{1,9}$/.test(offsetText ?? '')) throw bad()
      offset = Number(offsetText)
    }
    const built = await buildPlan()
    if (!built.ok) return reply({ error: WORDING.planFailed }, 500)
    const { plan } = built
    if (group === null) {
      return reply({
        subjects: plan.subjects,
        queue1: plan.queue1.slice(0, PLAN_PAGE_SIZE),
        queue1Total: plan.queue1.length,
        queue2: plan.queue2.slice(0, PLAN_PAGE_SIZE),
        queue2Total: plan.queue2.length,
        eticpaMissing: plan.eticpaMissing,
      })
    }
    const rows = group === '1' ? plan.queue1 : plan.queue2
    return reply({ group, offset, rows: rows.slice(offset, offset + PLAN_PAGE_SIZE), total: rows.length })
  })
}

export async function handlePrompt(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated(req))) return signedOutResponse()
  return guarded(async () => {
    const body = await readBody(req)
    if (body.mode === 'find') {
      onlyFields(body, FIELDS.promptFind)
      const note = await noteFor(body.noteId)
      return reply({
        note: {
          contentId: note.contentId,
          title: note.title,
          subjectTitle: note.categoryTitle || note.category,
          moduleLabel: moduleTitleOf(note.eticpaLevel, note.eticpaModule) ?? NO_MODULE_LABEL,
          defaultLevel: defaultLevelOf(note),
          needsValidAsAt: needsValidAsAt(note),
          setTitle: note.setTitle,
          setMessage: note.setTitle ? alreadyHasSetMessage(note.setTitle) : null,
        },
      })
    }
    if (body.mode === 'questions') {
      onlyFields(body, FIELDS.promptQuestions)
      const p = await prepare(body)
      const steps = planSteps(p.questionCount).length
      return reply({
        text: p.compiled.text,
        promptId: p.compiled.promptId,
        promptVersion: p.compiled.promptVersion,
        steps,
        estimate: formatUsd(estimateUsd(stepInputSizes(p.compiled.text.length, steps), MAX_OUTPUT_TOKENS_QUESTIONS)),
      })
    }
    if (body.mode === 'review') {
      onlyFields(body, FIELDS.promptReview)
      const p = await prepare(body)
      const text = reviewerText(p, body)
      return reply({ text, estimate: formatUsd(estimateUsd([text.length], MAX_OUTPUT_TOKENS_REVIEW)) })
    }
    throw bad()
  })
}

export async function handleCheck(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated(req))) return signedOutResponse()
  return guarded(async () => {
    const body = await readBody(req)
    if (body.mode === 'review') {
      onlyFields(body, FIELDS.checkReview)
      if (typeof body.reviewAnswer !== 'string' || body.reviewAnswer.length > MAX_ANSWER_CHARS) throw bad()
      if (body.reviewAnswer.trim() === '') throw new Refusal(400, WORDING.pasteFirst)
      const notes = parseReviewerNotes(body.reviewAnswer)
      return reply(notes.ok ? { ok: true, notes: notes.notes } : { ok: false, error: notes.message })
    }
    if (body.mode !== 'questions') throw bad()
    onlyFields(body, FIELDS.checkQuestions)
    const door = body.door
    if (door !== 'copy' && door !== 'generate') throw bad()
    if (door === 'copy' && (body.answer === undefined || body.parts !== undefined)) throw bad()
    if (door === 'generate' && (body.parts === undefined || body.answer !== undefined)) throw bad()
    const choices = parseChoices(body)
    if (!choices) throw bad()
    const answer = door === 'copy' ? answerText(body.answer) : null
    const parts = door === 'generate' ? partTexts(body.parts, planSteps(choices.questionCount).length) : null
    const p = await prepare(body)
    const { card, extraProblems } = checkAnswer(p.compiled, p.questionCount, answer, parts)
    const ready = card.ok && extraProblems.length === 0
    const made = ready ? publishPayloadOf(p.note, p.compiled, card, door as Door) : null
    return reply({
      card: {
        ok: ready,
        score: extraProblems.length ? 0 : card.score,
        problems: [...extraProblems.map(message => ({ message })), ...shown(card.findings, 'error')],
        warnings: shown(card.findings, 'warning'),
        notChecked: card.notChecked,
        stats: card.stats,
      },
      preview: previewOf(card),
      publish: made && made.ok ? made.payload : null,
      publishProblem: made && !made.ok ? made.message : null,
    })
  })
}

export async function handleGenerate(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthenticated(req))) return signedOutResponse()
  return guarded(async () => {
    const body = await readBody(req)
    if (body.kind === 'questions') {
      onlyFields(body, FIELDS.generateQuestions)
      const choices = parseChoices(body)
      if (!choices) throw bad()
      const plan = planSteps(choices.questionCount)
      const step = body.step
      if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step >= plan.length) throw bad()
      const earlier = body.earlier
      if (!Array.isArray(earlier) || earlier.length !== step) throw bad()
      const earlierTexts = earlier.map(answerText)
      const p = await prepare(body)
      const earlierQs = earlierTexts.flatMap(text => earlierQuestionsOf(extractJson(text).value))
      const text = stepPromptText(p.compiled, plan[step], earlierQs)
      const answer = await askAi(text, MAX_OUTPUT_TOKENS_QUESTIONS)
      if (!answer.ok) return reply({ error: WORDING.aiFailed }, 502)
      return reply({ raw: answer.text, step, steps: plan.length })
    }
    if (body.kind === 'review') {
      onlyFields(body, FIELDS.generateReview)
      const p = await prepare(body)
      const text = reviewerText(p, body)
      const answer = await askAi(text, MAX_OUTPUT_TOKENS_REVIEW)
      if (!answer.ok) return reply({ error: WORDING.aiFailed }, 502)
      return reply({ raw: answer.text })
    }
    throw bad()
  })
}
