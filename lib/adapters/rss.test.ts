import { describe, it, expect, afterEach, vi } from 'vitest'
import { rssAdapter } from './rss'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'
import { stubFetchWithTotalOutage, withFakeTimers } from '@/lib/test-helpers/fake-timers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('rssAdapter — Rule 120 total outage', () => {
  it('rejects when the feed endpoint is completely unreachable', async () => {
    stubFetchWithTotalOutage()
    const provider = makeProvider({
      adapter_key: 'rss',
      base_url: 'https://example.com/jobs-feed.xml',
    })

    await expect(
      withFakeTimers(() => rssAdapter.fetch(provider))
    ).rejects.toThrow()
  })

  it('rejects when the feed endpoint returns a persistent 5xx status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 }))
    )
    const provider = makeProvider({
      adapter_key: 'rss',
      base_url: 'https://example.com/jobs-feed.xml',
    })

    await expect(
      withFakeTimers(() => rssAdapter.fetch(provider))
    ).rejects.toThrow(/HTTP 500/)
  })
})
