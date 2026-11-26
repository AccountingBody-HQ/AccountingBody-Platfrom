import { describe, it, expect, vi, afterEach } from 'vitest'

// The job reader is replaced so the route's answer to each result is tested
// on its own; the articles read gets a small fake client.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}))
vi.mock('@/lib/jobs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jobs')>()),
  getJobSitemapEntries: vi.fn(),
}))
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const builder = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
  }
  return {
    ...(await importOriginal<typeof import('@/lib/supabase-server')>()),
    getServerSupabase: vi.fn(() => builder),
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('/et-sitemap GET', () => {
  it('answers 500 that is never cached, not a 200 list without jobs, when the job read fails', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getJobSitemapEntries).mockResolvedValue({ ok: false })

    const res = await GET()

    expect(res.status).toBe(500)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.text()).not.toContain('<urlset')
    expect(jobs.getJobSitemapEntries).toHaveBeenCalledWith('et')
  })

  it('lists every job ethiotax.com owns with the usual hourly cache when the read works', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getJobSitemapEntries).mockResolvedValue({
      ok: true,
      entries: [
        { slug: 'job-a', lastModified: new Date('2026-11-01T00:00:00.000Z'), platform: ['et'], canonical_owner: 'accountingbody' },
        { slug: 'job-b', lastModified: new Date('2026-11-02T00:00:00.000Z'), platform: ['ab', 'et'], canonical_owner: 'ethiotax' },
      ],
    })

    const res = await GET()
    const xml = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600, must-revalidate')
    expect(res.headers.get('content-type')).toBe('application/xml')
    expect(xml).toContain('<loc>https://ethiotax.com/jobs/job-a</loc>')
    expect(xml).toContain('<loc>https://ethiotax.com/jobs/job-b</loc>')
    expect(xml).toContain('<lastmod>2026-11-02T00:00:00.000Z</lastmod>')
    // 29 fixed pages: 18 EthioTax pages + 11 owner-pending pages (ET-9, D272; VF-2 left out one that redirects;
    // SEO-1 S6 added the EthioTax mock exams, /study/mock-exams).
    expect(xml.match(/<url>/g)).toHaveLength(29 + 2)
    expect(xml).toContain('<loc>https://ethiotax.com/study/mock-exams</loc>')
  })

  it('still answers 200 for a real empty job list', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getJobSitemapEntries).mockResolvedValue({ ok: true, entries: [] })

    const res = await GET()

    expect(res.status).toBe(200)
    expect((await res.text()).match(/<url>/g)).toHaveLength(29)
  })
})
