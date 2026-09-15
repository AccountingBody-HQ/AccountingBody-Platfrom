import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { getActiveDirectJobs, buildSimilarQuery, type Job } from '@/lib/jobs'
import { buildPhraseQuery, buildAndQuery, pickJobSearchTier } from '@/app/search/jobSearchTiers'

const JOB_PANEL_LIMIT = 5

// Common case (phrase and/or and tier resolves — the vast majority of real
// search terms, per tmp-audit/session16-search-relevance.md Phase 1)
// measured consistently under 1s. The rare full cascade to the OR tier adds
// one more sequential round trip, whose own NORMAL (non-spiking) latency
// measured up to ~2s — so 2500ms leaves headroom for a legitimately sparse
// term to complete its full cascade without being cut off, while still
// bounding the pathological case (search_jobs_ranked has spiked to 9-20s on
// wide OR queries) to well under a tenth of its worst observed time. A
// shorter timeout would show "no jobs" more often on slow-but-working
// cascades; this is chosen to almost never do that for normal traffic while
// still capping the true pathological case hard.
const JOB_QUERY_TIMEOUT_MS = 2500

// A slow or hung job query must never hold up content results — race it
// against a deadline and fall back rather than let /search inherit the
// unexplained keyword-search spikes seen on /api/jobs/direct. This only
// stops the search route from waiting on the underlying Supabase call, not
// the call itself, which has no cancellation hook here.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

interface JobsForSearch {
  jobs: Job[]
  jobsTotal: number
}

const NO_JOBS: JobsForSearch = { jobs: [], jobsTotal: 0 }

// Platform-scoped, fails soft: any error here must never break content
// search. Tries three query tiers, most precise first, each strictly
// broader than the last — see app/search/jobSearchTiers.ts for the full
// reasoning and tmp-audit/session16-search-relevance.md Phase 1 for the
// live measurements this is based on:
//   1. phrase (quoted, adjacency-constrained) — tried first, most precise
//   2. and (bare term, both words present anywhere) — falls back here if
//      phrase is too sparse
//   3. or (every token OR-joined, via buildSimilarQuery) — last resort for
//      genuinely under-covered terms; deliberately NOT run in parallel with
//      the other two, since it's the wide/slow query shape and only needed
//      rarely — paying its cost only when it's actually used beats paying
//      it on every search.
// Whichever tier is used, its own count travels with its own rows — never
// a count from one tier shown beside rows from another.
async function fetchJobsForSearch(rawQuery: string, platform: string): Promise<JobsForSearch> {
  const phraseTerm = buildPhraseQuery(rawQuery)
  const andTerm = buildAndQuery(rawQuery)
  if (!phraseTerm && !andTerm) return NO_JOBS

  try {
    const [phraseJobs, phraseTotal, andJobs, andTotal] = await Promise.all([
      phraseTerm ? getActiveDirectJobs({ platform, search: phraseTerm, limit: JOB_PANEL_LIMIT }) : Promise.resolve([]),
      phraseTerm ? getActiveDirectJobs({ platform, search: phraseTerm, countOnly: true }) : Promise.resolve(0),
      andTerm ? getActiveDirectJobs({ platform, search: andTerm, limit: JOB_PANEL_LIMIT }) : Promise.resolve([]),
      andTerm ? getActiveDirectJobs({ platform, search: andTerm, countOnly: true }) : Promise.resolve(0),
    ])

    const tier = pickJobSearchTier({ phraseTotal, andTotal })
    if (tier === 'phrase') return { jobs: phraseJobs, jobsTotal: phraseTotal }
    if (tier === 'and')    return { jobs: andJobs, jobsTotal: andTotal }

    // tier === 'or': neither phrase nor and cleared the threshold.
    // buildSimilarQuery returns null when every token was noise/stopwords —
    // passing null through would mean "no search filter" to the RPC, which
    // would return arbitrary platform jobs unrelated to the query.
    const orTerm = buildSimilarQuery(rawQuery)
    if (!orTerm) return NO_JOBS
    const [orJobs, orTotal] = await Promise.all([
      getActiveDirectJobs({ platform, search: orTerm, limit: JOB_PANEL_LIMIT }),
      getActiveDirectJobs({ platform, search: orTerm, countOnly: true }),
    ])
    return { jobs: orJobs, jobsTotal: orTotal }
  } catch (err: unknown) {
    console.error('[search] job query failed:', err)
    Sentry.captureException(err)
    return NO_JOBS
  }
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
function checkRateLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + 60_000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

// Strip characters that are special in PostgREST filter syntax.
// Commas delimit .or() expressions; ( ) . % have syntactic meaning.
// Stripping them from word tokens prevents filter string corruption.
function sanitiseWord(w: string): string {
  return w.replace(/[,().%]/g, '').trim()
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 2) {
    return NextResponse.json({ results: [], jobs: [], jobsTotal: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Same platform mechanism as every other server-side read in this app —
  // middleware.ts sets this request header from the host, never a query
  // param or client-supplied value, so it can't be spoofed into showing one
  // brand's jobs on the other's domain.
  const isEthioTax = req.headers.get('x-et-platform') === 'ethiotax'
  const platform = isEthioTax ? 'et' : 'ab'

  // Sanitise the raw query: lowercase, strip PostgREST special chars,
  // split into individual words, deduplicate, drop empty/single-char tokens.
  const rawSearch = q.trim().toLowerCase()
  const words = Array.from(
    new Set(
      rawSearch
        .split(/\s+/)
        .map(sanitiseWord)
        .filter(w => w.length >= 2)
    )
  )

  // If sanitising stripped everything (e.g. query was only punctuation),
  // return empty rather than sending a malformed or unbounded query.
  if (words.length === 0) {
    return NextResponse.json({ results: [], jobs: [], jobsTotal: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Runs alongside the content queries below via the Promise.all further
  // down — started here so it's in flight for the same duration as
  // article/PQ fetching, not after it.
  const jobsPromise = withTimeout(fetchJobsForSearch(rawSearch, platform), JOB_QUERY_TIMEOUT_MS, NO_JOBS)

  // Build article query.
  // Strategy: chain one .or() per word so ALL words must appear somewhere
  // in title OR excerpt. Each chained .or() is ANDed with the others by
  // Supabase/PostgREST. Each word token is already sanitised so no
  // PostgREST-special characters appear inside the ilike pattern.
  // Fetch 100 candidates so relevance re-ranking has a wide pool —
  // ordering by date before ranking would bury older relevant articles.
  const supabase = getSupabase()
  let articleQuery = supabase
    .from('articles')
    .select('id, title, slug, excerpt, category, exam_body, published_at, created_at')
    .eq('status', 'published')

  for (const word of words) {
    articleQuery = articleQuery.or(
      `title.ilike.%${word}%,excerpt.ilike.%${word}%`
    )
  }
  articleQuery = articleQuery.limit(100)

  // Build PQ query — title match only.
  let pqQuery = supabase
    .from('question_sets')
    .select('id, title, slug, excerpt, difficulty, published_at')
    .eq('status', 'published')

  for (const word of words) {
    pqQuery = pqQuery.ilike('title', `%${word}%`)
  }
  pqQuery = pqQuery
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(20)

  const [articleResults, pqResults, jobsResult] = await Promise.all([
    articleQuery,
    pqQuery,
    jobsPromise,
  ])

  // Relevance scoring — multi-tier (higher = more relevant).
  // Uses sanitised words for word-level checks.
  // Uses rawSearch for exact-phrase check — rawSearch has punctuation
  // stripped only of PostgREST specials; the title/excerpt comparison
  // is done on lowercased strings so minor punctuation differences
  // (parentheses already stripped from rawSearch) won't prevent a match.
  const rawSearchSanitised = sanitiseWord(rawSearch.replace(/\s+/g, ' '))

  function scoreText(title: string, excerpt: string): number {
    const t = title.toLowerCase().replace(/[,().%]/g, '')
    const e = (excerpt ?? '').toLowerCase().replace(/[,().%]/g, '')
    const s = rawSearchSanitised
    // Tier 4: sanitised full phrase appears in sanitised title
    if (t.includes(s)) return 4
    // Tier 3: all sanitised words appear in sanitised title
    if (words.every(w => t.includes(w))) return 3
    // Tier 2: sanitised full phrase appears in sanitised excerpt
    if (e.includes(s)) return 2
    // Tier 1: all sanitised words appear in sanitised excerpt
    if (words.every(w => e.includes(w))) return 1
    return 0
  }

  function scorePQ(title: string): number {
    const t = title.toLowerCase().replace(/[,().%]/g, '')
    const s = rawSearchSanitised
    if (t.includes(s)) return 4
    if (words.every(w => t.includes(w))) return 3
    return 1
  }

  const articles = (articleResults.data ?? []).map(a => ({
    _id:         a.id,
    _type:       'article' as const,
    title:       a.title,
    slug:        a.slug,
    excerpt:     a.excerpt,
    category:    a.category,
    examBody:    a.exam_body,
    publishedAt: a.published_at ?? a.created_at,
    _score:      scoreText(a.title ?? '', a.excerpt ?? ''),
  }))

  const pqs = (pqResults.data ?? []).map(p => ({
    _id:         p.id,
    _type:       'practicePost' as const,
    title:       p.title,
    slug:        p.slug,
    excerpt:     p.excerpt,
    publishedAt: p.published_at,
    _score:      scorePQ(p.title ?? ''),
  }))

  // Sort by score descending.
  // Tie-break: articles before PQs (study content takes priority).
  const combined = [...articles, ...pqs]
  combined.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score
    if (a._type !== b._type) return a._type === 'article' ? -1 : 1
    return 0
  })

  // Remove internal scoring field before returning.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const results = combined.map(({ _score, ...r }) => r)

  return NextResponse.json({ results, jobs: jobsResult.jobs, jobsTotal: jobsResult.jobsTotal }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
