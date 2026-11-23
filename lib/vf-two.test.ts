import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FONT_STYLESHEET } from '@/lib/fonts'

// VF-2: the last Stage A polish. Source checks that keep each fix in place.
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('F1 the site fonts load by a link, so a blocked font host never fails the site stylesheet', () => {
  it('the stylesheet imports nothing from another site', () => {
    expect(read('app/globals.css')).not.toMatch(/@import\s+(?:url\()?\s*['"]?(?:https?:)?\/\//)
  })
  it.each(['app/layout.tsx', 'app/global-error.tsx'])('%s links the font stylesheet once, with no precedence (React must not wait for it)', (file) => {
    const src = read(file)
    expect(src.split('<link rel="stylesheet" href={FONT_STYLESHEET} />')).toHaveLength(2)
    expect(src).not.toMatch(/precedence=/)
  })
  it('the fonts are the same three families with swap', () => {
    const u = new URL(FONT_STYLESHEET)
    expect(u.origin + u.pathname).toBe('https://fonts.googleapis.com/css2')
    expect(u.searchParams.getAll('family').map((f) => f.split(':')[0])).toEqual(['DM Serif Display', 'DM Sans', 'JetBrains Mono'])
    expect(u.searchParams.get('display')).toBe('swap')
  })
})
