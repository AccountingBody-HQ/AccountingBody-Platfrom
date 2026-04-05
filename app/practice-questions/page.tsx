import Link from 'next/link'
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { getPracticePosts, getPracticeFilters } from '@/lib/practice-queries'

export const metadata: Metadata = {
  title:       'Practice Questions | AccountingBody',
  description: 'Exam-standard practice questions for ACCA, CIMA, AAT, ICAEW and more. MCQ, scenario, and written questions.',
}

const EXAM_BODY_ACCENT: Record<string, string> = {
  ACCA:  'bg-[#004B8D]', CIMA: 'bg-[#0081C6]', AAT: 'bg-[#00857A]',
  ICAEW: 'bg-[#8B0000]', ATT:  'bg-[#6B21A8]', CPA: 'bg-[#1D4ED8]',
  Tax:   'bg-[#B45309]',
}
const EXAM_BODY_BADGE: Record<string, string> = {
  ACCA:  'bg-blue-50 text-[#004B8D] border-blue-200',
  CIMA:  'bg-sky-50 text-[#0081C6] border-sky-200',
  AAT:   'bg-teal-50 text-teal-700 border-teal-200',
  ICAEW: 'bg-red-50 text-red-800 border-red-200',
  ATT:   'bg-purple-50 text-purple-800 border-purple-200',
  CPA:   'bg-blue-50 text-blue-800 border-blue-200',
  Tax:   'bg-amber-50 text-amber-800 border-amber-200',
}
const DIFFICULTY_BADGE: Record<string, string> = {
  Beginner:     'bg-green-50 text-green-700 border-green-200',
  Intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  Advanced:     'bg-red-50 text-red-700 border-red-200',
}
const QTYPE_LABEL: Record<string, string> = {
  mcq:      'MCQ',
  scenario: 'Scenario',
  writing:  'Written',
}

export default async function PracticeQuestionsPage({
  searchParams,
}: {
  searchParams: { examBody?: string; difficulty?: string; topic?: string; search?: string; page?: string }
}) {
  const page       = Number(searchParams.page ?? 1)
  const perPage    = 12
  const examBody   = searchParams.examBody   ?? ''
  const difficulty = searchParams.difficulty ?? ''
  const topic      = searchParams.topic      ?? ''
  const search     = searchParams.search     ?? ''

  const [{ posts, total }, filters] = await Promise.all([
    getPracticePosts({ examBody, difficulty, topic, search, page, perPage }),
    getPracticeFilters(),
  ])

  const totalPages = Math.ceil(total / perPage)

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams()
    const current = { examBody, difficulty, topic, search, page: String(page) }
    const merged  = { ...current, ...overrides }
    Object.entries(merged).forEach(([k, v]) => { if (v && v !== '1') params.set(k, v) })
    const str = params.toString()
    return `/practice-questions${str ? `?${str}` : ''}`
  }

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-25" style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Practice Questions</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Practice Questions</span>
          <h1 className="font-display text-white mb-4 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
            Exam-standard practice
            <br />
            <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              questions.
            </span>
          </h1>
          <p className="text-white/65 text-lg leading-relaxed max-w-xl">
            MCQ, scenario-based, and written questions across every major accounting qualification.
            Every session picks a fresh random set.
          </p>
        </div>
      </section>

      {/* FILTERS + GRID */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">

            {/* SIDEBAR FILTERS */}
            <aside>
              <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-24">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Filter</p>

                {/* Search */}
                <form method="GET" action="/practice-questions" className="mb-5">
                  <input type="hidden" name="examBody"   value={examBody} />
                  <input type="hidden" name="difficulty" value={difficulty} />
                  <input type="hidden" name="topic"      value={topic} />
                  <div className="relative">
                    <input
                      type="text"
                      name="search"
                      defaultValue={search}
                      placeholder="Search questions…"
                      className="w-full h-9 pl-8 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent"
                    />
                    <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <button type="submit" className="mt-2 w-full h-9 rounded-lg text-xs font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">Search</button>
                </form>

                {/* Exam Body */}
                {filters.examBodies.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Qualification</p>
                    <div className="space-y-1">
                      <Link href={buildUrl({ examBody: '', page: '1' })} className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${!examBody ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                        All qualifications
                      </Link>
                      {filters.examBodies.map(eb => (
                        <Link key={eb} href={buildUrl({ examBody: eb, page: '1' })} className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${examBody === eb ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                          {eb}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Difficulty */}
                {filters.difficulties.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Difficulty</p>
                    <div className="space-y-1">
                      <Link href={buildUrl({ difficulty: '', page: '1' })} className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${!difficulty ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                        All levels
                      </Link>
                      {filters.difficulties.map(d => (
                        <Link key={d} href={buildUrl({ difficulty: d, page: '1' })} className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${difficulty === d ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                          {d}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Topic */}
                {filters.topics.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Topic</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      <Link href={buildUrl({ topic: '', page: '1' })} className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${!topic ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                        All topics
                      </Link>
                      {filters.topics.map(t => (
                        <Link key={t} href={buildUrl({ topic: t, page: '1' })} className={`block text-sm px-3 py-1.5 rounded-lg transition-colors ${topic === t ? 'bg-navy-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                          {t}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* MAIN GRID */}
            <div>
              {/* Results bar */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-slate-500">
                  {total > 0 ? `${total} question set${total !== 1 ? 's' : ''}` : 'No results'}
                  {search && <span> for &ldquo;{search}&rdquo;</span>}
                </p>
                {(examBody || difficulty || topic || search) && (
                  <Link href="/practice-questions" className="text-xs font-semibold text-navy-700 hover:text-gold-600 transition-colors">
                    Clear filters
                  </Link>
                )}
              </div>

              {/* Empty state */}
              {posts.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-navy-50 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <h2 className="font-display text-2xl text-navy-950 mb-3">No questions found</h2>
                  <p className="text-slate-500 text-base mb-8">Try adjusting your filters or check back soon as we add new content.</p>
                  <Link href="/practice-questions" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">Clear all filters</Link>
                </div>
              )}

              {/* Cards grid */}
              {posts.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {posts.map(post => {
                      const accent = EXAM_BODY_ACCENT[post.examBody ?? ''] ?? 'bg-navy-950'
                      const badge  = EXAM_BODY_BADGE[post.examBody ?? '']  ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      const diff   = DIFFICULTY_BADGE[post.difficulty ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      return (
                        <Link key={post._id} href={`/practice-questions/${post.slug.current}`} className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                          <div className={`h-1 ${accent}`} />
                          <div className="p-5 flex flex-col flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              {post.examBody && <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badge}`}>{post.examBody}</span>}
                              {post.difficulty && <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${diff}`}>{post.difficulty}</span>}
                              {post.questionType && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{QTYPE_LABEL[post.questionType] ?? post.questionType}</span>}
                            </div>
                            <h3 className="font-display text-base text-navy-950 leading-snug mb-2 group-hover:text-navy-700 transition-colors flex-1">{post.title}</h3>
                            {post.excerpt && <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
                              {post.topic && <span className="text-xs text-slate-400">{post.topic}</span>}
                              {post.questionCount && (
                                <span className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                  {post.questionCount} questions
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>

                  {/* PAGINATION */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      {page > 1 && (
                        <Link href={buildUrl({ page: String(page - 1) })} className="h-9 px-4 rounded-lg text-sm font-medium border border-slate-200 text-navy-950 hover:border-navy-950 transition-colors flex items-center">
                          Previous
                        </Link>
                      )}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <Link key={p} href={buildUrl({ page: String(p) })} className={`w-9 h-9 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${p === page ? 'bg-navy-950 text-white' : 'border border-slate-200 text-navy-950 hover:border-navy-950'}`}>
                          {p}
                        </Link>
                      ))}
                      {page < totalPages && (
                        <Link href={buildUrl({ page: String(page + 1) })} className="h-9 px-4 rounded-lg text-sm font-medium border border-slate-200 text-navy-950 hover:border-navy-950 transition-colors flex items-center">
                          Next
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
