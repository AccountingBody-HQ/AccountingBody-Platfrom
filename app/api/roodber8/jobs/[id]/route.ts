import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getJobById, approveJob, rejectJob, expireJob } from '@/lib/jobs'
import { sendJobApprovalEmail, sendJobRejectionEmail } from '@/lib/jobEmails'
import { getServerSupabase } from '@/lib/supabase-server'
import { reportServerError } from '@/lib/report-error'

export const runtime = 'nodejs'

function getSupabase() {
  return getServerSupabase('admin')
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// The short code of a caught value, for log lines.
function shortCode(v: unknown): string {
  const code = isRecord(v) ? v.code : undefined
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? code : 'no-code'
}

type RouteParams = { params: Promise<{ id: string }> }

type JobRead =
  | { ok: true; job: Awaited<ReturnType<typeof getJobById>> }
  | { ok: false; answer: NextResponse }

// Reads the job for a handler. A read problem gives a fixed 500 answer,
// a log line with the short code and one problem report.
async function readJob(id: string): Promise<JobRead> {
  try {
    return { ok: true, job: await getJobById(id) }
  } catch (err: unknown) {
    console.error('admin job read failed', shortCode(err))
    reportServerError('admin job read failed', err, { area: 'admin' })
    return { ok: false, answer: NextResponse.json({ error: 'Job read failed' }, { status: 500 }) }
  }
}

// ── GET (admin) jobs/[id] ── returns job by ID, any status
export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }

  const { id } = await params
  const read = await readJob(id)
  if (!read.ok) return read.answer
  const job = read.job
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({ job })
}

// ── PATCH (admin) jobs/[id] ── body: { action, ...payload }
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }

  const { id } = await params
  const read = await readJob(id)
  if (!read.ok) return read.answer
  const existing = read.job
  if (!existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Bad or empty JSON is treated as no body: the same 400 answer.
  const body: unknown = await req.json().catch(() => null)
  if (!isRecord(body) || typeof body.action !== 'string') {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }
  const { action } = body

  try {
    if (action === 'approve') {
      const adminNotes = typeof body.admin_notes === 'string' ? body.admin_notes : undefined
      const job = await approveJob(id, adminNotes)
      try {
        await sendJobApprovalEmail(job, job.manage_token ?? '')
      } catch (emailErr: unknown) {
        console.error('admin job approval email failed (non-fatal)', shortCode(emailErr))
      }
      return NextResponse.json({ job })
    }

    if (action === 'reject') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
      if (!reason) {
        return NextResponse.json({ error: 'reason is required' }, { status: 400 })
      }
      const job = await rejectJob(id, reason)
      try {
        await sendJobRejectionEmail(job)
      } catch (emailErr: unknown) {
        console.error('admin job rejection email failed (non-fatal)', shortCode(emailErr))
      }
      return NextResponse.json({ job })
    }

    if (action === 'expire') {
      await expireJob(id)
      return NextResponse.json({ success: true })
    }

    if (action === 'update_notes') {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('jobs')
        .update({ admin_notes: typeof body.admin_notes === 'string' ? body.admin_notes : null })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ job: data })
    }

    if (action === 'toggle_featured') {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('jobs')
        .update({ is_featured: !existing.is_featured })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return NextResponse.json({ job: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('admin job update failed', shortCode(err))
    reportServerError('admin job update failed', err, { area: 'admin' })
    return NextResponse.json({ error: 'Job update failed' }, { status: 500 })
  }
}

// ── DELETE (admin) jobs/[id] ── soft delete: sets status='closed'
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
  }

  const { id } = await params
  const read = await readJob(id)
  if (!read.ok) return read.answer
  const existing = read.job
  if (!existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('admin job close failed', shortCode(error))
    return NextResponse.json({ error: 'Job close failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
