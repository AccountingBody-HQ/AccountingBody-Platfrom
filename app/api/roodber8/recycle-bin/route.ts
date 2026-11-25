// Admin recycle bin (migrations/0027, lib/recycle-bin.ts).
// GET: the newest 200 items, without their saved copies. Expired copies are
// removed first (best effort).
// POST { action: 'restore', id }: puts one item back in one transaction.

import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import { refreshQuestionCaches } from '@/lib/question-cache'
import { BIN_TABLE, errorCode, purgeExpired, restoreFromBin } from '@/lib/recycle-bin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Every column except payload (the saved copy never leaves the server).
const LIST_COLUMNS = 'id, kind, reason, label, row_count, deleted_at, expires_at, restored_at'

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated(req))) return signedOutResponse()

  const supabase = getServerSupabase('admin')
  await purgeExpired(supabase)

  const { data, error } = await supabase
    .from(BIN_TABLE)
    .select(LIST_COLUMNS)
    .order('deleted_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('recycle-bin list failed', errorCode(error))
    return NextResponse.json({ error: 'Could not read the recycle bin.' }, { status: 500 })
  }
  // Only the listed fields are passed on, whatever the read returned.
  const items = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id:          row.id,
    kind:        row.kind,
    reason:      row.reason,
    label:       row.label,
    row_count:   row.row_count,
    deleted_at:  row.deleted_at,
    expires_at:  row.expires_at,
    restored_at: row.restored_at ?? null,
  }))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) return signedOutResponse()

  const body: unknown = await req.json().catch(() => undefined)
  if (body === undefined) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const { action, id } = (body ?? {}) as { action?: unknown; id?: unknown }
  if (action !== 'restore') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  if (typeof id !== 'string' || !UUID_RE.test(id)) return NextResponse.json({ error: 'A valid item id is required' }, { status: 400 })

  const supabase = getServerSupabase('admin')
  const result = await restoreFromBin(supabase, id)
  if (!result.ok) {
    const status = result.code === 'P0002' ? 404 : result.code === '23505' || result.code === 'P0001' || result.code === '23503' ? 409 : 500
    return NextResponse.json({ error: result.message }, { status })
  }
  // The counts name the tables put back; the sets themselves are not known here.
  if (result.counts.question_sets || result.counts.questions || result.counts.question_cases) refreshQuestionCaches()
  return NextResponse.json({ success: true, counts: result.counts })
}
