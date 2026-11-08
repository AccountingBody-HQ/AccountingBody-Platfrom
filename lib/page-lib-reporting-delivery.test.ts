import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearReportWindows } from './report-error'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './sentry-privacy'

// Runs the real Sentry SDK, with the server filters as the server config sets
// them, and a transport that only records what would be sent, so nothing
// leaves the process. Shared code and routes run with distinctive values in
// the request, the arguments and the stored rows; the recorded reports must
// carry none of them.

const sent: string[] = []

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

import { resetCacheGuard } from './cache-guard'
import { getBrowsableJobsCount, getSimilarJobs } from './jobs'
import { touchLastSeen } from './saved-jobs-store'
import { GET as manageGet } from '@/app/api/jobs/manage/route'
import { POST as ingest } from '@/app/api/ingest/[slug]/route'

const SITE = 'https://accountingbody.com'
const DB_URL = 'https://example.supabase.co'
const CRON_TEST_VALUE = 'cron-test-value'
const SLUG = 'seed-provider-q8'
const TITLE = 'Seedtitlezq Payroll Accountant'
const TOKEN = 'seedtokenabcdefghijklmnopqrstuv0123'
const EMAIL = 'seed-person@example.com'
const VISITOR = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SEEDS = [SLUG, 'Seedtitlezq', TOKEN, EMAIL, VISITOR, 'seed-']

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

// Every database request fails; the failure names nothing but itself.
const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  return new Response(JSON.stringify({ message: 'database detail', code: 'XX000', details: null, hint: null }), {
    status: 500,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  sent.length = 0
  clearReportWindows()
  resetCacheGuard()
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', CRON_TEST_VALUE)
  vi.stubEnv('SIMILAR_JOBS_ENABLED', 'true')
  for (const level of ['error', 'warn', 'log'] as const) vi.spyOn(console, level).mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Runs the work the way a real request does: the request on the scope, a
// console trail and a span.
async function during(url: string, run: () => Promise<unknown>) {
  await Sentry.withIsolationScope(async (isolation) => {
    isolation.setSDKProcessingMetadata({
      normalizedRequest: { url, method: 'GET', query_string: new URL(url).search.slice(1), headers: { cookie: `ab_vid=${VISITOR}`, 'x-forwarded-for': '203.0.113.9' } },
    })
    isolation.setTransactionName(new URL(url).pathname)
    Sentry.addBreadcrumb({ category: 'console', message: `${SLUG} ${TITLE} ${TOKEN} ${EMAIL}` })
    await Sentry.startSpan({ name: 'request', forceTransaction: true }, run)
  })
  await Sentry.flush(2000)
  return sent.filter((envelope) => envelope.includes('{"type":"event"}')).map((envelope) => ({ text: envelope, event: JSON.parse(envelope.split('\n')[2]) }))
}

function expectReport(events: { text: string; event: Record<string, unknown> }[], label: string, area: string) {
  const matching = events.filter(({ event }) => (event.tags as Record<string, string>)?.label === label)
  expect(matching).toHaveLength(1)
  const { text, event } = matching[0]
  expect(event.tags).toStrictEqual({ label, area })
  expect(event.fingerprint).toStrictEqual([label])
  for (const field of ['request', 'user', 'breadcrumbs', 'transaction', 'server_name']) expect(event).not.toHaveProperty(field)
  for (const value of SEEDS) expect(text).not.toContain(value)
  return event
}

const value = (event: Record<string, unknown>) => (event.exception as { values: { value: string }[] }).values[0].value

describe('page and shared code problem reports as Sentry receives them', () => {
  it('reports a page count that cannot be read', async () => {
    const events = await during(`${SITE}/jobs?ref=${TOKEN}`, () => getBrowsableJobsCount('ab'))
    expectReport(events, 'job count read failed', 'public')
    expect(events).toHaveLength(1)
  })

  it('reports similar jobs without the job title', async () => {
    const events = await during(`${SITE}/jobs/${SLUG}`, () => getSimilarJobs({ excludeId: VISITOR, platform: 'ab', title: TITLE, locationCountry: 'United Kingdom' }))
    const event = expectReport(events, 'similar jobs country fallback read failed', 'public')
    expect(value(event)).toBe('similar jobs query failed')
  })

  it('reports a saved jobs save without the visitor', async () => {
    const events = await during(`${SITE}/api/saved-jobs`, () => touchLastSeen(VISITOR, 'ab', 3_600_000))
    const event = expectReport(events, 'saved jobs last seen save failed', 'public')
    expect(value(event)).toBe('saved jobs last seen save failed')
    expect(events).toHaveLength(1)
  })

  it('reports a manage link that cannot be read without the link', async () => {
    const url = `${SITE}/api/jobs/manage?token=${TOKEN}`
    const events = await during(url, () => manageGet(new NextRequest(url)))
    expectReport(events, 'job manage link failed', 'public')
    expect(events).toHaveLength(1)
  })

  it('reports a provider that cannot be read without the provider name', async () => {
    const url = `${SITE}/api/ingest/${SLUG}`
    const events = await during(url, () =>
      ingest(new NextRequest(url, { method: 'POST', headers: { authorization: `Bearer ${CRON_TEST_VALUE}` } }), { params: { slug: SLUG } }),
    )
    expectReport(events, 'job import provider read failed', 'ingest')
    expect(events).toHaveLength(1)
  })
})
