// Supabase access for the saved-jobs feature. Same client-construction
// pattern as every other server-side data module in this repo (see
// getSupabase() in lib/jobs.ts, lib/db.ts, app/api/subscribe/route.ts,
// etc.) — there is no shared client singleton to import, each module
// creates its own.
import { createClient } from '@supabase/supabase-js'
import { SAVED_JOBS_LIMIT } from './saved-jobs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// Public-safe fields (a subset of lib/jobs.ts's JOB_COLUMNS) plus `status`,
// which JOB_COLUMNS deliberately excludes. `status` is read here only to
// compute the `available` flag server-side in app/api/saved-jobs/route.ts —
// callers of listSaved() must strip it from any response body; it must
// never reach an anonymous client verbatim (Rule 93).
const SAVED_JOB_FIELDS =
  'id,slug,title,company_name,location_text,location_city,location_country,location_remote,' +
  'salary_text,salary_min,salary_max,salary_currency,salary_is_predicted,expires_at,published_at,status'

export interface SavedJobJoinedRow {
  id: string
  slug: string
  title: string
  company_name: string
  location_text: string | null
  location_city: string | null
  location_country: string | null
  location_remote: boolean | null
  salary_text: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  salary_is_predicted: boolean | null
  expires_at: string | null
  published_at: string | null
  status: string
}

export interface SavedJobRecord {
  savedAt: string
  job: SavedJobJoinedRow
}

// `job:jobs(...)` embeds via the saved_jobs.job_id -> jobs.id foreign key
// (0008_saved_jobs.sql). Without a generated Database type, supabase-js
// types every embed as an array regardless of actual cardinality — same
// gotcha already handled in app/api/roodber8/course-factory/load-course/
// route.ts (`Array.isArray(c.course_chapters) ...`). job_id is a NOT NULL
// FK, so at runtime this is always exactly one row; normalise defensively
// rather than trust the array type.
function normaliseJoinedJob(value: unknown): SavedJobJoinedRow | null {
  const job = Array.isArray(value) ? value[0] : value
  return (job ?? null) as SavedJobJoinedRow | null
}

export async function listSaved(visitorId: string, platform: string): Promise<SavedJobRecord[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('saved_jobs')
    .select(`created_at, job:jobs(${SAVED_JOB_FIELDS})`)
    .eq('visitor_id', visitorId)
    .eq('platform', platform)
    .order('created_at', { ascending: false })
    .limit(SAVED_JOBS_LIMIT)
  if (error) throw error

  return (data ?? [])
    .map(row => ({ savedAt: row.created_at as string, job: normaliseJoinedJob(row.job) }))
    .filter((row): row is SavedJobRecord => row.job !== null)
}

export async function listSavedIds(visitorId: string, platform: string): Promise<string[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('saved_jobs')
    .select('job_id')
    .eq('visitor_id', visitorId)
    .eq('platform', platform)
    .order('created_at', { ascending: false })
    .limit(SAVED_JOBS_LIMIT)
  if (error) throw error
  return (data ?? []).map(row => row.job_id as string)
}

export async function countSaved(visitorId: string, platform: string): Promise<number> {
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('saved_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('visitor_id', visitorId)
    .eq('platform', platform)
  if (error) throw error
  return count ?? 0
}

// Rule 4's exact eligibility check — same filter shape as
// getBrowsableJobsCount in lib/jobs.ts: active, not past its own expiry,
// and shown on this platform.
export async function findSavableJob(jobId: string, platform: string): Promise<{ id: string } | null> {
  const supabase = getSupabase()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('status', 'active')
    .contains('platform', [platform])
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle()
  if (error) throw error
  return data as { id: string } | null
}

export async function insertSaved(visitorId: string, platform: string, jobId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('saved_jobs')
    .upsert(
      { visitor_id: visitorId, platform, job_id: jobId },
      { onConflict: 'visitor_id,platform,job_id', ignoreDuplicates: true }
    )
  if (error) throw error
}

// Import path (Step 3's one-time localStorage migration). jobIds is
// assumed already de-duplicated and uuid-validated by parseImportBody.
// Re-validates eligibility against the live jobs table (rule 4) rather
// than trusting the client's stale localStorage snapshot, and caps the
// insert at whatever room remains under the visitor's existing 200-row
// count — never exceeding it on the happy path (a rare race is acceptable
// per the brief, same as insertSaved's plain upsert path).
export async function insertManySaved(visitorId: string, platform: string, jobIds: string[]): Promise<{ imported: number }> {
  if (jobIds.length === 0) return { imported: 0 }

  const supabase = getSupabase()
  const nowIso = new Date().toISOString()
  const { data: eligible, error: eligibleError } = await supabase
    .from('jobs')
    .select('id')
    .in('id', jobIds)
    .eq('status', 'active')
    .contains('platform', [platform])
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
  if (eligibleError) throw eligibleError

  const eligibleIds = (eligible ?? []).map(row => row.id as string)
  if (eligibleIds.length === 0) return { imported: 0 }

  const existingCount = await countSaved(visitorId, platform)
  const room = Math.max(0, SAVED_JOBS_LIMIT - existingCount)
  if (room === 0) return { imported: 0 }

  const toInsert = eligibleIds.slice(0, room)
  const rows = toInsert.map(jobId => ({ visitor_id: visitorId, platform, job_id: jobId }))
  const { error } = await supabase
    .from('saved_jobs')
    .upsert(rows, { onConflict: 'visitor_id,platform,job_id', ignoreDuplicates: true })
  if (error) throw error

  return { imported: toInsert.length }
}

export async function deleteSaved(visitorId: string, platform: string, jobId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('visitor_id', visitorId)
    .eq('platform', platform)
    .eq('job_id', jobId)
  if (error) throw error
}

// Refreshes last_seen_at for every one of this visitor's rows on this
// platform, throttled by the WHERE clause itself so a visitor reading or
// writing repeatedly within the same hour costs nothing extra. Never
// throws — a failure here must never fail the request it was piggybacked
// onto.
export async function touchLastSeen(visitorId: string, platform: string, throttleMs: number): Promise<void> {
  try {
    const supabase = getSupabase()
    const throttleCutoff = new Date(Date.now() - throttleMs).toISOString()
    const { error } = await supabase
      .from('saved_jobs')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('visitor_id', visitorId)
      .eq('platform', platform)
      .lt('last_seen_at', throttleCutoff)
    if (error) {
      console.error('touchLastSeen: update failed (non-fatal):', error.message)
    }
  } catch (err) {
    console.error('touchLastSeen: unexpected error (non-fatal):', err)
  }
}

// The ONLY deletion path for this table, and it only ever touches
// public.saved_jobs with this one condition — see 0008_saved_jobs.sql's
// header comment. Called by app/api/cron/prune-saved-jobs/route.ts.
export async function pruneInactive(olderThanDays: number): Promise<number> {
  const supabase = getSupabase()
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
  const { error, count } = await supabase
    .from('saved_jobs')
    .delete({ count: 'exact' })
    .lt('last_seen_at', cutoff)
  if (error) throw error
  return count ?? 0
}
