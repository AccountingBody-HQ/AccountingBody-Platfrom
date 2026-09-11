import * as Sentry from '@sentry/nextjs'

export async function GET() {
  Sentry.captureException(new Error('Manual server-side Sentry capture test'))
  await Sentry.flush(2000)
  return Response.json({ sent: true })
}
