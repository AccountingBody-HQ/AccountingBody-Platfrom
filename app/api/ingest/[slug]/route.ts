import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getProvider,
  createProviderRun,
  completeProviderRun,
  failProviderRun,
  updateProviderHealth,
  logProviderError,
  incrementProviderJobsToday,
} from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'
import { normalise } from '@/lib/ingestion/normalise'
import { deduplicate } from '@/lib/ingestion/deduplicate'
import { validate } from '@/lib/ingestion/validate'

export const maxDuration = 300

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const BATCH_SIZE = 50

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const startTime = Date.now()

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { slug } = params

  const provider = await getProvider(slug)
  if (!provider) {
    return Response.json({ ok: false, error: 'Provider not found' }, { status: 404 })
  }
  if (provider.status !== 'active') {
    return Response.json({ ok: true, skipped: true, reason: 'Provider inactive' })
  }
  if (
    provider.rate_limit_daily !== null &&
    provider.requests_today >= provider.rate_limit_daily
  ) {
    return Response.json({ ok: true, skipped: true, reason: 'Daily rate limit reached' })
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

  const run = await createProviderRun(provider.id, provider.slug, 'cron')
  if (!run) {
    return Response.json({ ok: false, error: 'Failed to create run record' }, { status: 500 })
  }

  try {
    const adapter = getAdapter(provider.adapter_key)

    const fetchStart = Date.now()
    const adapterResult = await adapter.fetch(provider)
    const fetchMs = Date.now() - fetchStart

    const { jobs: rawJobs, pagesFetched, totalAvailable } = adapterResult

    const normalised = rawJobs.map(raw => normalise(raw, provider))
    const { valid, rejected } = validate(normalised)

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

    const { toInsert, duplicateCount } = await deduplicate(valid)

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
        location_remote:       job.location_remote,
        salary_min:            job.salary_min,
        salary_max:            job.salary_max,
        salary_currency:       job.salary_currency,
        salary_text:           job.salary_text,
        employment_type:       job.employment_type,
        seniority_level:       job.seniority_level,
        source:                job.source,
        source_job_id:         job.source_job_id,
        source_url:            job.source_url,
        source_score:          job.source_score,
        application_url:       job.application_url,
        dedup_hash:            job.dedup_hash,
        platform:              job.platform,
        status:                'active' as const,
        expires_at:            job.expires_at,
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
        // Batch failed — try individual inserts to salvage partial success
        console.warn(`[ingest/${slug}] Batch insert failed, falling back to individual inserts:`, error.message)
        for (const job of batch) {
          const { error: singleError } = await supabase.from('jobs').insert({
            title:                 job.title,
            company_name:          job.company_name,
            slug:                  job.slug,
            description:           job.description,
            excerpt:               job.excerpt,
            location_text:         job.location_text,
            location_country:      job.location_country,
            location_remote:       job.location_remote,
            salary_min:            job.salary_min,
            salary_max:            job.salary_max,
            salary_currency:       job.salary_currency,
            salary_text:           job.salary_text,
            employment_type:       job.employment_type,
            seniority_level:       job.seniority_level,
            source:                job.source,
            source_job_id:         job.source_job_id,
            source_url:            job.source_url,
            source_score:          job.source_score,
            application_url:       job.application_url,
            dedup_hash:            job.dedup_hash,
            platform:              job.platform,
            status:                'active',
            expires_at:            job.expires_at,
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
            insertErrors.push(`${job.slug}: ${singleError.message}`)
            await logProviderError(
              provider.id, run.id, 'INSERT_FAILED',
              singleError.code ?? 'INSERT_ERROR',
              singleError.message,
              job.raw_source_data as Record<string, unknown>
            )
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
    })

    if (insertedCount > 0) {
      try {
        await incrementProviderJobsToday(provider.id, insertedCount)
      } catch (counterErr: unknown) {
        const msg = counterErr instanceof Error
          ? counterErr.message : String(counterErr)
        console.error('[ingest] jobs_today counter failed:', msg)
        // do NOT rethrow — jobs were already inserted successfully
      }
    }

    await updateProviderHealth(provider.id, 'success', {
      jobsInserted: insertedCount,
      responseMs:   fetchMs,
    })

    return Response.json({
      ok:             true,
      provider:       slug,
      fetched:        rawJobs.length,
      inserted:       insertedCount,
      deduplicated:   duplicateCount,
      rejected:       rejected.length,
      pagesFetched,
      totalAvailable: totalAvailable ?? undefined,
      insertErrors:   insertErrors.length > 0 ? insertErrors : undefined,
      durationMs,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - startTime

    await failProviderRun(run.id, msg, 'INGESTION_ERROR')
    await updateProviderHealth(provider.id, 'failure', {
      errorMessage: msg,
      errorCode:    'INGESTION_ERROR',
    })

    console.error(`[ingest/${slug}] Fatal error:`, err)
    return Response.json({ ok: false, error: msg, durationMs }, { status: 500 })
  }
}
