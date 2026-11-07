import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorEvent, EventHint } from '@sentry/nextjs'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'
import { getAdminPath } from './middleware-logic'
import {
  REPORTS_PER_HOUR,
  REPORT_HOUR_MS,
  clearReportQuota,
  filterServerEvent,
  filterServerSpan,
  filterServerTransaction,
  keepReportFields,
  markHelperReport,
  pageAddress,
  scrubName,
} from './sentry-privacy'

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123'
const EMAIL = 'ada@example.com'

type Span = Parameters<typeof filterServerSpan>[0]
type Transaction = Parameters<typeof filterServerTransaction>[0]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  clearReportQuota()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function requestEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: 'e1',
    timestamp: 1,
    platform: 'node',
    level: 'error',
    environment: 'production',
    release: 'r1',
    sdk: { name: 'sentry.javascript.nextjs', version: '10.45.0' },
    server_name: 'host-1',
    modules: { next: '14.2.35' },
    transaction: `POST /api/${TEST_ADMIN_PATH}/courses/[courseId]?token=${TOKEN}`,
    request: {
      method: 'POST',
      url: `https://accountingbody.com/api/${TEST_ADMIN_PATH}/courses/1?token=${TOKEN}#part`,
      query_string: `token=${TOKEN}`,
      headers: { cookie: 'admin_token=session-value', 'user-agent': 'Browser' },
      cookies: { admin_token: 'session-value' },
      data: { email: EMAIL },
      env: { REMOTE_ADDR: '203.0.113.9' },
    },
    user: { email: EMAIL, ip_address: '203.0.113.9' },
    breadcrumbs: [{ category: 'console', message: `saving for ${EMAIL}` }],
    tags: { platform: 'ab', note: `for ${EMAIL}` },
    extra: { attempts: 3, retried: false, rawSearch: 'ada lovelace', summary: { email: EMAIL } },
    contexts: {
      runtime: { name: 'node', version: 'v20.0.0' },
      os: { name: 'Linux', version: '6.0' },
      trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: { 'url.full': `https://x/?token=${TOKEN}` } },
      cloud_resource: { 'cloud.region': 'iad1' },
      app: { app_memory: 1 },
    },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: `could not save for ${EMAIL} at /api/${TEST_ADMIN_PATH}/x`,
          mechanism: { type: 'auto.function.nextjs.route_handler', handled: false, data: { function: 'x' } },
          stacktrace: {
            frames: [
              {
                filename: `app:///_next/server/app/api/${TEST_ADMIN_PATH}/courses/route.js`,
                abs_path: `/var/task/.next/server/app/api/${TEST_ADMIN_PATH}/courses/route.js`,
                module: `app.api.${TEST_ADMIN_PATH}.courses`,
                function: 'wrapRouteHandlerWithSentry',
                lineno: 10,
                colno: 5,
                in_app: true,
                pre_context: ['const secret = 1'],
                context_line: 'throw new TypeError()',
                post_context: ['}'],
                vars: { email: EMAIL },
              },
            ],
          },
        },
      ],
    },
    debug_meta: { images: [{ type: 'sourcemap', debug_id: 'd1', code_file: `app:///_next/server/app/api/${TEST_ADMIN_PATH}/courses/route.js` }] },
    sdkProcessingMetadata: {
      normalizedRequest: { url: `https://x/?token=${TOKEN}` },
      dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public', transaction: `POST /api/${TEST_ADMIN_PATH}/courses/[courseId]` },
    },
  }
}

describe('problem reports from the server keep only what is needed to fix them', () => {
  it('sends only the method and the page path, never its query', () => {
    const event = filterServerEvent(requestEvent())!
    expect(event.request).toEqual({ method: 'POST', url: 'https://accountingbody.com/api/admin-area/courses/1' })
  })

  it('leaves out the visitor, the trail, the host name and the installed packages', () => {
    const event = filterServerEvent(requestEvent())!
    for (const field of ['user', 'breadcrumbs', 'server_name', 'modules']) expect(event).not.toHaveProperty(field)
  })

  it('keeps runtime, system and trace ids only', () => {
    const event = filterServerEvent(requestEvent())!
    expect(event.contexts).toEqual({
      runtime: { name: 'node', version: 'v20.0.0' },
      os: { name: 'Linux', version: '6.0' },
      trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) },
    })
  })

  it('keeps numbers and yes/no extras only', () => {
    expect(filterServerEvent(requestEvent())!.extra).toEqual({ attempts: 3, retried: false })
  })

  it('keeps tags with personal parts replaced', () => {
    expect(filterServerEvent(requestEvent())!.tags).toEqual({ platform: 'ab', note: 'for [removed]' })
  })

  it('keeps the error type and a shortened message with personal parts replaced', () => {
    const [value] = filterServerEvent(requestEvent())!.exception!.values!
    expect(value.type).toBe('TypeError')
    expect(value.value).toBe('could not save for [removed] at /api/[removed]/x')
    expect(value.mechanism).toEqual({ type: 'auto.function.nextjs.route_handler', handled: false })
  })

  it('keeps stack frames for debugging, without source lines or values', () => {
    const [frame] = filterServerEvent(requestEvent())!.exception!.values![0].stacktrace!.frames!
    expect(frame).toEqual({
      filename: 'app:///_next/server/app/api/admin-area/courses/route.js',
      abs_path: '/var/task/.next/server/app/api/admin-area/courses/route.js',
      module: 'app.api.admin-area.courses',
      function: 'wrapRouteHandlerWithSentry',
      lineno: 10,
      colno: 5,
      in_app: true,
    })
  })

  it('names the route by method and path, without its query', () => {
    expect(filterServerEvent(requestEvent())!.transaction).toBe('POST /api/admin-area/courses/[courseId]')
    const plain = requestEvent()
    delete plain.transaction
    expect(filterServerEvent(plain)!.transaction).toBe('POST /api/admin-area/courses/1')
  })

  it('writes the route name in the trace header the same way', () => {
    const event = filterServerEvent(requestEvent())!
    expect(event.sdkProcessingMetadata).toEqual({
      dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public', transaction: 'POST /api/admin-area/courses/[courseId]' },
    })
  })

  it('keeps the source map pairing with the same file names as the frames', () => {
    expect(filterServerEvent(requestEvent())!.debug_meta).toEqual({
      images: [{ type: 'sourcemap', debug_id: 'd1', code_file: 'app:///_next/server/app/api/admin-area/courses/route.js' }],
    })
  })

  it('carries none of the request, visitor or private area values anywhere', () => {
    const text = JSON.stringify(filterServerEvent(requestEvent()))
    for (const value of [EMAIL, TEST_ADMIN_PATH, TOKEN, 'session-value', 'admin_token', '203.0.113.9', 'Browser', 'ada lovelace', 'const secret', 'iad1']) {
      expect(text).not.toContain(value)
    }
  })

  it('keeps a message report short and replaces personal parts', () => {
    const event = filterServerEvent({ type: undefined, message: `[search] job query timed out for ${EMAIL}`, level: 'warning' })!
    expect(event.message).toBe('[search] job query timed out for [removed]')
    expect(event.level).toBe('warning')
  })

  it('reads link codes and addresses written in encoded form', () => {
    expect(pageAddress(`https://accountingbody.com/u/ada%40example.com/${TOKEN}?x=1`)).toBe('https://accountingbody.com/u/[removed]/[removed]')
    expect(pageAddress('https://user:pw@accountingbody.com/a')).toBe('https://accountingbody.com/a')
  })

  it('keeps ordinary long code names readable and removes code-like runs', () => {
    expect(scrubName('processTicksAndRejections')).toBe('processTicksAndRejections')
    expect(scrubName(`chunk.${TOKEN}.js`)).toBe('chunk.[removed].js')
    expect(scrubName('x'.repeat(40))).toBe('[removed]')
  })

  it('uses the built-in admin area name when none is configured', () => {
    vi.stubEnv('ADMIN_PATH', undefined)
    const name = getAdminPath()
    const event = requestEvent()
    event.request!.url = `https://accountingbody.com/api/${name.toUpperCase()}/x?token=${TOKEN}&email=${EMAIL}`
    const text = JSON.stringify(filterServerEvent(event)).toLowerCase()
    expect(text.includes(name.toLowerCase())).toBe(false)
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(EMAIL)
  })

  it('sends nothing when the report cannot be read safely', () => {
    const hostile = requestEvent()
    Object.defineProperty(hostile, 'exception', {
      get() {
        throw new Error('unreadable')
      },
    })
    expect(filterServerEvent(hostile)).toBeNull()
  })
})

describe('reports from the shared helper keep the helper fields', () => {
  function helperEvent(): ErrorEvent {
    return {
      ...requestEvent(),
      fingerprint: ['admin course save failed'],
      tags: { label: 'admin course save failed', area: 'admin' },
      extra: { error_code: '23505', held_back: 0 },
      exception: { values: [{ type: 'PostgrestError', value: 'duplicate key for [removed]', mechanism: { type: 'generic', handled: true } }] },
    }
  }

  function helperHint(): EventHint {
    const report = new Error('duplicate key for [removed]')
    markHelperReport(report)
    return { originalException: report }
  }

  it('keeps exactly the helper field list', () => {
    const event = helperEvent()
    expect(filterServerEvent(event, helperHint())).toEqual({
      ...keepReportFields(event),
      sdkProcessingMetadata: { dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public', transaction: 'POST /api/admin-area/courses/[courseId]' } },
    })
  })

  it('treats an unmarked report with the same tags like any other report', () => {
    const event = { ...helperEvent(), exception: { values: [{ type: 'Error', value: `for ${EMAIL}` }] } }
    const kept = filterServerEvent(event, { originalException: new Error('x') })!
    expect(kept.exception!.values![0].value).toBe('for [removed]')
    expect(kept.request).toEqual({ method: 'POST', url: 'https://accountingbody.com/api/admin-area/courses/1' })
    expect(kept.extra).toEqual({ held_back: 0 })
  })
})

describe(`at most ${REPORTS_PER_HOUR} problem reports per rolling hour per instance`, () => {
  it('holds back reports over the hourly limit and sends their count with the next one', () => {
    expect(REPORTS_PER_HOUR).toBe(30)
    expect(REPORT_HOUR_MS).toBe(60 * 60 * 1000)
    const hint = (): EventHint => {
      const report = new Error('x')
      markHelperReport(report)
      return { originalException: report }
    }
    for (let i = 0; i < 15; i += 1) expect(filterServerEvent({ type: undefined, message: 'm' })).not.toBeNull()
    for (let i = 0; i < 15; i += 1) expect(filterServerEvent({ type: undefined, extra: { held_back: 0 } }, hint())).not.toBeNull()
    expect(filterServerEvent({ type: undefined, message: 'm' })).toBeNull()
    expect(filterServerEvent({ type: undefined, extra: { held_back: 0 } }, hint())).toBeNull()
    vi.advanceTimersByTime(REPORT_HOUR_MS - 1)
    expect(filterServerEvent({ type: undefined, message: 'm' })).toBeNull()
    vi.advanceTimersByTime(1)
    const next = filterServerEvent({ type: undefined, extra: { held_back: 0 } }, hint())!
    expect(next.extra).toEqual({ held_back: 0, held_back_total: 3 })
    expect(filterServerEvent({ type: undefined, message: 'm' })!.extra).toEqual({})
  })

  it('counts the hour as a rolling window', () => {
    for (let i = 0; i < REPORTS_PER_HOUR; i += 1) {
      expect(filterServerEvent({ type: undefined, message: 'm' })).not.toBeNull()
      vi.advanceTimersByTime(60 * 1000)
    }
    // The first report is now 30 minutes old: still inside the hour.
    expect(filterServerEvent({ type: undefined, message: 'm' })).toBeNull()
    vi.advanceTimersByTime(30 * 60 * 1000)
    expect(filterServerEvent({ type: undefined, message: 'm' })!.extra).toEqual({ held_back_total: 1 })
  })

  it('does not count timings', () => {
    for (let i = 0; i < 100; i += 1) filterServerTransaction({ type: 'transaction', transaction: 'GET /' })
    expect(filterServerEvent({ type: undefined, message: 'm' })).not.toBeNull()
  })

  it('does not count a report that could not be read', () => {
    const hostile = { type: undefined } as ErrorEvent
    Object.defineProperty(hostile, 'tags', {
      get() {
        throw new Error('unreadable')
      },
    })
    for (let i = 0; i < 50; i += 1) expect(filterServerEvent(hostile)).toBeNull()
    expect(filterServerEvent({ type: undefined, message: 'm' })!.extra).toEqual({})
  })
})

function supabaseSpan(): Span {
  return {
    span_id: 'c'.repeat(16),
    trace_id: 'a'.repeat(32),
    parent_span_id: 'b'.repeat(16),
    start_timestamp: 1,
    timestamp: 2,
    op: 'http.client',
    status: 'ok',
    origin: 'auto.http.otel.node_fetch',
    description: `GET https://project.supabase.co/rest/v1/subscribers?select=*&email=eq.${EMAIL}`,
    data: {
      'url.full': `https://project.supabase.co/rest/v1/subscribers?email=eq.${EMAIL}`,
      'http.url': `https://project.supabase.co/rest/v1/subscribers?email=eq.${EMAIL}`,
      'url.query': `?email=eq.${EMAIL}`,
      'http.query': `email=eq.${EMAIL}`,
      'http.request.header.cookie': 'admin_token=session-value',
      'user_agent.original': 'Browser',
      'http.response.status_code': 200,
      'server.address': 'project.supabase.co',
      'next.route': `/api/${TEST_ADMIN_PATH}/x`,
      'sentry.op': 'http.client',
      tags: [`/api/${TEST_ADMIN_PATH}/x?token=${TOKEN}`, `/api/${TEST_ADMIN_PATH}/y`],
    },
  }
}

describe('timings keep their path but never a query', () => {
  it('cuts the query from span names and values and removes request details', () => {
    expect(filterServerSpan(supabaseSpan())).toEqual({
      span_id: 'c'.repeat(16),
      trace_id: 'a'.repeat(32),
      parent_span_id: 'b'.repeat(16),
      start_timestamp: 1,
      timestamp: 2,
      op: 'http.client',
      status: 'ok',
      origin: 'auto.http.otel.node_fetch',
      description: 'GET https://project.supabase.co/rest/v1/subscribers',
      data: {
        'url.full': 'https://project.supabase.co/rest/v1/subscribers',
        'http.url': 'https://project.supabase.co/rest/v1/subscribers',
        'http.response.status_code': 200,
        'server.address': 'project.supabase.co',
        'next.route': '/api/admin-area/x',
        'sentry.op': 'http.client',
        tags: ['/api/admin-area/x', '/api/admin-area/y'],
      },
    })
  })

  it('removes database statements', () => {
    const span = filterServerSpan({
      span_id: 'c'.repeat(16),
      trace_id: 'a'.repeat(32),
      start_timestamp: 1,
      op: 'db',
      description: `select * from subscribers where email = '${EMAIL}'`,
      data: { 'db.system': 'postgresql', 'db.statement': `select '${EMAIL}'`, 'db.query.text': 'select 1', 'db.name': 'main' },
    })
    expect(span).toEqual({ span_id: 'c'.repeat(16), trace_id: 'a'.repeat(32), start_timestamp: 1, op: 'db', data: { 'db.system': 'postgresql' } })
  })

  it('returns a span with timings only when the span cannot be read', () => {
    const hostile = supabaseSpan()
    Object.defineProperty(hostile, 'description', {
      get() {
        throw new Error('unreadable')
      },
    })
    expect(filterServerSpan(hostile)).toEqual({ span_id: 'c'.repeat(16), trace_id: 'a'.repeat(32), start_timestamp: 1, timestamp: 2, data: {} })
  })

  function transaction(): Transaction {
    return {
      type: 'transaction',
      event_id: 't1',
      start_timestamp: 1,
      timestamp: 2,
      platform: 'node',
      transaction: `GET /api/${TEST_ADMIN_PATH}/jobs?token=${TOKEN}`,
      transaction_info: { source: 'route' },
      request: { method: 'GET', url: `https://accountingbody.com/api/${TEST_ADMIN_PATH}/jobs?token=${TOKEN}`, headers: { cookie: 'admin_token=session-value' }, query_string: `token=${TOKEN}` },
      user: { email: EMAIL, ip_address: '203.0.113.9' },
      breadcrumbs: [{ message: EMAIL }],
      server_name: 'host-1',
      tags: { note: EMAIL },
      extra: { rawSearch: 'ada lovelace', count: 2 },
      contexts: {
        trace: {
          trace_id: 'a'.repeat(32),
          span_id: 'b'.repeat(16),
          op: 'http.server',
          status: 'ok',
          origin: 'auto.http.otel.http',
          data: { 'http.target': `/api/${TEST_ADMIN_PATH}/jobs?token=${TOKEN}`, 'http.query': `token=${TOKEN}`, 'sentry.source': 'route' },
        },
        runtime: { name: 'node', version: 'v20.0.0' },
        otel: { resource: { 'host.name': 'host-1' } },
      },
      spans: [supabaseSpan()],
      measurements: { ttfb: { value: 12, unit: 'millisecond' } },
      sdkProcessingMetadata: {
        spanCountBeforeProcessing: 1,
        normalizedRequest: { url: `https://x/?token=${TOKEN}` },
        dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public', transaction: `GET /api/${TEST_ADMIN_PATH}/jobs` },
      },
    }
  }

  it('keeps timings, operation and status, with names and request reduced', () => {
    const kept = filterServerTransaction(transaction())!
    expect(kept.transaction).toBe('GET /api/admin-area/jobs')
    expect(kept.request).toEqual({ method: 'GET', url: 'https://accountingbody.com/api/admin-area/jobs' })
    expect(kept.contexts).toEqual({
      runtime: { name: 'node', version: 'v20.0.0' },
      trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), op: 'http.server', status: 'ok', origin: 'auto.http.otel.http', data: { 'http.target': '/api/admin-area/jobs', 'sentry.source': 'route' } },
    })
    expect(kept.spans).toEqual([filterServerSpan(supabaseSpan())])
    expect(kept.extra).toEqual({ count: 2 })
    expect(kept.measurements).toEqual({ ttfb: { value: 12, unit: 'millisecond' } })
    expect(kept.sdkProcessingMetadata).toEqual({
      spanCountBeforeProcessing: 1,
      dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public', transaction: 'GET /api/admin-area/jobs' },
    })
    for (const field of ['user', 'breadcrumbs', 'server_name']) expect(kept).not.toHaveProperty(field)
  })

  it('carries none of the request, visitor or private area values anywhere', () => {
    const text = JSON.stringify(filterServerTransaction(transaction()))
    for (const value of [EMAIL, TEST_ADMIN_PATH, TOKEN, 'session-value', 'admin_token', '203.0.113.9', 'Browser', 'ada lovelace', 'eq.', 'host-1']) {
      expect(text).not.toContain(value)
    }
  })

  it('sends nothing when the timings cannot be read safely', () => {
    const hostile = transaction()
    Object.defineProperty(hostile, 'spans', {
      get() {
        throw new Error('unreadable')
      },
    })
    expect(filterServerTransaction(hostile)).toBeNull()
  })
})

describe('the filters run in both server runtimes', () => {
  const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

  it('the filter module needs nothing that only exists on the server', () => {
    const text = source('lib/sentry-privacy.ts')
    const imports = Array.from(text.matchAll(/^import\s+(type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm))
    const runtime = imports.filter((match) => !match[1]).map((match) => match[2])
    expect(runtime).toEqual(['./scrub-rules', './middleware-logic'])
    expect(text).not.toMatch(/\brequire\(|\bimport\(|\bnode:|\bBuffer\b|\bprocess\./)
    for (const file of ['lib/middleware-logic.ts', 'lib/scrub-rules.ts']) {
      const logic = source(file)
      expect(logic).not.toMatch(/^import\s/m)
      expect(logic).not.toMatch(/\brequire\(|\bnode:/)
    }
  })

  it.each(['sentry.server.config.ts', 'sentry.edge.config.ts'])('%s uses all three filters', (file) => {
    const text = source(file)
    expect(text).toContain("from './lib/sentry-privacy'")
    expect(text).toContain('beforeSend: filterServerEvent,')
    expect(text).toContain('beforeSendTransaction: filterServerTransaction,')
    expect(text).toContain('beforeSendSpan: filterServerSpan,')
    expect(text).not.toContain('sendDefaultPii')
  })
})
