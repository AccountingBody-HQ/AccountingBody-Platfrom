import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import { getAdminPath } from './middleware-logic'

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

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()
const text = (path: string) => bytes(path).toString('utf8')

describe('BP-1 admin screens', () => {
  it('the recycle bin page uses adminFetch only and shows the agreed texts', () => {
    const page = text(`app/${ADMIN}/recycle-bin/page.tsx`)
    expect(page.startsWith("'use client'")).toBe(true)
    expect(page).toContain(`adminFetch('/api/${ADMIN}/recycle-bin'`)
    expect(page).not.toMatch(/[^n]fetch\(/)
    for (const words of [
      'Put this back? It returns exactly as it was when it was deleted.',
      'The recycle bin is empty. Anything deleted in the admin area is kept here for 90 days.',
      'Replaced by a course save',
      'Kept until',
      'Restored ',
    ]) expect(page).toContain(words)
  })

  it('the admin menu has one Recycle bin entry and its page title', () => {
    const shell = text(`app/${ADMIN}/AdminShell.tsx`)
    expect(shell.split('\n').filter((line) => line.includes(`href: '/${ADMIN}/recycle-bin'`))).toHaveLength(1)
    expect(shell).toContain("label: 'Recycle bin',     sub: 'Restore deleted items'")
    expect(shell).toContain(`'/${ADMIN}/recycle-bin':        'Recycle bin'`)
  })

  it('no admin delete confirmation still says the delete is permanent', () => {
    const files = execFileSync('git', ['ls-files', `app/${ADMIN}`, `components/${ADMIN}`], { encoding: 'utf8' }).split('\n').filter((f) => /\.tsx?$/.test(f))
    for (const file of files) expect([file, /cannot be undone|permanently/i.test(text(file))]).toEqual([file, false])
  })

  it('Course Factory sends the save mode, the loaded course id and each loaded lesson id', () => {
    const page = text(`app/${ADMIN}/course-factory/page.tsx`)
    expect(page).toContain("mode:        loadedCourseId ? 'update' : 'create'")
    expect(page).toContain('courseId: loadedCourseId')
    expect(page).toContain('lessonId: l.dbId')
    expect(page).toContain("dbId:     typeof l.id === 'string' ? l.id : undefined")
    expect(page).toContain('setShowOnSites(siteNamesFromCodes(c.showOnSites))')
    expect(page).toContain('Start a new course')
  })
})
