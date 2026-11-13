import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeProvider } from '@/lib/test-helpers/provider-fixture'

// A failed import answers and stores one fixed text, "Import failed (<code>)",
// never the error's own message.

vi.mock('@/lib/providers', () => ({
  findProvider: vi.fn(),
  createProviderRun: vi.fn(),
  completeProviderRun: vi.fn().mockResolvedValue(undefined),
  failProviderRun: vi.fn().mockResolvedValue(undefined),
  updateProviderHealth: vi.fn().mockResolvedValue(undefined),
  updateProviderDataQuality: vi.fn().mockResolvedValue(undefined),
  logProviderError: vi.fn().mockResolvedValue(undefined),
  incrementProviderJobsToday: vi.fn().mockResolvedValue(undefined),
  updateProviderKeywordCursor: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/adapters', () => ({ getAdapter: vi.fn() }))
vi.mock('@/lib/ingestion/normalise', () => ({
  normalise: vi.fn((raw: Record<string, unknown>) => ({ ...raw, raw_source_data: raw })),
}))
vi.mock('@/lib/ingestion/validate', () => ({
  validate: vi.fn((jobs: unknown[]) => ({ valid: jobs, rejected: [] })),
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
vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(() => ({
    from: () => ({
      insert: () => ({ select: async () => ({ error: null, data: [] }) }),
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    }),
  })),
}))

import { runProviderImport } from './run-provider-import'
import * as providers from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'

const SECRET = 'SECRETTEXT relation x does not exist'

function withCode(code: unknown, message = SECRET): Error {
  return Object.assign(new Error(message), { code })
}

function failWith(thrown: unknown) {
  vi.mocked(getAdapter).mockReturnValue({ fetch: vi.fn().mockRejectedValue(thrown) } as never)
}

// The three values that must carry the fixed text.
async function failureValues(thrown: unknown) {
  failWith(thrown)
  const result = await runProviderImport('example', 'manual')
  const body = result.body as { ok: boolean; error: unknown }
  const run = vi.mocked(providers.failProviderRun).mock.calls
  const health = vi.mocked(providers.updateProviderHealth).mock.calls
  expect(result.status).toBe(500)
  expect(body.ok).toBe(false)
  expect(run).toHaveLength(1)
  expect(run[0][0]).toBe('run-1')
  expect(run[0][2]).toBe('INGESTION_ERROR')
  expect(health).toHaveLength(1)
  expect(health[0][0]).toBe('provider-1')
  expect(health[0][1]).toBe('failure')
  expect((health[0][2] as { errorCode?: unknown }).errorCode).toBe('INGESTION_ERROR')
  return {
    answer: body.error,
    runMessage: run[0][1],
    healthMessage: (health[0][2] as { errorMessage?: unknown }).errorMessage,
  }
}

function custom(name: string): Error {
  const e = new Error(SECRET)
  e.name = name
  return e
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.mocked(providers.findProvider).mockResolvedValue(
    makeProvider({ slug: 'example', field_mapping: { title: 't', company_name: 'c', application_url: 'u' } }),
  )
  vi.mocked(providers.createProviderRun).mockResolvedValue({ id: 'run-1' } as never)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('runProviderImport failed-import text', () => {
  it.each<[string, unknown, string]>([
    ['an error with a valid code', withCode('PGRST116'), 'Import failed (PGRST116)'],
    ['an error with a dotted code', withCode('ECONN.RESET-2'), 'Import failed (ECONN.RESET-2)'],
    ['an error whose code has spaces', withCode('bad code SECRETTEXT'), 'Import failed (Error)'],
    ['an error whose code is longer than 40 characters', withCode('A'.repeat(41)), 'Import failed (Error)'],
    ['an error whose code is exactly 40 characters', withCode('B'.repeat(40)), `Import failed (${'B'.repeat(40)})`],
    ['an error whose code is empty', withCode(''), 'Import failed (Error)'],
    ['an error whose code is a number', withCode(23505), 'Import failed (Error)'],
    ['a plain Error', new Error(SECRET), 'Import failed (Error)'],
    ['a TypeError', new TypeError(SECRET), 'Import failed (TypeError)'],
    ['an error with a custom short name', custom('AdapterError'), 'Import failed (AdapterError)'],
    ['an error whose name has spaces', custom('SECRETTEXT relation x'), 'Import failed (no-code)'],
    ['an error whose name is longer than 40 characters', custom('N'.repeat(41)), 'Import failed (no-code)'],
    ['an error whose name starts with a digit', custom('1Error'), 'Import failed (no-code)'],
    ['a thrown string', SECRET, 'Import failed (no-code)'],
    ['a thrown null', null, 'Import failed (no-code)'],
    ['a thrown undefined', undefined, 'Import failed (no-code)'],
    ['a thrown number', 42, 'Import failed (no-code)'],
    ['a plain object with only a message', { message: SECRET }, 'Import failed (no-code)'],
    ['a plain object with a valid code', { code: 'X1', message: SECRET }, 'Import failed (X1)'],
  ])('uses the fixed text for %s', async (_label, thrown, expected) => {
    const values = await failureValues(thrown)
    expect(values).toStrictEqual({ answer: expected, runMessage: expected, healthMessage: expected })
  })

  it('stores "no-code" when reading the code throws, and still answers fixed text', async () => {
    const hostile = {}
    Object.defineProperty(hostile, 'code', { get() { throw new Error(SECRET) } })
    const values = await failureValues(hostile)
    // The later log line's own code read also throws, so the outer
    // fixed answer is returned; the stored values use the failure text.
    expect(values).toStrictEqual({
      answer: 'Import stopped unexpectedly', runMessage: 'Import failed (no-code)', healthMessage: 'Import failed (no-code)',
    })
  })

  it.each<[string, unknown]>([
    ['an error with a bad code', withCode('relation x does not exist SECRETTEXT')],
    ['a plain Error', new Error(SECRET)],
    ['a thrown string', SECRET],
    ['a plain object', { message: SECRET, details: SECRET, hint: SECRET }],
  ])('keeps the seeded message out of every value and log line for %s', async (_label, thrown) => {
    const values = await failureValues(thrown)
    for (const v of Object.values(values)) {
      expect(typeof v).toBe('string')
      expect(v as string).not.toContain('SECRETTEXT')
      expect(v as string).not.toContain('does not exist')
    }
    const logged = JSON.stringify([
      vi.mocked(console.error).mock.calls,
      vi.mocked(console.warn).mock.calls,
      vi.mocked(console.log).mock.calls,
    ])
    expect(logged).not.toContain('SECRETTEXT')
  })

  it('still never throws when storing the failure itself fails', async () => {
    vi.mocked(providers.failProviderRun).mockRejectedValueOnce(new Error(SECRET))
    failWith(new Error(SECRET))
    const result = await runProviderImport('example', 'cron')
    expect(result).toStrictEqual({ status: 500, body: { ok: false, error: 'Import stopped unexpectedly' } })
  })

  it('still never throws for any thrown value', async () => {
    for (const thrown of [null, undefined, 0, '', SECRET, {}, [], new Error(SECRET), withCode({ toString: () => SECRET })]) {
      failWith(thrown)
      await expect(runProviderImport('example', 'cron')).resolves.toMatchObject({ status: 500 })
    }
  })
})
