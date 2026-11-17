import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import nextConfig from '../next.config.mjs'
import { LEGACY_WORDPRESS_REDIRECTS } from './legacy-wordpress-redirects.mjs'

type Redirect = { source: string; destination: string; permanent?: boolean }

// Next's own path matcher, so the first-match check uses the same rules as Next.
const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp') as {
  pathToRegexp: (source: string, keys: unknown[], options: { strict: boolean }) => RegExp
}

const rows = LEGACY_WORDPRESS_REDIRECTS as readonly Redirect[]
const SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*'
const OLD_PATH = new RegExp('^(?:/' + SEGMENT + '){2}$', 'u')
const TARGET = new RegExp('^/(?:about|calculators|practice-questions|study/' + SEGMENT + '(?:/' + SEGMENT + ')?)$', 'u')

describe('the frozen list of old WordPress multi-segment addresses', () => {
  it('holds exactly 52 rows: 24 attachment pages, 13 categories, 1 author, 14 tags', () => {
    expect(rows).toHaveLength(52)
    const count = (prefix: string) => rows.filter((r) => r.source.startsWith(prefix)).length
    expect(count('/category/')).toBe(13)
    expect(count('/author/')).toBe(1)
    expect(count('/tag/')).toBe(14)
    expect(rows.length - count('/category/') - count('/author/') - count('/tag/')).toBe(24)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(LEGACY_WORDPRESS_REDIRECTS)).toBe(true)
  })

  it('uses two-segment, lower-case sources without a trailing slash, each listed once', () => {
    for (const r of rows) expect(r.source).toMatch(OLD_PATH)
    expect(new Set(rows.map((r) => r.source)).size).toBe(rows.length)
  })

  it('sends every row to a current page shape, never to another old address', () => {
    const sources = new Set(rows.map((r) => r.source))
    for (const r of rows) {
      expect(r.destination).toMatch(TARGET)
      expect(sources.has(r.destination)).toBe(false)
    }
  })

  it('maps the category rows whose names changed to the current pages', () => {
    const to = (source: string) => rows.find((r) => r.source === source)?.destination
    expect(to('/category/audit-and-assurance')).toBe('/study/audit-assurance')
    expect(to('/category/auditing')).toBe('/study/audit-assurance')
    expect(to('/category/calculator')).toBe('/calculators')
    expect(to('/category/mock-exam')).toBe('/practice-questions')
    expect(to('/category/tax')).toBe('/study/taxation')
    expect(to('/category/tools-and-templates')).toBe('/study/tools-templates')
    expect(to('/author/ab')).toBe('/about')
  })
})

describe('next.config.mjs serves the list', () => {
  it('imports the list and spreads it into the redirects', () => {
    const source = readFileSync('next.config.mjs', 'utf8')
    expect(source).toContain("import { LEGACY_WORDPRESS_REDIRECTS } from './lib/legacy-wordpress-redirects.mjs'")
    expect(source).toContain('...LEGACY_WORDPRESS_REDIRECTS.map(')
  })

  it('every old address matches its own permanent redirect first', async () => {
    const all = (await (nextConfig as { redirects: () => Promise<Redirect[]> }).redirects())
    for (const r of rows) {
      const first = all.find((rule) => pathToRegexp(rule.source, [], { strict: true }).test(r.source))
      expect(first).toEqual({ source: r.source, destination: r.destination, permanent: true })
    }
  })
})

// Slash-form redirects in vercel.json never fire on this site: Next removes the
// trailing slash first (FINDINGS EK, EL). Old addresses live in next.config.mjs.
describe('vercel.json holds no redirects', () => {
  it('has only the crons and headers blocks', () => {
    expect(Object.keys(JSON.parse(readFileSync('vercel.json', 'utf8')) as object)).toStrictEqual(['crons', 'headers'])
  })
})
