import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import React, { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The .tsx files compile with the classic JSX runtime under vitest.
;(globalThis as { React?: typeof React }).React = React

// JF-2 guards: /jobs/listings sends its first page of job cards and real
// page links in the first HTML, through the same parse and load as
// /api/jobs/direct; the visitor's filters and paging keep working in the
// browser; the first render is the same text on the server and the browser.

const ROOT = process.cwd()
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')

const nav = vi.hoisted(() => ({ pathname: '/jobs/listings', search: '' }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}))

// The real lib/jobs module with its database readers replaced (as in
// app/api/jobs/direct/route.test.ts), so no test reaches a database.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))
vi.mock('@/lib/jobs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jobs')>()),
  getCachedListingJobs: vi.fn(),
  getCachedListingJobsCount: vi.fn(),
  getBrowsableJobsTotal: vi.fn(),
  getPrecountedFilterTotal: vi.fn(),
}))

beforeEach(async () => {
  const jobs = await import('@/lib/jobs')
  vi.mocked(jobs.getBrowsableJobsTotal).mockResolvedValue(null)
  vi.mocked(jobs.getPrecountedFilterTotal).mockResolvedValue(null)
  nav.pathname = '/jobs/listings'
  nav.search = ''
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

// ── Fixtures ────────────────────────────────────────────────────────────────

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0)

function fixtureJob(i: number, publishedAt = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString()) {
  return {
    id: `id-${i}`,
    slug: `fixture-job-${i}`,
    title: `Fixture role ${i}`,
    company_name: `Fixture Co ${i}`,
    source: 'adzuna',
    excerpt: 'Short fixture excerpt.',
    location_text: 'London',
    location_country: 'GB',
    location_remote: false,
    employment_type: 'permanent',
    seniority_level: 'senior',
    is_featured: false,
    published_at: publishedAt,
    created_at: publishedAt,
    salary_text: null,
    salary_min: 50000,
    salary_max: 60000,
    salary_currency: 'GBP',
  }
}

const JOBS_24 = Array.from({ length: 24 }, (_, i) => fixtureJob(i + 1))

type Initial = { key: string; jobs: unknown[]; total: number | null; renderedAt: number } | null

async function renderListings(search: string, initial: Initial, isEthioTax = false): Promise<string> {
  nav.search = search
  const { default: JobListingsClient } = await import('@/app/jobs/listings/JobListingsClient')
  const props = { isEthioTax, countryOptions: [], initial } as unknown as Parameters<typeof JobListingsClient>[0]
  return renderToString(createElement(JobListingsClient, props))
}

const SKELETON_MARK = 'rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse'
const count = (html: string, needle: string) => html.split(needle).length - 1
const cardLinks = (html: string) => (html.match(/<a [^>]*href="\/jobs\/fixture-job-\d+"/g) ?? []).length

// ── G1 First HTML ───────────────────────────────────────────────────────────

describe('G1 first HTML of the job list', () => {
  it('a matching initial page renders 24 card links, no skeleton, the en-GB headline and real page links', async () => {
    const html = await renderListings('', { key: 'ab|', jobs: JOBS_24, total: 13254, renderedAt: NOW })
    expect(cardLinks(html)).toBe(24)
    expect(count(html, SKELETON_MARK)).toBe(0)
    expect(html).toContain('13,254 jobs found')
    expect(html).toContain('href="/jobs/listings?page=2"')
    expect(html).toContain(`href="/jobs/listings?page=${Math.ceil(13254 / 24)}"`)
  })

  it('page links keep the filters, and page 1 has no page parameter', async () => {
    const html = await renderListings('remote=true&page=2', { key: 'ab|?remote=true&page=2', jobs: JOBS_24, total: 100, renderedAt: NOW })
    expect(cardLinks(html)).toBe(24)
    expect(html).toContain('href="/jobs/listings?remote=true&amp;page=3"')
    expect(html).toContain('href="/jobs/listings?remote=true"')
    expect(html).not.toContain('href="/jobs/listings?remote=true&amp;page=1"')
  })

  it('without a total, a full page renders a real Next link', async () => {
    const html = await renderListings('', { key: 'ab|', jobs: JOBS_24, total: null, renderedAt: NOW })
    expect(cardLinks(html)).toBe(24)
    expect(html).toMatch(/<a [^>]*href="\/jobs\/listings\?page=2"[^>]*aria-label="Next page"|<a [^>]*aria-label="Next page"[^>]*href="\/jobs\/listings\?page=2"/)
  })

  it('the EthioTax view uses its own key', async () => {
    const html = await renderListings('', { key: 'et|', jobs: JOBS_24, total: 50, renderedAt: NOW }, true)
    expect(cardLinks(html)).toBe(24)
    expect(count(html, SKELETON_MARK)).toBe(0)
  })

  it('a non-matching key or no initial page shows the skeleton exactly as today', async () => {
    for (const initial of [{ key: 'ab|?page=2', jobs: JOBS_24, total: 100, renderedAt: NOW }, { key: 'et|', jobs: JOBS_24, total: 100, renderedAt: NOW }, null]) {
      const html = await renderListings('', initial)
      expect(count(html, SKELETON_MARK)).toBe(6)
      expect(cardLinks(html)).toBe(0)
      expect(html).not.toContain('page=2')
    }
  })
})

// ── G2 Query identity ───────────────────────────────────────────────────────

// Verbatim copy of the query construction inside fetchJobs in
// app/jobs/listings/JobListingsClient.tsx as it was on main 4a80804
// (lines 813-828), with its closure values passed in. The shared builder
// must produce exactly this string for every state.
type UrlState = {
  search: string; location: string; sortBy: string; page: number
  filters: { qualifications: string[]; seniority: string[]; employmentTypes: string[]; locationCountry: string; remoteOnly: boolean; postedWithin: string; salaryMin: string; salaryMax: string }
}
function referenceQuery(platform: string, s: UrlState, PAGE_SIZE: number, POSTED_DAYS: Record<string, number>, DEFAULT_SORT: string): string {
  const { search: activeSearch, location: activeLocation, filters, sortBy, page } = s
  const params = new URLSearchParams({
    platform,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  })
  if (activeSearch) params.set('search', activeSearch)
  if (activeLocation) params.set('location', activeLocation)
  if (filters.employmentTypes.length > 0) params.set('employment_types', filters.employmentTypes.join(','))
  if (filters.seniority.length > 0) params.set('seniority', filters.seniority.join(','))
  if (filters.locationCountry !== 'all') params.set('location_country', filters.locationCountry)
  if (filters.remoteOnly) params.set('remote', 'true')
  if (filters.salaryMin.trim()) params.set('salary_min', filters.salaryMin.trim())
  if (filters.salaryMax.trim()) params.set('salary_max', filters.salaryMax.trim())
  if (filters.postedWithin !== 'all') params.set('posted_within', String(POSTED_DAYS[filters.postedWithin]))
  if (filters.qualifications.length > 0) params.set('qualifications', filters.qualifications.join(','))
  if (sortBy !== DEFAULT_SORT) params.set('sort_by', sortBy)
  return params.toString()
}

const URL_CASES = [
  '',
  'search=tax',
  'search=audit+senior&sort_by=recent',
  'location=London',
  'employment_types=permanent,contract',
  'seniority=senior,junior',
  'location_country=GB',
  'remote=true',
  'salary_min=+40000+&salary_max=90000',
  'posted_within=7d',
  'posted_within=24h',
  'qualifications=ACCA,CIMA',
  'sort_by=salary_high',
  'page=3',
  'search=fp%26a&location=Leeds&employment_types=contract&seniority=mid&location_country=GB&remote=true&salary_min=30000&salary_max=70000&posted_within=30d&qualifications=AAT&sort_by=salary_low&page=7',
  'page=abc&remote=yes&posted_within=99&sort_by=bogus&seniority=nope',
  'page=0&page=4',
]

describe('G2 one query builder', () => {
  it.each(URL_CASES)('state from "%s" → the same /api/jobs/direct query as today (ab and et)', async (qs) => {
    const u = await import('@/app/jobs/listings/urlState')
    const state = u.parseListingsUrlState(new URLSearchParams(qs))
    for (const platform of ['ab', 'et'] as const) {
      const expected = referenceQuery(platform, state as unknown as UrlState, 24, u.POSTED_DAYS, u.DEFAULT_SORT)
      expect(u.buildDirectJobsParams(state, platform, u.LISTINGS_PAGE_SIZE).toString()).toBe(expected)
    }
  })

  it('the shared page size is 24 and the client and the page both use it', async () => {
    const u = await import('@/app/jobs/listings/urlState')
    expect(u.LISTINGS_PAGE_SIZE).toBe(24)
    expect(read('app/jobs/listings/JobListingsClient.tsx')).toContain('const PAGE_SIZE = LISTINGS_PAGE_SIZE')
    expect(read('app/jobs/listings/JobListingsClient.tsx')).toContain('buildDirectJobsParams(urlState, platform, PAGE_SIZE)')
    expect(read('app/jobs/listings/page.tsx')).toContain('buildDirectJobsParams(urlState, platform, LISTINGS_PAGE_SIZE)')
  })

  it('the view key is the platform plus the canonical search string', async () => {
    const u = await import('@/app/jobs/listings/urlState')
    expect(u.listingsViewKey('ab', u.parseListingsUrlState(new URLSearchParams('')))).toBe('ab|')
    expect(u.listingsViewKey('et', u.parseListingsUrlState(new URLSearchParams('page=abc&remote=true')))).toBe('et|?remote=true')
  })
})

// ── G3 One loader ───────────────────────────────────────────────────────────

describe('G3 one loader for the page and the route', () => {
  it('the page and route.ts both use the shared parse and load', () => {
    const page = read('app/jobs/listings/page.tsx')
    expect(page).toContain("from '@/app/api/jobs/direct/load'")
    expect(page).toContain('loadFirstListingsPage(parseDirectJobsQuery(buildDirectJobsParams(urlState, platform, LISTINGS_PAGE_SIZE)))')
    const route = read('app/api/jobs/direct/route.ts')
    expect(route).toContain('parseDirectJobsQuery(searchParams)')
    expect(route).toContain('loadDirectJobsPage(query)')
    expect(route).toContain('loadDirectJobsTotal(query)')
    expect(route).not.toContain("from '@/lib/jobs'")
    expect(route).toContain("export const dynamic = 'force-dynamic'")
    expect(route).toContain("export const fetchCache = 'default-no-store'")
  })

  it('route.test.ts and pagination.test.ts are byte-identical', () => {
    expect(sha256(readFileSync(join(ROOT, 'app/api/jobs/direct/route.test.ts')))).toBe('b585c17e2593412fb772555c26920d310a73d57472566303425f6a113321bc02')
    expect(sha256(readFileSync(join(ROOT, 'app/api/jobs/direct/pagination.test.ts')))).toBe('edabe02a1e2947ccdf4d79c0897b91d238ab4315c6450af880571263486cde6f')
  })

  it('parseDirectJobsQuery reads the same values as the route always has', async () => {
    const { parseDirectJobsQuery } = await import('@/app/api/jobs/direct/load')
    const q = parseDirectJobsQuery(new URLSearchParams('platform=et&limit=999&offset=48&remote=true&posted_within=7&seniority=senior,bogus&sort_by=recent&count=true'))
    expect(q).toMatchObject({ limit: 50, offset: 48, countOnly: true })
    expect(q.baseParams).toMatchObject({ platform: 'et', remoteOnly: true, postedWithin: 7, seniorityLevels: ['senior'], sortBy: 'recent' })
  })

  it('loadDirectJobsPage returns the rows and the total, and total null after the grace time', async () => {
    const jobs = await import('@/lib/jobs')
    const { parseDirectJobsQuery, loadDirectJobsPage } = await import('@/app/api/jobs/direct/load')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue(JOBS_24 as never)
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(77)
    await expect(loadDirectJobsPage(parseDirectJobsQuery(new URLSearchParams('platform=ab&search=tax')))).resolves.toEqual({ jobs: JOBS_24, total: 77 })

    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobsCount).mockImplementation(() => new Promise<number>(() => {}))
    const pending = loadDirectJobsPage(parseDirectJobsQuery(new URLSearchParams('platform=ab&search=tax')))
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toEqual({ jobs: JOBS_24, total: null })
  })

  it('loadDirectJobsPage throws when the rows fail', async () => {
    const jobs = await import('@/lib/jobs')
    const { parseDirectJobsQuery, loadDirectJobsPage } = await import('@/app/api/jobs/direct/load')
    vi.mocked(jobs.getCachedListingJobs).mockRejectedValue(new Error('rows failed'))
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(1)
    await expect(loadDirectJobsPage(parseDirectJobsQuery(new URLSearchParams('platform=ab')))).rejects.toThrow('rows failed')
  })

  it('the first-page wait gives null on a timeout or an error, the page on success, and never rejects', async () => {
    const { loadFirstListingsPage, FIRST_PAGE_WAIT_MS } = await import('@/app/api/jobs/direct/load')
    expect(FIRST_PAGE_WAIT_MS).toBe(3000)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const query = { baseParams: { platform: 'ab' }, limit: 24, offset: 0, countOnly: false } as never
    vi.useFakeTimers()
    const slow = loadFirstListingsPage(query, FIRST_PAGE_WAIT_MS, () => new Promise(() => {}))
    await vi.advanceTimersByTimeAsync(FIRST_PAGE_WAIT_MS)
    await expect(slow).resolves.toBeNull()
    await expect(loadFirstListingsPage(query, FIRST_PAGE_WAIT_MS, () => Promise.reject(new Error('db down zqx')))).resolves.toBeNull()
    await expect(loadFirstListingsPage(query, FIRST_PAGE_WAIT_MS, () => Promise.resolve({ jobs: [], total: 0 }))).resolves.toEqual({ jobs: [], total: 0 })
    // Fixed texts only: no request values, no upstream message.
    for (const call of errors.mock.calls) expect(call).toHaveLength(1)
    expect(errors.mock.calls.flat().join(' ')).not.toContain('zqx')
  })

  it('the cards the page hands to the browser carry only the fields a card shows', async () => {
    const { toListingCard, LISTING_CARD_FIELDS } = await import('@/app/api/jobs/direct/load')
    const full = { ...fixtureJob(1), company_domain: 'x.test', skills_required: ['a'], application_email: 'jobs@x.test', platform: ['ab'] }
    const card = toListingCard(full as never)
    expect(Object.keys(card).sort()).toEqual([...LISTING_CARD_FIELDS].sort())
    expect(card).toEqual(fixtureJob(1))
  })
})

// ── G4 Client adoption ──────────────────────────────────────────────────────

describe('G4 the browser starts from the server page', () => {
  const initial = { key: 'ab|', jobs: [], total: 0, renderedAt: NOW }

  it('adopts a matching, fresh, not yet used initial page (no request), else fetches', async () => {
    const { shouldAdoptInitial, INITIAL_FRESH_MS } = await import('@/app/jobs/listings/urlState')
    expect(INITIAL_FRESH_MS).toBe(120_000)
    expect(shouldAdoptInitial({ initial, key: 'ab|', consumed: null, now: NOW + 500 })).toBe(true)
    expect(shouldAdoptInitial({ initial, key: 'ab|?page=2', consumed: null, now: NOW })).toBe(false)
    expect(shouldAdoptInitial({ initial: null, key: 'ab|', consumed: null, now: NOW })).toBe(false)
    expect(shouldAdoptInitial({ initial, key: 'ab|', consumed: initial, now: NOW })).toBe(false)
    expect(shouldAdoptInitial({ initial, key: 'ab|', consumed: null, now: NOW + 120_001 })).toBe(false)
    expect(shouldAdoptInitial({ initial, key: 'ab|', consumed: null, now: NOW - 120_001 })).toBe(false)
    const later = { ...initial, key: 'ab|?search=tax' }
    expect(shouldAdoptInitial({ initial: later, key: 'ab|?search=tax', consumed: initial, now: NOW })).toBe(true)
  })

  it('the client effect uses the decision, Retry still fetches, and filters write the URL with history.replaceState', () => {
    const src = read('app/jobs/listings/JobListingsClient.tsx')
    expect(src).toContain('shouldAdoptInitial({ initial, key: viewKey, consumed: adoptedRef.current, now: Date.now() })')
    expect(src).toContain('<button type="button" onClick={() => fetchJobs()}')
    expect(src).toContain("window.history.replaceState(null, '', pathname + buildListingsSearchString(next))")
    expect(src).not.toContain('router.replace(')
    expect(src).toContain('const params = buildDirectJobsParams(urlState, platform, PAGE_SIZE)')
  })
})

// ── G5 Pagination modes ─────────────────────────────────────────────────────

async function pager(props: Record<string, unknown>) {
  const { Pagination } = await import('@/components/Pagination')
  return renderToString(createElement(Pagination, { page: 3, totalPages: 9, total: 205, navLabel: 'Job results pages', itemLabel: 'job', ...props } as never))
}
async function prevNext(props: Record<string, unknown>) {
  const { PrevNextPagination } = await import('@/components/Pagination')
  return renderToString(createElement(PrevNextPagination, { page: 3, prevPage: 2, nextPage: 4, navLabel: 'Job results pages', ...props } as never))
}
const noop = () => {}
// How many <a> tags carry every given attribute (any attribute order).
const anchor = (html: string, ...attrs: string[]) =>
  (html.match(/<a [^>]*>/g) ?? []).filter((tag) => attrs.every((a) => tag.includes(` ${a}`))).length
const href = (n: number) => (n === 1 ? '/jobs/listings' : `/jobs/listings?page=${n}`)

describe('G5 pagination modes', () => {
  it('onChange only and hrefFor only render exactly today\'s markup', async () => {
    // Captured on main 4a80804 (before JF-2) from these exact renders.
    expect([
      sha256(await pager({ onChange: noop })),
      sha256(await pager({ hrefFor: href })),
      sha256(await prevNext({ onChange: noop })),
    ]).toStrictEqual([
      '5291c582292f534edca473ce7859d38e7ed7f47f853c6524731896326ff4aa08',
      '76982c49d3beb4524f7f2008eec578fa43c9ed964fe5d5fbfd037edca3d33529',
      '20ec30cf13cea85778508e22fbec9879f838c3539b240502db9d1a9b5c58eae6',
    ])
  })

  it('both props: numbers and Previous/Next are real links with today\'s classes and labels', async () => {
    const html = await pager({ onChange: noop, hrefFor: href })
    expect(html).not.toMatch(/<button type="button"/)
    for (const n of [1, 2, 4, 5, 9]) expect(anchor(html, `href="${href(n)}"`, `aria-label="Page ${n}"`), `page ${n}`).toBe(1)
    expect(anchor(html, 'href="/jobs/listings?page=3"', 'aria-current="page"', 'aria-label="Page 3"')).toBe(1)
    expect(anchor(html, 'href="/jobs/listings?page=2"', 'aria-label="Previous page"')).toBe(1)
    expect(anchor(html, 'href="/jobs/listings?page=4"', 'aria-label="Next page"')).toBe(1)
    const classes = (s: string) => (s.match(/class="[^"]*"/g) ?? []).sort()
    expect(classes(html)).toEqual(classes(await pager({ onChange: noop })))
    const pn = await prevNext({ onChange: noop, hrefFor: href })
    expect(anchor(pn, 'href="/jobs/listings?page=4"', 'aria-label="Next page"')).toBe(1)
    expect(anchor(pn, 'href="/jobs/listings?page=2"', 'aria-label="Previous page"')).toBe(1)
    // At a boundary: the same disabled button as before, not a link.
    const first = await pager({ page: 1, onChange: noop, hrefFor: href })
    expect(first).toMatch(/<button type="button" disabled="" aria-disabled="true" aria-label="Previous page"/)
    expect(anchor(first, 'aria-label="Previous page"')).toBe(0)
  })

  it('a plain click stays in the page; a modified or middle click is left to the browser', async () => {
    const { pagerLinkClick } = await import('@/components/Pagination')
    const ev = (over: Record<string, unknown> = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, preventDefault: vi.fn(), ...over })
    const onChange = vi.fn()
    const plain = ev()
    pagerLinkClick(plain as never, 2, onChange)
    expect(plain.preventDefault).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(2)
    for (const over of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
      const e = ev(over)
      onChange.mockClear()
      pagerLinkClick(e as never, 2, onChange)
      expect(onChange).not.toHaveBeenCalled()
      expect(e.preventDefault).not.toHaveBeenCalled()
    }
    const src = read('components/Pagination.tsx')
    expect(src.split('onClick={e => pagerLinkClick(e, ').length - 1).toBe(2)
    expect(src.split('prefetch={false}').length - 1).toBe(2)
  })
})

// ── G6 Same text on both sides ──────────────────────────────────────────────

function withGermanDefaultLocale() {
  const original = Number.prototype.toLocaleString
  vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (this: number, locales?: Intl.LocalesArgument, options?: Intl.NumberFormatOptions) {
    return original.call(this, locales ?? 'de-DE', options)
  })
}

describe('G6 the same first-render text on the server and the browser', () => {
  it('the results line and the pager context line group digits en-GB under any default locale', async () => {
    withGermanDefaultLocale()
    const { summariseResults } = await import('@/app/jobs/listings/resultsSummary')
    const s = summariseResults({ page: 2, pageSize: 24, rowsLength: 24, total: 13254 })
    expect(s.headline).toBe('13,254 jobs found')
    expect(s.detail).toBe('Showing 25–48 of 13,254')
    const html = await pager({ page: 1200, totalPages: 1300, total: 31200, onChange: noop })
    expect(html).toContain('Page <!-- -->1,200<!-- --> of <!-- -->1,300<!-- --> · <!-- -->31,200')
    expect(await prevNext({ page: 1200, prevPage: 1199, nextPage: 1201, onChange: noop })).toContain('Page <!-- -->1,200')
  })

  it('the first render dates the cards from renderedAt, not the clock', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW + 2 * 60 * 60 * 1000)
    const fresh = fixtureJob(1, new Date(NOW - 5 * 60 * 1000).toISOString())
    const nearlyDay = fixtureJob(2, new Date(NOW - 23 * 60 * 60 * 1000).toISOString())
    const html = await renderListings('', { key: 'ab|', jobs: [fresh, nearlyDay], total: 2, renderedAt: NOW })
    expect(html).toContain('>5m ago<')
    expect(html).toContain('>23h ago<')
    expect(html).not.toContain('>2h ago<')
    expect(count(html, '>New</span>')).toBe(2)
    const { formatRelativeDate } = await import('@/lib/job-format')
    expect(formatRelativeDate(fresh.published_at, NOW)).toBe('5m ago')
    expect(formatRelativeDate(fresh.published_at)).toBe('2h ago')
  })
})

// ── G7 Scope and identity ───────────────────────────────────────────────────

function adminDirs(): string[] {
  const layouts = execFileSync('git', ['ls-files', 'app/*/layout.tsx'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return layouts
    .filter((file) => read(file).includes('requireAdmin'))
    .flatMap((file) => {
      const dir = file.slice('app/'.length, file.length - '/layout.tsx'.length)
      return [`app/${dir}/`, `app/api/${dir}/`]
    })
}

function jf2Commits(): string[] {
  return execFileSync('git', ['log', '--format=%H', '--grep=^JF-2:', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
}

function jf2Touched(): string[] {
  return jf2Commits().flatMap((sha) => execFileSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', sha], { encoding: 'utf8' }).split('\n').filter(Boolean))
}

// Visible text candidates in a .tsx source: JSX text between tags and quoted
// literals of three or more characters that contain a letter. Code between
// an arrow or a type argument's `>` and the next `<` is not JSX text, so
// spans holding code punctuation are skipped.
function textCandidates(raw: string): Set<string> {
  // Comments are never shown.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const out = new Set<string>()
  for (const m of Array.from(src.matchAll(/(?<!=)>([^<>{}]*[A-Za-z][^<>{}]*)</g))) {
    if (!/[()=;[\]]/.test(m[1])) out.add(m[1].trim())
  }
  for (const m of Array.from(src.matchAll(/'([^'\n]{3,})'|"([^"\n]{3,})"|`([^`\n]{3,})`/g))) {
    const s = (m[1] ?? m[2] ?? m[3]).trim()
    if (/[A-Za-z]/.test(s)) out.add(s)
  }
  return out
}

describe('G7 scope and identity', () => {
  const OUT = [
    'lib/jobs.ts', 'app/jobs/listings/structured-data.tsx', 'app/jobs/listings/JobSearchHero.tsx', 'app/jobs/[slug]/',
    'app/practice-questions/', 'app/jobs/saved/', 'migrations/', 'lib/ingestion/', 'app/api/cron/', 'app/api/ingest/',
    'vercel.json', 'next.config', 'middleware', 'package.json', 'package-lock.json', 'CLAUDE.md', 'docs/AGENT-RULES.md', '.env.example',
  ]
  const ALLOWED = [
    'app/jobs/listings/page.tsx', 'app/jobs/listings/JobListingsClient.tsx', 'app/jobs/listings/urlState.ts',
    'app/jobs/listings/resultsSummary.ts', 'components/Pagination.tsx', 'app/api/jobs/direct/route.ts',
    'app/api/jobs/direct/load.ts', 'lib/job-format.ts', 'lib/jf-two.test.ts',
  ]

  it('no JF-2 commit touches a file out of scope (checked where the history is available)', () => {
    const touched = jf2Touched()
    expect(touched.filter((file) => OUT.some((out) => file.startsWith(out)))).toStrictEqual([])
    expect(touched.filter((file) => adminDirs().some((dir) => file.startsWith(dir)))).toStrictEqual([])
    expect(touched.filter((file) => !ALLOWED.includes(file))).toStrictEqual([])
  })

  it('no new visible text in the touched .tsx files (checked where the history is available)', () => {
    const commits = jf2Commits()
    if (commits.length === 0) return
    const base = `${commits[commits.length - 1]}^`
    // A shallow checkout (CI) may not hold the commit before the first JF-2 one.
    try { execFileSync('git', ['cat-file', '-e', `${base}{commit}`], { stdio: 'ignore' }) } catch { return }
    // Non-visible strings this job adds: class names, a path, a locale, props.
    const NON_VISIBLE = new Set<string>(['en-GB', 'Page {page.toLocaleString(\'en-GB\')}'])
    for (const file of ['app/jobs/listings/page.tsx', 'app/jobs/listings/JobListingsClient.tsx', 'components/Pagination.tsx']) {
      const before = textCandidates(execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8' }))
      const added = Array.from(textCandidates(read(file))).filter((s) => !before.has(s) && !NON_VISIBLE.has(s))
      expect(added.filter((s) => !/^[@./a-z_-]+$/i.test(s) || /\s/.test(s)), file).toStrictEqual([])
    }
  })

  it('structured data, the ingest characterisation test and the similar-jobs switch are byte-identical', () => {
    expect(sha256(readFileSync(join(ROOT, 'app/jobs/listings/structured-data.tsx')))).toBe('3f8ba1ee156649dee2798609eef52dce655aa6149ef08668015381c01ea46487')
    expect(sha256(readFileSync(join(ROOT, 'app/api/ingest/[slug]/route.test.ts')))).toBe('99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627')
    expect(read('lib/jobs.ts').split("  if (process.env.SIMILAR_JOBS_ENABLED !== 'true') return []\n")).toHaveLength(2)
  })

  it('generateMetadata and the structured data call are unchanged', () => {
    const page = read('app/jobs/listings/page.tsx')
    expect(page).toContain(
      "export async function generateMetadata(): Promise<Metadata> {\n" +
      "  const { isEthioTax } = await getRequestBrand()\n" +
      "  return {\n" +
      "    title: 'Accounting & Finance Jobs',\n" +
      "    description: brandText(isEthioTax, 'Find accounting and finance jobs globally. Search roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals across UK, US, Australia, Canada, Singapore and Africa.'),\n" +
      "    ...ownerCanonical('accountingbody', '/jobs/listings'),\n" +
      "  }\n" +
      "}\n",
    )
    expect(page).toContain('<JobListingsStructuredData isEthioTax={isEthioTax} />')
  })
})
