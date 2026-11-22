import { visibleAdvertKey } from '@/lib/jobs'

// Extra copies of one advert (D283, board #7 A4-02).
//
// Imports often hold the same advert several times: the same title and
// company from the same provider, usually one recruiter's advert posted in
// several cities. Every row, address and dedup_hash stays as it is; the
// extra copies are marked in jobs.ai_duplicate_of with the id of one
// primary row, and visitor lists can hide the marked rows (the read switch,
// lib/jobs.ts duplicatesHidden). This module only works out the marks, from
// the live rows the nightly similar-jobs run already reads. It touches no
// database, settings or Next.
//
// Rules:
//   - key: slugified title + company (visibleAdvertKey), the provider and
//     the set of sites. No key (never marked, never a primary) for employer
//     rows and rows without a provider, source, company or site.
//   - a group is the live rows with one key; a group of one has no copies.
//   - primary: the row that ends last (expires_at; none = latest, D300), so
//     a marked copy never ends after its primary. Ties on the end: the
//     current primary if it is among them (sticky: the row the current
//     marks of the group point at, if they all point at one row that is in
//     the group and itself unmarked); otherwise the earliest created of them
//     (ties: lowest id).
//   - every other row of a group is marked to its primary; every primary,
//     single row and keyless row ends unmarked. So there are no chains and
//     no row points at itself.
// Rows that are not live are not in the input and are left alone.

export const DUPLICATE_WRITE_BATCH = 100

export interface DuplicateCandidateRow {
  id: string
  title: string
  company_name?: string | null
  provider_id?: string | null
  source?: string | null
  platform: string[] | null
  created_at: string
  ai_duplicate_of?: string | null
  expires_at?: string | null
}

export interface DuplicatePlan {
  // groups with at least two rows
  groups: number
  // [primary id, ids to mark to it], by primary id; ids sorted
  toMark: Array<[string, string[]]>
  // ids whose mark must become empty, sorted
  toClear: string[]
  // rows whose mark is already right
  unchanged: number
  // the mark each given row has once the plan is applied
  finalMark: (id: string) => string | null
}

export function duplicateKey(row: DuplicateCandidateRow): string | null {
  if (!row.provider_id || !row.source || row.source === 'employer') return null
  if (typeof row.title !== 'string' || typeof row.company_name !== 'string') return null
  if (!Array.isArray(row.platform) || row.platform.length === 0) return null
  const sites = Array.from(new Set(row.platform)).sort().join(',')
  return `${visibleAdvertKey(row.title, row.company_name)}|${row.provider_id}|${sites}`
}

// What a visitor sees repeated: title and company only (D283: a similar
// list never shows the viewed job's title and company, or one twice).
export function shownAdvertKey(row: { title: string; company_name?: string | null }): string {
  return visibleAdvertKey(row.title, row.company_name ?? '')
}

function createdTime(row: DuplicateCandidateRow): number {
  const parsed = Date.parse(row.created_at)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function earliestFirst(a: DuplicateCandidateRow, b: DuplicateCandidateRow): number {
  const ta = createdTime(a)
  const tb = createdTime(b)
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// No end date, or one that does not parse, counts as no end (latest).
function endTime(row: DuplicateCandidateRow): number {
  if (typeof row.expires_at !== 'string') return Number.POSITIVE_INFINITY
  const parsed = Date.parse(row.expires_at)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function stickyOf(group: DuplicateCandidateRow[]): DuplicateCandidateRow | null {
  const members = new Map(group.map(row => [row.id, row]))
  const targets = new Set<string>()
  for (const row of group) if (row.ai_duplicate_of) targets.add(row.ai_duplicate_of)
  if (targets.size === 1) {
    const sticky = members.get(Array.from(targets)[0])
    if (sticky && !sticky.ai_duplicate_of) return sticky
  }
  return null
}

function primaryOf(group: DuplicateCandidateRow[]): DuplicateCandidateRow {
  let latest = Number.NEGATIVE_INFINITY
  for (const row of group) latest = Math.max(latest, endTime(row))
  const tied = group.filter(row => endTime(row) === latest)
  const sticky = stickyOf(group)
  if (sticky && tied.includes(sticky)) return sticky
  return [...tied].sort(earliestFirst)[0]
}

export function planDuplicateMarks(rows: DuplicateCandidateRow[]): DuplicatePlan {
  const groups = new Map<string, DuplicateCandidateRow[]>()
  const final = new Map<string, string | null>()
  for (const row of rows) {
    final.set(row.id, null)
    const key = duplicateKey(row)
    if (key === null) continue
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }

  let groupCount = 0
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue
    groupCount++
    const primary = primaryOf(group)
    for (const row of group) if (row.id !== primary.id) final.set(row.id, primary.id)
  }

  const toMarkByPrimary = new Map<string, string[]>()
  const toClear: string[] = []
  let unchanged = 0
  for (const row of rows) {
    const current = row.ai_duplicate_of ?? null
    const wanted = final.get(row.id) ?? null
    if (current === wanted) unchanged++
    else if (wanted === null) toClear.push(row.id)
    else {
      const list = toMarkByPrimary.get(wanted)
      if (list) list.push(row.id)
      else toMarkByPrimary.set(wanted, [row.id])
    }
  }

  const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  const toMark = Array.from(toMarkByPrimary)
    .map(([primary, ids]): [string, string[]] => [primary, [...ids].sort(byText)])
    .sort((a, b) => byText(a[0], b[0]))

  return {
    groups: groupCount,
    toMark,
    toClear: toClear.sort(byText),
    unchanged,
    finalMark: (id: string) => final.get(id) ?? null,
  }
}

// Ids in write batches of at most DUPLICATE_WRITE_BATCH.
export function writeBatches(ids: string[], size = DUPLICATE_WRITE_BATCH): string[][] {
  const out: string[][] = []
  for (let start = 0; start < ids.length; start += size) out.push(ids.slice(start, start + size))
  return out
}
