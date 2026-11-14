import { NextRequest } from 'next/server'
import { getProvidersDueForFetch, reapStaleRuns, updateProviderHealth, deferProvider } from '@/lib/providers'
import { reportServerError } from '@/lib/report-error'
import { runProviderImport } from '@/lib/ingestion/run-provider-import'
import {
  IMPORTS_PER_TICK,
  pickProvidersForTick,
  summariseImport,
  importLogLine,
  countImports,
  closingLogLine,
} from '@/lib/ingestion/orchestrator-plan'

export const maxDuration = 300

// The short code of a caught value, for log lines. Never throws.
function shortCode(v: unknown): string {
  try {
    const code = typeof v === 'object' && v !== null ? (v as { code?: unknown }).code : undefined
    return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code'
  } catch {
    return 'no-code'
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[orchestrator] not configured')
    return Response.json({ error: 'Not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  let reaped = 0
  let reapedProviderIds: string[] = []
  try {
    const result = await reapStaleRuns(10)
    reaped = result.count
    reapedProviderIds = result.providerIds
  } catch (reapErr: unknown) {
    console.error('[orchestrator] reaper failed:', shortCode(reapErr))
    reportServerError('job import stale run cleanup failed', reapErr, { area: 'ingest' })
  }

  // A timed-out run counts as a failure for its provider (five in a row
  // pause it) and moves the provider aside by its interval, so it does not
  // stay due and block the providers behind it. Done before the due check.
  // Each step is independent; a problem is logged and never stops the tick.
  for (const providerId of Array.from(new Set(reapedProviderIds))) {
    try {
      await updateProviderHealth(providerId, 'failure', {
        errorCode: 'TIMEOUT_REAPED',
        errorMessage: 'Import timed out',
      })
    } catch (healthErr: unknown) {
      console.error('[orchestrator] timed-out provider health update failed:', shortCode(healthErr))
    }
    try {
      await deferProvider(providerId)
    } catch (deferErr: unknown) {
      console.error('[orchestrator] timed-out provider deferral failed:', shortCode(deferErr))
    }
  }

  let dueProviders
  try {
    dueProviders = await getProvidersDueForFetch()
  } catch (err: unknown) {
    console.error('[orchestrator] getProvidersDueForFetch failed:', shortCode(err))
    reportServerError('job import due check failed', err, { area: 'ingest' })
    return Response.json(
      { ok: false, error: 'Failed to determine due providers', reaped },
      { status: 500 },
    )
  }

  if (dueProviders.length === 0) {
    return Response.json({ ok: true, dispatched: [], reaped, message: 'No providers due' })
  }

  // Imports run here, in this function, one call per picked provider. At
  // most IMPORTS_PER_TICK run together; the rest stay due for later ticks.
  const picked = pickProvidersForTick(dueProviders, IMPORTS_PER_TICK)

  const results = await Promise.allSettled(
    picked.map(p => runProviderImport(p.slug, 'cron')),
  )

  // Keep each import's own error text for the summary in this answer.
  // The report below carries a fixed message only.
  // The log lines carry the slug, an outcome word and the status number only.
  const summaries = results.map((r, i) => summariseImport(picked[i].slug, r))
  for (const s of summaries) {
    if (s.outcome === 'failed') console.error(importLogLine(s))
    else console.log(importLogLine(s))
  }

  const dispatched = picked.map(p => p.slug)
  // Same shape as before: { slug, result: { slug, status, ok, error } }.
  const summary = summaries.map(({ slug, status, ok, error }) => ({ slug, result: { slug, status, ok, error } }))
  const counts = countImports(summaries, dueProviders.length)

  // Every picked import failing is a signal something shared is broken
  // (configuration, the database) — not ordinary per-provider noise, which
  // is already tracked by each provider's own consecutive_failures/
  // health_status.
  if (picked.length > 0 && counts.failed === picked.length) {
    console.error('[orchestrator] every import failed')
    reportServerError('job import dispatch failed', new Error('every dispatched import failed'), { area: 'ingest' })
  }

  console.log(closingLogLine(counts))

  return Response.json({
    ok:        true,
    dispatched,
    count:     dispatched.length,
    reaped,
    summary,
    counts,
  })
}
