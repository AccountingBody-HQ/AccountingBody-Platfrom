import * as Sentry from '@sentry/nextjs'
import {
  filterBrowserBreadcrumb,
  filterBrowserEvent,
  filterBrowserSpan,
  filterBrowserTransaction,
} from './lib/sentry-browser-privacy'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Browser problem reports, trail entries and timings keep only what is
  // needed to fix a problem.
  beforeSend: filterBrowserEvent,
  beforeBreadcrumb: filterBrowserBreadcrumb,
  beforeSendTransaction: filterBrowserTransaction,
  beforeSendSpan: filterBrowserSpan,
})
