import { createRequire } from 'node:module'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'
import { filterBrowserBreadcrumb, filterBrowserEvent, filterBrowserSpan, filterBrowserTransaction } from './sentry-browser-privacy'

// Runs the browser Sentry SDK that @sentry/nextjs ships, with a transport that
// only records what would be sent, so nothing leaves the process. The page,
// referrer and browser name are stand-ins for the real window. Each case runs
// once without the filters (to show the values are really there to remove)
// and once with them, as the client config sets them.

type BrowserSdk = typeof import('../node_modules/@sentry/nextjs/node_modules/@sentry/browser')
const nextjsEntry = createRequire(import.meta.url).resolve('@sentry/nextjs')
const Sentry = createRequire(nextjsEntry)('@sentry/browser') as BrowserSdk

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123'
const EMAIL = 'ada@example.com'
const SITE = 'https://accountingbody.com'
const PAGE = `${SITE}/jobs/find-work/manage?token=${TOKEN}#part`
const REFERRER = `${SITE}/${TEST_ADMIN_PATH}/courses?token=${TOKEN}`
const AGENT = 'Mozilla/5.0 Browser'
const VALUES = [EMAIL, TEST_ADMIN_PATH, TOKEN, AGENT, 'Referer', 'User-Agent', '#part', 'session-value']

const sent: string[] = []
let filtersOn = true
const handlers = globalThis as unknown as {
  onerror: (message: string, url: string, line: number, column: number, error: Error) => void
  onunhandledrejection: (event: { reason: unknown }) => void
}

beforeAll(() => {
  vi.stubGlobal('document', { referrer: REFERRER, location: { href: PAGE }, addEventListener: () => undefined, visibilityState: 'visible' })
  vi.stubGlobal('location', { href: PAGE, origin: SITE, pathname: '/jobs/find-work/manage' })
  vi.stubGlobal('navigator', { userAgent: AGENT })
  const client = new Sentry.BrowserClient({
    dsn: 'https://public@o1.ingest.example.invalid/1',
    stackParser: Sentry.defaultStackParser,
    integrations: [Sentry.httpContextIntegration(), Sentry.globalHandlersIntegration(), Sentry.linkedErrorsIntegration()],
    tracesSampleRate: 1,
    sendClientReports: false,
    beforeSend: (event) => (filtersOn ? filterBrowserEvent(event) : event),
    beforeBreadcrumb: (breadcrumb) => (filtersOn ? filterBrowserBreadcrumb(breadcrumb) : breadcrumb),
    beforeSendTransaction: (event) => (filtersOn ? filterBrowserTransaction(event) : event),
    beforeSendSpan: (span) => (filtersOn ? filterBrowserSpan(span) : span),
    transport: (options) =>
      Sentry.createTransport(options, async (request) => {
        sent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body))
        return { statusCode: 200 }
      }),
  })
  Sentry.setCurrentClient(client)
  client.init()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  sent.length = 0
  Sentry.getIsolationScope().clear()
  Sentry.getCurrentScope().clear()
})

// The trail a visitor leaves on a manage page, added the way the SDK adds it.
function leaveTrail() {
  Sentry.addBreadcrumb({ category: 'navigation', data: { from: `/jobs/hire-talent/manage?token=${TOKEN}`, to: `/${TEST_ADMIN_PATH}/courses` } })
  Sentry.addBreadcrumb({
    category: 'fetch',
    type: 'http',
    data: { method: 'GET', url: `/api/recruitment/fetch-brief?token=${TOKEN}`, status_code: 200, request_body: `{"email":"${EMAIL}"}` },
  })
  Sentry.addBreadcrumb({ category: 'xhr', type: 'http', data: { method: 'POST', url: `/api/jobs/manage?token=${TOKEN}`, status_code: 400 } })
  Sentry.addBreadcrumb({ category: 'console', level: 'log', message: `saved for ${EMAIL}`, data: { logger: 'console', arguments: [EMAIL] } })
  Sentry.addBreadcrumb({ category: 'ui.click', message: `body > form > button[title="${EMAIL}"]` })
}

function errorWithFrames(): Error {
  const error = new TypeError(`could not load ${EMAIL}`)
  error.stack = [
    `TypeError: could not load ${EMAIL}`,
    `    at saveCourse (${SITE}/_next/static/chunks/app/${TEST_ADMIN_PATH}/courses/page-1a2b3c.js?v=${TOKEN}:1:2)`,
    `    at loadBrief (${SITE}/_next/static/chunks/app/jobs/find-work/manage/page-4d5e6f.js:3:4)`,
  ].join('\n')
  return error
}

async function sentOfType(type: string) {
  await Sentry.flush(2000)
  return sent.filter((envelope) => envelope.includes(`{"type":"${type}"}`))
}

function parts(envelope: string) {
  const [header, , body] = envelope.split('\n')
  return { header: JSON.parse(header), body: JSON.parse(body) }
}

describe('a browser problem report as Sentry receives it', () => {
  it('without the filters the page, referrer, browser and trail details are present', async () => {
    filtersOn = false
    leaveTrail()
    Sentry.captureException(errorWithFrames())
    const [envelope] = await sentOfType('event')
    for (const value of VALUES.filter((item) => item !== 'session-value')) expect(envelope).toContain(value)
    filtersOn = true
  })

  it('with the filters a direct report keeps what is needed and none of those values', async () => {
    leaveTrail()
    Sentry.captureException(errorWithFrames())
    const [envelope] = await sentOfType('event')
    for (const value of VALUES) expect(envelope).not.toContain(value)
    const { body } = parts(envelope)
    expect(body.request).toEqual({ url: `${SITE}/jobs/find-work/manage` })
    expect(body.user).toBeUndefined()
    expect(body.sdk.settings).toEqual({ infer_ip: 'never' })
    expect(body.exception.values[0]).toMatchObject({ type: 'TypeError', value: 'could not load [removed]' })
    const files = body.exception.values[0].stacktrace.frames.map((frame: { filename: string }) => frame.filename)
    expect(files).toContain(`${SITE}/_next/static/chunks/app/admin-area`)
    expect(files).toContain(`${SITE}/_next/static/chunks/app/jobs/find-work/manage/page-4d5e6f.js`)
    expect(body.breadcrumbs.map((crumb: { category: string }) => crumb.category)).toEqual(['navigation', 'fetch', 'xhr', 'console', 'ui.click'])
    expect(body.breadcrumbs[0].data).toEqual({ from: '/jobs/hire-talent/manage', to: '/admin-area' })
    expect(body.breadcrumbs[1].data).toEqual({ method: 'GET', url: '/api/recruitment/fetch-brief', status_code: 200 })
  })

  it('an uncaught page error passes the same filter', async () => {
    leaveTrail()
    handlers.onerror(`Uncaught TypeError: could not load ${EMAIL}`, PAGE, 1, 2, errorWithFrames())
    const [envelope] = await sentOfType('event')
    for (const value of VALUES) expect(envelope).not.toContain(value)
    const { body } = parts(envelope)
    expect(body.exception.values[0].mechanism).toEqual({ type: 'auto.browser.global_handlers.onerror', handled: false })
    expect(body.request).toEqual({ url: `${SITE}/jobs/find-work/manage` })
  })

  it('an unhandled promise failure passes the same filter', async () => {
    handlers.onunhandledrejection({ reason: errorWithFrames() })
    const [envelope] = await sentOfType('event')
    for (const value of VALUES) expect(envelope).not.toContain(value)
    expect(parts(envelope).body.exception.values[0].mechanism).toEqual({ type: 'auto.browser.global_handlers.onunhandledrejection', handled: false })
  })
})

async function pageWithCalls() {
  await Sentry.startSpan(
    { name: `/${TEST_ADMIN_PATH}/courses/1`, op: 'pageload', forceTransaction: true, attributes: { 'sentry.source': 'url' } },
    async () => {
      Sentry.startSpan(
        {
          name: `GET ${SITE}/api/recruitment/fetch-brief?token=${TOKEN}`,
          op: 'http.client',
          attributes: { 'url.full': `${SITE}/api/recruitment/fetch-brief?token=${TOKEN}`, 'http.query': `token=${TOKEN}`, 'http.method': 'GET' },
        },
        () => undefined,
      )
      Sentry.startSpan({ name: `${SITE}/_next/static/chunks/app/${TEST_ADMIN_PATH}/page-1a2b.js`, op: 'resource.script' }, () => undefined)
    },
  )
}

describe('browser timings as Sentry receives them', () => {
  it('without the filters the page address and link code are present', async () => {
    filtersOn = false
    await pageWithCalls()
    const [envelope] = await sentOfType('transaction')
    for (const value of [TEST_ADMIN_PATH, TOKEN, AGENT]) expect(envelope).toContain(value)
    filtersOn = true
  })

  it('with the filters a page load keeps timings and reduced names only', async () => {
    await pageWithCalls()
    const [envelope] = await sentOfType('transaction')
    for (const value of VALUES) expect(envelope).not.toContain(value)
    const { body } = parts(envelope)
    expect(body.transaction).toBe('/admin-area')
    expect(body.contexts.trace.op).toBe('pageload')
    const descriptions = body.spans.map((span: { description: string }) => span.description).sort()
    expect(descriptions).toEqual([`GET ${SITE}/api/recruitment/fetch-brief`, `${SITE}/_next/static/chunks/app/admin-area`])
    for (const span of body.spans) {
      expect(typeof span.start_timestamp).toBe('number')
      expect(typeof span.timestamp).toBe('number')
    }
  })

  it('a timing sent on its own passes the span filter', async () => {
    const span = Sentry.startInactiveSpan({
      name: 'body > form > button.save',
      op: 'ui.interaction.click',
      experimental: { standalone: true },
      attributes: { transaction: `/${TEST_ADMIN_PATH}/courses/1`, 'user_agent.original': AGENT, user: EMAIL },
    })
    span.end()
    const [envelope] = await sentOfType('span')
    for (const value of VALUES) expect(envelope).not.toContain(value)
    expect(parts(envelope).body.data).toMatchObject({ transaction: '/admin-area' })
  })
})
