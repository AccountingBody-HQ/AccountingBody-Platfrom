import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
// force-dynamic alone does NOT stop Next 14.2 caching fetch() calls in route
// handlers (Data Cache, up to 1 year, survives deploys). This froze the sitemap
// at 13 Sept 2026. Do not remove. See Session 15 handover.
export const fetchCache = 'force-no-store'
export const maxDuration = 60

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('cron/prune-pending-subscribers: CRON_SECRET not set — running unauthenticated (dev mode)')
    return true
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// A confirmation JWT expires after 7 days (see the setExpirationTime("7d")
// call in app/api/subscribe/route.ts), so a pending row whose last
// confirmation email is older than that can never be confirmed — its link
// is dead. Pruning it stops these rows accumulating forever.
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()
    const cutoff = new Date(Date.now() - PENDING_MAX_AGE_MS).toISOString()

    // Tightly bounded by design: only rows that are still 'pending' AND
    // whose last confirmation email predates the 7-day JWT expiry. Never
    // touches a 'subscribed' or 'unsubscribed' row regardless of age.
    const { error, count } = await supabase
      .from('email_subscribers')
      .delete({ count: 'exact' })
      .eq('status', 'pending')
      .lt('last_confirmation_sent_at', cutoff)

    if (error) {
      console.error('cron/prune-pending-subscribers: delete failed', error.message)
      return NextResponse.json({ error: 'Prune failed' }, { status: 500 })
    }

    return NextResponse.json({ pruned: count ?? 0 })
  } catch (err: unknown) {
    console.error('cron/prune-pending-subscribers: fatal error', err)
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 })
  }
}
