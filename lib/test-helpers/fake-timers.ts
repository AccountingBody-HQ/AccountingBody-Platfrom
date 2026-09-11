import { vi } from 'vitest'

/**
 * Stubs global fetch to simulate a total network outage — every call
 * rejects, as if the endpoint were completely unreachable (DNS failure,
 * connection refused, etc). Returns the mock so a test can assert on
 * call count if needed.
 */
export function stubFetchWithTotalOutage() {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/**
 * Runs `action` under Vitest fake timers so real code paths that retry via
 * fetchWithRetry's exponential backoff (real `setTimeout`-based delays,
 * up to ~15s across default retries) resolve in milliseconds of wall time
 * instead of actually waiting it out. Always restores real timers
 * afterward, even if `action` throws.
 *
 * Usage:
 *   await expect(withFakeTimers(() => adapter.fetch(provider))).rejects.toThrow(...)
 */
export async function withFakeTimers<T>(action: () => Promise<T>): Promise<T> {
  vi.useFakeTimers()
  try {
    const resultPromise = action()
    // Attach a handler synchronously, in the same tick the promise is
    // created, so Node's unhandled-rejection tracking never flags it while
    // the timers below are being drained — the real assertion still runs
    // against the awaited result/rejection below.
    resultPromise.catch(() => {})
    await vi.runAllTimersAsync()
    return await resultPromise
  } finally {
    vi.useRealTimers()
  }
}
