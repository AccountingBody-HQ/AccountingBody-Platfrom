// Pure helpers of the Content Studio screen: the state rules, the request
// bodies (the exact shapes the server reads) and the display splits. Runs in
// the browser; imports only the wording and types.
import { WORDING } from '@/lib/content-studio/wording'
import type { PublishPayload } from '@/lib/content-studio/publish'

export type LevelId = (typeof WORDING.levelOptions)[number]['id']
export type Count = 10 | 20

export interface PlanRow { contentId: string; title: string; subjectTitle: string }
export interface PlanSubject { slug: string; title: string; poolSize: number; notesWithoutSet: number }
export interface PlanView {
  subjects: PlanSubject[]
  queue1: PlanRow[]
  queue1Total: number
  queue2: PlanRow[]
  queue2Total: number
  eticpaMissing: string[]
}

export interface NoteInfo {
  contentId: string
  title: string
  subjectTitle: string
  moduleLabel: string
  defaultLevel: LevelId
  needsValidAsAt: boolean
  setTitle: string | null
  setMessage: string | null
}

export interface Choices { noteId: string; level: LevelId; questionCount: Count; validAsAt?: string }

export interface Problem { message: string; path?: string }
export interface CardView {
  ok: boolean
  score: number
  problems: Problem[]
  warnings: Problem[]
  notChecked: string[]
}
export interface PreviewQuestion { questionText: string; options: string[]; correctIndex: number; explanation: string }
export interface CheckResult {
  card: CardView
  preview: PreviewQuestion[] | null
  publish: PublishPayload | null
  publishProblem: string | null
}

/** The answer a check was made from: pasted (Door 1) or the steps' answers (Door 2). */
export type Answer = { door: 'copy'; answer: string } | { door: 'generate'; parts: string[] }

export interface MakeState {
  note: NoteInfo | null
  busy: boolean
  answer: string
  result: CheckResult | null
  /** The answer the result was checked from. */
  checked: Answer | null
}

// ── State rules ──────────────────────────────────────────────────────────────

/** A note that is found and has no set yet: the make steps are open. */
export function canMake(note: NoteInfo | null): boolean {
  return note !== null && note.setMessage === null
}

export function canCheck(s: MakeState): boolean {
  return canMake(s.note) && !s.busy
}

/** Only the last check's payload, only while the answer it came from is unchanged. */
export function canPublish(s: MakeState): boolean {
  if (!canMake(s.note) || s.busy || !s.result || !s.result.publish || !s.checked) return false
  return s.checked.door === 'generate' || s.checked.answer === s.answer
}

/** What any change of note, level, count or date clears. */
export function clearOnChange() {
  return {
    prompt: null,
    answer: '',
    result: null,
    checked: null,
    reviewNotes: null,
    reviewPaste: '',
    message: null,
    published: null,
  } as const
}

// ── Display ──────────────────────────────────────────────────────────────────

export function foundLine(note: NoteInfo): string {
  return WORDING.found(note.title, note.subjectTitle, note.moduleLabel)
}

export function cardLines(card: CardView) {
  return {
    score: WORDING.score(card.score),
    verdict: card.ok ? WORDING.ready : WORDING.notReady,
    problemsTitle: WORDING.problems(card.problems.length),
    problems: card.problems.map(p => p.message),
    warningsTitle: WORDING.warnings(card.warnings.length),
    warnings: card.warnings.map(p => p.message),
    notChecked: card.notChecked,
  }
}

/** Today in London, written YYYY-MM-DD. */
export function londonToday(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function planUrl(apiBase: string, group?: 1 | 2, offset?: number): string {
  return group === undefined ? `${apiBase}/plan` : `${apiBase}/plan?group=${group}&offset=${offset ?? 0}`
}

// ── Request bodies (the exact shapes of the server) ──────────────────────────

export function choicesOf(note: NoteInfo, level: LevelId, questionCount: Count, validAsAt: string): Choices {
  return { noteId: note.contentId, level, questionCount, ...(note.needsValidAsAt ? { validAsAt } : {}) }
}

export const bodies = {
  find: (noteId: string) => ({ mode: 'find', noteId }),
  prompt: (c: Choices) => ({ mode: 'questions', ...c }),
  checkCopy: (c: Choices, answer: string) => ({ mode: 'questions', ...c, door: 'copy', answer }),
  checkGenerate: (c: Choices, parts: string[]) => ({ mode: 'questions', ...c, door: 'generate', parts }),
  generateStep: (c: Choices, step: number, earlier: string[]) => ({ kind: 'questions', ...c, step, earlier }),
  reviewPrompt: (c: Choices, a: Answer) => ({ mode: 'review', ...c, ...answerField(a) }),
  reviewGenerate: (c: Choices, a: Answer) => ({ kind: 'review', ...c, ...answerField(a) }),
  reviewCheck: (reviewAnswer: string) => ({ mode: 'review', reviewAnswer }),
  publish: (p: PublishPayload) => ({ bundle: p.bundle, articleSlug: p.articleSlug, registry: p.registry }),
}

function answerField(a: Answer): { answer: string } | { parts: string[] } {
  return a.door === 'copy' ? { answer: a.answer } : { parts: a.parts }
}

export function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

// ── Reading answers from the server ──────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The published set's id and question count from the publish route's answer, or null. */
export function publishedOf(body: unknown): { contentId: string; questionCount: number; linkWarning: string | null } | null {
  if (!isRecord(body) || typeof body.contentId !== 'string' || typeof body.questionCount !== 'number') return null
  return { contentId: body.contentId, questionCount: body.questionCount, linkWarning: typeof body.linkWarning === 'string' ? body.linkWarning : null }
}

export function errorOf(body: unknown, fallback: string): string {
  return isRecord(body) && typeof body.error === 'string' && body.error ? body.error : fallback
}
