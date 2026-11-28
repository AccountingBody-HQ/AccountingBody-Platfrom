// Turns a study note and the owner's three choices (level, count, date) into
// the engine's brief. Everything else comes from the note in the database.
import { isIsoDate } from '@/lib/content-engine/brief'
import { ETICPA_MODULES, LEVEL_IDS, SUBJECT_KEYS, toSubjectKey, validateBrief } from '@/lib/content-engine'
import type { Brief, LevelId, SubjectKey } from '@/lib/content-engine'
import type { StudyNote } from './note'
import { WORDING } from './wording'

export type Choices = { level: LevelId; questionCount: 10 | 20; validAsAt?: string }

const TOPIC_MAX = 300

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function defaultLevelOf(note: Pick<StudyNote, 'eticpaLevel'>): LevelId {
  if (note.eticpaLevel === 'level-1' || note.eticpaLevel === 'level-2') return 'eticpa-atq'
  if (note.eticpaLevel === 'level-3') return 'eticpa-cpa'
  return 'acca'
}

export function subjectOf(note: Pick<StudyNote, 'category' | 'categoryTitle'>): SubjectKey {
  if ((SUBJECT_KEYS as readonly string[]).includes(note.category)) return note.category as SubjectKey
  return toSubjectKey(note.categoryTitle || note.category)
}

export function needsValidAsAt(note: Pick<StudyNote, 'category' | 'categoryTitle'>): boolean {
  return subjectOf(note) === 'taxation'
}

/** The title, cut at the last space before 300 characters when it is longer. */
export function topicOf(title: string): string {
  const t = title.trim()
  if (t.length <= TOPIC_MAX) return t
  const cut = t.slice(0, TOPIC_MAX)
  const space = cut.lastIndexOf(' ')
  return (space > 0 ? cut.slice(0, space) : cut).trim()
}

/** The ETICPA level and module when they are one of the engine's open modules. */
export function eticpaOf(note: Pick<StudyNote, 'eticpaLevel' | 'eticpaModule'>): { level: string; module: string } | null {
  const { eticpaLevel: level, eticpaModule: moduleSlug } = note
  if (!level || !moduleSlug) return null
  return ETICPA_MODULES.some(m => m.level === level && m.module === moduleSlug) ? { level, module: moduleSlug } : null
}

export function briefFor(note: StudyNote, choices: Choices): { ok: true; brief: Brief } | { ok: false; message: string } {
  const topic = topicOf(note.title)
  const eticpa = eticpaOf(note)
  const brief: Brief = {
    contentType: 'practice-question-set',
    topic,
    level: choices.level,
    subject: subjectOf(note),
    jurisdiction: note.eticpaLevel && note.eticpaModule ? 'ethiopia' : 'uk-ifrs',
    ...(eticpa ? { eticpa } : {}),
    source: { contentId: note.contentId, title: topic, slug: note.slug, html: note.html },
    questionCount: choices.questionCount,
  }
  if (needsValidAsAt(note)) {
    if (!isIsoDate(choices.validAsAt)) return { ok: false, message: WORDING.validAsAtNeeded }
    brief.validAsAt = choices.validAsAt
  }
  const checked = validateBrief(brief)
  if (!checked.brief) return { ok: false, message: WORDING.somethingWrong }
  return { ok: true, brief: checked.brief }
}

/** The owner's choices from a request body, or null. */
export function parseChoices(body: unknown): Choices | null {
  if (!isRecord(body)) return null
  const { level, questionCount, validAsAt } = body
  if (typeof level !== 'string' || !(LEVEL_IDS as readonly string[]).includes(level)) return null
  if (questionCount !== 10 && questionCount !== 20) return null
  if (validAsAt !== undefined && typeof validAsAt !== 'string') return null
  return { level: level as LevelId, questionCount, ...(validAsAt !== undefined ? { validAsAt } : {}) }
}
