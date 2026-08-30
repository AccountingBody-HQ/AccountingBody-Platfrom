import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

interface ArticleSummary {
  id:            string
  title:         string
  slug:          string
  excerpt?:      string
  exam_body?:    string[]
  published_at?: string
}

async function getArticles(siteCode: string): Promise<ArticleSummary[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, exam_body, published_at')
      .eq('status', 'published')
      .contains('show_on_sites', [siteCode])
      .order('published_at', { ascending: false })
      .limit(100)
    if (error || !data) return []
    return data as ArticleSummary[]
  } catch {
    return []
  }
}

export default async function ArticlesPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const siteCode = isEthioTax ? 'et' : 'ab'
  const articles = await getArticles(siteCode)

  return (
    <div>
      <section className={`relative overflow-hidden py-16 md:py-20 ${isEthioTax ? 'bg-[#1A4731]' : 'bg-navy-950'}`}>
        {!isEthioTax && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
              style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          </div>
        )}
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Articles</span>
          </nav>
          {isEthioTax ? (
            <>
              <p className="text-[#C9982A] text-[11px] font-bold uppercase tracking-[0.12em] mb-4">Daily Digest</p>
              <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">Latest from EthioTax</h1>
              <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
                Industry updates, tax briefs, accounting news and insights — curated for Ethiopian finance professionals and the diaspora.
              </p>
            </>
          ) : (
            <>
              <p className="text-gold-400 text-[11px] font-bold uppercase tracking-[0.12em] mb-4">Daily Digest</p>
              <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">Latest from Accounting Body</h1>
              <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
                Industry updates, accounting news, finance briefs and the latest insights — all in one place.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
            <p className="text-sm text-slate-500">{articles.length} articles</p>
            <Link href={isEthioTax ? '/study/eticpa' : '/study'}
              className={`inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold transition-colors ${isEthioTax ? 'bg-[#1A4731] text-white hover:bg-[#15382a]' : 'bg-navy-950 text-white hover:bg-navy-900'}`}>
              {isEthioTax ? 'Browse ETICPA modules' : 'Browse by qualification'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>

          {articles.length === 0 ? (
            <div className="max-w-md mx-auto text-center py-24">
              <h2 className="font-display text-2xl text-navy-950 mb-3">Articles coming soon</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">Browse by qualification in the meantime.</p>
              <Link href={isEthioTax ? '/study/eticpa' : '/study'}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors">
                Browse Study Notes
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {articles.map(article => {
                const examBodyFirst = Array.isArray(article.exam_body) ? article.exam_body[0] : article.exam_body
                const href = examBodyFirst
                  ? `/study/${examBodyFirst.toLowerCase()}/${article.slug}`
                  : `/articles/${article.slug}`
                const posted = article.published_at
                  ? new Date(article.published_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                  : null
                return (
                  <div key={article.id} className="group flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isEthioTax ? 'bg-[#C9982A]' : 'bg-navy-950'}`} />
                      <div className="min-w-0">
                        <Link href={href}>
                          <h3 className="text-sm font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">{article.title}</h3>
                        </Link>
                        {article.excerpt && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{article.excerpt}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {posted && <span className="hidden md:block text-xs text-slate-400">{posted}</span>}
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
