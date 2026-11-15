import { describe, it, expect, vi, afterEach } from 'vitest'

// The pages reader is replaced so the route's answer to each result is tested
// on its own (the reads, log line and report are tested in lib/db.test.ts).
vi.mock('@/lib/db', () => ({
  getPagesSitemapContent: vi.fn(),
}))

import { GET } from './route'
import { getPagesSitemapContent } from '@/lib/db'

afterEach(() => {
  vi.clearAllMocks()
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

  it('still answers 200 with the static pages when there are no articles or question sets', async () => {
    vi.mocked(getPagesSitemapContent).mockResolvedValue({ ok: true, articles: [], questionSets: [] })

    const res = await GET()
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600, stale-while-revalidate=86400')
    expect(body).toContain('<loc>https://accountingbody.com/about</loc>')
    expect(body).not.toContain('/practice-questions/')
  })
})
