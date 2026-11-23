import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getServerSupabase } from './supabase-server'
import {
  BIN_FAILED,
  RESTORE_FAILED,
  SNAPSHOT_FAILED,
  binLabel,
  keepCopyBeforeDelete,
  moveToBin,
  purgeExpired,
  restoreFromBin,
  restoreMessage,
  rowCount,
  snapshotCourse,
  snapshotProvider,
  snapshotRows,
} from './recycle-bin'

// lib/recycle-bin.ts with a real supabase-js client from the factory; only
// the network is fake. Every request is recorded as "METHOD table?query".

vi.mock('@sentry/nextjs', () => ({ captureException: () => {}, captureMessage: () => {} }))

const DB_URL = 'https://example.supabase.co'
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const BIN_ID = '1b4e28ba-2fa1-11d2-883f-0016d3cca427'

type Row = Record<string, unknown>
type Call = { method: string; table: string; query: string; body: unknown }
const net = {
  rows: {} as Record<string, Row[] | ((call: Call) => Row[])>,
  fail: (() => null) as (call: Call) => { status: number; code: string } | null,
  rpc: { status: 200, body: {} as unknown },
  calls: [] as Call[],
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const method = (init?.method ?? 'GET').toUpperCase()
  const table = url.pathname.replace('/rest/v1/', '')
  const call: Call = { method, table, query: decodeURIComponent(url.search), body: init?.body ? JSON.parse(String(init.body)) : undefined }
  net.calls.push(call)
  const failure = net.fail(call)
  if (failure) return json({ code: failure.code, message: 'secret detail', details: null, hint: null }, failure.status)
  if (table.startsWith('rpc/')) return json(net.rpc.body, net.rpc.status)
  const headers = new Headers(init?.headers)
  if (method === 'GET') {
    const source = net.rows[table] ?? []
    const rows = typeof source === 'function' ? source(call) : source
    if ((headers.get('accept') ?? '').includes('vnd.pgrst.object')) {
      return rows.length === 1 ? json(rows[0], 200) : json({ code: 'PGRST116', message: 'no rows', details: null, hint: null }, 406)
    }
    return json(rows, 200)
  }
  if (method === 'POST') {
    const written = { id: BIN_ID, ...(call.body as Row) }
    if ((headers.get('accept') ?? '').includes('vnd.pgrst.object')) return json(written, 201)
    return json([written], 201)
  }
  return new Response(null, { status: 204 })
}

const lines = () => net.calls.map((c) => `${c.method} ${c.table}`)
let client: ReturnType<typeof getServerSupabase>

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', DB_URL)
  vi.stubEnv('SUPABASE_SECRET_KEY', 'test-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  Object.assign(net, { rows: {}, fail: () => null, rpc: { status: 200, body: {} }, calls: [] })
  client = getServerSupabase('admin')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('binLabel', () => {
  it('keeps a title, tidied and cut to 300 characters', () => {
    expect(binLabel('course', ID, '  Intro   to  tax ')).toBe('Intro to tax')
    expect(binLabel('article', ID, 'x'.repeat(400))).toHaveLength(300)
  })

  it('falls back to "<kind> <first 8 of id>" and never returns an empty label', () => {
    expect(binLabel('form_entry', ID, '')).toBe('form_entry 0f8fad5b')
    expect(binLabel('question', ID, '   ')).toBe('question 0f8fad5b')
    expect(binLabel('question', null, undefined)).toBe('question')
  })

  it('removes e-mail addresses from any label', () => {
    const label = binLabel('article', ID, 'Write to ada.lovelace+tax@example.co.uk today')
    expect(label).not.toMatch(/@/)
    expect(label).toBe('Write to [e-mail removed] today')
  })
})

describe('moveToBin', () => {
  it('writes one bin row with the copy and its row count, then removes expired copies', async () => {
    const payload = { courses: [{ id: ID }], course_chapters: [{ id: 'c1' }, { id: 'c2' }] }
    const result = await moveToBin(client, { kind: 'course', reason: 'delete', label: 'Tax', sourceTable: 'courses', sourceId: ID, payload })
    expect(result).toEqual({ ok: true, id: BIN_ID })
    expect(lines()).toEqual(['POST admin_recycle_bin', 'DELETE admin_recycle_bin'])
    expect(net.calls[0].body).toEqual({
      kind: 'course',
      reason: 'delete',
      label: 'Tax',
      source_table: 'courses',
      source_id: ID,
      payload,
      row_count: 3,
    })
    expect(net.calls[1].query).toMatch(/^\?expires_at=lt\./)
  })

  it('answers ok: false with the code only when the copy cannot be written, and removes nothing', async () => {
    net.fail = (call) => (call.method === 'POST' ? { status: 404, code: '42P01' } : null)
    const result = await moveToBin(client, { kind: 'article', reason: 'delete', label: 'A', sourceTable: 'articles', sourceId: ID, payload: { articles: [{ id: ID }] } })
    expect(result).toEqual({ ok: false, code: '42P01' })
    expect(lines()).toEqual(['POST admin_recycle_bin'])
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('secret detail')
  })

  it('still succeeds when expired copies cannot be removed', async () => {
    net.fail = (call) => (call.method === 'DELETE' ? { status: 500, code: 'XX000' } : null)
    const result = await moveToBin(client, { kind: 'question', reason: 'delete', label: 'Q', sourceTable: 'questions', sourceId: ID, payload: { questions: [{ id: ID }] } })
    expect(result).toEqual({ ok: true, id: BIN_ID })
  })

  it('purgeExpired never throws', async () => {
    net.fail = () => ({ status: 500, code: 'XX000' })
    await expect(purgeExpired(client)).resolves.toBeUndefined()
  })
})

describe('snapshots', () => {
  const course = { id: ID, title: 'Tax', slug: 'tax' }
  const chapter = { id: 'ch-1', course_id: ID }
  const lesson = { id: 'l-1', chapter_id: 'ch-1', slug: 'tax-ch1-l1', video_url: 'https://v.example/1' }
  const link = { id: 'k-1', lesson_id: 'l-1', article_id: 'a-1' }

  it('copies a whole course, flat, one table per read', async () => {
    net.rows = { courses: [course], course_chapters: [chapter], course_lessons: [lesson], course_lesson_articles: [link] }
    const snap = await snapshotCourse(client, ID)
    expect(snap).toEqual({
      ok: true,
      found: true,
      row: course,
      payload: { courses: [course], course_chapters: [chapter], course_lessons: [lesson], course_lesson_articles: [link] },
    })
    expect(lines()).toEqual(['GET courses', 'GET course_chapters', 'GET course_lessons', 'GET course_lesson_articles'])
    for (const call of net.calls) expect(call.query).toMatch(/^\?select=\*&/)
  })

  it.each(['courses', 'course_chapters', 'course_lessons', 'course_lesson_articles'])('fails when the %s read fails', async (table) => {
    net.rows = { courses: [course], course_chapters: [chapter], course_lessons: [lesson], course_lesson_articles: [link] }
    net.fail = (call) => (call.table === table ? { status: 500, code: '57014' } : null)
    expect(await snapshotCourse(client, ID)).toEqual({ ok: false })
  })

  it('says "not found" when the course is not there', async () => {
    expect(await snapshotCourse(client, ID)).toEqual({ ok: true, found: false })
  })

  it('reads long lists in pages of 1000 rows so none is missed', async () => {
    const runs = Array.from({ length: 1500 }, (_, i) => ({ id: `r-${String(i).padStart(4, '0')}`, provider_id: ID }))
    net.rows = {
      job_providers: [{ id: ID, slug: 'example', name: 'Example' }],
      provider_runs: (call) => {
        const range = /offset=(\d+)/.exec(call.query)
        const offset = range ? Number(range[1]) : 0
        return runs.slice(offset, offset + 1000)
      },
    }
    const snap = await snapshotProvider(client, 'example')
    expect(snap.ok && snap.found && snap.payload.provider_runs).toHaveLength(1500)
    expect(lines()).toEqual(['GET job_providers', 'GET provider_runs', 'GET provider_runs'])
  })

  it('copies the rows that match every filter', async () => {
    net.rows = { course_lesson_articles: [link] }
    const snap = await snapshotRows(client, 'course_lesson_articles', { lesson_id: 'l-1', article_id: 'a-1' })
    expect(snap).toEqual({ ok: true, found: true, row: link, payload: { course_lesson_articles: [link] } })
    expect(net.calls[0].query).toContain('lesson_id=in.(l-1)')
    expect(net.calls[0].query).toContain('article_id=eq.a-1')
  })
})

describe('keepCopyBeforeDelete', () => {
  const meta = { kind: 'article' as const, sourceTable: 'articles', sourceId: ID, label: (row: Row) => row.title, notFound: 'Article not found' }

  it('keeps the copy and gives its id', async () => {
    const result = await keepCopyBeforeDelete(client, { ok: true, found: true, row: { id: ID, title: 'A' }, payload: { articles: [{ id: ID }] } }, meta)
    expect(result).toMatchObject({ ok: true, binId: BIN_ID })
  })

  it('refuses when the snapshot failed, the item is missing, or the copy was not kept', async () => {
    expect(await keepCopyBeforeDelete(client, { ok: false }, meta)).toEqual({ ok: false, status: 500, error: SNAPSHOT_FAILED })
    expect(await keepCopyBeforeDelete(client, { ok: true, found: false }, meta)).toEqual({ ok: false, status: 404, error: 'Article not found' })
    net.fail = () => ({ status: 500, code: 'XX000' })
    expect(await keepCopyBeforeDelete(client, { ok: true, found: true, row: { id: ID }, payload: { articles: [{ id: ID }] } }, meta)).toEqual({
      ok: false,
      status: 500,
      error: BIN_FAILED,
    })
  })
})

describe('restoreFromBin', () => {
  it('calls the restore function once and gives the counts', async () => {
    net.rpc = { status: 200, body: { courses: 1, course_lessons: 3 } }
    expect(await restoreFromBin(client, ID)).toEqual({ ok: true, counts: { courses: 1, course_lessons: 3 } })
    expect(lines()).toEqual(['POST rpc/admin_recycle_restore'])
    expect(net.calls[0].body).toEqual({ p_id: ID })
  })

  it.each([
    ['23505', 'Cannot restore: an item with the same address or id already exists. Rename or delete that item first.'],
    ['P0001', restoreMessage('P0001')],
    ['P0002', restoreMessage('P0002')],
    ['23503', restoreMessage('23503')],
    ['XX000', RESTORE_FAILED],
  ])('maps %s to a plain sentence, never the database text', async (code, message) => {
    net.fail = () => ({ status: 400, code })
    const result = await restoreFromBin(client, ID)
    expect(result).toEqual({ ok: false, code, message })
    expect(JSON.stringify(result)).not.toContain('secret detail')
  })

  it('has distinct plain messages', () => {
    expect(restoreMessage('P0001')).toMatch(/already been restored/)
    expect(restoreMessage('P0002')).toMatch(/no longer in the recycle bin/)
    expect(restoreMessage('anything')).toBe('Restore failed. Nothing was changed.')
  })
})

describe('rowCount', () => {
  it('adds up every list', () => {
    expect(rowCount({ a: [1, 2], b: [], c: [3] })).toBe(3)
  })
})
