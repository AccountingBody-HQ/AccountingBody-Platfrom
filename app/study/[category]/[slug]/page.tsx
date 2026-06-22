import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getArticleBySlug, getAllArticlePaths, resolveCanonicalUrl } from '@/lib/sanity-queries'
import type { ArticleFull } from '@/lib/sanity-queries'
import PortableTextRenderer from '@/components/PortableTextRenderer'
import ArticleCard from '@/components/ArticleCard'

export async function generateStaticParams() {
  const paths = await getAllArticlePaths()
  return paths.map(({ category, slug }) => ({ category, slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return {}
  const canonicalUrl = resolveCanonicalUrl(article) ?? `https://accountingbody.com/articles/${article.slug.current}`
  return {
    title:       `${article.title} | Accounting Body`,
    description: article.excerpt,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: article.title, description: article.excerpt, type: 'article' },
  }
}

// ── Qualification accent colours ──────────────────────────────────────────────

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

// ── Author bio ────────────────────────────────────────────────────────────────

function AuthorBio({ article }: { article: ArticleFull }) {
  if (!article.author?.name) return null
  const { name, bio, qualifications, image } = article.author
  return (
    <div className="mt-10 p-6 rounded-xl bg-navy-50 border border-navy-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-navy-200 flex items-center justify-center">
          {image?.asset?.url
            ? <Image src={image.asset.url} alt={name} width={48} height={48} className="w-full h-full object-cover" />
            : <span className="font-display text-lg text-navy-700 font-bold" translate="no">{name.charAt(0).toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-navy-500 uppercase tracking-widest mb-1">Written by</p>
          <p className="font-display text-base font-semibold text-navy-950">
            {name}
            {qualifications && (
              <span className="text-navy-500 font-normal ml-2 text-sm">{qualifications}</span>
            )}
          </p>
          {bio && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{bio}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Practice question buttons ─────────────────────────────────────────────────

function QuestionButtons({ article }: { article: ArticleFull }) {
  const items = [
    { url: article.mcqUrl,            label: 'Multiple Choice Questions', sublabel: 'Test your recall',          bg: 'bg-navy-50',   color: 'text-navy-700',   border: 'border-navy-200 hover:border-navy-400'    },
    { url: article.learningUrl,       label: 'Learn More',                sublabel: 'Deepen your understanding', bg: 'bg-gold-50',   color: 'text-gold-600',   border: 'border-gold-200 hover:border-gold-400'    },
    { url: article.shortQuestionsUrl, label: 'Short Writing Questions',   sublabel: 'Practise written answers',  bg: 'bg-slate-100', color: 'text-slate-600',  border: 'border-slate-200 hover:border-slate-400'  },
    { url: article.scenarioUrl,       label: 'Scenario-Based Questions',  sublabel: 'Apply to case studies',     bg: 'bg-purple-50', color: 'text-purple-700', border: 'border-purple-200 hover:border-purple-400' },
  ].filter(b => !!b.url)

  if (items.length === 0) return null

  return (
    <div className="mt-12 pt-10 border-t border-slate-200">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-5">Continue Learning</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map(btn => (
          <a
            key={btn.label}
            href={btn.url!}
            target="_blank"
            rel="noopener noreferrer"
            className={`group flex items-center gap-4 p-4 rounded-xl border bg-white transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${btn.border}`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${btn.bg} ${btn.color}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="1.75" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ArticlePage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  const accentBar = EXAM_BODY_ACCENT[article.examBody?.[0]?.toUpperCase() ?? ''] ?? 'bg-navy-950'

  const formattedPublished = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null
  // Hidden — evergreen content should not show potentially outdated dates
  void formattedPublished

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
            <Link href="/study" className="hover:text-white/70 transition-colors">Study</Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <Link href={`/study/${category}`} className="hover:text-white/70 transition-colors">
              {category.toUpperCase()}
            </Link>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white/70 line-clamp-1">{article.title}</span>
          </nav>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {article.examBody?.map((body: string) => {
              const cls = EXAM_BODY_BADGE[body.toUpperCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200'
              return (
                <span key={body} className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-md border ${cls}`}>
                  <span translate="no">{body.toUpperCase()}</span>
                </span>
              )
            })}
            {article.category && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-white/10 text-white/70 border border-white/15">
                {article.category.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
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
                  Last reviewed by a qualified accountant on
                  <span className="text-slate-600 font-medium ml-1">{formattedReviewed}</span>
                </div>
              )}

              <AuthorBio article={article} />
              <QuestionButtons article={article} />
            </div>

            {/* ── Sidebar ─────────────────────────────────────────────────── */}
            <aside className="lg:sticky lg:top-24 space-y-6">

              {/* Article details */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                  Article details
                </p>
                <dl className="space-y-3">
                  {article.examBody?.length && (
                    <div className="flex justify-between items-start text-sm gap-2" translate="no">
                      <dt className="text-slate-500 shrink-0">Qualification</dt>
                      <dd className="flex flex-wrap gap-1 justify-end" translate="no">
                        {article.examBody.map((body: string) => {
                          const cls = EXAM_BODY_BADGE[body.toUpperCase()] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                          return <span key={body} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${cls}`} translate="no">{body.toUpperCase()}</span>
                        })}
                      </dd>
                    </div>
                  )}
                  {article.category && (
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-500">Subject</dt>
                      <dd className="text-navy-950 font-medium">{article.category.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</dd>
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

              {/* Practice questions CTA — dynamic */}
              <div className="bg-navy-950 rounded-xl p-5 relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }}
                />
                <div className="relative z-10">
                  <p className="font-display text-white text-base mb-2 leading-snug">Test your knowledge</p>
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
                        Topic-specific questions are being developed for this study note. Browse all available question sets in the meantime.
                      </p>
                      <Link
                        href="/practice-questions"
                        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors"
                      >
                        Browse question sets
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
                href={`/study/${category}`}
                className="flex items-center gap-2 text-sm text-navy-700 hover:text-gold-600 transition-colors font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                All {category.toUpperCase()} notes
              </Link>

            </aside>
          </div>
        </div>
      </section>

      {/* ── Related articles ──────────────────────────────────────────────── */}
      {article.relatedArticles && article.relatedArticles.length > 0 && (
        <section className="section bg-slate-50 border-t border-slate-200">
          <div className="container-site">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div>
                <span className="eyebrow mb-3 block">Keep studying</span>
                <h2 className="section-title">Related articles</h2>
              </div>
              <Link
                href={`/study/${category}`}
                className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-gold-500 transition-colors whitespace-nowrap"
              >
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

      {/* ── Jobs placement banner ─────────────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-white py-12">
        <div className="container-site">
          <div className="rounded-2xl overflow-hidden" style={{ background: '#C9982A' }}>
            <div className="relative px-8 py-10 md:px-12 md:py-12">
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="max-w-xl">
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(12,26,61,0.6)' }}>
                    {platformName} Recruitment
                  </p>
                  <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 leading-tight" style={{ color: brand, letterSpacing: '-0.02em' }}>
                    {article.examBody?.[0]
                      ? `Studying ${article.examBody[0].toUpperCase()} today? We place qualified ${article.examBody[0].toUpperCase()} professionals.`
                      : isEthioTax
                        ? 'Ready to take the next step? We place Ethiopian-origin finance professionals globally.'
                        : 'Ready to take the next step? We place qualified accountants and finance professionals.'}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(12,26,61,0.7)' }}>
                    {isEthioTax
                      ? 'Register once. We match you to roles and manage the introduction — you never approach employers directly.'
                      : 'Register once. We search our employer network on your behalf and manage every introduction.'}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                  <Link href="/jobs/find-work"
                    className="h-11 px-6 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                    style={{ background: brand, color: '#fff' }}>
                    Register as a Candidate
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </Link>
                  <Link href="/jobs/how-it-works"
                    className="h-11 px-6 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-80 border-2"
                    style={{ borderColor: brand, color: brand, background: 'transparent' }}>
                    How it works
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
