// Daily clean-up of expired imported jobs (owner decision D140).
//
// Imported jobs (source other than 'employer') that are expired and whose
// closed_at is more than JOB_RETENTION_DAYS old are removed in small batches.
// Never removed: employer-posted jobs, and any job that has a row in
// job_applications. A job's saved_jobs rows go with it (database cascade,
// accepted by the owner). A removed job's page answers 404.
//
// The switch (JOB_RETENTION) is read by the route:
// - "on": deletes
// - "dry-run": reads one batch and answers how many jobs it would delete (at
//   most one batch), deleting nothing
// - anything else, or unset: does nothing
//
// The age (JOB_RETENTION_DAYS) is a whole number from 14 to 365, written
// plainly; anything else means 30.
//
// The applications guard: supabase-js cannot express a correlated NOT EXISTS
// on a flat query, so each batch reads candidate ids, then reads which of
// them have applications, and deletes only the rest. The delete repeats the
// age, status and source filter, so a row that changed in between is kept.
//
// Limits per run: BATCH_SIZE candidates per batch, MAX_BATCHES batches, and
// no new batch once TIME_BUDGET_MS have passed since the run began. Nothing
// is retried; the first problem ends the run.

export const JOB_RETENTION_DEFAULT_DAYS = 30
export const JOB_RETENTION_MIN_DAYS = 14
export const JOB_RETENTION_MAX_DAYS = 365
export const BATCH_SIZE = 500
export const PART_SIZE = 100
export const MAX_BATCHES = 20
export const TIME_BUDGET_MS = 40_000

const DAY_MS = 24 * 60 * 60 * 1000

export type JobRetentionMode = 'off' | 'dry-run' | 'on'

export function jobRetentionMode(value: string | undefined): JobRetentionMode {
  if (value === 'on') return 'on'
  if (value === 'dry-run') return 'dry-run'
  return 'off'
}

export function jobRetentionDays(value: string | undefined): number {
  if (value === undefined || !/^[1-9][0-9]{0,2}$/.test(value)) return JOB_RETENTION_DEFAULT_DAYS
  const days = Number(value)
  return days >= JOB_RETENTION_MIN_DAYS && days <= JOB_RETENTION_MAX_DAYS ? days : JOB_RETENTION_DEFAULT_DAYS
}

// The oldest closed_at that is kept, as an ISO string. Jobs closed strictly
// before this are due.
export function jobRetentionCutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString()
}

// Database steps; each one throws on any problem.
export type JobRetentionStore = {
  // ids (ascending) of up to `limit` imported, expired jobs closed before
  // cutoff, with id greater than `after` when given
  findDue: (cutoff: string, limit: number, after: string | null) => Promise<string[]>
  // which of these ids have at least one job_applications row
  withApplications: (ids: string[]) => Promise<Set<string>>
  // deletes these ids (filter repeated) and answers how many were deleted
  remove: (ids: string[], cutoff: string) => Promise<number>
}

export type JobRetentionResult =
  | { ok: true; mode: 'on'; deleted: number; kept: number; more: boolean }
  | { ok: true; mode: 'dry-run'; wouldDeleteAtLeast: number; kept: number }
  | { ok: false; deleted: number; error: unknown }

async function eligible(store: JobRetentionStore, ids: string[]): Promise<string[]> {
  const guarded = new Set<string>()
  for (let start = 0; start < ids.length; start += PART_SIZE) {
    const found = await store.withApplications(ids.slice(start, start + PART_SIZE))
    found.forEach((id) => guarded.add(id))
  }
  return ids.filter((id) => !guarded.has(id))
}

export async function runJobRetention(
  mode: 'on' | 'dry-run',
  days: number,
  store: JobRetentionStore,
  clock: () => number,
): Promise<JobRetentionResult> {
  const startedAt = clock()
  const cutoff = jobRetentionCutoff(new Date(startedAt), days)
  let deleted = 0
  let kept = 0
  try {
    if (mode === 'dry-run') {
      const ids = await store.findDue(cutoff, BATCH_SIZE, null)
      const due = await eligible(store, ids)
      return { ok: true, mode, wouldDeleteAtLeast: due.length, kept: ids.length - due.length }
    }
    let after: string | null = null
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      if (clock() - startedAt >= TIME_BUDGET_MS) return { ok: true, mode, deleted, kept, more: true }
      const ids = await store.findDue(cutoff, BATCH_SIZE, after)
      const due = await eligible(store, ids)
      kept += ids.length - due.length
      for (let start = 0; start < due.length; start += PART_SIZE) {
        deleted += await store.remove(due.slice(start, start + PART_SIZE), cutoff)
      }
      if (ids.length < BATCH_SIZE) return { ok: true, mode, deleted, kept, more: false }
      after = ids[ids.length - 1]
    }
    return { ok: true, mode, deleted, kept, more: true }
  } catch (error) {
    return { ok: false, deleted, error }
  }
}
