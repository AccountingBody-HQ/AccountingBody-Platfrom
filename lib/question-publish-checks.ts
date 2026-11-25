// Checks a question bundle before it is published, and holds the exact
// wording the admin sees when a publish is refused or only partly linked.
//
// Structure only: is every part of a question there? Whether an answer is
// right is never judged here. Pure: no reads, no writes.

export type Reason =
  | 'text'
  | 'four-options'
  | 'empty-option'
  | 'placeholder-option'
  | 'same-options'
  | 'correct-answer'
  | 'explanation'
  | 'model-answer'
  | 'missing-case'

// n is the question's position in the set, counted from 1.
export type PublishProblem = { n: number; reason: Reason }
export type PublishCheck = { ok: true } | { ok: false; problems: PublishProblem[] }

export const REASON_TEXT: Record<Reason, string> = {
  'text':               'needs question text',
  'four-options':       'needs four answer options',
  'empty-option':       'has an empty answer option',
  'placeholder-option': 'has a placeholder answer option',
  'same-options':       'has two answer options that are the same',
  'correct-answer':     'needs one correct answer (A, B, C or D)',
  'explanation':        'needs an explanation',
  'model-answer':       'needs a model answer',
  'missing-case':       'refers to a missing case',
}

export const MAX_LISTED_PROBLEMS = 10

const PROBLEMS_PREFIX = 'Nothing was published. Please fix these questions first: '
const NOT_READY_PROBLEMS_PREFIX = 'Nothing was saved. This set cannot go live yet. Please fix these questions first: '

export const NOT_FOUND = 'Nothing was published. The linked article was not found. Check the Article ID and try again.'
export const LINK_FAILED =
  'Published. But the link from the article to this set could not be saved, so the article does not point to it yet.'
export const CASES_SAVE_FAILED = 'Could not save the case exhibits. Nothing was published.'
export const SET_READ_FAILED = 'Could not check for an existing practice set. Nothing was published.'
export const SLUG_READ_FAILED = 'Could not check the web address. Nothing was published.'
export const EMPTY_ADDRESS =
  'Nothing was published. The title needs at least one letter or number (A–Z or 0–9) so the set can have a web address.'
export const LEFT_DRAFT =
  'Nothing was published. Saving stopped part-way and a hidden draft set was left behind. Delete it in Questions, then publish again.'
export const PUBLISH_FAILED = 'Could not publish the set. Nothing was published.'
export const SLUG_LOCKED = 'The web address of a published set cannot be changed.'
export const UNLINK_FAILED =
  "Done. But the article's link to this set could not be removed, so the article may point to a missing page."
export const SET_CHECK_FAILED = 'Could not check this set. Nothing was saved.'
export const NOT_READY_EMPTY = 'Nothing was saved. This set has no questions yet, so it cannot go live.'
export const LAST_QUESTION =
  'Nothing was deleted. A live set must keep at least one question. Make the set a draft first, or delete the whole set.'
export const RESTORED_AS_DRAFT =
  'Restored as a draft, because the set is not complete. Fix it in Questions, then make it live.'
export const RESTORE_CHECK_FAILED =
  'Restored. But the set could not be checked or made a draft, so an incomplete set may be live. Check it in Questions.'

// The importer's warning when a paste does not show how it numbers its answers.
export function numberUnclearMessage(n: number): string {
  return `Q${n}: the correct answer is a number, and this paste does not show whether numbers start at 0 or 1. Use a letter (A, B, C or D) instead.`
}

export function alreadyHasSetMessage(setTitle: string): string {
  return `Nothing was published. This article already has a practice set: "${setTitle}". Add questions to that set instead.`
}

export function slugTakenMessage(slug: string): string {
  return `Nothing was published. Another practice set already uses the web address /practice-questions/${slug}. Change the title and try again.`
}

function problemsMessage(prefix: string, problems: PublishProblem[]): string {
  const listed = problems.slice(0, MAX_LISTED_PROBLEMS).map(({ n, reason }) => `Q${n} ${REASON_TEXT[reason]}`)
  const more = problems.length - listed.length
  return `${prefix}${listed.join('; ')}${more > 0 ? ` and ${more} more` : ''}.`
}

export function publishProblemsMessage(problems: PublishProblem[]): string {
  return problemsMessage(PROBLEMS_PREFIX, problems)
}

export function notReadyProblemsMessage(problems: PublishProblem[]): string {
  return problemsMessage(NOT_READY_PROBLEMS_PREFIX, problems)
}

export function fixThisQuestionMessage(reasons: Reason[]): string {
  return `Nothing was saved. Please fix this question first: ${reasons.map((reason) => REASON_TEXT[reason]).join('; ')}.`
}

// The text the publish route would store, trimmed. Anything that is not text
// or a number (an object, a list, nothing) counts as empty.
function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function isPlaceholder(option: string): boolean {
  return option === '—' || option === '-' || /^option\s+[a-d]$/i.test(option)
}

function optionReasons(options: unknown): Reason[] {
  if (!Array.isArray(options) || options.length !== 4) return ['four-options']
  const texts = Array.from(options, textOf)
  const reasons: Reason[] = []
  if (texts.some((text) => text === '')) reasons.push('empty-option')
  if (texts.some(isPlaceholder)) reasons.push('placeholder-option')
  // Empty and placeholder options have their own reason.
  const real = texts.filter((text) => text !== '' && !isPlaceholder(text)).map((text) => text.toLowerCase())
  if (new Set(real).size !== real.length) reasons.push('same-options')
  return reasons
}

// The cases a question can refer to, named as the public page names them. A
// case without an exhibit has nothing to show.
function caseIdsOf(cases: unknown): Set<string> {
  const ids = new Set<string>()
  for (const value of Array.isArray(cases) ? cases : []) {
    const c = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
    if (textOf(c.caseId) && textOf(c.exhibitHtml)) ids.add(String(c.caseId))
  }
  return ids
}

// caseIds null: the question's case is not looked at.
function questionReasons(value: unknown, caseIds: Set<string> | null): Reason[] {
  const q = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const reasons: Reason[] = []
  if (!textOf(q.questionText)) reasons.push('text')

  if (q.type === 'writing') {
    if (!textOf(q.writingModelAnswer)) reasons.push('model-answer')
    return reasons
  }

  // 'multiple-choice' and 'scenario'. Any other type is stored and shown as a
  // question with options, so it needs the same parts.
  reasons.push(...optionReasons(q.options))
  const { correctIndex } = q
  if (typeof correctIndex !== 'number' || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
    reasons.push('correct-answer')
  }
  if (!textOf(q.explanation)) reasons.push('explanation')
  if (caseIds && q.type === 'scenario' && q.caseId != null && q.caseId !== '' && !caseIds.has(String(q.caseId))) {
    reasons.push('missing-case')
  }
  return reasons
}

// The caller has already refused a bundle without questions.
export function checkPublishBundle(bundle: { questions: unknown[]; cases?: unknown }): PublishCheck {
  const caseIds = caseIdsOf(bundle.cases)
  const problems: PublishProblem[] = []
  bundle.questions.forEach((question, i) => {
    for (const reason of questionReasons(question, caseIds)) problems.push({ n: i + 1, reason })
  })
  return problems.length === 0 ? { ok: true } : { ok: false, problems }
}

// The columns the checks below read.
export const CHECKED_QUESTION_COLUMNS =
  'type, question_text, option_a, option_b, option_c, option_d, correct_index, explanation, writing_model_answer, case_id'
export const CHECKED_CASE_COLUMNS = 'case_id, exhibit_html'

type StoredRow = Record<string, unknown>

// A row of `questions` as the question it was published from.
function asQuestion(row: StoredRow) {
  return {
    type: row.type,
    questionText: row.question_text,
    options: [row.option_a, row.option_b, row.option_c, row.option_d],
    correctIndex: row.correct_index,
    explanation: row.explanation,
    writingModelAnswer: row.writing_model_answer,
    caseId: row.case_id,
  }
}

// One stored question, or one that is about to be stored. Its case is not
// looked at: the set editor cannot add one, so an edit must not depend on it.
export function storedQuestionReasons(row: StoredRow): Reason[] {
  return questionReasons(asQuestion(row), null)
}

// A stored set that is about to go live: its questions in order, and its cases.
export function checkStoredSet(questions: StoredRow[], cases: StoredRow[]): PublishCheck {
  return checkPublishBundle({
    questions: questions.map(asQuestion),
    cases: cases.map((row) => ({ caseId: row.case_id, exhibitHtml: row.exhibit_html })),
  })
}
