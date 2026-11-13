import * as Sentry from '@sentry/nextjs'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './lib/sentry-privacy'

// Vercel Cron routes must be sampled at 1.0 — Sentry's cron check-ins are
// span-based and are only emitted for spans that survive trace sampling.
// Everything else is sampled at 0.1 to control quota.
const FULLY_SAMPLED_ROUTES = ['/api/ingest/orchestrator', '/api/cron/expire-jobs']

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampler: (samplingContext) => {
    const url = samplingContext.normalizedRequest?.url
    if (url) {
      try {
        if (FULLY_SAMPLED_ROUTES.includes(new URL(url).pathname)) {
          return 1.0
        }
      } catch {
        // Malformed Host header or similar — fall through to the default rate.
      }
    }
    return 0.1
  },
  // Problem reports and timings keep only what is needed to fix a problem.
  beforeSend: filterServerEvent,
  beforeSendTransaction: filterServerTransaction,
  beforeSendSpan: filterServerSpan,
  // Trace headers are added to no outgoing request.
  tracePropagationTargets: [],
})
