// Runs one provider import and hands back the answer as plain data.
//
// Two callers share this one function:
// - the import route (app/api/ingest/[slug]/route.ts), after its own
//   CRON_SECRET check, turns the result into its HTTP answer;
// - the orchestrator (app/api/ingest/orchestrator/route.ts) calls it directly
//   for each provider it picks, with trigger 'cron'.
//
// runProviderImport never throws: anything unexpected becomes a 500 result
// with fixed text.

import { getServerSupabase } from '@/lib/supabase-server'
import {
  findProvider,
  type JobProvider,
  createProviderRun,
  completeProviderRun,
  failProviderRun,
  updateProviderHealth,
  updateProviderDataQuality,
  logProviderError,
  incrementProviderJobsToday,
  updateProviderKeywordCursor,
} from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'
import { normalise } from '@/lib/ingestion/normalise'
import { deduplicate } from '@/lib/ingestion/deduplicate'
import { validate } from '@/lib/ingestion/validate'
import { computeQualityMetrics, type QualityMetrics } from '@/lib/ingestion/quality'
import { deriveAlertState, maybeSendProviderAlert } from '@/lib/provider-alerts'
import { reportServerError } from '@/lib/report-error'

export type ImportTrigger = 'cron' | 'manual'

export type ProviderImportResult = { status: number; body: unknown }

function getSupabase() {
  return getServerSupabase('ingest')
}

const BATCH_SIZE = 50

// A dedup_hash unique violation isn't a failure — it means the job already
// exists (often because the concurrent keyword fan-out returned the same
// job under multiple keywords in the same run). Classify it separately so
// it's counted as deduplicated rather than logged as a real error.
function isDedupConflict(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  if (err.code === '23505') return true
  const m = err.message ?? ''
  return m.includes('idx_jobs_dedup')
    || m.includes('duplicate key value')
}

// The short code of a caught value, for log lines.
function shortCode(v: unknown): string {
  const code = typeof v === 'object' && v !== null ? (v as { code?: unknown }).code : undefined
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code'
}

// The code shown in the fixed failed-import text: the error's short code,
// else its short name, else "no-code". Never throws.
function failureCode(v: unknown): string {
  try {
    if (typeof v !== 'object' || v === null) return 'no-code'
    const { code, name } = v as { code?: unknown; name?: unknown }
    if (typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code)) return code
    if (typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) return name
    return 'no-code'
  } catch {
    return 'no-code'
  }
}

export async function runProviderImport(slug: string, trigger: ImportTrigger): Promise<ProviderImportResult> {
  try {
    return await importProvider(slug, trigger)
  } catch (err: unknown) {
    // Fixed text only; the error itself is not logged or returned.
    console.error(`[ingest/${slug}] import stopped unexpectedly`)
    reportServerError('job import stopped unexpectedly', err, { area: 'ingest' })
    return { status: 500, body: { ok: false, error: 'Import stopped unexpectedly' } }
  }
}

async function importProvider(slug: string, trigger: ImportTrigger): Promise<ProviderImportResult> {
  const startTime = Date.now()

  let provider: JobProvider | null
  try {
    provider = await findProvider(slug)
  } catch (err: unknown) {
    console.error(`[ingest/${slug}] provider could not be read`)
    reportServerError('job import provider read failed', err, { area: 'ingest' })
    return { status: 503, body: { ok: false, error: 'Provider could not be read' } }
  }
  if (!provider) {
    return { status: 404, body: { ok: false, error: 'Provider not found' } }
  }
  if (provider.status !== 'active') {
    return { status: 200, body: { ok: true, skipped: true, reason: 'Provider inactive' } }
  }
  if (
    provider.rate_limit_daily !== null &&
    provider.requests_today >= provider.rate_limit_daily
  ) {
    return { status: 200, body: { ok: true, skipped: true, reason: 'Daily rate limit reached' } }
  }

  // Pre-flight validation — warn loudly if critical field_mapping fields are missing
  const mapping = provider.field_mapping ?? {}
  const missingMappings: string[] = []
  if (!mapping.title)           missingMappings.push('title')
  if (!mapping.company_name)    missingMappings.push('company_name')
  if (!mapping.application_url) missingMappings.push('application_url')
  if (missingMappings.length > 0) {
    console.warn(`[ingest/${slug}] WARNING: field_mapping missing critical fields: ${missingMappings.join(', ')}. Jobs will likely be rejected.`)
  }

  const run = await createProviderRun(provider.id, provider.slug, trigger)
  if (!run) {
    console.error(`[ingest/${slug}] run record could not be created`)
    return { status: 500, body: { ok: false, error: 'Failed to create run record' } }
  }

  try {
    const adapter = getAdapter(provider.adapter_key)

    const fetchStart = Date.now()
    const adapterResult = await adapter.fetch(provider)
    const fetchMs = Date.now() - fetchStart

    const { jobs: rawJobs, pagesFetched, totalAvailable } = adapterResult

    const normalised = rawJobs.map(raw => normalise(raw, provider))
    const { valid, rejected } = validate(normalised, provider.enforce_relevance ?? false)

    // Log validation rejections
    for (const job of rejected) {
      await logProviderError(
        provider.id,
        run.id,
        'VALIDATE_FAILED',
        'VALIDATION_REJECT',
        `Job "${job.title}" at "${job.application_url}" failed validation`,
        job.raw_source_data as Record<string, unknown>
      )
    }

    // Data-quality metrics — diagnostic only, computed from data already
    // in memory (no extra fetch, no extra DB read beyond the write below).
    // Same discipline as the jobs_today counter further down: a metrics
    // failure must NEVER fail an otherwise-successful ingestion run.
    let qualityMetrics: QualityMetrics | undefined
    try {
      qualityMetrics = computeQualityMetrics(normalised)
      await updateProviderDataQuality(provider.id, qualityMetrics)
    } catch (qualityErr: unknown) {
      console.error('[ingest] quality metrics failed:', shortCode(qualityErr))
      // do NOT rethrow — ingestion must proceed regardless
    }

    const { toInsert, duplicateCount: dedupedAtCheckTime } = await deduplicate(valid)
    let duplicateCount = dedupedAtCheckTime

    const supabase = getSupabase()
    let insertedCount = 0
    const insertErrors: string[] = []

    // Batch insert — BATCH_SIZE jobs per round-trip to avoid timeouts
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE)

      const rows = batch.map(job => ({
        title:                 job.title,
        company_name:          job.company_name,
        slug:                  job.slug,
        description:           job.description,
        excerpt:               job.excerpt,
        location_text:         job.location_text,
        location_country:      job.location_country,
        location_city:         job.location_city,
        location_remote:       job.location_remote,
        salary_min:            job.salary_min,
        salary_max:            job.salary_max,
        salary_currency:       job.salary_currency,
        salary_text:           job.salary_text,
        salary_is_predicted:   job.salary_is_predicted,
        employment_type:       job.employment_type,
        seniority_level:       job.seniority_level,
        qualifications_required: job.qualifications_required,
        source:                job.source,
        source_job_id:         job.source_job_id,
        source_url:            job.source_url,
        source_score:          job.source_score,
        application_url:       job.application_url,
        dedup_hash:            job.dedup_hash,
        platform:              job.platform,
        status:                'active' as const,
        expires_at:            job.expires_at,
        published_at:          job.published_at,
        provider_id:           job.provider_id,
        ingestion_run_id:      run.id,
        data_completeness:     job.data_completeness,
        quality_flags:         job.quality_flags,
        normalisation_version: job.normalisation_version,
        raw_source_data:       job.raw_source_data,
        quality_score:         job.data_completeness,
        payment_status:        'free' as const,
        employer_email:        `noreply+${provider.slug}@accountingbody.com`,
        employer_name:         provider.name,
        employer_company:      job.company_name,
        apply_method:          'external' as const,
      }))

      const { error, data } = await supabase.from('jobs').insert(rows).select('id')

      if (error) {
        // Batch failed — try individual inserts to salvage partial success.
        // A dedup_hash conflict here isn't a real batch failure — it just
        // means at least one row in the batch already exists. Don't log
        // that noisily; the per-row fallback below classifies each row
        // correctly anyway. Genuine errors still get logged as before.
        if (!isDedupConflict(error)) {
          console.warn(`[ingest/${slug}] Batch insert failed, falling back to individual inserts:`, shortCode(error))
        }
        for (const job of batch) {
          const { error: singleError } = await supabase.from('jobs').insert({
            title:                 job.title,
            company_name:          job.company_name,
            slug:                  job.slug,
            description:           job.description,
            excerpt:               job.excerpt,
            location_text:         job.location_text,
            location_country:      job.location_country,
            location_city:         job.location_city,
            location_remote:       job.location_remote,
            salary_min:            job.salary_min,
            salary_max:            job.salary_max,
            salary_currency:       job.salary_currency,
            salary_text:           job.salary_text,
            salary_is_predicted:   job.salary_is_predicted,
            employment_type:       job.employment_type,
            seniority_level:       job.seniority_level,
            qualifications_required: job.qualifications_required,
            source:                job.source,
            source_job_id:         job.source_job_id,
            source_url:            job.source_url,
            source_score:          job.source_score,
            application_url:       job.application_url,
            dedup_hash:            job.dedup_hash,
            platform:              job.platform,
            status:                'active',
            expires_at:            job.expires_at,
        published_at:          job.published_at,
            provider_id:           job.provider_id,
            ingestion_run_id:      run.id,
            data_completeness:     job.data_completeness,
            quality_flags:         job.quality_flags,
            normalisation_version: job.normalisation_version,
            raw_source_data:       job.raw_source_data,
            quality_score:         job.data_completeness,
            payment_status:        'free',
            employer_email:        `noreply+${provider.slug}@accountingbody.com`,
            employer_name:         provider.name,
            employer_company:      job.company_name,
            apply_method:          'external',
          })
          if (singleError) {
            if (isDedupConflict(singleError)) {
              // Job already exists — a legitimate outcome of the concurrent
              // keyword fan-out, not a failure. Count it as deduplicated.
              duplicateCount++
            } else {
              insertErrors.push(`${job.slug}: ${shortCode(singleError)}`)
              await logProviderError(
                provider.id, run.id, 'INSERT_FAILED',
                singleError.code ?? 'INSERT_ERROR',
                singleError.message,
                job.raw_source_data as Record<string, unknown>
              )
            }
          } else {
            insertedCount++
          }
        }
      } else {
        // data can be null even on success (e.g. if .select() returns nothing) —
        // only count confirmed inserted rows here, never fall back to batch.length.
        insertedCount += data?.length ?? 0
      }
    }

    const durationMs = Date.now() - startTime

    await completeProviderRun(run.id, {
      jobsFetched:       rawJobs.length,
      jobsInserted:      insertedCount,
      jobsDeduplicated:  duplicateCount,
      jobsRejected:      rejected.length,
      pagesFetched,
      durationMs,
      responseMs:        fetchMs,
      rawResponseSample: rawJobs[0] as Record<string, unknown> | undefined,
      relevanceRate:        qualityMetrics?.relevanceRate,
      avgDescriptionLength: qualityMetrics?.avgDescriptionLength,
      fieldCoverage:        qualityMetrics?.fieldCoverage,
    })

    if (typeof adapterResult.nextCursor === 'number') {
      try {
        await updateProviderKeywordCursor(
          provider.id,
          adapterResult.nextCursor
        )
      } catch (cursorErr: unknown) {
        console.error('[ingest] keyword cursor update failed:',
          shortCode(cursorErr))
      }
    }

    if (insertedCount > 0) {
      try {
        await incrementProviderJobsToday(provider.id, insertedCount)
      } catch (counterErr: unknown) {
        console.error('[ingest] jobs_today counter failed:', shortCode(counterErr))
        // do NOT rethrow — jobs were already inserted successfully
      }
    }

    await updateProviderHealth(provider.id, 'success', {
      jobsInserted: insertedCount,
      responseMs:   fetchMs,
      jobsFetched:  rawJobs.length,
    })

    // Transition-based email alert — diagnostic only, must NEVER fail an
    // otherwise-successful ingestion run. Same discipline as the metrics
    // block above and the jobs_today counter above it.
    //
    // The fresh health/quality values are computed here rather than
    // re-read from the DB: on this success path, updateProviderHealth
    // just wrote health_status to exactly this and always reset
    // consecutive_failures to 0 (a success breaks any failure streak),
    // and qualityMetrics.status is the data-quality read from this same
    // run, already computed above.
    try {
      const freshHealthStatus = rawJobs.length === 0 ? 'degraded' : 'healthy'
      const freshDataQualityStatus = qualityMetrics?.status ?? null
      const newAlertState = deriveAlertState(freshHealthStatus, freshDataQualityStatus, 0)
      await maybeSendProviderAlert(provider, newAlertState, 0)
    } catch (alertErr: unknown) {
      console.error('[ingest] provider alert failed:', shortCode(alertErr))
      // do NOT rethrow — ingestion must proceed regardless
    }

    // Cap the error list in the response payload only — logProviderError
    // above already logged every single one.
    const cappedInsertErrors = insertErrors.length > 20
      ? [...insertErrors.slice(0, 20), `...and ${insertErrors.length - 20} more`]
      : insertErrors

    return { status: 200, body: {
      ok:             true,
      provider:       slug,
      fetched:        rawJobs.length,
      inserted:       insertedCount,
      deduplicated:   duplicateCount,
      rejected:       rejected.length,
      pagesFetched,
      totalAvailable: totalAvailable ?? undefined,
      insertErrors:   cappedInsertErrors.length > 0 ? cappedInsertErrors : undefined,
      durationMs,
    } }

  } catch (err: unknown) {
    // Fixed text only; the error's own message is not returned or stored.
    const failure = `Import failed (${failureCode(err)})`
    const durationMs = Date.now() - startTime

    await failProviderRun(run.id, failure, 'INGESTION_ERROR')
    await updateProviderHealth(provider.id, 'failure', {
      errorMessage: failure,
      errorCode:    'INGESTION_ERROR',
    })

    // Transition-based email alert for the failure path — own try/catch,
    // must never prevent the error response below from being returned.
    //
    // updateProviderHealth's failure branch computes consecutive_failures
    // and health_status via its own internal read/write and, being
    // Promise<void>, never hands them back — re-read rather than guess.
    // This is one extra query on a path that already does several writes;
    // correctness matters more than saving it.
    try {
      const supabase = getSupabase()
      const { data: fresh } = await supabase
        .from('job_providers')
        .select('consecutive_failures, health_status, status, data_quality_status')
        .eq('id', provider.id)
        .single()

      if (fresh) {
        const freshConsecutiveFailures = fresh.consecutive_failures ?? 0
        // This route already returned early (before creating a run) if
        // provider.status !== 'active', so a 'paused' status here can only
        // mean THIS failure just crossed updateProviderHealth's 5-failure
        // auto-pause threshold — never a pre-existing pause from an
        // earlier run. Auto-pause has never been surfaced anywhere until
        // now (Phase A defect).
        const justAutoPaused = fresh.status === 'paused'

        // Guard against a single, first-ever failure: at
        // consecutive_failures === 1, health_status also reads 'degraded'
        // — the same string the success path uses for a zero-fetch run.
        // Calling deriveAlertState with that value here would misreport
        // an ordinary exception as "0 jobs fetched" via its second-
        // priority branch. Only evaluate once failures are genuinely a
        // pattern (>= 2) — also deriveAlertState's own 'failing'
        // threshold, so a single blip correctly doesn't alert at all.
        if (freshConsecutiveFailures >= 2) {
          const newAlertState = deriveAlertState(
            fresh.health_status,
            fresh.data_quality_status,
            freshConsecutiveFailures
          )
          await maybeSendProviderAlert(provider, newAlertState, freshConsecutiveFailures, justAutoPaused)
        }
      }
    } catch (alertErr: unknown) {
      console.error('[ingest] provider alert failed (failure path):', shortCode(alertErr))
      // do NOT rethrow — the error response below must still return
    }

    console.error(`[ingest/${slug}] Fatal error:`, shortCode(err))
    reportServerError('job import run failed', err, { area: 'ingest' })
    return { status: 500, body: { ok: false, error: failure, durationMs } }
  }
}
