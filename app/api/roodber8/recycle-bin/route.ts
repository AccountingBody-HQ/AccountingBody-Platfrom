// Admin recycle bin (migrations/0027, lib/recycle-bin.ts).
// GET: the newest 200 items, without their saved copies. Expired copies are
// removed first (best effort).
// POST { action: 'restore', id }: puts one item back in one transaction.

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { checkRead } from '@/lib/db-check'
import { getServerSupabase } from '@/lib/supabase-server'
import { settleRestoredSet } from '@/lib/question-article-link'
import { refreshQuestionCaches } from '@/lib/question-cache'
import { RESTORE_ARTICLE_TAKEN } from '@/lib/question-publish-checks'
import { BIN_TABLE, errorCode, purgeExpired, restoreFromBin, type BinPayload } from '@/lib/recycle-bin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Every column except payload (the saved copy never leaves the server).
const LIST_COLUMNS = 'id, kind, reason, label, row_count, deleted_at, expires_at, restored_at'

// After a refused restore: whether the item is a practice set whose article
// has another set by now (one set per article, migrations/0029). False when
// that cannot be read, so the general sentence is answered.
async function articleHasAnotherSet(supabase: SupabaseClient, binId: string): Promise<boolean> {
  const item = checkRead(
    await supabase.from(BIN_TABLE).select('kind, payload').eq('id', binId).maybeSingle(),
    'recycle bin: refused item',
  )
  if (!item.ok || item.data?.kind !== 'question_set') return false
  const saved = (item.data.payload as BinPayload | null)?.question_sets?.[0] as { id?: string; article_slug?: string | null } | undefined
  if (!saved?.article_slug) return false
  const sets = checkRead(
    await supabase.from('question_sets').select('id').eq('article_slug', saved.article_slug).limit(2),
    'recycle bin: set of the article',
  )
  return sets.ok && Boolean(sets.data?.some((set) => set.id !== saved.id))
}

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
    const taken = result.code === '23505' && (await articleHasAnotherSet(supabase, id))
    return NextResponse.json({ error: taken ? RESTORE_ARTICLE_TAKEN : result.message }, { status })
  }
  // The counts name the tables put back. A published set must be complete, or
  // it becomes a draft; its article's link follows.
  const restored = result.counts.question_sets ? 'set' : result.counts.questions ? 'question' : null
  const settled = restored ? await settleRestoredSet(supabase, id, restored) : null
  if (settled?.set) {
    refreshQuestionCaches({ slugs: [settled.set.slug], setIds: [settled.set.id], articleSlugs: [settled.set.article_slug] })
  } else if (restored || result.counts.question_cases) {
    refreshQuestionCaches()
  }
  return NextResponse.json({ success: true, counts: result.counts, ...settled?.notes })
}
