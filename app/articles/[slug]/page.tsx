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
    title:       `${article.title} | AccountingBody`,
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
  ATT:   'bg-[#6B21A8]',
  CPA:   'bg-[#1D4ED8]',
  CIPFA: 'bg-[#065F46]',
  CTA:   'bg-[#B45309]',
}

const EXAM_BODY_BADGE: Record<string, string> = {
  ACCA:  'bg-blue-50 text-[#004B8D] border-blue-200',
  CIMA:  'bg-sky-50 text-[#0081C6] border-sky-200',
  AAT:   'bg-teal-50 text-teal-700 border-teal-200',
  ICAEW: 'bg-red-50 text-red-800 border-red-200',
  ATT:   'bg-purple-50 text-purple-800 border-purple-200',
  CPA:   'bg-blue-50 text-blue-800 border-blue-200',
  CIPFA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CTA:   'bg-amber-50 text-amber-800 border-amber-200',
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  const accentBar  = EXAM_BODY_ACCENT[article.examBody ?? ''] ?? 'bg-navy-950'
  const badgeClass = EXAM_BODY_BADGE[article.examBody ?? '']  ?? 'bg-slate-100 text-slate-600 border-slate-200'

  const formattedPublished = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

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
            {article.examBody && (
              <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-md border ${badgeClass}`}>
                {article.examBody}
              </span>
            )}
            {article.category && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-white/10 text-white/70 border border-white/15">
                {article.category}
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
            {formattedPublished && (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formattedPublished}
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
                    const blocks = (article.body || []) as {_type: string; children?: {text?: string}[]}[]
                    const first = blocks[0]
                    if (first?._type === 'block' && first?.children) {
                      const firstText = first.children.map((c: {text?: string}) => c.text || '').join('').trim()
                      if (article.excerpt && firstText && article.excerpt.startsWith(firstText.substring(0, 80))) {
                        return blocks.slice(1)
                      }
                    }
                    return blocks
                  })()} />

              {article.mcqUrl && (
                <div className="mt-10 p-6 bg-blue-50 border border-blue-200 rounded-2xl">
                  <p className="font-display font-semibold text-navy-950 mb-1">Test your knowledge</p>
                  <p className="text-slate-600 text-sm mb-4">Practice questions for this topic.</p>
                  <a
                    href={article.mcqUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Multiple Choice Questions →
                  </a>
                </div>
              )}

              {formattedReviewed && (
                <div className="mt-10 flex items-center gap-2 text-sm text-slate-400 pt-6 border-t border-slate-100">
                  <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Last reviewed by a qualified accountant on
                  <span className="text-slate-600 font-medium ml-1">{formattedReviewed}</span>
                </div>
              )}
            </div>

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="lg:sticky lg:top-24 space-y-6">

              {/* Article details card */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                  Article details
                </p>
                <dl className="space-y-3">
                  {article.examBody && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Qualification</dt>
                      <dd>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                          {article.examBody}
                        </span>
                      </dd>
                    </div>
                  )}
                  {article.category && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Subject</dt>
                      <dd className="text-navy-950 font-medium">{article.category}</dd>
                    </div>
                  )}
                  {article.readTime && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Read time</dt>
                      <dd className="text-navy-950 font-medium">{article.readTime} minutes</dd>
                    </div>
                  )}
                  {formattedPublished && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Published</dt>
                      <dd className="text-navy-950 font-medium">{formattedPublished}</dd>
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
                  <p className="text-white/55 text-xs leading-relaxed mb-4">
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
