import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import {
  SAVED_JOBS_COOKIE,
  LAST_SEEN_THROTTLE_MS,
  isValidUuid,
  parseImportBody,
  savedJobsCookieOptions,
  checkSavedJobsRateLimit,
} from '@/lib/saved-jobs'
import { insertManySaved, listSavedIds, touchLastSeen } from '@/lib/saved-jobs-store'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). See Session 15
// handover / jobs/direct/route.ts. Do not remove.
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store' }

function detectPlatform(req: NextRequest): 'ab' | 'et' {
  return req.headers.get('x-et-platform') === 'ethiotax' ? 'et' : 'ab'
}

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

async function parseJsonBody(req: NextRequest): Promise<unknown | undefined> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

// One-shot migration of a visitor's pre-existing localStorage saves
// (ab_saved_jobs) into the server-side table. Used once by Step 3.
// POST { jobIds: string[] } -> { imported: n, jobIds: <full current list> }
export async function POST(req: NextRequest) {
  try {
    if (!checkSavedJobsRateLimit(`write:${getClientIp(req)}`)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE })
    }

    const body = await parseJsonBody(req)
    const jobIds = parseImportBody(body)
    if (jobIds === null) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: NO_STORE })
    }

    const platform = detectPlatform(req)
    const existingCookie = req.cookies.get(SAVED_JOBS_COOKIE)?.value
    const hadValidCookie = isValidUuid(existingCookie)
    const visitorId = hadValidCookie ? (existingCookie as string) : crypto.randomUUID()

    const { imported } = jobIds.length > 0
      ? await insertManySaved(visitorId, platform, jobIds)
      : { imported: 0 }

    // Cookie is created only if this import actually saved something for a
    // brand-new visitor; a visitor who already had a valid cookie gets it
    // refreshed regardless (a successful request from them either way).
    const shouldSetCookie = hadValidCookie || imported > 0
    let currentIds: string[] = []
    if (shouldSetCookie) {
      await touchLastSeen(visitorId, platform, LAST_SEEN_THROTTLE_MS)
      currentIds = await listSavedIds(visitorId, platform)
    }

    const res = NextResponse.json({ imported, jobIds: currentIds }, { headers: NO_STORE })
    if (shouldSetCookie) {
      res.cookies.set(SAVED_JOBS_COOKIE, visitorId, savedJobsCookieOptions())
    }
    return res
  } catch (err) {
    console.error('api/saved-jobs/import POST error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: NO_STORE })
  }
}
