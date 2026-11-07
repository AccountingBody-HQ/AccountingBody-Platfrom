// Keeps every Sentry event sent from the server and edge runtimes to what is
// needed to fix a problem.
//
// filterServerEvent (beforeSend) — problem reports:
// - reports from reportServerError keep exactly the fields that helper sets
//   (keepReportFields);
// - every other report keeps the error type, a shortened message with
//   personal or secret-looking parts replaced, stack frames without source
//   lines, tags, numeric extras, the runtime and the page method + path.
// filterServerTransaction (beforeSendTransaction) and filterServerSpan
// (beforeSendSpan) — timings: names, span descriptions and span values keep
// their page path but never a query string; database statements are removed.
//
// Names of the private admin area are written as "admin-area" (or
// "[removed]" inside messages). At most REPORTS_PER_HOUR problem reports leave
// each running instance per rolling hour; the number held back travels on the
// next report as held_back_total.
//
// No runtime imports apart from ./middleware-logic, so this file runs in the
// edge runtime as well as on the server. Each filter returns null (the event
// is not sent) if it fails; the span filter returns a minimal span instead,
// because Sentry keeps the original span when that hook returns null.

import type * as Sentry from '@sentry/nextjs'
import type { ErrorEvent, Event, EventHint } from '@sentry/nextjs'
import { getAdminPath } from './middleware-logic'

type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>
type SpanJSON = Parameters<NonNullable<InitOptions['beforeSendSpan']>>[0]
type TransactionEvent = Parameters<NonNullable<InitOptions['beforeSendTransaction']>>[0]

export const REPORTS_PER_HOUR = 30
export const REPORT_HOUR_MS = 60 * 60 * 1000

const REMOVED = '[removed]'
const ADMIN_AREA = 'admin-area'
const MESSAGE_LENGTH = 120
const NAME_LENGTH = 300
const TAG_LENGTH = 200
const SCAN_LENGTH = 2000
const MAX_ENTRIES = 50
const MAX_FRAMES = 100
const MAX_SPANS = 1000

const EMAIL = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+/g
// In paths an address ends at "/", so the rest of the path stays readable.
const EMAIL_IN_NAME = /[^\s@<>()[\]"',;:/]+@[^\s@<>()[\]"',;:/]+/g
const LONG_TOKEN = /[A-Za-z0-9_-]{20,}/g
const LONG_DIGITS = /\d{6,}/g
const QUERY_OR_FRAGMENT = /[?#][^\s]*/g
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,40}$/
const SAFE_KEY = /^[A-Za-z0-9_.:-]{1,64}$/
const TRACE_ID = /^[0-9a-f]{16,32}$/i
const HTTP_METHOD = /^[A-Za-z]{1,10}$/
const LEVELS = ['fatal', 'error', 'warning', 'log', 'info', 'debug']
// Span values under these names hold request details, not timings.
const PRIVATE_DATA_KEY =
  /(^|[._])(query|fragment|statement|body|headers?|cookies?|user|user_agent|email|password|token|secret|auth|authorization|ip|client_ip|peer|params?|search)([._]|$)|^db\.query|^client\.address/i

type Plain = Record<string, unknown>

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function adminPattern(): RegExp | null {
  const name = getAdminPath()
  return name ? new RegExp(escapeRegExp(name), 'gi') : null
}

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

// ── Text rules ──────────────────────────────────────────────────────────────

// Replaces personal or secret-looking parts, then cuts to `limit` characters.
export function scrubText(text: string, limit = MESSAGE_LENGTH): string {
  let out = text.slice(0, SCAN_LENGTH)
  const privateArea = getAdminPath()
  if (privateArea) out = out.replace(new RegExp(escapeRegExp(privateArea), 'gi'), REMOVED)
  out = out.replace(EMAIL, REMOVED).replace(LONG_TOKEN, REMOVED).replace(LONG_DIGITS, REMOVED)
  return out.slice(0, limit)
}

// For names that must stay readable (file paths, function names, routes):
// long runs are removed only when they contain a digit or are very long, so
// ordinary code names survive while random codes do not.
export function scrubName(text: string, limit = NAME_LENGTH): string {
  let out = text.slice(0, SCAN_LENGTH)
  const admin = adminPattern()
  if (admin) out = out.replace(admin, ADMIN_AREA)
  out = out
    .replace(EMAIL_IN_NAME, REMOVED)
    .replace(LONG_TOKEN, (run) => (/\d/.test(run) || run.length >= 40 ? REMOVED : run))
    .replace(LONG_DIGITS, REMOVED)
  return out.slice(0, limit)
}

function decode(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

// A path or URL-like text without its query string or fragment.
export function scrubPath(text: string, limit = NAME_LENGTH): string {
  const withoutQuery = text.slice(0, SCAN_LENGTH * 2).replace(QUERY_OR_FRAGMENT, '')
  return scrubName(decode(withoutQuery).replace(QUERY_OR_FRAGMENT, ''), limit)
}

// "https://host/path" only: no query, fragment, user name or password.
export function pageAddress(raw: string): string {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${scrubName(url.host)}${scrubPath(url.pathname)}`
  } catch {
    return scrubPath(raw)
  }
}

// ── Helper reports ──────────────────────────────────────────────────────────

const helperReports = new WeakSet<object>()

// reportServerError marks the Error it builds, so its report is recognised
// without adding anything to the event.
export function markHelperReport(error: Error): void {
  helperReports.add(error)
}

function isHelperReport(hint: EventHint | undefined): boolean {
  const original = hint?.originalException
  return typeof original === 'object' && original !== null && helperReports.has(original)
}

const TAG_KEYS = ['area', 'label'] as const
const EXTRA_KEYS = ['error_code', 'code', 'held_back'] as const

function pick(source: Record<string, unknown> | undefined, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!source) return out
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key]
  return out
}

// Keeps only the fields reportServerError sets plus Sentry's own bookkeeping.
export function keepReportFields(event: Event): Event {
  const values = (event.exception?.values ?? []).map((value) => ({
    type: value.type,
    value: value.value,
    mechanism: value.mechanism,
  }))
  const trace = event.contexts?.trace
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    environment: event.environment,
    release: event.release,
    dist: event.dist,
    sdk: event.sdk,
    fingerprint: event.fingerprint,
    exception: { values },
    tags: pick(event.tags, TAG_KEYS) as Event['tags'],
    extra: pick(event.extra, EXTRA_KEYS),
    contexts: {
      ...(event.contexts?.runtime ? { runtime: event.contexts.runtime } : {}),
      ...(trace ? { trace: { trace_id: trace.trace_id, span_id: trace.span_id } } : {}),
    },
    sdkProcessingMetadata: {},
  }
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
    if (typeof dsc.transaction === 'string') kept.transaction = scrubPath(dsc.transaction, TAG_LENGTH)
    out.dynamicSamplingContext = kept
  }
  const spanCount = finiteNumber(metadata.spanCountBeforeProcessing)
  if (spanCount !== undefined) out.spanCountBeforeProcessing = spanCount
  return out
}

function safeRequest(request: unknown): { method?: string; url?: string } | undefined {
  if (!isPlain(request)) return undefined
  const out = compact({
    method: typeof request.method === 'string' && HTTP_METHOD.test(request.method) ? request.method.toUpperCase() : undefined,
    url: typeof request.url === 'string' ? pageAddress(request.url) : undefined,
  })
  return Object.keys(out).length > 0 ? out : undefined
}

function routeName(transaction: unknown, request: { method?: string; url?: string } | undefined): string | undefined {
  if (typeof transaction === 'string' && transaction) return scrubPath(transaction, TAG_LENGTH)
  if (!request?.url) return undefined
  let path = request.url
  try {
    path = new URL(request.url).pathname
  } catch {
    // keep the reduced address
  }
  return request.method ? `${request.method} ${path}` : path
}

function safeTags(tags: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!isPlain(tags)) return out
  for (const key of Object.keys(tags).slice(0, MAX_ENTRIES)) {
    if (!SAFE_KEY.test(key)) continue
    const value = tags[key]
    if (typeof value === 'string') out[key] = scrubText(value, TAG_LENGTH)
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

function safeRuntime(context: unknown): Plain | undefined {
  if (!isPlain(context)) return undefined
  return compact({ name: shortString(context.name), version: shortString(context.version) })
}

function safeOs(context: unknown): Plain | undefined {
  if (!isPlain(context)) return undefined
  return compact({
    name: shortString(context.name),
    version: shortString(context.version),
    kernel_version: shortString(context.kernel_version, 200),
    build: shortString(context.build),
  })
}

function traceIds(context: unknown): Plain {
  if (!isPlain(context)) return {}
  const id = (value: unknown) => (typeof value === 'string' && TRACE_ID.test(value) ? value : undefined)
  return compact({ trace_id: id(context.trace_id), span_id: id(context.span_id), parent_span_id: id(context.parent_span_id) })
}

function safeContexts(contexts: unknown, trace: Plain | undefined): Plain {
  const out: Plain = {}
  if (!isPlain(contexts)) return out
  const runtime = safeRuntime(contexts.runtime)
  const os = safeOs(contexts.os)
  if (runtime) out.runtime = runtime
  if (os) out.os = os
  if (trace && Object.keys(trace).length > 0) out.trace = trace
  return out
}

function nameOrUndefined(value: unknown, limit = NAME_LENGTH): string | undefined {
  return typeof value === 'string' ? scrubName(value, limit) : undefined
}

// ── Problem reports ─────────────────────────────────────────────────────────

function safeFrames(stacktrace: unknown): { frames: Plain[] } | undefined {
  if (!isPlain(stacktrace) || !Array.isArray(stacktrace.frames)) return undefined
  const frames = stacktrace.frames.slice(-MAX_FRAMES).filter(isPlain).map((frame) =>
    compact({
      filename: nameOrUndefined(frame.filename),
      abs_path: nameOrUndefined(frame.abs_path),
      module: nameOrUndefined(frame.module),
      function: nameOrUndefined(frame.function),
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
    type: typeof mechanism.type === 'string' ? scrubName(mechanism.type, 100) : undefined,
    handled: typeof mechanism.handled === 'boolean' ? mechanism.handled : undefined,
    synthetic: typeof mechanism.synthetic === 'boolean' ? mechanism.synthetic : undefined,
    is_exception_group: typeof mechanism.is_exception_group === 'boolean' ? mechanism.is_exception_group : undefined,
    exception_id: finiteNumber(mechanism.exception_id),
    parent_id: finiteNumber(mechanism.parent_id),
  })
}

function safeException(exception: unknown): { values: Plain[] } | undefined {
  if (!isPlain(exception) || !Array.isArray(exception.values)) return undefined
  const values = exception.values.slice(0, MAX_ENTRIES).filter(isPlain).map((value) =>
    compact({
      type: typeof value.type === 'string' ? (ERROR_NAME.test(value.type) ? value.type : scrubText(value.type, 80)) : undefined,
      value: typeof value.value === 'string' ? scrubText(value.value) : undefined,
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
      code_file: nameOrUndefined(image.code_file),
    }),
  )
  return images.length > 0 ? { images } : undefined
}

function keepOtherReport(event: Event): Event {
  const request = safeRequest(event.request)
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
      ? event.fingerprint.filter((part): part is string => typeof part === 'string').map((part) => scrubText(part, TAG_LENGTH))
      : undefined,
    message: message === undefined ? undefined : scrubText(message),
    exception: safeException(event.exception),
    tags: safeTags(event.tags),
    extra: safeExtra(event.extra),
    contexts: safeContexts(event.contexts, traceIds(event.contexts?.trace)),
    request,
    transaction: routeName(event.transaction, request),
    debug_meta: safeDebugMeta(event.debug_meta),
    sdkProcessingMetadata: safeMetadata(event.sdkProcessingMetadata),
  }) as Event
}

function keepHelperReport(event: Event): Event {
  const kept = keepReportFields(event)
  for (const value of kept.exception?.values ?? []) {
    if (typeof value.value === 'string') value.value = scrubText(value.value)
  }
  const tags = kept.tags ?? {}
  for (const key of Object.keys(tags)) {
    const value = tags[key]
    if (typeof value === 'string') tags[key] = scrubText(value, 80)
  }
  kept.sdkProcessingMetadata = safeMetadata(event.sdkProcessingMetadata)
  return kept
}

// ── Reports per hour ────────────────────────────────────────────────────────

let sentAt: number[] = []
let heldBackTotal = 0

// True when one more report fits in the rolling hour.
function admitThisHour(now: number): boolean {
  sentAt = sentAt.filter((time) => time <= now && now - time < REPORT_HOUR_MS)
  if (sentAt.length >= REPORTS_PER_HOUR) {
    heldBackTotal += 1
    return false
  }
  sentAt.push(now)
  return true
}

export function clearReportQuota(): void {
  sentAt = []
  heldBackTotal = 0
}

export function filterServerEvent(event: ErrorEvent, hint?: EventHint): ErrorEvent | null {
  try {
    const kept = isHelperReport(hint) ? keepHelperReport(event) : keepOtherReport(event)
    if (!admitThisHour(Date.now())) return null
    if (heldBackTotal > 0) {
      kept.extra = { ...kept.extra, held_back_total: heldBackTotal }
      heldBackTotal = 0
    }
    return kept as ErrorEvent
  } catch {
    return null
  }
}

// ── Timings ─────────────────────────────────────────────────────────────────

function safeSpanData(data: unknown, isDatabase: boolean): Record<string, string | number | boolean | Array<string | number | boolean>> {
  const out: Record<string, string | number | boolean | Array<string | number | boolean>> = {}
  if (!isPlain(data)) return out
  const clean = (value: unknown): string | number | boolean | undefined => {
    if (typeof value === 'string') return scrubPath(value)
    if (typeof value === 'boolean' || finiteNumber(value) !== undefined) return value as number | boolean
    return undefined
  }
  for (const key of Object.keys(data).slice(0, 100)) {
    if (!SAFE_KEY.test(key) || PRIVATE_DATA_KEY.test(key)) continue
    if (isDatabase && key.startsWith('db.') && key !== 'db.system' && key !== 'db.operation') continue
    const value = data[key]
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ENTRIES).map(clean).filter((item): item is string | number | boolean => item !== undefined)
      out[key] = items
    } else {
      const item = clean(value)
      if (item !== undefined) out[key] = item
    }
  }
  return out
}

function isDatabaseSpan(op: unknown, data: unknown): boolean {
  return (typeof op === 'string' && /^db(\.|$)/.test(op)) || (isPlain(data) && data['db.system'] !== undefined)
}

function scrubSpan(span: SpanJSON): SpanJSON {
  const isDatabase = isDatabaseSpan(span.op, span.data)
  return compact({
    span_id: span.span_id,
    trace_id: span.trace_id,
    parent_span_id: span.parent_span_id,
    start_timestamp: span.start_timestamp,
    timestamp: span.timestamp,
    op: nameOrUndefined(span.op, 100),
    status: shortString(span.status),
    origin: shortString(span.origin, 100) as SpanJSON['origin'],
    description: !isDatabase && typeof span.description === 'string' ? scrubPath(span.description) : undefined,
    data: safeSpanData(span.data, isDatabase),
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

export function filterServerSpan(span: SpanJSON): SpanJSON {
  try {
    return scrubSpan(span)
  } catch {
    return minimalSpan(span)
  }
}

function safeTraceContext(context: unknown): Plain {
  if (!isPlain(context)) return {}
  const isDatabase = isDatabaseSpan(context.op, context.data)
  return compact({
    ...traceIds(context),
    op: nameOrUndefined(context.op, 100),
    status: shortString(context.status),
    origin: shortString(context.origin, 100),
    data: safeSpanData(context.data, isDatabase),
  })
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

export function filterServerTransaction(event: TransactionEvent): TransactionEvent | null {
  try {
    const request = safeRequest(event.request)
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
      transaction: routeName(event.transaction, request),
      transaction_info: typeof source === 'string' ? { source } : undefined,
      tags: safeTags(event.tags),
      extra: safeExtra(event.extra),
      contexts: safeContexts(event.contexts, safeTraceContext(event.contexts?.trace)),
      request,
      spans: Array.isArray(event.spans) ? event.spans.slice(0, MAX_SPANS).map(scrubSpan) : undefined,
      measurements: safeMeasurements(event.measurements),
      sdkProcessingMetadata: safeMetadata(event.sdkProcessingMetadata),
    }) as TransactionEvent
  } catch {
    return null
  }
}
