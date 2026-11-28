// Strict check of a brief. The compiler refuses any brief with an error and
// returns the findings instead; nothing here throws.
import { blueprintFor } from './blueprints/index'
import { isRecord } from './blocks'
import { ETICPA_LEVELS, ETICPA_MODULES } from './packs/jurisdictions'
import {
  CONTENT_TYPES,
  DIFFICULTIES,
  JURISDICTIONS,
  LEVEL_IDS,
  SUBJECT_KEYS,
  type Brief,
  type Finding,
} from './types'

const BRIEF_FIELDS = [
  'contentType', 'topic', 'level', 'subject', 'jurisdiction', 'difficulty', 'eticpa', 'source',
  'relatedNotes', 'avoidTitles', 'validAsAt', 'questionCount', 'question',
]

export const QUESTION_COUNT_DEFAULT = 20
export const QUESTION_COUNT_MIN = 10
export const QUESTION_COUNT_MAX = 25

/** A real calendar date written YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1) return false
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return d <= days[m - 1]
}

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).indexOf(value) >= 0
}

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

/** Strict check of a brief: the brief itself (unchanged) when there is no error, else null. */
export function validateBrief(value: unknown): { brief: Brief | null; findings: Finding[] } {
  const findings: Finding[] = []
  const fail = (field: string, message: string) =>
    findings.push({ check: 'brief.fields', severity: 'error', message, path: `brief.${field}` })

  if (!isRecord(value)) {
    fail('', 'The brief must be an object.')
    return { brief: null, findings }
  }
  for (const key of Object.keys(value)) {
    if (BRIEF_FIELDS.indexOf(key) < 0) fail(key, `The brief has an unexpected field "${key.slice(0, 40)}".`)
  }

  if (!oneOf(CONTENT_TYPES, value.contentType)) fail('contentType', 'The brief needs one of the 13 content types.')
  if (!isText(value.topic, 300)) fail('topic', 'The brief needs a topic (up to 300 characters).')
  if (!oneOf(LEVEL_IDS, value.level)) fail('level', 'The brief needs a known level.')
  if (!oneOf(SUBJECT_KEYS, value.subject)) fail('subject', 'The brief needs a known subject.')
  if (!oneOf(JURISDICTIONS, value.jurisdiction)) fail('jurisdiction', 'The brief needs a jurisdiction: uk-ifrs or ethiopia.')
  if ('difficulty' in value && !oneOf(DIFFICULTIES, value.difficulty)) fail('difficulty', 'The difficulty must be beginner, intermediate or advanced.')

  if ('eticpa' in value) {
    const e = value.eticpa
    if (!isRecord(e) || Object.keys(e).sort().join(',') !== 'level,module' || typeof e.level !== 'string' || typeof e.module !== 'string') {
      fail('eticpa', 'The ETICPA part needs exactly a level and a module.')
    } else if (ETICPA_LEVELS.indexOf(e.level) < 0) {
      fail('eticpa', 'The ETICPA level is not known.')
    } else if (!ETICPA_MODULES.some(m => m.level === e.level && m.module === e.module)) {
      fail('eticpa', 'The ETICPA module is not an open module of that level.')
    }
  }

  if ('source' in value) {
    const s = value.source
    const ok = isRecord(s) &&
      Object.keys(s).sort().join(',') === 'contentId,html,slug,title' &&
      typeof s.contentId === 'string' && isText(s.title, 300) && typeof s.slug === 'string' && isText(s.html, 2000000)
    if (!ok) fail('source', 'The source needs exactly contentId, title, slug and html, with a title and some html.')
  }

  if ('relatedNotes' in value) {
    const notes = value.relatedNotes
    const ok = Array.isArray(notes) && notes.length <= 50 && notes.every(n =>
      isRecord(n) && Object.keys(n).sort().join(',') === 'path,slug,title' &&
      isText(n.title, 300) && typeof n.slug === 'string' && typeof n.path === 'string' && /^\/[^\s]*$/.test(n.path))
    if (!ok) fail('relatedNotes', 'Each related note needs exactly a title, a slug and a path starting with "/".')
  }

  if ('avoidTitles' in value) {
    const titles = value.avoidTitles
    if (!Array.isArray(titles) || !titles.every(t => typeof t === 'string')) fail('avoidTitles', 'The titles to avoid must be a list of texts.')
  }

  if ('validAsAt' in value && !isIsoDate(value.validAsAt)) fail('validAsAt', 'The "valid as at" date must be a real date written YYYY-MM-DD.')
  const taxation = value.subject === 'taxation' || value.contentType === 'tax-guide'
  if (taxation && !('validAsAt' in value)) fail('validAsAt', 'A tax brief needs a "valid as at" date (YYYY-MM-DD).')

  const isQuestionSet = value.contentType === 'practice-question-set'
  if ('questionCount' in value) {
    const n = value.questionCount
    if (!isQuestionSet) fail('questionCount', 'Only a practice question set takes a question count.')
    else if (typeof n !== 'number' || !Number.isInteger(n) || n < QUESTION_COUNT_MIN || n > QUESTION_COUNT_MAX) {
      fail('questionCount', `The question count must be a whole number from ${QUESTION_COUNT_MIN} to ${QUESTION_COUNT_MAX}.`)
    }
  }
  if (isQuestionSet && !('source' in value)) fail('source', 'A practice question set needs a source note: every question is tied to one of its sections.')

  const isExplainer = value.contentType === 'question-explainer'
  if ('question' in value) {
    const q = value.question
    const ok = isRecord(q) &&
      Object.keys(q).sort().join(',') === 'correctIndex,explanation,options,questionText' &&
      isText(q.questionText, 5000) && typeof q.explanation === 'string' &&
      Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => isText(o, 1000)) &&
      typeof q.correctIndex === 'number' && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex <= 3
    if (!isExplainer) fail('question', 'Only a question explainer takes a question.')
    else if (!ok) fail('question', 'The question needs exactly questionText, four options, a correctIndex from 0 to 3 and an explanation.')
  } else if (isExplainer) {
    fail('question', 'A question explainer needs the question to explain.')
  }

  if (oneOf(CONTENT_TYPES, value.contentType) && oneOf(SUBJECT_KEYS, value.subject)) {
    const preset = blueprintFor(value.contentType).preset
    if (preset && preset.subject !== value.subject) {
      fail('subject', `The subject for this guide must be ${preset.subject}.`)
    }
  }

  return { brief: findings.length === 0 ? (value as unknown as Brief) : null, findings }
}
