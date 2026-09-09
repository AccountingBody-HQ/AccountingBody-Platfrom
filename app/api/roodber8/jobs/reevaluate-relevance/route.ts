import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/providers'
import { isRelevantByText } from '@/lib/ingestion/validate'
import { isAuthenticated } from '@/lib/admin-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 10000
const UPDATE_BATCH_SIZE = 100
const SAMPLE_SIZE = 50

interface CandidateJobRow {
  id: string
  title: string
  description: string
  slug: string
  company_name: string
}

interface QualityFlagsRow {
  id: string
  quality_flags: string[] | null
}

// ── POST /api/roodber8/jobs/reevaluate-relevance ──
// One-off (and repeatable) sweep that re-runs the current relevance filter
// against existing `jobs` rows. Needed because ~4,850 Adzuna jobs were
// ingested under the pre-de40623 broken filter (bare substring match — 'AP'
// matched inside 'apply') and carry no usable low_relevance signal. Also
// permanently useful: any future taxonomy change needs a way to re-sweep.
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return new Response('Unauthorized', { status: 401 })
  }

  const rawBody: unknown = await req.json().catch(() => ({}))
  const body = isRecord(rawBody) ? rawBody : {}

  const providerSlug = typeof body.provider_slug === 'string' && body.provider_slug.trim() !== ''
    ? body.provider_slug.trim()
    : null

  const dryRun = typeof body.dry_run === 'boolean' ? body.dry_run : true

  const requestedLimit = typeof body.limit === 'number' && Number.isFinite(body.limit)
    ? Math.trunc(body.limit)
    : DEFAULT_LIMIT
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT)

  const requestedOffset = typeof body.offset === 'number' && Number.isFinite(body.offset)
    ? Math.trunc(body.offset)
    : 0
  const offset = Math.max(requestedOffset, 0)

  const supabase = getSupabase()

  let providerId: string | null = null
  if (providerSlug) {
    const provider = await getProvider(providerSlug)
    if (!provider) {
      return Response.json({ ok: false, error: `Provider not found: ${providerSlug}` }, { status: 404 })
    }
    providerId = provider.id
  }

  let query = supabase
    .from('jobs')
    .select('id, title, description, slug, company_name')
    .eq('status', 'active')

  if (providerId) {
    query = query.eq('provider_id', providerId)
  }

  // Deterministic order — without it, Postgres doesn't guarantee which
  // rows a LIMIT returns, so successive sweep calls could re-scan the
  // same slice instead of paging through the full active set.
  query = query.order('created_at', { ascending: true })

  query = offset > 0
    ? query.range(offset, offset + limit - 1)
    : query.limit(limit)

  const { data, error } = await query
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const jobs = (data ?? []) as CandidateJobRow[]

  const failing = jobs.filter(job => !isRelevantByText(job.title ?? '', job.description ?? ''))

  const sample = failing.slice(0, SAMPLE_SIZE).map(job => ({
    id: job.id,
    title: job.title,
    company_name: job.company_name,
  }))

  if (dryRun) {
    return Response.json({
      ok: true,
      dry_run: true,
      offset,
      limit,
      examined: jobs.length,
      irrelevant: failing.length,
      updated: 0,
      sample,
    })
  }

  // Not a dry run — reject the failing jobs. Never delete: the dedup index
  // is partial and excludes rejected rows, so a rejected job can be
  // re-ingested later if the taxonomy improves.
  let updated = 0

  for (let i = 0; i < failing.length; i += UPDATE_BATCH_SIZE) {
    const batch = failing.slice(i, i + UPDATE_BATCH_SIZE)
    const batchIds = batch.map(job => job.id)

    const { data: flagRows, error: flagError } = await supabase
      .from('jobs')
      .select('id, quality_flags')
      .in('id', batchIds)

    if (flagError) {
      console.error('[reevaluate-relevance] failed to fetch quality_flags for batch:', flagError.message)
      continue
    }

    const flagsById = new Map<string, string[]>()
    for (const row of (flagRows ?? []) as QualityFlagsRow[]) {
      flagsById.set(row.id, row.quality_flags ?? [])
    }

    const results = await Promise.all(batchIds.map(async id => {
      const existingFlags = flagsById.get(id) ?? []
      const mergedFlags = existingFlags.includes('low_relevance')
        ? existingFlags
        : [...existingFlags, 'low_relevance']

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ status: 'rejected', quality_flags: mergedFlags })
        .eq('id', id)

      if (updateError) {
        console.error(`[reevaluate-relevance] failed to reject job ${id}:`, updateError.message)
        return false
      }
      return true
    }))

    updated += results.filter(Boolean).length
  }

  return Response.json({
    ok: true,
    dry_run: false,
    offset,
    limit,
    examined: jobs.length,
    irrelevant: failing.length,
    updated,
    sample,
  })
}
