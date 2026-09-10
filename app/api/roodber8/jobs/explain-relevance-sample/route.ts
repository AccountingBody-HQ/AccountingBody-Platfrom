import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/providers'
import { explainRelevance } from '@/lib/ingestion/validate'
import { isAuthenticated } from '@/lib/admin-auth'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

type DecidedBy = 'title' | 'description' | 'none'

// Narrow row shape — only the columns explainRelevance needs plus enough to
// identify the job in the response. Never selects '*'.
interface SampledJobRow {
  id: string
  title: string
  description: string
  company_name: string
}

// ── GET /api/roodber8/jobs/explain-relevance-sample ──────────────────────────
// Read-only diagnostic (§11.6). Samples currently-ACTIVE stored jobs and, for
// each, reports WHY the relevance filter passed it — a title keyword match, two
// distinct description keyword matches, or neither — so a human can judge how
// convincing each "why" is and estimate the filter's false-positive rate.
//
// Distinct from /api/roodber8/jobs/reevaluate-relevance, which surfaces jobs
// that FAIL the current filter. This endpoint inspects jobs that PASS it.
//
// Writes NOTHING: a single SELECT against `jobs`, no INSERT/UPDATE/DELETE on any
// table, no provider_runs / provider_errors / job_providers changes.
//
// Query params (all optional):
//   provider_slug  restrict to one provider (matched on jobs.provider_id)
//   limit          rows to sample, default 50, capped at 500
//   decided_by     keep only rows whose decision came from 'title',
//                  'description' or 'none' (applied after explainRelevance)
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)

  const providerSlug = searchParams.get('provider_slug')?.trim() || null

  const rawLimit = Number(searchParams.get('limit'))
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.trunc(rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT

  const rawDecidedBy = searchParams.get('decided_by')
  const decidedByFilter: DecidedBy | null =
    rawDecidedBy === 'title' || rawDecidedBy === 'description' || rawDecidedBy === 'none'
      ? rawDecidedBy
      : null

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
    .select('id, title, description, company_name')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (providerId) {
    query = query.eq('provider_id', providerId)
  }

  const { data, error } = await query
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const jobs = (data ?? []) as SampledJobRow[]

  const results = jobs
    .map(job => {
      // explainRelevance signature is (title, description) — see
      // lib/ingestion/validate.ts. Coalesce to '' defensively, mirroring
      // reevaluate-relevance's handling of the same columns.
      const explanation = explainRelevance(job.title ?? '', job.description ?? '')
      return {
        id: job.id,
        title: job.title,
        company_name: job.company_name,
        decidedBy: explanation.decidedBy,
        titleMatches: explanation.titleMatches,
        descriptionMatches: explanation.descriptionMatches,
      }
    })
    .filter(r => decidedByFilter === null || r.decidedBy === decidedByFilter)

  return Response.json({
    ok: true,
    count: results.length,
    results,
  })
}
