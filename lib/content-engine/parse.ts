// Tolerant JSON reading. Strategies 1-3 are the question generator's
// extractJSON, ported exactly; strategy 4 is new and repairs only JSON
// punctuation (smart quotes used as string delimiters, trailing commas), never
// a word of content. Returns findings instead of throwing.
import type { Finding } from './types'

function tryParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

/** The three strategies of the old extractJSON; null when all three fail. */
function threeStrategies(stripped: string): { value: unknown; trimmedAround: boolean } | null {
  // Strategy 1: direct parse after stripping fences
  const direct = tryParse(stripped)
  if (direct.ok) return { value: direct.value, trimmedAround: false }

  // Strategy 2: slice from first { to last }
  const s = stripped.indexOf('{')
  const e = stripped.lastIndexOf('}')
  if (s >= 0 && e > s) {
    const sliced = tryParse(stripped.slice(s, e + 1))
    if (sliced.ok) return { value: sliced.value, trimmedAround: true }
  }

  // Strategy 3: brace-count to find the outermost complete object
  let depth = 0
  let start = -1
  let inString = false
  let escape = false
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        const counted = tryParse(stripped.slice(start, i + 1))
        if (counted.ok) return { value: counted.value, trimmedAround: true }
      }
    }
  }
  return null
}

const OPEN_SMART = '“'
const CLOSE_SMART = '”'

/**
 * Repairs JSON punctuation only: a smart quote outside a string opens a
 * string (and the matching smart quote closes it); a comma before } or ] is
 * dropped. Characters inside ordinary strings are never touched.
 */
function repairPunctuation(text: string): { text: string; smartQuotes: boolean; trailingCommas: boolean } {
  let out = ''
  let inString = false
  let smartString = false
  let escape = false
  let smartQuotes = false
  let trailingCommas = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) { escape = false; out += ch; continue }
      if (ch === '\\') { escape = true; out += ch; continue }
      if (smartString && (ch === CLOSE_SMART || ch === OPEN_SMART || ch === '"')) {
        inString = false
        smartString = false
        out += '"'
        continue
      }
      if (!smartString && ch === '"') inString = false
      out += ch
      continue
    }
    if (ch === OPEN_SMART || ch === CLOSE_SMART) {
      inString = true
      smartString = true
      smartQuotes = true
      out += '"'
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    if (ch === ',') {
      let j = i + 1
      while (j < text.length && /\s/.test(text[j])) j++
      if (text[j] === '}' || text[j] === ']') {
        trailingCommas = true
        continue
      }
    }
    out += ch
  }
  return { text: out, smartQuotes, trailingCommas }
}

/** Reads the JSON object out of a pasted answer. Never throws; never changes content. */
export function extractJson(raw: string): { value: unknown; findings: Finding[] } {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { value: null, findings: [{ check: 'parse.json', severity: 'error', message: 'The answer is empty: no JSON was found.' }] }
  }
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  let result = threeStrategies(stripped)
  let repairs: string[] = []
  if (!result) {
    const repaired = repairPunctuation(stripped)
    if (repaired.smartQuotes || repaired.trailingCommas) {
      result = threeStrategies(repaired.text)
      repairs = [
        ...(repaired.smartQuotes ? ['read smart quotes as JSON quotes'] : []),
        ...(repaired.trailingCommas ? ['ignored trailing commas'] : []),
      ]
    }
  }
  if (!result) {
    return { value: null, findings: [{ check: 'parse.json', severity: 'error', message: 'No valid JSON object could be read from the answer.' }] }
  }
  const cleaned = [
    ...(stripped !== raw.trim() ? ['removed the code fences'] : []),
    ...(result.trimmedAround ? ['removed text before or after the JSON'] : []),
    ...repairs,
  ]
  const findings: Finding[] = cleaned.length
    ? [{ check: 'parse.cleaned', severity: 'info', message: `The answer was tidied before reading: ${cleaned.join('; ')}. No content was changed.` }]
    : []
  return { value: result.value, findings }
}
