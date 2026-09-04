import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createJob, type ApplyMethod, type Job, type JobInsert } from '@/lib/jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://accountingbody.com'
}

const REQUIRED_FIELDS: (keyof JobInsert)[] = [
  'title', 'company_name', 'description', 'location_text',
  'employer_email', 'employer_name', 'employer_company',
]

// Countries billed in USD — everything else (UK + Europe by default) is GBP.
const USD_COUNTRIES = new Set([
  'United States', 'US', 'Canada', 'CA', 'Australia', 'AU', 'New Zealand', 'NZ',
  'Singapore', 'SG', 'Hong Kong', 'HK', 'UAE', 'AE', 'South Africa', 'ZA',
  'Nigeria', 'NG', 'Kenya', 'KE', 'Ethiopia', 'ET', 'Ghana', 'GH',
])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

interface LemonSqueezyCheckoutResponse {
  data?: { attributes?: { url?: string } }
}

async function createLemonSqueezyCheckout(
  job: Job,
  variantId: string,
  apiKey: string,
  storeId: string
): Promise<string> {
  const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: job.employer_email,
            name: job.employer_name,
            custom: {
              job_id: job.id,
              employer_email: job.employer_email,
              job_title: job.title,
              company_name: job.company_name,
            },
          },
          checkout_options: {
            embed: false,
            media: false,
            logo: true,
          },
          product_options: {
            name: 'Job Listing — 60 Days on AccountingBody',
            description: 'Your job will be reviewed and published within 24 hours. Includes Hiring Direct badge and top placement above aggregated results.',
            redirect_url: `${siteUrl()}/jobs/post-a-job/success`,
            receipt_thank_you_note: 'Thank you for posting with AccountingBody. Your listing is under review and will go live within 24 hours.',
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Lemon Squeezy checkout creation failed (${res.status}): ${errText}`)
  }

  const json = (await res.json()) as LemonSqueezyCheckoutResponse
  const url = json.data?.attributes?.url
  if (!url) {
    throw new Error('Lemon Squeezy did not return a checkout URL')
  }
  return url
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

    // Fail fast on missing config, before creating a draft job, so a
    // misconfigured deploy never leaves an orphaned pending_payment row.
    const apiKey = process.env.LEMONSQUEEZY_API_KEY
    const storeId = process.env.LEMONSQUEEZY_STORE_ID
    const variantIdGbp = process.env.LEMONSQUEEZY_VARIANT_ID_GBP
    const variantIdUsd = process.env.LEMONSQUEEZY_VARIANT_ID_USD
    if (!apiKey || !storeId || !variantIdGbp || !variantIdUsd) {
      console.error('jobs/employer/checkout: Lemon Squeezy env vars not configured')
      return NextResponse.json({ error: 'Payment provider not configured' }, { status: 500 })
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

    const useUsd = job.location_country ? USD_COUNTRIES.has(job.location_country) : false
    const variantId = useUsd ? variantIdUsd : variantIdGbp

    const checkoutUrl = await createLemonSqueezyCheckout(job, variantId, apiKey, storeId)

    return NextResponse.json({ checkoutUrl })
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
        { error: 'A listing for this role and company already exists.' },
        { status: 409 }
      )
    }

    const message = err instanceof Error ? err.message : 'Internal server error'
    const status = message.startsWith('Missing required field') ? 400 : 500
    return NextResponse.json({ error: status === 400 ? message : 'Could not start checkout. Please try again.' }, { status })
  }
}
