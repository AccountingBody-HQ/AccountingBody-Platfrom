import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Keyboard focus guards (A11-F4). WCAG 2.2: 2.4.7 focus visible and 1.4.11 non-text contrast (3:1).
// The default focus indicator is two-tone: a 2px navy outline with a 2px white halo between it and the element,
// so one of the two layers reaches 3:1 on every surface of both brands (white, page tint, navy, EthioTax green, gold).
// The admin area is found by its layout and skipped without naming it.
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function lum(hex: string): number {
  const h = hex.length === 4 ? '#' + hex.slice(1).split('').map((c) => c + c).join('') : hex
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const f = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(relative(root, full))
  }
  return out
}
const appDir = join(root, 'app')
const adminDirs = readdirSync(appDir).filter((name) => {
  try {
    return readFileSync(join(appDir, name, 'layout.tsx'), 'utf8').includes('requireAdmin')
  } catch {
    return false
  }
})
const isAdmin = (f: string) =>
  adminDirs.some((d) => f.startsWith(`app/${d}/`) || f.startsWith(`app/${d}-`) || f.startsWith(`components/${d}/`))
const publicTsx = [...walk(join(root, 'app')), ...walk(join(root, 'components'))].filter(
  (f) => !isAdmin(f) && !f.startsWith('app/api/') && !f.startsWith('components/book/'),
)

/** The string literal ('…', "…" or `…`) that contains position i. */
function enclosingString(src: string, i: number): string {
  let s = i
  while (s > 0 && !`'"\``.includes(src[s - 1])) s--
  const q = src[s - 1]
  let e = i
  while (e < src.length && src[e] !== q) e++
  return src.slice(s, e)
}

// Surfaces of both brands: white, page tint, navy, EthioTax green, dark EthioTax green, brand gold.
const SURFACES = ['#ffffff', '#F8F7F4', '#0C1A3D', '#1A4731', '#0f2d1e', '#C9982A']

describe('keyboard focus (A11-F4)', () => {
  it('the default focus indicator reaches 3:1 with a 2px layer on every surface', () => {
    const css = read('app/globals.css')
    const vars: Record<string, string> = {}
    for (const m of Array.from(css.matchAll(/(--color-[\w-]+):\s*(#[0-9a-fA-F]{6})/g))) vars[m[1]] = m[2]
    const block = css.match(/\n\s*:focus-visible\s*\{([^}]*)\}/)
    expect(block).not.toBeNull()
    const rule = block![1]
    const resolve = (v: string) => (v.startsWith('var(') ? vars[v.slice(4, -1).trim()] : v)
    const outline = rule.match(/outline:\s*(\d+)px\s+solid\s+(var\([^)]+\)|#[0-9a-fA-F]{6})/)
    expect(outline).not.toBeNull()
    const layers = [{ px: Number(outline![1]), colour: resolve(outline![2]) }]
    const halo = rule.match(/--tw-ring-offset-shadow:\s*0 0 0 (\d+)px\s+(#[0-9a-fA-F]{6})/)
    if (halo) {
      layers.push({ px: Number(halo[1]), colour: halo[2] })
      // the halo is drawn: box-shadow composes the variable, so shadow utilities keep it too
      expect(rule).toMatch(/box-shadow:\s*var\(--tw-ring-offset-shadow\)/)
    }
    for (const s of SURFACES) {
      const best = Math.max(...layers.filter((l) => l.px >= 2).map((l) => ratio(l.colour, s)))
      expect(Math.round(best * 100) / 100, s).toBeGreaterThanOrEqual(3)
    }
  })

  it('no focus suppression without a replacement on public pages', () => {
    // outline-none is allowed only with a focus ring in the same class string.
    // Allowed exceptions, one each:
    // - app/layout.tsx: the skip-link target <main tabIndex={-1}> receives programmatic focus only.
    const ALLOWED: Record<string, number> = { 'app/layout.tsx': 1 }
    const found: Record<string, number> = {}
    for (const f of publicTsx) {
      const src = read(f)
      for (const m of Array.from(src.matchAll(/(?<![\w-])(?:(?:focus|focus-visible):)?outline-none(?![\w-])/g))) {
        const str = enclosingString(src, m.index!)
        if (!/(?<![\w-])(?:focus|focus-visible):ring-(?:1|2|4|8|\[)/.test(str)) found[f] = (found[f] || 0) + 1
      }
      if (/(?<![\w-])outline\s*:\s*['"]?(?:none|0)['"]?\s*[,}]/.test(src)) found[f + ' (inline)'] = 1
    }
    expect(found).toEqual(ALLOWED)
  })

  it('gold focus rings remain only on navy or green surfaces (gold on white is 2.6:1)', () => {
    // Pinned per file: each of these sits on a navy (6.5:1) or EthioTax green (4.0:1) surface.
    const PINNED: Record<string, number> = {
      'app/contact/ContactForm.tsx': 1, // newsletter field on the navy band
      'app/jobs/listings/JobListingsClient.tsx': 1, // alert field on the navy panel (gold-400, 8.7:1)
      'app/search/page.tsx': 1, // search field in the navy hero
      'components/QuizBankRenderer.tsx': 1, // writing answer field, dark variant only (the light variant is navy)
      'components/layout/Footer.tsx': 2, // newsletter field and EthioTax footer logo
    }
    const found: Record<string, number> = {}
    for (const f of publicTsx) {
      const n = (read(f).match(/(?<![\w-])(?:focus|focus-visible|focus-within):(?:ring|border|outline)-gold-\d{3}(?![\w/-])/g) || []).length
      if (n) found[f] = n
    }
    expect(found).toEqual(PINNED)
  })

  it('the shared Button uses the navy ring with a white offset (same look as the default)', () => {
    const src = read('components/ui/Button.tsx')
    expect((src.match(/focus-visible:ring-navy-950 focus-visible:ring-offset-2/g) || []).length).toBe(2)
    expect(src).not.toMatch(/ring-gold-/)
  })

  it('inset focus frames leave a light gap inside the field edge (A11-F5)', () => {
    // An inset outline of 2px at offset -1/-2 touches the element edge; next to a dark hero it reads as the
    // field shrinking. Inset frames use -outline-offset-4 or more so a light gap remains.
    // Pinned: the newsletter field in EmailSignupForm sits on a white card, not a dark hero (left for review).
    const PINNED: Record<string, number> = { 'components/EmailSignupForm.tsx': 1 }
    const found: Record<string, number> = {}
    for (const f of publicTsx) {
      const n = (read(f).match(/(?<![\w-])(?:focus|focus-visible):-outline-offset-(?:1|2)(?![\w-])/g) || []).length
      if (n) found[f] = n
    }
    expect(found).toEqual(PINNED)
  })

  it('search-bar submit buttons flush to a clipping edge use an inset frame (A11-F5)', () => {
    // JobSearchHero: both forms are rounded overflow-hidden boxes and the submit button is flush to the edge,
    // so an outside outline is clipped. The navy frame is drawn inside the gold button (6.5:1).
    const src = read('app/jobs/listings/JobSearchHero.tsx')
    const forms = src.split('<form').slice(1)
    expect(forms.length).toBe(2)
    for (const form of forms) {
      expect(form.slice(0, form.indexOf('>'))).toMatch(/overflow-hidden/)
      const btn = form.slice(form.indexOf('<button type="submit"'))
      expect(btn.slice(0, btn.indexOf('>'))).toMatch(/focus-visible:-outline-offset-4/)
    }
  })

  it('the site logo links keep a visible focus indicator', () => {
    const nav = read('components/layout/Navigation.tsx')
    expect(nav).not.toMatch(/outline-none/)
    expect(read('components/CalcCard.tsx')).not.toMatch(/outline:\s*'none'/)
  })
})
