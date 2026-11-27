import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'
import { reportServerError } from '@/lib/report-error'
import { errorCode } from '@/lib/recycle-bin'
import { dataRetentionMode, runDataRetention, type DataRetentionResult } from '@/lib/data-retention'

// Daily at 06:30 UTC (vercel.json). Step 1 removes pending newsletter
// sign-ups whose confirmation link has expired. Step 2 runs the personal-data
// clean-up (lib/data-retention.ts): it counts the rows that are past their
// approved keeping period and deletes them only when RETENTION_DELETE is
// exactly "on". A step-2 failure never fails or undoes step 1. The answer is
// { pruned, retention: { mode, rules } } (counts and error codes only).

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'
export const maxDuration = 60

function getSupabase() {
  return getServerSupabase('cron')
}

function isAuthorised(req: NextRequest, secret: string): boolean {
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// A confirmation JWT expires after 7 days (see the setExpirationTime("7d")
// call in app/api/subscribe/route.ts), so a pending row whose last
// confirmation email is older than that can never be confirmed — its link
// is dead. Pruning it stops these rows accumulating forever.
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/prune-pending-subscribers: not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  if (!isAuthorised(req, secret)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const startedAt = Date.now()
  try {
    const supabase = getSupabase()
    const cutoff = new Date(startedAt - PENDING_MAX_AGE_MS).toISOString()

    // Tightly bounded by design: only rows that are still 'pending' AND
    // whose last confirmation email predates the 7-day JWT expiry. Never
    // touches a 'subscribed' or 'unsubscribed' row regardless of age.
    const { error, count } = await supabase
      .from('email_subscribers')
      .delete({ count: 'exact' })
      .eq('status', 'pending')
      .lt('last_confirmation_sent_at', cutoff)

    if (error) {
      console.error('cron/prune-pending-subscribers: delete failed', errorCode(error))
      return NextResponse.json({ error: 'Prune failed' }, { status: 500 })
    }

    const pruned = count ?? 0

    // Step 2: its own try/catch. The 40 s time budget counts from the start
    // of this route, so both steps fit within maxDuration.
    const mode = dataRetentionMode(process.env.RETENTION_DELETE)
    let retention: DataRetentionResult | { mode: typeof mode; error: string }
    try {
      retention = await runDataRetention({ supabase, now: new Date(startedAt), mode, startedAt })
    } catch (err: unknown) {
      console.error('cron/prune-pending-subscribers: data retention failed', errorCode(err))
      reportServerError('data retention failed', err, { area: 'cron' })
      retention = { mode, error: 'failed' }
    }

    return NextResponse.json({ pruned, retention })
  } catch (err: unknown) {
    console.error('cron/prune-pending-subscribers: fatal error', errorCode(err))
    reportServerError('pending subscriber cleanup failed', err, { area: 'cron' })
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
