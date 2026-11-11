import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The real lib/jobs module with its three database readers replaced, so the
// route's choice between them (isUnfilteredListing) is the real one.
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
}))

beforeEach(async () => {
  const jobs = await import('@/lib/jobs')
  vi.mocked(jobs.getBrowsableJobsTotal).mockResolvedValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('/api/jobs/direct GET — a database failure is never an empty 200', () => {
  it('returns a 503, not a 200 with an empty list, when the jobs query throws', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockRejectedValue(
      new Error('getActiveDirectJobs: search_jobs_ranked failed: upstream request timeout')
    )
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(10)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab'))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBeTruthy()
    expect(body.jobs).toBeUndefined()
  })

  it('returns a 503 for a count-only request whose count query throws', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobsCount).mockRejectedValue(
      new Error('getActiveDirectJobs: count query failed: upstream request timeout')
    )

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&search=tax&count=true'))

    expect(res.status).toBe(503)
  })

  it('returns a 200 with an empty list when filters genuinely match nothing', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue([])
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(0)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&search=nomatch'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ jobs: [], total: 0 })
  })

  it('keeps the HTTP response itself uncacheable', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue([])
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(0)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab'))

    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('clamps limit and offset before they reach the cached lookup', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue([])
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(0)

    await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&limit=100000&offset=9999999'))

    expect(vi.mocked(jobs.getCachedListingJobs).mock.calls[0][0]).toMatchObject({ limit: 50, offset: 1000000 })
  })

  it('passes the platform through to both cached lookups', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue([])
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(0)

    await GET(new NextRequest('http://localhost/api/jobs/direct?platform=et&offset=24&search=tax'))

    expect(vi.mocked(jobs.getCachedListingJobs).mock.calls[0][0]).toMatchObject({ platform: 'et', offset: 24, limit: 24 })
    expect(vi.mocked(jobs.getCachedListingJobsCount).mock.calls[0][0]).toMatchObject({ platform: 'et' })
  })
})

describe('/api/jobs/direct GET — jobs still show when the total is not available', () => {
  const ROWS = [
    { id: 'a1', slug: 'audit-senior', title: 'Audit Senior' },
    { id: 'b2', slug: 'tax-manager', title: 'Tax Manager' },
  ]
  const UNAVAILABLE_LINE = 'api/jobs/direct: total not available, rows returned without it'
  const ERROR_BODY = '{"error":"Could not load jobs right now."}'

  function timeoutError(): Error {
    const err = new Error('The operation was aborted due to timeout')
    err.name = 'TimeoutError'
    return err
  }

  it('returns 200 with the rows and total null when the count gives an error', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue(ROWS as never)
    vi.mocked(jobs.getCachedListingJobsCount).mockRejectedValue(
      new Error('getActiveDirectJobs: count query failed: upstream request timeout')
    )

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&search=tax'))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(JSON.stringify({ jobs: ROWS, total: null }))
    expect(res.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate')
  })

  it('returns 200 with the rows and total null when the count hits its time limit', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue(ROWS as never)
    vi.mocked(jobs.getCachedListingJobsCount).mockImplementation(() => Promise.reject(timeoutError()))

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=et&offset=24&location_country=Ethiopia'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ jobs: ROWS, total: null })
  })

  it('writes one fixed log line with no search words and no upstream text', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue(ROWS as never)
    vi.mocked(jobs.getCachedListingJobsCount).mockRejectedValue(new Error('relation detail zqxupstream'))

    await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&search=zqxvisitor&location=zqxplace'))

    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0]).toEqual([UNAVAILABLE_LINE])
    const written = JSON.stringify(log.mock.calls)
    expect(written).not.toContain('zqx')
  })

  it('still answers the same 503 when the rows fail and the count works', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockRejectedValue(new Error('search_jobs_ranked failed'))
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(10)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab'))

    expect(res.status).toBe(503)
    expect(await res.text()).toBe(ERROR_BODY)
    expect(res.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate')
  })

  it('still answers the same 503 when the rows and the count both fail', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockRejectedValue(new Error('search_jobs_ranked failed'))
    vi.mocked(jobs.getCachedListingJobsCount).mockImplementation(() => Promise.reject(timeoutError()))

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab'))

    expect(res.status).toBe(503)
    expect(await res.text()).toBe(ERROR_BODY)
  })

  it('answers a rows failure without waiting for the count', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockRejectedValue(new Error('search_jobs_ranked failed'))
    vi.mocked(jobs.getCachedListingJobsCount).mockImplementation(() => new Promise<number>(() => {}))

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab'))

    expect(res.status).toBe(503)
  })

  it('keeps the response unchanged when the rows and the count both work', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue(ROWS as never)
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(1234)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&search=tax'))

    expect(res.status).toBe(200)
    expect(await res.text()).toBe(JSON.stringify({ jobs: ROWS, total: 1234 }))
    expect(res.headers.get('cache-control')).toBe('no-store, no-cache, must-revalidate')
    expect(log).not.toHaveBeenCalled()
  })
})

// Yesterday's live failure (11 Nov 2026): with the exact count timing out,
// every request for the plain list waited for that count, and page 2's rows
// came from the slow ranked search, so "Next" sat on page 1 (dimmed, with
// its buttons inert) and then showed an error. The plain list now takes its
// total from the pre-counted row and never waits for the exact count.
describe('/api/jobs/direct GET — the plain list never waits for the exact count', () => {
  const ROWS = [{ id: 'j25', slug: 'audit-senior', title: 'Audit Senior' }]

  it('page 2 of the plain list answers with the pre-counted total while the exact count never finishes', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue(ROWS as never)
    vi.mocked(jobs.getCachedListingJobsCount).mockImplementation(() => new Promise<number>(() => {}))
    vi.mocked(jobs.getBrowsableJobsTotal).mockResolvedValue(13254)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&limit=24&offset=24'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ jobs: ROWS, total: 13254 })
    expect(jobs.getCachedListingJobsCount).not.toHaveBeenCalled()
    expect(jobs.getBrowsableJobsTotal).toHaveBeenCalledWith('ab')
    expect(vi.mocked(jobs.getCachedListingJobs).mock.calls[0][0]).toMatchObject({ platform: 'ab', limit: 24, offset: 24 })
  })

  it('answers total null (Previous/Next mode) when no total source is available', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue(ROWS as never)
    vi.mocked(jobs.getBrowsableJobsTotal).mockResolvedValue(null)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=et&offset=48'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ jobs: ROWS, total: null })
    expect(jobs.getBrowsableJobsTotal).toHaveBeenCalledWith('et')
  })

  it('treats "no filter" spellings as the plain list', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue([])
    vi.mocked(jobs.getBrowsableJobsTotal).mockResolvedValue(10)

    await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&location_country=all&search=%20&sort_by=recent'))

    expect(jobs.getCachedListingJobsCount).not.toHaveBeenCalled()
  })

  it('a filtered list keeps its exact count', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue([])
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(42)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&location_country=Ethiopia'))

    expect(await res.json()).toEqual({ jobs: [], total: 42 })
    expect(jobs.getBrowsableJobsTotal).not.toHaveBeenCalled()
  })

  it('a count-only request for the plain list uses the pre-counted total', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getBrowsableJobsTotal).mockResolvedValue(13254)

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&count=true'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ jobs: [], total: 13254 })
    expect(jobs.getCachedListingJobsCount).not.toHaveBeenCalled()
  })
})
