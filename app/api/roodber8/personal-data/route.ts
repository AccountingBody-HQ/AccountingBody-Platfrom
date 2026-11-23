// Personal data tool (lib/personal-data.ts): find, export or erase everything
// the database holds about one person, by e-mail address.
// POST only, so the address is never part of a web address (and never in
// access logs). Body: { action: 'find' | 'export' | 'erase', email, confirm? }.
// Every answer carries Cache-Control: no-store. Logs carry counts and short
// codes only.

import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated, signedOutResponse } from '@/lib/admin-auth'
import { getServerSupabase } from '@/lib/supabase-server'
import {
  KEEP_NOTE,
  OUTSIDE_OUR_DATABASE,
  erasePerson,
  findPerson,
  normaliseEmail,
  redactRow,
  type FindResult,
} from '@/lib/personal-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const NO_STORE = { 'Cache-Control': 'no-store' }

const answer = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

type Found = Extract<FindResult, { ok: true }>

function binList(found: Found) {
  return found.bin.map((item) => ({ id: item.id, kind: item.kind, label: item.label, deleted_at: item.deleted_at }))
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated(req))) return signedOutResponse()

  const body: unknown = await req.json().catch(() => undefined)
  if (body === undefined || body === null || typeof body !== 'object') return answer({ error: 'Invalid JSON' }, 400)
  const { action, email: rawEmail, confirm } = body as { action?: unknown; email?: unknown; confirm?: unknown }
  if (action !== 'find' && action !== 'export' && action !== 'erase') return answer({ error: 'Unknown action' }, 400)
  const email = normaliseEmail(rawEmail)
  if (!email) return answer({ error: 'Enter one full e-mail address.' }, 400)

  // An erase needs the address typed again, exactly. Nothing is read or
  // changed without it.
  if (action === 'erase' && normaliseEmail(confirm) !== email) {
    return answer({ error: 'Type the same e-mail address again to confirm. Nothing was erased.' }, 400)
  }

  const supabase = getServerSupabase('admin')
  const found = await findPerson(supabase, email)
  if (!found.ok) {
    const nothing = action === 'erase' ? 'Nothing was erased.' : 'Nothing was shown.'
    return answer({ error: `Could not read ${found.label}. ${nothing}` }, 500)
  }

  if (action === 'find') {
    return answer({
      sources: found.sources.map(({ source, rows }) => ({
        table: source.table,
        label: source.label,
        action: source.action,
        note: source.action === 'keep' ? KEEP_NOTE : null,
        count: rows.length,
        rows: rows.map(redactRow),
      })),
      recycle_bin: binList(found),
      outside_our_database: OUTSIDE_OUR_DATABASE,
    })
  }

  if (action === 'export') {
    const document = {
      generated_at: new Date().toISOString(),
      email,
      sources: Object.fromEntries(found.sources.map(({ source, rows }) => [source.table, rows.map(redactRow)])),
      recycle_bin: found.bin.map((item) => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
        deleted_at: item.deleted_at,
        rows: item.rows.map(({ table, row }) => ({ table, row: redactRow(row) })),
      })),
      outside_our_database: OUTSIDE_OUR_DATABASE,
    }
    const total = found.sources.reduce((n, s) => n + s.rows.length, 0)
    console.info('personal-data: export', 'rows', total, 'bin', found.bin.length)
    return new NextResponse(JSON.stringify(document, null, 2), {
      status: 200,
      headers: {
        ...NO_STORE,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="personal-data-export.json"',
      },
    })
  }

  // Erase: exactly the rows and bin copies just found, by id.
  const result = await erasePerson(supabase, found)
  const total = Object.values(result.deleted).reduce((n, c) => n + c, 0)
  console.info('personal-data: erase', result.ok ? 'complete' : 'stopped', 'rows', total)
  const summary = { deleted: result.deleted, done: result.done, not_done: result.notDone, kept: result.kept }
  if (!result.ok) {
    return answer(
      {
        error: `Erase stopped at ${result.failed?.label ?? 'a table'}. The tables listed as done were erased; the others were not. Run the erase again to finish.`,
        ...summary,
      },
      500,
    )
  }
  return answer({ success: true, ...summary })
}
