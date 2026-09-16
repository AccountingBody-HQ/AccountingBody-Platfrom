import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
  SAVED_JOBS_COOKIE,
  SAVED_JOBS_LIMIT,
  LAST_SEEN_THROTTLE_MS,
  isValidUuid,
  parseJobIdBody,
  savedJobsCookieOptions,
  isJobAvailable,
  checkSavedJobsRateLimit,
} from '@/lib/saved-jobs'
import {
  listSaved,
  listSavedIds,
  countSaved,
  findSavableJob,
  insertSaved,
  deleteSaved,
  touchLastSeen,
} from '@/lib/saved-jobs-store'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the
// sitemap at 13 Sept 2026 — see Session 15 handover / jobs/direct/route.ts.
// Do not remove.
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store' }

function detectPlatform(req: NextRequest): 'ab' | 'et' {
  // Same header, same trust boundary as every other server-side platform
  // check in this app (e.g. app/api/subscribe/route.ts) — middleware.ts
  // sets it from the real Host, never a client-supplied value.
  return req.headers.get('x-et-platform') === 'ethiotax' ? 'et' : 'ab'
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

function getVisitorId(req: NextRequest): string | null {
  const value = req.cookies.get(SAVED_JOBS_COOKIE)?.value
  return isValidUuid(value) ? value : null
}

async function parseJsonBody(req: NextRequest): Promise<unknown | undefined> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

// GET /api/saved-jobs            -> { jobs: [{ savedAt, available, job }] }
// GET /api/saved-jobs?view=ids   -> { jobIds: string[] }  (Save-button state)
// No valid ab_vid cookie -> empty results, no Set-Cookie (never creates one
// on a mere read).
export async function GET(req: NextRequest) {
  try {
    const visitorId = getVisitorId(req)
    const view = req.nextUrl.searchParams.get('view')

    if (!visitorId) {
      const empty = view === 'ids' ? { jobIds: [] } : { jobs: [] }
      return NextResponse.json(empty, { headers: NO_STORE })
    }

    const platform = detectPlatform(req)
    await touchLastSeen(visitorId, platform, LAST_SEEN_THROTTLE_MS)

    let responseBody: Record<string, unknown>
    if (view === 'ids') {
      responseBody = { jobIds: await listSavedIds(visitorId, platform) }
    } else {
      const now = new Date()
      const saved = await listSaved(visitorId, platform)
      responseBody = {
        jobs: saved.map(({ savedAt, job }) => {
          const available = isJobAvailable(job, now)
          // `status` powers `available` above but is not in lib/jobs.ts's
          // JOB_COLUMNS public allowlist — it must never reach the client.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { status, ...publicJob } = job
          return { savedAt, available, job: publicJob }
        }),
      }
    }

    const res = NextResponse.json(responseBody, { headers: NO_STORE })
    // Successful read from a visitor who already has a valid cookie ->
    // refresh its 7-day window.
    res.cookies.set(SAVED_JOBS_COOKIE, visitorId, savedJobsCookieOptions())
    return res
  } catch (err) {
    console.error('api/saved-jobs GET error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: NO_STORE })
  }
}

// POST { jobId } -> { saved: true, jobId }. Idempotent: saving an
// already-saved job succeeds without growing the visitor's count.
export async function POST(req: NextRequest) {
  try {
    if (!checkSavedJobsRateLimit(`write:${getClientIp(req)}`)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE })
    }

    const body = await parseJsonBody(req)
    const jobId = parseJobIdBody(body)
    if (!jobId) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE })
    }

    const platform = detectPlatform(req)
    const savable = await findSavableJob(jobId, platform)
    if (!savable) {
      return NextResponse.json({ error: 'job_not_found' }, { status: 404, headers: NO_STORE })
    }

    const existingCookie = req.cookies.get(SAVED_JOBS_COOKIE)?.value
    const hadValidCookie = isValidUuid(existingCookie)
    // A brand-new visitor (no valid cookie) has zero existing rows by
    // definition, so the limit check below only ever runs for a visitor
    // who already has one.
    const visitorId = hadValidCookie ? (existingCookie as string) : crypto.randomUUID()

    if (hadValidCookie) {
      const count = await countSaved(visitorId, platform)
      if (count >= SAVED_JOBS_LIMIT) {
        const existingIds = await listSavedIds(visitorId, platform)
        if (!existingIds.includes(jobId)) {
          return NextResponse.json({ error: 'limit_reached' }, { status: 409, headers: NO_STORE })
        }
      }
    }

    await insertSaved(visitorId, platform, jobId)
    await touchLastSeen(visitorId, platform, LAST_SEEN_THROTTLE_MS)

    const res = NextResponse.json({ saved: true, jobId }, { headers: NO_STORE })
    // Cookie is only ever set here, on a successful save — never on a
    // mere GET from a visitor with no saves yet.
    res.cookies.set(SAVED_JOBS_COOKIE, visitorId, savedJobsCookieOptions())
    return res
  } catch (err) {
    console.error('api/saved-jobs POST error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: NO_STORE })
  }
}

// DELETE { jobId } -> { saved: false, jobId }. Idempotent; a visitor with
// no cookie has nothing to delete and gets 200 with no Set-Cookie.
export async function DELETE(req: NextRequest) {
  try {
    if (!checkSavedJobsRateLimit(`write:${getClientIp(req)}`)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE })
    }

    const body = await parseJsonBody(req)
    const jobId = parseJobIdBody(body)
    if (!jobId) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE })
    }

    const visitorId = getVisitorId(req)
    if (!visitorId) {
      return NextResponse.json({ saved: false, jobId }, { headers: NO_STORE })
    }

    const platform = detectPlatform(req)
    await deleteSaved(visitorId, platform, jobId)
    await touchLastSeen(visitorId, platform, LAST_SEEN_THROTTLE_MS)

    const res = NextResponse.json({ saved: false, jobId }, { headers: NO_STORE })
    res.cookies.set(SAVED_JOBS_COOKIE, visitorId, savedJobsCookieOptions())
    return res
  } catch (err) {
    console.error('api/saved-jobs DELETE error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: NO_STORE })
  }
}
