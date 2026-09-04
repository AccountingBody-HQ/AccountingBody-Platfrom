import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getJobById, markJobPaid } from '@/lib/jobs'
import { sendJobConfirmationEmail, sendAdminJobNotificationEmail } from '@/lib/jobEmails'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// CRITICAL: this route must always return 200 once the signature has been
// verified, even if downstream processing (email, DB update) fails —
// returning a non-2xx tells Stripe to retry the whole event, which would
// re-run side effects (e.g. duplicate emails) rather than fix anything.
// Only a signature-verification failure returns non-200.
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    console.error('jobs/employer/webhook: missing signature or webhook secret')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('jobs/employer/webhook signature error:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const jobId = session.metadata?.job_id

      if (!jobId) {
        console.error('jobs/employer/webhook: checkout.session.completed with no job_id in metadata', session.id)
        return NextResponse.json({ received: true })
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? ''

      const job = await markJobPaid(jobId, session.id, paymentIntentId, session.amount_total ?? 0)

      try {
        await sendJobConfirmationEmail(job)
      } catch (emailErr: unknown) {
        console.error('jobs/employer/webhook: confirmation email failed (non-fatal):', emailErr)
      }
      try {
        await sendAdminJobNotificationEmail(job)
      } catch (emailErr: unknown) {
        console.error('jobs/employer/webhook: admin notification email failed (non-fatal):', emailErr)
      }

      return NextResponse.json({ received: true })
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session
      const jobId = session.metadata?.job_id

      if (jobId) {
        // Never paid for — confirm it's still unpaid before deleting, so we
        // never delete a job that was somehow paid via another path.
        const job = await getJobById(jobId)
        if (job && job.payment_status === 'unpaid') {
          await getSupabase().from('jobs').delete().eq('id', jobId)
        }
      }

      return NextResponse.json({ received: true })
    }

    // All other events: acknowledge, ignore.
    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    console.error('jobs/employer/webhook processing error:', err)
    // Always 200 here — see comment above the handler.
    return NextResponse.json({ received: true })
  }
}
