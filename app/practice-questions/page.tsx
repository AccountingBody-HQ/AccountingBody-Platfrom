import Link from 'next/link'
import type { Metadata } from 'next'
import { getPracticePosts, getPracticeFilters } from '@/lib/practice-queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title:       'Practice Questions | AccountingBody',
  description: 'Exam-standard MCQ, scenario, and written practice questions for ACCA, CIMA, ICAEW, and AAT.',
}

export default async function PracticeQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ difficulty?: string; search?: string; page?: string }>
}) {
  const sp         = await searchParams
  const difficulty = sp.difficulty ?? ''
  const search     = sp.search ?? ''
  const page       = parseInt(sp.page ?? '1', 10)

  const [{ posts, total }, filters] = await Promise.all([
    getPracticePosts({ difficulty: difficulty || undefined, search: search || undefined, page }),
    getPracticeFilters(),
  ])

  const DIFFICULTY_BADGE: Record<string, string> = {
    beginner:     'bg-green-50 text-green-700 border-green-200',
    intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
    advanced:     'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div>
      {/* HERO */}
      <section className='relative overflow-hidden bg-navy-950 py-14 md:py-20'>
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20' style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className='container-site relative z-10'>
          <nav className='flex items-center gap-2 text-white/40 text-sm mb-8'>
            <Link href='/' className='hover:text-white/70 transition-colors'>Home</Link>
            <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M9 5l7 7-7 7' /></svg>
            <span className='text-white/70'>Practice Questions</span>
          </nav>
          <p className='text-xs font-bold uppercase tracking-widest text-gold-400 mb-4'>Practice Questions</p>
          <h1 className='font-display text-white text-4xl md:text-5xl lg:text-6xl leading-tight mb-6' style={{ letterSpacing: '-0.02em' }}>
            Exam-standard practice<br /><span className='text-gold-400'>questions.</span>
          </h1>
          <p className='text-white/60 text-lg max-w-2xl'>
            MCQ, scenario-based, and written questions for ACCA, CIMA, ICAEW, and AAT. Every session picks a fresh random set.
          </p>
        </div>
      </section>

      {/* CONTENT */}
      <section className='section bg-slate-50'>
        <div className='container-site'>
          <div className='grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 items-start'>

            {/* FILTER SIDEBAR */}
            <aside className='bg-white rounded-xl border border-slate-200 p-5 lg:sticky lg:top-24'>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4'>Filter</p>
              <form method='GET'>
                <input
                  type='text'
                  name='search'
                  defaultValue={search}
                  placeholder='Search questions...'
                  className='w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-navy-950'
                />
                <button type='submit' className='w-full h-9 rounded-lg bg-navy-950 text-white text-sm font-semibold mb-5 hover:bg-navy-900 transition-colors'>
                  Search
                </button>
                <p className='text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3'>Difficulty</p>
                <div className='space-y-1'>
                  {[{ label: 'All levels', value: '' }, ...filters.difficulties.map(d => ({ label: d.charAt(0).toUpperCase() + d.slice(1), value: d }))].map(opt => (
                    <Link
                      key={opt.value}
                      href={opt.value ? `?difficulty=${opt.value}` : '/practice-questions'}
                      className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${ difficulty === opt.value ? 'bg-navy-950 text-white font-semibold' : 'text-slate-600 hover:bg-slate-100' }`}
                    >
                      {opt.label}
                    </Link>
                  ))}
                </div>
              </form>
            </aside>

            {/* RESULTS */}
            <div>
              <p className='text-sm text-slate-500 mb-6'>{total} question set{total !== 1 ? 's' : ''}</p>
              {posts.length === 0 ? (
                <div className='text-center py-20'>
                  <p className='text-slate-400 text-lg'>No practice questions found.</p>
                  <Link href='/practice-questions' className='mt-4 inline-block text-sm text-navy-700 hover:underline'>Clear filters</Link>
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'>
                  {posts.map(post => (
                    <Link
                      key={post._id}
                      href={`/practice-questions/${post.slug.current}`}
                      className='group bg-white rounded-xl border border-slate-200 p-5 hover:border-navy-300 hover:shadow-md transition-all flex flex-col'
                    >
                      <div className='flex flex-wrap gap-2 mb-3'>
                        {post.difficulty && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${DIFFICULTY_BADGE[post.difficulty] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {post.difficulty}
                          </span>
                        )}
                        {post.questionType && (
                          <span className='text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200'>
                            {post.questionType}
                          </span>
                        )}
                      </div>
                      <h2 className='font-display text-navy-950 text-base font-semibold leading-snug mb-2 group-hover:text-blue-700 transition-colors'>
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p className='text-sm text-slate-500 leading-relaxed flex-1'>{post.excerpt}</p>
                      )}
                      {post.questionCount && (
                        <p className='text-xs text-slate-400 mt-3'>{post.questionCount} questions</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}