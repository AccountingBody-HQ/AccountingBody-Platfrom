import { describe, it, expect, vi, afterEach } from 'vitest'

// The pages reader is replaced so the route's answer to each result is tested
// on its own (the reads, log line and report are tested in lib/db.test.ts).
vi.mock('@/lib/db', () => ({
  getPagesSitemapContent: vi.fn(),
}))
// The mock-exam pool sizes (ME-1 S3): every subject open unless a test says otherwise.
const P = vi.hoisted(() => ({ sizes: new Map<string, number | null>() }))
vi.mock('@/lib/mock-exam-pool', () => ({
  getAbMockPoolSize: vi.fn(async (category: string) => (P.sizes.has(category) ? P.sizes.get(category) : 500)),
  getEticpaMockPoolSize: vi.fn(async () => 300),
}))

import { GET } from './route'
import { getPagesSitemapContent } from '@/lib/db'
import { MOCK_EXAM_SUBJECTS } from '@/lib/mock-exam-subjects'

afterEach(() => {
  vi.clearAllMocks()
  P.sizes.clear()
})

describe('/sitemaps/pages.xml GET', () => {
  it('answers 500 that is never cached, not a sitemap without articles, when a read fails', async () => {
    vi.mocked(getPagesSitemapContent).mockResolvedValue({ ok: false })

    const res = await GET()

    expect(res.status).toBe(500)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toContain('<urlset')
  })

  it('lists static pages, articles and question sets with the usual hourly cache when the reads work', async () => {
    vi.mocked(getPagesSitemapContent).mockResolvedValue({
      ok: true,
      articles: [{ slug: 'fixed-costs', updated_at: '2026-10-01T00:00:00Z', category: 'cost', show_on_sites: ['ab'] }],
      questionSets: [{ slug: 'variance-quiz', updated_at: '2026-10-02T00:00:00Z' }],
      courses: [],
    })

    const res = await GET()
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/xml')
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
    expect(body).toContain('<urlset')
    expect(body).toContain('<loc>https://accountingbody.com/study</loc>')
    expect(body).toMatch(/<loc>https:\/\/accountingbody\.com\/[^<]*fixed-costs<\/loc>/)
    expect(body).toContain('<loc>https://accountingbody.com/practice-questions/variance-quiz</loc>')
  })

  it('lists each course and its lessons once, at the addresses their own canonicals name (VF-2)', async () => {
    vi.mocked(getPagesSitemapContent).mockResolvedValue({
      ok: true,
      articles: [],
      questionSets: [],
      courses: [
        { slug: 'costing', updated_at: '2026-10-03T00:00:00Z', canonical_owner: 'accountingbody', show_on_sites: ['ab', 'et'], lessonSlugs: ['intro', 'overheads'] },
        { slug: 'no-owner', updated_at: null, canonical_owner: null, show_on_sites: ['ab'], lessonSlugs: [] },
        // Owned by ethiotax.com: its pages name that domain, so it is not listed here.
        { slug: 'et-owned', updated_at: null, canonical_owner: 'ethiotax', show_on_sites: ['ab', 'et'], lessonSlugs: ['one'] },
      ],
    })

    const body = await (await GET()).text()
    const courseLocs = Array.from(body.matchAll(/<loc>([^<]*\/free-courses\/[^<]*)<\/loc>/g)).map(m => m[1])

    expect(courseLocs).toEqual([
      'https://accountingbody.com/free-courses/costing',
      'https://accountingbody.com/free-courses/costing/learn/intro',
      'https://accountingbody.com/free-courses/costing/learn/overheads',
      'https://accountingbody.com/free-courses/no-owner',
    ])
    expect(body.match(/<lastmod>2026-10-03T00:00:00.000Z<\/lastmod>/g)).toHaveLength(3)
    expect(body).not.toContain('et-owned')
  })

  it('still answers 200 with the static pages when there are no articles or question sets', async () => {
    vi.mocked(getPagesSitemapContent).mockResolvedValue({ ok: true, articles: [], questionSets: [], courses: [] })

    const res = await GET()
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
    expect(body).toContain('<loc>https://accountingbody.com/about</loc>')
    expect(body).not.toContain('/practice-questions/')
  })

  // SEO-1 S6 (D350): the mock-exam hub and the subjects it lists; EthioTax-owned
  // pages (get-help services, /faq, /how-it-works, /study/mock-exams) stay in the
  // EthioTax sitemap only, because their canonicals name ethiotax.com.
  it('lists /mock-exams and each subject the hub lists, once, and no EthioTax-owned page', async () => {
    vi.mocked(getPagesSitemapContent).mockResolvedValue({ ok: true, articles: [], questionSets: [], courses: [] })
    const body = await (await GET()).text()
    const locs = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1])
    expect(locs.filter(l => l.includes('/mock-exams'))).toEqual([
      'https://accountingbody.com/mock-exams',
      ...['financial-accounting', 'financial-management', 'management-accounting', 'financial-market',
        'business-management', 'audit-assurance', 'taxation', 'economics'].map(s => `https://accountingbody.com/mock-exams/${s}`),
    ])
    expect(locs).toHaveLength(31)
    expect(new Set(locs).size).toBe(locs.length)
    expect(locs.some(l => /\/get-help\/|\/faq$|\/how-it-works$|\/study\/mock-exams$/.test(l))).toBe(false)
    // The subjects are exactly the ones the hub lists (the one list, ME-1 S3).
    const hubSlugs = MOCK_EXAM_SUBJECTS.map(s => s.slug)
    expect(locs.filter(l => l.includes('/mock-exams/')).map(l => l.split('/').pop())).toEqual(hubSlugs)
  })

  // ME-1 S3: a subject still under 50 questions ("Coming soon") is left out;
  // the open ones stay exactly as before. A failed pool read keeps it in.
  it('leaves out a Coming soon subject and keeps the open ones', async () => {
    vi.mocked(getPagesSitemapContent).mockResolvedValue({ ok: true, articles: [], questionSets: [], courses: [] })
    for (const slug of ['financial-market', 'business-management', 'taxation', 'economics']) P.sizes.set(slug, 0)
    P.sizes.set('audit-assurance', null)
    const body = await (await GET()).text()
    const locs = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1])
    expect(locs.filter(l => l.includes('/mock-exams'))).toEqual([
      'https://accountingbody.com/mock-exams',
      ...['financial-accounting', 'financial-management', 'management-accounting', 'audit-assurance']
        .map(s => `https://accountingbody.com/mock-exams/${s}`),
    ])
    expect(locs).toHaveLength(27)
  })
})
