// Daily personal-data clean-up (owner decisions D353, D356; PRIV-5).
//
// Each rule names one table and when a row is past its approved keeping
// period. The privacy policy (app/privacy-policy/page.tsx, section 7) says
// how long each kind of data is kept; these rules apply it.
//
// - R1 contact_submissions: last contact older than 24 calendar months
// - R2 help_requests: last contact older than 24 calendar months
//   (for R1 and R2, "last contact" is the latest of created_at, updated_at
//   and resolved_at; empty dates are ignored)
// - R3 email_subscribers: status 'unsubscribed' and unsubscribed_at older
//   than 30 days (updated_at when unsubscribed_at is empty)
// - R4 firms_applications: status 'rejected' and reviewed_at older than 6
//   calendar months (updated_at when reviewed_at is empty)
// - R5 job_seeker_registrations: COUNT ONLY, never deleted here. The table
//   has no "last updated" date, so the count uses the latest of created_at,
//   verified_at and reviewed_at as a stand-in.
// - R6 admin_recycle_bin: expires_at in the past (the bin's own rule,
//   lib/recycle-bin.ts purgeExpired, now also run daily)
//
// Not here: pending newsletter sign-ups and saved jobs (their own crons),
// unverified candidates and unconfirmed employer briefs (database jobs), and
// anything without an owner decision.
//
// The switch (RETENTION_DELETE) is read by the cron route:
// - "on": deletes rows that are due (R5 still only counts)
// - anything else, or unset: counts only, deleting nothing
//
// Months are calendar months in UTC: 24 months back from 31 March is 31 March
// two years earlier; from 29 February it is 28 February.
//
// Deleting: each batch reads up to BATCH_SIZE ids with the rule's filter and
// deletes them PART_SIZE at a time; the delete repeats the whole filter, so a
// row that changed in between is kept. At most MAX_BATCHES batches per rule,
// and no new rule or batch once TIME_BUDGET_MS have passed since the run
// began. Nothing is retried; the first problem ends that rule. Deleted rows
// are never copied to the recycle bin.
//
// Logs: one line per rule with its name, mode and counts, and an error code
// when something failed. Never a row, an address or a database message.

import type { SupabaseClient } from '@supabase/supabase-js'
import { BIN_TABLE, errorCode, purgeExpired } from './recycle-bin'

export const BATCH_SIZE = 500
export const PART_SIZE = 100
export const MAX_BATCHES = 10
export const TIME_BUDGET_MS = 40_000

const DAY_MS = 24 * 60 * 60 * 1000

export type RetentionRuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6'
export type DataRetentionMode = 'count' | 'on'

type Period = { months: number } | { days: number } | { expired: true }

// How a row's date is compared with the cut-off (all strictly before it):
// - before: column < cut-off
// - before-or-fallback: column < cut-off, or column empty and fallback < cut-off
// - latest-before: the first column < cut-off, and each other column empty
//   or < cut-off (the latest of them is before the cut-off)
type DateTest =
  | { kind: 'before'; column: string }
  | { kind: 'before-or-fallback'; column: string; fallback: string }
  | { kind: 'latest-before'; columns: readonly [string, ...string[]] }

export type RetentionRule = {
  id: RetentionRuleId
  table: string
  status?: string
  date: DateTest
  period: Period
  deletes: boolean
}

// R1 and R2: the dates that count as contact with the person.
const LAST_CONTACT_COLUMNS = ['created_at', 'updated_at', 'resolved_at'] as const

export const RETENTION_RULES: readonly RetentionRule[] = [
  {
    id: 'R1',
    table: 'contact_submissions',
    date: { kind: 'latest-before', columns: LAST_CONTACT_COLUMNS },
    period: { months: 24 },
    deletes: true,
  },
  {
    id: 'R2',
    table: 'help_requests',
    date: { kind: 'latest-before', columns: LAST_CONTACT_COLUMNS },
    period: { months: 24 },
    deletes: true,
  },
  {
    id: 'R3',
    table: 'email_subscribers',
    status: 'unsubscribed',
    date: { kind: 'before-or-fallback', column: 'unsubscribed_at', fallback: 'updated_at' },
    period: { days: 30 },
    deletes: true,
  },
  {
    id: 'R4',
    table: 'firms_applications',
    status: 'rejected',
    date: { kind: 'before-or-fallback', column: 'reviewed_at', fallback: 'updated_at' },
    period: { months: 6 },
    deletes: true,
  },
  {
    id: 'R5',
    table: 'job_seeker_registrations',
    date: { kind: 'latest-before', columns: ['created_at', 'verified_at', 'reviewed_at'] },
    period: { months: 24 },
    deletes: false,
  },
  { id: 'R6', table: BIN_TABLE, date: { kind: 'before', column: 'expires_at' }, period: { expired: true }, deletes: true },
]

export function dataRetentionMode(value: string | undefined): DataRetentionMode {
  return value === 'on' ? 'on' : 'count'
}

// The same moment `months` calendar months earlier (UTC); a day the target
// month does not have becomes its last day.
export function monthsBefore(now: Date, months: number): Date {
  const target = new Date(now.getTime())
  target.setUTCDate(1)
  target.setUTCMonth(target.getUTCMonth() - months)
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(now.getUTCDate(), lastDay))
  return target
}

export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS)
}

// The rule's cut-off as an ISO string; a row dated strictly before it is due.
export function ruleCutoff(rule: RetentionRule, now: Date): string {
  const p = rule.period
  if ('months' in p) return monthsBefore(now, p.months).toISOString()
  if ('days' in p) return daysBefore(now, p.days).toISOString()
  return now.toISOString()
}

const quoted = (value: string) => `"${value}"`

// The rule's date test as one PostgREST or=(…) filter, or null when a plain
// lt() is enough.
export function dateOrFilter(rule: RetentionRule, cutoff: string): string | null {
  const d = rule.date
  if (d.kind === 'before') return null
  if (d.kind === 'before-or-fallback') {
    return `${d.column}.lt.${quoted(cutoff)},and(${d.column}.is.null,${d.fallback}.lt.${quoted(cutoff)})`
  }
  const [first, ...rest] = d.columns
  const others = rest.map((c) => `or(${c}.is.null,${c}.lt.${quoted(cutoff)})`)
  return `and(${[`${first}.lt.${quoted(cutoff)}`, ...others].join(',')})`
}

// The filter methods the rules use (supabase-js query builders have them;
// each returns the same builder).
type RuleFilterable = {
  eq(column: string, value: string): RuleFilterable
  lt(column: string, value: string): RuleFilterable
  or(filters: string): RuleFilterable
}

// Adds the rule's whole filter (status and date) to a supabase-js query and
// returns the same query. The counter, the deleter and the /api/ops-status
// alarm all use this, so they look at exactly the same rows. (Typed loosely:
// supabase-js's builder types are too deep for a generic constraint.)
export function applyRuleFilter<Q>(query: Q, rule: RetentionRule, cutoff: string): Q {
  let q = query as unknown as RuleFilterable
  if (rule.status) q = q.eq('status', rule.status)
  const orFilter = dateOrFilter(rule, cutoff)
  if (orFilter) q = q.or(orFilter)
  else if (rule.date.kind === 'before') q = q.lt(rule.date.column, cutoff)
  return q as unknown as Q
}

export type RuleResult = { due: number | null; deleted: number; error?: string }
export type DataRetentionResult = { mode: DataRetentionMode; rules: Record<RetentionRuleId, RuleResult> }

class RuleStop extends Error {
  constructor(readonly code: string) {
    super('rule stopped')
  }
}

async function countDue(supabase: SupabaseClient, rule: RetentionRule, cutoff: string): Promise<number> {
  const { count, error } = await applyRuleFilter(supabase.from(rule.table).select('id', { count: 'exact', head: true }), rule, cutoff)
  if (error) throw new RuleStop(errorCode(error))
  if (typeof count !== 'number') throw new RuleStop('no_count')
  return count
}

async function deleteDue(
  supabase: SupabaseClient,
  rule: RetentionRule,
  cutoff: string,
  overBudget: () => boolean,
  progress: { deleted: number },
): Promise<void> {
  let after: string | null = null
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    if (overBudget()) throw new RuleStop('time_budget')
    let read = applyRuleFilter(supabase.from(rule.table).select('id'), rule, cutoff)
    if (after !== null) read = read.gt('id', after)
    const { data, error } = await read.order('id', { ascending: true }).limit(BATCH_SIZE)
    if (error) throw new RuleStop(errorCode(error))
    const ids = (data ?? []).map((row: { id: unknown }) => String(row.id))
    for (let start = 0; start < ids.length; start += PART_SIZE) {
      const part = ids.slice(start, start + PART_SIZE)
      const removed = await applyRuleFilter(supabase.from(rule.table).delete({ count: 'exact' }).in('id', part), rule, cutoff)
      if (removed.error) throw new RuleStop(errorCode(removed.error))
      progress.deleted += removed.count ?? 0
    }
    if (ids.length < BATCH_SIZE) return
    after = ids[ids.length - 1]
  }
}

function logRule(id: RetentionRuleId, mode: DataRetentionMode, result: RuleResult): void {
  const line = `data retention|${id}|${mode}|due:${result.due ?? '-'}|deleted:${result.deleted}`
  if (result.error) console.error(`${line}|error:${result.error}`)
  else console.log(line)
}

export async function runDataRetention({
  supabase,
  now,
  mode,
  clock = () => Date.now(),
  startedAt = clock(),
}: {
  supabase: SupabaseClient
  now: Date
  mode: DataRetentionMode
  clock?: () => number
  // The run's start for the time budget; the cron passes its own start, so
  // the budget covers the whole route.
  startedAt?: number
}): Promise<DataRetentionResult> {
  const overBudget = () => clock() - startedAt >= TIME_BUDGET_MS
  const rules = {} as Record<RetentionRuleId, RuleResult>
  for (const rule of RETENTION_RULES) {
    const cutoff = ruleCutoff(rule, now)
    const result: RuleResult = { due: null, deleted: 0 }
    try {
      if (overBudget()) throw new RuleStop('time_budget')
      result.due = await countDue(supabase, rule, cutoff)
      if (mode === 'on' && rule.deletes && result.due > 0) {
        if (rule.table === BIN_TABLE) {
          // The bin's own clean-up (never throws); deleted = due before − due after.
          await purgeExpired(supabase, now)
          result.deleted = Math.max(0, result.due - (await countDue(supabase, rule, cutoff)))
        } else {
          const progress = { deleted: 0 }
          try {
            await deleteDue(supabase, rule, cutoff, overBudget, progress)
          } finally {
            result.deleted = progress.deleted
          }
        }
      }
    } catch (error) {
      result.error = error instanceof RuleStop ? error.code : errorCode(error)
    }
    rules[rule.id] = result
    logRule(rule.id, mode, result)
  }
  return { mode, rules }
}
