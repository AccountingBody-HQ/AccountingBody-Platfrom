// Pure helpers for the scheduled import orchestrator
// (app/api/ingest/orchestrator/route.ts): which due providers run on this
// tick, and how each finished import is named in the logs.

import type { ProviderImportResult } from '@/lib/ingestion/run-provider-import'

// One import runs on each tick. Any other due providers stay due and run on
// the following ticks, one per tick.
export const IMPORTS_PER_TICK = 1

// Keeps the order it is given (getProvidersDueForFetch already orders by
// priority) and takes at most `limit` providers.
export function pickProvidersForTick<T>(due: readonly T[], limit: number): T[] {
  return due.slice(0, Math.max(0, Math.floor(limit)))
}

export type ImportOutcome = 'ok' | 'skipped' | 'failed'

export type ImportResultSummary = {
  slug: string
  status?: number
  ok: boolean
  error?: string
  outcome: ImportOutcome
}

function isSkipped(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { skipped?: unknown }).skipped === true
}

// ok: a 2xx answer that is not a skip. skipped: a 2xx skip answer (inactive
// provider, daily allowance used). failed: any other answer, or a throw.
// `ok` in the summary keeps its earlier meaning: the answer was 2xx.
export function summariseImport(slug: string, settled: PromiseSettledResult<ProviderImportResult>): ImportResultSummary {
  if (settled.status === 'rejected') {
    return { slug, ok: false, error: 'Import threw', outcome: 'failed' }
  }
  const { status, body } = settled.value
  const success = status >= 200 && status < 300
  let error: string | undefined
  if (!success) {
    const text = (body as { error?: unknown } | null)?.error
    if (typeof text === 'string') error = text
  }
  const outcome: ImportOutcome = !success ? 'failed' : isSkipped(body) ? 'skipped' : 'ok'
  return { slug, status, ok: success, error, outcome }
}

// One fixed-format line per provider: slug, outcome word, then the status
// number, or the word "threw" when there is no status. Never error text.
export function importLogLine(result: ImportResultSummary): string {
  const detail = result.status === undefined ? 'threw' : String(result.status)
  return `[orchestrator] import ${result.slug} ${result.outcome} ${detail}`
}

export type ImportCounts = { started: number; ok: number; skipped: number; failed: number; stillDue: number }

export function countImports(results: readonly ImportResultSummary[], dueCount: number): ImportCounts {
  return {
    started:  results.length,
    ok:       results.filter(r => r.outcome === 'ok').length,
    skipped:  results.filter(r => r.outcome === 'skipped').length,
    failed:   results.filter(r => r.outcome === 'failed').length,
    stillDue: Math.max(0, dueCount - results.length),
  }
}

export function closingLogLine(counts: ImportCounts): string {
  return `[orchestrator] imports: ${counts.started} started, ${counts.ok} ok, ${counts.skipped} skipped, ${counts.failed} failed, ${counts.stillDue} still due`
}
