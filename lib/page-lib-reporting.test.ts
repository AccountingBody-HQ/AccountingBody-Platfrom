import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Shared server code reports an unexpected problem once, with a fixed label
// and area, after its own log line, and keeps its answer unchanged. Expected
// outcomes (a last good value served, a refused job, part of a run failing)
// stay log lines only. Real supabase-js clients come from the factory and only
// the network is fake; the reporting helper is replaced by a recorder.

const state = vi.hoisted(() => ({
  reports: [] as unknown[][],
  order: [] as string[],
  clientFails: null as Error | null,
  resend: 'ok' as 'ok' | 'refused' | 'throws',
  emails: [] as unknown[],
}))

vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
    state.order.push(`report ${String(args[0])}`)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/supabase-server')>()
  return {
    ...original,
    getServerSupabase: (...args: Parameters<typeof original.getServerSupabase>) => {
      if (state.clientFails) throw state.clientFails
      return original.getServerSupabase(...args)
    },
  }
})
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (message: unknown) => {
        if (state.resend === 'throws') throw new Error('mail service unreachable')
        state.emails.push(message)
        if (state.resend === 'refused') return { data: null, error: { name: 'validation_error', message: 'mail refused' } }
        return { data: { id: 'email' }, error: null }
      },
    }
  },
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}))
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => fn(...args),
  unstable_noStore: () => {},
  revalidateTag: () => {},
  revalidatePath: () => {},
}))

import { LAST_GOOD_VALUE_LOG, resetCacheGuard } from '@/lib/cache-guard'
import * as db from '@/lib/db'
import * as jobs from '@/lib/jobs'
import { maybeSendProviderAlert } from '@/lib/provider-alerts'
import * as providers from '@/lib/providers'
import { touchLastSeen } from '@/lib/saved-jobs-store'
import { validate } from '@/lib/ingestion/validate'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

const DB_URL = 'https://example.supabase.co'
const NOW = Date.parse('2026-11-07T12:00:00.000Z')
const JOB_ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const VISITOR = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SEED_TITLE = 'Seedtitle Payroll Accountant'
const SEED_SEARCH = 'seed-search-k2'

type Row = Record<string, unknown>
type Call = { method: string; table: string }
const net = {
  rows: {} as Record<string, Row[]>,
  fail: null as ((call: Call) => boolean) | null,
  fullPages: false,
  requests: [] as string[],
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

let nextId = 0
const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  if (url.origin !== DB_URL) throw new Error(`unexpected request to ${url.href}`)
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  net.requests.push(`${method} ${table}`)
  if (net.fail?.({ method, table })) {
    if (method === 'HEAD') return new Response(null, { status: 500 })
    return json({ message: 'database detail', code: 'XX000', details: null, hint: null }, 500)
  }
  if (table.startsWith('rpc/')) return json([{ country: 'United Kingdom', job_count: 4 }])
  const headers = new Headers(init?.headers)
  const prefer = headers.get('prefer') ?? ''
  const single = (headers.get('accept') ?? '').includes('vnd.pgrst.object')
  const rows = net.rows[table] ?? []
  const eq: [string, string][] = []
  url.searchParams.forEach((value, key) => {
    if (value.startsWith('eq.')) eq.push([key, value.slice(3)])
  })
  const found = rows.filter((row) => eq.every(([key, value]) => String(row[key]) === value))
  if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `0-0/${found.length}` } })
  if (method === 'GET') {
    if (net.fullPages && table === 'jobs') {
      return json(Array.from({ length: 1000 }, () => ({ id: `id-${String(nextId++).padStart(8, '0')}`, slug: 's', expires_at: null, published_at: null, created_at: '2026-11-01T00:00:00Z' })))
    }
    if (!single) return json(found, 200, prefer.includes('count=') ? { 'content-range': `0-0/${found.length}` } : {})
    if (found.length === 1) return json(found[0])
    return json({ message: 'no single row', code: 'PGRST116', details: null, hint: null }, 406)
  }
  if (method === 'PATCH') return prefer.includes('return=representation') ? json(found) : new Response(null, { status: 204 })
  if (method === 'POST') return new Response(null, { status: 201 })
  throw new Error(`unexpected ${method} to ${table}`)
}

const failOn = (method: string, table: string) => (call: Call) => call.method === method && call.table === table

function recorded(...args: unknown[]) {
  state.order.push(`console ${String(args[0])}`)
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.stubEnv('RESEND_API_KEY', 'test-key')
  for (const level of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, level).mockImplementation(recorded)
  state.reports.length = 0
  state.order.length = 0
  state.emails.length = 0
  state.clientFails = null
  state.resend = 'ok'
  net.rows = {}
  net.fail = null
  net.fullPages = false
  net.requests = []
  resetCacheGuard()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const labels = () => state.reports.map((args) => args[0])

// Every report: a fixed label, the area only, and the log line first.
function expectReports(expected: [label: string, area: string, log: string][]) {
  expect(state.reports.map(([label, , extra]) => [label, extra])).toStrictEqual(expected.map(([label, area]) => [label, { area }]))
  for (const [label, , log] of expected) {
    const at = state.order.indexOf(`report ${label}`)
    expect(state.order.indexOf(`console ${log}`)).toBeGreaterThanOrEqual(0)
    expect(state.order.indexOf(`console ${log}`)).toBeLessThan(at)
  }
}

describe('page counts', () => {
  const counts: [string, () => Promise<unknown>, string, string, unknown][] = [
    ['getQuestionSetCount', () => db.getQuestionSetCount(), 'question_sets', 'question set count read failed', 0],
    ['getPublishedQuestionCount', () => db.getPublishedQuestionCount(), 'questions', 'question count read failed', 0],
    ['getPublishedArticleCount', () => db.getPublishedArticleCount('ab'), 'articles', 'article count read failed', 0],
    ['getBrowsableJobsCount', () => jobs.getBrowsableJobsCount('ab'), 'jobs', 'job count read failed', 0],
    ['getCachedActiveJobCountries', () => jobs.getCachedActiveJobCountries('ab'), 'site_counts', 'job countries cached read failed', []],
  ]

  it.each(counts)('%s reports an unexpected problem with its label and keeps its fallback', async (name, run, table, label, fallback) => {
    net.fail = (call) => call.table === table
    expect(await run()).toStrictEqual(fallback)
    // The jobs total and the country menu log their own fixed lines.
    const fixedLogs: Record<string, string> = {
      getBrowsableJobsCount: jobs.JOBS_TOTAL_LOG.estimateFailed,
      getCachedActiveJobCountries: jobs.COUNTRY_LIST_LOG.failed,
    }
    const log = fixedLogs[name] ?? `${name} error:`
    expectReports([[label, 'public', log]])
    expect(state.reports[0][1]).toBeInstanceOf(Error)
  })

  it.each(counts)('%s makes no report when the read works', async (_name, run) => {
    await run()
    expect(state.reports).toStrictEqual([])
  })

  it('getCategoryCounts reports each failed category read with one label and keeps 0 for it', async () => {
    net.fail = failOn('HEAD', 'articles')
    const result = await db.getCategoryCounts()
    expect(Object.values(result)).toStrictEqual(Array(10).fill(0))
    expect(new Set(labels())).toStrictEqual(new Set(['article category count read failed']))
    expect(state.reports).toHaveLength(10)
    for (const args of state.reports) expect(args[2]).toStrictEqual({ area: 'public' })
  })

  it('getCategoryCounts makes no report when the reads work', async () => {
    await db.getCategoryCounts()
    expect(state.reports).toStrictEqual([])
  })
})

describe('cached reads', () => {
  it('makes no report while a last good value is served', async () => {
    net.rows.question_sets = [{ id: 1, status: 'published' }, { id: 2, status: 'published' }]
    expect(await db.getQuestionSetCount()).toBe(2)
    vi.setSystemTime(NOW + 31_000)
    net.fail = (call) => call.table === 'question_sets'
    expect(await db.getQuestionSetCount()).toBe(2)
    expect(state.order).toContain(`console ${LAST_GOOD_VALUE_LOG} (getQuestionSetCount)`)
    expect(state.reports).toStrictEqual([])
  })

  it('reports from the reader when there is no last good value to serve', async () => {
    net.fail = (call) => call.table === 'question_sets'
    expect(await db.getQuestionSetCount()).toBe(0)
    // Within the pause after a failure the saved problem comes back at once.
    expect(await db.getQuestionSetCount()).toBe(0)
    expect(labels()).toStrictEqual(['question set count read failed', 'question set count read failed'])
  })

  it('reports from the reader once the last good value is too old', async () => {
    net.rows.question_sets = [{ id: 1, status: 'published' }]
    expect(await db.getQuestionSetCount()).toBe(1)
    vi.setSystemTime(NOW + 25 * 60 * 60 * 1000)
    net.fail = (call) => call.table === 'question_sets'
    expect(await db.getQuestionSetCount()).toBe(0)
    expect(labels()).toStrictEqual(['question set count read failed'])
  })
})

describe('similar jobs', () => {
  beforeEach(() => {
    vi.stubEnv('SIMILAR_JOBS_ENABLED', 'true')
  })

  const params = { excludeId: JOB_ID, platform: 'ab', title: SEED_TITLE, locationCountry: 'United Kingdom' }

  it('reports each step that cannot read jobs with its own label and a fixed problem', async () => {
    net.fail = (call) => call.table === 'jobs'
    expect(await jobs.getSimilarJobs(params)).toStrictEqual([])
    expectReports([
      ['similar jobs strong match read failed', 'public', 'getSimilarJobs (and, same country) error:'],
      ['similar jobs same country read failed', 'public', 'getSimilarJobs (or, same country) error:'],
      ['similar jobs worldwide read failed', 'public', 'getSimilarJobs (or, worldwide) error:'],
      ['similar jobs country fallback read failed', 'public', 'getSimilarJobs (fallback) error:'],
    ])
    for (const args of state.reports) {
      expect(args[1]).toStrictEqual(new Error('similar jobs query failed'))
      expect(JSON.stringify(args)).not.toMatch(/seedtitle|payroll/i)
    }
  })

  it('reports a title it cannot split with a fixed problem', async () => {
    expect(await jobs.getSimilarJobs({ ...params, title: null as never })).toStrictEqual([])
    expectReports([['similar jobs title words failed', 'public', 'getSimilarJobs (similarTitleTokens) error:']])
  })

  it('makes no report when the reads work', async () => {
    await jobs.getSimilarJobs(params)
    expect(state.reports).toStrictEqual([])
  })
})

describe('admin job list', () => {
  it('reports the list and count reads with fixed problems and keeps the empty answer', async () => {
    net.fail = (call) => call.table === 'jobs'
    expect(await jobs.getAdminJobs({ search: SEED_SEARCH })).toStrictEqual({ jobs: [], total: 0 })
    expectReports([
      ['admin job list read failed', 'admin', 'getAdminJobs list error:'],
      ['admin job count read failed', 'admin', 'getAdminJobs count error:'],
    ])
    expect(state.reports[0][1]).toStrictEqual(new Error('admin job list read failed'))
    expect(state.reports[1][1]).toStrictEqual(new Error('admin job count read failed'))
    expect(JSON.stringify(state.reports)).not.toContain(SEED_SEARCH)
  })

  it('makes no report when the reads work', async () => {
    await jobs.getAdminJobs({ search: SEED_SEARCH })
    expect(state.reports).toStrictEqual([])
  })
})

describe('sitemaps', () => {
  it('reports a jobs read that fails and keeps the empty list', async () => {
    net.fail = (call) => call.table === 'jobs'
    expect(await jobs.getJobSitemapEntries('et')).toStrictEqual([])
    expectReports([['sitemap jobs read failed', 'public', 'getJobSitemapEntries error:']])
  })

  it('reports a job chunk read that fails and keeps its failed result', async () => {
    net.fail = (call) => call.table === 'jobs'
    expect(await jobs.getJobSitemapChunk('ab', 0)).toStrictEqual({ ok: false })
    expectReports([['sitemap job chunk read failed', 'public', 'getJobSitemapChunk(bucket=0) error:']])
  })

  it('reports the page limit with a fixed problem', async () => {
    net.fullPages = true
    expect(await jobs.getJobSitemapEntries('et')).toHaveLength(100_000)
    expect(await jobs.getJobSitemapChunk('ab', 0)).toMatchObject({ ok: true })
    expect(labels()).toStrictEqual(['sitemap jobs page limit reached', 'sitemap job chunk page limit reached'])
    expect(state.reports[0][1]).toStrictEqual(new Error('sitemap jobs page limit reached'))
    expect(state.reports[1][1]).toStrictEqual(new Error('sitemap job chunk page limit reached'))
  }, 30_000)

  it('makes no report for a short list', async () => {
    net.rows.jobs = [{ id: JOB_ID, slug: 'a', expires_at: null, published_at: null, created_at: '2026-11-01T00:00:00Z' }]
    expect(await jobs.getJobSitemapEntries('et')).toHaveLength(1)
    expect(await jobs.getJobSitemapChunk('ab', 0)).toMatchObject({ ok: true })
    expect(state.reports).toStrictEqual([])
  })
})

describe('job counters', () => {
  it.each([
    ['incrementJobClicks', () => jobs.incrementJobClicks(JOB_ID), 'job click count failed'],
    ['incrementJobImpressions', () => jobs.incrementJobImpressions(JOB_ID), 'job impression count failed'],
  ])('%s reports an unexpected problem and still never throws', async (name, run, label) => {
    const problem = new Error('client could not be created')
    state.clientFails = problem
    await expect(run()).resolves.toBeUndefined()
    expectReports([[label, 'public', `${name} failed (non-fatal):`]])
    expect(state.reports[0][1]).toBe(problem)
  })

  it.each([
    ['incrementJobClicks', () => jobs.incrementJobClicks(JOB_ID)],
    ['incrementJobImpressions', () => jobs.incrementJobImpressions(JOB_ID)],
  ])('%s makes no report when the job is counted', async (_name, run) => {
    net.rows.jobs = [{ id: JOB_ID, impression_count: 1, click_count: 0 }]
    await run()
    expect(state.reports).toStrictEqual([])
  })
})

describe('import run helpers', () => {
  const metrics = { relevanceRate: 50, avgDescriptionLength: 100, fieldCoverage: {}, status: 'good' as const }

  it.each([
    ['updateProviderDataQuality', () => providers.updateProviderDataQuality('provider-1', metrics), failOn('PATCH', 'job_providers'), 'job import quality save failed', '[updateProviderDataQuality] failed:'],
    ['updateProviderKeywordCursor', () => providers.updateProviderKeywordCursor('provider-1', 3), failOn('PATCH', 'job_providers'), 'job import keyword cursor save failed', '[updateProviderKeywordCursor] failed:'],
    ['incrementProviderJobsToday (read)', () => providers.incrementProviderJobsToday('provider-1', 2), failOn('GET', 'job_providers'), 'job import counter read failed', '[incrementProviderJobsToday] failed to fetch provider:'],
    ['incrementProviderJobsToday (save)', () => providers.incrementProviderJobsToday('provider-1', 2), failOn('PATCH', 'job_providers'), 'job import counter save failed', '[incrementProviderJobsToday] failed to update counters:'],
  ])('%s reports an unexpected problem with its label', async (_name, run, fail, label, log) => {
    net.rows.job_providers = [{ id: 'provider-1', jobs_today: 1, total_jobs_ingested: 1, jobs_last_run: 1 }]
    net.fail = fail
    await expect(run()).resolves.toBeUndefined()
    expectReports([[label, 'ingest', log]])
  })

  it('reapStaleRuns reports an unexpected problem and keeps its 0 answer', async () => {
    net.fail = failOn('PATCH', 'provider_runs')
    expect(await providers.reapStaleRuns(10)).toBe(0)
    expectReports([['job import stale run update failed', 'ingest', '[reapStaleRuns] failed:']])
  })

  it('makes no report when the writes work', async () => {
    net.rows.job_providers = [{ id: 'provider-1', jobs_today: 1, total_jobs_ingested: 1, jobs_last_run: 1 }]
    await providers.updateProviderDataQuality('provider-1', metrics)
    await providers.updateProviderKeywordCursor('provider-1', 3)
    await providers.incrementProviderJobsToday('provider-1', 2)
    await providers.reapStaleRuns(10)
    expect(state.reports).toStrictEqual([])
  })

  const failing = makeProvider({ id: 'provider-1', last_alert_state: 'ok', status: 'active' })

  it('reports an alert email the mail service refuses', async () => {
    state.resend = 'refused'
    await maybeSendProviderAlert(failing, 'failing', 3)
    expectReports([['job import alert email refused', 'ingest', '[maybeSendProviderAlert] Resend error:']])
  })

  it('reports an alert email that cannot be sent', async () => {
    state.resend = 'throws'
    await maybeSendProviderAlert(failing, 'failing', 3)
    expectReports([['job import alert email failed', 'ingest', '[maybeSendProviderAlert] send threw:']])
  })

  it('reports an alert state that cannot be saved', async () => {
    net.fail = failOn('PATCH', 'job_providers')
    await maybeSendProviderAlert(failing, 'failing', 3)
    expectReports([['job import alert state save failed', 'ingest', '[maybeSendProviderAlert] failed to write last_alert_state:']])
  })

  it('makes no report when the alert is sent and saved', async () => {
    await maybeSendProviderAlert(failing, 'failing', 3)
    expect(state.emails).toHaveLength(1)
    expect(state.reports).toStrictEqual([])
  })

  it('makes no report for a job refused for its data', () => {
    const job = {
      slug: 'refused-job',
      source: 'not-a-source',
      title: 'Management Accountant',
      company_name: 'Example',
      application_url: 'https://example.com/apply',
      description: 'Prepare monthly management accounts and reports.',
      quality_flags: [],
      seniority_level: null,
    }
    const result = validate([job as never], false)
    expect(result.rejected).toHaveLength(1)
    expect(state.order.some((line) => line.startsWith('console [validate] rejecting job'))).toBe(true)
    expect(state.reports).toStrictEqual([])
  })
})

describe('saved jobs last seen', () => {
  it('reports a save that fails with a fixed problem and no visitor', async () => {
    net.fail = failOn('PATCH', 'saved_jobs')
    await expect(touchLastSeen(VISITOR, 'ab', 3_600_000)).resolves.toBeUndefined()
    expectReports([['saved jobs last seen save failed', 'public', 'touchLastSeen: update failed (non-fatal):']])
    expect(state.reports[0][1]).toStrictEqual(new Error('saved jobs last seen save failed'))
    expect(JSON.stringify(state.reports)).not.toContain(VISITOR)
  })

  it('reports a save that throws with a fixed problem', async () => {
    state.clientFails = new Error(`client problem ${VISITOR}`)
    await expect(touchLastSeen(VISITOR, 'ab', 3_600_000)).resolves.toBeUndefined()
    expectReports([['saved jobs last seen save threw', 'public', 'touchLastSeen: unexpected error (non-fatal):']])
    expect(JSON.stringify(state.reports)).not.toContain(VISITOR)
  })

  it('makes no report when the save works', async () => {
    await touchLastSeen(VISITOR, 'ab', 3_600_000)
    expect(state.reports).toStrictEqual([])
  })
})

// ── Every log line in server pages and shared code, by function ─────────────

const ROOT = process.cwd()

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === 'node_modules' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : []
  })
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(join(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

function isBrowserFile(file: ts.SourceFile): boolean {
  const first = file.statements[0]
  return !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use client'
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

function owner(node: ts.Node): { name: string; node: ts.Node } {
  for (let at = node.parent; at; at = at.parent) {
    if ((ts.isFunctionDeclaration(at) || ts.isMethodDeclaration(at)) && at.name) return { name: at.name.getText(), node: at }
    if (ts.isVariableDeclaration(at) && ts.isIdentifier(at.name)) return { name: at.name.text, node: at }
  }
  return { name: '(top level)', node: node.getSourceFile() }
}

const isConsoleFailure = (node: ts.Node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.expression.getText() === 'console' &&
  ['error', 'warn'].includes(node.expression.name.text)

const isReport = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'reportServerError'

// file:function → the exact report calls in that function.
function logSites(files: string[]): Record<string, string[]> {
  const sites: Record<string, string[]> = {}
  for (const path of files) {
    const file = parse(path)
    if (isBrowserFile(file)) continue
    walk(file, (node) => {
      if (!isConsoleFailure(node)) return
      const { name, node: body } = owner(node)
      const key = `${path}:${name}`
      if (key in sites) return
      const calls: string[] = []
      walk(body, (inner) => {
        if (isReport(inner)) calls.push(inner.getText().replace(/\s+/g, ' '))
      })
      sites[key] = calls
    })
  }
  return sites
}

// Shared helpers that report through their own label.
const REPORTERS = ['lib/db-check.ts', 'lib/email-check.ts', 'lib/turnstile-verify.ts', 'lib/report-error.ts', 'lib/sentry-privacy.ts', 'lib/sentry-browser-privacy.ts', 'lib/scrub-rules.ts']

const REPORTING: Record<string, string[]> = {
  'lib/db.ts:getCategoryCounts': ["reportServerError('article category count read failed', error, { area: 'public' })"],
  'lib/db.ts:getQuestionSetCount': ["reportServerError('question set count read failed', error, { area: 'public' })"],
  'lib/db.ts:getPublishedQuestionCount': ["reportServerError('question count read failed', error, { area: 'public' })"],
  'lib/db.ts:getPublishedArticleCount': ["reportServerError('article count read failed', error, { area: 'public' })"],
  'lib/jobs.ts:getSimilarJobs': [
    "reportServerError('similar jobs title words failed', new Error('similar jobs title words failed'), { area: 'public' })",
    "reportServerError('similar jobs strong match read failed', new Error('similar jobs query failed'), { area: 'public' })",
    "reportServerError('similar jobs same country read failed', new Error('similar jobs query failed'), { area: 'public' })",
    "reportServerError('similar jobs worldwide read failed', new Error('similar jobs query failed'), { area: 'public' })",
    "reportServerError('similar jobs country fallback read failed', new Error('similar jobs query failed'), { area: 'public' })",
  ],
  'lib/jobs.ts:getAdminJobs': [
    "reportServerError('admin job list read failed', new Error('admin job list read failed'), { area: 'admin' })",
    "reportServerError('admin job count read failed', new Error('admin job count read failed'), { area: 'admin' })",
  ],
  'lib/jobs.ts:getBrowsableJobsTotal': ["reportServerError('job count read failed', error, { area: 'public' })"],
  'lib/jobs.ts:getCachedActiveJobCountries': ["reportServerError('job countries cached read failed', error, { area: 'public' })"],
  'lib/jobs.ts:getJobSitemapEntries': [
    "reportServerError('sitemap jobs read failed', error, { area: 'public' })",
    "reportServerError('sitemap jobs page limit reached', new Error('sitemap jobs page limit reached'), { area: 'public' })",
  ],
  'lib/jobs.ts:getJobSitemapChunk': [
    "reportServerError('sitemap job chunk read failed', error, { area: 'public' })",
    "reportServerError('sitemap job chunk page limit reached', new Error('sitemap job chunk page limit reached'), { area: 'public' })",
  ],
  'lib/jobs.ts:incrementJobImpressions': ["reportServerError('job impression count failed', err, { area: 'public' })"],
  'lib/jobs.ts:incrementJobClicks': ["reportServerError('job click count failed', err, { area: 'public' })"],
  'lib/provider-alerts.ts:maybeSendProviderAlert': [
    "reportServerError('job import alert email refused', sendError, { area: 'ingest' })",
    "reportServerError('job import alert email failed', err, { area: 'ingest' })",
    "reportServerError('job import alert state save failed', updateError, { area: 'ingest' })",
  ],
  'lib/providers.ts:updateProviderDataQuality': ["reportServerError('job import quality save failed', error, { area: 'ingest' })"],
  'lib/providers.ts:incrementProviderJobsToday': [
    "reportServerError('job import counter read failed', fetchError ?? new Error('job import counter read failed'), { area: 'ingest' })",
    "reportServerError('job import counter save failed', updateError, { area: 'ingest' })",
  ],
  'lib/providers.ts:reapStaleRuns': ["reportServerError('job import stale run update failed', error, { area: 'ingest' })"],
  'lib/providers.ts:updateProviderKeywordCursor': ["reportServerError('job import keyword cursor save failed', error, { area: 'ingest' })"],
  'lib/saved-jobs-store.ts:touchLastSeen': [
    "reportServerError('saved jobs last seen save failed', new Error('saved jobs last seen save failed'), { area: 'public' })",
    "reportServerError('saved jobs last seen save threw', new Error('saved jobs last seen save threw'), { area: 'public' })",
  ],
}

// Log lines that stay log lines, with the reason.
const LOG_ONLY: Record<string, string> = {
  'lib/cache-guard.ts:refresh': 'the last good value is served; without one the problem goes to the reader, which reports',
  'lib/adapters/adzuna.ts:fetch': 'some search words failed and the run goes on; when all fail the run fails and reports',
  'lib/ingestion/validate.ts:validate': 'a job refused for its data',
  'lib/supabase-server.ts:timeLimitedFetch': 'the caller receives the time-limit problem and handles it',
  'lib/coursesNew.ts:getCourseBySlug': 'passed on to the page or route',
  'lib/coursesNew.ts:getLessonData': 'passed on to the page',
  'lib/db.ts:getArticleBySlug': 'passed on to the page',
  'lib/jobs.ts:getExpiringJobs': 'passed on to the expiry run, which reports',
  'lib/jobs.ts:jobsTotalSource': 'an unrecognised setting falls back to the default total source',
  'lib/jobs.ts:getCachedListingJobs': 'relevance order with no search words falls back to the default order',
  'lib/jobs.ts:getPrecountedFilterTotal': 'a missing, stale or unreadable pre-counted row falls back to a live count',
}

describe('log lines in server pages and shared code', () => {
  const libFiles = sourceFiles(join(ROOT, 'lib')).map((file) => relative(ROOT, file)).filter((file) => !REPORTERS.includes(file))
  const pageFiles = sourceFiles(join(ROOT, 'app')).map((file) => relative(ROOT, file)).filter((file) => !file.startsWith('app/api/'))

  it('finds log lines and the reports next to them', () => {
    expect(logSites(['lib/db.ts'])['lib/db.ts:getQuestionSetCount']).toStrictEqual(REPORTING['lib/db.ts:getQuestionSetCount'])
  })

  it('every log line in shared server code is listed as reporting or as a log line only', () => {
    expect(Object.keys(logSites(libFiles)).sort()).toStrictEqual([...Object.keys(REPORTING), ...Object.keys(LOG_ONLY)].sort())
  })

  it('each reporting function reports with its fixed labels, problems and area', () => {
    const sites = logSites(libFiles)
    for (const [key, calls] of Object.entries(REPORTING)) expect([key, sites[key]]).toStrictEqual([key, calls])
  })

  it('log-only functions make no report', () => {
    const sites = logSites(libFiles)
    for (const key of Object.keys(LOG_ONLY)) expect([key, sites[key]]).toStrictEqual([key, []])
  })

  it('server pages and layouts have no log lines of their own', () => {
    expect(logSites(pageFiles)).toStrictEqual({})
  })
})

// ── Browser files never load the reporting helper ───────────────────────────

const SERVER_ONLY = ['lib/report-error.ts', 'lib/sentry-privacy.ts', 'lib/middleware-logic.ts']

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : spec.startsWith('.') ? join(ROOT, dirname(from), spec) : null
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return relative(ROOT, candidate)
    } catch {
      // not this one
    }
  }
  return null
}

// Imports that load code at run time (type-only imports are left out).
function runtimeImports(file: string): string[] {
  const source = parse(file)
  const found: string[] = []
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause
      if (clause?.isTypeOnly) continue
      const named = clause?.namedBindings
      if (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly)) continue
      const target = resolveImport(file, statement.moduleSpecifier.text)
      if (target) found.push(target)
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) && !statement.isTypeOnly) {
      const target = resolveImport(file, statement.moduleSpecifier.text)
      if (target) found.push(target)
    }
  }
  return found
}

function reachable(file: string): Set<string> {
  const seen = new Set<string>()
  const queue = [file]
  while (queue.length > 0) {
    const next = queue.pop()!
    for (const target of runtimeImports(next)) {
      if (!seen.has(target)) {
        seen.add(target)
        queue.push(target)
      }
    }
  }
  return seen
}

describe('browser files', () => {
  const browserFiles = ['app', 'components', 'lib']
    .flatMap((folder) => sourceFiles(join(ROOT, folder)))
    .map((file) => relative(ROOT, file))
    .filter((file) => isBrowserFile(parse(file)))

  it('finds browser files, including the listing manage screen', () => {
    expect(browserFiles).toContain('app/jobs/manage-listing/ManageListingClient.tsx')
    expect(reachable('lib/db.ts').has('lib/report-error.ts')).toBe(true)
  })

  it('no browser file loads server-only code, directly or through another file', () => {
    const loading = browserFiles.filter((file) => SERVER_ONLY.some((server) => reachable(file).has(server)))
    expect(loading).toStrictEqual([])
  })
})
