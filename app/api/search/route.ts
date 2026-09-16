import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { getActiveDirectJobs, buildSimilarQuery, type Job } from '@/lib/jobs'
import { buildPhraseQuery, buildAndQuery, pickJobSearchTier } from '@/app/search/jobSearchTiers'

const JOB_PANEL_LIMIT = 5

// Post-incident value (see tmp-audit/session16-search-cascade-fix.md):
// unchanged from the 9057937 attempt — 2500ms is not itself implicated in
// that incident's root cause (excess concurrency was); left as-is per that
// report's own conclusion that this number needed diagnosability, not
// retuning.
const JOB_QUERY_TIMEOUT_MS = 2500

// A slow or hung job query must never hold up content results — race it
// against a deadline and fall back rather than let /search inherit the
// unexplained keyword-search spikes seen on /api/jobs/direct. This only
// stops the search route from waiting on the underlying Supabase call, not
// the call itself, which has no cancellation hook here.
//
// `onTimeout` fires exactly once, only when the deadline genuinely wins the
// race — never when `promise` settles first. This exists because of a
// production incident (commit 9057937): the previous version of this
// helper had no way to tell "the job query returned zero results" apart
// from "the job query never got a chance to answer" — both looked
// identical from the response alone, and a timeout firing on every request
// would have been invisible in Sentry. It is not enough to fail soft;
// failing soft SILENTLY is what turned a slow query into an undiagnosable
// all-zeros production incident.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, onTimeout: () => void): Promise<T> {
  return new Promise<T>(resolve => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      onTimeout()
      resolve(fallback)
    }, ms)
    promise.then(
      value => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        // fetchJobsForSearch below never actually rejects (its own
        // try/catch always resolves to NO_JOBS) — this branch only exists
        // so a genuinely unexpected rejection can't leave this Promise
        // permanently pending.
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

interface JobsForSearch {
  jobs: Job[]
  jobsTotal: number
  // The exact string that produced jobsTotal — whichever of phraseTerm/
  // andTerm/orTerm actually won the tier cascade below. /search's "See all
  // N matching jobs" button (app/search/page.tsx) links to /jobs/listings
  // with this as its `search` param, not the raw user-typed query: passing
  // the raw query there would return whatever /jobs/listings' own
  // websearch_to_tsquery parsing makes of it (its own AND-only tier),
  // which is a different, usually much larger, number than N. Since both
  // this route and /jobs/listings run the identical `search_jobs_ranked` /
  // `textSearch(..., {type:'websearch'})` machinery on whatever string
  // they're given, handing across the winning tier's own string (phrase,
  // and, or or-joined) is what makes the destination page's own count
  // match N — without /jobs/listings' parsing needing to know anything
  // about tiers at all.
  jobsSearchQuery: string | null
}

const NO_JOBS: JobsForSearch = { jobs: [], jobsTotal: 0, jobsSearchQuery: null }

// Platform-scoped, fails soft: any error here must never break content
// search. Tries three query tiers, most precise first, each strictly
// broader than the last — see app/search/jobSearchTiers.ts for the full
// reasoning and tmp-audit/session16-search-relevance.md Phase 1 for the
// live measurements this is based on:
//   1. phrase (quoted, adjacency-constrained) — tried first, most precise
//   2. and (bare term, both words present anywhere) — falls back here if
//      phrase is too sparse
//   3. or (every token OR-joined, via buildSimilarQuery) — last resort for
//      genuinely under-covered terms
//
// Root-cause fix for the 9057937 incident (tmp-audit/session16-search-
// cascade-fix.md): that version fetched ROWS for both phrase and and in
// parallel (4 concurrent Supabase calls, 2 of them the expensive ranked
// RPC) before knowing which tier would even be used, on top of the 2
// content queries already running alongside this in route.ts's own
// Promise.all — 6 concurrent Supabase-bound calls per search request,
// against a 2500ms deadline that had just been tightened in the same
// commit. This version fetches only the two CHEAP counts in parallel
// first (countOnly never invokes the ranked RPC — see
// getActiveDirectJobs's countOnly branch, a plain PostgREST count), decides
// the tier from those, and only then fetches ROWS — a single ranked-RPC
// call, for the winning tier alone. Worst case (falls through to or) is 4
// total Supabase calls, never more than 2 concurrent at once; the common
// case (phrase or and wins) is 3 calls, only 1 of them the expensive kind.
async function fetchJobsForSearch(rawQuery: string, platform: string): Promise<JobsForSearch> {
  const phraseTerm = buildPhraseQuery(rawQuery)
  const andTerm = buildAndQuery(rawQuery)
  if (!phraseTerm && !andTerm) return NO_JOBS

  try {
    const [phraseTotal, andTotal] = await Promise.all([
      phraseTerm ? getActiveDirectJobs({ platform, search: phraseTerm, countOnly: true }) : Promise.resolve(0),
      andTerm ? getActiveDirectJobs({ platform, search: andTerm, countOnly: true }) : Promise.resolve(0),
    ])

    const tier = pickJobSearchTier({ phraseTotal, andTotal })

    // phraseTerm/andTerm are guaranteed non-null whenever their own tier
    // wins: pickJobSearchTier can only return 'phrase' if phraseTotal met
    // the threshold, and phraseTotal is 0 (never >= a positive threshold)
    // whenever phraseTerm was null above — same reasoning for 'and'.
    if (tier === 'phrase') {
      const jobs = await getActiveDirectJobs({ platform, search: phraseTerm!, limit: JOB_PANEL_LIMIT })
      return { jobs, jobsTotal: phraseTotal, jobsSearchQuery: phraseTerm }
    }
    if (tier === 'and') {
      const jobs = await getActiveDirectJobs({ platform, search: andTerm!, limit: JOB_PANEL_LIMIT })
      return { jobs, jobsTotal: andTotal, jobsSearchQuery: andTerm }
    }

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
    return { jobs: orJobs, jobsTotal: orTotal, jobsSearchQuery: orTerm }
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
  const jobsPromise = withTimeout(
    fetchJobsForSearch(rawSearch, platform),
    JOB_QUERY_TIMEOUT_MS,
    NO_JOBS,
    () => {
      console.error('[search] job query timed out', { rawSearch, platform })
      Sentry.captureMessage('[search] job query timed out', {
        level: 'warning',
        tags: { platform },
        extra: { rawSearch },
      })
    },
  )

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

  // Build course query. Matches getPublishedCourses's own filtering
  // (lib/coursesNew.ts) exactly: status='published', and — since courses
  // carry show_on_sites and getPublishedCourses itself filters by it for
  // /free-courses — platform-scoped the same way jobs already are in this
  // route, so an AB course can never show up in an ET search result.
  // Deliberately NOT extending this platform filter to articles/
  // question_sets in this change — that's an existing, separate asymmetry
  // with its own risk, out of scope here.
  // Word-matching follows the articles pattern (title OR description),
  // not question_sets' title-only pattern — a course description is loose
  // descriptive prose like an article's excerpt, not a terse title-only
  // row like a question set.
  let courseQuery = supabase
    .from('courses')
    .select('id, title, slug, description')
    .eq('status', 'published')
    .contains('show_on_sites', [platform])

  for (const word of words) {
    courseQuery = courseQuery.or(
      `title.ilike.%${word}%,description.ilike.%${word}%`
    )
  }
  courseQuery = courseQuery.limit(20)

  const [articleResults, pqResults, courseResults, jobsResult] = await Promise.all([
    articleQuery,
    pqQuery,
    courseQuery,
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

  // Courses have no publish date or category column (see the select above,
  // matching getPublishedCourses's own field list) — publishedAt/category
  // are simply omitted, same as any other result type that lacks them;
  // ResultCard already renders both conditionally.
  const courses = (courseResults.data ?? []).map(c => ({
    _id:     c.id,
    _type:   'course' as const,
    title:   c.title,
    slug:    c.slug,
    excerpt: c.description,
    _score:  scoreText(c.title ?? '', c.description ?? ''),
  }))

  // Sort by score descending.
  // Tie-break: articles, then courses, then PQs (study content before
  // structured courses before quick assessments).
  const TYPE_PRIORITY: Record<string, number> = { article: 0, course: 1, practicePost: 2 }
  const combined = [...articles, ...courses, ...pqs]
  combined.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score
    return TYPE_PRIORITY[a._type] - TYPE_PRIORITY[b._type]
  })

  // Remove internal scoring field before returning.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const results = combined.map(({ _score, ...r }) => r)

  return NextResponse.json({
    results,
    jobs: jobsResult.jobs,
    jobsTotal: jobsResult.jobsTotal,
    jobsSearchQuery: jobsResult.jobsSearchQuery,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
