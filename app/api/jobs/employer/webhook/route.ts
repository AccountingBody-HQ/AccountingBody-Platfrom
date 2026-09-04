import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { markJobPaid } from '@/lib/jobs'
import { sendJobConfirmationEmail, sendAdminJobNotificationEmail } from '@/lib/jobEmails'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// Web Crypto (crypto.subtle) — not Node's `crypto` module — matching the
// sha256Hex pattern already used in lib/jobs.ts, but keyed (HMAC) since
// Lemon Squeezy signs the raw body with the webhook signing secret.
async function verifyLemonSqueezySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(rawBody)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return computedSignature === signature
}

function extractCustomData(payload: unknown): { jobId: string | null; manageToken: string | null } {
  if (!isRecord(payload)) return { jobId: null, manageToken: null }
  const meta = payload.meta
  if (!isRecord(meta)) return { jobId: null, manageToken: null }
  const customData = meta.custom_data
  if (!isRecord(customData)) return { jobId: null, manageToken: null }
  const jobId = customData.job_id
  const manageToken = customData.manage_token
  return {
    jobId: typeof jobId === 'string' ? jobId : null,
    manageToken: typeof manageToken === 'string' ? manageToken : null,
  }
}

// CRITICAL: this route must always return 200 once the signature has been
// verified, even if downstream processing (email, DB update) fails —
// returning a non-2xx tells Lemon Squeezy to retry the whole event, which
// would re-run side effects (e.g. duplicate emails) rather than fix
// anything. Only a signature-verification failure returns non-200.
export async function POST(req: NextRequest) {
  const signature = req.headers.get('X-Signature')
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    console.error('jobs/employer/webhook: missing signature or webhook secret')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  const rawBody = await req.text()

  const valid = await verifyLemonSqueezySignature(rawBody, signature, webhookSecret)
  if (!valid) {
    console.error('jobs/employer/webhook: signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const eventName = req.headers.get('X-Event-Name')

  try {
    if (eventName === 'order_created') {
      const payload: unknown = JSON.parse(rawBody)
      if (!isRecord(payload)) return NextResponse.json({ received: true })

      const data = payload.data
      if (!isRecord(data)) return NextResponse.json({ received: true })

      const attributes = data.attributes
      if (!isRecord(attributes) || attributes.status !== 'paid') {
        return NextResponse.json({ received: true })
      }

      const { jobId, manageToken } = extractCustomData(payload)
      if (!jobId) {
        console.error('jobs/employer/webhook: order_created with no job_id in meta.custom_data', data.id)
        return NextResponse.json({ received: true })
      }

      const orderId = String(data.id)
      const amount = typeof attributes.total === 'number' ? attributes.total : 0

      const job = await markJobPaid(jobId, '', orderId, amount)

      // markJobPaid writes the order id into stripe_payment_intent_id (its
      // second reference column); stripe_session_id is repurposed to also
      // carry the LS order id so both provider-reference columns resolve
      // to a traceable order for manual reconciliation.
      try {
        await getSupabase().from('jobs').update({ stripe_session_id: orderId }).eq('id', jobId)
      } catch (traceErr: unknown) {
        console.error('jobs/employer/webhook: failed to record order id on stripe_session_id (non-fatal):', traceErr)
      }

      try {
        await sendJobConfirmationEmail(job, manageToken ?? job.manage_token ?? '')
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

    if (eventName === 'order_refunded') {
      const payload: unknown = JSON.parse(rawBody)
      const { jobId } = extractCustomData(payload)

      if (jobId) {
        const supabase = getSupabase()
        const { data: job, error } = await supabase
          .from('jobs')
          .update({ payment_status: 'refunded', status: 'closed' })
          .eq('id', jobId)
          .select('employer_email, employer_name, title, company_name')
          .single()

        if (error) {
          console.error('jobs/employer/webhook: order_refunded update failed:', error)
        } else if (job) {
          try {
            await getResend().emails.send({
              from: 'Accounting Body <noreply@accountingbody.com>',
              to: job.employer_email,
              subject: 'Your job listing has been refunded',
              html: `<p>Dear ${job.employer_name.split(' ')[0]},</p><p>Your payment for the listing "${job.title}" at ${job.company_name} has been refunded, and the listing has been closed.</p><p>If you believe this is an error, please contact us.</p>`,
            })
          } catch (emailErr: unknown) {
            console.error('jobs/employer/webhook: refund email failed (non-fatal):', emailErr)
          }
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
