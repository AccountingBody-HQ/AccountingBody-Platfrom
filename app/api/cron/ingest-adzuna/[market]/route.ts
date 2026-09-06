import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  ADZUNA_MARKETS,
  ADZUNA_KEYWORDS,
  fetchAdzunaJobs,
  AdzunaApiError,
  type AdzunaMarket,
  type AdzunaJobResult,
} from '@/lib/adzuna'
import { slugify, randomSuffix, computeDedupHash, computeExcerpt, computeQualityScore, SOURCE_SCORE } from '@/lib/jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type RouteParams = { params: Promise<{ market: string }> }

const EXPIRY_DAYS = 30

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('cron/ingest-adzuna/[market]: CRON_SECRET not set — running unauthenticated (dev mode)')
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

/**
 * Builds a `jobs` table insert row from a normalized Adzuna result. Returns
 * a plain object (not typed against `JobInsert`) because this ingestion
 * needs fields `JobInsert`/`createJob` don't support directly — an explicit
 * `status: 'active'` (Adzuna listings publish immediately, skipping the
 * employer pending_approval flow) and a caller-supplied `expires_at`.
 *
 * `dedupHash` is passed in rather than computed here because the caller
 * now needs it *before* deciding whether to insert at all (the dedup_hash
 * pre-check) — computing it twice would be wasteful and risks the two
 * computations drifting apart.
 */
function buildJobRow(
  job: AdzunaJobResult,
  market: AdzunaMarket,
  expiresAt: string,
  publishedAt: string,
  dedupHash: string
) {
  const slug = `${slugify(job.title)}-${slugify(job.company_name)}-${randomSuffix()}`
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

/**
 * Handles one market's full ingestion cycle: fetch all 9 keywords in
 * parallel, dedup against existing Adzuna rows, insert new jobs one at a
 * time. Invoked by the orchestrator at /api/cron/ingest-adzuna (fire-and-
 * forget, one call per market) rather than being looped over in-process —
 * that split is what gives each market its own independent 300s budget
 * instead of all 10 sharing one.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { market: marketCode } = await params
  const market = ADZUNA_MARKETS.find(m => m.code === marketCode)
  if (!market) {
    return NextResponse.json({ error: `Unknown market: ${marketCode}` }, { status: 404 })
  }

  const supabase = getSupabase()
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const publishedAt = new Date().toISOString()

  let totalFetched = 0
  let totalInserted = 0
  let totalDuplicates = 0
  let totalErrors = 0
  const keywordResults: KeywordResult[] = []

  // All 9 keywords for this market fetched concurrently.
  const settled = await Promise.allSettled(
    ADZUNA_KEYWORDS.map(keyword => fetchAdzunaJobs(market.code, keyword, 1))
  )

  for (let i = 0; i < ADZUNA_KEYWORDS.length; i++) {
    const keyword = ADZUNA_KEYWORDS[i]
    const outcome = settled[i]
    const kw: KeywordResult = { keyword, fetched: 0, inserted: 0, duplicates: 0, errors: 0 }

    if (outcome.status === 'rejected') {
      const err: unknown = outcome.reason
      // A 404 means Adzuna doesn't support this country code at all. Any
      // other error (network, 5xx, rate limit, etc.) is scoped to just
      // this one keyword — it never blocks or aborts the others, since
      // Promise.allSettled already resolved every keyword independently.
      if (err instanceof AdzunaApiError && err.status === 404) {
        console.warn(`cron/ingest-adzuna/${market.code}: country not supported by Adzuna (keyword "${keyword}")`)
        kw.fetchError = 'country not supported by Adzuna'
      } else {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`cron/ingest-adzuna/${market.code}: fetch failed for "${keyword}":`, message)
        kw.fetchError = message
      }
      kw.errors = 1
      totalErrors += 1
      keywordResults.push(kw)
      continue
    }

    const jobs = outcome.value.jobs
    kw.fetched = jobs.length
    totalFetched += jobs.length

    if (jobs.length === 0) {
      console.log(`cron/ingest-adzuna/${market.code}: zero results for "${keyword}"`)
      keywordResults.push(kw)
      continue
    }

    // Batch dedup check via dedup_hash — the same title|company|location
    // hash the `jobs` table already enforces as a partial unique index
    // (see lib/jobs.ts's createJob comment). The previous version checked
    // application_url instead, which caused two problems: it missed
    // duplicates that come back under a different apply URL (a repost or a
    // second aggregator listing of the same real posting), and it produced
    // 23505 unique-violation errors on every dedup_hash collision it didn't
    // catch — 107 of the 450 GB jobs failed this way on the previous live
    // run (see adzuna-final-architecture.md). Computing the hash for the
    // whole batch up front and pre-checking it directly closes both gaps.
    const hashedJobs = await Promise.all(
      jobs.map(async job => ({
        job,
        dedupHash: await computeDedupHash(job.title, job.company_name, job.location_text),
      }))
    )

    const allHashes = hashedJobs.map(h => h.dedupHash)
    let existingHashes = new Set<string>()
    try {
      const { data: existing, error } = await supabase
        .from('jobs')
        .select('dedup_hash')
        .in('dedup_hash', allHashes)

      if (error) {
        console.error(`cron/ingest-adzuna/${market.code}: dedup lookup failed for "${keyword}":`, error)
      } else {
        existingHashes = new Set(
          (existing ?? [])
            .map((r: { dedup_hash: string | null }) => r.dedup_hash)
            .filter((hash): hash is string => Boolean(hash))
        )
      }
    } catch (err: unknown) {
      console.error(`cron/ingest-adzuna/${market.code}: dedup lookup threw for "${keyword}":`, err)
    }

    const newHashedJobs = hashedJobs.filter(h => !existingHashes.has(h.dedupHash))
    kw.duplicates = hashedJobs.length - newHashedJobs.length
    totalDuplicates += kw.duplicates

    // Inserted one row at a time (not a single multi-row insert): a
    // dedup_hash unique-index collision on one row must not abort its
    // siblings in the same batch. With the pre-check above, a 23505 here
    // should be rare — it can still happen if two jobs in this same batch
    // share a hash (the pre-check only catches hashes already in the
    // table, not duplicates within the batch itself) or from a race with
    // another concurrent insert. Either way, a 23505 at this point is a
    // duplicate, not a genuine error.
    for (const { job, dedupHash } of newHashedJobs) {
      try {
        const row = buildJobRow(job, market, expiresAt, publishedAt, dedupHash)
        const { error } = await supabase.from('jobs').insert(row)
        if (error) {
          if (error.code === '23505') {
            kw.duplicates += 1
            totalDuplicates += 1
          } else {
            console.error(`cron/ingest-adzuna/${market.code}: insert failed for "${keyword}" (${job.source_job_id}):`, error)
            kw.errors += 1
            totalErrors += 1
          }
        } else {
          kw.inserted += 1
          totalInserted += 1
        }
      } catch (err: unknown) {
        const code = (err as { code?: string } | null | undefined)?.code
        if (code === '23505') {
          kw.duplicates += 1
          totalDuplicates += 1
        } else {
          console.error(`cron/ingest-adzuna/${market.code}: insert threw for "${keyword}" (${job.source_job_id}):`, err)
          kw.errors += 1
          totalErrors += 1
        }
      }
    }

    keywordResults.push(kw)
  }

  return NextResponse.json({
    market: market.code,
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    keywords: keywordResults,
  })
}
