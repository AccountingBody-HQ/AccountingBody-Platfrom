// app/study/[category]/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { getArticlesByCategory, getAllCategorySlugs } from '@/lib/sanity-queries'
import type { ArticleSummary } from '@/lib/sanity-queries'

const EXAM_BODY_META: Record<string, {
  name: string; description: string; accent: string; badgeBg: string; badgeText: string
}> = {
  acca:  { name: 'ACCA',  description: 'Association of Chartered Certified Accountants study notes — all 13 papers.',        accent: 'bg-[#004B8D]', badgeBg: 'bg-blue-50',    badgeText: 'text-[#004B8D]' },
  cima:  { name: 'CIMA',  description: 'Chartered Institute of Management Accountants — Operational, Management, Strategic.', accent: 'bg-[#0081C6]', badgeBg: 'bg-sky-50',     badgeText: 'text-[#0081C6]' },
  aat:   { name: 'AAT',   description: 'Association of Accounting Technicians — Levels 2 through 4.',                        accent: 'bg-[#00857A]', badgeBg: 'bg-teal-50',    badgeText: 'text-teal-700'  },
  icaew: { name: 'ICAEW', description: 'Institute of Chartered Accountants in England and Wales — ACA qualification.',       accent: 'bg-[#8B0000]', badgeBg: 'bg-red-50',     badgeText: 'text-red-800'   },
  att:   { name: 'ATT',   description: 'Association of Taxation Technicians — core and elective papers.',                    accent: 'bg-[#6B21A8]', badgeBg: 'bg-purple-50',  badgeText: 'text-purple-800'},
  cpa:   { name: 'CPA',   description: 'Certified Public Accountant — FAR, AUD, REG, BAR/TCP sections.',                    accent: 'bg-[#1D4ED8]', badgeBg: 'bg-blue-50',    badgeText: 'text-blue-800'  },
  cipfa: { name: 'CIPFA', description: 'Chartered Institute of Public Finance and Accountancy.',                             accent: 'bg-[#065F46]', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-800'},
  cta:   { name: 'CTA',   description: 'Chartered Tax Adviser — the gold standard for UK tax professionals.',                accent: 'bg-[#B45309]', badgeBg: 'bg-amber-50',   badgeText: 'text-amber-800' },
}

function getCategoryDisplay(slug: string) {
  return EXAM_BODY_META[slug.toLowerCase()] ?? {
    name:        slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: `Study notes and articles on ${slug.replace(/-/g, ' ')}.`,
    accent:      'bg-navy-950',
    badgeBg:     'bg-navy-50',
    badgeText:   'text-navy-700',
  }
}

function groupAlphabetically(
  articles: ArticleSummary[],
): { letter: string; articles: ArticleSummary[] }[] {
  const map = new Map<string, ArticleSummary[]>()
  for (const article of articles) {
    const letter = article.title.charAt(0).toUpperCase()
    if (!map.has(letter)) map.set(letter, [])
    map.get(letter)!.push(article)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, articles]) => ({ letter, articles }))
}

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs()
  return slugs.map(category => ({ category }))
}

export async function generateMetadata({
  params,
}: {
  params: { category: string }
}): Promise<Metadata> {
  const meta = getCategoryDisplay(params.category)
  return {
    title:       `${meta.name} Study Notes | AccountingBody`,
    description: meta.description,
  }
}

export default async function CategoryPage({
  params,
}: {
  params: { category: string }
}) {
  const { category } = params
  const meta         = getCategoryDisplay(category)
  const articles     = await getArticlesByCategory(category)
  const groups       = groupAlphabetically(articles)
  const letters      = groups.map(g => g.letter)

  return (
    <>
      {/* HEADER */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
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
            <span className="text-white/70">{meta.name}</span>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <span className={`inline-block text-sm font-bold px-3 py-1 rounded-md mb-4 ${meta.badgeBg} ${meta.badgeText}`}>
                {meta.name}
              </span>
              <h1 className="font-display text-white text-4xl md:text-5xl leading-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
                {meta.name} Study Notes
              </h1>
              <p className="text-white/60 text-lg leading-relaxed max-w-xl">
                {meta.description}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-4xl text-white">{articles.length.toLocaleString()}</p>
              <p className="text-white/50 text-sm">articles &amp; study notes</p>
            </div>
          </div>
        </div>
      </section>

      {/* ALPHABET JUMP NAV */}
      {letters.length > 0 && (
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="container-site py-3">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs font-semibold text-slate-400 mr-2 shrink-0">Jump to:</span>
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => {
                const active = letters.includes(l)
                return (
                  
                    key={l}
                    href={active ? `#letter-${l}` : undefined}
                    aria-disabled={!active}
                    className={[
                      'w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-colors',
                      active
                        ? 'bg-navy-50 text-navy-700 hover:bg-navy-950 hover:text-white cursor-pointer'
                        : 'text-slate-300 cursor-default',
                    ].join(' ')}
                  >
                    {l}
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ARTICLE INDEX */}
      <section className="section bg-slate-50">
        <div className="container-site">
          {articles.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-navy-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-3">Articles coming soon</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                We are publishing study notes for {meta.name} shortly. Check back soon or browse another qualification.
              </p>
              <Link
                href="/study"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
              >
                ← Back to Study
              </Link>
            </div>
          ) : (
            <div className="space-y-12">
              {groups.map(({ letter, articles: groupArticles }) => (
                <div key={letter} id={`letter-${letter}`} className="scroll-mt-16">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-11 h-11 rounded-xl bg-navy-950 flex items-center justify-center shrink-0">
                      <span className="font-display text-xl text-white font-bold">{letter}</span>
                    </div>
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium shrink-0">
                      {groupArticles.length} {groupArticles.length === 1 ? 'article' : 'articles'}
                    </span>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {groupArticles.map(article => {
                      const href = `/study/${category}/${article.slug.current}`
                      const formattedDate = article.lastReviewed
                        ? new Date(article.lastReviewed).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                        : article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                        : null
                      return (
                        <div
                          key={article._id}
                          className="group flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${meta.accent}`} />
                            <div className="min-w-0">
                              <Link href={href}>
                                <h3 className="text-sm font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
                                  {article.title}
                                </h3>
                              </Link>
                              {article.excerpt && (
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1 leading-relaxed">
                                  {article.excerpt}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400">
                            {article.readTime && <span className="hidden sm:block">{article.readTime} min</span>}
                            {formattedDate && <span className="hidden md:block">{formattedDate}</span>}
                            <svg
                              className="w-4 h-4 text-slate-300 group-hover:text-navy-400 group-hover:translate-x-0.5 transition-all"
                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}