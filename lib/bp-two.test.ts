import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// BP-2 guards: the migration record is exactly the reviewed file and is
// recorded as applied.

const ROOT = process.cwd()
const bytes = (path: string) => readFileSync(join(ROOT, path))
const sha16 = (data: Buffer) => createHash('sha256').update(data).digest('hex').slice(0, 16)
const lines = (data: Buffer) => data.toString('utf8').split('\n').length - 1

describe('BP-2 migration record', () => {
  it('0028 is byte for byte the reviewed file', () => {
    const data = bytes('migrations/0028_jobs_drop_public_read_policy.sql')
    expect(sha16(data)).toBe('810f0b28b4e8f95a')
    expect(lines(data)).toBe(57)
    expect(data.length).toBe(2231)
  })

  it('the README lists 0028 as applied', () => {
    const rows = bytes('migrations/README.md').toString('utf8').split('\n')
    const row = rows.find((line) => line.startsWith('| `0028_jobs_drop_public_read_policy.sql` |'))
    expect(row).toContain('**Applied at 16:46:08 UTC (date in ab-control; see FINDINGS) (BP-2).**')
    expect(row).toContain('BEFORE or AFTER the BP-2 pull request is merged')
  })
})
