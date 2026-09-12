import { describe, it, expect, vi, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getJobSitemapEntries } from './jobs'

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
