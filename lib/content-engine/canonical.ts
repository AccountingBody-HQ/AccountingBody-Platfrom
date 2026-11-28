// Canonical JSON and short hashes. The same value always gives the same text
// (object keys sorted, undefined fields left out), so ids and fingerprints
// are deterministic.
import { createHash } from 'node:crypto'

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => (item === undefined ? null : canonicalValue(item)))
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) out[key] = canonicalValue(record[key])
    }
    return out
  }
  return value
}

/** JSON text with every object's keys in sorted order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

/** The first 16 hex characters of the sha256 of a text. */
export function sha16(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}
