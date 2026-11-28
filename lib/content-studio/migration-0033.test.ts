import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRegistry } from '@/lib/question-registry'

const ROOT = process.cwd()
const FILE = readFileSync(path.join(ROOT, 'migrations', '0033_question_sets_registry.sql'), 'utf8')
const README = readFileSync(path.join(ROOT, 'migrations', 'README.md'), 'utf8')

function sha16(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

/** Part B as `sed -n '/^BEGIN;/,/^COMMIT;/p'` extracts it. */
function partB(text: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex(l => /^BEGIN;/.test(l))
  const end = lines.findIndex((l, i) => i > start && /^COMMIT;/.test(l))
  return lines.slice(start, end + 1).join('\n') + '\n'
}

const RULES: Record<string, string> = {
  question_sets_prompt_id_format: 'prompt_id',
  question_sets_prompt_version_length: 'prompt_version',
  question_sets_model_length: 'model',
  question_sets_quality_score_range: 'quality_score',
}

describe('migration 0033 (the quality record columns)', () => {
  it('is the reviewed file', () => {
    expect(sha16(FILE)).toBe('0bb52b234560da75')
    expect(FILE.split('\n').length - 1).toBe(128)
  })

  it('has the reviewed Part B', () => {
    const b = partB(FILE)
    expect(sha16(b)).toBe('bd9bda8a5dfd6977')
    expect(b.split('\n').length - 1).toBe(70)
  })

  it('adds exactly the columns the quality record writes, each with its rule', () => {
    const b = partB(FILE)
    const added = Array.from(b.matchAll(/ADD COLUMN (\w+)/g), m => m[1]).sort()
    const record = parseRegistry({ promptId: '0123456789abcdef', promptVersion: 'v', model: 'm', qualityScore: 1 })
    if (!record.ok || !record.columns) throw new Error('not parsed')
    expect(added).toEqual(Object.keys(record.columns).sort())
    const rules = Array.from(b.matchAll(/ADD CONSTRAINT (\w+)\s+CHECK \((\w+) IS NULL/g), m => [m[1], m[2]])
    expect(Object.fromEntries(rules)).toEqual(RULES)
  })

  it('is listed once in the README, directly below 0032', () => {
    const lines = README.split('\n')
    const rows = lines.filter(l => l.startsWith('| `0033_question_sets_registry.sql` |'))
    expect(rows).toHaveLength(1)
    const at = lines.indexOf(rows[0])
    expect(lines[at - 1].startsWith('| `0032_question_sets_on_both_sites.sql` |')).toBe(true)
    expect(rows[0]).toContain('**Not applied when committed; run once by the E2 database step after a fresh backup and before the E2 release is merged (D373, D379).')
  })
})
