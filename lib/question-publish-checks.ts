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
}

export const MAX_LISTED_PROBLEMS = 10

const PROBLEMS_PREFIX = 'Nothing was published. Please fix these questions first: '

export const NOT_FOUND = 'Nothing was published. The linked article was not found. Check the Article ID and try again.'
export const LINK_FAILED =
  'Published. But the link from the article to this set could not be saved, so the article does not point to it yet.'
export const CASES_FAILED =
  'Published. But the case exhibits could not be saved, so scenario questions may show without their case.'
export const SET_READ_FAILED = 'Could not check for an existing practice set. Nothing was published.'
export const SLUG_READ_FAILED = 'Could not check the web address. Nothing was published.'

export function alreadyHasSetMessage(setTitle: string): string {
  return `Nothing was published. This article already has a practice set: "${setTitle}". Add questions to that set instead.`
}

export function slugTakenMessage(slug: string): string {
  return `Nothing was published. Another practice set already uses the web address /practice-questions/${slug}. Change the title and try again.`
}

export function publishProblemsMessage(problems: PublishProblem[]): string {
  const listed = problems.slice(0, MAX_LISTED_PROBLEMS).map(({ n, reason }) => `Q${n} ${REASON_TEXT[reason]}`)
  const more = problems.length - listed.length
  return `${PROBLEMS_PREFIX}${listed.join('; ')}${more > 0 ? ` and ${more} more` : ''}.`
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

function questionReasons(value: unknown): Reason[] {
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
  return reasons
}

// The caller has already refused a bundle without questions.
export function checkPublishBundle(bundle: { questions: unknown[] }): PublishCheck {
  const problems: PublishProblem[] = []
  bundle.questions.forEach((question, i) => {
    for (const reason of questionReasons(question)) problems.push({ n: i + 1, reason })
  })
  return problems.length === 0 ? { ok: true } : { ok: false, problems }
}
