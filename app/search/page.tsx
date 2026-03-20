// app/search/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'

type ContentType = 'all' | 'article' | 'practicePost' | 'course' | 'quiz' | 'dictionaryTerm'

interface SearchResult {
  _id:          string
  _type:        ContentType
  title?:       string
  term?:        string
  slug:         string
  excerpt?:     string
  definition?:  string
  category?:    string
  examBody?:    string
  readTime?:    number
  publishedAt?: string
}

const FILTERS: { id: ContentType; label: string }[] = [
  { id: 'all',            label: 'All'                },
  { id: 'article',        label: 'Articles'           },
  { id: 'practicePost',   label: 'Practice Questions' },
  { id: 'course',         label: 'Courses'            },
  { id: 'quiz',           label: 'Quizzes'            },
  { id: 'dictionaryTerm', label: 'Glossary'           },
]

const POPULAR_SEARCHES = [
  'ACCA F3', 'deferred tax', 'CIMA OCS', 'double entry',
  'AAT Level 3', 'financial statements', 'cash flow statement',
  'ratio analysis', 'ICAEW ACA', 'VAT',
]

function getUrl(r: SearchResult): string {
  switch (r._type) {
    case 'article':        return `/articles/${r.slug}`
    case 'practicePost':   return `/practice-questions/${r.slug}`
    case 'course':         return `/courses/${r.slug}`
    case 'quiz':           return `/quiz/${r.slug}`
    case 'dictionaryTerm': return `/glossary/${r.slug}`
    default:               return `/${r.slug}`
  }
}

function getTypeLabel(type: ContentType): string {
  const map: Record<ContentType, string> = {
    all: 'All', article: 'Article', practicePost: 'Practice Question',
    course: 'Course', quiz: 'Quiz', dictionaryTerm: 'Glossary',
  }
  return map[type]
}

function getTypeBadgeClass(type: ContentType): string {
  const map: Record<ContentType, string> = {
    all:            'bg-slate-100 text-slate-700 border-slate-200',
    article:        'bg-navy-50 text-navy-700 border-navy-200',
    practicePost:   'bg-gold-50 text-gold-700 border-gold-200',
    course:         'bg-teal-50 text-teal-700 border-teal-200',
    quiz:           'bg-amber-50 text-amber-700 border-amber-200',
    dictionaryTerm: 'bg-slate-50 text-slate-700 border-slate-200',
  }
  return map[type]
}

async function searchSanity(q: string, type: ContentType): Promise<SearchResult[]> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
  if (!projectId || q.trim().length < 2) return []

  const typeFilter = type === 'all'
    ? `_type in ["article", "practicePost", "course", "quiz", "dictionaryTerm"]`
    : `_type == "${type}"`

  const groq = `
    *[${typeFilter} && (
      title         match "*${q}*"
      || term       match "*${q}*"
      || excerpt    match "*${q}*"
      || definition match "*${q}*"
      || category   match "*${q}*"
    )] | score(
      boost(title        match "${q}", 3),
      boost(term         match "${q}", 3),
      boost(excerpt      match "${q}", 2),
      boost(definition   match "${q}", 2),
      boost(category     match "${q}", 1)
    ) | order(_score desc) [0..23] {
      _id, _type, title, term,
      "slug": slug.current,
      excerpt, definition, category, examBody, readTime, publishedAt
    }
  `

  try {
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}?query=${encodeURIComponent(groq)}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

function ResultCard({ result }: { result: SearchResult }) {
  const title   = result.title || result.term || 'Untitled'
  const excerpt = result.excerpt || result.definition

  return (
    <Link
      href={getUrl(result)}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {result.examBody && (
        <div className={`h-0.5 w-full rounded-full mb-4 ${
          result.examBody === 'ACCA'  ? 'bg-[#004B8D]' :
          result.examBody === 'CIMA'  ? 'bg-[#0081C6]' :
          result.examBody === 'AAT'   ? 'bg-[#00857A]' :
          result.examBody === 'ICAEW' ? 'bg-[#C8A000]' :
          'bg-navy-400'
        }`} />
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getTypeBadgeClass(result._type)}`}>
          {getTypeLabel(result._type)}
        </span>
        {result.category && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {result.category}
          </span>
        )}
      </div>

      <h3 className="font-display text-navy-950 text-base leading-snug mb-2 group-hover:text-navy-700 transition-colors">
        {title}
      </h3>

      {excerpt && (
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed flex-1">
          {excerpt}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          {result.publishedAt
            ? new Date(result.publishedAt).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })
            : ''}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-navy-700 group-hover:text-gold-600 transition-colors">
          {result._type === 'dictionaryTerm' ? 'View definition' :
           result._type === 'practicePost'   ? 'Try question'   : 'Read more'}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 bg-slate-200 rounded-full" />
        <div className="h-5 w-12 bg-slate-200 rounded-full" />
      </div>
      <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
      <div className="h-4 bg-slate-200 rounded mb-1 w-full" />
      <div className="h-4 bg-slate-200 rounded w-2/3" />
    </div>
  )
}

export default function SearchPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [query,      setQuery]      = useState(searchParams.get('q') ?? '')
  const [activeType, setActiveType] = useState<ContentType>('all')
  const [results,    setResults]    = useState<SearchResult[]>([])
  const [loading,    setLoading]    = useState(false)
  const [searched,   setSearched]   = useState(false)
  const debounceRef                 = useRef<ReturnType<typeof setTimeout>>()
  const inputRef                    = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }
    setLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      router.replace(`/search?q=${encodeURIComponent(query)}`, { scroll: false })
      const data = await searchSanity(query, activeType)
      setResults(data)
      setSearched(true)
      setLoading(false)
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, activeType, router])

  const countFor = (type: ContentType) =>
    type === 'all' ? results.length : results.filter(r => r._type === type).length

  const displayed = activeType === 'all'
    ? results
    : results.filter(r => r._type === activeType)

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="bg-navy-950 pt-16 pb-14 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-20"
            style={{ background: 'radial-gradient(ellipse at top, #3a4f9a 0%, transparent 65%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="container-site relative z-10">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <span className="eyebrow text-gold-400 mb-3 block">Search</span>
            <h1 className="font-display text-white mb-3 leading-tight" style={{ letterSpacing: '-0.025em' }}>
              Find what you need
            </h1>
            <p className="text-white/55 text-lg">
              Search across 3,000+ articles, 50,000+ practice questions, courses, and glossary terms.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>

              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search for ACCA F3, deferred tax, CIMA OCS…"
                className="w-full h-14 pl-12 pr-12 rounded-xl text-base bg-white/10 border border-white/20 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all"
                aria-label="Search AccountingBody"
                autoComplete="off"
              />

              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {loading ? (
                  <svg className="w-5 h-5 text-gold-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : query ? (
                  <button
                    onClick={() => { setQuery(''); inputRef.current?.focus() }}
                    className="text-white/40 hover:text-white/80 transition-colors"
                    aria-label="Clear search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── RESULTS ──────────────────────────────────────────────────── */}
      <section className="section bg-slate-50 min-h-[55vh]">
        <div className="container-site">

          {searched && results.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveType(f.id)}
                  className={`flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium border transition-all ${
                    activeType === f.id
                      ? 'bg-navy-950 text-white border-navy-950'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:text-navy-700'
                  }`}
                >
                  {f.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeType === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {countFor(f.id)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {(!query || query.trim().length < 2) && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-navy-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-2">Start typing to search</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mb-8">
                Search across articles, practice questions, courses, quizzes, and glossary terms.
              </p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">Popular searches</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {POPULAR_SEARCHES.map(term => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    className="h-8 px-3 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:border-navy-300 hover:text-navy-700 transition-all"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {searched && !loading && displayed.length === 0 && query.trim().length >= 2 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="font-display text-xl text-navy-950 mb-2">No results for &ldquo;{query}&rdquo;</h2>
              <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                Try a shorter term, check your spelling, or browse by qualification.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {['ACCA', 'CIMA', 'AAT', 'ICAEW'].map(body => (
                  <Link
                    key={body}
                    href={`/study/${body.toLowerCase()}`}
                    className="h-9 px-4 rounded-lg text-sm font-medium bg-white text-navy-950 border border-slate-200 hover:border-navy-300 transition-all"
                  >
                    Browse {body}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {searched && !loading && displayed.length > 0 && (
            <>
              <p className="text-sm text-slate-500 mb-5">
                <span className="font-semibold text-navy-950">{displayed.length}</span>{' '}
                result{displayed.length !== 1 ? 's' : ''} for{' '}
                <span className="font-semibold text-navy-950">&ldquo;{query}&rdquo;</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayed.map(r => <ResultCard key={r._id} result={r} />)}
              </div>
            </>
          )}

        </div>
      </section>
    </>
  )
}