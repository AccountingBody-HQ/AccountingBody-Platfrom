import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DB_LIMITS_MS, DB_TIME_LIMIT_LOG, getServerSupabase, timeLimitedFetch, type DbContext } from './supabase-server'

// These tests use a real supabase-js client. Only the network is fake:
// `fetch` is replaced on the global object, which is where the factory's
// wrapper looks it up at call time.

const URL_ = 'https://example.supabase.co'
const KEY = 'test-key'

type Fetch = typeof fetch
type Settled = { done: boolean; value?: unknown }

function track<T>(promise: PromiseLike<T>): Settled {
  const state: Settled = { done: false }
  Promise.resolve(promise).then((value) => {
    state.done = true
    state.value = value
  })
  return state
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
}

// Never answers, but stops when its signal aborts (like Node's fetch).
const neverAnswers: Fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
  })

// Never answers and ignores its signal completely.
const ignoresSignal: Fetch = () => new Promise(() => {})

// Answers with headers at once, then the body never arrives and the body
// ignores the signal too.
const bodyStalls: Fetch = async () =>
  new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'content-type': 'application/json' } })

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_)
  vi.stubEnv('SUPABASE_SECRET_KEY', KEY)
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function limitLines(): unknown[][] {
  return warn.mock.calls.filter((call) => String(call[0]).startsWith(DB_TIME_LIMIT_LOG))
}

describe('database time limits', () => {
  it('names one limit per kind of work', () => {
    expect(DB_LIMITS_MS).toEqual({
      publicRead: 6000,
      publicWrite: 15000,
      admin: 20000,
      cron: 25000,
      ingest: 60000,
    })
  })

  it.each(Object.entries(DB_LIMITS_MS) as [DbContext, number][])(
    'a %s request that never answers ends with an error result at %i ms',
    async (context, limit) => {
      vi.stubGlobal('fetch', vi.fn(neverAnswers))
      const result = track(getServerSupabase(context).from('articles').select('id'))

      await vi.advanceTimersByTimeAsync(limit - 1)
      expect(result.done).toBe(false)

      await vi.advanceTimersByTimeAsync(1)
      expect(result.done).toBe(true)
      expect(result.value).toMatchObject({ data: null, count: null, status: 0, error: expect.any(Object) })
    },
  )

  it('a write uses the write limit, not the read limit', async () => {
    vi.stubGlobal('fetch', vi.fn(neverAnswers))
    const result = track(getServerSupabase('publicWrite').from('contacts').insert({ name: 'a' }))

    await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.publicRead)
    expect(result.done).toBe(false)
    await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.publicWrite - DB_LIMITS_MS.publicRead)
    expect(result.done).toBe(true)
    expect(result.value).toMatchObject({ data: null, status: 0 })
  })

  it('a fetch that ignores its signal still ends at the limit, with no unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      vi.stubGlobal('fetch', vi.fn(ignoresSignal))
      const result = track(getServerSupabase('publicRead').from('articles').select('id').eq('slug', 'a'))

      await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.publicRead)
      expect(result.done).toBe(true)
      expect(result.value).toMatchObject({ data: null, status: 0, error: expect.any(Object) })
      vi.useRealTimers()
      await new Promise((resolve) => setImmediate(resolve))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('a fetch that loses the race and fails later causes no unhandled rejection', async () => {
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const failsLate: Fetch = () =>
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error('late failure')), 30_000))
      const guarded = timeLimitedFetch(1000, failsLate)
      const outcome = guarded('https://example.test/').then(
        () => 'answered',
        (error: unknown) => (error as DOMException).name,
      )

      await vi.advanceTimersByTimeAsync(1000)
      expect(await outcome).toBe('TimeoutError')
      await vi.advanceTimersByTimeAsync(30_000)
      vi.useRealTimers()
      await new Promise((resolve) => setImmediate(resolve))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('a body that stalls after the headers still ends at the limit', async () => {
    vi.stubGlobal('fetch', vi.fn(bodyStalls))
    const result = track(getServerSupabase('publicRead').from('articles').select('id'))

    await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.publicRead - 1)
    expect(result.done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(result.done).toBe(true)
    expect(result.value).toMatchObject({ data: null, status: 0, error: expect.any(Object) })
  })

  it("a caller's own abort signal still ends the request early, without the time-limit line", async () => {
    vi.stubGlobal('fetch', vi.fn(ignoresSignal))
    const controller = new AbortController()
    const result = track(getServerSupabase('admin').from('articles').select('id').abortSignal(controller.signal))

    await vi.advanceTimersByTimeAsync(100)
    expect(result.done).toBe(false)
    controller.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(result.done).toBe(true)
    expect(result.value).toMatchObject({ data: null, status: 0 })
    expect((result.value as { error: { hint: string } }).error.hint).toContain('aborted')

    await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.admin)
    expect(limitLines()).toHaveLength(0)
  })

  it('passes the caller signal and its own limit to the underlying fetch', async () => {
    const seen: AbortSignal[] = []
    const inner = vi.fn<Fetch>((_input, init) => {
      seen.push(init!.signal!)
      return neverAnswers(_input, init)
    })
    const controller = new AbortController()
    const outcome = timeLimitedFetch(500, inner)('https://example.test/', { signal: controller.signal }).catch(
      (error: unknown) => error,
    )
    controller.abort(new Error('caller stopped'))
    expect(seen[0].aborted).toBe(true)
    expect(((await outcome) as Error).message).toBe('caller stopped')
  })

  it('writes one fixed line when the limit is reached', async () => {
    vi.stubGlobal('fetch', vi.fn(neverAnswers))
    const result = track(getServerSupabase('publicRead').from('secret_table').select('id').eq('slug', 'private-value'))
    await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.publicRead)
    expect(result.done).toBe(true)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]).toEqual([`${DB_TIME_LIMIT_LOG} (6000 ms)`])
    const line = String(warn.mock.calls[0][0])
    expect(line).not.toContain('secret_table')
    expect(line).not.toContain('private-value')
    expect(line).not.toContain(KEY)
    expect(line).not.toContain('example.supabase.co')
  })

  it('writes nothing when the answer is fast, even after the limit has passed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse([{ id: 1 }])))
    const result = await getServerSupabase('publicRead').from('articles').select('id')
    expect(result.data).toEqual([{ id: 1 }])
    await vi.advanceTimersByTimeAsync(DB_LIMITS_MS.ingest * 2)
    expect(warn).not.toHaveBeenCalled()
  })

  it('a fast answer that is never read is not logged', async () => {
    const guarded = timeLimitedFetch(1000, async () => jsonResponse({ a: 1 }))
    await guarded('https://example.test/')
    await vi.advanceTimersByTimeAsync(5000)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('fast answers are passed through unchanged', () => {
  type Capture = { url: string; method: string; headers: Record<string, string>; body: unknown }

  function fakeServer(captures: Capture[]): Fetch {
    return async (input, init) => {
      const headers: Record<string, string> = {}
      new Headers(init?.headers).forEach((value, name) => {
        headers[name] = value
      })
      const method = init?.method ?? 'GET'
      captures.push({ url: String(input), method, headers, body: init?.body })
      if (method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-range': '0-0/42' } })
      }
      if (String(input).includes('missing')) {
        return jsonResponse(
          { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'none' },
          { status: 406, statusText: 'Not Acceptable' },
        )
      }
      if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
        return new Response('', { status: 201, statusText: 'Created' })
      }
      return jsonResponse([{ id: 'a1', title: 'Budgeting' }], {
        statusText: 'OK',
        headers: { 'content-range': '0-0/1' },
      })
    }
  }

  const operations: [string, (client: SupabaseClient) => PromiseLike<unknown>][] = [
    ['select', (c) => c.from('articles').select('id, title').eq('status', 'published').order('title').limit(5)],
    ['select with count', (c) => c.from('articles').select('id', { count: 'exact' })],
    ['head count', (c) => c.from('articles').select('*', { count: 'exact', head: true })],
    ['single', (c) => c.from('articles').select('id').eq('slug', 'a').single()],
    ['single, missing', (c) => c.from('missing').select('id').eq('slug', 'a').single()],
    ['maybeSingle', (c) => c.from('articles').select('id').eq('slug', 'a').maybeSingle()],
    ['insert', (c) => c.from('contacts').insert({ name: 'a' })],
    ['update', (c) => c.from('jobs').update({ status: 'expired' }).eq('id', '1')],
    ['delete', (c) => c.from('saved_jobs').delete().eq('id', '1')],
    ['rpc', (c) => c.rpc('fn', { a: 1 })],
  ]

  it.each(operations)('%s gives the same result and sends the same request as a plain client', async (_name, run) => {
    vi.useRealTimers()
    const before: Capture[] = []
    const after: Capture[] = []

    vi.stubGlobal('fetch', vi.fn(fakeServer(before)))
    const plain = await run(createClient(URL_, KEY) as SupabaseClient)
    vi.stubGlobal('fetch', vi.fn(fakeServer(after)))
    const limited = await run(getServerSupabase('publicRead'))

    expect(JSON.stringify(limited)).toBe(JSON.stringify(plain))
    expect(after).toEqual(before)
    expect(warn).not.toHaveBeenCalled()
  })
})
