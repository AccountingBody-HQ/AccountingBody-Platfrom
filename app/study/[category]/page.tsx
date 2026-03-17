// app/study/[category]/[slug]/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getArticleBySlug, getAllArticlePaths, resolveCanonicalUrl } from '@/lib/sanity-queries'
import type { ArticleFull } from '@/lib/sanity-queries'
import PortableTextRenderer from '@/components/PortableTextRenderer'
import ArticleCard from '@/components/ArticleCard'

export async function generateStaticParams() {
  const paths = await getAllArticlePaths()
  return paths.map(({ category, slug }) => ({ category, slug }))
}

export async function generateMetadata({ params }: { params: { category: string; slug: string } }): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug)
  if (!article) return {}
  const canonicalUrl = resolveCanonicalUrl(article)
  return {
    title:       `${article.title} | AccountingBody`,
    description: article.excerpt,
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      title:       article.title,
      description: article.excerpt,
      type:        'article',
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
    },
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

function QuestionTypeButtons({ article }: { article: ArticleFull }) {
  const buttons = [
    {
      condition: !!article.mcqUrl,
      href:      article.mcqUrl ?? '',
      label:     'Multiple Choice Questions',
      sublabel:  'Test your recall',
      iconBg:    'bg-navy-50',
      iconColor: 'text-navy-700',
      accent:    'border-navy-200 hover:border-navy-400',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      condition: !!article.learningUrl,
      href:      article.learningUrl ?? '',
      label:     'Learn More',
      sublabel:  'Deepen your understanding',
      iconBg:    'bg-gold-50',
      iconColor: 'text-gold-600',
      accent:    'border-gold-200 hover:border-gold-400',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      condition: !!article.shortQuestionsUrl,
      href:      article.shortQuestionsUrl ?? '',
      label:     'Short Writing Questions',
      sublabel:  'Practise written answers',
      iconBg:    'bg-slate-100',
      iconColor: 'text-slate-600',
      accent:    'border-slate-200 hover:border-slate-400',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    {
      condition: !!article.scenarioUrl,
      href:      article.scenarioUrl ?? '',
      label:     'Scenario-Based Questions',
      sublabel:  'Apply to case studies',
      iconBg:    'bg-purple-50',
      iconColor: 'text-purple-700',
      accent:    'border-purple-200 hover:border-purple-400',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
    },
  ]

  const visible = buttons.filter(b => b.condition)
  if (visible.length === 0) return null

  return (
    <div className="mt-12 pt-10 border-t border-slate-200">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-5">
        Continue Learning
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visible.map(btn => (
          
            key={btn.label}
            href={btn.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-4 p-4 rounded-xl border bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${btn.accent}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${btn.iconBg} ${btn.iconColor}`}>
              {btn.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy-950 group-hover:text-navy-700 transition-colors leading-snug">
                {btn.label}
              </p>
              <p className="text-xs text-slate-400">{btn.sublabel}</p>
            </div>
            <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  )
}

function AuthorBio({ article }: { article: ArticleFull }) {
  if (!article.author?.name) return null
  const { name, bio, qualifications, image } = article.author
  return (
    <div className="mt-10 p-6 rounded-xl bg-navy-50 border border-navy-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-navy-200 flex items-center justify-center">
          {image?.asset?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.asset.url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-lg text-navy-700 font-bold">{name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-navy-500 uppercase tracking-widest mb-1">Written by</p>
          <p className="font-display text-base font-semibold text-navy-950">
            {name}
            {qualifications && <span className="text-navy-500 font-normal ml-2 text-sm">{qualifications}</span>}
          </p>
          {bio && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{bio}</p>}
        </div>
      </div>
    </div>
  )
}

export default async function ArticlePage({ params }: { params: { category: string; slug: string } }) {
  const article = await getArticleBySlug(params.slug)
  if (!article) notFound()

  const accentBar  = EXAM_BODY_ACCENT[article.examBody ?? ''] ?? 'bg-navy-950'
  const badgeClass = EXAM_BODY_BADGE[article.examBody ?? '']  ?? 'bg-slate-100 text-slate-600 border-slate-200'

  const formattedPublished = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const formattedReviewed = article.lastReviewed
    ? new Date(article.lastReviewed).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const canonicalUrl = resolveCanonicalUrl(article)
  const isSyndicated = !!canonicalUrl

  return (
    <div>
      <section className="relative overflow-hidden bg-navy-950 py-14 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }}
          />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <Link href="/study" className="hover:text-white/70 transition-colors">Study</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <Link href={`/study/${params.category}`} className="hover:text-white/70 transition-colors">
              {params.category.toUpperCase()}
            </Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white/70 line-clamp-1">{article.title}</span>
          </nav>

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

          <h1 className="font-display text-white text-3xl md:text-4xl lg:text-5xl leading-tight mb-6 max-w-4xl" style={{ letterSpacing: '-0.02em' }}>
            {article.title}
          </h1>

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

      <div className={`h-1 w-full ${accentBar}`} />

      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12 items-start">
            <div>
              {isSyndicated && (
                <div className="mb-8 flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    The original version of this article is published on{' '}
                    <a href={canonicalUrl!} className="font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors" target="_blank" rel="noopener noreferrer">
                      {article.canonicalOwner === 'globalpayrollexpert' ? 'GlobalPayrollExpert.com' : article.canonicalOwner === 'ethiotax' ? 'EthioTax.com' : canonicalUrl!}
                    </a>.
                  </p>
                </div>
              )}

              {article.excerpt && (
                <p className="text-lg text-slate-600 leading-relaxed mb-8 pb-8 border-b border-slate-200 font-medium">
                  {article.excerpt}
                </p>
              )}

              <PortableTextRenderer value={article.body} />

              {formattedReviewed && (
                <div className="mt-10 flex items-center gap-2 text-sm text-slate-400 pt-6 border-t border-slate-100">
                  <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Last reviewed by a qualified accountant on{' '}
                  <span className="text-slate-600 font-medium">{formattedReviewed}</span>
                </div>
              )}

              <AuthorBio article={article} />
              <QuestionTypeButtons article={article} />
            </div>

            <aside className="lg:sticky lg:top-24 space-y-6">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Article details</p>
                <dl className="space-y-3">
                  {article.examBody && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Qualification</dt>
                      <dd><span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>{article.examBody}</span></dd>
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

              <div className="bg-navy-950 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
                <div className="relative z-10">
                  <p className="font-display text-white text-base mb-2 leading-snug">Test your knowledge</p>
                  <p className="text-white/55 text-xs leading-relaxed mb-4">Exam-standard practice questions on this topic.</p>
                  <Link href="/practice" className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors">
                    Browse questions
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              </div>

              <Link href={`/study/${params.category}`} className="flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                All {params.category.toUpperCase()} notes
              </Link>
            </aside>
          </div>
        </div>
      </section>

      {article.relatedArticles && article.relatedArticles.length > 0 && (
        <section className="section bg-slate-50 border-t border-slate-200">
          <div className="container-site">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div>
                <span className="eyebrow mb-3 block">Keep studying</span>
                <h2 className="section-title">Related articles</h2>
              </div>
              <Link href={`/study/${params.category}`} className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-gold-500 transition-colors whitespace-nowrap">
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {article.relatedArticles.slice(0, 3).map(related => (
                <ArticleCard key={related._id} article={related} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}