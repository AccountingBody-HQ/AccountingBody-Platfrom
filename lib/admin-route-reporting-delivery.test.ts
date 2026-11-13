import * as Sentry from '@sentry/nextjs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearReportWindows } from './report-error'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './sentry-privacy'
import { ADMIN_SESSION_COOKIE, getAdminPath } from './middleware-logic'
import { TEST_ADMIN_PATH, TEST_ADMIN_SECRET, TEST_SESSION_SECRET, signTestSession } from './admin-session-fixtures'

// Runs the real Sentry SDK, with the server filters as the server config sets
// them, and a transport that only records what would be sent, so nothing
// leaves the process. Admin routes run as for a real request, with
// distinctive values in the request, the body, the prompt and the problem;
// the recorded reports must carry none of them.

const sent: string[] = []

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const original = await importOriginal<typeof import('@anthropic-ai/sdk')>()
  return {
    ...original,
    default: class {
      messages = {
        create: async () => {
          throw original.APIError.generate(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }, undefined, new Headers())
        },
      }
    },
  }
})
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))
// Run now starts the import in the same process; here it stops with a
// network problem.
vi.mock('@/lib/ingestion/run-provider-import', () => ({
  runProviderImport: async () => {
    throw new TypeError('fetch failed')
  },
}))

// The folder comes from the app's own default, so its name is not repeated here.
vi.stubEnv('ADMIN_PATH', undefined)
const folder = getAdminPath()
vi.unstubAllEnvs()

const load = (suffix: string) => import(/* @vite-ignore */ join(process.cwd(), 'app', 'api', `${folder}${suffix}`, 'route.ts'))

const SITE = 'https://accountingbody.com'
const DB_URL = 'https://example.supabase.co'
const TITLE = 'Seed article title on lease accounting'
const PROMPT = 'seed prompt text about deferred tax'
const CONTENT_ID = '3f2b8c1e-5d4a-4e6b-9c7d-8a1b2c3d4e5f'
const TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
const PASSWORD = 'seed-password-value-k2'
let session = ''

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

const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin === SITE && url.pathname.startsWith('/api/ingest/')) throw new TypeError('fetch failed')
  if (url.origin === DB_URL) return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  throw new Error(`unexpected request to ${url.href}`)
}

beforeEach(async () => {
  sent.length = 0
  clearReportWindows()
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  vi.stubEnv('CRON_SECRET', 'cron-test-value')
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE)
  vi.stubEnv('ADMIN_SECRET', TEST_ADMIN_SECRET)
  vi.stubEnv('ADMIN_SESSION_SECRET', TEST_SESSION_SECRET)
  vi.stubEnv('ADMIN_TOTP_SECRET', TOTP_SECRET)
  for (const level of ['error', 'warn', 'log'] as const) vi.spyOn(console, level).mockImplementation(() => {})
  session = await signTestSession()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const seeds = () => [TITLE, PROMPT, CONTENT_ID, PASSWORD, session, TEST_ADMIN_PATH, ADMIN_SESSION_COOKIE, 'seed']

function adminRequest(path: string, body: unknown, signedIn = true): NextRequest {
  return new NextRequest(`${SITE}/api/${TEST_ADMIN_PATH}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(signedIn ? { cookie: `${ADMIN_SESSION_COOKIE}=${session}` } : {}) },
  })
}

// Runs the handler the way a real request does: the request on the scope,
// a console trail and a route span.
async function during(path: string, run: () => Promise<Response>) {
  const url = `${SITE}/api/${TEST_ADMIN_PATH}${path}?id=${CONTENT_ID}`
  await Sentry.withIsolationScope(async (isolation) => {
    isolation.setSDKProcessingMetadata({
      normalizedRequest: { url, method: 'POST', query_string: `id=${CONTENT_ID}`, headers: { cookie: `${ADMIN_SESSION_COOKIE}=${session}`, 'x-forwarded-for': '203.0.113.9' } },
    })
    isolation.setTransactionName(`POST /api/${TEST_ADMIN_PATH}${path}`)
    Sentry.addBreadcrumb({ category: 'console', message: `${TITLE} ${PROMPT} ${CONTENT_ID}` })
    await Sentry.startSpan({ name: `POST /api/${TEST_ADMIN_PATH}${path}`, forceTransaction: true }, run)
  })
  await Sentry.flush(2000)
  return sent.filter((envelope) => envelope.includes('{"type":"event"}')).map((envelope) => ({ text: envelope, event: JSON.parse(envelope.split('\n')[2]) }))
}

function expectReport(events: { text: string; event: Record<string, unknown> }[], label: string) {
  expect(events).toHaveLength(1)
  const { text, event } = events[0]
  expect(event.tags).toStrictEqual({ label, area: 'admin' })
  expect(event.fingerprint).toStrictEqual([label])
  expect(event.extra).toStrictEqual({ held_back: 0 })
  for (const field of ['request', 'user', 'breadcrumbs', 'transaction', 'server_name']) expect(event).not.toHaveProperty(field)
  for (const value of seeds()) expect(text).not.toContain(value)
  return event as { exception: { values: { type: string; value: string }[] } }
}

describe('admin problem reports as Sentry receives them', () => {
  it('reports an AI failure without the prompt, the title or the request', async () => {
    const { POST } = await load('/content-factory/generate')
    const events = await during('/content-factory/generate', () =>
      POST(adminRequest('/content-factory/generate', { contentType: 'article', qualification: 'ACCA', topic: PROMPT, title: TITLE, contentId: CONTENT_ID })),
    )
    const event = expectReport(events, 'admin AI content generate failed')
    expect(event.exception.values[0].value).toBe('529 {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}')
  })

  it('reports an unreadable admin body without the content or the folder', async () => {
    const { POST } = await load('/articles/publish')
    const req = adminRequest('/articles/publish', { article: { title: TITLE, id: CONTENT_ID } })
    Object.defineProperty(req, 'json', {
      value: async () => {
        throw new SyntaxError(`could not read ${CONTENT_ID} at /api/${TEST_ADMIN_PATH}/articles`)
      },
    })
    const event = expectReport(await during('/articles/publish', () => POST(req)), 'admin article publish failed')
    expect(event.exception.values[0].value).toBe('could not read [removed] at /api/[removed]/articles')
  })

  it('reports an unexpected sign-in problem without the password or the session', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockRejectedValue(new Error('key import stopped'))
    const { POST } = await load('-auth')
    const events = await during('/sign-in', () => POST(adminRequest('/sign-in', { password: PASSWORD, totpCode: '123456' })))
    const event = expectReport(events, 'admin sign-in failed')
    expect(event.exception.values[0].value).toBe('key import stopped')
  })

  it('makes no report for a signed-out admin request', async () => {
    const { POST } = await load('/content-factory/generate')
    const events = await during('/content-factory/generate', () => POST(adminRequest('/content-factory/generate', { topic: PROMPT }, false)))
    expect(events).toStrictEqual([])
  })

  it('keeps the admin folder out of reports with the app default', async () => {
    vi.stubEnv('ADMIN_PATH', undefined)
    const { POST } = await load('/providers/[slug]/trigger')
    const events = await during('/providers/example/trigger', () =>
      POST(adminRequest('/providers/example/trigger', {}), { params: Promise.resolve({ slug: 'example' }) }),
    )
    const event = expectReport(events, 'admin provider run start failed')
    expect(event.exception.values[0]).toMatchObject({ type: 'TypeError', value: 'fetch failed' })
    expect(events[0].text.toLowerCase()).not.toContain(folder.toLowerCase())
  })
})
