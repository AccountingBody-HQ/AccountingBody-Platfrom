import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// JF-1 guards: for NEW imports, "hybrid" and "global" never make a job
// remote and vague locations are not "Worldwide"; Adzuna queries the search
// words saved for the provider (else the built-in list); import error rows
// keep the normalised job's own source_job_id. Live rows are not changed.

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

// The real logProviderError and errorLogContext stay; only the run and
// health bookkeeping is replaced.
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

import { normalise } from '@/lib/ingestion/normalise'
import { adzunaAdapter, adzunaKeywordList } from '@/lib/adapters/adzuna'
import { ADZUNA_QUERY_KEYWORDS } from '@/lib/ingestion/keywords'
import { runProviderImport } from '@/lib/ingestion/run-provider-import'
import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) vi.spyOn(console, level).mockImplementation(() => {})
  state.inserts = []
  state.batchError = null
  state.singleErrors = []
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ── G1 remote v3 ────────────────────────────────────────────────────────────

const BASE_MAPPING = {
  title: 'title',
  company_name: 'company_name',
  location_text: 'location_text',
  description: 'description',
  application_url: 'application_url',
}

function placeFor(title: string, locationText: string) {
  const job = normalise({
    title,
    company_name: 'Acme Ltd',
    location_text: locationText,
    description: 'A role for an accountant.',
    application_url: 'https://example.com/apply',
  }, makeProvider({ field_mapping: BASE_MAPPING }))
  return { remote: job.location_remote, country: job.location_country }
}

describe('G1 remote v3 (new imports)', () => {
  it.each([
    ['Financial Accountant', 'Hybrid – London', false, null],
    ['Financial Accountant', 'Hybrid / Remote', false, null],
    ['Financial Accountant', 'Remote (Hybrid)', false, null],
    ['Hybrid Accountant', 'Remote', false, null],
    ['Accountant (Hybrid)', 'London, UK', false, 'United Kingdom'],
    ['Global Payroll Manager', 'London', false, null],
    ['Head of Global Tax', 'London, UK', false, 'United Kingdom'],
    ['Financial Accountant', 'Global', false, null],
    ['Financial Accountant', 'global', false, null],
    ['Financial Accountant', '', false, null],
    ['Financial Accountant', '   ', false, null],
    ['Financial Accountant', 'Multiple locations', false, null],
    ['Financial Accountant', 'Various locations', false, null],
    ['Financial Accountant', 'Flexible', false, null],
  ])('title %j, location %j → not remote (remote %s, country %s)', (title, location, remote, country) => {
    expect(placeFor(title, location)).toStrictEqual({ remote, country })
  })

  it.each([
    ['Financial Accountant', 'Remote', true, 'Worldwide'],
    ['Financial Accountant', 'Worldwide', true, 'Worldwide'],
    ['Financial Accountant', 'Anywhere', true, 'Worldwide'],
    ['Financial Accountant', 'Work from home', true, 'Worldwide'],
    ['Financial Accountant', 'Remote – UK', true, 'Worldwide'],
    ['Financial Accountant', 'Fully remote', true, 'Worldwide'],
    ['Financial Accountant', 'Remote - EMEA', true, 'Worldwide'],
    ['Financial Accountant', 'Remote Global', true, 'Worldwide'],
    ['Financial Accountant', 'Flexible location', true, 'Worldwide'],
    ['Financial Accountant', 'Remote, UK', true, 'United Kingdom'],
    ['Remote Accountant', 'Manchester', true, null],
    ['Accountant', 'Distributed', true, 'Worldwide'],
  ])('title %j, location %j → still remote (remote %s, country %s)', (title, location, remote, country) => {
    expect(placeFor(title, location)).toStrictEqual({ remote, country })
  })

  it.each([
    ['Financial Accountant', 'London, UK', false, 'United Kingdom'],
    ['Financial Accountant', 'Manchester', false, null],
    ['Financial Accountant', 'Hoddesdon, Hertfordshire', false, null],
  ])('a plain place is unchanged: %j / %j', (title, location, remote, country) => {
    expect(placeFor(title, location)).toStrictEqual({ remote, country })
  })

  it('a hybrid job keeps every other field: city, title, location text', () => {
    const job = normalise({
      title: 'Hybrid Accountant',
      company_name: 'Acme Ltd',
      location_text: 'Leeds, UK',
      description: 'A role for an accountant.',
      application_url: 'https://example.com/apply',
    }, makeProvider({ field_mapping: BASE_MAPPING }))
    expect([job.title, job.location_text, job.location_city, job.location_country, job.location_remote])
      .toStrictEqual(['Hybrid Accountant', 'Leeds, UK', 'Leeds', 'United Kingdom', false])
  })
})

// ── G2 Adzuna search words ──────────────────────────────────────────────────

function stubAdzuna(): string[] {
  const asked: string[] = []
  vi.stubEnv('ADZUNA_APP_ID', 'test-id')
  vi.stubEnv('ADZUNA_APP_KEY', 'test-key')
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    asked.push(new URL(String(input)).searchParams.get('what') ?? '')
    return new Response(JSON.stringify({ results: [] }), { status: 200 })
  }))
  return asked
}

function adzunaProvider(keywords: unknown, cursor: number | null = 0) {
  return makeProvider({
    slug: 'adzuna-test',
    adapter_key: 'adzuna',
    base_url: 'https://adzuna.example/v1/api/jobs/gb/search',
    keywords: keywords as string[],
    keyword_cursor: cursor,
  })
}

describe('G2 Adzuna uses the saved search words', () => {
  it('the helper cleans the saved list: trimmed, blanks dropped, case-insensitive duplicates dropped, order kept', () => {
    expect(adzunaKeywordList(['  Payroll ', 'tax', '', '   ', 'PAYROLL', 'Audit', 'Tax'])).toStrictEqual(['Payroll', 'tax', 'Audit'])
  })

  it.each([
    ['empty', []],
    ['all blank', ['', '  ', '\t']],
    ['null', null],
    ['undefined', undefined],
    ['not an array', 'payroll'],
    ['no strings', [1, null, {}]],
  ])('the helper falls back to the built-in list when the saved list is %s', (_name, saved) => {
    expect(adzunaKeywordList(saved)).toStrictEqual(ADZUNA_QUERY_KEYWORDS)
  })

  it('a provider with saved words queries only those, in order, and the next cursor wraps on that list', async () => {
    const asked = stubAdzuna()
    const result = await adzunaAdapter.fetch(adzunaProvider([' payroll ', 'Tax', 'PAYROLL', 'audit']))
    expect(asked).toStrictEqual(['payroll', 'Tax', 'audit'])
    expect(result.nextCursor).toBe(0)
  })

  it('an empty or all-blank saved list queries the built-in list', async () => {
    for (const saved of [[], ['', '  ']]) {
      const asked = stubAdzuna()
      const result = await adzunaAdapter.fetch(adzunaProvider(saved, 0))
      expect(asked).toStrictEqual(ADZUNA_QUERY_KEYWORDS.slice(0, 12))
      expect(result.nextCursor).toBe(12)
    }
  })

  it('a stored cursor larger than the list never indexes out of range', async () => {
    const asked = stubAdzuna()
    const result = await adzunaAdapter.fetch(adzunaProvider(['a', 'b', 'c'], 66))
    expect(asked).toStrictEqual(['a', 'b', 'c'])
    expect(asked.every((word) => word.length > 0)).toBe(true)
    expect(result.nextCursor).toBe(0)
  })

  it('the cursor works modulo the list in use (14 saved words, cursor 10 → wraps)', async () => {
    const words = Array.from({ length: 14 }, (_, i) => `w${i}`)
    const asked = stubAdzuna()
    const result = await adzunaAdapter.fetch(adzunaProvider(words, 10))
    expect(asked).toStrictEqual(['w10', 'w11', 'w12', 'w13', 'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'])
    expect(result.nextCursor).toBe(8)
  })

  it('a negative or unusable cursor starts inside the list', async () => {
    for (const cursor of [-1, Number.NaN, 2.5, null]) {
      const asked = stubAdzuna()
      await adzunaAdapter.fetch(adzunaProvider(['a', 'b', 'c'], cursor as number | null))
      expect(asked).toHaveLength(3)
      expect([...asked].sort()).toStrictEqual(['a', 'b', 'c'])
    }
  })

  it('a preview call never returns a next cursor', async () => {
    stubAdzuna()
    const result = await adzunaAdapter.fetch(adzunaProvider(['a', 'b']), { maxKeywords: 1 })
    expect(result.nextCursor).toBeUndefined()
  })

  it('opts.keyword wins over the saved words', async () => {
    const asked = stubAdzuna()
    const result = await adzunaAdapter.fetch(adzunaProvider(['a', 'b']), { keyword: 'treasury' })
    expect(asked).toStrictEqual(['treasury'])
    expect(result.nextCursor).toBeUndefined()
  })
})

// ── G3 error rows keep the job's own id ─────────────────────────────────────

const ID_MAPPING = {
  title: 'title',
  company_name: 'company',
  location_text: 'location',
  description: 'description',
  application_url: 'redirect_url',
  source_job_id: 'id',
}

// A provider's own record (Adzuna-like keys: the id is under "id").
function record(n: number, title: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `adz-${n}`,
    title,
    company: `Company ${n}`,
    location: 'London, UK',
    description: `Description ${n}`,
    redirect_url: `https://apply.example/${n}`,
    ...extra,
  }
}

const OTHER: DbError = { code: 'XX001', message: 'batch problem' }
const errorRows = () => state.inserts.filter((call) => call.table === 'provider_errors').map((call) => call.payload as Record<string, unknown>)

function feed(raws: Record<string, unknown>[], mapping: Record<string, string> = ID_MAPPING) {
  vi.mocked(providers.findProvider).mockResolvedValue(
    makeProvider({ slug: 'example', name: 'Test Provider', field_mapping: mapping }),
  )
  vi.mocked(providers.createProviderRun).mockResolvedValue({ id: 'run-1' } as never)
  vi.mocked(getAdapter).mockReturnValue({
    fetch: vi.fn().mockResolvedValue({ jobs: raws, pagesFetched: 1, totalAvailable: raws.length }),
  } as never)
}

describe('G3 error rows keep the source_job_id', () => {
  it('a validation reject logs { source_job_id: <the job id> }', async () => {
    feed([record(8, 'Rejected role'), record(9, 'Role nine')])
    await runProviderImport('example', 'cron')
    expect(errorRows().map((row) => [row.error_type, row.error_code, row.raw_job_data]))
      .toStrictEqual([['VALIDATE_FAILED', 'VALIDATION_REJECT', { source_job_id: 'adz-8' }]])
  })

  it('an insert failure logs { source_job_id: <the job id> }', async () => {
    feed([record(10, 'Role ten'), record(11, 'Role eleven')])
    state.batchError = OTHER
    state.singleErrors = [{ code: 'XX002', message: 'row problem' }, null]
    await runProviderImport('example', 'cron')
    expect(errorRows().map((row) => [row.error_type, row.error_code, row.raw_job_data]))
      .toStrictEqual([['INSERT_FAILED', 'XX002', { source_job_id: 'adz-10' }]])
  })

  it('the provider record\'s own keys are never read: the normalised id wins', async () => {
    feed([record(14, 'Rejected fourteen', { source_job_id: 'raw-key-14' })])
    await runProviderImport('example', 'cron')
    expect(errorRows().map((row) => row.raw_job_data)).toStrictEqual([{ source_job_id: 'adz-14' }])
  })

  it('a job without an id logs null (identity)', async () => {
    const { source_job_id: _unused, ...noId } = ID_MAPPING
    void _unused
    feed([record(15, 'Rejected fifteen')], noId)
    await runProviderImport('example', 'cron')
    expect(errorRows().map((row) => row.raw_job_data)).toStrictEqual([null])
  })

  it('the runner no longer reads raw_source_data at all', () => {
    expect(read('lib/ingestion/run-provider-import.ts')).not.toContain('raw_source_data')
    expect(read('lib/ingestion/run-provider-import.ts').match(/\{ source_job_id: job\.source_job_id \}/g)).toHaveLength(2)
  })

  it('errorLogContext is unchanged (identity)', () => {
    expect(providers.errorLogContext({ source_job_id: 'x'.repeat(300) })).toStrictEqual({ source_job_id: 'x'.repeat(200) })
    expect(providers.errorLogContext({ source_job_id: null })).toBeNull()
    expect(providers.errorLogContext({ id: 'p-1' })).toBeNull()
  })
})

// ── G4 scope and identity ───────────────────────────────────────────────────

function adminDirs(): string[] {
  const layouts = execFileSync('git', ['ls-files', 'app/*/layout.tsx'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return layouts
    .filter((file) => read(file).includes('requireAdmin'))
    .flatMap((file) => {
      const dir = file.slice('app/'.length, file.length - '/layout.tsx'.length)
      return [`app/${dir}/`, `app/api/${dir}/`]
    })
}

function jf1Touched(): string[] {
  const commits = execFileSync('git', ['log', '--format=%H', '--grep=^JF-1:', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return commits.flatMap((sha) => execFileSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', sha], { encoding: 'utf8' }).split('\n').filter(Boolean))
}

describe('G4 scope and identity', () => {
  const OUT = [
    'migrations/', 'app/jobs/', 'lib/jobs.ts', 'components/', 'app/api/cron/', 'app/api/ingest/', 'lib/providers.ts',
    'lib/ingestion/keywords.ts', 'vercel.json', 'next.config', 'middleware', 'package.json', 'package-lock.json',
    'CLAUDE.md', 'docs/AGENT-RULES.md', '.env.example',
  ]
  const ALLOWED = [
    'lib/ingestion/normalise.ts', 'lib/adapters/adzuna.ts', 'lib/ingestion/run-provider-import.ts',
    'lib/dl-one.test.ts', 'lib/jf-one.test.ts',
  ]

  it('no JF-1 commit touches a file out of scope (checked where the history is available)', () => {
    const touched = jf1Touched()
    expect(touched.filter((file) => OUT.some((out) => file.startsWith(out)))).toStrictEqual([])
    expect(touched.filter((file) => adminDirs().some((dir) => file.startsWith(dir)))).toStrictEqual([])
    expect(touched.filter((file) => !ALLOWED.includes(file))).toStrictEqual([])
  })

  it('the similar-jobs kill switch line is byte-identical', () => {
    const line = "  if (process.env.SIMILAR_JOBS_ENABLED !== 'true') return []\n"
    expect(read('lib/jobs.ts').split(line)).toHaveLength(2)
  })

  it('jobs inserts still never name raw_source_data; the normalised job still carries it in memory', () => {
    expect(read('lib/ingestion/run-provider-import.ts')).not.toMatch(/raw_source_data\s*:/)
    expect(read('lib/ingestion/normalise.ts')).toContain('  raw_source_data: RawJob\n')
  })

  it('the ingest characterisation test is byte-identical', () => {
    const hash = createHash('sha256').update(readFileSync(join(ROOT, 'app/api/ingest/[slug]/route.test.ts'))).digest('hex')
    expect(hash).toBe('99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627')
  })
})
