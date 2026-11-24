import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ADMIN_COLORS } from './admin-theme'
import { getAdminPath } from './middleware-logic'

// W0-1 C2: the "Also check outside our database" heading on the admin
// Personal data screen is readable on its dark warning box.

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const ADMIN = getAdminPath()
vi.unstubAllEnvs()

const page = readFileSync(join(process.cwd(), `app/${ADMIN}/personal-data/page.tsx`), 'utf8')

type Rgb = [number, number, number]
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
const over = (rgba: string, base: Rgb): Rgb => {
  const [r, g, b, a] = (rgba.match(/[\d.]+/g) ?? []).map(Number)
  return [r, g, b].map((c, i) => c * a + base[i] * (1 - a)) as Rgb
}
const luminance = (c: Rgb) => {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('C2: the outside-our-database heading', () => {
  it('has the body font and the admin text colour, with its words unchanged', () => {
    const heading = page.split('\n').filter((line) => line.includes('id="pd-outside"'))
    expect(heading).toHaveLength(1)
    const tag = heading[0].match(/<h2 [^>]*>/)?.[0] ?? ''
    expect(tag).toMatch(/className="[^"]*\bfont-sans\b[^"]*"/)
    expect(tag).toContain('style={{ color: ADMIN_COLORS.text }}')
    expect(heading[0]).toContain('>Also check outside our database</h2>')
    expect(page).toContain("import { ADMIN_COLORS } from '@/lib/admin-theme'")
  })

  it('reads at 4.5:1 or better on the warning box over the admin page background', () => {
    const box = over(ADMIN_COLORS.warningBg, hex(ADMIN_COLORS.bg))
    expect(contrast(hex(ADMIN_COLORS.text), box)).toBeGreaterThan(4.5)
  })
})
