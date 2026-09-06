import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAdzunaJobs, ADZUNA_MARKETS, AdzunaApiError, type AdzunaMarket, type AdzunaJobResult } from '@/lib/adzuna'
import { slugify, randomSuffix, computeDedupHash, computeExcerpt, computeQualityScore, SOURCE_SCORE } from '@/lib/jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const KEYWORDS = [
  'accountant',
  'ACCA',
  'finance manager',
  'audit',
  'tax accountant',
  'FP&A',
  'management accountant',
  'CIMA',
  'ICAEW',
]

const EXPIRY_DAYS = 30

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('cron/ingest-adzuna: CRON_SECRET not set — running unauthenticated (dev mode)')
    return true
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

interface KeywordResult {
  keyword: string
  fetched: number
  inserted: number
  duplicates: number
  errors: number
  fetchError?: string
}

interface CountrySummary {
  code: string
  name: string
  platform: string[]
  status: 'ok' | 'country_not_supported' | 'completed_with_errors'
  fetched: number
  inserted: number
  duplicates: number
  errors: number
  keywords: KeywordResult[]
}

/**
 * Builds a `jobs` table insert row from a normalized Adzuna result. Returns
 * a plain object (not typed against `JobInsert`) because this ingestion
 * needs fields `JobInsert`/`createJob` don't support directly — an explicit
 * `status: 'active'` (Adzuna listings publish immediately, skipping the
 * employer pending_approval flow) and a caller-supplied `expires_at`.
 */
async function buildJobRow(
  job: AdzunaJobResult,
  market: AdzunaMarket,
  expiresAt: string,
  publishedAt: string
) {
  const slug = `${slugify(job.title)}-${slugify(job.company_name)}-${randomSuffix()}`
  const dedupHash = await computeDedupHash(job.title, job.company_name, job.location_text)
  const qualityScore = computeQualityScore({
    title: job.title,
    company_name: job.company_name,
    description: job.description,
    location_text: job.location_text,
    employer_email: '',
    employer_name: '',
    employer_company: job.company_name,
    salary_text: job.salary_text ?? undefined,
    salary_min: job.salary_min ?? undefined,
    location_city: job.location_city ?? undefined,
    employment_type: job.employment_type ?? undefined,
  })

  return {
    source: 'adzuna',
    source_job_id: job.source_job_id,
    source_url: job.source_url,
    platform: market.platform,
    title: job.title,
    slug,
    company_name: job.company_name,
    description: job.description,
    excerpt: computeExcerpt(job.description || job.title),
    location_text: job.location_text,
    location_city: job.location_city,
    location_country: job.location_country,
    location_remote: false,
    salary_text: job.salary_text,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    salary_currency: job.salary_currency,
    employment_type: job.employment_type,
    category: job.category,
    status: 'active',
    published_at: publishedAt,
    expires_at: expiresAt,
    payment_status: 'free',
    employer_email: 'noreply+adzuna@accountingbody.com',
    employer_name: 'Adzuna',
    employer_company: job.company_name,
    apply_method: 'external',
    application_url: job.application_url,
    source_score: SOURCE_SCORE.adzuna,
    quality_score: qualityScore,
    dedup_hash: dedupHash,
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = getSupabase()
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const publishedAt = new Date().toISOString()

  const breakdown: CountrySummary[] = []
  let totalFetched = 0
  let totalInserted = 0
  let totalDuplicates = 0
  let totalErrors = 0

  for (const market of ADZUNA_MARKETS) {
    const countrySummary: CountrySummary = {
      code: market.code,
      name: market.name,
      platform: market.platform,
      status: 'ok',
      fetched: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0,
      keywords: [],
    }

    // All 9 keywords for this market are fetched concurrently — this is the
    // fix for the 90-sequential-call timeout (see adzuna-manual-trigger.md):
    // markets still run one at a time (outer loop), but each market's 9
    // Adzuna calls now happen in parallel instead of one after another.
    // Promise.allSettled (not Promise.all) so one rejected keyword can never
    // block or discard the other 8 outcomes.
    const settled = await Promise.allSettled(
      KEYWORDS.map(keyword => fetchAdzunaJobs(market.code, keyword, 1))
    )

    // Because all 9 calls are already in flight before any of them resolve,
    // a 404 can no longer be caught mid-loop to skip firing the rest of this
    // country's requests (that optimisation required knowing the outcome of
    // call 1 before sending call 2, which is exactly the sequential
    // behaviour being removed). The country is still correctly reported as
    // `country_not_supported` and no jobs from it are processed — the only
    // change is that all 9 calls always fire, then get evaluated together.
    let countryNotSupportedLogged = false

    for (let i = 0; i < KEYWORDS.length; i++) {
      const keyword = KEYWORDS[i]
      const outcome = settled[i]
      const kw: KeywordResult = { keyword, fetched: 0, inserted: 0, duplicates: 0, errors: 0 }

      if (outcome.status === 'rejected') {
        const err: unknown = outcome.reason
        // A 404 means Adzuna doesn't support this country code at all. Any
        // other error (network, 5xx, rate limit, etc.) is scoped to just
        // this one keyword.
        if (err instanceof AdzunaApiError && err.status === 404) {
          if (!countryNotSupportedLogged) {
            console.warn(`cron/ingest-adzuna: country not supported by Adzuna: ${market.code}`)
            countryNotSupportedLogged = true
          }
          kw.fetchError = 'country not supported by Adzuna'
          countrySummary.status = 'country_not_supported'
        } else {
          const message = err instanceof Error ? err.message : String(err)
          console.error(`cron/ingest-adzuna: fetch failed for ${market.code}/"${keyword}":`, message)
          kw.fetchError = message
        }
        countrySummary.errors += 1
        totalErrors += 1
        countrySummary.keywords.push(kw)
        continue
      }

      const jobs = outcome.value.jobs
      kw.fetched = jobs.length
      countrySummary.fetched += jobs.length
      totalFetched += jobs.length

      if (jobs.length === 0) {
        console.log(`cron/ingest-adzuna: zero results for ${market.code}/"${keyword}"`)
        countrySummary.keywords.push(kw)
        continue
      }

      // Skip duplicates — check whether the apply URL (`application_url`)
      // already exists before inserting. Batched per country/keyword combo
      // (one query for up to 50 URLs) rather than one lookup per job.
      const applyUrls = jobs.map(j => j.application_url)
      let existingUrls = new Set<string>()
      try {
        const { data: existing, error } = await supabase
          .from('jobs')
          .select('application_url')
          .in('application_url', applyUrls)

        if (error) {
          console.error(`cron/ingest-adzuna: dedup lookup failed for ${market.code}/"${keyword}":`, error)
        } else {
          existingUrls = new Set(
            (existing ?? [])
              .map((r: { application_url: string | null }) => r.application_url)
              .filter((url): url is string => Boolean(url))
          )
        }
      } catch (err: unknown) {
        console.error(`cron/ingest-adzuna: dedup lookup threw for ${market.code}/"${keyword}":`, err)
      }

      const newJobs = jobs.filter(j => !existingUrls.has(j.application_url))
      kw.duplicates = jobs.length - newJobs.length
      countrySummary.duplicates += kw.duplicates
      totalDuplicates += kw.duplicates

      // Inserted one row at a time (not a single multi-row insert): a
      // dedup_hash unique-index collision on one row must not abort its
      // siblings in the same batch.
      for (const job of newJobs) {
        try {
          const row = await buildJobRow(job, market, expiresAt, publishedAt)
          const { error } = await supabase.from('jobs').insert(row)
          if (error) {
            console.error(`cron/ingest-adzuna: insert failed for ${market.code}/"${keyword}" (${job.source_job_id}):`, error)
            kw.errors += 1
            countrySummary.errors += 1
            totalErrors += 1
          } else {
            kw.inserted += 1
            countrySummary.inserted += 1
            totalInserted += 1
          }
        } catch (err: unknown) {
          console.error(`cron/ingest-adzuna: insert threw for ${market.code}/"${keyword}" (${job.source_job_id}):`, err)
          kw.errors += 1
          countrySummary.errors += 1
          totalErrors += 1
        }
      }

      countrySummary.keywords.push(kw)
    }

    if (countrySummary.status === 'ok' && countrySummary.errors > 0) {
      countrySummary.status = 'completed_with_errors'
    }

    breakdown.push(countrySummary)
  }

  return NextResponse.json({
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    breakdown,
  })
}
