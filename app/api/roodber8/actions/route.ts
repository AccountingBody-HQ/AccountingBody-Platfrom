/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { reportServerError } from '@/lib/report-error'
import { DELETE_FAILED, errorCode, keepCopyBeforeDelete, snapshotRows } from '@/lib/recycle-bin'

export const runtime = 'nodejs'

function getClient() {
  return getServerSupabase('admin')
}

// POST /api/admin/actions
// body: { action, table, id, payload }
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) {
    return signedOutResponse()
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
      job_seeker_registrations: ['update_status', 'update_notes', 'delete'],
      employer_briefs:          ['update_status', 'update_notes', 'delete'],
    }

    if (!ALLOWED[table] || !ALLOWED[table].includes(action)) {
      return NextResponse.json({ error: 'Action not permitted' }, { status: 403 })
    }

    const supabase = getClient()

    if (action === 'delete') {
      // A copy goes to the recycle bin first; the label never holds a name or e-mail.
      const kept = await keepCopyBeforeDelete(supabase, await snapshotRows(supabase, table, { id: String(id) }), {
        kind: 'form_entry',
        sourceTable: table,
        sourceId: String(id),
        label: () => `${table} entry ${String(id).slice(0, 8)}`,
        notFound: 'Not found. Nothing was deleted.',
      })
      if (!kept.ok) return NextResponse.json({ error: kept.error }, { status: kept.status })
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) {
        console.error('admin/actions delete failed', errorCode(error))
        return NextResponse.json({ error: DELETE_FAILED }, { status: 500 })
      }
      return NextResponse.json({ success: true, binId: kept.binId })
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
    reportServerError('admin record action failed', err, { area: 'admin' })
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
