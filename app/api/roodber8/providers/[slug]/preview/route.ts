import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/providers'
import { getAdapter } from '@/lib/adapters'
import { normalise, type NormalisedJob } from '@/lib/ingestion/normalise'
import { validate, isAccountingFinanceRelevant } from '@/lib/ingestion/validate'
import { computeDedupHash } from '@/lib/ingestion/deduplicate'
import { isAuthenticated } from '@/lib/admin-auth'

export const maxDuration = 60

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

type Verdict = 'would_insert' | 'would_deduplicate' | 'would_reject'

const COVERAGE_FIELDS = [
  'title', 'company_name', 'location_text', 'location_city',
  'location_country', 'salary_min', 'salary_max', 'salary_currency',
  'description', 'application_url', 'employment_type', 'seniority_level',
  'qualifications_required',
] as const

function hasValue(job: NormalisedJob, field: (typeof COVERAGE_FIELDS)[number]): boolean {
  switch (field) {
    case 'salary_min':
    case 'salary_max':
      return job[field] !== null
    case 'qualifications_required':
      return job.qualifications_required.length > 0
    default:
      return !!job[field]
  }
}

function pct(count: number, total: number): number {
  if (total === 0) return 0
  return Math.round((count / total) * 10000) / 100
}

// ── POST /api/roodber8/providers/[slug]/preview ── runs the real pipeline
// (fetch → normalise → validate → dedup existence check) and writes NOTHING:
// no provider_runs row, no provider_errors row, no jobs insert, no
// job_providers update.
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  if (!(await isAuthenticated(req))) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const provider = await getProvider(params.slug)
  if (!provider) {
    return Response.json({ ok: false, error: 'Provider not found' }, { status: 404 })
  }

  let body: unknown = {}
  try {
    const text = await req.text()
    body = text ? JSON.parse(text) : {}
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }
  const b = (typeof body === 'object' && body !== null) ? (body as Record<string, unknown>) : {}

  const keyword = typeof b.keyword === 'string' && b.keyword.trim() ? b.keyword.trim() : undefined
  const maxPages = typeof b.maxPages === 'number' && Number.isFinite(b.maxPages) && b.maxPages > 0
    ? Math.floor(b.maxPages) : 1
  const sampleSize = typeof b.sampleSize === 'number' && Number.isFinite(b.sampleSize) && b.sampleSize > 0
    ? Math.floor(b.sampleSize) : 10

  let adapter
  try {
    adapter = getAdapter(provider.adapter_key)
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    )
  }

  const startedAt = Date.now()

  try {
    const adapterResult = await adapter.fetch(provider, { keyword, maxPages, maxKeywords: 1 })
    const rawJobs = adapterResult.jobs

    const normalised = rawJobs.map(raw => normalise(raw, provider))
    const { valid, rejected, rejectionReasons } = validate(normalised, provider.enforce_relevance ?? false)

    // ── Dedup existence check — SELECT only, never an INSERT ──────────────
    const withHashes = await Promise.all(
      valid.map(async job => ({
        job,
        dedup_hash: await computeDedupHash(job.title, job.company_name, job.location_text),
      }))
    )
    const uniqueHashes = Array.from(new Set(withHashes.map(w => w.dedup_hash)))
    let existingHashes = new Set<string>()
    if (uniqueHashes.length > 0) {
      const supabase = getSupabase()
      const { data: existingRows } = await supabase
        .from('jobs')
        .select('dedup_hash')
        .in('dedup_hash', uniqueHashes)
      existingHashes = new Set((existingRows ?? []).map(r => r.dedup_hash as string))
    }

    const dedupInfo = new Map<NormalisedJob, { dedup_hash: string; verdict: Verdict; already_exists: boolean }>()
    const seenInBatch = new Set<string>()
    let wouldInsert = 0
    let wouldDeduplicate = 0
    for (const { job, dedup_hash } of withHashes) {
      const isBatchDup = seenInBatch.has(dedup_hash)
      if (!isBatchDup) seenInBatch.add(dedup_hash)
      const alreadyExists = existingHashes.has(dedup_hash)
      const isDuplicate = isBatchDup || alreadyExists
      if (isDuplicate) wouldDeduplicate++
      else wouldInsert++
      dedupInfo.set(job, {
        dedup_hash,
        verdict: isDuplicate ? 'would_deduplicate' : 'would_insert',
        already_exists: alreadyExists,
      })
    }

    // ── Quality metrics — computed over every normalised (fetched) row ────
    const relevantCount = normalised.filter(isAccountingFinanceRelevant).length
    const avgDescriptionLength = normalised.length > 0
      ? Math.round(normalised.reduce((sum, j) => sum + j.description.length, 0) / normalised.length)
      : 0

    const fieldCoverage = Object.fromEntries(
      COVERAGE_FIELDS.map(field => [
        field,
        pct(normalised.filter(j => hasValue(j, field)).length, normalised.length),
      ])
    ) as Record<(typeof COVERAGE_FIELDS)[number], number>

    // ── Samples — first `sampleSize` rows, in original fetch order ────────
    const sampleSlice = normalised.slice(0, sampleSize)
    const sampleRaw = rawJobs.slice(0, sampleSize)
    const samples = await Promise.all(
      sampleSlice.map(async (job, i) => {
        const rejectReason = rejectionReasons.get(job.slug) ?? null
        const dedup = dedupInfo.get(job)
        // Rejected rows never reach the dedup check in production — the hash
        // is computed here purely for display, DB existence is left unknown.
        const dedup_hash = dedup?.dedup_hash
          ?? await computeDedupHash(job.title, job.company_name, job.location_text)
        const verdict: Verdict = rejectReason ? 'would_reject' : (dedup?.verdict ?? 'would_insert')
        return {
          raw: sampleRaw[i],
          normalised: job,
          verdict,
          reject_reason: rejectReason,
          quality_flags: job.quality_flags,
          dedup_hash,
          already_exists: dedup?.already_exists ?? false,
        }
      })
    )

    // ── keywords_used — best-effort, without duplicating adapter internals ─
    // If the caller passed an explicit keyword, that's exactly what was
    // queried. Otherwise: generic-rest's fallback keyword source is the
    // provider row itself (knowable here); adzuna picks one keyword off its
    // internal, non-exported keyword list by cursor position, which this
    // route has no way to know without the adapter reporting it back — so
    // it is reported as unknown ([]) rather than guessed.
    const keywordsUsed = keyword
      ? [keyword]
      : provider.adapter_key === 'generic-rest'
        ? (Array.isArray(provider.keywords) ? provider.keywords : [])
        : []

    const durationMs = Date.now() - startedAt

    return Response.json({
      ok: true,
      provider: {
        slug: provider.slug,
        name: provider.name,
        adapter_key: provider.adapter_key,
        auth_type: provider.auth_type,
        enforce_relevance: provider.enforce_relevance ?? false,
      },
      request: {
        url_pattern: provider.base_url,
        keywords_used: keywordsUsed,
        pages_fetched: adapterResult.pagesFetched,
      },
      totals: {
        fetched: rawJobs.length,
        would_insert: wouldInsert,
        would_deduplicate: wouldDeduplicate,
        would_reject: rejected.length,
        duration_ms: durationMs,
      },
      quality: {
        relevance_rate: pct(relevantCount, normalised.length),
        avg_description_length: avgDescriptionLength,
        field_coverage: {
          ...fieldCoverage,
          // NormalisedJob (lib/ingestion/normalise.ts) has no `category`
          // field — nothing to measure coverage of. Kept in the response
          // to match the documented shape; always 0.
          category: 0,
        },
      },
      samples,
      adapter_errors: adapterResult.errors ?? [],
    })
  } catch (err: unknown) {
    const durationMs = Date.now() - startedAt
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message, durationMs }, { status: 502 })
  }
}
