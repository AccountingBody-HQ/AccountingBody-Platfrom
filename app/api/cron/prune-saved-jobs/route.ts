import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { SAVED_JOBS_RETENTION_DAYS } from '@/lib/saved-jobs'
import { pruneInactive } from '@/lib/saved-jobs-store'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the
// sitemap at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'
export const maxDuration = 60

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('cron/prune-saved-jobs: CRON_SECRET not set — running unauthenticated (dev mode)')
    return true
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Deletes saved_jobs rows whose last_seen_at is older than
// SAVED_JOBS_RETENTION_DAYS (7). See 0008_saved_jobs.sql's header comment —
// this is the ONLY deletion path for that table.
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const deleted = await pruneInactive(SAVED_JOBS_RETENTION_DAYS)
    return NextResponse.json({ ok: true, deleted })
  } catch (err: unknown) {
    console.error('cron/prune-saved-jobs: fatal error', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
