import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearReportWindows } from './report-error'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './sentry-privacy'

// Runs the real Sentry SDK, with the server filters as the server config sets
// them, and a transport that only records what would be sent, so nothing
// leaves the process. The routes run as for a real request, with distinctive
// values in the request, the provider list, the sub-route answers and the
// search words; the recorded reports must carry none of them.

const sent: string[] = []
const seen = vi.hoisted(() => ({ due: [] as unknown[] }))

vi.mock('@/lib/providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers')>()),
  reapStaleRuns: async () => 0,
  getProvidersDueForFetch: async () => seen.due,
}))
vi.mock('@/lib/jobs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jobs')>()),
  getActiveDirectJobs: () => new Promise(() => {}),
}))
vi.mock('@/lib/saved-jobs-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/saved-jobs-store')>()),
  pruneInactive: async () => {
    throw new Error('prune stopped')
  },
  listSaved: async () => {
    throw new Error('list stopped')
  },
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

import { GET as pruneSavedJobs } from '@/app/api/cron/prune-saved-jobs/route'
import { GET as orchestrator } from '@/app/api/ingest/orchestrator/route'
import { GET as savedGet } from '@/app/api/saved-jobs/route'
import { GET as search } from '@/app/api/search/route'
import { POST as subscribe } from '@/app/api/subscribe/route'

const SITE = 'https://accountingbody.com'
const DB_URL = 'https://example.supabase.co'
const CRON_TEST_VALUE = 'cron-test-value'
const PROVIDER = 'seed-provider-x1'
const SUB_ROUTE_ERROR = 'seed-sub-error-4k'
const SEARCH = 'seed-search-7f3q'
const EMAIL = 'seed-person@example.com'
const TOKEN = 'seedtokenabcdefghijklmnopqrstuv0123'
const VISITOR = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SEEDS = [PROVIDER, SUB_ROUTE_ERROR, SEARCH, EMAIL, TOKEN, VISITOR, 'seed-']

beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@o1.ingest.example.invalid/1',
    tracesSampleRate: 1,
    beforeSend: filterServerEvent,
    beforeSendTransaction: filterServerTransaction,
    beforeSendSpan: filterServerSpan,
    tracePropagationTargets: [],
    transport: (options: Parameters<typeof Sentry.createTransport>[0]) =>
      Sentry.createTransport(options, async (request) => {
        sent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body))
        return { statusCode: 200 }
      }),
  })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === 'https://challenges.cloudflare.com') return json({ success: false })
  if (url.origin === SITE && url.pathname.startsWith('/api/ingest/')) return json({ ok: false, error: SUB_ROUTE_ERROR }, 500)
  if (url.origin === DB_URL) return json([])
  throw new Error(`unexpected request to ${url.href}`)
}

beforeEach(() => {
  sent.length = 0
  clearReportWindows()
  seen.due = [{ id: 'provider-1', slug: PROVIDER, name: PROVIDER }]
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-key')
  vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  for (const level of ['error', 'warn', 'log'] as const) vi.spyOn(console, level).mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Runs the handler the way a real request does: the request on the scope,
// a console trail and a route span.
async function during(route: string, url: string, run: () => Promise<Response>) {
  await Sentry.withIsolationScope(async (isolation) => {
    isolation.setSDKProcessingMetadata({
      normalizedRequest: { url, method: 'GET', query_string: new URL(url).search.slice(1), headers: { cookie: `ab_vid=${VISITOR}`, 'x-forwarded-for': '203.0.113.9' } },
    })
    isolation.setTransactionName(route)
    Sentry.addBreadcrumb({ category: 'console', message: `${SEARCH} ${EMAIL} ${PROVIDER} ${SUB_ROUTE_ERROR}` })
    await Sentry.startSpan({ name: route, forceTransaction: true }, run)
  })
  await Sentry.flush(2000)
  return sent.filter((envelope) => envelope.includes('{"type":"event"}')).map((envelope) => ({ text: envelope, event: JSON.parse(envelope.split('\n')[2]) }))
}

function expectReport(events: { text: string; event: Record<string, unknown> }[], label: string, area: string, extra: Record<string, unknown>) {
  const matching = events.filter(({ event }) => (event.tags as Record<string, string>)?.label === label)
  expect(matching).toHaveLength(1)
  const { text, event } = matching[0]
  expect(event.tags).toStrictEqual({ label, area })
  expect(event.fingerprint).toStrictEqual([label])
  expect(event.extra).toStrictEqual({ held_back: 0, ...extra })
  for (const field of ['request', 'user', 'breadcrumbs', 'transaction', 'server_name']) expect(event).not.toHaveProperty(field)
  for (const value of SEEDS) expect(text).not.toContain(value)
  return event
}

const cron = (path: string) => new NextRequest(SITE + path, { headers: { authorization: `Bearer ${CRON_TEST_VALUE}` } })

describe('job route problem reports as Sentry receives them', () => {
  it('reports every dispatched import failing without provider names or error text', async () => {
    const events = await during('GET /api/ingest/orchestrator', `${SITE}/api/ingest/orchestrator`, () => orchestrator(cron('/api/ingest/orchestrator')))
    const event = expectReport(events, 'job import dispatch failed', 'ingest', {})
    expect((event.exception as { values: unknown[] }).values).toStrictEqual([
      { type: 'Error', value: 'every dispatched import failed', mechanism: { type: 'generic', handled: true } },
    ])
    expect(events).toHaveLength(1)
  })

  it('keeps search words out of problem reports', async () => {
    const url = `${SITE}/api/search?q=${SEARCH}`
    const events = await during('GET /api/search', url, () => search(new NextRequest(url, { headers: { 'x-forwarded-for': '203.0.113.9' } })))
    const event = expectReport(events, 'search job lookup timed out', 'public', { code: 'ab' })
    expect((event.exception as { values: { value: string }[] }).values[0].value).toBe('job lookup took too long')
    expect(events).toHaveLength(1)
  }, 10_000)

  it('reports a refused person check with its reason only', async () => {
    const url = `${SITE}/api/subscribe`
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, 'cf-turnstile-response': TOKEN }),
      headers: { 'content-type': 'application/json' },
    })
    const events = await during('POST /api/subscribe', url, () => subscribe(request))
    expectReport(events, 'subscribe person check refused', 'public', { code: 'invalid_token' })
    expect(events).toHaveLength(1)
  })

  it('reports a scheduled clean-up problem with its route label', async () => {
    const events = await during('GET /api/cron/prune-saved-jobs', `${SITE}/api/cron/prune-saved-jobs`, () => pruneSavedJobs(cron('/api/cron/prune-saved-jobs')))
    const event = expectReport(events, 'saved jobs cleanup failed', 'cron', {})
    expect((event.exception as { values: { value: string }[] }).values[0].value).toBe('prune stopped')
  })

  it('reports a saved jobs problem without the visitor', async () => {
    const url = `${SITE}/api/saved-jobs`
    const events = await during('GET /api/saved-jobs', url, () => savedGet(new NextRequest(url, { headers: { cookie: `ab_vid=${VISITOR}` } })))
    expectReport(events, 'saved jobs load failed', 'public', {})
  })
})
