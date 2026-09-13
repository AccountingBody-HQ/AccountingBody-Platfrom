import { describe, it, expect, vi, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { getPublishedArticleCount, getQuestionSetCount } from './db'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

// Same workaround as lib/jobs.test.ts: plain vitest resolves 'react' to a
// build that doesn't export cache() at all (only Next's bundled/canary
// React does), and this module now imports { cache } from 'react' at the
// top level for getCachedPublishedArticleCount/getCachedQuestionSetCount —
// the import runs on load regardless of which export a given test touches.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))

// Minimal fake query builder: every chained call before the final one
// returns the same object so the chain keeps going, and records what it
// was called with; the final call in each real query below (`.contains`)
// resolves the whole chain, mirroring how the real Supabase client's
// query builder is itself a thenable.
function fakeCountClient(result: { count: number | null; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = []
  const builder = {
    from:     (...args: unknown[]) => { calls.push({ method: 'from', args }); return builder },
    select:   (...args: unknown[]) => { calls.push({ method: 'select', args }); return builder },
    eq:       (...args: unknown[]) => { calls.push({ method: 'eq', args }); return builder },
    contains: (...args: unknown[]) => { calls.push({ method: 'contains', args }); return Promise.resolve(result) },
  }
  return { client: builder, calls }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('getPublishedArticleCount', () => {
  it('returns the real count for the requested host', async () => {
    const { client } = fakeCountClient({ count: 2017, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedArticleCount('ab')).toBe(2017)
  })

  it('filters by the given site code, not a fixed one', async () => {
    const { client, calls } = fakeCountClient({ count: 0, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    await getPublishedArticleCount('et')

    const containsCall = calls.find(c => c.method === 'contains')
    expect(containsCall?.args).toEqual(['show_on_sites', ['et']])
  })

  it('returns 0 on a query error rather than throwing', async () => {
    const { client } = fakeCountClient({ count: null, error: new Error('connection refused') })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedArticleCount('ab')).toBe(0)
  })

  it('returns 0 rather than null when the query succeeds with no count', async () => {
    const { client } = fakeCountClient({ count: null, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    expect(await getPublishedArticleCount('ab')).toBe(0)
  })
})

describe('getQuestionSetCount', () => {
  it('always filters show_on_sites for "ab", regardless of host — practice-questions itself has no per-host split yet', async () => {
    const { client, calls } = fakeCountClient({ count: 181, error: null })
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)

    const result = await getQuestionSetCount()

    expect(result).toBe(181)
    const containsCall = calls.find(c => c.method === 'contains')
    expect(containsCall?.args).toEqual(['show_on_sites', ['ab']])
  })
})
