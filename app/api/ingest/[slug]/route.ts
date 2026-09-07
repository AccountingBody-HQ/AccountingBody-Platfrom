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

  const run = await createProviderRun(provider.id, provider.slug, 'cron')
  if (!run) {
    return Response.json({ ok: false, error: 'Failed to create run record' }, { status: 500 })
  }

  try {
    const adapter = getAdapter(provider.adapter_key)

    const fetchStart = Date.now()
    const rawJobs = await adapter.fetch(provider)
    const fetchMs = Date.now() - fetchStart

    const normalised = rawJobs.map(raw => normalise(raw, provider))

    const { valid, rejected } = validate(normalised)

    for (const job of rejected) {
      await logProviderError(
        provider.id,
        run.id,
        'VALIDATE_FAILED',
        'VALIDATION_REJECT',
        `Job "${job.title}" failed validation`,
        job.raw_source_data as Record<string, unknown>
      )
    }

    const { toInsert, duplicateCount } = await deduplicate(valid)

    const supabase = getSupabase()
    let insertedCount = 0
    const insertErrors: string[] = []

    for (const job of toInsert) {
      try {
        const { error } = await supabase.from('jobs').insert({
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

        if (error) {
          insertErrors.push(`${job.slug}: ${error.message}`)
          await logProviderError(
            provider.id,
            run.id,
            'INSERT_FAILED',
            error.code ?? 'INSERT_ERROR',
            error.message,
            job.raw_source_data as Record<string, unknown>
          )
        } else {
          insertedCount++
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        insertErrors.push(`${job.slug}: ${msg}`)
      }
    }

    const durationMs = Date.now() - startTime
    await completeProviderRun(run.id, {
      jobsFetched:       rawJobs.length,
      jobsInserted:      insertedCount,
      jobsDeduplicated:  duplicateCount,
      jobsRejected:      rejected.length,
      pagesFetched:      1,
      durationMs,
      responseMs:        fetchMs,
      rawResponseSample: rawJobs[0] as Record<string, unknown> | undefined,
    })

    if (insertedCount > 0) {
      await incrementProviderJobsToday(provider.id, insertedCount)
    }

    await updateProviderHealth(provider.id, 'success', {
      jobsInserted: insertedCount,
      responseMs:   fetchMs,
    })

    return Response.json({
      ok:           true,
      provider:     slug,
      fetched:      rawJobs.length,
      inserted:     insertedCount,
      deduplicated: duplicateCount,
      rejected:     rejected.length,
      insertErrors: insertErrors.length > 0 ? insertErrors : undefined,
      durationMs,
    })

  } catch (err: unknown) {
    const msg      = err instanceof Error ? err.message : String(err)
    const code     = 'INGESTION_ERROR'
    const durationMs = Date.now() - startTime

    await failProviderRun(run.id, msg, code)
    await updateProviderHealth(provider.id, 'failure', {
      errorMessage: msg,
      errorCode:    code,
    })

    console.error(`[ingest/${slug}] Fatal error:`, err)
    return Response.json({ ok: false, error: msg, durationMs }, { status: 500 })
  }
}
