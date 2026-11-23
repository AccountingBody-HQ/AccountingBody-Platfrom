import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// BP-1 guards (D311, D315): the two migration records are exactly the
// reviewed files; 0027 is recorded as not applied yet.

const ROOT = process.cwd()
const bytes = (path: string) => readFileSync(join(ROOT, path))
const sha16 = (data: Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 16)
const lines = (data: Buffer) => data.toString('utf8').split('\n').length - 1

describe('BP-1 migration records', () => {
  it.each([
    ['migrations/0026_revoke_admin_update_field.sql', 'c4eb1344d1d94051', 23, 1399],
    ['migrations/0027_admin_recycle_bin.sql', '70269abdfcc58349', 152, 7023],
  ])('%s is byte for byte the reviewed file', (path, hash, lineCount, size) => {
    const data = bytes(path)
    expect(sha16(data)).toBe(hash)
    expect(lines(data)).toBe(lineCount)
    expect(data.length).toBe(size)
  })

  it('the README lists 0026 as a record and 0027 as not applied yet, and names the new table', () => {
    const readme = bytes('migrations/README.md').toString('utf8')
    const rows = readme.split('\n')
    expect(rows.find((line) => line.startsWith('| `0026_revoke_admin_update_field.sql` |'))).toContain('Record only - applied 23 Nov 2026, 14:12:19 UTC (D316).')
    expect(rows.find((line) => line.startsWith('| `0027_admin_recycle_bin.sql` |'))).toContain('Record file, not applied yet (BP-1, D315).')
    expect(readme).toContain('site_counts  job_similar  admin_recycle_bin')
  })
})
