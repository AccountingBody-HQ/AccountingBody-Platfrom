import Link from 'next/link'
import type { Metadata } from 'next'
import { getPracticePosts, getPracticeFilters } from '@/lib/practice-queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title:       'Practice Questions | Accounting Body',
  description: 'Exam-standard practice questions for accounting qualifications. Fresh random sets every session.',
}

const DIFFICULTY_BADGE: Record<string, string> = {
  beginner:     'bg-green-50 text-green-700 border-green-200',
  intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  advanced:     'bg-red-50 text-red-700 border-red-200',
}

const PER_PAGE = 12

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export default async function PracticeQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string; search?: string; page?: string; letter?: string; sort?: string; category?: string; type?: string }>
}) {
  const sp           = await searchParams
  const difficulty   = sp.difficulty ?? ''
  const search       = sp.search ?? ''
  const page         = Math.max(1, parseInt(sp.page ?? '1', 10))
  const letter       = sp.letter ?? ''
  const sort         = sp.sort ?? 'alpha'
  const category     = sp.category ?? ''
  const questionType = sp.type ?? ''

  // Build search term — letter filter takes priority over text search
  const searchTerm = letter ? letter : (search || undefined)

  const [{ posts, total }, filters] = await Promise.all([
    getPracticePosts({
      difficulty:   difficulty || undefined,
      search:       searchTerm,
      category:     category || undefined,
      questionType: questionType || undefined,
      page,
      perPage:      PER_PAGE,
      sortBy:       sort,
    }),
    getPracticeFilters(),
  ])

  const totalPages = Math.ceil(total / PER_PAGE)

  // Build URL helper — preserves existing params and overrides one
  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams()
    if (difficulty) params.set('difficulty', difficulty)
    if (search && !letter) params.set('search', search)
    if (letter) params.set('letter', letter)
    if (sort && sort !== 'alpha') params.set('sort', sort)
    if (category) params.set('category', category)
    if (page > 1) params.set('page', String(page))
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === '' || v === 0) params.delete(k)
      else params.set(k, String(v))
    })
    const str = params.toString()
    return `/practice-questions${str ? '?' + str : ''}`
  }

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-14 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20" style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Practice Questions</span>
          </nav>
          <p className="text-xs font-bold uppercase tracking-widest text-gold-400 mb-4">Practice Questions</p>
          <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl leading-tight mb-6" style={{ letterSpacing: "-0.02em" }}>
            Exam-standard practice<br /><span className="text-gold-400">questions.</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl">
            Scenario-based and multiple choice questions for accounting qualifications. Every session picks a fresh random set.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-start">

            {/* FILTER SIDEBAR */}
            <aside className="bg-white rounded-xl border border-slate-200 p-5 lg:sticky lg:top-24">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Filter</p>

              {/* Search */}
              <form method="GET" action="/practice-questions">
                {difficulty && <input type="hidden" name="difficulty" value={difficulty} />}
                {sort && sort !== 'alpha' && <input type="hidden" name="sort" value={sort} />}
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search topics..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-navy-950"
                />
                <button type="submit" className="w-full h-9 rounded-lg bg-navy-950 text-white text-sm font-semibold mb-5 hover:bg-navy-900 transition-colors">
                  Search
                </button>
              </form>

              {/* Sort */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Sort by</p>
              <div className="space-y-1 mb-5">
                {[{ label: 'A – Z', value: 'alpha' }, { label: 'Newest first', value: 'newest' }].map(opt => (
                  <Link
                    key={opt.value}
                    href={buildUrl({ sort: opt.value, page: 1 })}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${sort === opt.value ? 'bg-navy-950 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>

              {/* Difficulty */}
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Difficulty</p>
              <div className="space-y-1">
                {[{ label: 'All levels', value: '' }, ...filters.difficulties.map(d => ({ label: d.charAt(0).toUpperCase() + d.slice(1), value: d }))].map(opt => (
                  <Link
                    key={opt.value}
                    href={buildUrl({ difficulty: opt.value, page: 1 })}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${difficulty === opt.value ? 'bg-navy-950 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>

              {/* Subject Category */}
              {filters.categories.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 mt-5">Subject</p>
                  <div className="space-y-1">
                    {[{ label: 'All subjects', slug: '' }, ...filters.categories].map(cat => (
                      <Link
                        key={'slug' in cat ? cat.slug : ''}
                        href={buildUrl({ category: 'slug' in cat ? cat.slug : '', page: 1 })}
                        className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${'slug' in cat && category === cat.slug && cat.slug !== '' ? 'bg-navy-950 text-white font-semibold' : !category && !('slug' in cat && cat.slug) ? 'bg-navy-950 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {'title' in cat ? cat.title : cat.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </aside>

            {/* RESULTS */}
            <div>
              {/* A–Z alphabet filter */}
              <div className="flex flex-wrap gap-1 mb-5">
                <Link
                  href={buildUrl({ letter: '', page: 1 })}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${!letter ? 'bg-navy-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-navy-300'}`}
                >
                  All
                </Link>
                {ALPHABET.map(l => (
                  <Link
                    key={l}
                    href={buildUrl({ letter: l, page: 1 })}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${letter === l ? 'bg-navy-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-navy-300'}`}
                  >
                    <span translate="no">{l}</span>
                  </Link>
                ))}
              </div>

              {/* Results count + active filters */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <p className="text-sm text-slate-500">
                  {total} question set{total !== 1 ? 's' : ''}
                  {letter && <span className="ml-1 font-medium text-navy-950">starting with {letter}</span>}
                  {search && !letter && <span className="ml-1 font-medium text-navy-950">matching &ldquo;{search}&rdquo;</span>}
                  {difficulty && <span className="ml-1">· {difficulty}</span>}
                </p>
                {(letter || search || difficulty) && (
                  <Link href="/practice-questions" className="text-xs text-slate-400 hover:text-navy-950 transition-colors">
                    Clear filters
                  </Link>
                )}
              </div>

              {posts.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-slate-400 text-lg">No practice questions found.</p>
                  <Link href="/practice-questions" className="mt-4 inline-block text-sm text-navy-700 hover:underline">Clear filters</Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {posts.map(post => {
                      const diffClass = DIFFICULTY_BADGE[post.difficulty ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      return (
                        <Link
                          key={post._id}
                          href={`/practice-questions/${post.slug.current}`}
                          className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-navy-300 hover:shadow-md transition-all flex flex-col"
                        >
                          {post.difficulty && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${diffClass}`}>
                                {post.difficulty}
                              </span>
                            </div>
                          )}
                          <h2 className="font-display text-navy-950 text-base font-semibold leading-snug mb-2 group-hover:text-gold-600 transition-colors flex-1">
                            {post.title}
                          </h2>
                          {post.excerpt && (
                            <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mt-1">{post.excerpt}</p>
                          )}
                          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-navy-700 group-hover:text-gold-600 transition-colors">
                            Start practising
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  {/* PAGINATION */}
                  {totalPages > 1 && (
                    <div className="mt-10 flex items-center justify-center gap-2 flex-wrap">
                      {page > 1 && (
                        <Link
                          href={buildUrl({ page: page - 1 })}
                          className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:border-navy-300 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
                          Previous
                        </Link>
                      )}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                        .reduce<(number | string)[]>((acc, p, idx, arr) => {
                          if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...')
                          acc.push(p)
                          return acc
                        }, [])
                        .map((p, i) =>
                          p === '...' ? (
                            <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm">…</span>
                          ) : (
                            <Link
                              key={p}
                              href={buildUrl({ page: p as number })}
                              className={`w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${page === p ? 'bg-navy-950 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-navy-300'}`}
                            >
                              {p}
                            </Link>
                          )
                        )}
                      {page < totalPages && (
                        <Link
                          href={buildUrl({ page: page + 1 })}
                          className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:border-navy-300 transition-colors flex items-center gap-1"
                        >
                          Next
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </Link>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
