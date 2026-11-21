import { getServerSupabase, type DbContext } from './supabase-server'
import type { QualityMetrics } from './ingestion/quality'
import type { AlertState } from './provider-alerts'
import { reportServerError } from './report-error'

// No public page or API uses this file. Most functions serve provider
// ingestion, which is the default limit here; the scheduled orchestrator's
// and admin-only functions name their own context.
function getSupabase(context: DbContext = 'ingest') {
  return getServerSupabase(context)
}

// A read problem as a real Error with fixed text and the database's short
// code only (the same shape as readProblem in lib/db.ts).
function readProblem(message: string, error: { code?: unknown }): Error & { code?: string } {
  const failed = new Error(message) as Error & { code?: string }
  if (typeof error.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(error.code)) failed.code = error.code
  return failed
}

// The short code of a database problem, for log lines. Never throws.
function shortCode(v: unknown): string {
  try {
    const code = typeof v === 'object' && v !== null ? (v as { code?: unknown }).code : undefined
    return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code'
  } catch {
    return 'no-code'
  }
}

export interface JobProvider {
  id: string
  slug: string
  name: string
  provider_type: string
  adapter_key: string
  status: string
  priority: number
  is_affiliate: boolean
  data_ownership: string | null
  country_codes: string[]
  regions: string[]
  platform_tags: string[]
  source_score: number
  keywords: string[]
  category_filter: string | null
  base_url: string | null
  request_config: Record<string, unknown>
  auth_type: string
  auth_config: Record<string, unknown>
  field_mapping: Record<string, string>
  response_path: string | null
  pagination_style: string | null
  max_pages_per_run: number
  fetch_interval_minutes: number
  fetch_offset_minutes: number
  last_fetched_at: string | null
  next_fetch_at: string | null
  rate_limit_rpm: number | null
  rate_limit_daily: number | null
  requests_today: number
  retry_after_seconds: number | null
  health_status: string
  consecutive_failures: number
  last_success_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  last_error_code: string | null
  avg_response_ms: number | null
  total_jobs_ingested: number
  jobs_last_run: number
  jobs_today: number
  dedup_rate_last_run: number | null
  notes: string | null
  source_name: string | null
  commercial_terms: string | null
  keyword_cursor: number | null
  enforce_relevance: boolean | null
  data_quality_status: string | null
  last_relevance_rate: number | null
  last_avg_description_length: number | null
  data_quality_checked_at: string | null
  last_alert_state: AlertState | null
  last_alert_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface ProviderRun {
  id: string
  provider_id: string
  provider_slug: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  status: string
  trigger: string | null
  jobs_fetched: number
  jobs_inserted: number
  jobs_deduplicated: number
  jobs_rejected: number
  pages_fetched: number
  response_ms_avg: number | null
  error_message: string | null
  error_code: string | null
  raw_response_sample: Record<string, unknown> | null
  relevance_rate: number | null
  avg_description_length: number | null
  field_coverage: Record<string, number> | null
}

// Get a single provider by slug
export async function getProvider(slug: string): Promise<JobProvider | null> {
  // Used by ingestion and by admin. One single-row read: the admin limit is
  // far above its work and below every caller's route limit.
  const supabase = getSupabase('admin')
  const { data, error } = await supabase
    .from('job_providers')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return data as JobProvider
}

// The same read for an import run: null only when no provider has this slug
// (zero rows, PostgREST code PGRST116); any other failure is thrown, so the
// run answers a temporary problem rather than "not found".
export async function findProvider(slug: string): Promise<JobProvider | null> {
  const supabase = getSupabase('admin')
  const { data, error } = await supabase
    .from('job_providers')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error && error.code === 'PGRST116') return null
  if (error) throw error
  if (!data) return null
  return data as JobProvider
}

// Get all providers due for a fetch right now
// Excludes any provider that already has a run with status='running' —
// prevents concurrent orchestrator ticks from dispatching the same
// provider twice when a run outlives the 15-minute cron interval.
export async function getProvidersDueForFetch(): Promise<JobProvider[]> {
  const supabase = getSupabase('cron')

  const { data: runningRuns, error: runningError } = await supabase
    .from('provider_runs')
    .select('provider_id')
    .eq('status', 'running')
  if (runningError) {
    throw readProblem('getProvidersDueForFetch: running-runs query failed', runningError)
  }

  const runningProviderIds = Array.from(
    new Set((runningRuns ?? []).map(r => r.provider_id))
  )

  let query = supabase
    .from('job_providers')
    .select('*')
    .eq('status', 'active')
    .or('next_fetch_at.is.null,next_fetch_at.lte.' + new Date().toISOString())

  if (runningProviderIds.length > 0) {
    query = query.not('id', 'in', `(${runningProviderIds.join(',')})`)
  }

  const { data, error } = await query.order('priority', { ascending: true })
  if (error) {
    throw readProblem('getProvidersDueForFetch: due-providers query failed', error)
  }
  if (!data) {
    throw new Error('getProvidersDueForFetch: due-providers query returned no data')
  }
  return data as JobProvider[]
}

// Get all providers (for admin dashboard)
export async function getAllProviders(): Promise<JobProvider[]> {
  const supabase = getSupabase('admin')
  const { data, error } = await supabase
    .from('job_providers')
    .select('*')
    .order('priority', { ascending: true })
  if (error || !data) return []
  return data as JobProvider[]
}

// Create a new run record (status='running') — call BEFORE ingestion starts
export async function createProviderRun(
  providerId: string,
  providerSlug: string,
  trigger: 'cron' | 'manual' | 'test' = 'cron'
): Promise<ProviderRun | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('provider_runs')
    .insert({
      provider_id: providerId,
      provider_slug: providerSlug,
      status: 'running',
      trigger,
    })
    .select()
    .single()
  if (error || !data) return null
  return data as ProviderRun
}

// Mark a run as completed with metrics
export async function completeProviderRun(
  runId: string,
  metrics: {
    jobsFetched: number
    jobsInserted: number
    jobsDeduplicated: number
    jobsRejected: number
    pagesFetched: number
    durationMs: number
    responseMs?: number
    rawResponseSample?: Record<string, unknown>
    relevanceRate?: number | null
    avgDescriptionLength?: number | null
    fieldCoverage?: Record<string, number>
  }
): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('provider_runs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_ms: metrics.durationMs,
      jobs_fetched: metrics.jobsFetched,
      jobs_inserted: metrics.jobsInserted,
      jobs_deduplicated: metrics.jobsDeduplicated,
      jobs_rejected: metrics.jobsRejected,
      pages_fetched: metrics.pagesFetched,
      response_ms_avg: metrics.responseMs ?? null,
      raw_response_sample: metrics.rawResponseSample ?? null,
      relevance_rate: metrics.relevanceRate ?? null,
      avg_description_length: metrics.avgDescriptionLength ?? null,
      field_coverage: metrics.fieldCoverage ?? null,
    })
    .eq('id', runId)
}

// Mark a run as failed
export async function failProviderRun(
  runId: string,
  errorMessage: string,
  errorCode: string
): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('provider_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      error_code: errorCode,
    })
    .eq('id', runId)
}

// Update provider health after a run
export async function updateProviderHealth(
  providerId: string,
  outcome: 'success' | 'failure',
  extras: {
    jobsInserted?: number
    jobsFetched?: number
    errorMessage?: string
    errorCode?: string
    responseMs?: number
  } = {}
): Promise<void> {
  const supabase = getSupabase()

  if (outcome === 'success') {
    // Compute next_fetch_at from DB (avoids race conditions)
    const { data, error: readError } = await supabase
      .from('job_providers')
      .select('fetch_interval_minutes, fetch_offset_minutes')
      .eq('id', providerId)
      .single()
    // A failed read keeps the default interval below and still saves.
    if (readError) {
      console.error('[updateProviderHealth] read failed:', shortCode(readError))
      reportServerError('job import health read failed', readError, { area: 'ingest' })
    }
    const provider = readError ? null : data

    const intervalMs = ((provider?.fetch_interval_minutes ?? 1440) * 60 * 1000)
    const nextFetch = new Date(Date.now() + intervalMs)

    // A run that completes without throwing but fetches zero jobs is not
    // a failure (nothing errored) — but zero fetched is the single
    // strongest signal something is wrong upstream, so it must not read
    // 'healthy'. Stays on the 'success' branch (never increments
    // consecutive_failures, never risks the auto-pause at 5) — it's a
    // warning, not a failure.
    const isZeroFetch = extras.jobsFetched === 0

    const { error: saveError } = await supabase
      .from('job_providers')
      .update({
        health_status: isZeroFetch ? 'degraded' : 'healthy',
        consecutive_failures: 0,
        last_success_at: new Date().toISOString(),
        last_fetched_at: new Date().toISOString(),
        next_fetch_at: nextFetch.toISOString(),
        jobs_last_run: extras.jobsInserted ?? 0,
        avg_response_ms: extras.responseMs ?? null,
        last_error_message: isZeroFetch ? 'Run completed but fetched 0 jobs' : null,
        last_error_code: isZeroFetch ? 'ZERO_FETCH' : null,
      })
      .eq('id', providerId)
    if (saveError) {
      console.error('[updateProviderHealth] save failed:', shortCode(saveError))
      reportServerError('job import health save failed', saveError, { area: 'ingest' })
    }

  } else {
    // Failure — increment consecutive_failures, update health_status
    const { data, error: readError } = await supabase
      .from('job_providers')
      .select('consecutive_failures, status')
      .eq('id', providerId)
      .single()
    // A failed read saves the error only: the failure count, health and
    // status are left as they are (never reset, never paused on it).
    if (readError) {
      console.error('[updateProviderHealth] read failed:', shortCode(readError))
      reportServerError('job import health read failed', readError, { area: 'ingest' })
    }

    const lastError = {
      last_error_at: new Date().toISOString(),
      last_error_message: extras.errorMessage ?? null,
      last_error_code: extras.errorCode ?? null,
    }
    let payload: Record<string, unknown> = lastError
    if (!readError) {
      const failures = (data?.consecutive_failures ?? 0) + 1
      const healthStatus = failures >= 3 ? 'down' : 'degraded'
      // Auto-pause after 5 consecutive failures, only an active provider
      const newStatus = failures >= 5 && data?.status === 'active' ? 'paused' : undefined
      payload = {
        health_status: healthStatus,
        consecutive_failures: failures,
        ...lastError,
        ...(newStatus ? { status: newStatus } : {}),
      }
    }

    const { error: saveError } = await supabase
      .from('job_providers')
      .update(payload)
      .eq('id', providerId)
    if (saveError) {
      console.error('[updateProviderHealth] save failed:', shortCode(saveError))
      reportServerError('job import health save failed', saveError, { area: 'ingest' })
    }
  }
}

// Persist the latest data-quality read for a provider — diagnostic
// state on job_providers, independent of the provider_runs history.
// Rule 101: never assume success — check and log the returned error.
export async function updateProviderDataQuality(
  providerId: string,
  metrics: QualityMetrics
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('job_providers')
    .update({
      data_quality_status: metrics.status,
      last_relevance_rate: metrics.relevanceRate,
      last_avg_description_length: metrics.avgDescriptionLength,
      data_quality_checked_at: new Date().toISOString(),
    })
    .eq('id', providerId)
  if (error) {
    console.error('[updateProviderDataQuality] failed:', error.message)
    reportServerError('job import quality save failed', error, { area: 'ingest' })
  }
}

const ERROR_LOG_ID_MAX_CHARS = 200
const ERROR_LOG_ID_MAX_JSON_BYTES = 256

// What the import error log keeps from a job's record: only its
// source_job_id (the one value the admin provider screen shows), cut to at
// most 200 characters, else null. Never another key. Never throws.
export function errorLogContext(raw: unknown): { source_job_id: string } | null {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
    const id = (raw as { source_job_id?: unknown }).source_job_id
    if (typeof id !== 'string' || id.length === 0) return null
    const chars = Array.from(id.slice(0, ERROR_LOG_ID_MAX_CHARS * 2)).slice(0, ERROR_LOG_ID_MAX_CHARS)
    const encoder = new TextEncoder()
    while (chars.length > 0 && encoder.encode(JSON.stringify(chars.join(''))).length > ERROR_LOG_ID_MAX_JSON_BYTES) chars.pop()
    return chars.length > 0 ? { source_job_id: chars.join('') } : null
  } catch {
    return null
  }
}

// Log a provider error (job-level)
export async function logProviderError(
  providerId: string,
  runId: string | null,
  errorType: string,
  errorCode: string,
  errorMessage: string,
  rawJobData?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('provider_errors').insert({
    provider_id: providerId,
    run_id: runId,
    error_type: errorType,
    error_code: errorCode,
    error_message: errorMessage,
    raw_job_data: errorLogContext(rawJobData),
  })
}

// Update the jobs_today and requests_today counters on provider.
// requests: the provider API requests this run made (pages fetched).
export async function incrementProviderJobsToday(
  providerId: string,
  count: number,
  requests = 0
): Promise<void> {
  const added = typeof requests === 'number' && Number.isFinite(requests) && requests > 0 ? Math.floor(requests) : 0
  const supabase = getSupabase()
  const { data: current, error: fetchError } = await supabase
    .from('job_providers')
    .select('jobs_today, total_jobs_ingested, jobs_last_run, requests_today')
    .eq('id', providerId)
    .single()
  if (fetchError || !current) {
    console.error(
      '[incrementProviderJobsToday] failed to fetch provider:',
      shortCode(fetchError)
    )
    reportServerError('job import counter read failed', fetchError ?? new Error('job import counter read failed'), { area: 'ingest' })
    return
  }
  const { error: updateError } = await supabase
    .from('job_providers')
    .update({
      jobs_today: (current.jobs_today ?? 0) + count,
      total_jobs_ingested: (current.total_jobs_ingested ?? 0) + count,
      jobs_last_run: count,
      requests_today: (current.requests_today ?? 0) + added,
    })
    .eq('id', providerId)
  if (updateError) {
    console.error(
      '[incrementProviderJobsToday] failed to update counters:',
      shortCode(updateError)
    )
    reportServerError('job import counter save failed', updateError, { area: 'ingest' })
  }
}

// Get the most recent run for every provider, keyed by provider_slug
export async function getLatestRunPerProvider(): Promise<Record<string, ProviderRun>> {
  const sb = getSupabase('admin')
  const { data, error } = await sb
    .from('provider_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(500)
  if (error) throw readProblem('getLatestRunPerProvider: provider runs query failed', error)
  const map: Record<string, ProviderRun> = {}
  for (const run of data ?? []) {
    if (!map[run.provider_slug]) map[run.provider_slug] = run
  }
  return map
}

// Close provider_runs rows stuck at 'running' beyond the platform
// timeout. A killed serverless function never reaches
// completeProviderRun/failProviderRun, leaving the row open forever
// and (via getProvidersDueForFetch) permanently blocking the
// provider. Returns the number of rows reaped and their provider ids
// (one per reaped row, so an id can repeat).
export async function reapStaleRuns(
  olderThanMinutes = 10
): Promise<{ count: number; providerIds: string[] }> {
  const supabase = getSupabase('cron')
  const cutoff = new Date(
    Date.now() - olderThanMinutes * 60_000
  ).toISOString()
  const { data, error } = await supabase
    .from('provider_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message:
        'Reaped: run exceeded platform timeout and never completed',
      error_code: 'TIMEOUT_REAPED',
    })
    .eq('status', 'running')
    .lt('started_at', cutoff)
    .select('id, provider_id')
  if (error) {
    console.error('[reapStaleRuns] failed:', error.message)
    reportServerError('job import stale run update failed', error, { area: 'ingest' })
    return { count: 0, providerIds: [] }
  }
  const rows = data ?? []
  return {
    count: rows.length,
    providerIds: rows
      .map(r => r.provider_id)
      .filter((id): id is string => typeof id === 'string' && id !== ''),
  }
}

// Move a provider's next scheduled import to `until`, so a provider that
// cannot run now does not stay due and block the ones behind it. Without
// `until`, uses now + the provider's fetch_interval_minutes (default 1440),
// the same rule a successful run uses in updateProviderHealth. Throws fixed
// text with the database's short code only.
export async function deferProvider(
  providerId: string,
  until?: Date
): Promise<void> {
  const supabase = getSupabase()
  let nextFetch = until
  if (!nextFetch) {
    const { data: provider, error: readError } = await supabase
      .from('job_providers')
      .select('fetch_interval_minutes')
      .eq('id', providerId)
      .single()
    if (readError) throw readProblem('deferProvider: interval read failed', readError)
    nextFetch = new Date(Date.now() + (provider?.fetch_interval_minutes ?? 1440) * 60 * 1000)
  }
  const { error } = await supabase
    .from('job_providers')
    .update({ next_fetch_at: nextFetch.toISOString() })
    .eq('id', providerId)
  if (error) throw readProblem('deferProvider: provider update failed', error)
}

// Persist the adapter's keyword cursor so the next run resumes
// where this one stopped.
export async function updateProviderKeywordCursor(
  providerId: string,
  cursor: number
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('job_providers')
    .update({ keyword_cursor: cursor })
    .eq('id', providerId)
  if (error) {
    console.error(
      '[updateProviderKeywordCursor] failed:',
      error.message
    )
    reportServerError('job import keyword cursor save failed', error, { area: 'ingest' })
  }
}
