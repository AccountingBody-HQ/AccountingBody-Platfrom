import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getArticleBySlug, resolveCanonicalUrl } from '@/lib/sanity-queries'
import PortableTextRenderer from '@/components/PortableTextRenderer'

export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return {}
  const canonicalUrl = resolveCanonicalUrl(article)
  return {
    title:       `${article.title} | Accounting Body`,
    description: article.excerpt,
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: { title: article.title, description: article.excerpt, type: 'article' },
  }
}

const EXAM_BODY_ACCENT: Record<string, string> = {
  ACCA:  'bg-[#004B8D]',
  CIMA:  'bg-[#0081C6]',
  AAT:   'bg-[#00857A]',
  ICAEW: 'bg-[#8B0000]',
}

const EXAM_BODY_BADGE: Record<string, string> = {
  ACCA:  'bg-blue-50 text-[#004B8D] border-blue-200',
  CIMA:  'bg-sky-50 text-[#0081C6] border-sky-200',
  AAT:   'bg-teal-50 text-teal-700 border-teal-200',
  ICAEW: 'bg-red-50 text-red-800 border-red-200',
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()
  if (!article) return null

  const accentBar  = EXAM_BODY_ACCENT[article.examBody?.[0] ?? ''] ?? 'bg-navy-950'

  const formattedReviewed = article.lastReviewed
    ? new Date(article.lastReviewed).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-950 py-14 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }}
          />
        </div>

        <div className="container-site relative z-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <Link href="/articles" className="hover:text-white/70 transition-colors">Articles</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white/70 line-clamp-1">{article.title}</span>
          </nav>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {article.examBody?.map((body: string) => {
              const bc = EXAM_BODY_BADGE[body.toUpperCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200'
              return (
                <span key={body} className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-md border ${bc}`}>
                  {body.toUpperCase()}
                </span>
              )
            })}
            {article.categoryTitle && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-white/10 text-white/70 border border-white/15">
                {article.categoryTitle}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className="font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-6 max-w-4xl"
            style={{ letterSpacing: '-0.02em' }}
          >
            {article.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
            {article.author?.name && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {article.author.name}
              </span>
            )}

            {formattedReviewed && (
              <span className="flex items-center gap-1.5 text-gold-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reviewed {formattedReviewed}
              </span>
            )}
            {article.readTime && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
                </svg>
                {article.readTime} min read
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Qualification accent bar */}
      <div className={`h-1 w-full ${accentBar}`} />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start">

            {/* Main content */}
            <div>


              <PortableTextRenderer value={(() => {
                    const blocks = (article.body || []) as {_type: string; style?: string; children?: {text?: string}[]}[]
                    const first = blocks[0]
                    if (first?._type === 'block' && first?.children) {
                      const firstText = first.children.map((c: {text?: string}) => c.text || '').join('').trim()
                      // Strip if first block is H1 matching the article title
                      if (first.style === 'h1' && article.title && firstText === article.title.trim()) {
                        return blocks.slice(1)
                      }
                      // Strip if first block matches the excerpt
                      if (article.excerpt && firstText && article.excerpt.startsWith(firstText.substring(0, 80))) {
                        return blocks.slice(1)
                      }
                    }
                    return blocks
                  })()} />

              {/* Test your knowledge — bottom of article */}
              <div className="mt-10 p-6 bg-navy-950 rounded-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
                <div className="relative z-10">
                  <p className="font-display text-white text-lg mb-1">Test your knowledge</p>
                  {article.mcqUrl ? (
                    <>
                      <p className="text-white/60 text-sm mb-4">Practice questions specifically for this topic.</p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href={article.mcqUrl}
                          className="inline-flex items-center justify-center gap-2 bg-gold-500 text-navy-950 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gold-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Practice this topic
                        </Link>
                        <Link
                          href="/practice-questions"
                          className="inline-flex items-center justify-center gap-2 border border-white/20 text-white/70 px-5 py-2.5 rounded-xl text-sm font-medium hover:border-white/40 hover:text-white transition-colors"
                        >
                          Browse all question sets
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-white/60 text-sm mb-4">Exam-standard practice questions across all topics.</p>
                      <Link
                        href="/practice-questions"
                        className="inline-flex items-center justify-center gap-2 bg-gold-500 text-navy-950 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-gold-400 transition-colors"
                      >
                        Browse practice questions
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Author + reviewed bar — always visible */}
              <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {article.author?.name && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-navy-950 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Written by</p>
                      <p className="text-sm font-semibold text-navy-950">{article.author.name}</p>
                    </div>
                  </div>
                )}
                {formattedReviewed && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <svg className="w-4 h-4 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Last reviewed by a qualified accountant on
                    <span className="text-slate-600 font-medium ml-1">{formattedReviewed}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="lg:sticky lg:top-24 space-y-6">

              {/* Article details card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                  Article details
                </p>
                <dl className="space-y-3">
                  {article.examBody && article.examBody.length > 0 && (
                    <div className="flex justify-between text-sm gap-2">
                      <dt className="text-slate-500 shrink-0">Qualification</dt>
                      <dd className="flex flex-wrap gap-1 justify-end">
                        {article.examBody.map((body: string) => {
                          const bc = EXAM_BODY_BADGE[body.toUpperCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                          return (
                            <span key={body} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${bc}`}>
                              {body.toUpperCase()}
                            </span>
                          )
                        })}
                      </dd>
                    </div>
                  )}
                  {article.categoryTitle && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Subject</dt>
                      <dd className="text-navy-950 font-medium">{article.categoryTitle}</dd>
                    </div>
                  )}
                  {article.readTime && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Read time</dt>
                      <dd className="text-navy-950 font-medium">{article.readTime} minutes</dd>
                    </div>
                  )}

                  {formattedReviewed && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Reviewed</dt>
                      <dd className="text-teal-700 font-medium">{formattedReviewed}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Practice questions CTA */}
              <div className="bg-navy-950 rounded-xl p-5 relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }}
                />
                <div className="relative z-10">
                  <p className="font-display text-white text-base mb-2 leading-snug">
                    Test your knowledge
                  </p>
                  {article.mcqUrl ? (
                    <>
                      <p className="text-white/55 text-xs leading-relaxed mb-3">
                        Practice questions for this exact topic.
                      </p>
                      <Link
                        href={article.mcqUrl}
                        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors mb-2"
                      >
                        Practice this topic
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Link>
                      <Link
                        href="/practice-questions"
                        className="flex items-center justify-center w-full h-9 rounded-lg text-xs font-medium border border-white/20 text-white/60 hover:border-white/40 hover:text-white transition-colors"
                      >
                        Browse all question sets
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-white/55 text-xs leading-relaxed mb-3">
                        Exam-standard practice questions on this topic.
                      </p>
                      <Link
                        href="/practice-questions"
                        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors"
                      >
                        Browse questions
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Back link */}
              <Link
                href="/articles"
                className="flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Back to all articles
              </Link>

            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
