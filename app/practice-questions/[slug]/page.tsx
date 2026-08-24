import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPracticePostBySlug } from '@/lib/practice-queries'
import QuizRenderer from '@/components/QuizRenderer'
import { JobsRecruitmentBanner } from '@/components/JobsRecruitmentSection'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPracticePostBySlug(slug)
  if (!post) return {}
  return {
    title:       `${post.title} | Accounting Body Practice Questions`,
    description: post.excerpt,
  }
}

const DIFFICULTY_BADGE: Record<string, string> = {
  beginner:     'bg-green-50 text-green-700 border-green-200',
  intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  advanced:     'bg-red-50 text-red-700 border-red-200',
}

export default async function PracticePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const post = await getPracticePostBySlug(slug)
  if (!post) notFound()

  const diffClass = DIFFICULTY_BADGE[post.difficulty ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <div>
      {/* HERO */}
      <section className='relative overflow-hidden bg-navy-950 py-14 md:py-20'>
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20' style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className='container-site relative z-10'>
          <nav className='flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap'>
            <Link href='/' className='hover:text-white/70 transition-colors'>Home</Link>
            <svg className='w-3.5 h-3.5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M9 5l7 7-7 7' /></svg>
            <Link href='/practice-questions' className='hover:text-white/70 transition-colors'>Practice Questions</Link>
            <svg className='w-3.5 h-3.5 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M9 5l7 7-7 7' /></svg>
            <span className='text-white/70 line-clamp-1'>{post.title}</span>
          </nav>
          <div className='flex flex-wrap items-center gap-2 mb-5'>
            {post.difficulty && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-md border ${diffClass}`}>{post.difficulty}</span>
            )}

          </div>
          <h1 className='font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-6 max-w-4xl' style={{ letterSpacing: '-0.02em' }}>
            {post.title}
          </h1>

        </div>
      </section>

      {/* QUIZ */}
      <section className='section bg-white'>
        <div className='container-site'>
          <div className='grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-12 items-start'>
            <div>
              {post.excerpt && (
                <p className='text-slate-600 text-lg leading-relaxed mb-8 pb-8 border-b border-slate-200'>{post.excerpt}</p>
              )}
              {post.quizJson ? (
                <QuizRenderer quizJson={post.quizJson} />
              ) : (
                <div className='mt-10 pt-10 border-t border-slate-200'>
                  <div className='p-8 rounded-xl bg-slate-50 border border-slate-200 text-center'>
                    <p className='font-display text-lg text-navy-950 mb-2'>Questions coming soon</p>
                    <p className='text-sm text-slate-500'>The quiz for this post has not been loaded yet.</p>
                  </div>
                </div>
              )}
              {/* Study note link — bottom of page */}
              {post.relatedArticle && (
                <div className='mt-10 p-6 rounded-2xl border border-slate-200 bg-slate-50'>
                  <div className='flex items-start gap-4'>
                    <div className='w-10 h-10 rounded-xl bg-navy-950 flex items-center justify-center shrink-0'>
                      <svg className='w-5 h-5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' /></svg>
                    </div>
                    <div className='flex-1'>
                      <p className='text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1'>Study this topic in depth</p>
                      <p className='font-display text-navy-950 text-base font-semibold mb-1'>{post.relatedArticle.title}</p>
                      <p className='text-slate-500 text-sm mb-3'>Read the full study note to strengthen your understanding of this topic.</p>
                      <Link
                        href={`/articles/${post.relatedArticle.slug}`}
                        className='inline-flex items-center gap-2 text-sm font-semibold text-navy-950 hover:text-gold-600 transition-colors'
                      >
                        Read study note
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M17 8l4 4m0 0l-4 4m4-4H3' /></svg>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <aside className='lg:sticky lg:top-24 space-y-5'>
              {/* Details card */}
              {post.difficulty && (
                <div className='bg-slate-50 rounded-xl border border-slate-200 p-5'>
                  <p className='text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4'>Details</p>
                  <dl className='space-y-3'>
                    <div className='flex justify-between text-sm'>
                      <dt className='text-slate-500'>Difficulty</dt>
                      <dd><span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${diffClass}`}>{post.difficulty}</span></dd>
                    </div>
                  </dl>
                </div>
              )}
              {/* Study note link — sidebar */}
              {post.relatedArticle && (
                <div className='bg-navy-950 rounded-xl p-5 relative overflow-hidden'>
                  <div className='absolute inset-0 opacity-10' style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
                  <div className='relative z-10'>
                    <p className='font-display text-white text-sm mb-2 leading-snug'>Study this topic</p>
                    <p className='text-white/55 text-xs leading-relaxed mb-3'>Read the full study note before attempting the questions.</p>
                    <Link
                      href={`/articles/${post.relatedArticle.slug}`}
                      className='flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors'
                    >
                      <svg className='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' /></svg>
                      Read study note
                    </Link>
                  </div>
                </div>
              )}
              <Link href='/practice-questions' className='flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 transition-colors font-medium'>
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M7 16l-4-4m0 0l4-4m-4 4h18' /></svg>
                All practice questions
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <JobsRecruitmentBanner isEthioTax={isEthioTax} />

    </div>
  )
}