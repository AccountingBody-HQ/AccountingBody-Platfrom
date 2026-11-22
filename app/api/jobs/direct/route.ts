import { NextRequest, NextResponse } from 'next/server'
import { loadDirectJobsPage, loadDirectJobsTotal, parseDirectJobsQuery } from './load'
import { reportServerError } from '@/lib/report-error'

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

// GET /api/jobs/direct — public, no auth. Returns active employer + Adzuna
// listings for the jobs listings page. RLS on `jobs` (status = 'active')
// already restricts this to publicly-safe rows even if a filter is ever
// missed here.
//
// `count=true` runs a count-only query (no rows returned) — used by the
// client to refresh the total without re-fetching a page of jobs. A normal
// request always includes `total` alongside `jobs` too, so the common case
// (load a page, know the total) is a single request.
//
// The query parsing and the rows + total rules live in ./load.ts, shared
// with the /jobs/listings server page so both read the same cached pages.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = parseDirectJobsQuery(searchParams)

  try {
    if (query.countOnly) {
      const total = await loadDirectJobsTotal(query)
      return NextResponse.json({ jobs: [], total }, { headers: NO_CACHE_HEADERS })
    }

    // The HTTP response itself stays no-store (NO_CACHE_HEADERS): only the
    // data layer is cached, never the browser or CDN copy.
    const { jobs, total } = await loadDirectJobsPage(query)
    return NextResponse.json({ jobs, total }, { headers: NO_CACHE_HEADERS })
  } catch (err: unknown) {
    // 503, never a 200 with an empty list: JobListingsClient shows its error
    // state and Retry button on a non-2xx, and "No jobs found" only for a
    // genuine empty result.
    console.error('api/jobs/direct error:', err)
    reportServerError('job listings load failed', err, { area: 'public' })
    return NextResponse.json(
      { error: 'Could not load jobs right now.' },
      { status: 503, headers: NO_CACHE_HEADERS }
    )
  }
}
