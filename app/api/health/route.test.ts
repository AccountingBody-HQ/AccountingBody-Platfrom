import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The health route reads with a real supabase-js client from the factory;
// only the network is fake. The reporting helper is replaced by a recorder.

const state = vi.hoisted(() => ({ reports: [] as unknown[][] }))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import { GET } from './route'

const DB_URL = 'https://example.supabase.co'
const DETAIL = 'relation detail 9c41 at host'
const db = { failing: false }
let errors: unknown[][] = []

const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const status = db.failing ? 500 : 200
  const body = db.failing ? { message: DETAIL, code: 'XX000', details: DETAIL, hint: null } : [{ id: 'a' }]
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  errors = []
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args)
  })
  state.reports.length = 0
  db.failing = false
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('health', () => {
  it('answers 200 ok when the database answers', async () => {
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"status":"ok"}')
    expect(state.reports).toStrictEqual([])
    expect(errors).toStrictEqual([])
  })

  it('keeps the health answer free of internal details when the database check fails', async () => {
    db.failing = true
    const response = await GET()
    expect(response.status).toBe(503)
    const text = await response.text()
    expect(text).toBe('{"status":"error"}')
    expect(text).not.toContain('9c41')
  })

  it('logs only the error code when the database check fails', async () => {
    db.failing = true
    await GET()
    expect(errors).toStrictEqual([['health: database check failed', 'XX000']])
  })

  it('reports a failed database check once with its own label', async () => {
    db.failing = true
    await GET()
    expect(state.reports).toHaveLength(1)
    const [label, error, extra] = state.reports[0]
    expect(label).toBe('health check database error')
    expect((error as { code?: string }).code).toBe('XX000')
    expect(extra).toStrictEqual({ area: 'public' })
  })

  it('answers 503 and reports when the check cannot run', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const response = await GET()
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('{"status":"error"}')
    expect(state.reports.map((args) => args[0])).toStrictEqual(['health check failed'])
  })
})
