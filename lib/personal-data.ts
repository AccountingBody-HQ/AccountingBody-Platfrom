// Personal data tool (UK GDPR access and erasure requests): find, export or
// erase everything the database holds about one person, by e-mail address.
//
// - Server only. Every helper takes the route's own client
//   (getServerSupabase('admin')); none creates one.
// - Covers every site on purpose: a person's request is about all of their
//   data, whichever site they used, so no site filter is applied.
// - Matching is exact and case-insensitive. The database filter is ilike with
//   \ % _ escaped, so the address can never act as a wildcard, and every
//   returned row is checked again here before it is shown, exported or erased.
// - Reads are flat (one table per query, select('*'), paged). Any failed read
//   fails the whole find.
// - Logs carry table names, counts and short error codes only: never the
//   address, never a row, never a database message.
// - Columns ending in _token are working keys, not information about the
//   person; they are replaced with "[removed]" before rows leave the server.
// - Recycle bin copies (lib/recycle-bin.ts) that hold the address are found
//   too, and an erase removes them. An erase never makes a new bin copy.

import type { SupabaseClient } from '@supabase/supabase-js'
import { BIN_TABLE, errorCode } from './recycle-bin'

type Row = Record<string, unknown>

export type PdAction = 'erase' | 'keep'

export type PdSource = {
  table: string
  emailColumns: readonly string[]
  label: string
  action: PdAction
  // Extra equality filters (column → value) applied to every read.
  only?: Readonly<Record<string, string>>
}

export const PD_SOURCES: readonly PdSource[] = [
  { table: 'help_requests', emailColumns: ['email'], label: 'Help requests', action: 'erase' },
  { table: 'contact_submissions', emailColumns: ['email'], label: 'Contact form messages', action: 'erase' },
  { table: 'email_subscribers', emailColumns: ['email'], label: 'E-mail list sign-ups (every site)', action: 'erase' },
  { table: 'firms_applications', emailColumns: ['contact_email'], label: 'Firm and freelancer applications', action: 'erase' },
  { table: 'job_seeker_registrations', emailColumns: ['email'], label: 'Candidate registrations', action: 'erase' },
  { table: 'employer_briefs', emailColumns: ['contact_email'], label: 'Employer briefs', action: 'erase' },
  { table: 'job_applications', emailColumns: ['applicant_email'], label: 'Job applications', action: 'erase' },
  // Job records are kept by rule; only employer-posted jobs hold real
  // contact details (ingested jobs carry placeholders).
  {
    table: 'jobs',
    emailColumns: ['employer_email', 'application_email'],
    label: 'Jobs posted by an employer',
    action: 'keep',
    only: { source: 'employer' },
  },
]

export const KEEP_NOTE =
  'Job records are kept. To remove the contact details, edit the job and replace the e-mail address and phone number.'

// Places outside our database the admin must check by hand.
export const OUTSIDE_OUR_DATABASE: readonly string[] = [
  'Team inbox info@accountingbody.com: delete the notification e-mails about this person.',
  'Resend (e-mail sending service): the sent-message log holds the e-mails sent to this address.',
  'Lemon Squeezy (payments): if they paid for a job post, their order and receipt are held there.',
  'WhatsApp (EthioTax enquiries): delete any chat with this person.',
]

export const EMAIL_MAX = 254
export const PAGE_ROWS = 1000
export const BIN_PAGE_ROWS = 200
const ID_CHUNK = 100

// A sane single address: no spaces, no * (PostgREST treats it as a wildcard
// in like patterns and has no escape for it), no backslash.
const EMAIL_SHAPE = /^[A-Za-z0-9.!#$%&'+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/

// The address as the tool compares it (trimmed, lower case), or null when
// the input is not one sane address.
export function normaliseEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const email = input.trim().toLowerCase()
  if (email.length < 3 || email.length > EMAIL_MAX) return null
  return EMAIL_SHAPE.test(email) ? email : null
}

// The ilike pattern that matches exactly this text: \ % and _ escaped.
export function exactLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export function sameEmail(value: unknown, email: string): boolean {
  return typeof value === 'string' && value.toLowerCase() === email
}

// True when any string anywhere in the value equals the address.
export function containsEmail(value: unknown, email: string, depth = 0): boolean {
  if (depth > 50) return false
  if (typeof value === 'string') return sameEmail(value, email)
  if (Array.isArray(value)) return value.some((item) => containsEmail(item, email, depth + 1))
  if (value && typeof value === 'object') return Object.values(value as Row).some((item) => containsEmail(item, email, depth + 1))
  return false
}

export function redactRow(row: Row): Row {
  const out: Row = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = key.endsWith('_token') && value !== null && value !== undefined ? '[removed]' : value
  }
  return out
}

// ── Find ───────────────────────────────────────────────────────────────────

export type SourceFound = { source: PdSource; rows: Row[] }

export type BinFound = {
  id: string
  kind: string
  label: string
  deleted_at: string | null
  // The saved rows that hold the address (for the export only).
  rows: { table: string; row: Row }[]
}

export type FindResult =
  | { ok: true; sources: SourceFound[]; bin: BinFound[] }
  | { ok: false; label: string; code: string }

type Read<T> = { ok: true; data: T } | { ok: false; code: string }

async function readSource(supabase: SupabaseClient, source: PdSource, email: string): Promise<Read<Row[]>> {
  const byId = new Map<string, Row>()
  const pattern = exactLikePattern(email)
  for (const column of source.emailColumns) {
    for (let from = 0; ; from += PAGE_ROWS) {
      let query = supabase.from(source.table).select('*').ilike(column, pattern)
      for (const [key, value] of Object.entries(source.only ?? {})) query = query.eq(key, value)
      let page: Row[]
      try {
        const { data, error } = await query.order('id', { ascending: true }).range(from, from + PAGE_ROWS - 1)
        if (error) return { ok: false, code: errorCode(error) }
        page = (data as Row[] | null) ?? []
      } catch (error) {
        return { ok: false, code: errorCode(error) }
      }
      for (const row of page) {
        // Checked again here: only an exact match counts.
        if (sameEmail(row[column], email) && Object.entries(source.only ?? {}).every(([k, v]) => row[k] === v)) {
          byId.set(String(row.id), row)
        }
      }
      if (page.length < PAGE_ROWS) break
    }
  }
  return { ok: true, data: Array.from(byId.values()) }
}

async function readBin(supabase: SupabaseClient, email: string): Promise<Read<BinFound[]>> {
  const found: BinFound[] = []
  for (let from = 0; ; from += BIN_PAGE_ROWS) {
    let page: Row[]
    try {
      const { data, error } = await supabase
        .from(BIN_TABLE)
        .select('id, kind, label, deleted_at, payload')
        .order('id', { ascending: true })
        .range(from, from + BIN_PAGE_ROWS - 1)
      if (error) return { ok: false, code: errorCode(error) }
      page = (data as Row[] | null) ?? []
    } catch (error) {
      return { ok: false, code: errorCode(error) }
    }
    for (const item of page) {
      if (!containsEmail(item.payload, email)) continue
      const rows: { table: string; row: Row }[] = []
      const payload = item.payload && typeof item.payload === 'object' ? (item.payload as Record<string, unknown>) : {}
      for (const [table, saved] of Object.entries(payload)) {
        if (!Array.isArray(saved)) continue
        for (const row of saved) {
          if (row && typeof row === 'object' && containsEmail(row, email)) rows.push({ table, row: row as Row })
        }
      }
      found.push({
        id: String(item.id),
        kind: String(item.kind ?? ''),
        label: String(item.label ?? ''),
        deleted_at: typeof item.deleted_at === 'string' ? item.deleted_at : null,
        rows,
      })
    }
    if (page.length < BIN_PAGE_ROWS) break
  }
  return { ok: true, data: found }
}

export async function findPerson(supabase: SupabaseClient, email: string): Promise<FindResult> {
  const sources: SourceFound[] = []
  for (const source of PD_SOURCES) {
    const read = await readSource(supabase, source, email)
    if (!read.ok) {
      console.error('personal-data: read failed', source.table, read.code)
      return { ok: false, label: source.label, code: read.code }
    }
    sources.push({ source, rows: read.data })
  }
  const bin = await readBin(supabase, email)
  if (!bin.ok) {
    console.error('personal-data: read failed', BIN_TABLE, bin.code)
    return { ok: false, label: 'the recycle bin', code: bin.code }
  }
  return { ok: true, sources, bin: bin.data }
}

// ── Erase ──────────────────────────────────────────────────────────────────

export type EraseResult = {
  ok: boolean
  // Rows actually deleted, per table (the recycle bin under BIN_TABLE).
  deleted: Record<string, number>
  done: string[]
  notDone: string[]
  failed: { table: string; label: string; code: string } | null
  kept: { table: string; label: string; count: number; note: string }[]
}

async function deleteIds(supabase: SupabaseClient, table: string, ids: string[]): Promise<{ ok: true; count: number } | { ok: false; count: number; code: string }> {
  let count = 0
  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    const chunk = ids.slice(start, start + ID_CHUNK)
    try {
      const { data, error } = await supabase.from(table).delete().in('id', chunk).select('id')
      if (error) return { ok: false, count, code: errorCode(error) }
      const gone = ((data as Row[] | null) ?? []).length
      count += gone
      if (gone !== chunk.length) return { ok: false, count, code: 'count_mismatch' }
    } catch (error) {
      return { ok: false, count, code: errorCode(error) }
    }
  }
  return { ok: true, count }
}

// Deletes exactly the rows and bin copies in `found` (by id), table by table,
// and stops at the first failure. 'keep' sources are reported, never changed.
export async function erasePerson(supabase: SupabaseClient, found: { sources: SourceFound[]; bin: BinFound[] }): Promise<EraseResult> {
  const steps: { table: string; label: string; ids: string[] }[] = []
  const kept: EraseResult['kept'] = []
  for (const { source, rows } of found.sources) {
    if (source.action === 'keep') {
      if (rows.length > 0) kept.push({ table: source.table, label: source.label, count: rows.length, note: KEEP_NOTE })
      continue
    }
    steps.push({ table: source.table, label: source.label, ids: rows.map((row) => String(row.id)) })
  }
  steps.push({ table: BIN_TABLE, label: 'Recycle bin copies', ids: found.bin.map((item) => item.id) })

  const result: EraseResult = { ok: true, deleted: {}, done: [], notDone: [], failed: null, kept }
  for (const step of steps) {
    if (result.failed) {
      if (step.ids.length > 0) result.notDone.push(step.table)
      continue
    }
    if (step.ids.length === 0) {
      result.deleted[step.table] = 0
      continue
    }
    const removed = await deleteIds(supabase, step.table, step.ids)
    result.deleted[step.table] = removed.count
    if (removed.ok) {
      result.done.push(step.table)
    } else {
      console.error('personal-data: delete failed', step.table, removed.code)
      result.ok = false
      result.failed = { table: step.table, label: step.label, code: removed.code }
      result.notDone.push(step.table)
    }
  }
  return result
}
