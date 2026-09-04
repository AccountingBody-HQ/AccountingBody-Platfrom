import { NextRequest, NextResponse } from 'next/server'
import { getJobById, approveJob, rejectJob, expireJob } from '@/lib/jobs'
import { sendJobApprovalEmail, sendJobRejectionEmail } from '@/lib/jobEmails'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expected = await sha256Hex(secret)
  return token === expected
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

type RouteParams = { params: Promise<{ id: string }> }

// ── GET /api/roodber8/jobs/[id] ── returns job by ID, any status
export async function GET(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 })
  }

  const { id } = await params
  const job = await getJobById(id)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({ job })
}

// ── PATCH /api/roodber8/jobs/[id] ── body: { action, ...payload }
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getJobById(id)
  if (!existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const body: unknown = await req.json()
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
        console.error('roodber8/jobs approve: email failed (non-fatal):', emailErr)
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
        console.error('roodber8/jobs reject: email failed (non-fatal):', emailErr)
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
    console.error('roodber8/jobs/[id] PATCH error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── DELETE /api/roodber8/jobs/[id] ── soft delete: sets status='closed'
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 })
  }

  const { id } = await params
  const existing = await getJobById(id)
  if (!existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
