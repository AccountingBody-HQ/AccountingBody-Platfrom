import { NextRequest, NextResponse } from 'next/server'
import {
  getBrowsableJobsTotal, getCachedListingJobs, getCachedListingJobsCount, isUnfilteredListing,
  type SeniorityLevel, type EmploymentType,
} from '@/lib/jobs'
import { parseLimit, parseOffset } from './pagination'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
// 'default-no-store', not 'force-no-store': it still makes every Supabase
// fetch here uncached (they set no cache/revalidate option, so patch-fetch
// gives them revalidate 0), but 'force-no-store' would also stop
// unstable_cache from ever READING its entries (unstable-cache.js checks
// store.fetchCache !== 'force-no-store'), silently disabling the 5-minute
// listings cache in lib/jobs.ts. Do not change back.
export const fetchCache = 'default-no-store'

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

// Not exported: Next only allows its own route fields as exports here.
const TOTAL_NOT_AVAILABLE_LOG = 'api/jobs/direct: total not available, rows returned without it'
const TOTAL_STILL_COUNTING_LOG = 'api/jobs/direct: total still counting, rows returned without it'

// How long the total may take after the rows are ready.
const TOTAL_GRACE_MS = 1_000

// The total if it arrives within the grace time, otherwise null. The count
// itself is not stopped: it finishes on its own and fills the cache for the
// next request when it can. `lookup` never rejects (see its callers).
async function totalWithinGrace(lookup: Promise<number | null>): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>(resolve => { timer = setTimeout(() => resolve('late'), TOTAL_GRACE_MS) })
  try {
    const result = await Promise.race([lookup, late])
    if (result !== 'late') return result
    // Fixed text only: no request values.
    console.error(TOTAL_STILL_COUNTING_LOG)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const SENIORITY_VALUES: SeniorityLevel[] = ['junior', 'mid', 'senior', 'executive', 'director']
const EMPLOYMENT_TYPE_VALUES: EmploymentType[] = ['permanent', 'contract', 'temporary', 'part_time', 'internship']
const SORT_BY_VALUES = ['relevance', 'recent', 'salary_high', 'salary_low'] as const
type SortBy = (typeof SORT_BY_VALUES)[number]

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function parseCommaList(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
}

function parseSeniorityLevels(value: string | null): SeniorityLevel[] | undefined {
  const values = parseCommaList(value).filter((v): v is SeniorityLevel => SENIORITY_VALUES.includes(v as SeniorityLevel))
  return values.length > 0 ? values : undefined
}

function parseEmploymentTypes(value: string | null): EmploymentType[] | undefined {
  const values = parseCommaList(value).filter((v): v is EmploymentType => EMPLOYMENT_TYPE_VALUES.includes(v as EmploymentType))
  return values.length > 0 ? values : undefined
}

function parseSortBy(value: string | null): SortBy | undefined {
  return value && (SORT_BY_VALUES as readonly string[]).includes(value) ? (value as SortBy) : undefined
}

// GET /api/jobs/direct — public, no auth. Returns active employer + Adzuna
// listings for the jobs listings page. RLS on `jobs` (status = 'active')
// already restricts this to publicly-safe rows even if a filter is ever
// missed here.
//
// `count=true` runs a count-only query (no rows returned) — used by the
// client to refresh the total without re-fetching a page of jobs. A normal
// request always includes `total` alongside `jobs` too, so the common case
// (load a page, know the total) is a single request.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() || undefined
  const location = searchParams.get('location')?.trim() || undefined
  const locationCountry = searchParams.get('location_country')?.trim() || undefined
  const platform = searchParams.get('platform')?.trim() || 'ab'
  // Clamped (1-50, 0-10000) before either reaches the cache key or the
  // ranked search RPC; see ./pagination.ts.
  const limit = parseLimit(searchParams.get('limit'))
  const offset = parseOffset(searchParams.get('offset'))
  const countOnly = searchParams.get('count') === 'true'

  const employmentTypes = parseEmploymentTypes(searchParams.get('employment_types'))
  const seniorityLevels = parseSeniorityLevels(searchParams.get('seniority'))
  const remoteOnly = searchParams.get('remote') === 'true' ? true : undefined
  const salaryMin = parseOptionalNumber(searchParams.get('salary_min'))
  const salaryMax = parseOptionalNumber(searchParams.get('salary_max'))
  const postedWithin = parseOptionalNumber(searchParams.get('posted_within'))
  const qualificationsList = parseCommaList(searchParams.get('qualifications'))
  const qualifications = qualificationsList.length > 0 ? qualificationsList : undefined
  const sortBy = parseSortBy(searchParams.get('sort_by'))

  // No `sources` restriction here — every active job is public regardless of
  // source (employer, adzuna, or any ingestion pipeline provider).
  const baseParams = {
    platform,
    search,
    location,
    locationCountry,
    employmentTypes,
    seniorityLevels,
    remoteOnly,
    salaryMin,
    salaryMax,
    postedWithin,
    qualifications,
    sortBy,
  }

  // The plain list (nothing but the platform) takes its total from
  // getBrowsableJobsTotal: a pre-counted number, refreshed every 10 minutes,
  // that never waits for an exact count (owner decision D108). It never
  // throws; null means "not known". Filtered lists keep their exact count.
  const unfiltered = isUnfilteredListing(baseParams)

  try {
    if (countOnly) {
      const total = unfiltered ? await getBrowsableJobsTotal(platform) : await getCachedListingJobsCount(baseParams)
      return NextResponse.json({ jobs: [], total }, { headers: NO_CACHE_HEADERS })
    }

    // Both cached for 5 minutes in lib/jobs.ts; the count is keyed on the
    // filters only, so paging and re-sorting reuse it. Cards render
    // `excerpt`, never `description` (measured: ~26% of this endpoint's
    // response body), so getCachedListingJobs already returns rows without
    // it; getJobBySlug's separate detail-page path keeps the full text.
    // The HTTP response itself stays no-store (NO_CACHE_HEADERS): only the
    // data layer is cached, never the browser or CDN copy.
    //
    // The page of rows is what the visitor needs; the total only labels it.
    // So a count that does not arrive becomes `total: null` ("not known")
    // while the rows are still returned, and JobListingsClient pages with
    // Previous/Next until a later request has the total again. The rows
    // lookup is awaited first, so a rows error answers with the 503 below
    // without waiting for the count. Once the rows are ready, the total gets
    // at most TOTAL_GRACE_MS more; a count still running then (a slow
    // filtered or word count) becomes `total: null` instead of holding the
    // rows back. Both lookups start at the same moment.
    const rowsLookup = getCachedListingJobs({ ...baseParams, limit, offset })
    const totalLookup: Promise<number | null> = unfiltered
      ? getBrowsableJobsTotal(platform)
      : getCachedListingJobsCount(baseParams).catch((): null => {
        // Fixed text only: no request values, no upstream message.
        console.error(TOTAL_NOT_AVAILABLE_LOG)
        return null
      })
    const jobs = await rowsLookup
    const total = await totalWithinGrace(totalLookup)
    return NextResponse.json({ jobs, total }, { headers: NO_CACHE_HEADERS })
  } catch (err: unknown) {
    // 503, never a 200 with an empty list: JobListingsClient shows its error
    // state and Retry button on a non-2xx, and "No jobs found" only for a
    // genuine empty result.
    console.error('api/jobs/direct error:', err)
    return NextResponse.json(
      { error: 'Could not load jobs right now.' },
      { status: 503, headers: NO_CACHE_HEADERS }
    )
  }
}
