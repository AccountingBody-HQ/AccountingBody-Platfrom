import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ET-9 guards (owner decision D272): every page names its owner's domain in
// its canonical and og:url, whatever host serves it. Shared Accounting Body
// pages name accountingbody.com on both views; EthioTax-only pages name
// ethiotax.com on both views; an article, job or course has one owner; each
// sitemap lists only what its domain owns; owner-pending pages are unchanged.

const H = vi.hoisted(() => ({ map: new Map<string, string>(), reads: 0 }))
vi.mock('next/headers', () => ({
  headers: async () => {
    H.reads += 1
    return { get: (k: string) => H.map.get(k.toLowerCase()) ?? null }
  },
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
const DB = vi.hoisted(() => ({
  calls: [] as Array<[string, ...unknown[]]>,
  articles: [] as unknown[],
}))
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  for (const name of ['from', 'select', 'eq', 'in', 'or', 'contains', 'gt', 'gte', 'lt']) {
    builder[name] = (...args: unknown[]) => {
      DB.calls.push([name, ...args])
      return builder
    }
  }
  builder.order = (...args: unknown[]) => {
    DB.calls.push(['order', ...args])
    const thenable = Object.assign(Object.create(builder), {
      then: (resolve: (v: unknown) => unknown) => resolve({ data: DB.articles, error: null }),
    })
    return thenable
  }
  builder.limit = (...args: unknown[]) => {
    DB.calls.push(['limit', ...args])
    return Promise.resolve({ data: [], error: null })
  }
  builder.single = () => {
    DB.calls.push(['single'])
    return Promise.resolve({ data: null, error: { code: 'PGRST116' }, status: 406 })
  }
  return {
    ...(await importOriginal<typeof import('@/lib/supabase-server')>()),
    getServerSupabase: vi.fn(() => builder),
  }
})
vi.mock('@/lib/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db')>()),
  getArticleBySlug: vi.fn(),
  getArticlesByCategory: vi.fn(async () => []),
  getPublicQuestionSetBySlug: vi.fn(),
  getPagesSitemapContent: vi.fn(),
}))
vi.mock('@/lib/jobs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jobs')>()),
  getJobBySlug: vi.fn(),
  getSimilarJobs: vi.fn(async () => []),
  getJobSitemapEntries: vi.fn(),
  getJobSitemapChunk: vi.fn(),
}))
vi.mock('@/lib/coursesNew', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/coursesNew')>()),
  getPublicCourseBySlug: vi.fn(),
  getPublicLessonData: vi.fn(),
  getPublishedCourses: vi.fn(async () => []),
}))

import * as ReactModule from 'react'
import * as canonical from '@/lib/canonical'
import { getArticleBySlug, getPublicQuestionSetBySlug, getPagesSitemapContent } from '@/lib/db'
import { getJobBySlug, getJobSitemapEntries, getJobSitemapChunk } from '@/lib/jobs'
import { getPublicCourseBySlug, getPublicLessonData } from '@/lib/coursesNew'

const AB = 'https://accountingbody.com'
const ET = 'https://ethiotax.com'

// Some route modules build JSX when they load or render; vitest compiles it
// to React.createElement, so React is made available the way Next does.
;(globalThis as { React?: unknown }).React = ReactModule

// The three ways a request reaches the app: the Accounting Body view, the
// EthioTax view of a deployment, and live ethiotax.com (whose host header
// would have made the old host-based helper answer ethiotax.com).
type View = 'ab' | 'et' | 'live-et'
function setView(view: View) {
  H.map.clear()
  if (view === 'ab') {
    H.map.set('host', 'ab-preview.vercel.app')
  } else if (view === 'et') {
    H.map.set('host', 'ab-preview.vercel.app')
    H.map.set('x-et-platform', 'ethiotax')
  } else {
    H.map.set('host', 'ethiotax.com')
    H.map.set('x-forwarded-host', 'ethiotax.com')
    H.map.set('x-et-platform', 'ethiotax')
  }
}
const ALL_VIEWS: View[] = ['ab', 'et', 'live-et']

type Meta = { title?: unknown; description?: unknown; alternates?: { canonical?: unknown } | null; openGraph?: Record<string, unknown> | null }
function urls(m: Meta) {
  return { canonical: m.alternates?.canonical, og: m.openGraph?.url }
}

beforeEach(() => {
  setView('ab')
  H.reads = 0
  DB.calls.length = 0
  DB.articles = []
  vi.clearAllMocks()
})

// ── G1 ownerCanonical ─────────────────────────────────────────────────────────
describe('G1 ownerCanonical names the fixed owner base and never reads headers', () => {
  it('accountingbody → https://accountingbody.com on every view, ethiotax → https://ethiotax.com', () => {
    for (const view of ALL_VIEWS) {
      setView(view)
      H.reads = 0
      const ab = canonical.ownerCanonical('accountingbody', '/x/y')
      const et = canonical.ownerCanonical('ethiotax', '/x/y')
      expect(ab).toEqual({ alternates: { canonical: `${AB}/x/y` }, openGraph: { url: `${AB}/x/y` } })
      expect(et).toEqual({ alternates: { canonical: `${ET}/x/y` }, openGraph: { url: `${ET}/x/y` } })
      expect(ab).not.toBeInstanceOf(Promise)
      expect(H.reads).toBe(0)
    }
  })

  it('ownerUrl and the exported bases are the one source of the two domains', () => {
    expect(canonical.AB_URL).toBe(AB)
    expect(canonical.ET_URL).toBe(ET)
    expect(canonical.ownerUrl('accountingbody', '/')).toBe(`${AB}/`)
    expect(canonical.ownerUrl('ethiotax', '/faq')).toBe(`${ET}/faq`)
  })
})

// ── G2 static scan ────────────────────────────────────────────────────────────
const ROOT = join(__dirname, '..')
const APP = join(ROOT, 'app')
// Owner-pending pages (K5): the only route files that may keep the host-based helper.
const HB_FILES = [
  'app/about/page.tsx',
  'app/terms/page.tsx',
  'app/get-help/page.tsx',
  'app/get-help/[slug]/page.tsx',
  'app/get-help/company-formation/page.tsx',
  'app/global-payroll/layout.tsx',
  'app/global-payroll/[slug]/layout.tsx',
  'app/firms-freelancers/page.tsx',
  'app/firms-freelancers/join/layout.tsx',
]

function nonPublicTopFolders(): string[] {
  const out: string[] = []
  for (const name of readdirSync(APP)) {
    const layout = join(APP, name, 'layout.tsx')
    try {
      if (readFileSync(layout, 'utf8').includes('requireAdmin')) out.push(name, `${name}-login`)
    } catch {
      // no layout here
    }
  }
  return out
}

function publicRouteFiles(): string[] {
  const skip = new Set(['api', ...nonPublicTopFolders()])
  const files: string[] = []
  const walk = (dir: string, top: boolean) => {
    for (const name of readdirSync(dir)) {
      if (top && skip.has(name)) continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full, false)
      else if (/^(page|layout)\.tsx$/.test(name)) files.push(relative(ROOT, full).split('\\').join('/'))
    }
  }
  walk(APP, true)
  return files
}

describe('G2 the host-based helper is left only on owner-pending pages', () => {
  it('no public route file outside the HB list calls canonicalMetadata', () => {
    const files = publicRouteFiles()
    expect(files.length).toBeGreaterThan(50)
    const callers = files.filter(f => readFileSync(join(ROOT, f), 'utf8').includes('canonicalMetadata('))
    expect(callers.filter(f => !HB_FILES.includes(f))).toEqual([])
  })
})

// ── G3 home page (split) ──────────────────────────────────────────────────────
describe('G3 home page: each view names its own domain', () => {
  it('EthioTax view → https://ethiotax.com/, otherwise https://accountingbody.com/', async () => {
    const { generateMetadata } = await import('@/app/page')
    for (const view of ALL_VIEWS) {
      setView(view)
      const m = (await generateMetadata()) as Meta
      const want = view === 'ab' ? `${AB}/` : `${ET}/`
      expect(urls(m)).toEqual({ canonical: want, og: want })
    }
    setView('ab')
    H.map.set('host', 'ethiotax.com')
    expect(urls((await generateMetadata()) as Meta)).toEqual({ canonical: `${AB}/`, og: `${AB}/` })
  })
})

// ── K1 shared pages + G11 wording ─────────────────────────────────────────────
type Gen = () => Promise<Meta>
const SHARED: Array<{ path: string; load: () => Promise<Gen>; title?: string; description?: string }> = [
  { path: '/accessibility', load: async () => (await import('@/app/accessibility/page')).generateMetadata as Gen },
  { path: '/articles', load: async () => (await import('@/app/articles/page')).generateMetadata as Gen },
  { path: '/calculators', load: async () => (await import('@/app/calculators/layout')).generateMetadata as Gen },
  { path: '/contact', load: async () => (await import('@/app/contact/page')).generateMetadata as Gen },
  { path: '/cookie-policy', load: async () => (await import('@/app/cookie-policy/page')).generateMetadata as Gen,
    title: 'Cookie Policy', description: 'How Accounting Body uses cookies and how to manage your preferences. Last updated November 2026.' },
  { path: '/disclaimer', load: async () => (await import('@/app/disclaimer/page')).generateMetadata as Gen,
    title: 'Disclaimer', description: 'Important disclaimers regarding the accuracy and use of content on this platform. Last updated March 2026.' },
  { path: '/free-courses', load: async () => (await import('@/app/free-courses/page')).generateMetadata as Gen,
    title: 'Free Accounting Courses', description: 'Free online accounting courses for accounting and finance students. Structured lessons, worked examples, and built-in practice questions. No signup required.' },
  { path: '/freelancing-pathways', load: async () => (await import('@/app/freelancing-pathways/page')).generateMetadata as Gen,
    title: 'Freelancing Pathways | Accounting & Finance' },
  { path: '/glossary', load: async () => (await import('@/app/glossary/page')).generateMetadata as Gen, title: 'Accounting Glossary' },
  { path: '/jobs', load: async () => (await import('@/app/jobs/page')).generateMetadata as Gen },
  { path: '/jobs/listings', load: async () => (await import('@/app/jobs/listings/page')).generateMetadata as Gen,
    title: 'Accounting & Finance Jobs' },
  { path: '/jobs/find-work', load: async () => (await import('@/app/jobs/find-work/page')).generateMetadata as Gen,
    title: 'Find Work | Accounting & Finance Recruitment' },
  { path: '/jobs/guarantee', load: async () => (await import('@/app/jobs/guarantee/page')).generateMetadata as Gen },
  { path: '/jobs/hire-talent', load: async () => (await import('@/app/jobs/hire-talent/page')).generateMetadata as Gen,
    title: 'Hire Talent | Accounting & Finance Recruitment' },
  { path: '/jobs/how-it-works', load: async () => (await import('@/app/jobs/how-it-works/page')).generateMetadata as Gen },
  { path: '/jobs/post-a-job', load: async () => (await import('@/app/jobs/post-a-job/page')).generateMetadata as Gen },
  { path: '/mock-exams', load: async () => (await import('@/app/mock-exams/page')).generateMetadata as Gen,
    title: 'Mock Exams', description: 'Free timed mock exams organised by subject. 50 questions per attempt drawn from a live question bank. Unlimited attempts.' },
  { path: '/mock-exams/taxation', load: async () => {
    const g = (await import('@/app/mock-exams/[category]/page')).generateMetadata
    return (() => g({ params: Promise.resolve({ category: 'taxation' }) })) as Gen
  }, title: 'Tax Mock Exam', description: 'Free timed mock exam for Tax. 50 questions, 75 minutes, 60% pass mark. Unlimited attempts.' },
  { path: '/practice-questions', load: async () => (await import('@/app/practice-questions/page')).generateMetadata as Gen,
    title: 'Practice Questions', description: 'Exam-standard practice questions for accounting qualifications. Fresh random sets every session.' },
  { path: '/privacy-policy', load: async () => (await import('@/app/privacy-policy/page')).generateMetadata as Gen,
    title: 'Privacy Policy', description: 'How we collect, use, and protect your personal data. Last updated November 2026.' },
  { path: '/search', load: async () => (await import('@/app/search/layout')).generateMetadata as Gen },
  { path: '/study', load: async () => (await import('@/app/study/page')).generateMetadata as Gen,
    title: 'Study Notes', description: 'Comprehensive study notes for ACCA, CIMA, AAT, and ICAEW — the four leading professional accounting qualifications.' },
  { path: '/study/acca', load: async () => {
    const g = (await import('@/app/study/[category]/page')).generateMetadata
    return (() => g({ params: Promise.resolve({ category: 'acca' }), searchParams: Promise.resolve({}) })) as Gen
  }, title: 'ACCA Study Notes', description: 'Association of Chartered Certified Accountants — all 13 papers.' },
  { path: '/dictionary', load: async () => {
    const g = (await import('@/app/dictionary/page')).generateMetadata
    return (() => g({ searchParams: Promise.resolve({}) })) as Gen
  }, title: 'Accounting Dictionary & Glossary' },
  { path: '/dictionary', load: async () => {
    const g = (await import('@/app/dictionary/page')).generateMetadata
    return (() => g({ searchParams: Promise.resolve({ category: 'cost-accounting' }) })) as Gen
  }, title: 'cost accounting — Accounting Dictionary' },
]

describe('K1 shared pages name https://accountingbody.com on every view (and G11: wording unchanged)', () => {
  it.each(SHARED.map(s => [s.path, s] as const))('%s', async (_p, s) => {
    const gen = await s.load()
    for (const view of ALL_VIEWS) {
      setView(view)
      const m = await gen()
      expect(urls(m)).toEqual({ canonical: `${AB}${s.path}`, og: `${AB}${s.path}` })
      // Only og:url is set by the page itself, exactly as before.
      expect(Object.keys(m.openGraph ?? {})).toEqual(['url'])
      if (view === 'ab' && s.title !== undefined) expect(m.title).toBe(s.title)
      if (view === 'ab' && s.description !== undefined) expect(m.description).toBe(s.description)
    }
  })

  it('practice set (no owner field) → https://accountingbody.com on every view, title unchanged', async () => {
    const { generateMetadata } = await import('@/app/practice-questions/[slug]/page')
    vi.mocked(getPublicQuestionSetBySlug).mockResolvedValue({ title: 'Budgets', excerpt: 'Short.' } as never)
    for (const view of ALL_VIEWS) {
      setView(view)
      const m = (await generateMetadata({ params: Promise.resolve({ slug: 'budgets' }) })) as Meta
      expect(urls(m)).toEqual({ canonical: `${AB}/practice-questions/budgets`, og: `${AB}/practice-questions/budgets` })
      expect(m.description).toBe('Short.')
    }
    setView('ab')
    expect(((await generateMetadata({ params: Promise.resolve({ slug: 'budgets' }) })) as Meta).title)
      .toBe('Budgets | Accounting Body Practice Questions')
  })
})

// ── G4 EthioTax-only pages and the split company-formation page ───────────────
describe('G4 EthioTax-only pages name https://ethiotax.com on every view', () => {
  it('/study/mock-exams', async () => {
    const { generateMetadata } = await import('@/app/study/mock-exams/page')
    for (const view of ALL_VIEWS) {
      setView(view)
      const m = (await generateMetadata()) as Meta
      expect(urls(m)).toEqual({ canonical: `${ET}/study/mock-exams`, og: `${ET}/study/mock-exams` })
      expect(m.title).toBe('Mock Exams | ETICPA ATQ')
      expect(m.description).toBe('Free timed mock exams for the ETICPA ATQ qualification. 50 questions per attempt, drawn from a large question bank. Unlimited attempts.')
    }
  })

  it('/jobs/ethiopian-professionals', async () => {
    const { generateMetadata } = await import('@/app/jobs/ethiopian-professionals/page')
    for (const view of ALL_VIEWS) {
      setView(view)
      const m = (await generateMetadata()) as Meta
      expect(urls(m)).toEqual({ canonical: `${ET}/jobs/ethiopian-professionals`, og: `${ET}/jobs/ethiopian-professionals` })
      expect(m.title).toBe('Ethiopian Finance Professionals | EthioTax Recruitment')
    }
  })

  it('/get-help/company-formation: EthioTax view → ethiotax.com; Accounting Body view unchanged (host-based)', async () => {
    const { generateMetadata } = await import('@/app/get-help/company-formation/page')
    const P = '/get-help/company-formation'
    const og = {
      title: 'Company Formation | EthioTax',
      description: 'Set up your UK or Ethiopian company with confidence. EthioTax guides you through every step of company formation with expert support and local knowledge.',
      siteName: 'EthioTax',
      locale: 'en_GB',
      type: 'website',
    }
    setView('et')
    let m = (await generateMetadata()) as Meta
    expect(m.alternates).toEqual({ canonical: `${ET}${P}` })
    expect(m.openGraph).toEqual({ ...og, url: `${ET}${P}` })
    expect(m.title).toBe(og.title)
    expect(m.description).toBe(og.description)
    setView('ab')
    m = (await generateMetadata()) as Meta
    expect(m.alternates).toEqual({ canonical: `${AB}${P}` })
    expect(m.openGraph).toEqual({ ...og, url: `${AB}${P}` })
    // The owner-pending Accounting Body view keeps its host-based value.
    H.map.set('host', 'ethiotax.com')
    m = (await generateMetadata()) as Meta
    expect(urls(m)).toEqual({ canonical: `${ET}${P}`, og: `${ET}${P}` })
  })
})

// ── G5 ETICPA layouts ─────────────────────────────────────────────────────────
function eticpaChildLayouts(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (name === 'layout.tsx') out.push(full)
    }
  }
  walk(join(APP, 'study', 'eticpa'))
  return out.filter(f => f !== join(APP, 'study', 'eticpa', 'layout.tsx')).sort()
}

describe('G5 every ETICPA child layout: og:url = its canonical, og:title/og:description as inherited', () => {
  it('17 child layouts', async () => {
    const hub = (await import('@/app/study/eticpa/layout')).metadata as Meta
    const files = eticpaChildLayouts()
    expect(files).toHaveLength(17)
    for (const f of files) {
      const m = (await import(/* @vite-ignore */ f)).metadata as Meta
      const c = m.alternates?.canonical as string
      expect(c.startsWith(`${ET}/study/eticpa/`)).toBe(true)
      expect(m.openGraph).toEqual({
        title: hub.openGraph?.title,
        description: hub.openGraph?.description,
        url: c,
      })
    }
    expect(hub.openGraph?.title).toBe('ETICPA Study Notes | CPA & ATQ Qualification | EthioTax')
    expect(hub.openGraph?.description).toBe('Study notes, worked examples and exam guides for the ETICPA CPA and ATQ qualifications — built for Ethiopian finance professionals worldwide.')
  })
})

// ── G6 articles ───────────────────────────────────────────────────────────────
type Art = { slug: string; title: string; excerpt: string; category?: string; canonical_owner?: string; show_on_sites?: string[]; seo_title?: string; seo_description?: string }
const UNCONFIRMED: Art = { slug: 'cash-flow', title: 'Cash flow', excerpt: 'About cash.', category: 'acca', canonical_owner: 'accountingbody', show_on_sites: ['et'] }
const NO_OWNER: Art = { slug: 'cash-flow', title: 'Cash flow', excerpt: 'About cash.', category: 'acca', canonical_owner: undefined, show_on_sites: ['ab', 'et'] }
const ET_OWNED: Art = { slug: 'vat-et', title: 'VAT', excerpt: 'About VAT.', category: 'taxation', canonical_owner: 'ethiotax', show_on_sites: ['et'] }
const ET_UNCONFIRMED: Art = { slug: 'vat-et', title: 'VAT', excerpt: 'About VAT.', category: 'taxation', canonical_owner: 'ethiotax', show_on_sites: ['ab'] }

describe('G6 articles: confirmed owner, else accountingbody.com — never the serving host', () => {
  it('pure rule', () => {
    expect(canonical.contentOwner(UNCONFIRMED)).toBe('accountingbody')
    expect(canonical.contentOwner(NO_OWNER)).toBe('accountingbody')
    expect(canonical.contentOwner(ET_OWNED)).toBe('ethiotax')
    expect(canonical.contentOwner(ET_UNCONFIRMED)).toBe('accountingbody')
    expect(canonical.contentOwner({ canonical_owner: 'retired-site', show_on_sites: ['ab', 'et'] })).toBe('accountingbody')
    expect(canonical.resolveArticleCanonicalUrl(NO_OWNER)).toBe(`${AB}/study/acca/cash-flow`)
    expect(canonical.resolveArticleCanonicalUrl(ET_OWNED)).toBe(`${ET}/study/taxation/vat-et`)
  })

  it('both article routes: one address on every view; titles unchanged', async () => {
    const studyArt = (await import('@/app/study/[category]/[slug]/page')).generateMetadata
    const plainArt = (await import('@/app/articles/[slug]/page')).generateMetadata
    for (const [art, want] of [[NO_OWNER, `${AB}/study/acca/cash-flow`], [UNCONFIRMED, `${AB}/study/acca/cash-flow`], [ET_OWNED, `${ET}/study/taxation/vat-et`]] as const) {
      vi.mocked(getArticleBySlug).mockResolvedValue(art as never)
      for (const view of ALL_VIEWS) {
        setView(view)
        const a = (await studyArt({ params: Promise.resolve({ category: art.category as string, slug: art.slug }) })) as Meta
        const b = (await plainArt({ params: Promise.resolve({ slug: art.slug }) })) as Meta
        expect(urls(a)).toEqual({ canonical: want, og: want })
        expect(urls(b)).toEqual({ canonical: want, og: want })
        expect(a.title).toBe(art.title)
        // /articles/[slug] keeps its old title brand rule: confirmed owner, else the serving host.
        const brand = art === ET_OWNED || view === 'live-et' ? 'EthioTax' : 'Accounting Body'
        expect(b.title).toBe(`${art.title} | ${brand}`)
      }
    }
  })
})

// ── G7 jobs ───────────────────────────────────────────────────────────────────
const JOB_BASE = {
  id: 'j1', slug: 'tax-manager', title: 'Tax Manager', company_name: 'Acme', company_domain: null,
  description: 'Line one.\nLine two.', excerpt: 'Short.', location_text: 'London', location_city: 'London',
  location_country: 'GB', location_remote: false, salary_text: null, salary_min: null, salary_max: null,
  salary_currency: null, salary_is_predicted: false, employment_type: 'permanent', seniority_level: 'mid',
  category: null, qualifications_required: [], skills_required: [], skills_nice_to_have: [],
  apply_method: 'external', application_url: 'https://example.test/apply', application_email: null,
  source: 'adzuna', source_url: null, is_featured: false, published_at: '2026-11-01T00:00:00.000Z',
  created_at: '2026-11-01T00:00:00.000Z', expires_at: null, status: 'active', closed_at: null,
}
function job(platform: string[], owner: string) {
  return { ...JOB_BASE, platform, canonical_owner: owner }
}

function findProps(node: unknown, type: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findProps(n, type)
      if (r) return r
    }
    return null
  }
  const el = node as { type?: unknown; props?: Record<string, unknown> }
  if (el.type === type) return el.props ?? null
  return findProps(el.props?.children, type)
}

describe('G7 jobs: one owner per job; the share link stays the serving site', () => {
  it('the four owner cases', () => {
    expect(canonical.jobCanonicalOwner({ platform: ['ab', 'et'], canonical_owner: 'ethiotax' })).toBe('ethiotax')
    expect(canonical.jobCanonicalOwner({ platform: ['ab', 'et'], canonical_owner: 'accountingbody' })).toBe('accountingbody')
    expect(canonical.jobCanonicalOwner({ platform: ['ab'], canonical_owner: 'ethiotax' })).toBe('accountingbody')
    expect(canonical.jobCanonicalOwner({ platform: ['et'], canonical_owner: 'accountingbody' })).toBe('ethiotax')
    expect(canonical.jobCanonicalOwner({ platform: ['et'], canonical_owner: 'retired' })).toBe('ethiotax')
    expect(canonical.jobCanonicalOwner({ platform: ['ab', 'et'], canonical_owner: 'retired' })).toBe('accountingbody')
    expect(canonical.getJobCanonicalUrl({ slug: 's', platform: ['et'], canonical_owner: 'accountingbody' })).toBe(`${ET}/jobs/s`)
  })

  it('job page metadata: a shared job names accountingbody.com on both views; an EthioTax-only job ethiotax.com', async () => {
    const { generateMetadata } = await import('@/app/jobs/[slug]/page')
    vi.mocked(getJobBySlug).mockResolvedValue(job(['ab', 'et'], 'accountingbody') as never)
    for (const view of ALL_VIEWS) {
      setView(view)
      const m = (await generateMetadata({ params: Promise.resolve({ slug: 'tax-manager' }) })) as Meta
      expect(urls(m)).toEqual({ canonical: `${AB}/jobs/tax-manager`, og: `${AB}/jobs/tax-manager` })
      expect(m.title).toBe('Tax Manager at Acme')
      expect(m.description).toBe('Short.')
      expect(m.openGraph).toEqual({ title: 'Tax Manager at Acme', description: 'Short.', url: `${AB}/jobs/tax-manager`, type: 'website' })
    }
    vi.mocked(getJobBySlug).mockResolvedValue(job(['et'], 'accountingbody') as never)
    setView('et')
    const m = (await generateMetadata({ params: Promise.resolve({ slug: 'tax-manager' }) })) as Meta
    expect(urls(m)).toEqual({ canonical: `${ET}/jobs/tax-manager`, og: `${ET}/jobs/tax-manager` })
  })

  it('the share button copies the address of the site the visitor is on', async () => {
    const page = await import('@/app/jobs/[slug]/page')
    const { ShareButton } = await import('@/app/jobs/[slug]/ShareButton')
    vi.mocked(getJobBySlug).mockResolvedValue(job(['ab', 'et'], 'accountingbody') as never)
    setView('ab')
    let tree = await page.default({ params: Promise.resolve({ slug: 'tax-manager' }) })
    expect(findProps(tree, ShareButton)?.url).toBe(`${AB}/jobs/tax-manager`)
    setView('et')
    tree = await page.default({ params: Promise.resolve({ slug: 'tax-manager' }) })
    expect(findProps(tree, ShareButton)?.url).toBe(`${ET}/jobs/tax-manager`)
    // …while the same request's canonical names the job's one owner.
    const m = (await page.generateMetadata({ params: Promise.resolve({ slug: 'tax-manager' }) })) as Meta
    expect(m.alternates?.canonical).toBe(`${AB}/jobs/tax-manager`)
  })

  it('the single-job read selects canonical_owner (and the public column list stays as it is)', async () => {
    const actual = await vi.importActual<typeof import('@/lib/jobs')>('@/lib/jobs')
    await actual.getJobBySlug('tax-manager').catch(() => null)
    const sel = DB.calls.find(c => c[0] === 'select')?.[1] as string
    expect(sel.split(', ')).toContain('canonical_owner')
    expect(sel.split(', ')).toContain('platform')
    expect(sel.startsWith('id, slug, title, company_name')).toBe(true)
  })
})

// ── G8 courses and lessons ────────────────────────────────────────────────────
describe('G8 courses and lessons: confirmed owner, else accountingbody.com; a lesson takes its course owner', () => {
  const course = (canonicalOwner: string, showOnSites: string[]) => ({
    title: 'Costing', slug: 'costing', description: 'About costing.', metaDescription: 'Meta.', canonicalOwner, showOnSites, chapters: [],
  })
  it('course and lesson pages', async () => {
    const crs = (await import('@/app/free-courses/[slug]/page')).generateMetadata
    const les = (await import('@/app/free-courses/[slug]/learn/[lessonSlug]/page')).generateMetadata
    const cases: Array<[ReturnType<typeof course>, string]> = [
      [course('accountingbody', ['ab', 'et']), AB],
      [course('ethiotax', ['et']), ET],
      [course('ethiotax', ['ab']), AB],
    ]
    for (const [c, base] of cases) {
      vi.mocked(getPublicCourseBySlug).mockResolvedValue(c as never)
      vi.mocked(getPublicLessonData).mockResolvedValue({ course: c, lesson: { title: 'Intro', articles: [] }, prevLesson: null, nextLesson: null } as never)
      for (const view of ALL_VIEWS) {
        setView(view)
        const a = (await crs({ params: Promise.resolve({ slug: 'costing' }) })) as Meta
        const b = (await les({ params: Promise.resolve({ slug: 'costing', lessonSlug: 'intro' }) })) as Meta
        expect(urls(a)).toEqual({ canonical: `${base}/free-courses/costing`, og: `${base}/free-courses/costing` })
        expect(urls(b)).toEqual({ canonical: `${base}/free-courses/costing/learn/intro`, og: `${base}/free-courses/costing/learn/intro` })
        expect(a.title).toBe('Costing')
        expect(a.description).toBe('Meta.')
        expect(b.title).toBe('Intro — Costing')
        expect(b.description).toBe('About costing.')
      }
    }
  })
})

// ── G9 /et-sitemap ────────────────────────────────────────────────────────────
const ET_FIXED = ['', '/how-it-works', '/about-ethiotax', '/faq', '/study/eticpa',
  '/study/eticpa/atq/level-1', '/study/eticpa/atq/level-1/introduction-to-accounting', '/study/eticpa/atq/level-1/cost-accounting',
  '/study/eticpa/atq/level-1/business-skills', '/study/eticpa/atq/level-1/ethiopian-business-law',
  '/study/eticpa/atq/level-2', '/study/eticpa/atq/level-2/financial-accounting', '/study/eticpa/atq/level-2/management-accounting',
  '/study/eticpa/atq/level-2/assurance-controls-ethics', '/study/eticpa/atq/level-2/ethiopian-taxation',
  '/study/eticpa/atq/level-2/ethiopian-public-sector-accounting', '/study/eticpa/cpa']
const HB_SITEMAP = ['/get-help', '/get-help/tax-filing-compliance', '/get-help/accounting-bookkeeping', '/get-help/business-consulting',
  '/get-help/payroll-services', '/get-help/company-formation', '/get-help/audit-assurance', '/get-help/financial-planning-advisory',
  '/firms-freelancers', '/firms-freelancers/join', '/firms-freelancers/directory', '/terms']
const AB_FIXED = ['/jobs', '/jobs/listings', '/study', '/study/acca', '/study/cima', '/study/aat', '/free-courses', '/practice-questions',
  '/mock-exams', '/articles', '/glossary', '/dictionary', '/calculators', '/search', '/contact', '/privacy-policy', '/cookie-policy',
  '/accessibility', '/disclaimer']
const LEGACY = ['/hire-talent', '/hire-talent/jobs', '/hire-talent/post-a-job']

function locs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]*)<\/loc>/g)).map(m => m[1])
}
const entry = (slug: string, platform: string[], owner: string) =>
  ({ slug, lastModified: new Date('2026-11-01T00:00:00.000Z'), platform, canonical_owner: owner })

describe('G9 /et-sitemap lists only what ethiotax.com owns', () => {
  it('fixed pages, articles and jobs', async () => {
    const { GET } = await import('@/app/et-sitemap/route')
    DB.articles = [
      { slug: 'vat-et', updated_at: '2026-11-01T00:00:00Z', category: 'taxation', canonical_owner: 'ethiotax', show_on_sites: ['et'] },
      { slug: 'vat-unconfirmed', updated_at: '2026-11-01T00:00:00Z', category: 'taxation', canonical_owner: 'ethiotax', show_on_sites: ['ab'] },
    ]
    vi.mocked(getJobSitemapEntries).mockResolvedValue({
      ok: true,
      entries: [
        entry('shared-job', ['ab', 'et'], 'accountingbody'),
        entry('et-only-job', ['et'], 'accountingbody'),
        entry('et-chosen-job', ['ab', 'et'], 'ethiotax'),
      ],
    } as never)
    const res = await GET()
    expect(res.status).toBe(200)
    const L = locs(await res.text())
    for (const p of ET_FIXED) expect(L).toContain(`${ET}${p}`)
    for (const p of HB_SITEMAP) expect(L).toContain(`${ET}${p}`)
    for (const p of AB_FIXED) expect(L).not.toContain(`${ET}${p}`)
    for (const p of LEGACY) expect(L).not.toContain(`${ET}${p}`)
    expect(L).toContain(`${ET}/study/taxation/vat-et`)
    expect(L.some(u => u.includes('vat-unconfirmed'))).toBe(false)
    expect(L).toContain(`${ET}/jobs/et-only-job`)
    expect(L).toContain(`${ET}/jobs/et-chosen-job`)
    expect(L.some(u => u.includes('shared-job'))).toBe(false)
    expect(L.every(u => u.startsWith(ET))).toBe(true)
    expect(L).toHaveLength(ET_FIXED.length + HB_SITEMAP.length + 1 + 2)
    // The article read is the same query as before: published, owner ethiotax, newest first.
    expect(DB.calls).toEqual([
      ['from', 'articles'],
      ['select', 'slug, updated_at, category, canonical_owner, show_on_sites'],
      ['eq', 'status', 'published'],
      ['eq', 'canonical_owner', 'ethiotax'],
      ['order', 'updated_at', { ascending: false }],
    ])
    expect(getJobSitemapEntries).toHaveBeenCalledWith('et')
  })

  it('the two job sitemap reads select platform and canonical_owner, with the same filters', async () => {
    const actual = await vi.importActual<typeof import('@/lib/jobs')>('@/lib/jobs')
    await actual.getJobSitemapEntries('et')
    await actual.getJobSitemapChunk('ab', 0)
    const selects = DB.calls.filter(c => c[0] === 'select').map(c => c[1])
    expect(selects).toEqual([
      'id, slug, status, expires_at, closed_at, published_at, created_at, platform, canonical_owner',
      'id, slug, status, expires_at, closed_at, published_at, created_at, platform, canonical_owner',
    ])
    expect(DB.calls.filter(c => c[0] === 'contains')).toEqual([['contains', 'platform', ['et']], ['contains', 'platform', ['ab']]])
  })
})

// ── G10 Accounting Body sitemaps ──────────────────────────────────────────────
describe('G10 the Accounting Body sitemaps leave out what ethiotax.com owns', () => {
  it('/sitemaps/pages.xml', async () => {
    const { GET } = await import('@/app/sitemaps/pages.xml/route')
    vi.mocked(getPagesSitemapContent).mockResolvedValue({
      ok: true,
      articles: [
        { slug: 'shared-art', updated_at: '2026-10-01T00:00:00Z', category: 'acca', canonical_owner: 'accountingbody', show_on_sites: ['ab', 'et'] },
        { slug: 'unconfirmed-art', updated_at: '2026-10-01T00:00:00Z', category: 'acca', canonical_owner: 'ethiotax', show_on_sites: ['ab'] },
        { slug: 'et-art', updated_at: '2026-10-01T00:00:00Z', category: 'taxation', canonical_owner: 'ethiotax', show_on_sites: ['ab', 'et'] },
      ],
      questionSets: [],
    })
    const L = locs(await (await GET()).text())
    expect(L).toContain(`${AB}/study/acca/shared-art`)
    expect(L).toContain(`${AB}/study/acca/unconfirmed-art`)
    expect(L.some(u => u.includes('et-art'))).toBe(false)
    expect(L.every(u => u.startsWith(AB))).toBe(true)
  })

  it('/sitemaps/jobs/[file]', async () => {
    const { GET } = await import('@/app/sitemaps/jobs/[file]/route')
    vi.mocked(getJobSitemapChunk).mockResolvedValue({
      ok: true,
      entries: [
        entry('shared-job', ['ab', 'et'], 'accountingbody'),
        entry('ab-only-job', ['ab'], 'accountingbody'),
        entry('et-chosen-job', ['ab', 'et'], 'ethiotax'),
      ],
    } as never)
    const res = await GET({} as never, { params: Promise.resolve({ file: '0.xml' }) })
    expect(res.status).toBe(200)
    const L = locs(await res.text())
    expect(L).toEqual([`${AB}/jobs/shared-job`, `${AB}/jobs/ab-only-job`])
  })
})
