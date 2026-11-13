import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'
import { filterBrowserBreadcrumb, filterBrowserEvent, filterBrowserSpan, filterBrowserTransaction, limitEvents } from './sentry-browser-privacy'

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

// The Next.js browser timing integration, run in a fresh Node process per
// case so the SDK's one-time page observers start clean. The page, its
// performance observers and visibility are stand-ins; a click with a slow
// response is fed to the observers the SDK registered, then the page is hidden.
const NEXT_CLIENT_DIR = join(dirname(nextjsEntry), 'client')
const TIMING_PAGE = `
const { createRequire } = require('module')
const { join } = require('path')
const [setting, scenario, clientDir] = process.argv.slice(1)
const observers = []
const listeners = []
globalThis.PerformanceObserver = class {
  constructor(callback) { this.callback = callback }
  observe(options) { this.type = options.type; observers.push(this) }
  disconnect() {}
  takeRecords() { return [] }
  static get supportedEntryTypes() { return ['event', 'first-input', 'long-animation-frame', 'paint', 'element', 'largest-contentful-paint', 'layout-shift', 'navigation', 'resource'] }
}
globalThis.PerformanceEventTiming = class {}
PerformanceEventTiming.prototype.interactionId = 0
const page = { referrer: '', location: { href: 'https://accountingbody.com/jobs' }, visibilityState: 'visible', readyState: 'complete',
  addEventListener: (type, fn) => listeners.push([type, fn]), removeEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] }
globalThis.document = page
globalThis.location = { href: 'https://accountingbody.com/jobs', origin: 'https://accountingbody.com', pathname: '/jobs' }
globalThis.addEventListener = (type, fn) => listeners.push([type, fn])
globalThis.removeEventListener = () => {}
const load = createRequire(join(clientDir, 'index.js'))
const Browser = createRequire(load.resolve('@sentry/react'))('@sentry/browser')
const { browserTracingIntegration } = load('./browserTracingIntegration.js')
const sent = []
const client = new Browser.BrowserClient({
  dsn: 'https://public@o1.ingest.example.invalid/1',
  stackParser: Browser.defaultStackParser,
  tracesSampleRate: 1,
  sendClientReports: false,
  integrations: [setting === 'configured' ? browserTracingIntegration({ enableInp: false }) : browserTracingIntegration()],
  transport: (options) => Browser.createTransport(options, async (request) => {
    sent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body))
    return { statusCode: 200 }
  }),
})
Browser.setCurrentClient(client)
client.init()
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
;(async () => {
  if (scenario === 'click') {
    const entry = { name: 'click', entryType: 'event', interactionId: 7, duration: 240, startTime: 50, processingStart: 60, processingEnd: 280, target: null, toJSON: () => ({}) }
    for (const observer of observers) if (observer.type === 'event' || observer.type === 'first-input') observer.callback({ getEntries: () => [entry] }, observer)
    await wait(20)
    page.visibilityState = 'hidden'
    for (const [type, fn] of listeners) if (type === 'visibilitychange' || type === 'pagehide') fn({ type, timeStamp: 1000 })
  } else {
    await wait(1500)
  }
  await Browser.flush(2000)
  const items = sent.map((envelope) => {
    const [, itemHeader, body] = envelope.split('\\n')
    const item = JSON.parse(body)
    return { type: JSON.parse(itemHeader).type, op: item.op ?? item.contexts?.trace?.op, transaction: item.transaction, spans: (item.spans ?? []).map((span) => span.op).sort() }
  })
  process.stdout.write(JSON.stringify({ observers: observers.map((observer) => observer.type).sort(), integrations: Object.keys(client._integrations), items }), () => process.exit(0))
})()
`

type PageResult = { observers: string[]; integrations: string[]; items: Array<{ type: string; op?: string; transaction?: string; spans: string[] }> }

function runPage(setting: 'default' | 'configured', scenario: 'click' | 'load'): PageResult {
  return JSON.parse(execFileSync(process.execPath, ['-e', TIMING_PAGE, setting, scenario, NEXT_CLIENT_DIR], { encoding: 'utf8', timeout: 15_000 }))
}

describe('interaction timing is not recorded', () => {
  it('the configured timing integration takes the place of the default one', () => {
    const core = createRequire(nextjsEntry)('@sentry/core') as { getIntegrationsToSetup: (options: object) => Array<{ name: string }> }
    const { browserTracingIntegration } = createRequire(join(NEXT_CLIENT_DIR, 'index.js'))('./browserTracingIntegration.js') as {
      browserTracingIntegration: (options?: object) => { name: string }
    }
    const configured = browserTracingIntegration({ enableInp: false })
    const installed = core.getIntegrationsToSetup({ defaultIntegrations: [browserTracingIntegration()], integrations: [configured] })
    const timing = installed.filter((integration) => integration.name === 'BrowserTracing')
    expect(timing).toHaveLength(1)
    expect(timing[0]).toBe(configured)
  })

  it('a slow click sends an interaction timing by default and none with the setting', () => {
    const before = runPage('default', 'click')
    expect(before.items.map((item) => [item.type, item.op])).toStrictEqual([['span', 'ui.interaction.click']])
    const after = runPage('configured', 'click')
    expect(after.integrations).toStrictEqual(['BrowserTracing'])
    expect(after.items).toStrictEqual([])
  }, 30_000)

  it('only the interaction observers are left out', () => {
    const before = runPage('default', 'click').observers
    const after = runPage('configured', 'click').observers
    expect(before.filter((type) => !after.includes(type)).sort()).toStrictEqual(['event', 'event', 'first-input', 'first-input', 'first-input'])
    expect(after.every((type) => before.includes(type))).toBe(true)
    expect(after).toStrictEqual(['element', 'largest-contentful-paint', 'long-animation-frame', 'paint'])
  }, 30_000)

  it('page-load timing is the same with the setting', () => {
    const before = runPage('default', 'load')
    const after = runPage('configured', 'load')
    expect(before.items).toStrictEqual([{ type: 'transaction', op: 'pageload', transaction: '/jobs', spans: ['mark'] }])
    expect(after.items).toStrictEqual(before.items)
  }, 30_000)
})

describe('the browser sends a limited number of problem reports as Sentry receives them', () => {
  const limitedSent: string[] = []
  let previous: ReturnType<typeof Sentry.getClient>

  beforeAll(() => {
    previous = Sentry.getClient()
    const limited = new Sentry.BrowserClient({
      dsn: 'https://public@o1.ingest.example.invalid/1',
      stackParser: Sentry.defaultStackParser,
      integrations: [],
      tracesSampleRate: 1,
      sendClientReports: false,
      beforeSend: limitEvents(filterBrowserEvent, 10),
      beforeSendTransaction: filterBrowserTransaction,
      beforeSendSpan: filterBrowserSpan,
      transport: (options) =>
        Sentry.createTransport(options, async (request) => {
          limitedSent.push(typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body))
          return { statusCode: 200 }
        }),
    })
    Sentry.setCurrentClient(limited)
    limited.init()
  })

  afterAll(() => {
    if (previous) Sentry.setCurrentClient(previous)
  })

  it('delivers ten filtered problem reports, then none, while timings continue', async () => {
    for (let i = 0; i < 12; i++) Sentry.captureException(errorWithFrames())
    await Sentry.startSpan({ name: '/jobs', op: 'pageload', forceTransaction: true }, async () => undefined)
    await Sentry.flush(2000)
    const events = limitedSent.filter((envelope) => envelope.includes('{"type":"event"}'))
    const transactions = limitedSent.filter((envelope) => envelope.includes('{"type":"transaction"}'))
    expect(events).toHaveLength(10)
    for (const envelope of events) for (const value of VALUES) expect(envelope).not.toContain(value)
    expect(transactions).toHaveLength(1)
  })
})
