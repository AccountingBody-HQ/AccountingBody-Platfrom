/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

// POST /api/admin/actions
// body: { action, table, id, payload }
export async function POST(req: NextRequest) {
  try {
    const { action, table, id, payload } = await req.json()

    if (!action || !table || !id) {
      return NextResponse.json({ error: 'action, table and id are required' }, { status: 400 })
    }

    // Whitelist allowed tables and actions for security
    const ALLOWED: Record<string, string[]> = {
      help_requests:      ['update_status', 'delete'],
      contact_submissions:['update_status', 'delete'],
      firms_applications: ['update_status', 'delete'],
      email_subscribers:  ['update_status', 'delete'],
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
      if (table === 'firms_applications' && payload.status === 'approved') {
        update.reviewed_at = new Date().toISOString()
      }
      if (table === 'email_subscribers' && payload.status === 'unsubscribed') {
        update.unsubscribed_at = new Date().toISOString()
      }
      const { error } = await supabase.from(table).update(update).eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (err: any) {
    console.error('admin/actions error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal server error' }, { status: 500 })
  }
}
