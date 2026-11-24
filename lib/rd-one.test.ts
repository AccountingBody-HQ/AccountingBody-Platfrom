import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import nextConfig from '../next.config.mjs'
import { LEGACY_WORDPRESS_PATTERNS, LEGACY_WORDPRESS_REDIRECTS } from './legacy-wordpress-redirects.mjs'
import { LEGACY_RENAMED_SLUGS, LEGACY_RENAMED_SLUG_COUNT } from '@/lib/legacy-redirect-map'

// RD-1 (owner decision D303): old WordPress address classes that answered 404
// now redirect to the closest live page, and /search is noindex and out of the
// pages sitemap. Redirect checks use Next's own matcher and destination builder,
// in the order nextConfig.redirects() returns, so first-match is tested as Next
// applies it.

vi.mock('@/lib/db', () => ({
  getPagesSitemapContent: vi.fn(async () => ({ ok: true, articles: [], questionSets: [], courses: [] })),
}))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))

type Redirect = { source: string; destination: string; permanent?: boolean }
type Params = Record<string, string | string[]>
type Query = Record<string, string | string[]>

const req = createRequire(import.meta.url)
const { getPathMatch } = req('next/dist/shared/lib/router/utils/path-match') as {
  getPathMatch: (source: string, options: { strict: boolean; removeUnnamedParams: boolean }) => (path: string) => Params | false
}
const { prepareDestination } = req('next/dist/shared/lib/router/utils/prepare-destination') as {
  prepareDestination: (args: { appendParamsToQuery: boolean; destination: string; params: Params; query: Query }) => {
    parsedDestination: { pathname: string; query: Query }
  }
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const patterns = LEGACY_WORDPRESS_PATTERNS as readonly Redirect[]
const exact = LEGACY_WORDPRESS_REDIRECTS as readonly Redirect[]

async function allRules(): Promise<Redirect[]> {
  return (nextConfig as { redirects: () => Promise<Redirect[]> }).redirects()
}
const matches = (rule: Redirect, path: string) => getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(path) !== false

// One redirect as Next's own handler applies it (resolve-routes: appendParamsToQuery false).
function apply(rules: Redirect[], path: string, query: Query = {}) {
  const rule = rules.find((r) => matches(r, path))
  if (!rule) return null
  const params = getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(path) as Params
  const { parsedDestination } = prepareDestination({ appendParamsToQuery: false, destination: rule.destination, params, query: { ...query } })
  return { rule, pathname: parsedDestination.pathname, query: parsedDestination.query }
}

const P = {
  P1: { source: '/tag/:tag/:rest*', destination: '/search?q=:tag' },
  P2: { source: '/category/:category/:rest*', destination: '/study' },
  P3: { source: '/author/:author/:rest*', destination: '/about' },
  P4: { source: '/feed/:rest*', destination: '/articles' },
  P5: { source: '/comments/feed/:rest*', destination: '/articles' },
  P6: { source: '/page/:n(\\d+)/:rest*', destination: '/articles' },
  P7: { source: '/:year(\\d{4})/:month(\\d{2})/:rest*', destination: '/articles' },
  P8: { source: '/:slug((?!(?:comments|tag|category|author|feed)/)[^/#?]+)/feed/:rest*', destination: '/:slug' },
}

describe('G1 sample old addresses reach the expected next address (first match)', () => {
  // rd.sh S04–S16, as Next sees them after its trailing-slash redirect.
  const SAMPLES: Array<[string, string, string, Query?]> = [
    ['S04', '/tag/cash-records', '/study/financial-accounting/cash-records'],
    ['S05', '/tag/inventory-valuation', '/search', { q: 'inventory-valuation' }],
    ['S06', '/tag/cash-records/page/2', '/search', { q: 'cash-records' }],
    ['S07', '/category/audit-and-assurance', '/study/audit-assurance'],
    ['S08', '/category/not-a-category-x9', '/study'],
    ['S09', '/category/economics/page/3', '/study'],
    ['S10', '/author/ab', '/about'],
    ['S11', '/author/someone-else', '/about'],
    ['S12', '/feed', '/articles'],
    ['S13', '/comments/feed', '/articles'],
    ['S14', '/absorption-costing/feed', '/absorption-costing'],
    ['S15', '/page/2', '/articles'],
    ['S16', '/2023/12', '/articles'],
  ]
  it.each(SAMPLES)('%s %s → %s', async (_label, path, next, query) => {
    const hit = apply(await allRules(), path)
    expect(hit?.pathname).toBe(next)
    expect(hit?.rule.permanent).toBe(true)
    if (query) expect(hit?.query).toEqual(query)
  })

  it('S01–S03: no next.config rule matches; the renamed map gives the article', async () => {
    const rules = await allRules()
    const want: Array<[string, string]> = [
      ['tangible-non-current-asset-2', 'tangible-non-current-asset-property-plant-equipment-ppe'],
      ['equity-share-capital', 'equity-share-capital-ordinary-share-capital'],
      ['financial-asset-2', 'financial-asset'],
    ]
    for (const [old, slug] of want) {
      expect(rules.some((r) => matches(r, '/' + old)), old).toBe(false)
      expect(LEGACY_RENAMED_SLUGS.get(old)).toEqual({ kind: 'article', slug })
    }
  })

  it('every one of the 52 exact rows still matches its own rule first, not a pattern', async () => {
    const rules = await allRules()
    expect(exact).toHaveLength(52)
    for (const r of exact) {
      const first = rules.find((rule) => matches(rule, r.source))
      expect(first, r.source).toEqual({ source: r.source, destination: r.destination, permanent: true })
    }
  })

  it('an exact tag\'s page and feed addresses go to the search for that tag', async () => {
    const rules = await allRules()
    for (const path of ['/tag/cash-records/page/2', '/tag/cash-records/feed']) {
      const hit = apply(rules, path)
      expect(hit?.rule.source).toBe(P.P1.source)
      expect(hit?.pathname).toBe('/search')
      expect(hit?.query).toEqual({ q: 'cash-records' })
    }
  })

  it('carries the visitor\'s own query, the tag wins over a sent q, and :rest never leaks', async () => {
    const hit = apply(await allRules(), '/tag/inventory-valuation/page/4', { utm_source: 'old', q: 'other' })
    expect(hit?.pathname).toBe('/search')
    expect(hit?.query).toEqual({ utm_source: 'old', q: 'inventory-valuation' })
    expect(Object.keys(hit?.query ?? {})).not.toContain('rest')
  })
})

describe('G2 the pattern list: frozen, in order, no loops, no dead ends, never the home page', () => {
  it('is frozen and holds exactly P1–P8 in this order', () => {
    expect(Object.isFrozen(LEGACY_WORDPRESS_PATTERNS)).toBe(true)
    expect(patterns).toEqual(Object.values(P))
  })

  it('is served by next.config.mjs after every exact rule, all permanent', async () => {
    const rules = await allRules()
    const tail = rules.slice(rules.length - patterns.length)
    expect(tail).toEqual(patterns.map((p) => ({ ...p, permanent: true })))
    const lastExact = rules.findIndex((r) => r.source === exact[exact.length - 1].source)
    expect(lastExact).toBe(rules.length - patterns.length - 1)
  })

  const SAMPLE_PER_PATTERN: Array<[string, string]> = [
    ['P1', '/tag/some-tag'], ['P1', '/tag/some-tag/page/2'], ['P1', '/tag/some-tag/feed'],
    ['P2', '/category/some-category'], ['P2', '/category/some-category/feed'],
    ['P3', '/author/someone'], ['P3', '/author/someone/page/2'],
    ['P4', '/feed'], ['P4', '/feed/atom'],
    ['P5', '/comments/feed'], ['P5', '/comments/feed/rss'],
    ['P6', '/page/2'], ['P6', '/page/12/feed'],
    ['P7', '/2023/12'], ['P7', '/2024/01/05'], ['P7', '/2024/01/some-post'],
    ['P8', '/some-post/feed'], ['P8', '/some-post/feed/atom'],
  ]
  const LIVE = new Set(['/search', '/study', '/about', '/articles'])
  const SINGLE = new RegExp('^/[a-z0-9]+(?:-[a-z0-9]+)*$', 'u')

  it.each(SAMPLE_PER_PATTERN)('%s %s: one rule application, then a live page shape', async (name, path) => {
    const rules = await allRules()
    let cur = path
    let steps = 0
    for (; steps < 5; steps++) {
      const hit = apply(rules, cur)
      if (!hit) break
      if (steps === 0) expect(hit.rule.source).toBe(P[name as keyof typeof P].source)
      cur = hit.pathname
    }
    expect(steps).toBe(1)
    expect(cur).not.toBe('/')
    expect(LIVE.has(cur) || (name === 'P8' && SINGLE.test(cur))).toBe(true)
  })

  // The Preview showed /comments/feed taking the article-feed row, so the result
  // must not depend on pattern order: every sample matches exactly one pattern.
  it.each([
    ...SAMPLE_PER_PATTERN,
    ['P1', '/tag/feed'], ['P2', '/category/feed'], ['P3', '/author/feed'], ['P4', '/feed/feed'],
  ] as Array<[string, string]>)('%s %s is matched by exactly one pattern', (name, path) => {
    const hits = patterns.filter((r) => matches(r, path))
    expect(hits).toEqual([P[name as keyof typeof P]])
  })

  it('no destination is the home page', () => {
    for (const p of patterns) expect(p.destination.split('?')[0]).not.toBe('/')
  })
})

// ── G3 no shadowing ─────────────────────────────────────────────────────────
// Top-level folders whose layout checks the admin session are named <admin> in messages.
const ADMIN_NAMES = readdirSync('app').filter((d) => {
  const f = join('app', d, 'layout.tsx')
  return existsSync(f) && readFileSync(f, 'utf8').includes('requireAdmin')
})
const mask = (s: string) => ADMIN_NAMES.reduce((acc, n) => acc.split(n).join('<admin>'), s)

function routePaths(dir: string, segs: string[] = []): string[] {
  const out: string[] = []
  const entries = readdirSync(dir)
  if (entries.includes('page.tsx') || entries.includes('route.ts')) out.push('/' + segs.filter(Boolean).join('/'))
  for (const e of entries) {
    if (!statSync(join(dir, e)).isDirectory()) continue
    let seg: string
    if (e.startsWith('(') || e.startsWith('@')) seg = ''
    else if (e.startsWith('[[...') || e.startsWith('[...')) seg = 'sample-slug/sample-two'
    else if (e.startsWith('[')) seg = 'sample-slug'
    else seg = e
    out.push(...routePaths(join(dir, e), [...segs, seg]))
  }
  return out
}

describe('G3 the patterns shadow no live route and leave other addresses as today', () => {
  it('finds the admin folder, so messages can mask it', () => {
    expect(ADMIN_NAMES).toHaveLength(1)
  })

  it('no page or route in app/ (dynamic segments filled) matches any pattern', () => {
    const paths = routePaths('app')
    expect(paths.length).toBeGreaterThan(100)
    const shadowed = paths.filter((p) => patterns.some((r) => matches(r, p))).map(mask)
    expect(shadowed).toEqual([])
  })

  it('no top-level folder, alone or with a sample child, matches any pattern', () => {
    const tops = readdirSync('app').filter((d) => statSync(join('app', d)).isDirectory() && !d.startsWith('('))
    const shadowed = tops
      .flatMap((d) => ['/' + d, '/' + d + '/sample-slug'])
      .filter((p) => patterns.some((r) => matches(r, p)))
      .map(mask)
    expect(shadowed).toEqual([])
  })

  it.each(['/wp-login.php', '/wp-admin', '/wp-admin/edit.php', '/wp-content/uploads/2023/12/x.png', '/wp-includes/js/x.js',
    '/wp-json/wp/v2/posts', '/xmlrpc.php', '/2023', '/__trashed', '/', '/some-old-post'])('%s matches no pattern', (path) => {
    expect(patterns.filter((r) => matches(r, path))).toEqual([])
  })
})

describe('G4 the renamed-slug map: 3 rows added, the 148 unchanged', () => {
  const NEW: Array<[string, string]> = [
    ['equity-share-capital', 'equity-share-capital-ordinary-share-capital'],
    ['financial-asset-2', 'financial-asset'],
    ['tangible-non-current-asset-2', 'tangible-non-current-asset-property-plant-equipment-ppe'],
  ]
  it('holds 151 rows, the 3 new ones exactly as decided', () => {
    expect(LEGACY_RENAMED_SLUG_COUNT).toBe(151)
    expect(LEGACY_RENAMED_SLUGS.size).toBe(151)
    for (const [old, slug] of NEW) expect(LEGACY_RENAMED_SLUGS.get(old)).toEqual({ kind: 'article', slug })
    expect(LEGACY_RENAMED_SLUGS.get('tangible-non-current-asset-2')).toEqual(LEGACY_RENAMED_SLUGS.get('tangible-non-current-asset'))
  })

  it('keeps the 148 old rows byte for byte (sha256 taken from main before the change)', () => {
    const added = new Set(NEW.map(([o]) => o))
    const old = Array.from(LEGACY_RENAMED_SLUGS)
      .filter(([k]) => !added.has(k))
      .map(([k, t]) => k + '|' + t.kind + '|' + t.slug)
      .sort()
    expect(old).toHaveLength(148)
    expect(sha256(old.join('\n'))).toBe('0a8ca5c7b8bca01ae20f453b708393f2514395c4eaba602995a90652e5d58942')
  })

  it('keeps the file sort order (by the old address with its slashes) and 10 question-set rows', () => {
    const keys = Array.from(LEGACY_RENAMED_SLUGS.keys())
    const sorted = [...keys].sort((a, b) => ('/' + a + '/' < '/' + b + '/' ? -1 : 1))
    expect(keys).toEqual(sorted)
    expect(Array.from(LEGACY_RENAMED_SLUGS.values()).filter((t) => t.kind === 'question-set')).toHaveLength(10)
  })
})

describe('G5 /search is noindex, follow and out of the pages sitemap', () => {
  it('layout metadata: robots noindex, follow, and the same canonical as before', async () => {
    const { generateMetadata } = await import('@/app/search/layout')
    const m = await generateMetadata()
    expect(m).toEqual({
      alternates: { canonical: 'https://accountingbody.com/search' },
      openGraph: { url: 'https://accountingbody.com/search' },
      robots: { index: false, follow: true },
    })
  })

  it('the pages sitemap lists the same fixed pages as before, minus /search', async () => {
    const { GET } = await import('@/app/sitemaps/pages.xml/route')
    const xml = await (await GET()).text()
    const locs = Array.from(xml.matchAll(/<loc>([^<]*)<\/loc>/g)).map((m) => m[1])
    const AB = 'https://accountingbody.com'
    const want = ['', '/study', '/practice-questions', '/jobs', '/jobs/listings', '/articles', '/glossary', '/calculators',
      '/global-payroll', '/dictionary', '/free-courses', '/get-help', '/firms-freelancers', '/about', '/contact',
      '/privacy-policy', '/terms', '/cookie-policy', '/study/acca', '/study/cima', '/study/aat', '/study/icaew'].map((p) => AB + p)
    expect(locs).toEqual(want)
    expect(xml).not.toContain('/search<')
  })
})

describe('G6 scope: only the planned lines change', () => {
  const NEW_LINES = [
    "import { LEGACY_WORDPRESS_PATTERNS } from './lib/legacy-wordpress-redirects.mjs'",
    '      // Old WordPress address classes without an exact row (frozen patterns; after every exact rule)',
    '      ...LEGACY_WORDPRESS_PATTERNS.map(({ source, destination }) => ({ source, destination, permanent: true })),',
    // B2 (D320): the one course with a new address.
    '      // One course has a new address (owner decision D320)',
    "      { source: '/free-courses/test-3', destination: '/free-courses/bookkeeping-essentials-recording-financial-transactions', permanent: true },",
    "      { source: '/free-courses/test-3/:path*', destination: '/free-courses/bookkeeping-essentials-recording-financial-transactions/:path*', permanent: true },",
  ]
  it('next.config.mjs = main\'s file plus exactly the import, comment and spread lines', () => {
    const text = readFileSync('next.config.mjs', 'utf8')
    const lines = text.split('\n')
    for (const l of NEW_LINES) expect(lines.filter((x) => x === l), l).toHaveLength(1)
    expect(lines.indexOf(NEW_LINES[2])).toBe(lines.findIndex((x) => x.includes('...LEGACY_WORDPRESS_REDIRECTS.map(')) + 2)
    const without = lines.filter((x) => !NEW_LINES.includes(x)).join('\n')
    expect(sha256(without)).toBe('233fc0b44529d41a3cc9fbf3e494fcfc6695fb13fd037178aa253a819eb5bc7a')
  })

  it.each([
    // B3 (D325): the function region line (lib/function-region.test.ts).
    ['vercel.json', 'a9296250253e5c077d85ce411dbac37227a456aa3db2813632c54b2e49a568ec'],
    ['middleware.ts', 'd93412b73d16b115b288ab6d78999e2f3982a3485ada3c135a7c70122b14e92c'],
    // BP-2 (B): getAdminPath treats an empty ADMIN_PATH like unset.
    ['lib/middleware-logic.ts', 'e0378e7b89ad5007cf928664444f0d322620a534051d96fcb63421854f130612'],
    ['app/robots.ts', 'bb3375cf5cf479acb4255bc4bca7166374ef7b2cd2b457e16b832d8fcac75f4e'],
    ['app/[slug]/page.tsx', 'eba427305e900fbf9ba257aa128b8a35f1a5ce1a40e0ec0cdca7d95f60828032'],
    ['lib/slug-param.ts', '23aff618c927ccded22026c3ea21391b9009fda6eb97eca0ee40ba174c0e95eb'],
    ['app/api/search/route.ts', 'f2479522443d94c8430794c25448c91c21771de16151409b28df83b8f63b2eac'],
    ['app/search/page.tsx', '507941ca50c62c81c966d532d9e153c98dacd49f7d24e3e094e4d9eb34611b2a'],
    // VF-2 (F2, F6): the clear button is 24 by 24 px and the only one shown.
    // VF-2b (G2, G3): readable subject chips; the clear button is centred.
    ['app/search/SearchClient.tsx', '9af2d1bd8e19c71baa25ce912a0050e729d3c2dd59e89f113479821c526cd6f8'],
    ['app/api/ingest/[slug]/route.test.ts', '99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627'],
  ])('%s is byte-identical to main', (file, hash) => {
    expect(sha256(readFileSync(file, 'utf8'))).toBe(hash)
  })

  it('README states the current stack version', () => {
    expect(readFileSync('README.md', 'utf8').split('\n')[6]).toBe('- Next.js 15.5 App Router, React 19, TypeScript in strict mode')
  })
})
