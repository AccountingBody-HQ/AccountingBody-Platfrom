import { NextRequest, NextResponse } from 'next/server'
import { SAVED_JOBS_RETENTION_DAYS } from '@/lib/saved-jobs'
import { pruneInactive } from '@/lib/saved-jobs-store'
import { reportServerError } from '@/lib/report-error'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the
// sitemap at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'
export const maxDuration = 60

function isAuthorised(req: NextRequest, secret: string): boolean {
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// Deletes saved_jobs rows whose last_seen_at is older than
// SAVED_JOBS_RETENTION_DAYS (7). See 0008_saved_jobs.sql's header comment —
// this is the ONLY deletion path for that table.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/prune-saved-jobs: not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (!isAuthorised(req, secret)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const deleted = await pruneInactive(SAVED_JOBS_RETENTION_DAYS)
    return NextResponse.json({ ok: true, deleted })
  } catch (err: unknown) {
    console.error('cron/prune-saved-jobs: fatal error', err)
    reportServerError('saved jobs cleanup failed', err, { area: 'cron' })
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
