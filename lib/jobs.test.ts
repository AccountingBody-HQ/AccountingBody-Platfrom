import { describe, it, expect, vi, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getJobSitemapEntries, getJobSitemapChunk, getSimilarJobs, buildSimilarQuery, type Job } from './jobs'

const PAGE_SIZE = 1000

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// react's stable channel (what plain vitest resolves 'react' to, outside
// Next's own build pipeline) doesn't export cache() at all — only Next's
// bundled/canary React does. lib/jobs.ts:1 imports { cache } from 'react'
// for an unrelated export (getCachedBrowsableJobsCount) that this test
// doesn't touch, but the module-level import still runs on load and
// throws without this. Identity function is correct for a test: cache()
// only memoizes, it doesn't change behavior.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))

function makeJobs(n: number, startIndex = 0) {
  // expires_at: null keeps getJobLifecycleState at 'active' for every row,
  // so the archived-filter inside getJobSitemapEntries never drops any of
  // these — the counts below are exact, not "at most."
  return Array.from({ length: n }, (_, i) => ({
    slug: `job-${startIndex + i}`,
    expires_at: null,
    published_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
  }))
}

// Minimal fake query builder: .from/.select/.in/.contains all return the
// same object so the chain keeps going; .range() is the only call that
// resolves, returning the next scripted page each time it's invoked —
// mirroring how getJobSitemapEntries calls .range() once per loop
// iteration on the same client returned by a single getSupabase() call.
function fakeSupabaseClient(pages: Array<{ data: unknown[] | null; error: unknown }>) {
  const rangeCalls: Array<[number, number]> = []
  let call = 0
  const builder = {
    from: () => builder,
    select: () => builder,
    in: () => builder,
    contains: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      rangeCalls.push([from, to])
      const page = pages[call] ?? { data: [], error: null }
      call += 1
      return Promise.resolve(page)
    },
  }
  return { client: builder, rangeCalls }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('getJobSitemapEntries — internal pagination', () => {
  it('concatenates a full page followed by a partial page, and stops after the partial one', async () => {
    const { client, rangeCalls } = fakeSupabaseClient([
      { data: makeJobs(PAGE_SIZE, 0), error: null },
      { data: makeJobs(300, PAGE_SIZE), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapEntries('ab')

    expect(result).toHaveLength(PAGE_SIZE + 300)
    expect(rangeCalls).toHaveLength(2)
    expect(rangeCalls[0]).toEqual([0, PAGE_SIZE - 1])
    expect(rangeCalls[1]).toEqual([PAGE_SIZE, PAGE_SIZE * 2 - 1])
  })

  it('does not fetch a second page when the first page is already short', async () => {
    const { client, rangeCalls } = fakeSupabaseClient([
      { data: makeJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapEntries('ab')

    expect(result).toHaveLength(5)
    expect(rangeCalls).toHaveLength(1)
  })

  it('returns [] rather than a partial list when a later page errors', async () => {
    const { client } = fakeSupabaseClient([
      { data: makeJobs(PAGE_SIZE, 0), error: null },
      { data: null, error: new Error('connection refused') },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapEntries('ab')

    expect(result).toEqual([])
  })
})

function makeChunkJobs(n: number, startIndex = 0) {
  // Same expires_at: null convention as makeJobs — keeps every row 'active'
  // so the archived-filter never drops any of these test rows.
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${String(startIndex + i).padStart(6, '0')}`,
    slug: `job-${startIndex + i}`,
    expires_at: null,
    published_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
  }))
}

// Minimal fake query builder for getJobSitemapChunk's keyset shape:
// .gte/.lt/.gt are recorded (not just passed through) so a test can assert
// exactly which bound each page's query carried; .limit() is the call that
// resolves, returning the next scripted page — mirroring how
// getJobSitemapChunk calls .limit() once per loop iteration.
function fakeChunkSupabaseClient(pages: Array<{ data: unknown[] | null; error: unknown }>) {
  const gteCalls: string[] = []
  const ltCalls: string[] = []
  const gtCalls: string[] = []
  let call = 0
  const builder = {
    from: () => builder,
    select: () => builder,
    in: () => builder,
    contains: () => builder,
    gte: (_col: string, val: string) => {
      gteCalls.push(val)
      return builder
    },
    lt: (_col: string, val: string) => {
      ltCalls.push(val)
      return builder
    },
    gt: (_col: string, val: string) => {
      gtCalls.push(val)
      return builder
    },
    order: () => builder,
    limit: () => {
      const page = pages[call] ?? { data: [], error: null }
      call += 1
      return Promise.resolve(page)
    },
  }
  return { client: builder, gteCalls, ltCalls, gtCalls }
}

describe('getJobSitemapChunk — keyset pagination', () => {
  it('continues to a second page using gt(lastId) from the first page', async () => {
    const { client, gtCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(1000, 0), error: null },
      { data: makeChunkJobs(300, 1000), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapChunk('ab', 0)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries).toHaveLength(1300)
    expect(gtCalls).toEqual(['id-000999'])
  })

  it('stops after a short page without an extra call', async () => {
    const { client, gtCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapChunk('ab', 0)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entries).toHaveLength(5)
    expect(gtCalls).toHaveLength(0)
  })

  it('the last bucket (63) never calls .lt() — it has no upper bound', async () => {
    const { client, ltCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getJobSitemapChunk('ab', 63)

    expect(ltCalls).toHaveLength(0)
  })

  it('a non-last bucket calls .lt() with its upper bound', async () => {
    const { client, ltCalls } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(5, 0), error: null },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getJobSitemapChunk('ab', 0)

    expect(ltCalls).toHaveLength(1)
  })

  it('returns ok:false rather than a partial chunk when a later page errors', async () => {
    const { client } = fakeChunkSupabaseClient([
      { data: makeChunkJobs(1000, 0), error: null },
      { data: null, error: new Error('connection refused') },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getJobSitemapChunk('ab', 0)

    expect(result).toEqual({ ok: false })
  })
})

describe('buildSimilarQuery', () => {
  it('turns a multi-word title into an OR-joined tsquery string', () => {
    expect(buildSimilarQuery('Senior Practice Accountant'))
      .toBe('senior OR practice OR accountant')
  })

  it('strips websearch_to_tsquery operator characters (&, quotes) before joining', () => {
    expect(buildSimilarQuery('Senior Accountant ("Practice & Audit")'))
      .toBe('senior OR accountant OR practice OR audit')
  })

  it('returns null when every token is job-board noise', () => {
    expect(buildSimilarQuery('Remote Full Time UK Job')).toBeNull()
  })

  it('produces a single term with no OR for a single-word title', () => {
    expect(buildSimilarQuery('Bookkeeper')).toBe('bookkeeper')
  })
})

// Minimal fake client covering both call shapes getSimilarJobs uses:
// .rpc() for the two ranked phases (queued responses, consumed in call
// order) and the plain .from() chain for the phase C fallback (a single
// scripted response, since no test here needs more than one fallback call).
function fakeSimilarJobsClient(
  rpcQueue: Array<{ data: unknown[] | null; error: unknown }>,
  fallbackData: unknown[] = []
) {
  const rpcCalls: unknown[] = []
  const rpc = vi.fn((_name: string, params: unknown) => {
    rpcCalls.push(params)
    const next = rpcQueue.shift() ?? { data: [], error: null }
    return Promise.resolve(next)
  })
  const builder = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    contains: () => builder,
    or: () => builder,
    neq: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: fallbackData, error: null }),
  }
  return { client: { rpc, from: builder.from }, rpcCalls }
}

function row(id: string): Job {
  return { id } as unknown as Job
}

describe('getSimilarJobs', () => {
  it('excludes excludeId when the ranked RPC returns the current job first', async () => {
    const { client } = fakeSimilarJobsClient([
      {
        data: [row('self'), row('a'), row('b'), row('c'), row('d'), row('e'), row('f')],
        error: null,
      },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getSimilarJobs({
      excludeId: 'self',
      platform: 'ab',
      title: 'Senior Practice Accountant',
      locationCountry: 'United Kingdom',
    })

    expect(result.map(j => j.id)).not.toContain('self')
    expect(result).toHaveLength(6)
    expect(result.map(j => j.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('never returns more than limit rows, even if the RPC returns more', async () => {
    const { client } = fakeSimilarJobsClient([
      {
        data: Array.from({ length: 10 }, (_, i) => row(`job-${i}`)),
        error: null,
      },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getSimilarJobs({
      excludeId: 'self',
      platform: 'ab',
      title: 'Senior Practice Accountant',
      locationCountry: 'United Kingdom',
      limit: 6,
    })

    expect(result).toHaveLength(6)
  })

  it('returns [] rather than throwing when the ranked RPC errors', async () => {
    const { client } = fakeSimilarJobsClient([
      { data: null, error: new Error('connection refused') },
    ])
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getSimilarJobs({
      excludeId: 'self',
      platform: 'ab',
      title: 'Senior Practice Accountant',
      locationCountry: null,
    })

    expect(result).toEqual([])
  })
})
