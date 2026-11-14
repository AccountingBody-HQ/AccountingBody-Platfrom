import type { NormalisedJob } from './normalise'
import { getServerSupabase } from '../supabase-server'
import { slugify } from '../jobs'
import { reportServerError } from '../report-error'

// The database read here (deduplicate) is used only by provider ingestion.
function getSupabase() {
  return getServerSupabase('ingest')
}

// ── Dedup hash ────────────────────────────────────────────────────────────
// SHA-256 of slugified title + company + location, joined with "|".
// Must byte-for-byte match lib/jobs.ts's computeDedupHash — the jobs table's
// dedup_hash column, and the 2,078 existing Adzuna rows, were populated by
// that algorithm. Reusing its `slugify` here (rather than a separate
// lowercase/trim pass) keeps the two in lockstep instead of drifting apart.

export async function computeDedupHash(
  title: string,
  companyName: string,
  locationText: string
): Promise<string> {
  const input = `${slugify(title)}|${slugify(companyName)}|${slugify(locationText)}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Deduplication result ──────────────────────────────────────────────────
// duplicateCount counts every job that is not inserted: matches found in the
// database (including those refreshed or revived below) plus duplicates
// within the batch. refreshed and revived are the rows actually changed.
export interface DeduplicationResult {
  toInsert: (NormalisedJob & { dedup_hash: string })[]
  duplicateCount: number
  duplicateHashes: string[]
  refreshed: number
  revived: number
}

// ── "Seen again" (owner decision D140) ────────────────────────────────────
// A job that matches an existing imported row is not inserted again:
// - live match (active, expires_at null or in the future): REFRESHED, its
//   expires_at moves to the new job's expires_at only if that is later
//   (never shortened; a null expires_at is left alone);
// - expired, or active but overdue: REVIVED with the fields below, taken from
//   the new job; never slug, id, title or platform;
// - employer-posted rows and any other status: left alone, as before.
// Rejected rows are not read at all, matching the partial unique index, so a
// job matching only a rejected row is inserted again.
// None of these writes can fail the run: a failure is logged by short code,
// reported, and the job is counted as an ordinary duplicate.

export const REFRESH_PART_SIZE = 100
export const REVIVE_PART_SIZE = 10

type ExistingRow = {
  id: string
  dedup_hash: string
  source: string | null
  status: string | null
  expires_at: string | null
}

type HashedJob = NormalisedJob & { dedup_hash: string }

// The short code of a caught value, for log lines. Never throws.
function shortCode(v: unknown): string {
  try {
    const code = typeof v === 'object' && v !== null ? (v as { code?: unknown }).code : undefined
    return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code'
  } catch {
    return 'no-code'
  }
}

export function reviveFields(job: NormalisedJob, nowIso: string) {
  return {
    status: 'active' as const,
    closed_at: null,
    expires_at: job.expires_at,
    source_job_id: job.source_job_id,
    source_url: job.source_url,
    application_url: job.application_url,
    published_at: job.published_at || nowIso,
  }
}

type SeenAgain = 'refresh' | 'revive' | 'skip'

export function classifyMatch(row: ExistingRow, job: NormalisedJob, now: number): SeenAgain {
  if (row.source === 'employer') return 'skip'
  if (row.status === 'expired') return 'revive'
  if (row.status !== 'active') return 'skip'
  if (row.expires_at === null) return 'skip'
  const current = Date.parse(row.expires_at)
  if (Number.isNaN(current)) return 'skip'
  if (current <= now) return 'revive'
  const next = Date.parse(job.expires_at)
  return !Number.isNaN(next) && next > current ? 'refresh' : 'skip'
}

async function refreshRows(
  supabase: ReturnType<typeof getSupabase>,
  items: { row: ExistingRow; job: HashedJob }[],
): Promise<number> {
  // One update per new expires_at value and per REFRESH_PART_SIZE ids. The
  // database repeats "only if later" and "still active", so a row that
  // changed in between is never shortened.
  const byValue = new Map<string, string[]>()
  for (const { row, job } of items) {
    const ids = byValue.get(job.expires_at) ?? []
    ids.push(row.id)
    byValue.set(job.expires_at, ids)
  }
  let refreshed = 0
  for (const [expiresAt, ids] of Array.from(byValue)) {
    for (let start = 0; start < ids.length; start += REFRESH_PART_SIZE) {
      const part = ids.slice(start, start + REFRESH_PART_SIZE)
      try {
        const { data, error } = await supabase
          .from('jobs')
          .update({ expires_at: expiresAt })
          .in('id', part)
          .neq('source', 'employer')
          .eq('status', 'active')
          .lt('expires_at', expiresAt)
          .select('id')
        if (error) throw error
        refreshed += (data ?? []).length
      } catch (err: unknown) {
        console.error('[dedup] refresh failed:', shortCode(err))
        reportServerError('job import refresh failed', err, { area: 'ingest' })
      }
    }
  }
  return refreshed
}

async function reviveRows(
  supabase: ReturnType<typeof getSupabase>,
  items: { row: ExistingRow; job: HashedJob }[],
  nowIso: string,
): Promise<number> {
  let revived = 0
  const reviveOne = async ({ row, job }: { row: ExistingRow; job: HashedJob }): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .update(reviveFields(job, nowIso))
        .eq('id', row.id)
        .neq('source', 'employer')
        .in('status', ['expired', 'active'])
        .select('id')
      if (error) throw error
      return (data ?? []).length > 0 ? 1 : 0
    } catch (err: unknown) {
      console.error('[dedup] revive failed:', shortCode(err))
      reportServerError('job import revive failed', err, { area: 'ingest' })
      return 0
    }
  }
  for (let start = 0; start < items.length; start += REVIVE_PART_SIZE) {
    const results = await Promise.all(items.slice(start, start + REVIVE_PART_SIZE).map(reviveOne))
    for (const n of results) revived += n
  }
  return revived
}

// ── Main deduplication function ────────────────────────────────────────────
// Takes normalised jobs, computes hashes, checks against DB, returns only new
// ones, and refreshes or revives the imported rows that were seen again.
// Never throws because of the database.

export async function deduplicate(
  jobs: NormalisedJob[]
): Promise<DeduplicationResult> {
  if (jobs.length === 0) {
    return { toInsert: [], duplicateCount: 0, duplicateHashes: [], refreshed: 0, revived: 0 }
  }

  // Compute hashes for all jobs
  const withHashes = await Promise.all(
    jobs.map(async job => ({
      ...job,
      dedup_hash: await computeDedupHash(job.title, job.company_name, job.location_text),
    }))
  )

  // Deduplicate within the current batch first (avoid inserting batch duplicates)
  const seenInBatch = new Set<string>()
  const uniqueInBatch = withHashes.filter(job => {
    if (seenInBatch.has(job.dedup_hash)) return false
    seenInBatch.add(job.dedup_hash)
    return true
  })
  const batchDuplicates = withHashes.length - uniqueInBatch.length

  // Check which hashes already exist in the DB (rejected rows excluded). If
  // the read fails, every job is treated as new, as before: the insert's
  // 23505 handling still catches true duplicates.
  const hashes = uniqueInBatch.map(j => j.dedup_hash)
  const supabase = getSupabase()
  let existingRows: ExistingRow[] = []
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, dedup_hash, source, status, expires_at')
      .in('dedup_hash', hashes)
      .neq('status', 'rejected')
    if (error) throw error
    existingRows = (data ?? []) as ExistingRow[]
  } catch (err: unknown) {
    console.error('[dedup] read failed:', shortCode(err))
    reportServerError('job import duplicate read failed', err, { area: 'ingest' })
    return { toInsert: uniqueInBatch, duplicateCount: batchDuplicates, duplicateHashes: [], refreshed: 0, revived: 0 }
  }

  const existing = new Map<string, ExistingRow>()
  for (const row of existingRows) {
    // Should one hash ever have more than one row, an employer row wins, so
    // the match is left alone.
    const seen = existing.get(row.dedup_hash)
    if (!seen || row.source === 'employer') existing.set(row.dedup_hash, row)
  }

  const toInsert = uniqueInBatch.filter(j => !existing.has(j.dedup_hash))
  const matched = uniqueInBatch.filter(j => existing.has(j.dedup_hash))
  const duplicateHashes = matched.map(j => j.dedup_hash)

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const toRefresh: { row: ExistingRow; job: HashedJob }[] = []
  const toRevive: { row: ExistingRow; job: HashedJob }[] = []
  for (const job of matched) {
    const row = existing.get(job.dedup_hash)!
    const kind = classifyMatch(row, job, now)
    if (kind === 'refresh') toRefresh.push({ row, job })
    else if (kind === 'revive') toRevive.push({ row, job })
  }

  const refreshed = toRefresh.length > 0 ? await refreshRows(supabase, toRefresh) : 0
  const revived = toRevive.length > 0 ? await reviveRows(supabase, toRevive, nowIso) : 0

  // Total duplicates = DB matches (refreshed, revived or left alone) +
  // within-batch duplicates
  const duplicateCount = duplicateHashes.length + batchDuplicates

  return { toInsert, duplicateCount, duplicateHashes, refreshed, revived }
}
