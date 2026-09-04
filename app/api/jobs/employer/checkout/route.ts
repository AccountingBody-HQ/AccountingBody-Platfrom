import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createJob, type ApplyMethod, type JobInsert } from '@/lib/jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LISTING_PRICE_PENCE = 900 // £9.00 — 60-day listing

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'
}

const REQUIRED_FIELDS: (keyof JobInsert)[] = [
  'title', 'company_name', 'description', 'location_text',
  'employer_email', 'employer_name', 'employer_company',
]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export async function POST(req: NextRequest) {
  let createdJobId: string | null = null

  try {
    const body: unknown = await req.json()
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    for (const field of REQUIRED_FIELDS) {
      const value = body[field]
      if (typeof value !== 'string' || !value.trim()) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const applyMethod = (typeof body.apply_method === 'string' ? body.apply_method : 'external') as ApplyMethod
    if (applyMethod === 'platform') {
      const hasUrl = typeof body.application_url === 'string' && body.application_url.trim().length > 0
      const hasEmail = typeof body.application_email === 'string' && body.application_email.trim().length > 0
      if (!hasUrl && !hasEmail) {
        return NextResponse.json(
          { error: 'application_url or application_email is required for this application method' },
          { status: 400 }
        )
      }
    }

    const isEthioTax = req.headers.get('x-et-platform') === 'ethiotax'

    const jobInsert: JobInsert = {
      title: String(body.title).trim(),
      company_name: String(body.company_name).trim(),
      description: String(body.description).trim(),
      location_text: String(body.location_text).trim(),
      employer_email: String(body.employer_email).trim().toLowerCase(),
      employer_name: String(body.employer_name).trim(),
      employer_company: String(body.employer_company).trim(),
      employer_phone: typeof body.employer_phone === 'string' ? body.employer_phone.trim() || undefined : undefined,
      salary_text: typeof body.salary_text === 'string' ? body.salary_text.trim() || undefined : undefined,
      salary_min: typeof body.salary_min === 'number' ? body.salary_min : undefined,
      salary_max: typeof body.salary_max === 'number' ? body.salary_max : undefined,
      employment_type: typeof body.employment_type === 'string' ? (body.employment_type as JobInsert['employment_type']) : undefined,
      seniority_level: typeof body.seniority_level === 'string' ? (body.seniority_level as JobInsert['seniority_level']) : undefined,
      category: typeof body.category === 'string' ? body.category.trim() || undefined : undefined,
      qualifications_required: Array.isArray(body.qualifications_required) ? body.qualifications_required.filter((v): v is string => typeof v === 'string') : undefined,
      skills_required: Array.isArray(body.skills_required) ? body.skills_required.filter((v): v is string => typeof v === 'string') : undefined,
      location_city: typeof body.location_city === 'string' ? body.location_city.trim() || undefined : undefined,
      location_country: typeof body.location_country === 'string' ? body.location_country.trim() || undefined : undefined,
      location_remote: typeof body.location_remote === 'boolean' ? body.location_remote : undefined,
      apply_method: applyMethod,
      application_url: typeof body.application_url === 'string' ? body.application_url.trim() || undefined : undefined,
      application_email: typeof body.application_email === 'string' ? body.application_email.trim() || undefined : undefined,
      platform: [isEthioTax ? 'et' : 'ab'],
      source: 'employer',
    }

    const job = await createJob(jobInsert)
    createdJobId = job.id

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: LISTING_PRICE_PENCE,
            product_data: {
              name: 'Job Listing — 60 days on AccountingBody',
              description: `${job.title} at ${job.company_name}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        job_id: job.id,
        employer_email: job.employer_email,
      },
      success_url: `${siteUrl()}/jobs/post-a-job/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/jobs/post-a-job?cancelled=true`,
      customer_email: job.employer_email,
    })

    // Record the session on the draft job so the webhook and any manual
    // reconciliation can trace this listing back to its Checkout Session.
    await getSupabase().from('jobs').update({ stripe_session_id: session.id }).eq('id', job.id)

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL')
    }

    return NextResponse.json({ checkoutUrl: session.url })
  } catch (err: unknown) {
    console.error('jobs/employer/checkout error:', err)

    // Clean up the draft job row so a failed checkout doesn't leave an
    // orphaned pending_payment row (and, via the dedup index, block a
    // genuine retry with the same title/company/location).
    if (createdJobId) {
      try {
        await getSupabase().from('jobs').delete().eq('id', createdJobId)
      } catch (cleanupErr: unknown) {
        console.error('jobs/employer/checkout cleanup failed:', cleanupErr)
      }
    }

    // Postgres unique_violation on the dedup_hash partial index — an
    // identical title/company/location listing already exists and hasn't
    // been rejected. Surface this as a clear, actionable message rather
    // than a generic 500.
    if (isRecord(err) && err.code === '23505') {
      return NextResponse.json(
        { error: 'You already have a listing for this role, company and location on file. Please check your email or contact us if you need to make changes.' },
        { status: 409 }
      )
    }

    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.startsWith('Missing required field') ? 400 : 500
    return NextResponse.json({ error: status === 400 ? message : 'Could not start checkout. Please try again.' }, { status })
  }
}
