import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// PRIV-8 S4 (D360): code comments in lib/ describe admin-area files in words, not by their folder path.
// Two files are left as they are on purpose: the admin path mechanism and AB Press (locked).
const read = (p: string) => readFileSync(p, 'utf8')
const tracked = (dir: string) =>
  execFileSync('git', ['ls-files', '--', dir], { encoding: 'utf8' }).split('\n').filter(Boolean)
const ALLOWED = ['lib/ab-press-builder.ts', 'lib/middleware-logic.ts']

describe('PRIV-8 S4: lib/ does not spell out the admin folder path', () => {
  it('no tracked non-test file under lib/ names the admin folder path, apart from the two allowed files', () => {
    // The admin area is the one top-level app folder whose layout calls requireAdmin (its name is not written here).
    const layouts = tracked('app').filter((f) => /^app\/[^/]+\/layout\.tsx$/.test(f) && read(f).includes('requireAdmin'))
    expect(layouts).toHaveLength(1)
    const admin = layouts[0].split('/')[1]
    expect(admin.length).toBeGreaterThan(0)
    const files = tracked('lib').filter((f) => !/\.test\.tsx?$/.test(f))
    expect(files.length).toBeGreaterThan(100)
    const hits = files.filter((f) => {
      const src = read(f)
      return src.includes(`app/${admin}/`) || src.includes(`app/api/${admin}/`)
    })
    expect(hits.filter((f) => !ALLOWED.includes(f))).toStrictEqual([])
  })
})
