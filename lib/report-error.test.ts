import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'
import {
  MAX_REPORT_LABELS,
  REPORT_WINDOW_MS,
  clearReportWindows,
  keepReportFields,
  reportServerError,
  scrubText,
  summariseError,
} from './report-error'

// The Sentry SDK is replaced by a recorder: each capture records the error
// and what the helper set on the scope.

type Capture = {
  error: Error
  fingerprint?: string[]
  level?: string
  tags: Record<string, string>
  extra: Record<string, unknown>
  processors: ((event: Record<string, unknown>) => unknown)[]
}

const sdk = vi.hoisted(() => ({
  initialised: true,
  captures: [] as Capture[],
  captureThrows: false,
  newTraces: 0,
}))

vi.mock('@sentry/nextjs', () => ({
  isInitialized: () => sdk.initialised,
  startNewTrace: (callback: () => unknown) => {
    sdk.newTraces += 1
    return callback()
  },
  withScope: (callback: (scope: unknown) => unknown) => {
    const capture: Capture = { error: new Error('unset'), tags: {}, extra: {}, processors: [] }
    const scope = {
      setFingerprint: (value: string[]) => (capture.fingerprint = value),
      setLevel: (value: string) => (capture.level = value),
      setTag: (key: string, value: string) => (capture.tags[key] = value),
      setExtra: (key: string, value: unknown) => (capture.extra[key] = value),
      addEventProcessor: (processor: Capture['processors'][number]) => capture.processors.push(processor),
    }
    ;(globalThis as { __scope?: Capture }).__scope = capture
    return callback(scope)
  },
  captureException: (error: Error) => {
    if (sdk.captureThrows) throw new Error('capture failed')
    const capture = (globalThis as { __scope?: Capture }).__scope!
    capture.error = error
    sdk.captures.push(capture)
    return 'id'
  },
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-01T09:00:00Z'))
  vi.stubEnv('ADMIN_PATH', TEST_ADMIN_PATH)
  Object.assign(sdk, { initialised: true, captures: [], captureThrows: false, newTraces: 0 })
  clearReportWindows()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('reportServerError', () => {
  it('sends one report with the label as tag and fingerprint', () => {
    const error = Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' })
    reportServerError('contact submit failed', error, { area: 'public', code: 'insert' })
    expect(sdk.captures).toHaveLength(1)
    const [capture] = sdk.captures
    expect(capture.fingerprint).toEqual(['contact submit failed'])
    expect(capture.level).toBe('error')
    expect(capture.tags).toEqual({ label: 'contact submit failed', area: 'public' })
    expect(capture.extra).toEqual({ error_code: '57014', code: 'insert', held_back: 0 })
    expect(capture.error.name).toBe('Error')
    expect(capture.error.message).toBe('canceling statement due to statement timeout')
    expect(capture.error.stack).toBeUndefined()
    expect(capture.processors).toHaveLength(1)
    expect(sdk.newTraces).toBe(1)
  })

  it('leaves the area out when none is given', () => {
    reportServerError('studio session lookup', { message: 'timeout', code: 'PGRST301' })
    expect(sdk.captures[0].tags).toEqual({ label: 'studio session lookup' })
    expect(sdk.captures[0].extra).toEqual({ error_code: 'PGRST301', held_back: 0 })
  })

  it('accepts only the four known areas and short codes', () => {
    reportServerError('one', new Error('x'), { area: 'other' as never, code: 'not a code!' })
    expect(sdk.captures[0].tags).toEqual({ label: 'one' })
    expect(sdk.captures[0].extra).toEqual({ held_back: 0 })
  })

  it('keeps personal details out of the label', () => {
    reportServerError(`lookup for ada@example.com in ${TEST_ADMIN_PATH}`, new Error('x'))
    expect(sdk.captures[0].tags.label).toBe('lookup for [removed] in [removed]')
    expect(sdk.captures[0].fingerprint).toEqual(['lookup for [removed] in [removed]'])
  })

  it('does nothing when Sentry is not set up', () => {
    sdk.initialised = false
    reportServerError('contact submit failed', new Error('x'))
    expect(sdk.captures).toEqual([])
    expect(sdk.newTraces).toBe(0)
  })

  it('never throws when the capture throws', () => {
    sdk.captureThrows = true
    expect(() => reportServerError('contact submit failed', new Error('x'))).not.toThrow()
  })

  it('never throws when reading the error throws', () => {
    const hostile = new Proxy(
      {},
      {
        get: () => {
          throw new Error('no reading')
        },
      },
    )
    expect(() => reportServerError('contact submit failed', hostile)).not.toThrow()
    expect(sdk.captures).toEqual([])
  })

  it('returns nothing and does not wait', () => {
    expect(reportServerError('contact submit failed', new Error('x'))).toBeUndefined()
  })
})

describe('keeping personal details out of problem reports', () => {
  it('replaces email addresses', () => {
    expect(scrubText('duplicate key for ada.lovelace+test@example.co.uk here')).toBe('duplicate key for [removed] here')
  })

  it('replaces long token-like strings', () => {
    expect(scrubText('token abcdefghijABCDEFGHIJ_-12 rejected')).toBe('token [removed] rejected')
    expect(scrubText('short abcdefghijABCDEFGHI ok')).toBe('short abcdefghijABCDEFGHI ok')
  })

  it('replaces runs of six or more digits', () => {
    expect(scrubText('phone 0912345678 and id 12345')).toBe('phone [removed] and id 12345')
  })

  it('replaces the private area name in any case', () => {
    expect(scrubText(`/api/${TEST_ADMIN_PATH.toUpperCase()}/x`)).toBe('/api/[removed]/x')
  })

  it('cuts the message to 120 characters after replacing', () => {
    const long = `${'a '.repeat(55)}ada@example.com${' b'.repeat(100)}`
    const out = scrubText(long)
    expect(out).toHaveLength(120)
    expect(out).toContain('[removed]')
    expect(out).not.toContain('@')
  })

  it('does not leave part of a token at the cut', () => {
    const out = scrubText(`${'x '.repeat(55)}${'T'.repeat(40)}`)
    expect(out).not.toMatch(/T{2,}/)
  })

  it('reads only name, code and message from an error object', () => {
    const toJSON = vi.fn(() => ({ email: 'ada@example.com' }))
    const toString = vi.fn(() => 'ada@example.com')
    const row = { email: 'ada@example.com' }
    const summary = summariseError({
      name: 'PostgrestError',
      code: '23505',
      message: 'duplicate key value',
      details: 'Key (email)=(ada@example.com) already exists.',
      hint: 'ada@example.com',
      row,
      toJSON,
      toString,
    })
    expect(summary).toEqual({ name: 'PostgrestError', code: '23505', message: 'duplicate key value' })
    expect(toJSON).not.toHaveBeenCalled()
    expect(toString).not.toHaveBeenCalled()
  })

  it('describes values that are not errors without their contents', () => {
    expect(summariseError('reached ada@example.com')).toEqual({ name: 'Error', message: 'reached [removed]' })
    expect(summariseError(undefined)).toEqual({ name: 'Error', message: 'undefined value' })
    expect(summariseError(null)).toEqual({ name: 'Error', message: 'null value' })
    expect(summariseError(42)).toEqual({ name: 'Error', message: 'number value' })
    expect(summariseError({ message: { nested: 'ada@example.com' } })).toEqual({ name: 'Error', code: undefined, message: '' })
  })

  it('keeps unusual error names and codes out', () => {
    expect(summariseError({ name: 'ada@example.com', code: 'a b', message: 'x' })).toEqual({ name: 'Error', code: undefined, message: 'x' })
  })

  it('sends only the report fields and drops request, visitor and trail data', () => {
    reportServerError('admin course save failed', new Error('x'), { area: 'admin' })
    const event = {
      event_id: 'e1',
      timestamp: 1,
      platform: 'node',
      level: 'error',
      environment: 'production',
      release: 'r1',
      sdk: { name: 'sentry.javascript.nextjs' },
      fingerprint: ['admin course save failed'],
      exception: {
        values: [{ type: 'Error', value: 'x', mechanism: { type: 'generic', handled: true }, stacktrace: { frames: [{ filename: 'app/x.ts', pre_context: ['secret'] }] } }],
      },
      tags: { label: 'admin course save failed', area: 'admin', other: 'y' },
      extra: { held_back: 0, body: { email: 'ada@example.com' } },
      request: { url: 'https://example.com/api/x?token=abc', headers: { cookie: 'admin_token=z' }, query_string: 'token=abc' },
      user: { email: 'ada@example.com', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'ada@example.com' }],
      transaction: `POST /api/${TEST_ADMIN_PATH}/x`,
      server_name: 'host-1-2-3-4',
      modules: { next: '14' },
      contexts: {
        runtime: { name: 'node', version: 'v20' },
        trace: { trace_id: 't', span_id: 's', data: { url: 'https://example.com/?token=abc' } },
        os: { name: 'Linux' },
        cloud_resource: { 'cloud.region': 'x' },
      },
      sdkProcessingMetadata: { normalizedRequest: { url: 'https://example.com' } },
    }
    const kept = sdk.captures[0].processors[0](event)
    expect(kept).toEqual({
      event_id: 'e1',
      timestamp: 1,
      platform: 'node',
      level: 'error',
      environment: 'production',
      release: 'r1',
      sdk: { name: 'sentry.javascript.nextjs' },
      fingerprint: ['admin course save failed'],
      exception: { values: [{ type: 'Error', value: 'x', mechanism: { type: 'generic', handled: true } }] },
      tags: { label: 'admin course save failed', area: 'admin' },
      extra: { held_back: 0 },
      contexts: { runtime: { name: 'node', version: 'v20' }, trace: { trace_id: 't', span_id: 's' } },
      sdkProcessingMetadata: {},
    })
  })

  it('leaves other kinds of events to Sentry', () => {
    reportServerError('one', new Error('x'))
    const transaction = { type: 'transaction', transaction: 'GET /' }
    expect(sdk.captures[0].processors[0](transaction)).toBe(transaction)
    expect(keepReportFields({ exception: undefined }).exception).toEqual({ values: [] })
  })
})

describe('reports a server problem once per minute per label', () => {
  it('holds back repeats inside the window and sends their count with the next report', () => {
    reportServerError('contact submit failed', new Error('x'))
    vi.advanceTimersByTime(REPORT_WINDOW_MS - 1)
    reportServerError('contact submit failed', new Error('x'))
    reportServerError('contact submit failed', new Error('x'))
    expect(sdk.captures).toHaveLength(1)
    vi.advanceTimersByTime(1)
    reportServerError('contact submit failed', new Error('x'))
    expect(sdk.captures).toHaveLength(2)
    expect(sdk.captures[1].extra.held_back).toBe(2)
    reportServerError('contact submit failed', new Error('x'))
    expect(sdk.captures).toHaveLength(2)
  })

  it('counts each label on its own', () => {
    reportServerError('one', new Error('x'))
    reportServerError('two', new Error('x'))
    reportServerError('one', new Error('x'))
    expect(sdk.captures.map((c) => c.tags.label)).toEqual(['one', 'two'])
  })

  it('starts a new window after the clock moves back', () => {
    reportServerError('one', new Error('x'))
    vi.setSystemTime(new Date('2026-06-01T08:00:00Z'))
    reportServerError('one', new Error('x'))
    expect(sdk.captures).toHaveLength(2)
  })

  it(`remembers at most ${MAX_REPORT_LABELS} labels and forgets the oldest first`, () => {
    for (let i = 0; i <= MAX_REPORT_LABELS; i += 1) reportServerError(`label ${i}`, new Error('x'))
    expect(sdk.captures).toHaveLength(MAX_REPORT_LABELS + 1)
    // 'label 0' was forgotten, so it reports again at once; the newest label is still held.
    reportServerError('label 0', new Error('x'))
    reportServerError(`label ${MAX_REPORT_LABELS}`, new Error('x'))
    expect(sdk.captures).toHaveLength(MAX_REPORT_LABELS + 2)
    expect(sdk.captures.at(-1)?.tags.label).toBe('label 0')
  })

  it('does not use up the window when Sentry is not set up', () => {
    sdk.initialised = false
    reportServerError('one', new Error('x'))
    sdk.initialised = true
    reportServerError('one', new Error('x'))
    expect(sdk.captures).toHaveLength(1)
    expect(sdk.captures[0].extra.held_back).toBe(0)
  })
})

// ── Shared failure helpers ──────────────────────────────────────────────────

describe('shared failure helpers report through the same helper', () => {
  const reported = () => sdk.captures.map((c) => ({ label: c.tags.label, area: c.tags.area, extra: c.extra, message: c.error.message }))

  beforeEach(() => {
    for (const level of ['log', 'warn', 'error'] as const) vi.spyOn(console, level).mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('a failed database read reports once under its label', async () => {
    const { checkRead } = await import('./db-check')
    const error = { message: 'canceling statement due to statement timeout', code: '57014', details: 'ada@example.com' }
    expect(checkRead({ data: null, error }, 'studio session lookup')).toEqual({ ok: false, error })
    expect(reported()).toEqual([
      { label: 'studio session lookup', area: undefined, extra: { error_code: '57014', held_back: 0 }, message: 'canceling statement due to statement timeout' },
    ])
  })

  it('a database read that works or finds nothing sends no report', async () => {
    const { checkRead } = await import('./db-check')
    checkRead({ data: [{ id: 1 }], error: null }, 'one')
    checkRead({ data: null, error: null }, 'two')
    checkRead({ data: null, error: { message: 'no rows', code: 'PGRST116' } }, 'three', { noRowsIsEmpty: true })
    expect(sdk.captures).toEqual([])
  })

  it('a failed email send reports once with its short name and status only', async () => {
    const { checkEmailSend } = await import('./email-check')
    const result = { data: null, error: { name: 'validation_error', statusCode: 422, message: 'Invalid to: ada@example.com' } }
    expect(checkEmailSend(result, 'contact team notification')).toBe(false)
    expect(reported()).toEqual([
      { label: 'email: contact team notification', area: undefined, extra: { error_code: '422', held_back: 0 }, message: 'send failed' },
    ])
    expect(sdk.captures[0].error.name).toBe('validation_error')
  })

  it('a sent email sends no report', async () => {
    const { checkEmailSend } = await import('./email-check')
    expect(checkEmailSend({ data: { id: 'm1' }, error: null }, 'contact team notification')).toBe(true)
    expect(sdk.captures).toEqual([])
  })

  it.each([
    ['unavailable', () => vi.stubEnv('TURNSTILE_SECRET_KEY_AB', undefined)],
    [
      'unreadable',
      () => {
        vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-secret-ab')
        vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
      },
    ],
  ] as const)('a person check that cannot be done (%s) reports once', async (reason, setUp) => {
    const { verifyHumanCheck } = await import('./turnstile-verify')
    setUp()
    expect(await verifyHumanCheck('token-1', '203.0.113.9', false, 'contact')).toEqual({ ok: false, reason })
    expect(reported()).toEqual([
      { label: 'person check: contact', area: 'public', extra: { code: reason, held_back: 0 }, message: reason },
    ])
  })

  it.each([
    ['missing', undefined, { success: true }],
    ['not-confirmed', 'token-1', { success: false }],
    ['passes', 'token-1', { success: true }],
  ] as const)('a person check answer about the visitor (%s) sends no report', async (_name, token, answer) => {
    const { verifyHumanCheck } = await import('./turnstile-verify')
    vi.stubEnv('TURNSTILE_SECRET_KEY_AB', 'test-secret-ab')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(answer), { status: 200 })))
    await verifyHumanCheck(token, '203.0.113.9', false, 'contact')
    expect(sdk.captures).toEqual([])
  })
})
