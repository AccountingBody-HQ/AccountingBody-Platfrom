import * as Sentry from '@sentry/nextjs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'
import { clearReportWindows, reportServerError } from './report-error'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './sentry-privacy'

// Runs the real Sentry SDK with a transport that only records what would be
// sent, so nothing leaves the process. Each case runs once without the
// filters (to show the values are really there to remove) and once with them,
// as the server and edge configs set them.

const sent: string[] = []
let filtersOn = true

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123'
const EMAIL = 'ada@example.com'
const ROUTE = `POST /api/${TEST_ADMIN_PATH}/courses/[courseId]`
const VALUES = [EMAIL, TEST_ADMIN_PATH, TOKEN, 'admin_token', 'session-value', '203.0.113.9', 'Browser', 'eq.', 'pre_context', 'context_line']

beforeAll(() => {
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  Sentry.init({
    dsn: 'https://public@o1.ingest.example.invalid/1',
    tracesSampleRate: 1,
    beforeSend: (event, hint) => (filtersOn ? filterServerEvent(event, hint) : event),
    beforeSendTransaction: (event) => (filtersOn ? filterServerTransaction(event) : event),
    beforeSendSpan: (span) => (filtersOn ? filterServerSpan(span) : span),
    transport: (options: Parameters<typeof Sentry.createTransport>[0]) =>
      Sentry.createTransport(options, async (request) => {
        sent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body))
        return { statusCode: 200 }
      }),
  })
})

beforeEach(() => {
  clearReportWindows()
})

// Fills the request, visitor, trail and route name the way a real request does.
async function duringRequest(run: () => Promise<void> | void, type: 'event' | 'transaction' = 'event') {
  sent.length = 0
  await Sentry.withIsolationScope(async (isolation) => {
    isolation.setSDKProcessingMetadata({
      normalizedRequest: {
        url: `https://accountingbody.com/api/${TEST_ADMIN_PATH}/courses/1?token=${TOKEN}`,
        method: 'POST',
        query_string: `token=${TOKEN}`,
        headers: { cookie: 'admin_token=session-value', 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Browser' },
        cookies: { admin_token: 'session-value' },
        data: `{"email":"${EMAIL}"}`,
      },
    })
    isolation.setTransactionName(ROUTE)
    isolation.setUser({ email: EMAIL, ip_address: '203.0.113.9' })
    Sentry.addBreadcrumb({ category: 'console', message: `saving for ${EMAIL}` })
    await Sentry.startSpan({ name: ROUTE, op: 'http.server', forceTransaction: true, attributes: { 'sentry.source': 'route' } }, run)
  })
  await Sentry.flush(2000)
  return sent.filter((envelope) => envelope.includes(`{"type":"${type}"}`))
}

function eventOf(envelope: string) {
  const [header, , body] = envelope.split('\n')
  return { header: JSON.parse(header), event: JSON.parse(body) }
}

function thrownWithAdminFrame(): Error {
  try {
    throw new TypeError(`could not save for ${EMAIL}`)
  } catch (error) {
    const typed = error as Error
    typed.stack = `${typed.stack}\n    at handler (/var/task/.next/server/app/api/${TEST_ADMIN_PATH}/courses/route.js:10:5)`
    return typed
  }
}

describe('a direct problem report as Sentry receives it', () => {
  it('without the filters the request and visitor details are present', async () => {
    filtersOn = false
    const [envelope] = await duringRequest(() => {
      Sentry.captureException(thrownWithAdminFrame())
    })
    filtersOn = true
    for (const value of [EMAIL, TEST_ADMIN_PATH, TOKEN, 'admin_token', 'session-value', 'pre_context']) expect(envelope).toContain(value)
  })

  it('keeps the error type, a shortened message and stack frames, and nothing from the request', async () => {
    const envelopes = await duringRequest(() => {
      Sentry.captureException(thrownWithAdminFrame())
    })
    expect(envelopes).toHaveLength(1)
    for (const value of VALUES) expect(envelopes[0]).not.toContain(value)
    const { header, event } = eventOf(envelopes[0])
    expect(event.exception.values[0].type).toBe('TypeError')
    expect(event.exception.values[0].value).toBe('could not save for [removed]')
    const frames = event.exception.values[0].stacktrace.frames
    expect(frames.length).toBeGreaterThan(1)
    expect(frames.some((frame: { filename?: string }) => frame.filename?.endsWith('/api/admin-area/courses/route.js'))).toBe(true)
    expect(frames.some((frame: { function?: string }) => frame.function === 'thrownWithAdminFrame')).toBe(true)
    expect(event.request).toEqual({ method: 'POST', url: 'https://accountingbody.com/api/admin-area/courses/1' })
    expect(event.transaction).toBe('POST /api/admin-area/courses/[courseId]')
    expect(header.trace.transaction).toBe('POST /api/admin-area/courses/[courseId]')
    for (const field of ['user', 'breadcrumbs', 'server_name', 'modules']) expect(event).not.toHaveProperty(field)
  })
})

describe('an uncaught route error as Sentry receives it', () => {
  async function failingRoute() {
    const handler = Sentry.wrapRouteHandlerWithSentry(
      async () => {
        throw thrownWithAdminFrame()
      },
      { method: 'POST', parameterizedRoute: `/api/${TEST_ADMIN_PATH}/courses/[courseId]` },
    )
    return duringRequest(async () => {
      await expect(handler()).rejects.toThrow(`could not save for ${EMAIL}`)
    })
  }

  it('without the filters the request and visitor details are present', async () => {
    filtersOn = false
    const [envelope] = await failingRoute()
    filtersOn = true
    for (const value of [EMAIL, TEST_ADMIN_PATH, TOKEN, 'admin_token', 'pre_context']) expect(envelope).toContain(value)
  })

  it('reaches Sentry as unhandled, with nothing from the request, and the route still fails the same way', async () => {
    const envelopes = await failingRoute()
    expect(envelopes).toHaveLength(1)
    for (const value of VALUES) expect(envelopes[0]).not.toContain(value)
    const { event } = eventOf(envelopes[0])
    expect(event.exception.values[0].mechanism).toEqual({ type: 'auto.function.nextjs.route_handler', handled: false })
    expect(event.transaction).toBe('POST /api/admin-area/courses/[courseId]')
    expect(event.request).toEqual({ method: 'POST', url: 'https://accountingbody.com/api/admin-area/courses/1' })
  })
})

describe('timings as Sentry receives them', () => {
  async function requestWithLookups() {
    return duringRequest(() => {
      Sentry.startSpan(
        {
          name: `GET https://project.supabase.co/rest/v1/subscribers?select=*&email=eq.${EMAIL}`,
          op: 'http.client',
          attributes: {
            'url.full': `https://project.supabase.co/rest/v1/subscribers?email=eq.${EMAIL}`,
            'http.query': `email=eq.${EMAIL}`,
            'server.address': 'project.supabase.co',
            'next.route': `/api/${TEST_ADMIN_PATH}/courses/[courseId]`,
          },
        },
        () => undefined,
      )
      Sentry.startSpan(
        { name: `select * from subscribers where email = '${EMAIL}'`, op: 'db', attributes: { 'db.system': 'postgresql', 'db.statement': `select '${EMAIL}'` } },
        () => undefined,
      )
    }, 'transaction')
  }

  it('without the filters the query values and route name are present', async () => {
    filtersOn = false
    const [envelope] = await requestWithLookups()
    filtersOn = true
    for (const value of [EMAIL, TEST_ADMIN_PATH, 'eq.']) expect(envelope).toContain(value)
  })

  it('keep paths, timings and status but no query, statement or private area name', async () => {
    const envelopes = await requestWithLookups()
    expect(envelopes).toHaveLength(1)
    for (const value of [...VALUES, 'select *']) expect(envelopes[0]).not.toContain(value)
    const { header, event } = eventOf(envelopes[0])
    expect(event.transaction).toBe('POST /api/admin-area/courses/[courseId]')
    expect(header.trace.transaction).toBe('POST /api/admin-area/courses/[courseId]')
    const lookup = event.spans.find((span: { op?: string }) => span.op === 'http.client')
    expect(lookup.description).toBe('GET https://project.supabase.co/rest/v1/subscribers')
    expect(lookup.data['url.full']).toBe('https://project.supabase.co/rest/v1/subscribers')
    expect(lookup.data['next.route']).toBe('/api/admin-area/courses/[courseId]')
    expect(typeof lookup.start_timestamp).toBe('number')
    expect(typeof lookup.timestamp).toBe('number')
    const database = event.spans.find((span: { op?: string }) => span.op === 'db')
    expect(database).not.toHaveProperty('description')
    for (const field of ['user', 'breadcrumbs', 'server_name']) expect(event).not.toHaveProperty(field)
  })
})

describe('reports from the shared helper', () => {
  async function helperReport() {
    clearReportWindows()
    const error = Object.assign(new Error(`duplicate key for ${EMAIL} id 1234567`), { name: 'PostgrestError', code: '23505' })
    const [envelope] = await duringRequest(() => {
      reportServerError('admin course save failed', error, { area: 'admin' })
    })
    const { header, event } = eventOf(envelope)
    // Ids and times differ between runs; everything else is compared.
    const rest = { ...event, event_id: 'id', timestamp: 0, contexts: Object.keys(event.contexts).sort() }
    const headerRest = { ...header, event_id: 'id', sent_at: 'time', trace: Object.keys(header.trace).sort() }
    return { rest, headerRest }
  }

  it('look the same with and without the filters', async () => {
    filtersOn = false
    const without = await helperReport()
    filtersOn = true
    const withFilters = await helperReport()
    expect(withFilters).toEqual(without)
    expect(withFilters.rest.extra).toEqual({ error_code: '23505', held_back: 0 })
  })
})
