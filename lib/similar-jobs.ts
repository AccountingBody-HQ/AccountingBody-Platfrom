import { similarTitleTokens } from '@/lib/jobs'

// Saved "Similar current roles" lists (D51/M16, design D277).
//
// Once a night /api/cron/similar-jobs reads every live job's light columns,
// computes each job's list here, in memory, and saves it to
// public.job_similar; job pages read the saved list by key (getSimilarJobs
// in lib/jobs.ts). Nothing here touches the database, the settings or Next:
// the run takes its database steps as a store, so it can be tested alone.
//
// The rules are the request-time steps this replaces, per site ('ab', 'et')
// the job is on, with one change of matching (method B): a job matches a
// title word when that word is one of its own title words
// (similarTitleTokens, no maximum), not when its search_vector does.
//   - tokens: the viewed job's first 6 title words; if the rules throw, none.
//   - country: the job's location_country when it is not empty, else none.
//   - step 1 (more than one token): jobs with every token, same country (if
//     any), newest published first, the first limit + 1.
//   - step 2: jobs with any token, same country (if any), the 40 newest,
//     re-ranked by shared title words (ties keep newest first).
//   - step 3 (still short, and a country): step 2 worldwide.
//   - Phase C (still short, and a country): jobs whose location_country
//     equals the country with ( ) , removed, newest created first, the
//     first limit + 1.
// Steps 1-3 consider only jobs with a published_at, as before. Every step
// skips the viewed job and jobs already listed, and stops at the limit.
// Newest first means published_at (created_at for Phase C), then
// created_at, then id, all descending: equal times are ordered by the next
// key, where the database's order was arbitrary.

export const SIMILAR_LIST_SIZE = 6
// How many newest any-word matches to re-rank by shared title words.
export const SIMILAR_CANDIDATE_POOL = 40
export const SIMILAR_PLATFORMS = ['ab', 'et'] as const
export type SimilarPlatform = (typeof SIMILAR_PLATFORMS)[number]

// The light columns the nightly run reads for every live job.
export const LIVE_JOB_COLUMNS = 'id,title,location_country,platform,published_at,created_at'

export interface LiveJobRow {
  id: string
  title: string
  location_country: string | null
  platform: string[] | null
  published_at: string | null
  created_at: string
}

export interface SimilarListRow {
  job_id: string
  platform: SimilarPlatform
  similar_ids: string[]
}

// Most shared title words first; ties keep the candidates' order
// (Array.prototype.sort is stable). `tokensOf` gives a candidate's own title
// words.
export function rankByTitleOverlap<T>(candidates: T[], titleTokens: string[], tokensOf: (candidate: T) => readonly string[]): T[] {
  const wanted = new Set(titleTokens)
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      overlap: tokensOf(candidate).filter(token => wanted.has(token)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap || a.index - b.index)
    .map(entry => entry.candidate)
}

function safeTokens(title: string, maxTokens?: number): string[] {
  try {
    return maxTokens === undefined ? similarTitleTokens(title) : similarTitleTokens(title, maxTokens)
  } catch {
    return []
  }
}

function time(value: string | null): number {
  const parsed = value === null ? Number.NaN : Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

interface Prepared {
  row: LiveJobRow
  tokens: string[]
  tokenSet: Set<string>
  published: number
  created: number
}

// Newest first by the given keys, then id; never 0 for two different jobs.
function newestFirst(keys: (job: Prepared) => number[]) {
  return (a: Prepared, b: Prepared): number => {
    const ka = keys(a)
    const kb = keys(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return a.row.id < b.row.id ? 1 : a.row.id > b.row.id ? -1 : 0
  }
}

function pushTo<K>(map: Map<K, number[]>, key: K, value: number) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

// Everything one site needs: jobs in rank order (published only) and, by
// title word, their positions in that order, worldwide and per country; and
// per country every job newest created first (Phase C).
interface SiteIndex {
  ranked: Prepared[]
  world: Map<string, number[]>
  byCountry: Map<string, Map<string, number[]>>
  phaseC: Map<string, Prepared[]>
}

function buildSiteIndex(jobs: Prepared[]): SiteIndex {
  const ranked = jobs.filter(job => job.row.published_at !== null).sort(newestFirst(job => [job.published, job.created]))
  const world = new Map<string, number[]>()
  const byCountry = new Map<string, Map<string, number[]>>()
  ranked.forEach((job, position) => {
    const country = job.row.location_country
    let countryIndex: Map<string, number[]> | undefined
    if (country) {
      countryIndex = byCountry.get(country)
      if (!countryIndex) {
        countryIndex = new Map()
        byCountry.set(country, countryIndex)
      }
    }
    job.tokenSet.forEach(token => {
      pushTo(world, token, position)
      if (countryIndex) pushTo(countryIndex, token, position)
    })
  })
  const phaseC = new Map<string, Prepared[]>()
  for (const job of [...jobs].sort(newestFirst(item => [item.created]))) {
    if (job.row.location_country !== null) {
      const list = phaseC.get(job.row.location_country)
      if (list) list.push(job)
      else phaseC.set(job.row.location_country, [job])
    }
  }
  return { ranked, world, byCountry, phaseC }
}

// The first `count` jobs, in rank order, that have every token.
function allTokenMatches(site: SiteIndex, index: Map<string, number[]> | undefined, tokens: string[], count: number): Prepared[] {
  if (!index) return []
  let shortest: number[] | undefined
  for (const token of tokens) {
    const list = index.get(token)
    if (!list) return []
    if (!shortest || list.length < shortest.length) shortest = list
  }
  const found: Prepared[] = []
  for (const position of shortest ?? []) {
    const job = site.ranked[position]
    if (tokens.every(token => job.tokenSet.has(token))) {
      found.push(job)
      if (found.length >= count) break
    }
  }
  return found
}

// The first `count` jobs, in rank order, that have any token. A job among
// the first `count` of the union is among the first `count` of its own
// token's list, so each list is cut there before merging.
function anyTokenMatches(site: SiteIndex, index: Map<string, number[]> | undefined, tokens: string[], count: number): Prepared[] {
  if (!index) return []
  const positions = new Set<number>()
  for (const token of tokens) {
    const list = index.get(token)
    if (!list) continue
    for (let i = 0; i < list.length && i < count; i++) positions.add(list[i])
  }
  return Array.from(positions)
    .sort((a, b) => a - b)
    .slice(0, count)
    .map(position => site.ranked[position])
}

function listFor(job: Prepared, site: SiteIndex, limit: number): string[] {
  const picked: string[] = []
  const pickedIds = new Set<string>([job.row.id])
  const addRows = (rows: Prepared[]) => {
    for (const row of rows) {
      if (picked.length >= limit) break
      if (pickedIds.has(row.row.id)) continue
      pickedIds.add(row.row.id)
      picked.push(row.row.id)
    }
  }

  const tokens = job.tokens
  const locationCountry = job.row.location_country
  if (tokens.length > 0) {
    const country = locationCountry || null
    const index = country ? site.byCountry.get(country) : site.world
    if (tokens.length > 1) addRows(allTokenMatches(site, index, tokens, limit + 1))
    if (picked.length < limit) {
      addRows(rankByTitleOverlap(anyTokenMatches(site, index, tokens, SIMILAR_CANDIDATE_POOL), tokens, candidate => candidate.tokens))
    }
    if (picked.length < limit && locationCountry) {
      addRows(rankByTitleOverlap(anyTokenMatches(site, site.world, tokens, SIMILAR_CANDIDATE_POOL), tokens, candidate => candidate.tokens))
    }
  }
  if (picked.length < limit && locationCountry) {
    const cleanCountry = locationCountry.replace(/[(),]/g, '')
    addRows((site.phaseC.get(cleanCountry) ?? []).slice(0, limit + 1))
  }
  return picked.slice(0, limit)
}

// Every live job's list, per site it is on. Lists that come out empty are
// left out (the page then shows no section).
export function computeSimilarLists(rows: LiveJobRow[], limit = SIMILAR_LIST_SIZE): SimilarListRow[] {
  const prepared: Prepared[] = rows.map(row => {
    const tokens = safeTokens(row.title)
    return { row, tokens, tokenSet: new Set(tokens), published: time(row.published_at), created: time(row.created_at) }
  })
  const out: SimilarListRow[] = []
  for (const platform of SIMILAR_PLATFORMS) {
    const jobs = prepared.filter(job => Array.isArray(job.row.platform) && job.row.platform.includes(platform))
    if (jobs.length === 0) continue
    const site = buildSiteIndex(jobs)
    for (const job of jobs) {
      const viewed = { ...job, tokens: safeTokens(job.row.title, SIMILAR_LIST_SIZE) }
      const similarIds = listFor(viewed, site, limit)
      if (similarIds.length > 0) out.push({ job_id: job.row.id, platform, similar_ids: similarIds })
    }
  }
  return out
}

// How many (job, site) pairs the rows hold.
export function similarPairCount(rows: LiveJobRow[]): number {
  let pairs = 0
  for (const row of rows) {
    for (const platform of SIMILAR_PLATFORMS) if (Array.isArray(row.platform) && row.platform.includes(platform)) pairs++
  }
  return pairs
}

// ── The nightly run ─────────────────────────────────────────────────────────

export const SIMILAR_REFRESH_PAGE_SIZE = 1000
export const SIMILAR_REFRESH_MAX_PAGES = 40
export const SIMILAR_REFRESH_WRITE_BATCH = 500

// Database steps; each one throws on any problem.
export type SimilarJobsStore = {
  // up to `limit` live jobs (status active, not expired at `nowIso`) in id
  // order, with id greater than `after` when given
  readLivePage: (after: string | null, limit: number, nowIso: string) => Promise<LiveJobRow[]>
  // saves these lists, replacing any saved list for the same (job, site),
  // with computed_at = `computedAt`
  upsertLists: (rows: SimilarListRow[], computedAt: string) => Promise<void>
  // removes saved lists computed before `before` and answers how many
  deleteStale: (before: string) => Promise<number>
}

export type SimilarRefreshStep = 'read' | 'empty' | 'page-limit' | 'compute' | 'write' | 'delete'

export type SimilarRefreshResult =
  | { ok: true; live: number; pairs: number; written: number; deleted: number; ms: number }
  | { ok: false; step: SimilarRefreshStep; error: unknown }

const problem = (code: string) => Object.assign(new Error('similar jobs refresh stopped'), { code })

// Reads every live job, computes every list, saves them all and only then
// removes the lists that were not saved again (jobs no longer live, or whose
// list is now empty). Any problem before the removal ends the run with
// nothing removed, so the lists saved before stay; the page re-checks that
// each listed job is still live.
export async function runSimilarJobsRefresh(store: SimilarJobsStore, clock: () => number): Promise<SimilarRefreshResult> {
  const startedAt = clock()
  const runStart = new Date(startedAt).toISOString()

  const rows: LiveJobRow[] = []
  let complete = false
  let after: string | null = null
  for (let page = 0; page < SIMILAR_REFRESH_MAX_PAGES; page++) {
    let batch: LiveJobRow[]
    try {
      batch = await store.readLivePage(after, SIMILAR_REFRESH_PAGE_SIZE, runStart)
    } catch (error) {
      return { ok: false, step: 'read', error }
    }
    rows.push(...batch)
    if (batch.length < SIMILAR_REFRESH_PAGE_SIZE) {
      complete = true
      break
    }
    after = batch[batch.length - 1].id
  }
  if (!complete) return { ok: false, step: 'page-limit', error: problem('page-limit') }
  if (rows.length === 0) return { ok: false, step: 'empty', error: problem('no-live-jobs') }

  let lists: SimilarListRow[]
  try {
    lists = computeSimilarLists(rows)
  } catch (error) {
    return { ok: false, step: 'compute', error }
  }

  for (let start = 0; start < lists.length; start += SIMILAR_REFRESH_WRITE_BATCH) {
    try {
      await store.upsertLists(lists.slice(start, start + SIMILAR_REFRESH_WRITE_BATCH), runStart)
    } catch (error) {
      return { ok: false, step: 'write', error }
    }
  }

  let deleted: number
  try {
    deleted = await store.deleteStale(runStart)
  } catch (error) {
    return { ok: false, step: 'delete', error }
  }

  return { ok: true, live: rows.length, pairs: similarPairCount(rows), written: lists.length, deleted, ms: clock() - startedAt }
}
