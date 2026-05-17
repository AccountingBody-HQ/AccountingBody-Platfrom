import Link from 'next/link'

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const DATASET    = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

export const dynamic = 'force-dynamic'

export const metadata = {
  title:       'Articles | Accounting Body',
  description: 'Study notes and articles for ACCA, CIMA, ICAEW, and AAT.',
}

interface ArticleSummary {
  _id:          string
  title:        string
  slug:         { current: string }
  excerpt?:     string
  examBody?:    string
  readTime?:    number
  publishedAt?: string
}

const EXAM_BODY_BADGE: Record<string, string> = {
  acca:  'bg-blue-50 text-[#004B8D] border-blue-200',
  cima:  'bg-sky-50 text-[#0081C6] border-sky-200',
  aat:   'bg-teal-50 text-teal-700 border-teal-200',
  icaew: 'bg-red-50 text-red-800 border-red-200',
}

async function getArticles(): Promise<ArticleSummary[]> {
  try {
    if (!PROJECT_ID) return []
    const query = encodeURIComponent(
      '*[_type == "article" && "accountingbody" in showOnSites] | order(publishedAt desc) [0...50] { _id, title, slug, excerpt, examBody, readTime, publishedAt }'
    )
    const token = process.env.SANITY_API_TOKEN
    const res = await fetch(
      `https://${PROJECT_ID}.api.sanity.io/v2023-05-03/data/query/${DATASET}?query=${query}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

export default async function ArticlesPage() {
  const articles = await getArticles()

  return (
    <div>
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Articles</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Study Notes</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">Articles &amp; Study Notes</h1>
          <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
            Written and reviewed by qualified accountants for ACCA, CIMA, ICAEW, and AAT.
          </p>
        </div>
      </section>

      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <p className="text-sm text-slate-500">{articles.length} articles</p>
            <Link href="/study" className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
              Browse by qualification
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>

          {articles.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-24">
              <h2 className="font-display text-2xl text-navy-950 mb-3">Articles coming soon</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">Browse by qualification in the meantime.</p>
              <Link href="/study" className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                Browse Study Notes
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {articles.map(article => {
                const examBodyFirst = Array.isArray(article.examBody) ? article.examBody[0] : article.examBody
                const examBodyKey = examBodyFirst?.toLowerCase() ?? ''
                const badgeClass = EXAM_BODY_BADGE[examBodyKey] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                const href = examBodyFirst
                  ? `/study/${examBodyFirst.toLowerCase()}/${article.slug.current}`
                  : `/articles/${article.slug.current}`
                const posted = article.publishedAt
                  ? new Date(article.publishedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                  : null
                return (
                  <div key={article._id} className="group flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-navy-950" />
                      <div className="min-w-0">
                        <Link href={href}>
                          <h3 className="text-sm font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">{article.title}</h3>
                        </Link>
                        {article.excerpt && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{article.excerpt}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {examBodyFirst && (
                        <span className={"hidden text-xs font-medium px-2 py-0.5 rounded-md border " + badgeClass}>
                          {examBodyFirst.toUpperCase()}
                        </span>
                      )}
                      {article.readTime && <span className="hidden md:block text-xs text-slate-400">{article.readTime} min</span>}
                      {posted && <span className="hidden text-xs text-slate-400">{posted}</span>}
                      <svg className="w-4 h-4 text-slate-300 group-hover:text-navy-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
