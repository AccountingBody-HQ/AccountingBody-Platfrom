import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter — 30 requests per 60s per IP
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

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET    ?? 'production'

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','it','its','as','be','are','was','were','been','have',
  'has','had','do','does','will','would','could','should','may','might',
  'what','how','why','when','where','which','who','that','this','these','those',
])

const SYNONYMS: Record<string, string[]> = {
  'lease':        ['lease','leasing'],
  'tax':          ['tax','taxation'],
  'audit':        ['audit','assurance'],
  'budget':       ['budget','budgeting','forecast'],
  'ratio':        ['ratio','ratios'],
  'payroll':      ['payroll','wages','salary'],
  'bookkeeping':  ['bookkeeping','ledger'],
  'depreciation': ['depreciation','amortisation'],
  'consolidation':['consolidation','consolidated'],
  'ifrs':         ['ifrs','reporting','standards'],
  'gaap':         ['gaap','accounting','principles'],
  'vat':          ['vat','tax'],
  'profit':       ['profit','loss','income'],
  'cash':         ['cash','flow','liquidity'],
  'investment':   ['investment','capital','return'],
  'cost':         ['cost','expense','expenditure'],
}

function buildGroups(q: string): string[][] {
  const clean = q.replace(/['"`\\]/g, '').trim().toLowerCase()
  const words = clean.split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w))
  return words.map(w => {
    const group = new Set<string>([w])
    if (SYNONYMS[w]) SYNONYMS[w].forEach(s => group.add(s))
    return Array.from(group)
  }).filter(g => g.length > 0)
}

function makeGroq(groups: string[][], mode: 'AND' | 'OR', site: string): string {
  const clause = (group: string[]) =>
    '(' + group.map(w =>
      `title match "${w}*" || term match "${w}*" || excerpt match "${w}*" || definition match "${w}*" || category match "${w}*"`
    ).join(' || ') + ')'
  const join    = mode === 'AND' ? ' && ' : ' || '
  const filters = groups.map(clause).join(join)
  return `*[
    _type in ["article","practicePost","course","quiz","dictionaryTerm"]
    && "${site}" in showOnSites
    && (${filters})
  ] | order(publishedAt desc) [0..39] {
    _id, _type, title, term,
    "slug": slug.current,
    excerpt, definition, category, examBody, readTime, publishedAt
  }`
}

async function querySanity(groq: string) {
  const url = `https://${PROJECT_ID}.api.sanity.io/v2023-05-03/data/query/${DATASET}?query=${encodeURIComponent(groq)}`
  const res  = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.result ?? []
}

function scoreResult(result: Record<string, unknown>, q: string): number {
  const query = q.toLowerCase().trim()
  const title = ((result.title as string) || (result.term as string) || '').toLowerCase()
  const excerpt = ((result.excerpt as string) || (result.definition as string) || '').toLowerCase()

  // Score 4: exact full title match
  if (title === query) return 4

  // Score 3: title starts with query
  if (title.startsWith(query)) return 3

  // Score 2: title contains query
  if (title.includes(query)) return 2

  // Score 1: any query word found in title
  const words = query.split(/\s+/).filter(w => w.length >= 2)
  const titleWordMatch = words.some(w => title.includes(w))
  if (titleWordMatch) return 1

  // Score 0: match only in excerpt/definition
  if (excerpt.includes(query)) return 0

  return -1
}

function sortByRelevance(results: Record<string, unknown>[], q: string): Record<string, unknown>[] {
  return [...results].sort((a, b) => {
    const scoreA = scoreResult(a, q)
    const scoreB = scoreResult(b, q)
    if (scoreB !== scoreA) return scoreB - scoreA
    // Tiebreaker: most recent first
    const dateA = new Date((a.publishedAt as string) || 0).getTime()
    const dateB = new Date((b.publishedAt as string) || 0).getTime()
    return dateB - dateA
  })
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 2) return NextResponse.json([])
  const referer = req.headers.get('referer') ?? ''
  const host    = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const site    = (referer.includes('ethiotax.com') || host.includes('ethiotax.com')) ? 'ethiotax' : 'accountingbody'

  const groups  = buildGroups(q)
  if (groups.length === 0) return NextResponse.json([])

  try {
    const andResults = await querySanity(makeGroq(groups, 'AND', site))
    if (andResults.length > 0) {
      return NextResponse.json(sortByRelevance(andResults, q))
    }
    const orResults = await querySanity(makeGroq(groups, 'OR', site))
    return NextResponse.json(sortByRelevance(orResults, q))
  } catch {
    return NextResponse.json([])
  }
}
