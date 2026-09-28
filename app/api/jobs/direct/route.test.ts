import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/jobs', () => ({
  getCachedListingJobs: vi.fn(),
  getCachedListingJobsCount: vi.fn(),
}))

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

    const res = await GET(new NextRequest('http://localhost/api/jobs/direct?platform=ab&count=true'))

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

  it('passes the platform through to both cached lookups', async () => {
    const { GET } = await import('./route')
    const jobs = await import('@/lib/jobs')
    vi.mocked(jobs.getCachedListingJobs).mockResolvedValue([])
    vi.mocked(jobs.getCachedListingJobsCount).mockResolvedValue(0)

    await GET(new NextRequest('http://localhost/api/jobs/direct?platform=et&offset=24'))

    expect(vi.mocked(jobs.getCachedListingJobs).mock.calls[0][0]).toMatchObject({ platform: 'et', offset: 24, limit: 24 })
    expect(vi.mocked(jobs.getCachedListingJobsCount).mock.calls[0][0]).toMatchObject({ platform: 'et' })
  })
})
