import { NextRequest, NextResponse } from 'next/server'

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

function makeGroq(groups: string[][], mode: 'AND' | 'OR'): string {
  const clause = (group: string[]) =>
    '(' + group.map(w =>
      `title match "${w}*" || term match "${w}*" || excerpt match "${w}*" || definition match "${w}*" || category match "${w}*"`
    ).join(' || ') + ')'
  const join    = mode === 'AND' ? ' && ' : ' || '
  const filters = groups.map(clause).join(join)
  return `*[
    _type in ["article","practicePost","course","quiz","dictionaryTerm"]
    && "accountingbody" in showOnSites
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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (q.trim().length < 2) return NextResponse.json([])

  const groups = buildGroups(q)
  if (groups.length === 0) return NextResponse.json([])

  try {
    const andResults = await querySanity(makeGroq(groups, 'AND'))
    if (andResults.length > 0) return NextResponse.json(andResults)
    const orResults = await querySanity(makeGroq(groups, 'OR'))
    return NextResponse.json(orResults)
  } catch {
    return NextResponse.json([])
  }
}
