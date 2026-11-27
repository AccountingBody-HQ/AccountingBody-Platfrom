import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { errorCode } from './recycle-bin'

// PRIV-3 S5 (PRIV-6, #14): public routes and libraries log a short label and an error code, never a
// whole error object (which can hold an address, a token or row data). Admin routes (they all import
// the shared admin check) are outside this job.
const read = (p: string) => readFileSync(p, 'utf8')
const tracked = (dir: string) =>
  execFileSync('git', ['ls-files', '--', dir], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))

const WHOLE_ERROR = /console\.(error|warn)\(.*,\s*(e|err|error|cleanupErr|traceErr|emailErr|countError|sendError)\s*\)\s*;?\s*$/
// PRIV-8 S4: no exceptions left; the similar-jobs read now logs a code too.
const KNOWN: string[] = []

describe('PRIV-3 S5: no whole-error log lines in public routes and libraries', () => {
  it('every console.error / console.warn passes a code, not the error object', () => {
    // The admin area is the one top-level app folder whose layout calls requireAdmin (its name is not written here).
    const layouts = tracked('app').filter((f) => /^app\/[^/]+\/layout\.tsx$/.test(f) && read(f).includes('requireAdmin'))
    expect(layouts).toHaveLength(1)
    const admin = layouts[0].split('/')[1]
    const files = [...tracked('app/api'), ...tracked('lib')]
      .filter((f) => !f.startsWith(`app/api/${admin}`) && !read(f).includes("from '@/lib/admin-auth'"))
    expect(files.length).toBeGreaterThan(100)
    const hits: string[] = []
    for (const f of files) {
      for (const line of read(f).split('\n')) {
        if (WHOLE_ERROR.test(line)) hits.push(`${f}: ${line.trim()}`)
      }
    }
    expect(hits).toStrictEqual(KNOWN)
  })

  it('the code helper prints only a short code', () => {
    expect(errorCode({ code: '23505', message: 'Key (email)=(ada@example.com) already exists.' })).toBe('23505')
    expect(errorCode(new Error('ada@example.com'))).toBe('unknown')
    expect(errorCode({ code: 'ada@example.com' })).toBe('unknown')
    expect(errorCode(null)).toBe('unknown')
  })

  it('the ops-status comment lists the 07:30 job retention run', () => {
    expect(read('lib/ops-status.ts')).toContain('// clean-up 07:00, job retention 07:30 UTC) can leave a due row in place for')
  })
})
