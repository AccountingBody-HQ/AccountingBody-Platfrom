import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// PRIV-9 guards: the migration record is exactly the reviewed file, is recorded as applied, and changes only the rights it names.

const ROOT = process.cwd()
const FILE = 'migrations/0031_revoke_browser_privileges_content_tables.sql'
const ROW_START = '| `0031_revoke_browser_privileges_content_tables.sql` |'
const TABLES = [
  'articles',
  'book_publications',
  'course_chapters',
  'course_lesson_articles',
  'course_lessons',
  'courses',
  'job_providers',
  'jobs',
  'provider_errors',
  'provider_runs',
  'question_cases',
  'question_sets',
  'questions',
  'social_posts',
]
const DEFAULTS = 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;'

const bytes = (path: string) => readFileSync(join(ROOT, path))
const sha16 = (data: Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 16)
const lines = (data: Buffer) => data.toString('utf8').split('\n').length - 1
const sql = () => bytes(FILE).toString('utf8')
const withoutComments = (text: string) => text.replace(/--[^\n]*/g, '')
const withoutStrings = (text: string) => text.replace(/'(?:[^']|'')*'/g, "''")
const squash = (text: string) => text.replace(/\s+/g, ' ').trim()
const sorted = (names: string[]) => [...names].sort()

describe('PRIV-9 migration record', () => {
  it('0031 is byte for byte the reviewed file', () => {
    const data = bytes(FILE)
    expect(sha16(data)).toBe('b51988ddbffbbd04')
    expect(lines(data)).toBe(245)
    expect(data.length).toBe(11522)
  })

  it('the README lists 0031 once, as applied, directly after 0030', () => {
    const rows = bytes('migrations/README.md').toString('utf8').split('\n')
    const matches = rows.filter((line) => line.startsWith(ROW_START))
    expect(matches).toHaveLength(1)
    const row = matches[0]
    expect(row).toContain('**Applied ')
    expect(row).toContain('(PRIV-9, after backup run ')
    expect(row).toContain("Undo (owner decision only) in the file's comments")
    const at = rows.indexOf(row)
    expect(rows[at - 1]?.startsWith('| `0030_revoke_unused_browser_privileges.sql` |')).toBe(true)
  })

  it('has one REVOKE of all table rights of anon and authenticated on the fourteen tables', () => {
    const code = withoutComments(sql())
    const rest = code.replace(/\bALTER DEFAULT PRIVILEGES\b[^;]*;/g, '')
    const revokes = rest.match(/\bREVOKE\b[^;]*;/g) ?? []
    expect(revokes).toHaveLength(1)
    const shape = /^REVOKE ALL ON TABLE (.+) FROM anon, authenticated;$/.exec(squash(revokes[0] ?? ''))
    expect(shape).not.toBeNull()
    const names = (shape?.[1] ?? '').split(',').map((name) => name.trim())
    expect(sorted(names)).toEqual(sorted(TABLES.map((table) => `public.${table}`)))
  })

  it('changes the default rights of postgres for new tables in the public schema, and nothing else there', () => {
    const bare = withoutStrings(withoutComments(sql()))
    const alters = bare.match(/\bALTER\b[^;]*;/gi) ?? []
    expect(alters).toHaveLength(1)
    expect(squash(alters[0] ?? '')).toBe(DEFAULTS)
  })

  it('makes no other change', () => {
    const code = withoutComments(sql())
    const bare = withoutStrings(code)
    for (const word of ['GRANT', 'TRUNCATE', 'UPDATE', 'DELETE', 'SEQUENCES', 'FUNCTIONS']) {
      expect(new RegExp(`\\b${word}\\b`, 'i').test(bare)).toBe(false)
    }
    const drops = bare.match(/\bDROP\b/gi) ?? []
    const commitDrops = bare.match(/\bON COMMIT DROP\b/gi) ?? []
    expect(drops.length).toBe(commitDrops.length)
    expect(/CREATE\s+POLICY/i.test(bare)).toBe(false)
    expect(/CREATE\s+OR\s+REPLACE/i.test(bare)).toBe(false)
    const creates = bare.match(/\bCREATE\b\s+\S+\s+\S+\s+\S+/gi) ?? []
    expect(creates.length).toBeGreaterThan(0)
    for (const create of creates) expect(create).toMatch(/^CREATE TEMP TABLE pv_/)
    const inserts = bare.match(/\bINSERT\b\s+\S+\s+\S+/gi) ?? []
    expect(inserts.length).toBeGreaterThan(0)
    for (const insert of inserts) expect(insert).toMatch(/^INSERT INTO pv_/)
    const trimmed = code.trim()
    expect(trimmed.startsWith('BEGIN;')).toBe(true)
    expect(trimmed.endsWith('COMMIT;')).toBe(true)
  })

  it('revokes on exactly the tables it checks', () => {
    const code = withoutComments(sql())
    const insert = /INSERT INTO pv_scope \(t\) VALUES([^;]*);/.exec(code)
    expect(insert).not.toBeNull()
    const scope = Array.from((insert?.[1] ?? '').matchAll(/'([a-z_]+)'/g), (m) => m[1])
    const revoke = /REVOKE ALL ON TABLE([^;]*)FROM/.exec(code)
    const revoked = Array.from((revoke?.[1] ?? '').matchAll(/public\.([a-z_]+)/g), (m) => m[1])
    expect(sorted(scope)).toEqual(sorted(TABLES))
    expect(sorted(revoked)).toEqual(sorted(scope))
  })

  it('the UNDO comment names the same fourteen tables, the seven rights and the default rights', () => {
    const text = sql()
    const start = text.indexOf('-- UNDO')
    expect(start).toBeGreaterThan(-1)
    const end = text.indexOf('\n\n', start)
    const undo = text.slice(start, end)
    expect(undo).toContain('DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, UPDATE')
    const named = Array.from(undo.matchAll(/public\.([a-z_]+)/g), (m) => m[1])
    expect(sorted(named)).toEqual(sorted(TABLES))
    expect(undo).toContain('TO anon, authenticated;')
    expect(undo).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public')
    expect(undo).toContain('GRANT MAINTAIN, REFERENCES, TRIGGER ON TABLES TO anon, authenticated;')
  })
})
