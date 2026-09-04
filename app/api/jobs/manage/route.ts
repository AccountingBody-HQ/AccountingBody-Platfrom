import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getJobByManageToken, closeJobByManageToken, type Job, type JobStatus } from '@/lib/jobs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY)
}

// Fields the employer-facing manage page has no business seeing — internal
// admin/reconciliation/ranking data. Everything else on the row is safe to
// return as-is (it's all data the employer themselves submitted).
const INTERNAL_FIELDS = [
  'admin_notes',
  'stripe_payment_intent_id',
  'stripe_session_id',
  'dedup_hash',
  'search_vector',
  'raw_source_data',
] as const

function toPublicJob(job: Job): Record<string, unknown> {
  const publicJob: Record<string, unknown> = { ...job }
  for (const field of INTERNAL_FIELDS) {
    delete publicJob[field]
  }
  for (const key of Object.keys(publicJob)) {
    if (key.startsWith('ai_')) delete publicJob[key]
  }
  return publicJob
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token || !token.trim()) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  try {
    const job = await getJobByManageToken(token.trim())
    if (!job) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    return NextResponse.json({ job: toPublicJob(job) })
  } catch (err: unknown) {
    console.error('jobs/manage GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// No auth beyond the token itself — manage_token IS the authentication,
// same trust model as /api/recruitment/update-employer.
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    if (!isRecord(body) || typeof body.token !== 'string' || !body.token.trim()) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }
    if (body.action !== 'close') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const TERMINAL_STATUSES: JobStatus[] = ['closed', 'expired', 'rejected']

    const existing = await getJobByManageToken(body.token.trim())
    if (!existing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    const wasAlreadyClosed = TERMINAL_STATUSES.includes(existing.status)

    const job = await closeJobByManageToken(body.token.trim())
    if (!job) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (wasAlreadyClosed) {
      return NextResponse.json({ message: 'Listing already closed', job: toPublicJob(job) })
    }

    try {
      await getResend().emails.send({
        from: 'Accounting Body <noreply@accountingbody.com>',
        to: job.employer_email,
        subject: 'Your job listing has been withdrawn — AccountingBody',
        html: `<p>Your listing for ${job.title} at ${job.company_name} has been withdrawn from AccountingBody.</p><p>If this was a mistake, please contact us at info@accountingbody.com.</p>`,
      })
    } catch (emailErr: unknown) {
      console.error('jobs/manage POST: withdrawal email failed (non-fatal):', emailErr)
    }

    return NextResponse.json({ success: true, job: toPublicJob(job) })
  } catch (err: unknown) {
    console.error('jobs/manage POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
