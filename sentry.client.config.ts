import * as Sentry from '@sentry/nextjs'
import {
  filterBrowserBreadcrumb,
  filterBrowserEvent,
  filterBrowserSpan,
  filterBrowserTransaction,
  limitEvents,
} from './lib/sentry-browser-privacy'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Page-load and navigation timings as before; interaction timing is not
  // recorded.
  integrations: [Sentry.browserTracingIntegration({ enableInp: false })],
  // Browser problem reports, trail entries and timings keep only what is
  // needed to fix a problem. At most 10 problem reports are sent per page load.
  beforeSend: limitEvents(filterBrowserEvent, 10),
  beforeBreadcrumb: filterBrowserBreadcrumb,
  beforeSendTransaction: filterBrowserTransaction,
  beforeSendSpan: filterBrowserSpan,
})
