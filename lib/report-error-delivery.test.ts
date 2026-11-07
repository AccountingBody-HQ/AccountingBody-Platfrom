import * as Sentry from '@sentry/nextjs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'
import { clearReportWindows, reportServerError } from './report-error'

// Runs the real Sentry SDK with a transport that only records what would be
// sent, so nothing leaves the process. The request, visitor, trail and route
// name are filled in the way a real request would fill them, then the
// recorded report is checked field by field.

const sent: string[] = []

beforeAll(() => {
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  Sentry.init({
    dsn: 'https://public@o1.ingest.example.invalid/1',
    tracesSampleRate: 1,
    transport: (options: Parameters<typeof Sentry.createTransport>[0]) =>
      Sentry.createTransport(options, async (request) => {
        sent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body))
        return { statusCode: 200 }
      }),
  })
})

const ROUTE = `POST /api/${TEST_ADMIN_PATH}/courses/[courseId]`

async function reportDuringRequest(label: string, error: unknown) {
  sent.length = 0
  await Sentry.withIsolationScope(async (isolation) => {
    isolation.setSDKProcessingMetadata({
      normalizedRequest: {
        url: `https://accountingbody.com/api/${TEST_ADMIN_PATH}/courses/1?token=abcdefghijklmnopqrstuvwxyz0123`,
        method: 'POST',
        query_string: 'token=abcdefghijklmnopqrstuvwxyz0123',
        headers: { cookie: 'admin_token=session-value', 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Browser' },
        data: '{"email":"ada@example.com"}',
      },
    })
    isolation.setTransactionName(ROUTE)
    isolation.setUser({ email: 'ada@example.com', ip_address: '203.0.113.9' })
    Sentry.addBreadcrumb({ category: 'console', message: 'saving for ada@example.com' })
    await Sentry.startSpan({ name: ROUTE, forceTransaction: true }, async () => {
      // A trace started by the browser arrives with the page's route name.
      const scope = Sentry.getCurrentScope()
      scope.setPropagationContext({
        ...scope.getPropagationContext(),
        dsc: { trace_id: scope.getPropagationContext().traceId, public_key: 'public', transaction: ROUTE },
      })
      reportServerError(label, error, { area: 'admin' })
    })
  })
  await Sentry.flush(2000)
  return sent.filter((envelope) => envelope.includes('{"type":"event"}'))
}

describe('a problem report as Sentry receives it', () => {
  it('contains the label, area, error name, code and short message only', async () => {
    clearReportWindows()
    const error = Object.assign(new Error(`duplicate key for ada@example.com id 1234567 in /api/${TEST_ADMIN_PATH}/x`), {
      name: 'PostgrestError',
      code: '23505',
      details: 'Key (email)=(ada@example.com) already exists.',
    })
    const envelopes = await reportDuringRequest('admin course save failed', error)
    expect(envelopes).toHaveLength(1)
    const [header, , body] = envelopes[0].split('\n')
    const event = JSON.parse(body)

    expect(event.exception.values).toEqual([
      { type: 'PostgrestError', value: 'duplicate key for [removed] id [removed] in /api/[removed]/x', mechanism: { type: 'generic', handled: true } },
    ])
    expect(event.fingerprint).toEqual(['admin course save failed'])
    expect(event.tags).toEqual({ label: 'admin course save failed', area: 'admin' })
    expect(event.extra).toEqual({ error_code: '23505', held_back: 0 })
    expect(Object.keys(event.contexts).sort()).toEqual(['runtime', 'trace'])
    expect(Object.keys(event.contexts.trace).sort()).toEqual(['span_id', 'trace_id'])
    for (const field of ['request', 'user', 'breadcrumbs', 'transaction', 'server_name', 'modules', 'spans']) {
      expect(event).not.toHaveProperty(field)
    }
    expect(JSON.parse(header).trace).not.toHaveProperty('transaction')
  })

  it('carries nothing from the request, the visitor or the private area', async () => {
    clearReportWindows()
    const envelopes = await reportDuringRequest('admin course save failed', new Error('save failed'))
    expect(envelopes).toHaveLength(1)
    const text = envelopes[0]
    for (const value of [
      'ada@example.com',
      TEST_ADMIN_PATH,
      'admin_token',
      'session-value',
      'abcdefghijklmnopqrstuvwxyz0123',
      '203.0.113.9',
      'Browser',
      'stacktrace',
      'pre_context',
    ]) {
      expect(text).not.toContain(value)
    }
  })

  it('sends a repeat inside the minute as a count on the next report', async () => {
    clearReportWindows()
    expect(await reportDuringRequest('contact submit failed', new Error('x'))).toHaveLength(1)
    expect(await reportDuringRequest('contact submit failed', new Error('x'))).toHaveLength(0)
  })
})
