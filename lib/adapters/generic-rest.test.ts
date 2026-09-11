import { describe, it, expect, afterEach, vi } from 'vitest'
import { genericRestAdapter } from './generic-rest'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'
import { stubFetchWithTotalOutage, withFakeTimers } from '@/lib/test-helpers/fake-timers'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('genericRestAdapter — Rule 120 total outage', () => {
  it('throws the aggregated error when every keyword fails (total failure only, not partial)', async () => {
    stubFetchWithTotalOutage()
    const provider = makeProvider({
      adapter_key: 'generic-rest',
      base_url: 'https://example.com/api/jobs',
      request_config: { keyword_param: 'q' },
      keywords: ['accountant', 'auditor'],
    })

    await expect(
      withFakeTimers(() => genericRestAdapter.fetch(provider))
    ).rejects.toThrow(/all 2 keyword\(s\) failed/)
  })
})
