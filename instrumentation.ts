import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Server request errors go to Sentry through the same privacy filter
// (beforeSend in sentry.server.config.ts and sentry.edge.config.ts).
export const onRequestError = Sentry.captureRequestError
