import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Whole-table counts and the job search use the longer read limit; other
// public reads keep the public read limit. Real supabase-js clients from the
// real factory; only the network is fake and answers after a set time.

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
}))

import { DB_LIMITS_MS, getServerSupabase } from './supabase-server'
import { resetCacheGuard } from './cache-guard'
import { getPublishedArticleCount, getPublishedQuestionCount, getQuestionSetBySlug } from './db'
import { getActiveDirectJobs, getBrowsableJobsCount, getJobBySlug } from './jobs'

type Settled = { done: boolean; value?: unknown; error?: unknown }

function track(promise: PromiseLike<unknown>): Settled {
  const state: Settled = { done: false }
  Promise.resolve(promise).then(
    (value) => {
      state.done = true
      state.value = value
    },
    (error: unknown) => {
      state.done = true
      state.error = error
    },
  )
  return state
}

// Answers after `delayMs` (never when null), and stops when its signal aborts.
function answersAfter(delayMs: number | null): typeof fetch {
  return (_input, init) =>
    new Promise((resolve, reject) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      const single = new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object') ?? false
      const timer =
        delayMs === null
          ? null
          : setTimeout(() => {
              if (method === 'HEAD') {
                resolve(new Response(null, { status: 200, headers: { 'content-range': '0-0/42' } }))
                return
              }
              const body = single ? { id: '1', slug: 's' } : [{ id: '1', slug: 's' }]
              resolve(
                new Response(JSON.stringify(body), {
                  status: 200,
                  headers: { 'content-type': 'application/json', 'content-range': '0-0/42' },
                }),
              )
            }, delayMs)
      init?.signal?.addEventListener(
        'abort',
        () => {
          if (timer) clearTimeout(timer)
          reject(init.signal?.reason)
        },
        { once: true },
      )
    })
}

async function runFor(run: () => Promise<unknown>, delayMs: number | null, waitMs: number): Promise<Settled> {
  vi.stubGlobal('fetch', vi.fn(answersAfter(delayMs)))
  const result = track(run())
  await vi.advanceTimersByTimeAsync(waitMs)
  return result
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  // The whole-table jobs count is now the estimate fallback; the pre-counted
  // row is a one-row read on the public read limit (supabase-contexts.test.ts).
  vi.stubEnv('JOBS_TOTAL_SOURCE', 'estimate')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  resetCacheGuard()
})

afterEach(() => {
  resetCacheGuard()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('heavy public reads use the longer read limit', () => {
  it('the longer read limit sits between the public read limit and 12 seconds', () => {
    expect(DB_LIMITS_MS.publicHeavyRead).toBeGreaterThan(DB_LIMITS_MS.publicRead)
    expect(DB_LIMITS_MS.publicHeavyRead).toBeLessThanOrEqual(12_000)
  })

  const heavy: [string, () => Promise<unknown>, unknown][] = [
    ['article count', () => getPublishedArticleCount('ab'), 42],
    ['question count', () => getPublishedQuestionCount(), 42],
    ['jobs count', () => getBrowsableJobsCount('ab'), 42],
    ['job search count', () => getActiveDirectJobs({ platform: 'ab', countOnly: true }), 42],
    ['job search', () => getActiveDirectJobs({ platform: 'ab' }), [{ id: '1', slug: 's' }]],
  ]

  describe.each([7_000, 9_000])('an answer after %i ms', (delayMs) => {
    it.each(heavy)('heavy public counts and job search: %s returns the answer', async (_name, run, expected) => {
      const result = await runFor(run, delayMs, delayMs)
      expect(result).toEqual({ done: true, value: expected })
    })

    it.each([
      ['question set page', () => getQuestionSetBySlug('s')],
      ['job page', () => getJobBySlug('s')],
    ] as [string, () => Promise<unknown>][])('ordinary public reads: %s still ends at the public read limit', async (_name, run) => {
      const result = await runFor(run, delayMs, DB_LIMITS_MS.publicRead)
      expect(result.done).toBe(true)
      expect(result.error).toBeInstanceOf(Error)
      expect(vi.mocked(console.warn).mock.calls).toContainEqual([expect.stringContaining(`(${DB_LIMITS_MS.publicRead} ms)`)])
    })
  })

  it('job search that never answers ends at the longer read limit', async () => {
    const result = await runFor(() => getActiveDirectJobs({ platform: 'ab' }), null, DB_LIMITS_MS.publicHeavyRead - 1)
    expect(result.done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(result.done).toBe(true)
    // The thrown search problem carries fixed text only; the time-limit line
    // names the limit that ended it.
    expect(String(result.error)).toBe('Error: getActiveDirectJobs: search_jobs_ranked failed')
    expect(vi.mocked(console.warn).mock.calls).toContainEqual([expect.stringContaining(`(${DB_LIMITS_MS.publicHeavyRead} ms)`)])
  })

  it('a jobs count that never answers ends at the longer read limit with the usual fallback', async () => {
    const result = await runFor(() => getBrowsableJobsCount('ab'), null, DB_LIMITS_MS.publicHeavyRead - 1)
    expect(result.done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(result).toEqual({ done: true, value: 0 })
  })

  it("a caller's own abort signal still ends a heavy read early", async () => {
    vi.stubGlobal('fetch', vi.fn(answersAfter(null)))
    const controller = new AbortController()
    const result = track(
      getServerSupabase('publicHeavyRead').from('jobs').select('*', { count: 'exact', head: true }).abortSignal(controller.signal),
    )
    await vi.advanceTimersByTimeAsync(100)
    expect(result.done).toBe(false)
    controller.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(result.done).toBe(true)
    expect(result.value).toMatchObject({ data: null, status: 0 })
    expect((result.value as { error: { hint: string } }).error.hint).toContain('aborted')
  })
})
