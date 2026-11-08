// Nightly clean-up of import error logs (provider_errors).
//
// Rows whose created_at is older than IMPORT_LOG_RETENTION_DAYS are removed in
// small batches. Only this one table is read or changed; import run records
// and job rows are kept.
//
// The switch (IMPORT_LOG_RETENTION) is read by the route:
// - "on": deletes
// - "dry-run": reads one batch and answers how many rows it found (at most
//   one batch), deleting nothing
// - anything else: does nothing
//
// Limits per run: BATCH_SIZE rows per batch, MAX_BATCHES batches, and no new
// batch once TIME_BUDGET_MS have passed since the run began. Nothing is
// retried; the first problem ends the run.

export const IMPORT_LOG_TABLE = 'provider_errors'
export const IMPORT_LOG_RETENTION_DAYS = 90
export const BATCH_SIZE = 500
export const DELETE_PART_SIZE = 100
export const MAX_BATCHES = 20
export const TIME_BUDGET_MS = 40_000

const DAY_MS = 24 * 60 * 60 * 1000

export type RetentionMode = 'off' | 'dry-run' | 'on'

export function retentionMode(value: string | undefined): RetentionMode {
  if (value === 'on') return 'on'
  if (value === 'dry-run') return 'dry-run'
  return 'off'
}

// The oldest created_at that is kept, as an ISO string. Rows strictly older
// than this are due.
export function retentionCutoff(now: Date): string {
  return new Date(now.getTime() - IMPORT_LOG_RETENTION_DAYS * DAY_MS).toISOString()
}

export type RowId = string | number

// Database steps; each one throws on any problem.
export type RetentionStore = {
  // ids of up to `limit` rows with created_at < cutoff, in no particular order
  findDue: (cutoff: string, limit: number) => Promise<RowId[]>
  // deletes these ids and answers how many rows were deleted
  remove: (ids: RowId[]) => Promise<number>
}

export type RetentionResult =
  | { ok: true; mode: 'on'; deleted: number; more: boolean }
  | { ok: true; mode: 'dry-run'; wouldDeleteAtLeast: number }
  | { ok: false; deleted: number; error: unknown }

export async function runRetention(
  mode: 'on' | 'dry-run',
  store: RetentionStore,
  clock: () => number,
): Promise<RetentionResult> {
  const startedAt = clock()
  const cutoff = retentionCutoff(new Date(startedAt))
  let deleted = 0
  try {
    if (mode === 'dry-run') {
      const ids = await store.findDue(cutoff, BATCH_SIZE)
      return { ok: true, mode, wouldDeleteAtLeast: ids.length }
    }
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      if (clock() - startedAt >= TIME_BUDGET_MS) return { ok: true, mode, deleted, more: true }
      const ids = await store.findDue(cutoff, BATCH_SIZE)
      for (let start = 0; start < ids.length; start += DELETE_PART_SIZE) {
        deleted += await store.remove(ids.slice(start, start + DELETE_PART_SIZE))
      }
      if (ids.length < BATCH_SIZE) return { ok: true, mode, deleted, more: false }
    }
    return { ok: true, mode, deleted, more: true }
  } catch (error) {
    return { ok: false, deleted, error }
  }
}
