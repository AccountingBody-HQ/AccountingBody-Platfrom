import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// DL-1 guards (D287): new imports no longer keep a copy of each provider's
// original job record; the import error log keeps only the source job id
// (never a raw copy) and keeps 14 days; a record file describes the later
// removal of the unused column. Nothing visitors or admin screens show
// changes.

type DbError = { message: string; code?: string } | null

const state = vi.hoisted(() => ({
  inserts: [] as { table: string; payload: unknown }[],
  batchError: null as { message: string; code?: string } | null,
  singleErrors: [] as ({ message: string; code?: string } | null)[],
}))

// A fake supabase-js client: every insert is recorded with its table and
// payload; jobs inserts answer with the error queued for them.
vi.mock('@/lib/supabase-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase-server')>()),
  getServerSupabase: () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => {
        state.inserts.push({ table, payload })
        let result: { error: DbError; data?: unknown }
        if (table === 'jobs' && Array.isArray(payload)) {
          result = { error: state.batchError, data: state.batchError ? null : payload.map((_, i) => ({ id: `id-${i}` })) }
        } else if (table === 'jobs') {
          result = { error: state.singleErrors.length > 0 ? state.singleErrors.shift() ?? null : null }
        } else {
          result = { error: null }
        }
        const done = Promise.resolve(result)
        return {
          then: done.then.bind(done),
          select: () => ({
            then: done.then.bind(done),
            single: async () => ({ data: { id: 'new-1' }, error: null }),
          }),
        }
      },
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  }),
}))

// The real logProviderError (and its helper) stays; only the run and health
// bookkeeping is replaced.
vi.mock('@/lib/providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/providers')>()),
  findProvider: vi.fn(),
  createProviderRun: vi.fn(),
  completeProviderRun: vi.fn().mockResolvedValue(undefined),
  failProviderRun: vi.fn().mockResolvedValue(undefined),
  updateProviderHealth: vi.fn().mockResolvedValue(undefined),
  updateProviderDataQuality: vi.fn().mockResolvedValue(undefined),
  incrementProviderJobsToday: vi.fn().mockResolvedValue(undefined),
  updateProviderKeywordCursor: vi.fn().mockResolvedValue(undefined),
  deferProvider: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/adapters', () => ({ getAdapter: vi.fn() }))
vi.mock('@/lib/ingestion/normalise', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ingestion/normalise')>()
  return {
    reslug: actual.reslug,
    normalise: vi.fn((raw: Record<string, unknown>) => normalisedFor(raw)),
  }
})
vi.mock('@/lib/ingestion/validate', () => ({
  validate: vi.fn((jobs: { title: string }[]) => ({
    valid: jobs.filter((job) => !job.title.startsWith('Rejected')),
    rejected: jobs.filter((job) => job.title.startsWith('Rejected')),
  })),
}))
vi.mock('@/lib/ingestion/deduplicate', () => ({
  deduplicate: vi.fn(async (jobs: unknown[]) => ({ toInsert: jobs, duplicateCount: 0 })),
}))
vi.mock('@/lib/ingestion/quality', () => ({
  computeQualityMetrics: vi.fn(() => ({ status: 'ok', relevanceRate: 1, avgDescriptionLength: 10, fieldCoverage: {} })),
}))
vi.mock('@/lib/provider-alerts', () => ({
  deriveAlertState: vi.fn(() => 'ok'),
  maybeSendProviderAlert: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/report-error', () => ({ reportServerError: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))
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

import { runProviderImport } from '@/lib/ingestion/run-provider-import'
import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'
import { createJob, type JobInsert } from '@/lib/jobs'
import {
  BATCH_SIZE,
  DELETE_PART_SIZE,
  IMPORT_LOG_RETENTION_DAYS,
  MAX_BATCHES,
  TIME_BUDGET_MS,
  retentionCutoff,
} from '@/lib/import-log-retention'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const DAY = 24 * 60 * 60 * 1000

// A provider's own record (Adzuna-like keys: no source_job_id).
function providerRecord(n: number, title: string): Record<string, unknown> {
  return { id: `p-${n}`, title, description: `Raw description ${n}`, redirect_url: `https://jobs.example/${n}`, __CLASS__: 'Ad' }
}

// What normalise hands over today for one raw record (every field distinct).
function normalisedFor(raw: Record<string, unknown>): Record<string, unknown> {
  const n = Number(String(raw.id).slice(2))
  return {
    title: String(raw.title),
    company_name: `Company ${n}`,
    slug: `role-${n}-company-${n}-ab1${n}`,
    description: `Description ${n}`,
    excerpt: `Excerpt ${n}`,
    location_text: `City ${n}, Country`,
    location_country: 'Country',
    location_city: `City ${n}`,
    location_remote: n % 2 === 0,
    salary_min: 1000 * n,
    salary_max: 2000 * n,
    salary_currency: 'GBP',
    salary_text: `£${n}k`,
    salary_is_predicted: false,
    employment_type: 'full_time',
    seniority_level: 'senior',
    qualifications_required: ['ACCA'],
    source: 'adzuna',
    source_job_id: `p-${n}`,
    source_url: `https://jobs.example/${n}`,
    source_score: 50,
    application_url: `https://apply.example/${n}`,
    dedup_hash: `hash-${n}`,
    platform: ['ab'],
    status: 'active',
    expires_at: '2026-12-21T00:00:00.000Z',
    published_at: '2026-11-21T00:00:00.000Z',
    provider_id: 'provider-1',
    data_completeness: 70 + n,
    quality_flags: [`flag-${n}`],
    normalisation_version: 3,
    raw_source_data: raw,
  }
}

// Today's insert field list (lib/ingestion/run-provider-import.ts before
// DL-1), in order; the expected row is this list minus raw_source_data.
const TODAY_FIELDS = [
  'title', 'company_name', 'slug', 'description', 'excerpt', 'location_text', 'location_country',
  'location_city', 'location_remote', 'salary_min', 'salary_max', 'salary_currency', 'salary_text',
  'salary_is_predicted', 'employment_type', 'seniority_level', 'qualifications_required', 'source',
  'source_job_id', 'source_url', 'source_score', 'application_url', 'dedup_hash', 'platform', 'status',
  'expires_at', 'published_at', 'provider_id', 'ingestion_run_id', 'data_completeness', 'quality_flags',
  'normalisation_version', 'raw_source_data', 'quality_score', 'payment_status', 'employer_email',
  'employer_name', 'employer_company', 'apply_method',
] as const

function todayRow(job: Record<string, unknown>, slug = job.slug): Record<string, unknown> {
  const fixed: Record<string, unknown> = {
    ...job,
    slug,
    status: 'active',
    ingestion_run_id: 'run-1',
    quality_score: job.data_completeness,
    payment_status: 'free',
    employer_email: 'noreply+example@accountingbody.com',
    employer_name: 'Test Provider',
    employer_company: job.company_name,
    apply_method: 'external',
  }
  return Object.fromEntries(TODAY_FIELDS.map((key) => [key, fixed[key]]))
}

function expectedRow(job: Record<string, unknown>, slug = job.slug): Record<string, unknown> {
  const row = todayRow(job, slug)
  delete row.raw_source_data
  return row
}

const SLUG_CLASH: DbError = { code: '23505', message: 'duplicate key value violates unique constraint "jobs_slug_key"' }
const DEDUP_CLASH: DbError = { code: '23505', message: 'duplicate key value violates unique constraint "idx_jobs_dedup"' }
const OTHER: DbError = { code: 'XX001', message: 'batch problem' }

const jobInserts = () => state.inserts.filter((call) => call.table === 'jobs')
const errorRows = () => state.inserts.filter((call) => call.table === 'provider_errors').map((call) => call.payload as Record<string, unknown>)

function feed(raws: Record<string, unknown>[]) {
  vi.mocked(getAdapter).mockReturnValue({
    fetch: vi.fn().mockResolvedValue({ jobs: raws, pagesFetched: 1, totalAvailable: raws.length }),
  } as never)
}

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, level).mockImplementation(() => {})
  state.inserts = []
  state.batchError = null
  state.singleErrors = []
  vi.mocked(providers.findProvider).mockResolvedValue(
    makeProvider({ slug: 'example', name: 'Test Provider', field_mapping: { title: 't', company_name: 'c', application_url: 'u' } }),
  )
  vi.mocked(providers.createProviderRun).mockResolvedValue({ id: 'run-1' } as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

// ── G1 no jobs insert names raw_source_data ─────────────────────────────────

describe('G1 jobs inserts omit raw_source_data', () => {
  it('the batch insert rows carry no raw_source_data key and every other field as today', async () => {
    const raws = [providerRecord(1, 'Role one'), providerRecord(2, 'Role two')]
    feed(raws)
    const result = await runProviderImport('example', 'cron')
    expect(result.body).toMatchObject({ ok: true, inserted: 2 })
    expect(jobInserts()).toHaveLength(1)
    const rows = jobInserts()[0].payload as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    for (const row of rows) expect('raw_source_data' in row).toBe(false)
    expect(rows).toStrictEqual(raws.map((raw) => expectedRow(normalisedFor(raw))))
  })

  it('the per-row fallback insert carries no raw_source_data key and every other field as today', async () => {
    const raws = [providerRecord(3, 'Role three'), providerRecord(4, 'Role four')]
    feed(raws)
    state.batchError = OTHER
    state.singleErrors = [null, null]
    const result = await runProviderImport('example', 'cron')
    expect(result.body).toMatchObject({ ok: true, inserted: 2 })
    const singles = jobInserts().slice(1).map((call) => call.payload as Record<string, unknown>)
    expect(singles).toHaveLength(2)
    for (const row of singles) expect('raw_source_data' in row).toBe(false)
    expect(singles).toStrictEqual(raws.map((raw) => expectedRow(normalisedFor(raw))))
  })

  it('a slug-retry attempt carries no raw_source_data key; only the slug differs', async () => {
    const raw = providerRecord(5, 'Role five')
    feed([raw])
    state.batchError = SLUG_CLASH
    state.singleErrors = [SLUG_CLASH, null]
    const result = await runProviderImport('example', 'cron')
    expect(result.body).toMatchObject({ ok: true, inserted: 1 })
    const singles = jobInserts().slice(1).map((call) => call.payload as Record<string, unknown>)
    expect(singles).toHaveLength(2)
    for (const row of singles) expect('raw_source_data' in row).toBe(false)
    const job = normalisedFor(raw)
    expect(singles[0]).toStrictEqual(expectedRow(job))
    expect(singles[1].slug).not.toBe(job.slug)
    expect(singles[1]).toStrictEqual(expectedRow(job, singles[1].slug))
  })

  const jobPost = {
    title: 'Finance Manager',
    company_name: 'Acme Ltd',
    description: 'A finance manager role with enough words to describe the work.',
    location_text: 'London, UK',
    employer_email: 'info@accountingbody.com',
    employer_name: 'Employer',
    employer_company: 'Acme Ltd',
  }

  it('createJob inserts a row with no raw_source_data key', async () => {
    await createJob(jobPost as JobInsert)
    const rows = jobInserts().map((call) => call.payload as Record<string, unknown>)
    expect(rows).toHaveLength(1)
    expect('raw_source_data' in rows[0]).toBe(false)
  })

  it('createJob drops a raw_source_data value even if a caller passed one', async () => {
    await createJob({ ...jobPost, raw_source_data: { a: 1 } } as never)
    const rows = jobInserts().map((call) => call.payload as Record<string, unknown>)
    expect('raw_source_data' in rows[0]).toBe(false)
  })

  it('JobInsert no longer declares raw_source_data', () => {
    const source = read('lib/jobs.ts')
    const start = source.indexOf('export interface JobInsert {')
    const body = source.slice(start, source.indexOf('\n}', start))
    expect(start).toBeGreaterThan(0)
    expect(body).not.toContain('raw_source_data')
  })

  it('no jobs insert payload in the import runner or createJob names the column', () => {
    expect(read('lib/ingestion/run-provider-import.ts')).not.toMatch(/raw_source_data\s*:/)
    const jobs = read('lib/jobs.ts')
    const create = jobs.slice(jobs.indexOf('export async function createJob('), jobs.indexOf('.insert(row)'))
    expect(create).not.toContain('raw_source_data')
  })
})

// ── G2 the error log keeps only the source job id ───────────────────────────

const NULL_SHAPES: [string, unknown][] = [
  ['nothing passed', undefined],
  ['null', null],
  ['an empty object', {}],
  ['an empty string id', { source_job_id: '' }],
  ['a number id', { source_job_id: 12345 }],
  ['an object id', { source_job_id: { a: 1 } }],
  ['a provider record without the key', providerRecord(7, 'Role seven')],
  ['an array', [{ source_job_id: 'x' }]],
]

describe('G2 logProviderError stores only { source_job_id } or null', () => {
  const log = (raw: unknown) => providers.logProviderError('prov-1', 'run-9', 'TYPE_X', 'CODE_Y', 'Message z', raw as Record<string, unknown>)

  it('inserts exactly the six columns with today\'s first five values', async () => {
    await log({ source_job_id: 'abc-1', title: 'Secret title', description: 'x'.repeat(1000) })
    expect(state.inserts.map((call) => call.table)).toStrictEqual(['provider_errors'])
    expect(errorRows()[0]).toStrictEqual({
      provider_id: 'prov-1',
      run_id: 'run-9',
      error_type: 'TYPE_X',
      error_code: 'CODE_Y',
      error_message: 'Message z',
      raw_job_data: { source_job_id: 'abc-1' },
    })
  })

  it.each(NULL_SHAPES)('stores null for %s', async (_name, raw) => {
    await log(raw)
    expect(errorRows()[0].raw_job_data).toBeNull()
  })

  it('never stores another key', async () => {
    await log({ source_job_id: 'k-1', id: 'p-1', company: 'c', nested: { source_job_id: 'deep' } })
    expect(Object.keys(errorRows()[0].raw_job_data as object)).toStrictEqual(['source_job_id'])
  })

  it('the helper never throws, even on a hostile object', () => {
    const hostile = Object.defineProperty({}, 'source_job_id', { get() { throw new Error('boom') } })
    expect(providers.errorLogContext(hostile)).toBeNull()
  })

  it.each([
    ['a 1 MB plain id', { source_job_id: 'x'.repeat(1_000_000) }],
    ['a 1 MB record with an id', { source_job_id: 'id-1', blob: 'y'.repeat(1_000_000), ...Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, 'z'.repeat(100)])) }],
    ['a 1 MB record without an id', { blob: 'y'.repeat(1_000_000) }],
    ['multi-byte characters', { source_job_id: '€'.repeat(500) }],
    ['emoji pairs', { source_job_id: '😀'.repeat(500) }],
    ['characters JSON escapes', { source_job_id: '\u0001"\\'.repeat(300) }],
  ])('stored JSON stays within 300 bytes: %s', async (_name, raw) => {
    await log(raw)
    const stored = errorRows()[0].raw_job_data
    expect(Buffer.byteLength(JSON.stringify(stored), 'utf8')).toBeLessThanOrEqual(300)
  })

  it('a long id is cut to at most 200 characters, never splitting a character pair', () => {
    expect(providers.errorLogContext({ source_job_id: 'x'.repeat(1_000_000) })).toStrictEqual({ source_job_id: 'x'.repeat(200) })
    const emoji = providers.errorLogContext({ source_job_id: '😀'.repeat(500) })?.source_job_id ?? ''
    expect(emoji.length).toBeGreaterThan(0)
    expect('😀'.repeat(500).startsWith(emoji)).toBe(true)
    expect(Array.from(emoji).every((ch) => ch === '😀')).toBe(true)
  })

  it('an id of up to 200 plain characters is kept exactly', () => {
    for (const id of ['a', 'p-123', 'X'.repeat(200), 'adzuna:1234567890']) {
      expect(providers.errorLogContext({ source_job_id: id })).toStrictEqual({ source_job_id: id })
    }
  })
})

// ── G3 the admin screen shows the same text ─────────────────────────────────

// A copy of the admin providers page rule (extractSourceJobId).
function shownId(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null
  const v = raw.source_job_id
  return typeof v === 'string' && v.length > 0 ? v : null
}

function adminDirs(): string[] {
  const layouts = execFileSync('git', ['ls-files', 'app/*/layout.tsx'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return layouts
    .filter((file) => read(file).includes('requireAdmin'))
    .flatMap((file) => {
      const dir = file.slice('app/'.length, file.length - '/layout.tsx'.length)
      return [`app/${dir}/`, `app/api/${dir}/`]
    })
}

describe('G3 admin display identity', () => {
  const SHAPES: [string, unknown][] = [
    ...NULL_SHAPES,
    ['a string id', { source_job_id: 'p-42', title: 'Role' }],
    ['a 200-character id', { source_job_id: 'Q'.repeat(200) }],
  ]

  it.each(SHAPES)('stored before and after give the same shown text: %s', (_name, raw) => {
    const before = (raw ?? null) as Record<string, unknown> | null
    const after = providers.errorLogContext(raw)
    expect(shownId(after)).toBe(shownId(Array.isArray(before) ? null : before))
  })

  it('the copied rule is the admin page\'s rule, and that page is untouched by DL-1', () => {
    const dirs = adminDirs()
    expect(dirs).toHaveLength(2)
    const page = `${dirs[0]}providers/[slug]/page.tsx`
    const text = read(page)
    expect(text).toContain([
      'function extractSourceJobId(raw: Record<string, unknown> | null): string | null {',
      '  if (!raw) return null',
      '  const v = raw.source_job_id',
      "  return typeof v === 'string' && v.length > 0 ? v : null",
      '}',
    ].join('\n'))
    expect(dl1Touched()).not.toContain(page)
  })
})

// ── G4 the two call sites log the same events ───────────────────────────────

describe('G4 import error events', () => {
  it('a rejected job logs one VALIDATE_FAILED / VALIDATION_REJECT row with today\'s message', async () => {
    const raw = providerRecord(8, 'Rejected role')
    feed([raw, providerRecord(9, 'Role nine')])
    await runProviderImport('example', 'cron')
    expect(errorRows()).toStrictEqual([{
      provider_id: 'provider-1',
      run_id: 'run-1',
      error_type: 'VALIDATE_FAILED',
      error_code: 'VALIDATION_REJECT',
      error_message: 'Job "Rejected role" at "https://apply.example/8" failed validation',
      raw_job_data: null,
    }])
  })

  it('a failed insert logs one INSERT_FAILED row with today\'s code and message', async () => {
    feed([providerRecord(10, 'Role ten'), providerRecord(11, 'Role eleven')])
    state.batchError = OTHER
    state.singleErrors = [{ code: 'XX002', message: 'row problem' }, { message: 'no code problem' }]
    await runProviderImport('example', 'cron')
    expect(errorRows()).toStrictEqual([
      { provider_id: 'provider-1', run_id: 'run-1', error_type: 'INSERT_FAILED', error_code: 'XX002', error_message: 'row problem', raw_job_data: null },
      { provider_id: 'provider-1', run_id: 'run-1', error_type: 'INSERT_FAILED', error_code: 'INSERT_ERROR', error_message: 'no code problem', raw_job_data: null },
    ])
  })

  it('a slug clash on every attempt logs SLUG_CONFLICT', async () => {
    feed([providerRecord(12, 'Role twelve')])
    state.batchError = SLUG_CLASH
    state.singleErrors = [SLUG_CLASH, SLUG_CLASH, SLUG_CLASH]
    await runProviderImport('example', 'cron')
    expect(errorRows().map((row) => [row.error_type, row.error_code, row.raw_job_data])).toStrictEqual([['INSERT_FAILED', 'SLUG_CONFLICT', null]])
  })

  it('a dedup conflict logs no error row', async () => {
    feed([providerRecord(13, 'Role thirteen')])
    state.batchError = DEDUP_CLASH
    state.singleErrors = [DEDUP_CLASH]
    const result = await runProviderImport('example', 'cron')
    expect(result.body).toMatchObject({ ok: true, inserted: 0, deduplicated: 1 })
    expect(errorRows()).toStrictEqual([])
  })

  it('a raw record that does carry a source_job_id keeps only that id', async () => {
    const raw = { ...providerRecord(14, 'Rejected fourteen'), source_job_id: 'sj-14' }
    feed([raw])
    await runProviderImport('example', 'cron')
    expect(errorRows().map((row) => row.raw_job_data)).toStrictEqual([{ source_job_id: 'sj-14' }])
  })
})

// ── G5 retention 14 days ────────────────────────────────────────────────────

describe('G5 import error log retention', () => {
  it('keeps 14 days with the same limits', () => {
    expect(IMPORT_LOG_RETENTION_DAYS).toBe(14)
    const now = Date.parse('2026-11-21T07:45:00.000Z')
    expect(retentionCutoff(new Date(now))).toBe(new Date(now - 14 * DAY).toISOString())
    expect([BATCH_SIZE, DELETE_PART_SIZE, MAX_BATCHES, TIME_BUDGET_MS]).toStrictEqual([500, 100, 20, 40_000])
  })

  it('the alerts guide and the route comment say 14 days, not 90', () => {
    const doc = read('docs/ALERTS.md')
    const start = doc.indexOf('## Import log clean-up')
    const paragraph = doc.slice(start, doc.indexOf('\n## ', start + 1))
    expect(start).toBeGreaterThan(0)
    expect(paragraph).toContain('older than 14 days')
    expect(paragraph).not.toMatch(/\b90\b/)
    const route = read('app/api/cron/prune-import-logs/route.ts')
    expect(route).toContain('// Deletes import error log rows older than 14 days (lib/import-log-retention.ts).')
    expect(route).not.toMatch(/\b90 days\b/)
  })

  it('the schedule is unchanged', () => {
    expect(read('vercel.json')).toContain('{ "path": "/api/cron/prune-import-logs", "schedule": "45 7 * * *" }')
  })
})

// ── G6 the record file 0022 ─────────────────────────────────────────────────

describe('G6 migrations/0022 (record file, not applied)', () => {
  const files = () => execFileSync('git', ['ls-files', 'migrations'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  const FILE = 'migrations/0022_jobs_drop_raw_source_data.sql'

  it('exactly one 0022 file and, after it, only the three LB-1 records', () => {
    expect(files().filter((f) => /^migrations\/0022_/.test(f))).toStrictEqual([FILE])
    expect(files().filter((f) => /^migrations\/(002[3-9]|00[3-9]\d|0[1-9]\d\d)_/.test(f))).toStrictEqual([
      'migrations/0023_ops_database_size.sql',
      'migrations/0024_provider_runs_drop_raw_response_sample.sql',
      'migrations/0025_jobs_drop_idx_employer_email.sql',
    ])
  })

  it('the header says NOT APPLIED, D287 and DL-2', () => {
    const header = read(FILE).split('\n').filter((line) => line.startsWith('--')).join('\n')
    for (const words of ['NOT APPLIED', 'D287', 'DL-2', '21 Nov 2026']) expect(header).toContain(words)
  })

  it('its only statements are the lock limit and the drop', () => {
    const code = read(FILE).split('\n').map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('--'))
    expect(code).toStrictEqual([
      "SET lock_timeout = '3s';",
      'ALTER TABLE public.jobs DROP COLUMN IF EXISTS raw_source_data;',
    ])
  })

  it('the undo and the space note are written as comments', () => {
    const comments = read(FILE).split('\n').filter((line) => line.startsWith('--')).join('\n')
    expect(comments).toContain('-- UNDO (structure only; the data comes back only from the backup): ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS raw_source_data jsonb;')
    expect(comments).toContain('VACUUM FULL public.jobs')
  })

  it('the README lists 0022 as not applied yet', () => {
    const row = read('migrations/README.md').split('\n').find((line) => line.startsWith('| `0022_'))
    expect(row).toBeDefined()
    expect(row).toContain('not applied yet')
  })
})

// ── G7 nothing out of scope ─────────────────────────────────────────────────

function dl1Touched(): string[] {
  const commits = execFileSync('git', ['log', '--format=%H', '--grep=^DL-1:', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return commits.flatMap((sha) => execFileSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', sha], { encoding: 'utf8' }).split('\n').filter(Boolean))
}

describe('G7 scope', () => {
  const OUT = [
    'app/api/ingest/', 'app/api/jobs/manage/', 'lib/canonical.ts', 'app/sitemap', 'app/sitemaps/', 'app/et-sitemap/',
    'app/jobs/', 'components/', 'vercel.json', 'next.config', 'middleware', 'package.json', 'package-lock.json',
    'CLAUDE.md', 'docs/AGENT-RULES.md', '.env.example', 'migrations/000', 'migrations/001', 'migrations/0020', 'migrations/0021',
  ]
  const ALLOWED = [
    'lib/ingestion/run-provider-import.ts', 'lib/jobs.ts', 'lib/providers.ts', 'lib/import-log-retention.ts',
    'app/api/cron/prune-import-logs/route.ts', 'docs/ALERTS.md', 'lib/import-log-retention.test.ts',
    'migrations/0022_jobs_drop_raw_source_data.sql', 'migrations/README.md', 'lib/dl-one.test.ts',
  ]

  it('no DL-1 commit touches a file out of scope (checked where the history is available)', () => {
    const touched = dl1Touched()
    expect(touched.filter((file) => OUT.some((out) => file.startsWith(out)))).toStrictEqual([])
    expect(touched.filter((file) => file.startsWith('lib/ingestion/') && file !== 'lib/ingestion/run-provider-import.ts')).toStrictEqual([])
    expect(touched.filter((file) => adminDirs().some((dir) => file.startsWith(dir)))).toStrictEqual([])
    expect(touched.filter((file) => !ALLOWED.includes(file))).toStrictEqual([])
  })

  it('the ingest characterisation test is byte-identical', () => {
    const hash = createHash('sha256').update(readFileSync(join(ROOT, 'app/api/ingest/[slug]/route.test.ts'))).digest('hex')
    expect(hash).toBe('99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627')
  })
})
