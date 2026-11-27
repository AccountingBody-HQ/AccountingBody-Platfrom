import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// LB-1 guards (D287, D289): import runs no longer save a raw provider record;
// the import error log write checks its own result; two test lines name the
// 14-day cut-off; AGENT-RULES states the continuous way of working; the ops
// status answer gains a database-size check (words only, never the number);
// three migration records, none applied by this change.

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')

const state = vi.hoisted(() => ({
  real: false,
  updates: [] as { table: string; payload: Record<string, unknown> }[],
  inserts: [] as { table: string; payload: Record<string, unknown> }[],
  insertError: null as { message: string; code?: string; details?: string | null; hint?: string | null } | null,
  reports: [] as unknown[][],
}))

// A fake supabase-js client for lib/providers.ts (every write recorded); the
// ops status route uses the real factory with a fake network.
vi.mock('@/lib/supabase-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase-server')>()
  return {
    ...actual,
    getServerSupabase: (context: Parameters<typeof actual.getServerSupabase>[0]) => {
      if (state.real) return actual.getServerSupabase(context)
      return {
        from: (table: string) => ({
          update: (payload: Record<string, unknown>) => {
            state.updates.push({ table, payload })
            return { eq: async () => ({ data: null, error: null }) }
          },
          insert: async (payload: Record<string, unknown>) => {
            state.inserts.push({ table, payload })
            return { data: null, error: state.insertError }
          },
        }),
      }
    },
  }
})
vi.mock('@/lib/report-error', () => ({
  reportServerError: (...args: unknown[]) => {
    state.reports.push(args)
  },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

import * as providers from '@/lib/providers'
import { CHECKS, DATABASE_SIZE_WARN_BYTES, judgeDatabaseSize, opsStatusHold, summarise, type CheckName, type CheckWord } from '@/lib/ops-status'
import { GET as opsStatus } from '@/app/api/ops-status/route'

const MB = 1024 * 1024

beforeEach(() => {
  state.real = false
  state.updates = []
  state.inserts = []
  state.insertError = null
  state.reports = []
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function sourceFiles(): string[] {
  return execFileSync('git', ['ls-files', 'app', 'lib', 'components'], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file))
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

// ── G1 import runs no longer save a raw provider record ─────────────────────

describe('G1 no raw run sample', () => {
  it('the run update names exactly the run columns, without raw_response_sample', async () => {
    const metrics = {
      jobsFetched: 3, jobsInserted: 2, jobsDeduplicated: 1, jobsRejected: 0, pagesFetched: 1, durationMs: 10, responseMs: 5,
      relevanceRate: 0.5, avgDescriptionLength: 100, fieldCoverage: { title: 1 },
      rawResponseSample: { title: 'Secret raw title' },
    }
    await providers.completeProviderRun('run-1', metrics as Parameters<typeof providers.completeProviderRun>[1])
    expect(state.updates.map((u) => u.table)).toStrictEqual(['provider_runs'])
    const payload = state.updates[0].payload
    expect(payload).not.toHaveProperty('raw_response_sample')
    expect(Object.keys(payload).sort()).toStrictEqual([
      'avg_description_length', 'completed_at', 'duration_ms', 'field_coverage', 'jobs_deduplicated', 'jobs_fetched',
      'jobs_inserted', 'jobs_rejected', 'pages_fetched', 'relevance_rate', 'response_ms_avg', 'status',
    ])
    expect(JSON.stringify(payload)).not.toContain('Secret raw title')
  })

  it('the run types and the import no longer name the sample', () => {
    const lib = read('lib/providers.ts')
    expect(lib).not.toContain('rawResponseSample')
    expect(lib).not.toContain('raw_response_sample')
    expect(read('lib/ingestion/run-provider-import.ts')).not.toContain('rawResponseSample')
  })

  it('no code file names the column (admin areas included; migration file names aside)', () => {
    const files = sourceFiles().filter((file) => file !== 'lib/lb-one.test.ts')
    expect(files.length).toBeGreaterThan(100)
    expect(adminDirs().length).toBeGreaterThan(0)
    const code = (file: string) => read(file).replace(/migrations\/\d{4}_[a-z0-9_]+\.sql/g, '')
    expect(files.filter((file) => /raw_response_sample|rawResponseSample/.test(code(file)))).toStrictEqual([])
  })
})

// ── G2 the error log write checks its own result ────────────────────────────

describe('G2 logProviderError checks its result', () => {
  const log = () =>
    providers.logProviderError('prov-1', 'run-9', 'INSERT_FAILED', 'CODE_Y', 'Message z', { source_job_id: 'abc-1', title: 'Secret title' })

  it('a failed write logs one line with the code only and does not throw', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.insertError = { message: 'secret detail 9q', code: 'XX000', details: 'row detail', hint: 'hint text' }
    await expect(log()).resolves.toBeUndefined()
    expect(errorLog).toHaveBeenCalledTimes(1)
    const line = errorLog.mock.calls[0].map((part) => String(part)).join(' ')
    expect(line).toContain('XX000')
    for (const seed of ['secret detail', 'row detail', 'hint text', 'Secret title', 'Message z', 'abc-1', 'prov-1', 'run-9']) {
      expect(line).not.toContain(seed)
    }
    expect(state.reports).toStrictEqual([])
  })

  it('a failed write with no usable code logs no-code', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.insertError = { message: 'secret detail 9q' }
    await expect(log()).resolves.toBeUndefined()
    expect(errorLog).toHaveBeenCalledTimes(1)
    expect(errorLog.mock.calls[0].map((part) => String(part)).join(' ')).toContain('no-code')
  })

  it('a successful write logs nothing', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(log()).resolves.toBeUndefined()
    expect(errorLog).not.toHaveBeenCalled()
  })

  it('the inserted row is unchanged', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    state.insertError = { message: 'x', code: 'XX000' }
    await log()
    expect(state.inserts).toStrictEqual([{
      table: 'provider_errors',
      payload: {
        provider_id: 'prov-1',
        run_id: 'run-9',
        error_type: 'INSERT_FAILED',
        error_code: 'CODE_Y',
        error_message: 'Message z',
        raw_job_data: { source_job_id: 'abc-1' },
      },
    }])
  })
})

// ── G3 the retention test names the 14-day cut-off ──────────────────────────

describe('G3 cut-off date in the retention test', () => {
  const lines = read('lib/import-log-retention.test.ts').split('\n')

  it('lines 443 and 461 name the real cut-off date, not the old 90-day one', () => {
    for (const index of [442, 460]) {
      expect(lines[index]).toContain("'2026-10-24'")
      expect(lines[index]).not.toContain('2026-08-09')
    }
    expect(lines.join('\n')).not.toContain('2026-08-09')
  })

  it('that date is the date part of CUTOFF', () => {
    expect(lines[46]).toBe("const CUTOFF = '2026-10-24T12:00:00.000Z'")
  })
})

// ── G4 AGENT-RULES states owner decision D289 ───────────────────────────────

describe('G4 AGENT-RULES line 52', () => {
  const NEW_LINE =
    '- Releases that change import code (owner decision D289): changes may follow one another without waiting for an import in between; after the next real import on the new code, ONE read-only cross-check job proves them together: `provider_runs` since the release\'s success time shows at least one `completed` run with a null `error_code`, new jobs inserted, no `INSERT_FAILED` rows in `provider_errors`, and the error log slim. A provider is due when `next_fetch_at <= now()`, so one due a few seconds after a tick runs at the next tick; that is not a missed run.'
  const text = read('docs/AGENT-RULES.md')
  const lines = text.split('\n')

  it('has 75 lines and line 52 is the D289 text', () => {
    expect(lines).toHaveLength(76)
    expect(lines[75]).toBe('')
    expect(lines[51]).toBe(NEW_LINE)
    expect(text).not.toContain('the next release waits for the first real import')
  })

  it('every other line is unchanged (fingerprint of the 74 other lines on 75d2e02)', () => {
    const rest = [...lines.slice(0, 51), ...lines.slice(52)]
    expect(sha256(rest.join('\n')).slice(0, 16)).toBe('7be1f47175ae34a5')
  })
})

// ── G5 the database size check ──────────────────────────────────────────────

describe('G5 database size words', () => {
  it('warns above 300 MB', () => {
    expect(DATABASE_SIZE_WARN_BYTES).toBe(300 * MB)
    expect(DATABASE_SIZE_WARN_BYTES).toBe(314572800)
  })

  it.each([
    [null, 'unknown'],
    [undefined, 'unknown'],
    [Number.NaN, 'unknown'],
    [Number.POSITIVE_INFINITY, 'unknown'],
    [-1, 'unknown'],
    [1.5, 'unknown'],
    ['12a', 'unknown'],
    ['', 'unknown'],
    ['-5', 'unknown'],
    [' 5', 'unknown'],
    [{}, 'unknown'],
    [[1], 'unknown'],
    [true, 'unknown'],
    [0, 'ok'],
    [108 * MB, 'ok'],
    [314572800, 'ok'],
    [314572801, 'failing'],
    ['314572800', 'ok'],
    ['314572801', 'failing'],
    [501 * MB, 'failing'],
  ] as [unknown, CheckWord][])('%j → %s', (bytes, word) => {
    expect(judgeDatabaseSize(bytes)).toBe(word)
  })

  // PRIV-2 S4: data-retention is the seventh check, after database-size.
  it('CHECKS has seven names in order, database-size alerting before data-retention', () => {
    expect(CHECKS.map((check) => check.name)).toStrictEqual([
      'job-import', 'job-expiry', 'subscriber-cleanup', 'saved-jobs-cleanup', 'job-retention', 'database-size', 'data-retention',
    ])
    expect(CHECKS.find((check) => check.name === 'database-size')?.alerting).toBe(true)
  })

  const ALL_OK = Object.fromEntries(CHECKS.map((check) => [check.name, 'ok'])) as Record<CheckName, CheckWord>

  it.each([
    ['ok', 200],
    ['unknown', 503],
    ['failing', 503],
  ] as const)('summarise with database-size %s → %i', (word, status) => {
    const answer = summarise({ ...ALL_OK, ['database-size' as CheckName]: word })
    expect(answer.httpStatus).toBe(status)
    expect(answer.body.checks['database-size']).toBe(word)
    expect(Object.keys(answer.body.checks)).toHaveLength(7)
  })
})

describe('G5 ops status route reads the size and shows the word only', () => {
  const DB_URL = 'https://example.supabase.co'
  const NOW = Date.parse('2026-11-07T12:00:00.000Z')
  const net = { size: 120 * MB as unknown, sizeFails: false, sizeThrows: false, requests: [] as { path: string; method: string }[] }

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  beforeEach(() => {
    state.real = true
    net.size = 120 * MB
    net.sizeFails = false
    net.sizeThrows = false
    net.requests = []
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
    vi.stubEnv('JOB_RETENTION', undefined)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      const path = url.pathname.replace('/rest/v1/', '')
      net.requests.push({ path, method: (init?.method ?? 'GET').toUpperCase() })
      if (path === 'rpc/ops_database_size') {
        if (net.sizeThrows) throw new TypeError('network down')
        if (net.sizeFails) return json({ message: 'Could not find the function detail 7f3a', code: 'PGRST202', details: null, hint: null }, 404)
        return json(net.size)
      }
      if (path === 'provider_runs') return json([{ status: 'completed', started_at: new Date(NOW - 3600_000).toISOString() }])
      return json([])
    }))
    opsStatusHold.clear()
  })

  const call = async () => {
    const response = await opsStatus()
    const text = await response.text()
    return { status: response.status, text, body: JSON.parse(text) as { status: string; checks: Record<string, string> } }
  }

  it('a small database → 200 with seven ok words', async () => {
    const result = await call()
    expect(result.status).toBe(200)
    expect(result.body.checks).toStrictEqual({
      'job-import': 'ok', 'job-expiry': 'ok', 'subscriber-cleanup': 'ok', 'saved-jobs-cleanup': 'ok', 'job-retention': 'ok', 'database-size': 'ok', 'data-retention': 'ok',
    })
    expect(net.requests.filter((r) => r.path === 'rpc/ops_database_size')).toStrictEqual([{ path: 'rpc/ops_database_size', method: 'GET' }])
  })

  it('a missing function (until 0023) → unknown, 503, no detail in the body', async () => {
    net.sizeFails = true
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.status).toBe('attention')
    expect(result.body.checks['database-size']).toBe('unknown')
    expect(Object.keys(result.body.checks)).toHaveLength(7)
    expect(result.text).not.toContain('7f3a')
    expect(result.text).not.toContain('PGRST202')
  })

  it('a size read that throws → unknown, the other six words still shown', async () => {
    net.sizeThrows = true
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.checks).toStrictEqual({
      'job-import': 'ok', 'job-expiry': 'ok', 'subscriber-cleanup': 'ok', 'saved-jobs-cleanup': 'ok', 'job-retention': 'ok', 'database-size': 'unknown', 'data-retention': 'ok',
    })
  })

  it.each([314572801, '314572801', 501 * MB])('over the limit (%j) → failing, 503, and no digit in the body', async (size) => {
    net.size = size
    const result = await call()
    expect(result.status).toBe(503)
    expect(result.body.checks['database-size']).toBe('failing')
    expect(result.text).not.toMatch(/[0-9]/)
  })

  it('the route names the function once and never puts the size in the body', () => {
    const source = read('app/api/ops-status/route.ts')
    expect(source.match(/rpc\('ops_database_size'/g)).toHaveLength(1)
    expect(source).toContain("'database-size': ")
  })
})

// ── G6 the records and the scope ────────────────────────────────────────────

describe('G6 migration records', () => {
  const statements = (path: string) =>
    read(path).split('\n').filter((line) => line.trim() !== '' && !line.startsWith('--'))

  it('0023 creates the size function for service_role only and checks itself', () => {
    const text = read('migrations/0023_ops_database_size.sql')
    const body = statements('migrations/0023_ops_database_size.sql')
    for (const line of [
      'BEGIN;',
      'CREATE FUNCTION public.ops_database_size()',
      '  RETURNS bigint',
      '  LANGUAGE sql',
      '  STABLE',
      '  SECURITY INVOKER',
      "  SET search_path = ''",
      '  SELECT pg_catalog.pg_database_size(pg_catalog.current_database())',
      'REVOKE ALL ON FUNCTION public.ops_database_size() FROM PUBLIC, anon, authenticated;',
      'GRANT EXECUTE ON FUNCTION public.ops_database_size() TO service_role;',
      'COMMIT;',
      "NOTIFY pgrst, 'reload schema';",
    ]) expect(body).toContain(line)
    expect(body.indexOf("NOTIFY pgrst, 'reload schema';")).toBeGreaterThan(body.indexOf('COMMIT;'))
    expect(text).not.toMatch(/SECURITY DEFINER|OR REPLACE/)
    for (const check of ['prosecdef', 'proconfig', "has_function_privilege('anon'", "has_function_privilege('authenticated'", "has_function_privilege('service_role'"]) {
      expect(text).toContain(check)
    }
    expect(text).toContain('applied by M-85 BEFORE the merge')
  })

  it('0024 drops the sample column with a 3 s lock bound, after the merge', () => {
    expect(statements('migrations/0024_provider_runs_drop_raw_response_sample.sql')).toStrictEqual([
      "SET lock_timeout = '3s';",
      'ALTER TABLE public.provider_runs DROP COLUMN IF EXISTS raw_response_sample;',
    ])
    expect(read('migrations/0024_provider_runs_drop_raw_response_sample.sql')).toContain('applied by M-85 after the merge, once no deployed code writes the column')
  })

  it('0025 is one statement outside a transaction', () => {
    const text = read('migrations/0025_jobs_drop_idx_employer_email.sql')
    expect(statements('migrations/0025_jobs_drop_idx_employer_email.sql')).toStrictEqual([
      'DROP INDEX CONCURRENTLY IF EXISTS public.idx_jobs_employer_email;',
    ])
    expect(text).not.toMatch(/^\s*(BEGIN|COMMIT)\b/m)
    expect(text).toContain('cannot run inside a transaction')
  })

  it('the README lists the three records as applied; the alerts guide lists the check', () => {
    const readme = read('migrations/README.md').split('\n')
    for (const prefix of ['| `0023_ops_database_size.sql` |', '| `0024_provider_runs_drop_raw_response_sample.sql` |', '| `0025_jobs_drop_idx_employer_email.sql` |']) {
      const row = readme.find((line) => line.startsWith(prefix))
      expect(row).toBeDefined()
      expect(row).toMatch(/\| \*\*Applied [^|]*\(LB-1, D287\)\.\*\* /)
      expect(row).not.toContain('not applied yet')
    }
    expect(read('docs/ALERTS.md').split('\n').filter((line) => line.startsWith('| `database-size` |'))).toHaveLength(1)
  })
})

function lb1Touched(): string[] {
  const commits = execFileSync('git', ['log', '--format=%H', '--grep=^LB-1:', 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean)
  return commits.flatMap((sha) => execFileSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', sha], { encoding: 'utf8' }).split('\n').filter(Boolean))
}

describe('G6 scope', () => {
  const OUT = [
    'app/api/ingest/', 'lib/jobs.ts', 'app/jobs/', 'app/sitemap', 'app/sitemaps/', 'app/et-sitemap/', 'lib/canonical.ts',
    'lib/similar-jobs.ts', 'app/api/cron/', 'components/', 'vercel.json', 'next.config', 'middleware', 'package.json',
    'package-lock.json', 'CLAUDE.md', '.env.example', 'migrations/000', 'migrations/001', 'migrations/0020', 'migrations/0021',
    'migrations/0022',
  ]
  const ALLOWED = [
    'lib/ingestion/run-provider-import.ts', 'lib/providers.ts', 'lib/import-log-retention.test.ts', 'docs/AGENT-RULES.md',
    'lib/ops-status.ts', 'app/api/ops-status/route.ts', 'lib/ops-status.test.ts', 'app/api/ops-status/route.test.ts',
    'migrations/0023_ops_database_size.sql', 'migrations/0024_provider_runs_drop_raw_response_sample.sql',
    'migrations/0025_jobs_drop_idx_employer_email.sql', 'migrations/README.md', 'docs/ALERTS.md',
    'lib/page-lib-reporting.test.ts', 'lib/dl-one.test.ts', 'lib/lb-one.test.ts',
  ]

  it('no LB-1 commit touches a file out of scope (checked where the history is available)', () => {
    const touched = lb1Touched()
    expect(touched.filter((file) => OUT.some((out) => file.startsWith(out)))).toStrictEqual([])
    expect(touched.filter((file) => file.startsWith('lib/ingestion/') && file !== 'lib/ingestion/run-provider-import.ts')).toStrictEqual([])
    expect(touched.filter((file) => adminDirs().some((dir) => file.startsWith(dir)))).toStrictEqual([])
    expect(touched.filter((file) => !ALLOWED.includes(file))).toStrictEqual([])
    expect(new Set(touched).size).toBeLessThanOrEqual(16)
  })

  it('the ingest characterisation test is byte-identical', () => {
    expect(sha256(readFileSync(join(ROOT, 'app/api/ingest/[slug]/route.test.ts')))).toBe('99c20fa8a9d3934f6cd3cc9daa43e9030bdcb04e0e196dec89274262c22eb627')
  })

  it('the similar-jobs kill switch line is unchanged', () => {
    expect(read('lib/jobs.ts').split('\n')).toContain("  if (process.env.SIMILAR_JOBS_ENABLED !== 'true') return []")
  })

  it('the provider run update still writes every other metric (the import tests rely on it)', () => {
    expect(read('lib/providers.ts')).toContain('      field_coverage: metrics.fieldCoverage ?? null,')
  })
})
