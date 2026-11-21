import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// JP-1 guards (owner decision D55): one lifecycle rule for a job page —
// open while status is 'active' and the end date has not passed, otherwise
// closed (indexable for 14 days after the end date, then noindex). Closed
// pages say so, link to open jobs, have no apply block and no JobPosting
// data, and are not in either job sitemap. Open pages' JobPosting data names
// only a real country.

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const H = vi.hoisted(() => ({ map: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => H.map.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
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

// Records every query-builder call; .limit() answers the scripted rows once,
// then empty pages; .single() answers "no row".
const DB = vi.hoisted(() => ({ calls: [] as Array<[string, ...unknown[]]>, rows: [] as unknown[] }))
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const builder: Record<string, (...args: unknown[]) => unknown> = {}
  for (const name of ['from', 'select', 'eq', 'in', 'or', 'contains', 'gt', 'gte', 'lt', 'order']) {
    builder[name] = (...args: unknown[]) => {
      DB.calls.push([name, ...args])
      return builder
    }
  }
  builder.limit = (...args: unknown[]) => {
    DB.calls.push(['limit', ...args])
    const data = DB.rows
    DB.rows = []
    return Promise.resolve({ data, error: null })
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
vi.mock('@/lib/jobs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jobs')>()),
  getJobBySlug: vi.fn(),
  getSimilarJobs: vi.fn(async () => []),
}))

import * as ReactModule from 'react'
import * as jobs from '@/lib/jobs'
import { ApplyBarWithSticky } from '@/app/jobs/[slug]/ApplyBarWithSticky'
import { JobPostingStructuredData } from '@/app/jobs/[slug]/structured-data'
import { formatAbsoluteDate } from '@/lib/job-format'

;(globalThis as { React?: unknown }).React = ReactModule

const J = jobs as unknown as Record<string, unknown>
const MIN = 60 * 1000
const DAY = 24 * 60 * MIN
const NOW = Date.parse('2026-11-21T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

type Lifecycle = { status: string; expires_at: string | null; closed_at: string | null }
const stateOf = (job: Lifecycle, now = NOW) =>
  (J.getJobLifecycleState as (j: Lifecycle, n?: number) => string)(job, now)
const endOf = (job: Lifecycle, now = NOW) =>
  (J.getJobEndDate as (j: Lifecycle, n?: number) => string | null)(job, now)

beforeEach(() => {
  H.map.clear()
  DB.calls.length = 0
  DB.rows = []
  vi.mocked(jobs.getSimilarJobs).mockResolvedValue([])
})
afterEach(() => {
  vi.useRealTimers()
})

// ── G1 one lifecycle rule ────────────────────────────────────────────────────

describe('G1 the lifecycle rule', () => {
  const EXPIRIES: Array<[string, number | null]> = [
    ['null', null],
    ['future', NOW + 5 * DAY],
    ['1 minute past', NOW - MIN],
    ['14 days - 1 minute past', NOW - 14 * DAY + MIN],
    ['14 days + 1 minute past', NOW - 14 * DAY - MIN],
  ]
  // closed_at "present": for a past expiry, the expiry run's stamp 30 s after
  // it; otherwise a close 20 days ago (an early close).
  const closedAtFor = (exp: number | null) => (exp !== null && exp <= NOW ? exp + 30 * 1000 : NOW - 20 * DAY)

  function expected(status: string, exp: number | null, closed: number | null): [string, number | null] {
    if (status === 'active') {
      if (exp === null || exp > NOW) return ['open', null]
      return [NOW - exp > 14 * DAY ? 'closed_noindex' : 'closed', exp]
    }
    const candidates = [exp !== null && exp <= NOW ? exp : null, closed].filter((v): v is number => v !== null)
    if (candidates.length === 0) return ['closed', null]
    const end = Math.min(...candidates)
    return [NOW - end > 14 * DAY ? 'closed_noindex' : 'closed', end]
  }

  for (const status of ['active', 'expired']) {
    for (const [label, exp] of EXPIRIES) {
      for (const withClosed of [false, true]) {
        const closed = withClosed ? closedAtFor(exp) : null
        const [state, end] = expected(status, exp, closed)
        it(`${status} × expires ${label} × closed_at ${withClosed ? 'present' : 'absent'} → ${state}`, () => {
          const job = { status, expires_at: exp === null ? null : iso(exp), closed_at: closed === null ? null : iso(closed) }
          expect(stateOf(job)).toBe(state)
          const e = endOf(job)
          expect(e === null ? null : Date.parse(e)).toBe(end)
        })
      }
    }
  }

  it('exactly 14 days after the end date is still closed (indexable)', () => {
    expect(stateOf({ status: 'expired', expires_at: iso(NOW - 14 * DAY), closed_at: iso(NOW - 14 * DAY + 30_000) })).toBe('closed')
  })

  it('an early close (closed_at before a passed expiry) dates from closed_at', () => {
    const job = { status: 'expired', expires_at: iso(NOW - MIN), closed_at: iso(NOW - 20 * DAY) }
    expect(stateOf(job)).toBe('closed_noindex')
    expect(endOf(job)).toBe(iso(NOW - 20 * DAY))
  })

  it('statuses other than active are never open', () => {
    for (const status of ['expired', 'closed', 'rejected', 'draft']) {
      expect(stateOf({ status, expires_at: iso(NOW + DAY), closed_at: null })).not.toBe('open')
    }
  })

  it('CLOSED_NOINDEX_AFTER_DAYS is 14', () => {
    expect(J.CLOSED_NOINDEX_AFTER_DAYS).toBe(14)
  })

  it('uses the now it is given, not the clock', () => {
    const job = { status: 'active', expires_at: iso(NOW + DAY), closed_at: null }
    expect(stateOf(job, NOW)).toBe('open')
    expect(stateOf(job, NOW + 2 * DAY)).toBe('closed')
    expect(stateOf(job, NOW + 16 * DAY)).toBe('closed_noindex')
  })

  it('reads no field other than status, expires_at and closed_at', () => {
    const seen = new Set<string>()
    const job = new Proxy({ status: 'expired', expires_at: iso(NOW - DAY), closed_at: iso(NOW - DAY), title: 'x', published_at: iso(NOW) }, {
      get(target, key, receiver) {
        if (typeof key === 'string') seen.add(key)
        return Reflect.get(target, key, receiver)
      },
    })
    stateOf(job)
    endOf(job)
    expect(Array.from(seen).sort()).toEqual(['closed_at', 'expires_at', 'status'])
  })

  it('the old state names and the 365-day threshold are gone', () => {
    const src = read('lib/jobs.ts')
    expect(src).not.toContain('ARCHIVE_THRESHOLD_DAYS')
    expect(src).not.toMatch(/'stale'|'archived'/)
  })
})

// ── G2 sitemaps list open jobs only ──────────────────────────────────────────

describe('G2 both job sitemap readers', () => {
  const row = (n: number, status: string, exp: number | null, closed: number | null = null) => ({
    id: `id-${String(n).padStart(6, '0')}`, slug: `job-${n}`, status, expires_at: exp === null ? null : iso(exp),
    closed_at: closed === null ? null : iso(closed), published_at: '2026-11-01T00:00:00.000Z',
    created_at: '2026-11-01T00:00:00.000Z', platform: ['ab'], canonical_owner: 'accountingbody',
  })
  const FIXTURE = () => [
    row(1, 'active', NOW + DAY),
    row(2, 'active', null),
    row(3, 'expired', NOW - DAY, NOW - DAY + 30_000),
    row(4, 'expired', NOW - 40 * DAY, NOW - 40 * DAY + 30_000),
    row(5, 'active', NOW - MIN),
    row(6, 'expired', NOW + 10 * DAY, NOW - DAY),
  ]
  const READERS: Array<[string, () => Promise<unknown>]> = [
    ['getJobSitemapEntries', () => jobs.getJobSitemapEntries('et')],
    ['getJobSitemapChunk', () => jobs.getJobSitemapChunk('ab', 0)],
  ]

  for (const [name, call] of READERS) {
    it(`${name} filters status = 'active' and the expiry at query level`, async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      await call()
      expect(DB.calls).toContainEqual(['eq', 'status', 'active'])
      expect(DB.calls).toContainEqual(['or', `expires_at.is.null,expires_at.gt.${iso(NOW)}`])
      expect(DB.calls.filter(c => c[0] === 'in')).toEqual([])
      expect(DB.calls).toContainEqual(['limit', 1000])
      expect(DB.calls).toContainEqual(['order', 'id', { ascending: true }])
      const select = DB.calls.find(c => c[0] === 'select')?.[1] as string
      expect(select.split(', ')).toEqual(expect.arrayContaining(['status', 'expires_at', 'closed_at', 'platform', 'canonical_owner']))
    })

    it(`${name} lists only open rows, even if the query let a closed one through`, async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      DB.rows = FIXTURE()
      const result = (await call()) as { ok: boolean; entries?: Array<{ slug: string; lastModified: Date }> }
      expect(result.ok).toBe(true)
      expect(result.entries?.map(e => e.slug)).toEqual(['job-1', 'job-2'])
      expect(result.entries?.[0].lastModified).toEqual(new Date('2026-11-01T00:00:00.000Z'))
    })
  }

  it('the job page read selects status and closed_at on top of the public columns', async () => {
    const actual = await vi.importActual<typeof import('@/lib/jobs')>('@/lib/jobs')
    await actual.getJobBySlug('tax-manager').catch(() => null)
    const sel = (DB.calls.find(c => c[0] === 'select')?.[1] as string).split(', ')
    expect(sel).toContain('status')
    expect(sel).toContain('closed_at')
    expect(sel.slice(0, 4)).toEqual(['id', 'slug', 'title', 'company_name'])
    expect(DB.calls).toContainEqual(['in', 'status', ['active', 'expired']])
  })
})

// ── G3 / G4 the job page ─────────────────────────────────────────────────────

const JOB = {
  id: 'j1', slug: 'tax-manager', title: 'Tax Manager', company_name: 'Acme', company_domain: null,
  description: 'Line one.\nLine two.', excerpt: 'Short.', location_text: 'London', location_city: 'London',
  location_country: 'United Kingdom', location_remote: false, salary_text: null, salary_min: null, salary_max: null,
  salary_currency: null, salary_is_predicted: false, employment_type: 'permanent', seniority_level: 'mid',
  category: null, qualifications_required: [], skills_required: [], skills_nice_to_have: [],
  apply_method: 'external', application_url: 'https://example.test/apply', application_email: null,
  source: 'adzuna', source_url: null, platform: ['ab', 'et'], is_featured: false,
  published_at: '2026-10-01T09:00:00.000Z', created_at: '2026-10-01T09:00:00.000Z', expires_at: null as string | null,
  canonical_owner: 'accountingbody', status: 'active', closed_at: null as string | null,
}
const OPEN = { ...JOB, expires_at: iso(NOW + 10 * DAY) }
const CLOSED = { ...JOB, status: 'expired', expires_at: iso(NOW - 3 * DAY), closed_at: iso(NOW - 3 * DAY + 30_000) }
const CLOSED_OLD = { ...JOB, status: 'expired', expires_at: iso(NOW - 20 * DAY), closed_at: iso(NOW - 20 * DAY + 30_000) }
const PUBLIC_KEYS = Object.keys(JOB).filter(k => k !== 'status' && k !== 'closed_at')
const SIMILAR = [{ id: 's1', slug: 'other', title: 'Other', company_name: 'Beta', location_text: 'Leeds', location_country: 'United Kingdom', salary_min: null, salary_max: null, salary_currency: null, salary_text: null }]

type El = { type?: unknown; props?: Record<string, unknown> }
function elements(node: unknown, out: El[] = []): El[] {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const n of node) elements(n, out)
    return out
  }
  const el = node as El
  out.push(el)
  elements(el.props?.children, out)
  return out
}
function text(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join('')
  return text((node as El).props?.children)
}

async function renderPage(job: unknown, view: 'ab' | 'et' = 'ab') {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  H.map.clear()
  if (view === 'et') H.map.set('x-et-platform', 'ethiotax')
  vi.mocked(jobs.getJobBySlug).mockResolvedValue(job as never)
  const page = await import('@/app/jobs/[slug]/page')
  const tree = await page.default({ params: Promise.resolve({ slug: 'tax-manager' }) })
  const meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'tax-manager' }) })
  return { all: elements(tree), meta: meta as Record<string, unknown> }
}

const NOTICE_TEXT = (posted: string, end: string) =>
  `This job is no longer taking applications. It was posted on ${formatAbsoluteDate(posted)} and closed on ${formatAbsoluteDate(end)}.`
const SIMILAR_SENTENCE = 'You can also look at similar current roles below.'

describe('G3 job page metadata', () => {
  const cases: Array<[string, unknown, { index: boolean; follow: boolean }]> = [
    ['open', OPEN, { index: true, follow: true }],
    ['closed (3 days)', CLOSED, { index: true, follow: true }],
    ['closed_noindex (20 days)', CLOSED_OLD, { index: false, follow: true }],
  ]
  for (const [label, job, robots] of cases) {
    it(`${label}: robots ${robots.index ? 'index' : 'noindex'}, follow; canonical, title and description unchanged`, async () => {
      const { meta } = await renderPage(job)
      expect(meta.robots).toEqual(robots)
      expect(meta.title).toBe('Tax Manager at Acme')
      expect(meta.description).toBe('Short.')
      expect(meta.alternates).toEqual({ canonical: 'https://accountingbody.com/jobs/tax-manager' })
      expect(meta.openGraph).toEqual({ title: 'Tax Manager at Acme', description: 'Short.', url: 'https://accountingbody.com/jobs/tax-manager', type: 'website' })
    })
  }
})

describe('G4 the closed page and the open page', () => {
  for (const view of ['ab', 'et'] as const) {
    for (const [label, job] of [['closed', CLOSED], ['closed_noindex', CLOSED_OLD]] as const) {
      it(`${view} ${label}: the notice wording, link and order; no apply block, no JobPosting; closing line`, async () => {
        const { all } = await renderPage(job, view)
        const headings = all.filter(e => e.type === 'h2').map(text)
        expect(headings.indexOf('This job has closed')).toBeGreaterThan(-1)
        expect(headings.indexOf('This job has closed')).toBeLessThan(headings.indexOf('About this role'))
        const paras = all.filter(e => e.type === 'p').map(text)
        expect(paras).toContain(NOTICE_TEXT(job.published_at, job.expires_at))
        expect(paras.join('\n')).not.toContain(SIMILAR_SENTENCE)
        const links = all.filter(e => e.props?.href === '/jobs/listings')
        expect(links.map(text)).toEqual(['See open jobs'])
        expect(all.filter(e => e.type === ApplyBarWithSticky)).toHaveLength(0)
        expect(all.filter(e => e.type === JobPostingStructuredData)).toHaveLength(0)
        expect(paras).toContain(`Posted ${formatAbsoluteDate(job.published_at)} · Closed ${formatAbsoluteDate(job.expires_at)}`)
        expect(all.find(e => e.type === 'section')?.props?.className).toBe('py-12 md:py-16')
      })
    }
  }

  it('closed page with similar roles shown: the extra sentence follows the notice text', async () => {
    vi.mocked(jobs.getSimilarJobs).mockResolvedValue(SIMILAR as never)
    const { all } = await renderPage(CLOSED)
    const paras = all.filter(e => e.type === 'p').map(text)
    expect(paras).toContain(`${NOTICE_TEXT(CLOSED.published_at, CLOSED.expires_at)} ${SIMILAR_SENTENCE}`)
    expect(all.filter(e => e.type === 'h2').map(text)).toContain('Similar current roles')
  })

  for (const view of ['ab', 'et'] as const) {
    it(`${view} open: no notice; the apply block with today's job fields; JobPosting; Posted · Expires`, async () => {
      const { all } = await renderPage(OPEN, view)
      expect(all.filter(e => e.type === 'h2').map(text)).not.toContain('This job has closed')
      expect(all.filter(e => e.props?.href === '/jobs/listings')).toHaveLength(0)
      const bars = all.filter(e => e.type === ApplyBarWithSticky)
      expect(bars).toHaveLength(1)
      expect(Object.keys(bars[0].props?.job as object)).toEqual(PUBLIC_KEYS)
      expect(bars[0].props?.isEthioTax).toBe(view === 'et')
      const ld = all.filter(e => e.type === JobPostingStructuredData)
      expect(ld).toHaveLength(1)
      expect(Object.keys(ld[0].props?.job as object)).toEqual(PUBLIC_KEYS)
      const paras = all.filter(e => e.type === 'p').map(text)
      expect(paras).toContain(`Posted ${formatAbsoluteDate(OPEN.published_at)} · Expires ${formatAbsoluteDate(OPEN.expires_at)}`)
      expect(paras.join('\n')).not.toMatch(/no longer|closed on/)
      expect(all.find(e => e.type === 'section')?.props?.className).toBe('py-12 md:py-16 pb-[96px] md:pb-16')
    })
  }

  it('the old notice sentence is gone from the page source', () => {
    const src = read('app/jobs/[slug]/page.tsx')
    expect(src).not.toContain('no longer being updated')
    expect(src).not.toContain('explore similar current roles below')
  })
})

// ── G5 honest JobPosting data ────────────────────────────────────────────────

type RealCountryFn = (v: string | null | undefined) => { code: string; name: string } | null
const COUNTRY_PATH = '@/lib/job-country'
const loadRealCountry = async () =>
  ((await import(/* @vite-ignore */ COUNTRY_PATH)) as { realCountry: RealCountryFn }).realCountry
type Builder = (job: unknown, brand: string) => Record<string, unknown>
const loadBuilder = async () =>
  ((await import('@/app/jobs/[slug]/structured-data')) as unknown as { buildJobPostingSchema?: Builder }).buildJobPostingSchema as Builder

describe('G5 realCountry and the JobPosting builder', () => {
  it('realCountry: stored names and codes → ISO code and name; anything else → null', async () => {
    const realCountry = await loadRealCountry()
    expect(realCountry('United Kingdom')).toEqual({ code: 'GB', name: 'United Kingdom' })
    expect(realCountry('South Africa')).toEqual({ code: 'ZA', name: 'South Africa' })
    expect(realCountry('Czech Republic')).toEqual({ code: 'CZ', name: 'Czech Republic' })
    expect(realCountry(' united states ')).toEqual({ code: 'US', name: 'United States' })
    expect(realCountry('GB')).toEqual({ code: 'GB', name: 'United Kingdom' })
    expect(realCountry('uk')).toEqual({ code: 'GB', name: 'United Kingdom' })
    for (const v of ['Worldwide', 'worldwide', '', '  ', 'Remote', 'Anywhere', 'Multiple locations', 'United Kingdom, Ireland', 'XK', 'constructor', null, undefined]) {
      expect(realCountry(v)).toBeNull()
    }
  })

  it('a real country: addressCountry is its ISO code, the city stays; not remote → no applicant requirement', async () => {
    const build = await loadBuilder()
    const s = build(OPEN, 'Accounting Body')
    expect(s.jobLocation).toEqual({ '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'London', addressCountry: 'GB' } })
    expect(s).not.toHaveProperty('applicantLocationRequirements')
    expect(s).not.toHaveProperty('jobLocationType')
  })

  it('remote + a real country → TELECOMMUTE and applicantLocationRequirements Country', async () => {
    const build = await loadBuilder()
    const s = build({ ...OPEN, location_remote: true }, 'Accounting Body')
    expect(s.jobLocationType).toBe('TELECOMMUTE')
    expect(s.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'United Kingdom' })
  })

  it('no real country (Worldwide, empty, Remote, several) → no addressCountry, no jobLocation, no applicant requirement', async () => {
    const build = await loadBuilder()
    for (const country of ['Worldwide', '', 'Remote', 'United Kingdom, Ireland', null]) {
      for (const remote of [true, false]) {
        const s = build({ ...OPEN, location_country: country, location_remote: remote }, 'Accounting Body')
        expect(JSON.stringify(s)).not.toContain('addressCountry')
        expect(s).not.toHaveProperty('jobLocation')
        expect(s).not.toHaveProperty('applicantLocationRequirements')
        expect(s.jobLocationType === 'TELECOMMUTE').toBe(remote)
      }
    }
  })

  it('employmentType only when known; never logo, sameAs, baseSalary or directApply; validThrough from expires_at', async () => {
    const build = await loadBuilder()
    expect(build({ ...OPEN, employment_type: null }, 'x')).not.toHaveProperty('employmentType')
    expect(build({ ...OPEN, employment_type: 'contract' }, 'x').employmentType).toBe('CONTRACTOR')
    const s = build(OPEN, 'x')
    for (const key of ['logo', 'sameAs', 'baseSalary', 'directApply']) {
      expect(JSON.stringify(s)).not.toContain(`"${key}"`)
    }
    expect(Object.keys(s.hiringOrganization as object)).toEqual(['@type', 'name'])
    expect(s.validThrough).toBe(OPEN.expires_at)
    const code = read('app/jobs/[slug]/structured-data.tsx').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/\b(logo|sameAs|baseSalary|directApply)\b/)
    expect(code).not.toMatch(/addressCountry: job\.location_country/)
  })

  it('the JSON stays escaped for <', () => {
    const el = JobPostingStructuredData({ job: { ...OPEN, description: 'a </script><b>x</b>' } as never, brandName: 'x' }) as El
    const html = (el.props?.dangerouslySetInnerHTML as { __html: string }).__html
    expect(html).not.toContain('<')
    expect(JSON.parse(html).description).toBe('<p>a &lt;/script&gt;&lt;b&gt;x&lt;/b&gt;</p>')
  })
})

// ── G6 nothing out of scope ──────────────────────────────────────────────────

function adminDirs(): string[] {
  const layouts = execFileSync('git', ['ls-files', 'app/*/layout.tsx'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return layouts
    .filter((file) => read(file).includes('requireAdmin'))
    .flatMap((file) => {
      const dir = file.slice('app/'.length, file.length - '/layout.tsx'.length)
      return [`app/${dir}/`, `app/api/${dir}/`]
    })
}

function jp1Touched(): string[] {
  const commits = execFileSync('git', ['log', '--format=%H', '--grep=^JP-1:', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return commits.flatMap((sha) => execFileSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', sha], { encoding: 'utf8' }).split('\n').filter(Boolean))
}

describe('G6 scope', () => {
  const OUT = [
    'lib/ingestion/', 'app/jobs/[slug]/ApplyBarWithSticky.tsx', 'app/jobs/[slug]/ApplyButton.tsx', 'app/jobs/[slug]/ShareButton.tsx',
    'app/jobs/[slug]/BackToListingsLink.tsx', 'app/sitemap.xml/', 'app/sitemaps/', 'app/et-sitemap/', 'lib/canonical.ts',
    'lib/similar-jobs.ts', 'app/api/cron/', 'app/jobs/listings/', 'components/', 'vercel.json', 'next.config', 'middleware',
    'package.json', 'package-lock.json', 'CLAUDE.md', 'docs/', '.env.example', 'migrations/',
  ]
  const ALLOWED = [
    'lib/jobs.ts', 'app/jobs/[slug]/page.tsx', 'app/jobs/[slug]/structured-data.tsx', 'lib/job-country.ts',
    'lib/jp-one.test.ts', 'lib/jobs.test.ts', 'lib/page-lib-reporting.test.ts', 'lib/et-nine.test.ts', 'lib/sj-three.test.ts',
  ]

  it('no JP-1 commit touches a file out of scope (checked where the history is available)', () => {
    const touched = jp1Touched()
    expect(touched.filter((file) => OUT.some((out) => file.startsWith(out)))).toStrictEqual([])
    expect(touched.filter((file) => adminDirs().some((dir) => file.startsWith(dir)))).toStrictEqual([])
    expect(touched.filter((file) => !ALLOWED.includes(file))).toStrictEqual([])
  })

  it('the ingest characterisation test is byte-identical', () => {
    const hash = createHash('sha256').update(readFileSync(join(ROOT, 'app/api/ingest/[slug]/route.test.ts'))).digest('hex')
    expect(hash).toBe('99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627')
  })

  it('the similar-jobs kill switch line is byte-identical', () => {
    expect(read('lib/jobs.ts')).toContain("\n  if (process.env.SIMILAR_JOBS_ENABLED !== 'true') return []\n")
  })
})
