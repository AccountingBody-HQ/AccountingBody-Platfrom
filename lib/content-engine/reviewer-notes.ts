// Reads the optional second opinion (decision G): a findings list only. The
// notes are shown to the owner and never applied to the content.
import { isRecord } from './blocks'
import { extractJson } from './parse'

export interface ReviewerNote { where: string; problem: string; suggestion: string }

const NO_JSON = 'The second opinion has no JSON.'
const BAD_SHAPE = 'The second opinion is not in the expected shape.'
const MAX_NOTES = 50
const MAX_TEXT = 1200
const NOTE_KEYS = 'problem,suggestion,where'

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length >= 1 && t.length <= MAX_TEXT ? t : null
}

/** The reviewer's notes, or a message saying why they could not be read. Never throws. */
export function parseReviewerNotes(raw: string): { ok: true; notes: ReviewerNote[] } | { ok: false; message: string } {
  try {
    const parsed = extractJson(raw)
    if (parsed.findings.some(f => f.check === 'parse.json')) return { ok: false, message: NO_JSON }
    const value = parsed.value
    if (!isRecord(value) || Object.keys(value).join(',') !== 'findings') return { ok: false, message: BAD_SHAPE }
    const list = value.findings
    if (!Array.isArray(list) || list.length > MAX_NOTES) return { ok: false, message: BAD_SHAPE }
    const notes: ReviewerNote[] = []
    for (const item of list) {
      if (!isRecord(item) || Object.keys(item).sort().join(',') !== NOTE_KEYS) return { ok: false, message: BAD_SHAPE }
      const where = text(item.where)
      const problem = text(item.problem)
      const suggestion = text(item.suggestion)
      if (where === null || problem === null || suggestion === null) return { ok: false, message: BAD_SHAPE }
      notes.push({ where, problem, suggestion })
    }
    return { ok: true, notes }
  } catch {
    return { ok: false, message: BAD_SHAPE }
  }
}
