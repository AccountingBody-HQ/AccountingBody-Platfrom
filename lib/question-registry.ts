// The quality record of a practice set made in the Content Studio (D373): the
// prompt that made it, the AI model and the quality gate's score. The publish
// route checks it here before anything is read or written, and migration 0033
// holds the same rules as CHECK rules on question_sets.

export const REGISTRY_INVALID = 'Nothing was published. The quality record of this set is not valid.'

export type RegistryColumns = { prompt_id: string; prompt_version: string; model: string; quality_score: number }

export type EticpaColumns = { eticpa_level?: string; eticpa_module?: string }

const RECORD_KEYS = 'model,promptId,promptVersion,qualityScore'
const PROMPT_ID = /^[0-9a-f]{16}$/
const PROMPT_VERSION = /^[\x21-\x7e]+$/
const MODEL = /^[a-z0-9][a-z0-9.-]{0,99}$/
const ETICPA_PART = /^[a-z0-9-]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** No record (null) when none was sent; the four columns when it is valid; otherwise an error. */
export function parseRegistry(value: unknown): { ok: true; columns: RegistryColumns | null } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, columns: null }
  const invalid = { ok: false as const, error: REGISTRY_INVALID }
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== RECORD_KEYS) return invalid
  const { promptId, promptVersion, model, qualityScore } = value
  if (typeof promptId !== 'string' || !PROMPT_ID.test(promptId)) return invalid
  if (typeof promptVersion !== 'string' || promptVersion.length < 1 || promptVersion.length > 200 || !PROMPT_VERSION.test(promptVersion)) return invalid
  if (typeof model !== 'string' || !MODEL.test(model)) return invalid
  if (typeof qualityScore !== 'number' || !Number.isInteger(qualityScore) || qualityScore < 0 || qualityScore > 100) return invalid
  return { ok: true, columns: { prompt_id: promptId, prompt_version: promptVersion, model, quality_score: qualityScore } }
}

function part(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length >= 1 && t.length <= 100 && ETICPA_PART.test(t) ? t : null
}

/** An ETICPA study note's level and module, both or neither. */
export function eticpaColumnsOf(row: { eticpa_level?: unknown; eticpa_module?: unknown }): EticpaColumns {
  const level = part(row?.eticpa_level)
  const moduleSlug = part(row?.eticpa_module)
  return level !== null && moduleSlug !== null ? { eticpa_level: level, eticpa_module: moduleSlug } : {}
}
