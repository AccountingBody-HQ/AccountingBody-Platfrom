/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('admin_token')?.value
  if (!token) return false
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const expectedHash = await sha256Hex(secret)
  return token === expectedHash
}

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// POST /api/admin/actions
// body: { action, table, id, payload }
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { action, table, id, payload } = await req.json()

    if (!action || !table || !id) {
      return NextResponse.json({ error: 'action, table and id are required' }, { status: 400 })
    }

    // Whitelist allowed tables and actions for security
    const ALLOWED: Record<string, string[]> = {
      help_requests:            ['update_status', 'update_notes', 'delete'],
      contact_submissions:      ['update_status', 'update_notes', 'delete'],
      firms_applications:       ['update_status', 'update_notes', 'delete'],
      email_subscribers:        ['update_status', 'delete'],
      job_listings:             ['delete'],
      job_seeker_registrations: ['update_status', 'update_notes', 'delete'],
      employer_briefs:          ['update_status', 'update_notes', 'delete'],
    }

    if (!ALLOWED[table] || !ALLOWED[table].includes(action)) {
      return NextResponse.json({ error: 'Action not permitted' }, { status: 403 })
    }

    const supabase = getClient()

    if (action === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'update_status') {
      if (!payload?.status) {
        return NextResponse.json({ error: 'status is required in payload' }, { status: 400 })
      }

      const update: Record<string, any> = { status: payload.status }

      if (table === 'firms_applications' && (payload.status === 'approved' || payload.status === 'rejected')) {
        update.reviewed_at = new Date().toISOString()
      }
      if (table === 'job_seeker_registrations' && (payload.status === 'active' || payload.status === 'rejected')) {
        update.reviewed_at = payload.reviewed_at ?? new Date().toISOString()
      }

      if (table === 'email_subscribers' && payload.status === 'unsubscribed') {
        update.unsubscribed_at = new Date().toISOString()
      }

      if (table === 'help_requests' && payload.status === 'resolved') {
        update.resolved_at = new Date().toISOString()
      }

      if (table === 'contact_submissions' && payload.status === 'resolved') {
        update.resolved_at = new Date().toISOString()
      }

      const { error } = await supabase.from(table).update(update).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'update_notes') {
      const { error } = await supabase
        .from(table)
        .update({ notes: payload?.notes ?? null })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('admin/actions error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
