import * as Sentry from '@sentry/nextjs'
import { NextRequest } from 'next/server'
import { getProvidersDueForFetch, reapStaleRuns } from '@/lib/providers'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let reaped = 0
  try {
    reaped = await reapStaleRuns(10)
  } catch (reapErr: unknown) {
    console.error('[orchestrator] reaper failed:', reapErr)
    Sentry.captureException(reapErr)
  }

  let dueProviders
  try {
    dueProviders = await getProvidersDueForFetch()
  } catch (err: unknown) {
    console.error('[orchestrator] getProvidersDueForFetch failed:', err)
    Sentry.captureException(err)
    return Response.json(
      { ok: false, error: 'Failed to determine due providers', reaped },
      { status: 500 },
    )
  }

  if (dueProviders.length === 0) {
    return Response.json({ ok: true, dispatched: [], reaped, message: 'No providers due' })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'

  const results = await Promise.allSettled(
    dueProviders.map(async (provider) => {
      const res = await fetch(
        `${siteUrl}/api/ingest/${provider.slug}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.CRON_SECRET}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        }
      )
      // Capture the sub-route's own error message on failure so a
      // total-failure Sentry alert (below) is actionable, not just a bare
      // status code. A body-parse failure must not itself throw here.
      let error: string | undefined
      if (!res.ok) {
        try {
          const body = await res.json()
          if (typeof body?.error === 'string') error = body.error
        } catch {
          // Non-JSON or empty body — status/ok still tell the story
        }
      }
      return {
        slug:   provider.slug,
        status: res.status,
        ok:     res.ok,
        error,
      }
    })
  )

  const dispatched = dueProviders.map(p => p.slug)
  const summary = results.map((r, i) => ({
    slug:   dueProviders[i].slug,
    result: r.status === 'fulfilled'
      ? r.value
      : { ok: false, error: String((r as PromiseRejectedResult).reason) },
  }))

  // Every dispatched provider failing is a signal the dispatch mechanism
  // itself is broken (misconfigured NEXT_PUBLIC_SITE_URL/CRON_SECRET, the
  // deployment down) — not ordinary per-provider noise, which is already
  // tracked by each provider's own consecutive_failures/health_status.
  const failedCount = summary.filter(s => !s.result.ok).length
  if (dueProviders.length > 0 && failedCount === dueProviders.length) {
    Sentry.captureMessage(
      `[orchestrator] All ${dueProviders.length} dispatched providers failed this run`,
      { level: 'error', extra: { summary } }
    )
  }

  console.log(`[orchestrator] Dispatched ${dispatched.length} providers:`, dispatched)

  return Response.json({
    ok:        true,
    dispatched,
    count:     dispatched.length,
    reaped,
    summary,
  })
}
