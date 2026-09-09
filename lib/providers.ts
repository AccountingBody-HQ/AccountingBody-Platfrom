import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
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
}

// Get a single provider by slug
export async function getProvider(slug: string): Promise<JobProvider | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('job_providers')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return data as JobProvider
}

// Get all providers due for a fetch right now
export async function getProvidersDueForFetch(): Promise<JobProvider[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('job_providers')
    .select('*')
    .eq('status', 'active')
    .or('next_fetch_at.is.null,next_fetch_at.lte.' + new Date().toISOString())
    .order('priority', { ascending: true })
  if (error || !data) return []
  return data as JobProvider[]
}

// Get all providers (for admin dashboard)
export async function getAllProviders(): Promise<JobProvider[]> {
  const supabase = getSupabase()
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
    errorMessage?: string
    errorCode?: string
    responseMs?: number
  } = {}
): Promise<void> {
  const supabase = getSupabase()

  if (outcome === 'success') {
    // Compute next_fetch_at from DB (avoids race conditions)
    const { data: provider } = await supabase
      .from('job_providers')
      .select('fetch_interval_minutes, fetch_offset_minutes')
      .eq('id', providerId)
      .single()

    const intervalMs = ((provider?.fetch_interval_minutes ?? 1440) * 60 * 1000)
    const nextFetch = new Date(Date.now() + intervalMs)

    await supabase
      .from('job_providers')
      .update({
        health_status: 'healthy',
        consecutive_failures: 0,
        last_success_at: new Date().toISOString(),
        last_fetched_at: new Date().toISOString(),
        next_fetch_at: nextFetch.toISOString(),
        jobs_last_run: extras.jobsInserted ?? 0,
        avg_response_ms: extras.responseMs ?? null,
        last_error_message: null,
        last_error_code: null,
      })
      .eq('id', providerId)

  } else {
    // Failure — increment consecutive_failures, update health_status
    const { data: provider } = await supabase
      .from('job_providers')
      .select('consecutive_failures')
      .eq('id', providerId)
      .single()

    const failures = (provider?.consecutive_failures ?? 0) + 1
    const healthStatus = failures >= 3 ? 'down' : 'degraded'
    // Auto-pause after 5 consecutive failures
    const newStatus = failures >= 5 ? 'paused' : undefined

    await supabase
      .from('job_providers')
      .update({
        health_status: healthStatus,
        consecutive_failures: failures,
        last_error_at: new Date().toISOString(),
        last_error_message: extras.errorMessage ?? null,
        last_error_code: extras.errorCode ?? null,
        ...(newStatus ? { status: newStatus } : {}),
      })
      .eq('id', providerId)
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
    raw_job_data: rawJobData ?? null,
  })
}

// Update jobs_today counter on provider
export async function incrementProviderJobsToday(
  providerId: string,
  count: number
): Promise<void> {
  const supabase = getSupabase()
  const { data: current, error: fetchError } = await supabase
    .from('job_providers')
    .select('jobs_today, total_jobs_ingested, jobs_last_run')
    .eq('id', providerId)
    .single()
  if (fetchError || !current) {
    console.error(
      '[incrementProviderJobsToday] failed to fetch provider:',
      fetchError?.message
    )
    return
  }
  const { error: updateError } = await supabase
    .from('job_providers')
    .update({
      jobs_today: (current.jobs_today ?? 0) + count,
      total_jobs_ingested: (current.total_jobs_ingested ?? 0) + count,
      jobs_last_run: count,
    })
    .eq('id', providerId)
  if (updateError) {
    console.error(
      '[incrementProviderJobsToday] failed to update counters:',
      updateError.message
    )
  }
}

// Get the most recent run for every provider, keyed by provider_slug
export async function getLatestRunPerProvider(): Promise<Record<string, ProviderRun>> {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('provider_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  const map: Record<string, ProviderRun> = {}
  for (const run of data ?? []) {
    if (!map[run.provider_slug]) map[run.provider_slug] = run
  }
  return map
}
