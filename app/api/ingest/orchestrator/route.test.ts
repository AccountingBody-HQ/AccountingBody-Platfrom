import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/providers', () => ({
  getProvidersDueForFetch: vi.fn(),
  reapStaleRuns: vi.fn().mockResolvedValue(0),
}))
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('orchestrator GET — fails loudly on a database error', () => {
  it('returns a real 500, not a 200 with an empty dispatched list, when getProvidersDueForFetch throws', async () => {
    const { GET } = await import('./route')
    const providers = await import('@/lib/providers')

    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.mocked(providers.getProvidersDueForFetch).mockRejectedValue(
      new Error('getProvidersDueForFetch: due-providers query failed: connection refused')
    )

    const req = new NextRequest('http://localhost/api/ingest/orchestrator', {
      headers: { authorization: 'Bearer test-secret' },
    })

    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
  })
})
