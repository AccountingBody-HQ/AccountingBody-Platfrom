import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPracticePostBySlug } from '@/lib/practice-queries'
import QuizRenderer from '@/components/QuizRenderer'

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
            {post.questionType && (
              <span className='text-xs font-medium px-2.5 py-1 rounded-md bg-white/10 text-white/70 border border-white/15'>{post.questionType}</span>
            )}
          </div>
          <h1 className='font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-6 max-w-4xl' style={{ letterSpacing: '-0.02em' }}>
            {post.title}
          </h1>
          {post.questionCount && (
            <div className='flex items-center gap-2 text-white/50 text-sm'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' /></svg>
              {post.questionCount} questions
              {post.questionCount > 10 && (
                <span className='text-gold-400 ml-1'>— 10 randomly selected each session</span>
              )}
            </div>
          )}
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
            </div>
            <aside className='lg:sticky lg:top-24 space-y-5'>
              <div className='bg-slate-50 rounded-xl border border-slate-200 p-5'>
                <p className='text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4'>Details</p>
                <dl className='space-y-3'>
                  {post.difficulty && (
                    <div className='flex justify-between text-sm'>
                      <dt className='text-slate-500'>Difficulty</dt>
                      <dd><span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${diffClass}`}>{post.difficulty}</span></dd>
                    </div>
                  )}
                  {post.questionCount && (
                    <div className='flex justify-between text-sm'>
                      <dt className='text-slate-500'>Questions</dt>
                      <dd className='text-navy-950 font-medium'>{post.questionCount}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className='bg-navy-950 rounded-xl p-5 relative overflow-hidden'>
                <div className='absolute inset-0 opacity-10' style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
                <div className='relative z-10'>
                  <p className='font-display text-white text-sm mb-3 leading-snug'>How it works</p>
                  <ul className='space-y-2'>
                    {[
                      '10 questions selected at random each session',
                      'Options shuffled to prevent pattern learning',
                      'Instant feedback and explanations on submit',
                      'Retry for a completely fresh set',
                    ].map(tip => (
                      <li key={tip} className='flex items-start gap-2 text-xs text-white/60 leading-relaxed'>
                        <span className='w-1 h-1 rounded-full bg-gold-400 shrink-0 mt-1.5' />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link href='/practice-questions' className='flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 transition-colors font-medium'>
                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='2' d='M7 16l-4-4m0 0l4-4m-4 4h18' /></svg>
                All practice questions
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}