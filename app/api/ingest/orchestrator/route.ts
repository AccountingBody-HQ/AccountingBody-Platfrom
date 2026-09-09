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
  }

  const dueProviders = await getProvidersDueForFetch()

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
      return {
        slug:   provider.slug,
        status: res.status,
        ok:     res.ok,
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

  console.log(`[orchestrator] Dispatched ${dispatched.length} providers:`, dispatched)

  return Response.json({
    ok:        true,
    dispatched,
    count:     dispatched.length,
    reaped,
    summary,
  })
}
