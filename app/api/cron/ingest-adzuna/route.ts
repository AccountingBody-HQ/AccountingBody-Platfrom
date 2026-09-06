import { NextRequest, NextResponse } from 'next/server'
import { ADZUNA_MARKETS } from '@/lib/adzuna'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.warn('cron/ingest-adzuna: CRON_SECRET not set — running unauthenticated (dev mode)')
    return true
  }
  return req.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Orchestrator only — no Supabase access, no Adzuna fetching, no scoring.
 * Fires one request per market at `/api/cron/ingest-adzuna/{code}` (which
 * does the real work), one function invocation per market so each gets its
 * own independent 300s budget instead of all 10 sharing one (see
 * adzuna-manual-trigger.md and adzuna-parallel-commit-test.md for what
 * happened when they shared one).
 *
 * HISTORY: an unawaited fire-and-forget `fetch()` (no `await`, immediate
 * return) risks Vercel freezing the execution environment before the
 * request is even sent. The documented fix, `after()` from `next/server`,
 * does not exist in this project's installed Next.js version (14.2.35) —
 * see adzuna-after-fix.md for the confirmed blocker. This version instead
 * awaits every market request via `Promise.allSettled` before returning,
 * which guarantees each one was actually dispatched and reached its target
 * route before this function's own response is sent.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const secret = process.env.CRON_SECRET
  const origin = new URL(req.url).origin

  const results = await Promise.allSettled(
    ADZUNA_MARKETS.map(async (market) => {
      const res = await fetch(`${origin}/api/cron/ingest-adzuna/${market.code}`, {
        method: 'GET',
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      })
      return { market: market.code, status: res.status }
    })
  )

  const triggered = results.map((r, i) => ({
    market: ADZUNA_MARKETS[i].code,
    accepted: r.status === 'fulfilled' ? r.value.status < 500 : false,
    error: r.status === 'rejected' ? String(r.reason) : undefined,
  }))

  return NextResponse.json({
    triggered,
    timestamp: new Date().toISOString(),
  })
}
