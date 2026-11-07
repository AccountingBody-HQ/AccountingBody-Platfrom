import * as Sentry from '@sentry/nextjs'
import { filterServerEvent, filterServerSpan, filterServerTransaction } from './lib/sentry-privacy'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Problem reports and timings keep only what is needed to fix a problem.
  beforeSend: filterServerEvent,
  beforeSendTransaction: filterServerTransaction,
  beforeSendSpan: filterServerSpan,
  // Trace headers are added to no outgoing request.
  tracePropagationTargets: [],
})
