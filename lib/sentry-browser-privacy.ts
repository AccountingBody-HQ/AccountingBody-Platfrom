// Keeps every Sentry event sent from the browser to what is needed to fix a
// problem.
//
// - Addresses keep their origin and path, never a query string or fragment.
// - Pages outside the public sections are written "admin-area": a page whose
//   first path segment is not in PUBLIC_PAGE_SEGMENTS becomes
//   "<origin>/admin-area", and an /api/ address whose second segment is not in
//   PUBLIC_API_SEGMENTS becomes "<origin>/api/admin-area". Recognition is by
//   the shape of the address only, so a new public section shows as
//   admin-area until it is added to the list.
// - Emails and code-like runs are replaced; headers, cookies, the visitor and
//   free-text extras are left out.
//
// This file ships in the public browser bundle: it holds no private names and
// imports only ./scrub-rules. Problem reports and timings that cannot be read
// safely are not sent; a trail entry that cannot be read is left out; a span
// that cannot be read keeps its timings only, because Sentry keeps the original
// span when that hook returns null.

import type * as Sentry from '@sentry/nextjs'
import type { ErrorEvent, Event } from '@sentry/nextjs'
import { ADMIN_AREA, REMOVED, SCAN_LENGTH, replaceSecretNameParts, replaceSecretText, withoutQuery } from './scrub-rules'

type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>
type SpanJSON = Parameters<NonNullable<InitOptions['beforeSendSpan']>>[0]
type TransactionEvent = Parameters<NonNullable<InitOptions['beforeSendTransaction']>>[0]
type Breadcrumb = Parameters<NonNullable<InitOptions['beforeBreadcrumb']>>[0]

// First path segments of public pages (the home page has none).
export const PUBLIC_PAGE_SEGMENTS: readonly string[] = [
  'about',
  'about-ethiotax',
  'accessibility',
  'articles',
  'calculators',
  'contact',
  'cookie-policy',
  'dashboard',
  'dictionary',
  'disclaimer',
  'et-sitemap',
  'ethiotax-og',
  'faq',
  'firms-freelancers',
  'free-courses',
  'freelancing-pathways',
  'get-help',
  'global-payroll',
  'glossary',
  'how-it-works',
  'jobs',
  'mock-exams',
  'practice-questions',
  'privacy-policy',
  'search',
  'sign-in',
  'sign-up',
  'sitemap.xml',
  'sitemaps',
  'studio',
  'study',
  'terms',
  'wa',
]

// Second path segments of public /api/ addresses.
export const PUBLIC_API_SEGMENTS: readonly string[] = [
  'careerjet',
  'confirm-subscription',
  'contact',
  'cron',
  'eticpa',
  'firms-application',
  'health',
  'help-request',
  'ingest',
  'jobs',
  'mock-exam',
  'ops-status',
  'recruitment',
  'saved-jobs',
  'search',
  'subscribe',
  'version',
]

// Outside services the pages call (from the site's content security policy).
// Their paths keep their shape; every other host is read like our own pages.
export const OUTSIDE_SERVICE_HOSTS: readonly string[] = [
  'sanity.io',
  'google-analytics.com',
  'googletagmanager.com',
  'clerk.accounts.dev',
  'clerk.accountingbody.com',
  'img.clerk.com',
  'sentry.io',
  'sentry-cdn.com',
  'challenges.cloudflare.com',
  'googlesyndication.com',
  'doubleclick.net',
  'adtrafficquality.google',
  'googleapis.com',
  'gstatic.com',
]

const PUBLIC_PAGES = new Set(PUBLIC_PAGE_SEGMENTS)
const PUBLIC_API = new Set(PUBLIC_API_SEGMENTS)

const MESSAGE_LENGTH = 120
const CRUMB_LENGTH = 200
const NAME_LENGTH = 300
const TAG_LENGTH = 200
const MAX_ENTRIES = 50
const MAX_FRAMES = 100
const MAX_SPANS = 1000
const MAX_BREADCRUMBS = 100

const PLACEHOLDER_ORIGIN = 'https://relative.invalid'
const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const CODE_SCHEMES = ['app:', 'webpack:', 'webpack-internal:']
// Code folders whose next segment is a route folder.
const CODE_ROOTS = ['app', 'pages']
const CODE_FILE_NAMES = ['page', 'layout', 'loading', 'error', 'global-error', 'not-found', 'template', 'default', 'route']
// An address inside longer text: a URL, or a path that starts with "/".
const EMBEDDED_ADDRESS = /(^|[\s'"`(=,;[{])((?:[a-z][a-z0-9+.-]*:\/\/|\/)[^\s'"`<>(){}]*)/gi
// A bundle chunk name such as "app/jobs/page".
const EMBEDDED_CHUNK = /(^|[\s'"`(=,;[{])((?:app|pages)\/[^\s'"`<>(){}]*)/g
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,40}$/
const SAFE_KEY = /^[A-Za-z0-9_.:-]{1,64}$/
const TRACE_ID = /^[0-9a-f]{16,32}$/i
const HTTP_METHOD = /^[A-Za-z]{1,10}$/
const LEVELS = ['fatal', 'error', 'warning', 'log', 'info', 'debug']
// Span values under these names hold request or visitor details, not timings.
const PRIVATE_DATA_KEY =
  /(^|[._])(query|fragment|body|headers?|cookies?|user|user_agent|email|password|token|secret|auth|authorization|ip|client_ip|params?|search)([._]|$)|^client\.address/i

type Plain = Record<string, unknown>

function isPlain(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function shortString(value: unknown, limit = 64): string | undefined {
  return typeof value === 'string' && value.length <= limit ? value : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function compact<T extends Plain>(value: T): T {
  for (const key of Object.keys(value)) if (value[key] === undefined) delete value[key]
  return value
}

function gentle(text: string, limit = NAME_LENGTH): string {
  return replaceSecretNameParts(text.slice(0, SCAN_LENGTH)).slice(0, limit)
}

// ── Addresses ───────────────────────────────────────────────────────────────

// Path segments the way the router reads them: backslashes as slashes, empty
// and "." segments dropped, ".." resolved.
function tidySegments(path: string): string[] {
  const segments: string[] = []
  for (const segment of path.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return segments
}

function privatePageLabel(segments: string[]): string | null {
  if (segments.length === 0) return null
  if (segments[0] === 'api') {
    return segments.length === 1 || PUBLIC_API.has(segments[1]) ? null : `/api/${ADMIN_AREA}`
  }
  return PUBLIC_PAGES.has(segments[0]) ? null : `/${ADMIN_AREA}`
}

function isRouteGroup(segment: string): boolean {
  return (segment.startsWith('(') && segment.endsWith(')')) || segment.startsWith('@')
}

function isCodeFileName(segment: string): boolean {
  return segment.includes('.') || CODE_FILE_NAMES.includes(segment)
}

// Bundle files are named after their route folder (".../app/<route>/page-x.js").
function privateCodeLabel(segments: string[]): string | null {
  const root = segments.findIndex((segment) => CODE_ROOTS.includes(segment))
  if (root < 0) return null
  const route = segments.slice(root + 1).filter((segment) => !isRouteGroup(segment))
  if (route.length === 0 || (route.length === 1 && isCodeFileName(route[0]))) return null
  if (PUBLIC_PAGES.has(route[0])) return null
  return `/${[...segments.slice(0, root + 1), ADMIN_AREA].join('/')}`
}

function isOutsideService(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return OUTSIDE_SERVICE_HOSTS.some((service) => host === service || host.endsWith(`.${service}`))
}

function isCodePath(segments: string[]): boolean {
  return segments[0] === '_next'
}

// The path of a page, API call or bundle file, reduced by route shape.
function routePath(pathname: string, code: boolean): string {
  const raw = tidySegments(pathname)
  const decoded = tidySegments(withoutQuery(pathname))
  const asCode = code || isCodePath(raw) || isCodePath(decoded)
  const label = asCode
    ? (privateCodeLabel(raw) ?? privateCodeLabel(decoded))
    : (privatePageLabel(raw) ?? privatePageLabel(decoded))
  if (label) return gentle(label)
  return gentle(`/${decoded.join('/')}`)
}

function pathFor(pathname: string, hostname: string | null): string {
  if (hostname && isOutsideService(hostname)) return gentle(`/${tidySegments(withoutQuery(pathname)).join('/')}`)
  return routePath(pathname, false)
}

// An address with its origin (when it has one) and its reduced path; never a
// query string, fragment, user name or password.
export function browserAddress(raw: unknown): string {
  try {
    if (typeof raw !== 'string') return REMOVED
    const text = raw.trim().slice(0, SCAN_LENGTH * 2)
    if (SCHEME.test(text)) {
      const url = new URL(text)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return `${url.protocol}//${gentle(url.host)}${pathFor(url.pathname, url.hostname)}`
      }
      if (CODE_SCHEMES.includes(url.protocol)) {
        return `${url.protocol}//${gentle(url.host)}${routePath(url.pathname, true)}`
      }
      return `${url.protocol}${REMOVED}`
    }
    const url = new URL(text.startsWith('/') ? text : `/${text}`, PLACEHOLDER_ORIGIN)
    if (url.origin !== PLACEHOLDER_ORIGIN) return `//${gentle(url.host)}${pathFor(url.pathname, url.hostname)}`
    return pathFor(url.pathname, null)
  } catch {
    return REMOVED
  }
}

function chunkName(chunk: string): string {
  const segments = tidySegments(withoutQuery(chunk))
  return gentle((privateCodeLabel(segments) ?? `/${segments.join('/')}`).slice(1))
}

// Addresses and chunk names inside longer text, each reduced as above.
function replaceAddresses(text: string): string {
  return text
    .replace(EMBEDDED_ADDRESS, (_match, lead: string, address: string) => `${lead}${browserAddress(address)}`)
    .replace(EMBEDDED_CHUNK, (_match, lead: string, chunk: string) => `${lead}${chunkName(chunk)}`)
}

// ── Text ────────────────────────────────────────────────────────────────────

// Messages: addresses reduced, then personal or secret-looking parts replaced.
function messageText(text: string, limit = MESSAGE_LENGTH): string {
  return replaceSecretText(replaceAddresses(text.slice(0, SCAN_LENGTH))).slice(0, limit)
}

// Names (routes, span names, functions): no query, addresses reduced, readable.
function nameText(text: string, limit = NAME_LENGTH): string {
  return gentle(replaceAddresses(withoutQuery(text.slice(0, SCAN_LENGTH))), limit)
}

// Element descriptions such as "div#main > button.save": "#" stays.
function selectorText(text: string, limit = NAME_LENGTH): string {
  return gentle(replaceAddresses(text.slice(0, SCAN_LENGTH)), limit)
}

function codeFile(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (SCHEME.test(value) || value.startsWith('/')) return browserAddress(value)
  return nameText(value)
}

function optionalName(value: unknown, limit = NAME_LENGTH): string | undefined {
  return typeof value === 'string' ? nameText(value, limit) : undefined
}

// ── Trail (breadcrumbs) ─────────────────────────────────────────────────────

function optionalAddress(value: unknown): string | undefined {
  return typeof value === 'string' ? browserAddress(value) : undefined
}

function keepBreadcrumb(breadcrumb: unknown): Breadcrumb | null {
  if (!isPlain(breadcrumb)) return null
  const category = typeof breadcrumb.category === 'string' && SAFE_KEY.test(breadcrumb.category) ? breadcrumb.category : undefined
  const base: Plain = compact({
    category,
    level: LEVELS.includes(breadcrumb.level as string) ? breadcrumb.level : undefined,
    timestamp: finiteNumber(breadcrumb.timestamp),
  })
  const data = isPlain(breadcrumb.data) ? breadcrumb.data : {}
  if (category === 'navigation') {
    return compact({ ...base, data: compact({ from: optionalAddress(data.from), to: optionalAddress(data.to) }) }) as Breadcrumb
  }
  if (category === 'fetch' || category === 'xhr') {
    return compact({
      ...base,
      type: breadcrumb.type === 'http' ? 'http' : undefined,
      data: compact({
        method: typeof data.method === 'string' && HTTP_METHOD.test(data.method) ? data.method.toUpperCase() : undefined,
        url: optionalAddress(data.url),
        status_code: finiteNumber(data.status_code),
        request_body_size: finiteNumber(data.request_body_size),
        response_body_size: finiteNumber(data.response_body_size),
      }),
    }) as Breadcrumb
  }
  if (category === 'console') {
    return compact({
      ...base,
      message: typeof breadcrumb.message === 'string' ? messageText(breadcrumb.message, CRUMB_LENGTH) : undefined,
      data: data.logger === 'console' ? { logger: 'console' } : undefined,
    }) as Breadcrumb
  }
  if (category?.startsWith('ui.')) {
    return compact({
      ...base,
      message: typeof breadcrumb.message === 'string' ? selectorText(breadcrumb.message, CRUMB_LENGTH) : undefined,
    }) as Breadcrumb
  }
  return base as Breadcrumb
}

export function filterBrowserBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  try {
    return keepBreadcrumb(breadcrumb)
  } catch {
    return null
  }
}

function safeBreadcrumbs(breadcrumbs: unknown): Breadcrumb[] | undefined {
  if (!Array.isArray(breadcrumbs)) return undefined
  return breadcrumbs
    .slice(-MAX_BREADCRUMBS)
    .map((breadcrumb) => filterBrowserBreadcrumb(breadcrumb as Breadcrumb))
    .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
}

// ── Shared pieces ───────────────────────────────────────────────────────────

// The envelope header copy of the trace details; only the route name can
// carry page details, and it is written the same way as the event's.
function safeMetadata(metadata: unknown): Plain {
  const out: Plain = {}
  if (!isPlain(metadata)) return out
  const dsc = metadata.dynamicSamplingContext
  if (isPlain(dsc)) {
    const kept: Plain = {}
    for (const key of ['trace_id', 'public_key', 'sample_rate', 'sampled', 'release', 'environment', 'sample_rand', 'org_id']) {
      const value = dsc[key]
      if (typeof value === 'string' && value.length <= 200) kept[key] = value
    }
    if (typeof dsc.transaction === 'string') kept.transaction = nameText(dsc.transaction, TAG_LENGTH)
    out.dynamicSamplingContext = kept
  }
  const spanCount = finiteNumber(metadata.spanCountBeforeProcessing)
  if (spanCount !== undefined) out.spanCountBeforeProcessing = spanCount
  return out
}

function safeRequest(request: unknown): { url: string } | undefined {
  if (!isPlain(request) || typeof request.url !== 'string') return undefined
  return { url: browserAddress(request.url) }
}

function safeTags(tags: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!isPlain(tags)) return out
  for (const key of Object.keys(tags).slice(0, MAX_ENTRIES)) {
    if (!SAFE_KEY.test(key)) continue
    const value = tags[key]
    if (typeof value === 'string') out[key] = messageText(value, TAG_LENGTH)
    else if (typeof value === 'boolean' || finiteNumber(value) !== undefined) out[key] = value as number | boolean
  }
  return out
}

// Numbers and yes/no values only: text extras can hold what a visitor typed.
function safeExtra(extra: unknown): Plain {
  const out: Plain = {}
  if (!isPlain(extra)) return out
  for (const key of Object.keys(extra).slice(0, MAX_ENTRIES)) {
    if (!SAFE_KEY.test(key)) continue
    const value = extra[key]
    if (typeof value === 'boolean' || finiteNumber(value) !== undefined) out[key] = value
  }
  return out
}

function nameAndVersion(context: unknown): Plain | undefined {
  if (!isPlain(context)) return undefined
  const out = compact({ name: shortString(context.name), version: shortString(context.version) })
  return Object.keys(out).length > 0 ? out : undefined
}

function traceIds(context: unknown): Plain {
  if (!isPlain(context)) return {}
  const id = (value: unknown) => (typeof value === 'string' && TRACE_ID.test(value) ? value : undefined)
  return compact({ trace_id: id(context.trace_id), span_id: id(context.span_id), parent_span_id: id(context.parent_span_id) })
}

function safeContexts(contexts: unknown, trace: Plain): Plain {
  const out: Plain = {}
  if (!isPlain(contexts)) return out
  const browser = nameAndVersion(contexts.browser)
  const os = nameAndVersion(contexts.os)
  const family = isPlain(contexts.device) ? shortString(contexts.device.family) : undefined
  if (browser) out.browser = browser
  if (os) out.os = os
  if (family) out.device = { family }
  if (Object.keys(trace).length > 0) out.trace = trace
  return out
}

// ── Problem reports ─────────────────────────────────────────────────────────

function safeFrames(stacktrace: unknown): { frames: Plain[] } | undefined {
  if (!isPlain(stacktrace) || !Array.isArray(stacktrace.frames)) return undefined
  const frames = stacktrace.frames.slice(-MAX_FRAMES).filter(isPlain).map((frame) =>
    compact({
      filename: codeFile(frame.filename),
      abs_path: codeFile(frame.abs_path),
      module: optionalName(frame.module),
      function: optionalName(frame.function),
      lineno: finiteNumber(frame.lineno),
      colno: finiteNumber(frame.colno),
      in_app: typeof frame.in_app === 'boolean' ? frame.in_app : undefined,
    }),
  )
  return { frames }
}

function safeMechanism(mechanism: unknown): Plain | undefined {
  if (!isPlain(mechanism)) return undefined
  return compact({
    type: typeof mechanism.type === 'string' ? nameText(mechanism.type, 100) : undefined,
    handled: typeof mechanism.handled === 'boolean' ? mechanism.handled : undefined,
    synthetic: typeof mechanism.synthetic === 'boolean' ? mechanism.synthetic : undefined,
    is_exception_group: typeof mechanism.is_exception_group === 'boolean' ? mechanism.is_exception_group : undefined,
    exception_id: finiteNumber(mechanism.exception_id),
    parent_id: finiteNumber(mechanism.parent_id),
    source: typeof mechanism.source === 'string' && SAFE_KEY.test(mechanism.source) ? mechanism.source : undefined,
  })
}

function safeException(exception: unknown): { values: Plain[] } | undefined {
  if (!isPlain(exception) || !Array.isArray(exception.values)) return undefined
  const values = exception.values.slice(0, MAX_ENTRIES).filter(isPlain).map((value) =>
    compact({
      type: typeof value.type === 'string' ? (ERROR_NAME.test(value.type) ? value.type : messageText(value.type, 80)) : undefined,
      value: typeof value.value === 'string' ? messageText(value.value) : undefined,
      mechanism: safeMechanism(value.mechanism),
      stacktrace: safeFrames(value.stacktrace),
    }),
  )
  return { values }
}

function safeDebugMeta(debugMeta: unknown): Plain | undefined {
  if (!isPlain(debugMeta) || !Array.isArray(debugMeta.images)) return undefined
  const images = debugMeta.images.slice(0, MAX_FRAMES).filter(isPlain).map((image) =>
    compact({
      type: shortString(image.type),
      debug_id: shortString(image.debug_id, 100),
      code_file: codeFile(image.code_file),
    }),
  )
  return images.length > 0 ? { images } : undefined
}

function keepEvent(event: Event): Event {
  const logMessage = isPlain(event.logentry) && typeof event.logentry.message === 'string' ? event.logentry.message : undefined
  const message = typeof event.message === 'string' ? event.message : logMessage
  return compact({
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: LEVELS.includes(event.level as string) ? event.level : undefined,
    environment: event.environment,
    release: event.release,
    dist: event.dist,
    sdk: event.sdk,
    fingerprint: Array.isArray(event.fingerprint)
      ? event.fingerprint.filter((part): part is string => typeof part === 'string').map((part) => messageText(part, TAG_LENGTH))
      : undefined,
    message: message === undefined ? undefined : messageText(message),
    exception: safeException(event.exception),
    tags: safeTags(event.tags),
    extra: safeExtra(event.extra),
    contexts: safeContexts(event.contexts, traceIds(event.contexts?.trace)),
    request: safeRequest(event.request),
    transaction: optionalName(event.transaction, TAG_LENGTH),
    breadcrumbs: safeBreadcrumbs(event.breadcrumbs),
    debug_meta: safeDebugMeta(event.debug_meta),
    sdkProcessingMetadata: safeMetadata(event.sdkProcessingMetadata),
  }) as Event
}

export function filterBrowserEvent(event: ErrorEvent): ErrorEvent | null {
  try {
    return keepEvent(event) as ErrorEvent
  } catch {
    return null
  }
}

// Passes problem reports through `filter`, then lets at most `max` of them
// through for as long as this limiter lives (the client config makes one per
// page load). Reports the filter drops are not counted. Timings use other
// hooks and are not counted.
export function limitEvents(
  filter: (event: ErrorEvent) => ErrorEvent | null,
  max: number
): (event: ErrorEvent) => ErrorEvent | null {
  let sent = 0
  return function limitedBrowserEvent(event: ErrorEvent): ErrorEvent | null {
    const kept = filter(event)
    if (kept === null) return null
    if (sent >= max) return null
    sent += 1
    return kept
  }
}

// ── Timings ─────────────────────────────────────────────────────────────────

type DataValue = string | number | boolean | Array<string | number | boolean>

function safeSpanData(data: unknown): Record<string, DataValue> {
  const out: Record<string, DataValue> = {}
  if (!isPlain(data)) return out
  const clean = (value: unknown): string | number | boolean | undefined => {
    if (typeof value === 'string') return nameText(value)
    if (typeof value === 'boolean' || finiteNumber(value) !== undefined) return value as number | boolean
    return undefined
  }
  for (const key of Object.keys(data).slice(0, 100)) {
    if (!SAFE_KEY.test(key) || PRIVATE_DATA_KEY.test(key)) continue
    const value = data[key]
    if (Array.isArray(value)) {
      out[key] = value.slice(0, MAX_ENTRIES).map(clean).filter((item): item is string | number | boolean => item !== undefined)
    } else {
      const item = clean(value)
      if (item !== undefined) out[key] = item
    }
  }
  return out
}

function safeMeasurements(measurements: unknown): Plain | undefined {
  if (!isPlain(measurements)) return undefined
  const out: Plain = {}
  for (const key of Object.keys(measurements).slice(0, MAX_ENTRIES)) {
    const entry = measurements[key]
    if (SAFE_KEY.test(key) && isPlain(entry) && finiteNumber(entry.value) !== undefined) {
      out[key] = compact({ value: entry.value, unit: shortString(entry.unit) })
    }
  }
  return out
}

function spanDescription(op: unknown, description: unknown): string | undefined {
  if (typeof description !== 'string') return undefined
  return typeof op === 'string' && op.startsWith('ui.') ? selectorText(description) : nameText(description)
}

function scrubSpan(span: SpanJSON): SpanJSON {
  return compact({
    span_id: span.span_id,
    trace_id: span.trace_id,
    parent_span_id: span.parent_span_id,
    start_timestamp: span.start_timestamp,
    timestamp: span.timestamp,
    op: optionalName(span.op, 100),
    status: shortString(span.status),
    origin: shortString(span.origin, 100) as SpanJSON['origin'],
    description: spanDescription(span.op, span.description),
    data: safeSpanData(span.data),
    measurements: safeMeasurements(span.measurements) as SpanJSON['measurements'],
    exclusive_time: finiteNumber(span.exclusive_time),
    is_segment: typeof span.is_segment === 'boolean' ? span.is_segment : undefined,
    segment_id: shortString(span.segment_id),
  }) as SpanJSON
}

function minimalSpan(span: SpanJSON): SpanJSON {
  try {
    return compact({
      span_id: String(span.span_id),
      trace_id: String(span.trace_id),
      start_timestamp: finiteNumber(span.start_timestamp) ?? 0,
      timestamp: finiteNumber(span.timestamp),
      data: {},
    }) as SpanJSON
  } catch {
    return { span_id: '', trace_id: '', start_timestamp: 0, data: {} }
  }
}

export function filterBrowserSpan(span: SpanJSON): SpanJSON {
  try {
    return scrubSpan(span)
  } catch {
    return minimalSpan(span)
  }
}

function safeTraceContext(context: unknown): Plain {
  if (!isPlain(context)) return {}
  return compact({
    ...traceIds(context),
    op: optionalName(context.op, 100),
    status: shortString(context.status),
    origin: shortString(context.origin, 100),
    data: safeSpanData(context.data),
  })
}

export function filterBrowserTransaction(event: TransactionEvent): TransactionEvent | null {
  try {
    const source = event.transaction_info?.source
    return compact({
      type: event.type,
      event_id: event.event_id,
      timestamp: event.timestamp,
      start_timestamp: event.start_timestamp,
      platform: event.platform,
      environment: event.environment,
      release: event.release,
      dist: event.dist,
      sdk: event.sdk,
      transaction: optionalName(event.transaction, TAG_LENGTH),
      transaction_info: typeof source === 'string' ? { source } : undefined,
      tags: safeTags(event.tags),
      extra: safeExtra(event.extra),
      contexts: safeContexts(event.contexts, safeTraceContext(event.contexts?.trace)),
      request: safeRequest(event.request),
      spans: Array.isArray(event.spans) ? event.spans.slice(0, MAX_SPANS).map(scrubSpan) : undefined,
      measurements: safeMeasurements(event.measurements),
      sdkProcessingMetadata: safeMetadata(event.sdkProcessingMetadata),
    }) as TransactionEvent
  } catch {
    return null
  }
}
