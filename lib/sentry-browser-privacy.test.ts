import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { TEST_ADMIN_PATH } from './admin-session-fixtures'
import { getAdminPath } from './middleware-logic'
import {
  OUTSIDE_SERVICE_HOSTS,
  PUBLIC_API_SEGMENTS,
  PUBLIC_PAGE_SEGMENTS,
  browserAddress,
  filterBrowserBreadcrumb,
  filterBrowserEvent,
  filterBrowserSpan,
  filterBrowserTransaction,
} from './sentry-browser-privacy'

type Hook = (...args: never[]) => unknown
type Options = Record<string, unknown>

// The Sentry configs are read through a stand-in init that records options.
const inits = vi.hoisted(() => [] as Options[])
vi.mock('@sentry/nextjs', () => ({
  init: (options: Options) => {
    inits.push(options)
  },
}))

type TransactionEvent = Parameters<typeof filterBrowserTransaction>[0]
type SpanJSON = Parameters<typeof filterBrowserSpan>[0]
type Breadcrumb = Parameters<typeof filterBrowserBreadcrumb>[0]

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123'
const EMAIL = 'ada@example.com'
const SITE = 'https://accountingbody.com'
const PRIVATE_CHUNK = `app:///_next/static/chunks/app/${TEST_ADMIN_PATH}/courses/page-1a2b3c.js`
const PUBLIC_CHUNK = 'app:///_next/static/chunks/app/jobs/find-work/manage/page-4d5e6f.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function browserEvent(): ErrorEvent {
  return {
    event_id: 'e'.repeat(32),
    timestamp: 1,
    platform: 'javascript',
    level: 'error',
    environment: 'production',
    release: 'r1',
    sdk: { name: 'sentry.javascript.nextjs', version: '10.45.0', settings: { infer_ip: 'never' } } as ErrorEvent['sdk'],
    transaction: `/${TEST_ADMIN_PATH}/courses/1?token=${TOKEN}`,
    request: {
      url: `${SITE}/jobs/find-work/manage?token=${TOKEN}#part`,
      headers: { Referer: `${SITE}/${TEST_ADMIN_PATH}/x?token=${TOKEN}`, 'User-Agent': 'Mozilla/5.0 Browser' },
      query_string: `token=${TOKEN}`,
      cookies: { admin_token: 'session-value' },
      data: { email: EMAIL },
    },
    user: { email: EMAIL, ip_address: '203.0.113.9' },
    tags: { page: `/jobs/find-work/manage?token=${TOKEN}`, contact: EMAIL, ok: true },
    extra: { typed: 'what a visitor typed', count: 3, seen: false },
    contexts: {
      browser: { name: 'Chrome', version: '120', extra: 'kept-out' },
      os: { name: 'Android', version: '14', build: 'kept-out' },
      device: { family: 'Pixel', model: 'kept-out' },
      culture: { timezone: 'Africa/Addis_Ababa' },
      trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: { 'http.query': `token=${TOKEN}` } },
    },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: `could not load ${EMAIL} from ${SITE}/api/recruitment/fetch-brief?token=${TOKEN}`,
          mechanism: { type: 'auto.browser.global_handlers.onerror', handled: false, data: { url: `${SITE}/?token=${TOKEN}` } },
          stacktrace: {
            frames: [
              { filename: PRIVATE_CHUNK, abs_path: PRIVATE_CHUNK, function: 'saveCourse', lineno: 1, colno: 2, in_app: true, pre_context: ['const secret = 1'], context_line: 'boom()', vars: { email: EMAIL } },
              { filename: PUBLIC_CHUNK, function: 'loadBrief', lineno: 3, colno: 4, in_app: true },
            ],
          },
        },
      ],
    },
    breadcrumbs: [{ category: 'navigation', timestamp: 1, data: { from: `/jobs/hire-talent/manage?token=${TOKEN}`, to: `/${TEST_ADMIN_PATH}/x` } }],
    debug_meta: { images: [{ type: 'sourcemap', debug_id: 'd1', code_file: PRIVATE_CHUNK }] },
    sdkProcessingMetadata: {
      dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public', transaction: `/${TEST_ADMIN_PATH}/courses/[id]`, replay_id: 'r' },
    },
  } as unknown as ErrorEvent
}

function filtered(): ErrorEvent {
  const kept = filterBrowserEvent(browserEvent())
  if (!kept) throw new Error('expected a report')
  return kept
}

const PRIVATE_VALUES = [EMAIL, TEST_ADMIN_PATH, TOKEN, 'Referer', 'User-Agent', 'Mozilla', 'what a visitor typed', 'session-value', 'admin_token', '203.0.113.9', 'const secret', 'context_line', 'pre_context', '#part', 'kept-out', 'Addis', 'replay_id']

describe('browser problem reports keep only what is needed to fix them', () => {
  it('keeps the page address without its query or fragment', () => {
    expect(filtered().request).toEqual({ url: `${SITE}/jobs/find-work/manage` })
  })

  it('leaves out headers, cookies, body, query and the visitor', () => {
    const kept = filtered()
    expect(Object.keys(kept.request ?? {})).toEqual(['url'])
    expect(kept.user).toBeUndefined()
  })

  it('keeps the setting that tells Sentry not to read the visitor address', () => {
    expect(filtered().sdk?.settings).toEqual({ infer_ip: 'never' })
  })

  it('keeps the error type and a shortened message with personal parts and addresses reduced', () => {
    const [value] = filtered().exception?.values ?? []
    expect(value.type).toBe('TypeError')
    expect(value.value).toBe(`could not load [removed] from ${SITE}/api/recruitment/fetch-brief`)
    expect(value.mechanism).toEqual({ type: 'auto.browser.global_handlers.onerror', handled: false })
  })

  it('keeps stack frames for debugging and names private bundle files admin-area', () => {
    const frames = filtered().exception?.values?.[0].stacktrace?.frames ?? []
    expect(frames[0]).toEqual({
      filename: 'app:///_next/static/chunks/app/admin-area',
      abs_path: 'app:///_next/static/chunks/app/admin-area',
      function: 'saveCourse',
      lineno: 1,
      colno: 2,
      in_app: true,
    })
    expect(frames[1].filename).toBe(PUBLIC_CHUNK)
  })

  it('keeps the source map pairing with the same file names as the frames', () => {
    expect(filtered().debug_meta).toEqual({ images: [{ type: 'sourcemap', debug_id: 'd1', code_file: 'app:///_next/static/chunks/app/admin-area' }] })
  })

  it('keeps tags with personal parts replaced and numeric or yes/no extras only', () => {
    const kept = filtered()
    expect(kept.tags).toEqual({ page: '/jobs/find-work/manage', contact: '[removed]', ok: true })
    expect(kept.extra).toEqual({ count: 3, seen: false })
  })

  it('keeps browser, system and device family, and trace ids only', () => {
    expect(filtered().contexts).toEqual({
      browser: { name: 'Chrome', version: '120' },
      os: { name: 'Android', version: '14' },
      device: { family: 'Pixel' },
      trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16) },
    })
  })

  it('names the page and the trace header route without query and private pages admin-area', () => {
    const kept = filtered()
    expect(kept.transaction).toBe('/admin-area')
    expect(kept.sdkProcessingMetadata).toEqual({
      dynamicSamplingContext: { trace_id: 'a'.repeat(32), public_key: 'public', transaction: '/admin-area' },
    })
  })

  it('reduces the trail that travels with the report', () => {
    expect(filtered().breadcrumbs).toEqual([{ category: 'navigation', timestamp: 1, data: { from: '/jobs/hire-talent/manage', to: '/admin-area' } }])
  })

  it('carries none of the request, visitor or private page values anywhere', () => {
    const text = JSON.stringify(filtered())
    for (const value of PRIVATE_VALUES) expect(text).not.toContain(value)
  })

  it('reduces addresses and chunk names in chunk-load messages', () => {
    const event = browserEvent()
    event.exception = {
      values: [{ type: 'ChunkLoadError', value: `Loading chunk app/${TEST_ADMIN_PATH}/page failed. (error: ${SITE}/_next/static/chunks/app/${TEST_ADMIN_PATH}/page-9f8e7d.js)` }],
    }
    const value = filterBrowserEvent(event)?.exception?.values?.[0].value ?? ''
    expect(value).toBe(`Loading chunk app/admin-area failed. (error: ${SITE}/_next/static/chunks/app/admin-area)`)
  })

  it('sends nothing when the report cannot be read safely', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('unreadable') }, ownKeys: () => { throw new Error('unreadable') } })
    expect(filterBrowserEvent(hostile as ErrorEvent)).toBeNull()
    const event = browserEvent()
    Object.defineProperty(event, 'exception', { get: () => { throw new Error('unreadable') } })
    expect(filterBrowserEvent(event)).toBeNull()
  })
})

describe('addresses keep their path by route shape', () => {
  it.each([
    [`/${TEST_ADMIN_PATH}`, '/admin-area'],
    [`/${TEST_ADMIN_PATH}/courses/1?token=${TOKEN}`, '/admin-area'],
    [`/${TEST_ADMIN_PATH}-login`, '/admin-area'],
    [`${SITE}/${TEST_ADMIN_PATH}/courses#part`, `${SITE}/admin-area`],
    [`/api/${TEST_ADMIN_PATH}/courses`, '/api/admin-area'],
    [`/api/${TEST_ADMIN_PATH}-auth`, '/api/admin-area'],
    [`${SITE}/api/${TEST_ADMIN_PATH}-logout?x=1`, `${SITE}/api/admin-area`],
    [`api/${TEST_ADMIN_PATH}/x`, '/api/admin-area'],
    [`//${TEST_ADMIN_PATH}/x`, `//${TEST_ADMIN_PATH}/admin-area`],
    [`/%74est-admin-area/x`, '/admin-area'],
    [`/jobs/..%2F..%2F${TEST_ADMIN_PATH}/x`, '/admin-area'],
    [`/jobs/../${TEST_ADMIN_PATH}`, '/admin-area'],
    [`/jobs\\..\\${TEST_ADMIN_PATH}\\x`, '/admin-area'],
    ['/Jobs', '/admin-area'],
    [`https://user:pw@example.org/${TEST_ADMIN_PATH}?x=1`, 'https://example.org/admin-area'],
  ])('names private pages admin-area: %s', (raw, expected) => {
    expect(browserAddress(raw)).toBe(expected)
  })

  it.each([
    ['/', '/'],
    [`${SITE}/?token=${TOKEN}`, `${SITE}/`],
    [`/jobs/find-work/manage?token=${TOKEN}#x`, '/jobs/find-work/manage'],
    [`${SITE}/jobs/hire-talent/manage?token=${TOKEN}`, `${SITE}/jobs/hire-talent/manage`],
    [`/api/recruitment/fetch-brief?token=${TOKEN}`, '/api/recruitment/fetch-brief'],
    [`/api/jobs/manage?token=${TOKEN}`, '/api/jobs/manage'],
    ['/api', '/api'],
    ['/articles/how-to-file-vat', '/articles/how-to-file-vat'],
    ['/jobs/ada%40example.com/x', '/jobs/[removed]/x'],
    ['/articles/abcdefghij1234567890xyz', '/articles/[removed]'],
    [`/jobs/[slug]/${TOKEN}`, '/jobs/[slug]/[removed]'],
    ['/jobs/123456/x', '/jobs/[removed]/x'],
    ['/jobs/12345/x', '/jobs/12345/x'],
    ['/_next/static/chunks/app/jobs/page-1a2b.js?v=1', '/_next/static/chunks/app/jobs/page-1a2b.js'],
    ['/_next/static/chunks/app/layout-1a2b.js', '/_next/static/chunks/app/layout-1a2b.js'],
    ['/_next/static/chunks/main-app-1a2b.js', '/_next/static/chunks/main-app-1a2b.js'],
  ])('keeps public pages readable: %s', (raw, expected) => {
    expect(browserAddress(raw)).toBe(expected)
  })

  it('reads bundle files by the route folder they belong to', () => {
    expect(browserAddress(`/_next/static/chunks/app/${TEST_ADMIN_PATH}/page-1a2b.js`)).toBe('/_next/static/chunks/app/admin-area')
    expect(browserAddress(`/_next/static/chunks/app/(group)/${TEST_ADMIN_PATH}/layout.js`)).toBe('/_next/static/chunks/app/admin-area')
    expect(browserAddress(`webpack-internal:///(app-pages-browser)/./app/${TEST_ADMIN_PATH}/page.tsx`)).toBe(
      'webpack-internal:///(app-pages-browser)/app/admin-area',
    )
  })

  it('outside services keep their path without the query; other hosts are read by route shape', () => {
    expect(browserAddress('https://abc.api.sanity.io/v2021-10-21/data/query/production?query=*[slug=="x"]')).toBe(
      'https://abc.api.sanity.io/v2021-10-21/data/query/production',
    )
    expect(browserAddress('https://www.googletagmanager.com/gtag/js?id=G-123')).toBe('https://www.googletagmanager.com/gtag/js')
    expect(browserAddress('https://example.org/anything?x=1')).toBe('https://example.org/admin-area')
    expect(OUTSIDE_SERVICE_HOSTS).not.toContain('accountingbody.com')
  })

  it('keeps only the scheme of other address kinds', () => {
    expect(browserAddress(`mailto:${EMAIL}`)).toBe('mailto:[removed]')
    expect(browserAddress(`blob:${SITE}/1234-5678`)).toBe('blob:[removed]')
    expect(browserAddress('chrome-extension://abcdefghijklmnop/x.js')).toBe('chrome-extension:[removed]')
  })

  it('never fails on odd input', () => {
    for (const raw of [undefined, null, 42, {}, '', '%', '%E0%A4%A', 'http://[::1', '?', '#', ' '.repeat(10), 'x'.repeat(10000)]) {
      expect(() => browserAddress(raw)).not.toThrow()
    }
    expect(browserAddress(undefined)).toBe('[removed]')
    expect(browserAddress('http://[::1')).toBe('[removed]')
  })
})

describe('trail entries keep only what is needed', () => {
  const crumb = (value: Record<string, unknown>) => filterBrowserBreadcrumb(value as Breadcrumb)

  it('reduces page changes to addresses without query', () => {
    expect(crumb({ category: 'navigation', timestamp: 2, data: { from: `${SITE}/jobs?token=${TOKEN}`, to: `/${TEST_ADMIN_PATH}/x#y`, extra: 'x' } })).toEqual({
      category: 'navigation',
      timestamp: 2,
      data: { from: `${SITE}/jobs`, to: '/admin-area' },
    })
  })

  it.each(['fetch', 'xhr'])('keeps method, reduced address, status and sizes of %s calls only', (category) => {
    expect(
      crumb({
        category,
        type: 'http',
        level: 'warning',
        timestamp: 3,
        data: {
          method: 'post',
          url: `/api/jobs/manage?token=${TOKEN}`,
          status_code: 404,
          request_body_size: 10,
          response_body_size: 20,
          request_body: `{"email":"${EMAIL}"}`,
          response: { token: TOKEN },
        },
      }),
    ).toEqual({
      category,
      type: 'http',
      level: 'warning',
      timestamp: 3,
      data: { method: 'POST', url: '/api/jobs/manage', status_code: 404, request_body_size: 10, response_body_size: 20 },
    })
  })

  it('keeps console messages with personal parts replaced and without their arguments', () => {
    expect(
      crumb({ category: 'console', level: 'log', message: `saving ${EMAIL} with ${TOKEN} at /${TEST_ADMIN_PATH}/x`, data: { logger: 'console', arguments: [EMAIL, TOKEN] } }),
    ).toEqual({ category: 'console', level: 'log', message: 'saving [removed] with [removed] at /admin-area', data: { logger: 'console' } })
  })

  it('keeps clicked element descriptions with emails and code-like runs removed', () => {
    expect(
      crumb({
        category: 'ui.click',
        message: `body > div#main > button.save-button[title="Send to ${EMAIL}"][name="ref-${TOKEN}"]`,
        data: { 'ui.component_name': 'SaveButton' },
      }),
    ).toEqual({ category: 'ui.click', message: 'body > div#main > button.save-button[title="Send to [removed]"][name="[removed]"]' })
  })

  it('keeps only the kind, level and time of other entries', () => {
    expect(crumb({ category: 'sentry.event', level: 'error', timestamp: 4, event_id: 'e', message: `TypeError: ${EMAIL}` })).toEqual({
      category: 'sentry.event',
      level: 'error',
      timestamp: 4,
    })
    expect(crumb({ category: 'my category with spaces', message: EMAIL, timestamp: 5 })).toEqual({ timestamp: 5 })
  })

  it('leaves out an entry that cannot be read', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('unreadable') }, ownKeys: () => { throw new Error('unreadable') } })
    expect(crumb(hostile)).toBeNull()
    expect(filterBrowserBreadcrumb(null as unknown as Breadcrumb)).toBeNull()
    expect(filterBrowserBreadcrumb('text' as unknown as Breadcrumb)).toBeNull()
  })
})

function pageloadTransaction(): TransactionEvent {
  return {
    type: 'transaction',
    event_id: 't'.repeat(32),
    timestamp: 10,
    start_timestamp: 9,
    platform: 'javascript',
    transaction: `/${TEST_ADMIN_PATH}/courses/1`,
    transaction_info: { source: 'url' },
    request: { url: `${SITE}/${TEST_ADMIN_PATH}/courses/1?token=${TOKEN}`, headers: { 'User-Agent': 'Mozilla/5.0 Browser' } },
    user: { email: EMAIL },
    breadcrumbs: [{ category: 'console', message: EMAIL }],
    contexts: {
      trace: {
        trace_id: 'a'.repeat(32),
        span_id: 'b'.repeat(16),
        op: 'pageload',
        status: 'ok',
        origin: 'auto.pageload.nextjs.app_router_instrumentation',
        data: { 'sentry.source': 'url', 'lcp.url': `${SITE}/api/jobs/manage?token=${TOKEN}`, 'lcp.element': 'img#hero' },
      },
    },
    measurements: { lcp: { value: 1200, unit: 'millisecond' } },
    spans: [
      {
        span_id: 'c'.repeat(16),
        trace_id: 'a'.repeat(32),
        parent_span_id: 'b'.repeat(16),
        start_timestamp: 9.1,
        timestamp: 9.2,
        op: 'http.client',
        status: 'ok',
        origin: 'auto.http.browser',
        description: `GET ${SITE}/api/recruitment/fetch-brief?token=${TOKEN}`,
        data: {
          'url.full': `${SITE}/api/recruitment/fetch-brief?token=${TOKEN}`,
          'http.query': `?token=${TOKEN}`,
          'http.request.header.cookie': 'admin_token=session-value',
          'http.response.status_code': 200,
          'server.address': 'accountingbody.com',
          'url.same_origin': true,
        },
      },
      {
        span_id: 'd'.repeat(16),
        trace_id: 'a'.repeat(32),
        start_timestamp: 9.3,
        timestamp: 9.4,
        op: 'resource.script',
        description: `${SITE}/_next/static/chunks/app/${TEST_ADMIN_PATH}/courses/page-1a2b.js`,
        data: { 'http.response_content_length': 100 },
      },
    ],
    sdkProcessingMetadata: { dynamicSamplingContext: { trace_id: 'a'.repeat(32), transaction: `/${TEST_ADMIN_PATH}/courses/[id]` }, spanCountBeforeProcessing: 2 },
  } as unknown as TransactionEvent
}

describe('browser timings keep their path but never a query', () => {
  it('names private pages admin-area and keeps timings, operation and status', () => {
    const kept = filterBrowserTransaction(pageloadTransaction())
    expect(kept?.transaction).toBe('/admin-area')
    expect(kept?.transaction_info).toEqual({ source: 'url' })
    expect(kept?.request).toEqual({ url: `${SITE}/admin-area` })
    expect(kept?.contexts?.trace).toEqual({
      trace_id: 'a'.repeat(32),
      span_id: 'b'.repeat(16),
      op: 'pageload',
      status: 'ok',
      origin: 'auto.pageload.nextjs.app_router_instrumentation',
      data: { 'sentry.source': 'url', 'lcp.url': `${SITE}/api/jobs/manage`, 'lcp.element': 'img' },
    })
    expect(kept?.measurements).toEqual({ lcp: { value: 1200, unit: 'millisecond' } })
    expect(kept?.sdkProcessingMetadata).toEqual({ dynamicSamplingContext: { trace_id: 'a'.repeat(32), transaction: '/admin-area' }, spanCountBeforeProcessing: 2 })
  })

  it('cuts the query from span names and values and removes request details', () => {
    const [call, script] = filterBrowserTransaction(pageloadTransaction())?.spans ?? []
    expect(call).toEqual({
      span_id: 'c'.repeat(16),
      trace_id: 'a'.repeat(32),
      parent_span_id: 'b'.repeat(16),
      start_timestamp: 9.1,
      timestamp: 9.2,
      op: 'http.client',
      status: 'ok',
      origin: 'auto.http.browser',
      description: `GET ${SITE}/api/recruitment/fetch-brief`,
      data: {
        'url.full': `${SITE}/api/recruitment/fetch-brief`,
        'http.response.status_code': 200,
        'server.address': 'accountingbody.com',
        'url.same_origin': true,
      },
    })
    expect(script.description).toBe(`${SITE}/_next/static/chunks/app/admin-area`)
  })

  it('carries none of the request, visitor or private page values anywhere', () => {
    const text = JSON.stringify(filterBrowserTransaction(pageloadTransaction()))
    for (const value of [EMAIL, TEST_ADMIN_PATH, TOKEN, 'Mozilla', 'session-value', 'cookie', 'breadcrumbs']) expect(text).not.toContain(value)
  })

  it('reduces interaction timings sent on their own', () => {
    const span = {
      span_id: 'e'.repeat(16),
      trace_id: 'a'.repeat(32),
      start_timestamp: 1,
      timestamp: 2,
      op: 'ui.interaction.click',
      description: `body > button#save[title="${EMAIL}"]`,
      data: { transaction: `/${TEST_ADMIN_PATH}/courses/1`, 'user_agent.original': 'Mozilla/5.0 Browser', user: EMAIL, 'client.address': '{{auto}}', release: 'r1' },
      measurements: { inp: { value: 250, unit: 'millisecond' } },
    } as unknown as SpanJSON
    expect(filterBrowserSpan(span)).toEqual({
      span_id: 'e'.repeat(16),
      trace_id: 'a'.repeat(32),
      start_timestamp: 1,
      timestamp: 2,
      op: 'ui.interaction.click',
      description: 'body > button#save[title="[removed]"]',
      data: { transaction: '/admin-area', release: 'r1' },
      measurements: { inp: { value: 250, unit: 'millisecond' } },
    })
  })

  it('sends no timings when they cannot be read safely; a span keeps its timings only', () => {
    const transaction = pageloadTransaction()
    Object.defineProperty(transaction, 'spans', { get: () => { throw new Error('unreadable') } })
    expect(filterBrowserTransaction(transaction)).toBeNull()
    const span = { span_id: 's1', trace_id: 't1', start_timestamp: 1, timestamp: 2, description: `/${TEST_ADMIN_PATH}` } as SpanJSON
    Object.defineProperty(span, 'data', { get: () => { throw new Error('unreadable') } })
    expect(filterBrowserSpan(span)).toEqual({ span_id: 's1', trace_id: 't1', start_timestamp: 1, timestamp: 2, data: {} })
    const hostile = new Proxy({}, { get: () => { throw new Error('unreadable') } })
    expect(filterBrowserSpan(hostile as SpanJSON)).toEqual({ span_id: '', trace_id: '', start_timestamp: 0, data: {} })
  })
})

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const runtimeImports = (text: string) =>
  Array.from(text.matchAll(/^import\s+(type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm))
    .filter((match) => !match[1])
    .map((match) => match[2])

// The configured private area name, read at test time and never printed.
function realAreaName(): string {
  vi.stubEnv('ADMIN_PATH', undefined)
  const name = getAdminPath().toLowerCase()
  vi.unstubAllEnvs()
  return name
}

describe('the browser filter holds no private names', () => {
  const BROWSER_FILES = ['lib/sentry-browser-privacy.ts', 'lib/scrub-rules.ts', 'sentry.client.config.ts']

  it('imports only the shared text rules', () => {
    expect(runtimeImports(source('lib/sentry-browser-privacy.ts'))).toEqual(['./scrub-rules'])
    expect(source('lib/scrub-rules.ts')).not.toMatch(/^import\s/m)
    expect(runtimeImports(source('sentry.client.config.ts'))).toEqual(['@sentry/nextjs', './lib/sentry-browser-privacy'])
    for (const file of ['lib/sentry-browser-privacy.ts', 'lib/scrub-rules.ts']) {
      expect(source(file)).not.toMatch(/\brequire\(|\bimport\(|\bnode:|\bprocess\./)
    }
  })

  it.each(BROWSER_FILES)('%s does not read the configured area name', (file) => {
    const text = source(file)
    for (const word of ['getAdminPath', 'ADMIN_PATH', 'middleware-logic', "/sentry-privacy'"]) expect(text.includes(word)).toBe(false)
  })

  it.each(BROWSER_FILES)('%s does not contain the built-in area name', (file) => {
    const name = realAreaName()
    expect(name.length > 0).toBe(true)
    expect(source(file).toLowerCase().includes(name)).toBe(false)
  })

  it('names the built-in area admin-area by its shape alone', () => {
    const name = realAreaName()
    const results = [`/${name}/x`, `/${name}-login`, `/api/${name}/x`, `/api/${name}-auth`, `/api/${name}-logout`].map(browserAddress)
    expect(results.every((result) => result === '/admin-area' || result === '/api/admin-area')).toBe(true)
  })

  it('the browser bundle carries no list of page routes', () => {
    expect(source('next.config.mjs')).toContain('routeManifestInjection: false,')
  })
})

describe('the public section lists match the app folders', () => {
  const ROUTE_FILE = /^(page|route|default|opengraph-image|twitter-image|icon|apple-icon|sitemap)\.[a-z]+$/
  // URL segments of every tracked route file: route groups "(…)" and slots
  // "@…" are not part of the address; folders starting "_" are not routes.
  const routes = execFileSync('git', ['ls-files', '--', 'app'], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => ROUTE_FILE.test(file.split('/').pop() ?? ''))
    .map((file) => file.split('/').slice(1, -1))
    .filter((parts) => !parts.some((part) => part.startsWith('_')))
    .map((parts) => parts.filter((part) => !(part.startsWith('(') && part.endsWith(')')) && !part.startsWith('@')))

  const folders = (api: boolean) => {
    const found = new Set<string>()
    for (const parts of routes) {
      if (api && parts[0] === 'api' && parts[1]) found.add(parts[1])
      if (!api && parts[0] && parts[0] !== 'api') found.add(parts[0])
    }
    return Array.from(found).sort()
  }

  it.each([
    ['page', false, PUBLIC_PAGE_SEGMENTS],
    ['api', true, PUBLIC_API_SEGMENTS],
  ] as const)('every %s folder is listed except the private ones', (_kind, api, listed) => {
    const name = realAreaName()
    const all = folders(api)
    const privateFolders = all.filter((folder) => folder.toLowerCase().includes(name))
    expect(privateFolders.length > 0).toBe(true)
    expect([...listed].sort()).toEqual(all.filter((folder) => !folder.toLowerCase().includes(name)))
    expect(listed.some((folder) => folder.toLowerCase().includes(name))).toBe(false)
    const prefix = api ? '/api/' : '/'
    expect(privateFolders.map((folder) => browserAddress(`${prefix}${folder}/x`)).every((result) => result === `${prefix}admin-area`)).toBe(true)
  })

  it('home and the api root are not list entries', () => {
    expect(PUBLIC_PAGE_SEGMENTS).not.toContain('api')
    expect(PUBLIC_PAGE_SEGMENTS).not.toContain('')
  })
})

// The cores each runtime really loads, so the check uses the shipped matching rules.
const nodeRequire = createRequire(import.meta.url)
const coreOf = (pkg: string) => createRequire(nodeRequire.resolve(pkg))('@sentry/core') as {
  SDK_VERSION: string
  shouldPropagateTraceForUrl: (url: string | undefined, targets: unknown) => boolean
  stringMatchesSomePattern: (url: string, targets: unknown) => boolean
}
const browserEntry = createRequire(nodeRequire.resolve('@sentry/nextjs')).resolve('@sentry/browser')
const browserRequest = createRequire(browserEntry)('./tracing/request.js') as { shouldAttachHeaders: (url: string, targets: unknown) => boolean }

async function configOptions(file: string): Promise<Options> {
  inits.length = 0
  vi.resetModules()
  await import(/* @vite-ignore */ file)
  expect(inits).toHaveLength(1)
  return inits[0]
}

const OUTSIDE_URLS = [
  'https://project.supabase.co/rest/v1/jobs?select=*',
  'https://api.resend.com/emails',
  'https://api.stripe.com/v1/charges',
  'https://abc.api.sanity.io/v2021-10-21/data/query/production',
  'https://www.google-analytics.com/g/collect',
  'https://accountingbody.com.example.org/x',
]

describe('trace headers are not sent to outside services', () => {
  it.each([
    ['../sentry.server.config', '@sentry/node', ['dsn', 'tracesSampler', 'beforeSend', 'beforeSendTransaction', 'beforeSendSpan', 'tracePropagationTargets']],
    ['../sentry.edge.config', '@sentry/vercel-edge', ['dsn', 'tracesSampleRate', 'beforeSend', 'beforeSendTransaction', 'beforeSendSpan', 'tracePropagationTargets']],
  ])('%s adds trace headers to no outgoing request', async (file, pkg, keys) => {
    const options = await configOptions(file)
    expect(Object.keys(options)).toEqual(keys)
    expect(options.tracePropagationTargets).toEqual([])
    const core = coreOf(pkg)
    expect(core.SDK_VERSION).toBe('10.45.0')
    for (const url of [...OUTSIDE_URLS, 'https://accountingbody.com/api/jobs']) {
      expect(core.shouldPropagateTraceForUrl(url, options.tracePropagationTargets)).toBe(false)
      expect(core.stringMatchesSomePattern(url, options.tracePropagationTargets)).toBe(false)
    }
    // Without the setting every request would carry them.
    expect(core.shouldPropagateTraceForUrl(OUTSIDE_URLS[0], undefined)).toBe(true)
  })

  it('the browser keeps the same-origin-only default and uses all four filters', async () => {
    const options = await configOptions('../sentry.client.config')
    expect(Object.keys(options)).toEqual(['dsn', 'tracesSampleRate', 'beforeSend', 'beforeBreadcrumb', 'beforeSendTransaction', 'beforeSendSpan'])
    expect(options.tracesSampleRate).toBe(0.1)
    expect((options.beforeSend as Hook).name).toBe('filterBrowserEvent')
    expect((options.beforeBreadcrumb as Hook).name).toBe('filterBrowserBreadcrumb')
    expect((options.beforeSendTransaction as Hook).name).toBe('filterBrowserTransaction')
    expect((options.beforeSendSpan as Hook).name).toBe('filterBrowserSpan')
    expect(coreOf('@sentry/nextjs').SDK_VERSION).toBe('10.45.0')
    vi.stubGlobal('document', { location: { href: `${SITE}/jobs/find-work/manage` } })
    for (const url of OUTSIDE_URLS) expect(browserRequest.shouldAttachHeaders(url, options.tracePropagationTargets)).toBe(false)
    expect(browserRequest.shouldAttachHeaders('/api/jobs/manage', options.tracePropagationTargets)).toBe(true)
    expect(browserRequest.shouldAttachHeaders(`${SITE}/api/jobs/manage`, options.tracePropagationTargets)).toBe(true)
  })
})
