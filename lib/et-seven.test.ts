import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// ET-7 (side batch after BOARD #16): the /about exam captions meet the 4.5:1 contrast minimum, the unused
// NewsTicker component is retired and the release docs point to the dated proxy-check exception.

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

// WCAG relative luminance and contrast ratio.
const lin = (v: number) => {
  const x = v / 255
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const contrast = (a: number[], b: number[]) => {
  const la = lum(a)
  const lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const tw = read('tailwind.config.ts')
const palette = (token: string) => {
  const [fam, shade] = token.split('-')
  const block = tw.match(new RegExp(fam + ':\\s*\\{([^}]*)\\}'))
  const hex = block && block[1].match(new RegExp(shade + ":\\s*'(#[0-9a-fA-F]{6})'"))
  if (!hex) throw new Error('no palette value for ' + token)
  return hex[1]
}
const colour = (tok: string): { hex: string; alpha: number } => {
  const m = tok.match(/^\[(#[0-9a-fA-F]{6})\](?:\/(\d+))?$/)
  if (m) return { hex: m[1], alpha: m[2] ? Number(m[2]) / 100 : 1 }
  return { hex: palette(tok), alpha: 1 }
}

describe('G2: the /about exam captions are readable', () => {
  const src = read('app/about/page.tsx')
  const rows = Array.from(src.matchAll(/\{ name: '([A-Z]+)',[^\n]*accent: '([^']*)',\s*bg: '([^']*)' \}/g))
  it('the caption has no reduced opacity', () => {
    expect(src).toContain('<span className="text-xs">{q.detail}</span>')
    expect(src).not.toMatch(/opacity-\d+">\{q\.detail\}/)
  })
  it('the AAT text uses the palette text-safe teal and keeps its exam-colour border', () => {
    const aat = rows.find((r) => r[1] === 'AAT')
    expect(aat?.[2]).toBe('border-[#00857A] text-teal-700')
  })
  it('every caption colour reaches 4.5:1 on its card tint', () => {
    expect(rows.map((r) => r[1])).toEqual(['ACCA', 'CIMA', 'AAT', 'ICAEW'])
    for (const r of rows) {
      const text = colour((r[2].match(/(?:^|\s)text-(\S+)/) as RegExpMatchArray)[1])
      const tint = colour((r[3].match(/(?:^|\s)bg-(\S+)/) as RegExpMatchArray)[1])
      const bg = rgbOf(tint.hex).map((v) => v * tint.alpha + 255 * (1 - tint.alpha))
      expect(contrast(rgbOf(text.hex), bg), r[1]).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('G5: the unused NewsTicker component is retired', () => {
  it('the component file is gone', () => {
    expect(existsSync(join(root, 'components/layout/NewsTicker.tsx'))).toBe(false)
  })
  it('nothing in app, components or lib names it', () => {
    const files = execFileSync('git', ['ls-files', 'app', 'components', 'lib'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /\.(tsx?|mjs|js)$/.test(f) && f !== 'lib/et-seven.test.ts' && existsSync(join(root, f)))
    expect(files.filter((f) => read(f).includes('NewsTicker')).length).toBe(0)
  })
})

describe('G6: the release docs point to the dated exception', () => {
  it('one pointer line sits directly after the "scripts never request" line', () => {
    const lines = read('docs/RELEASE.md').split('\n')
    const i = lines.findIndex((l) => l.startsWith('- Scripts never request accountingbody.com or ethiotax.com directly.'))
    expect(i).toBeGreaterThan(-1)
    expect(lines[i + 1]).toBe(
      '- One dated exception: a brief for the EthioTax proxy tidy-up may allow GET-only checks of public `ethiotax.com` addresses, as `docs/AGENT-RULES.md` (Secrets) describes. In practice the bot protection challenges those scripts too, so proofs of proxy changes come from the owner\'s browser.',
    )
  })
})
