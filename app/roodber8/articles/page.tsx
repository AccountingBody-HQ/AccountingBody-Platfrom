import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import AutoRefresh from '@/components/roodber8/AutoRefresh'
import { createClient } from '@supabase/supabase-js'
import { FileText, Sparkles, ExternalLink, FileJson, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface ArticleRow {
  id:             string
  title:          string
  slug:           string
  content_id:     string | null
  category:       string | null
  category_title: string | null
  exam_body:      string[] | null
  status:         string | null
  show_on_sites:  string[] | null
  platform:       string | null
  published_at:   string | null
  created_at:     string | null
  author_name:    string | null
  read_time:      number | null
  difficulty:     string | null
}

const C = {
  card:    { background: '#0d1424', border: '1px solid #1a2238', borderRadius: 16 },
  idle:    { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' },
  success: { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' },
}

const DIFF_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.08)',  color: '#10b981', border: 'rgba(16,185,129,0.2)'  },
  intermediate: { bg: 'rgba(245,158,11,0.08)',  color: '#f59e0b', border: 'rgba(245,158,11,0.2)'  },
  advanced:     { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', border: 'rgba(239,68,68,0.2)'   },
}

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))
const PAGE_SIZE = 50

async function getArticles(safeSearch: string, letter: string, page: number) {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  let listQuery = supabase
    .from('articles')
    .select('id, title, slug, content_id, category, category_title, exam_body, status, show_on_sites, platform, published_at, created_at, author_name, read_time, difficulty')
    .order('created_at', { ascending: false })
    .range(from, to)

  let countQuery = supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })

  if (safeSearch) {
    listQuery  = listQuery.ilike('title', `%${safeSearch}%`)
    countQuery = countQuery.ilike('title', `%${safeSearch}%`)
  }
  if (letter) {
    listQuery  = listQuery.ilike('title', `${letter}%`)
    countQuery = countQuery.ilike('title', `${letter}%`)
  }

  const [{ data: articles }, { count: filteredCount }] = await Promise.all([
    listQuery,
    countQuery,
  ])

  return {
    articles: (articles ?? []) as ArticleRow[],
    filteredCount: filteredCount ?? 0,
  }
}

export default async function ArticlesLibraryPage({
  searchParams,
}: {
  searchParams?: { search?: string; letter?: string; page?: string }
}) {
  const search = searchParams?.search ?? ''
  const letter = searchParams?.letter ?? ''
  const safeSearch = search.replace(/[,()%]/g, '')
  const safeLetter = letter.replace(/[,()%]/g, '').slice(0, 1).toUpperCase()

  const pageParam = parseInt(searchParams?.page ?? '1', 10)
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  const [
    { articles, filteredCount },
    { count: total },
    { count: publishedCount },
    { count: draftCount },
    { count: abContainsCount },
    { count: bothSitesCount },
  ] = await Promise.all([
    getArticles(safeSearch, safeLetter, page),
    supabase.from('articles').select('*', { count: 'exact', head: true }),
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .contains('show_on_sites', ['ab']),
    supabase.from('articles').select('*', { count: 'exact', head: true })
      .contains('show_on_sites', ['ab', 'et']),
  ])

  const abOnlyCount = (abContainsCount ?? 0) - (bothSitesCount ?? 0)

  const { data: linkedSlugsData } = await supabase
    .from('question_sets')
    .select('article_slug')
    .not('article_slug', 'is', null)

  const linkedArticleSlugs = new Set<string>(
    (linkedSlugsData ?? []).map(r => r.article_slug as string)
  )
  const pqLinkedCount = linkedArticleSlugs.size
  const noLinkedCount = (total ?? 0) - pqLinkedCount

  const totalPages = Math.ceil(filteredCount / PAGE_SIZE)
  const isFiltered = !!(safeSearch || safeLetter)

  const STATS = [
    { label: 'Total Articles', value: total ?? 0,           color: '#D4A017', bg: 'rgba(212,160,23,0.08)', border: 'rgba(212,160,23,0.2)' },
    { label: 'Published',      value: publishedCount ?? 0,  color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { label: 'Draft',          value: draftCount ?? 0,      color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
    { label: 'AB Only',        value: abOnlyCount,          color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
    { label: 'Both Sites',     value: bothSitesCount ?? 0,  color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)' },
    { label: 'PQ Linked',      value: pqLinkedCount,        color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
    { label: 'No PQ',          value: noLinkedCount,        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  ]

  const prevPage = page > 1 ? page - 1 : null
  const nextPage = page < totalPages ? page + 1 : null

  function pageHref(p: number) {
    const params = new URLSearchParams()
    if (safeSearch) params.set('search', safeSearch)
    if (safeLetter) params.set('letter', safeLetter)
    params.set('page', String(p))
    return `/roodber8/articles?${params.toString()}`
  }

  function pageNumbers(): (number | '…')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages = new Set<number>([1, totalPages, page])
    for (let d = 1; d <= 2; d++) {
      if (page - d >= 1) pages.add(page - d)
      if (page + d <= totalPages) pages.add(page + d)
    }
    const sorted = Array.from(pages).sort((a, b) => a - b)
    const withGaps: (number | '…')[] = []
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) withGaps.push('…')
      withGaps.push(sorted[i])
    }
    return withGaps
  }

  return (
    <div className="p-8">
      <AutoRefresh />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212,160,23,0.12)' }}>
            <FileText size={20} style={{ color: '#D4A017' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Articles</h1>
            <p className="text-sm" style={{ color: '#475569' }}>Manage, edit, and import study content</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/roodber8/articles/import"
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
            style={{ background: 'rgba(212,160,23,0.12)', color: '#D4A017', border: '1px solid #D4A017' }}>
            <FileJson size={15} /> Import JSON
          </Link>
          <Link href="/roodber8/content-factory"
            className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
            style={{ background: '#D4A017', color: '#0C1A3D' }}>
            <Sparkles size={15} /> Generate
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-7 gap-4 mb-6">
        {STATS.map(s => (
          <div key={s.label} className="rounded-2xl border p-5"
            style={{ background: s.bg, borderColor: s.border }}>
            <p className="text-3xl font-black mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* A–Z Filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link href="/roodber8/articles"
          className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
          style={!safeLetter
            ? { background: '#D4A017', color: '#0C1A3D' }
            : { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#475569' }}>
          All
        </Link>
        {ALPHABET.map(l => (
          <Link key={l} href={`/roodber8/articles?letter=${l}`}
            className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
            style={safeLetter === l
              ? { background: '#D4A017', color: '#0C1A3D' }
              : { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#475569' }}>
            {l}
          </Link>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-2xl border p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ background: '#0d1424', borderColor: '#1a2238' }}>
        <form method="GET" className="flex items-center gap-3 flex-wrap flex-1">
          <div className="flex items-center gap-2 flex-1 min-w-48 rounded-xl px-3 py-2"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <Search size={13} style={{ color: '#475569' }} />
            <input name="search" defaultValue={safeSearch} placeholder="Search by title..."
              className="bg-transparent text-white text-sm flex-1 focus:outline-none placeholder-slate-600"
              style={{ minWidth: 0 }} />
          </div>
          <button type="submit"
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: '#0C1A3D', color: '#ffffff', border: '1px solid #D4A017' }}>
            Search
          </button>
          {(safeSearch || safeLetter) && (
            <Link href="/roodber8/articles" className="text-xs font-semibold" style={{ color: '#475569' }}>Clear</Link>
          )}
        </form>
      </div>

      {/* Article list */}
      <div className="rounded-2xl border overflow-hidden" style={C.card}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#1a2238' }}>
          <h2 className="text-white font-bold text-sm">
            {safeLetter ? `Articles starting with '${safeLetter}'` : safeSearch ? `Search results for '${safeSearch}'` : 'All Articles'}
          </h2>
          <span className="text-xs font-semibold" style={{ color: '#475569' }}>
            {isFiltered ? `Showing ${articles.length} of ${filteredCount}` : `${filteredCount} articles`}
          </span>
        </div>

        {articles.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <FileText size={32} style={{ color: '#1a2238' }} className="mx-auto mb-4" />
            <p className="text-white font-semibold mb-2">No articles yet</p>
            <p className="text-sm mb-6" style={{ color: '#334155' }}>
              {(safeSearch || safeLetter) ? 'No articles match your search.' : 'Import your first article using the button above.'}
            </p>
            <Link href="/roodber8/articles/import"
              className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl"
              style={{ background: '#D4A017', color: '#0C1A3D' }}>
              <FileJson size={14} /> Import JSON
            </Link>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#1a2238' }}>
            {articles.map(article => {
              const diff = article.difficulty ? DIFF_STYLE[article.difficulty] ?? DIFF_STYLE.intermediate : null
              const examBody = article.exam_body?.[0] ?? ''
              const isPqLinked = article.slug ? linkedArticleSlugs.has(article.slug) : false
              return (
                <div key={article.id} className="px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{article.title || 'Untitled'}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {(article.category_title || article.category) && (
                        <span className="text-xs" style={{ color: '#475569' }}>
                          {article.category_title || article.category}
                        </span>
                      )}
                      {article.author_name && (
                        <span className="text-xs" style={{ color: '#475569' }}>{article.author_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                      style={article.status === 'published' ? C.success : C.idle}>
                      {article.status ?? 'draft'}
                    </span>
                    {examBody && (
                      <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017' }}>
                        {examBody}
                      </span>
                    )}
                    {diff && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                        style={{ background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
                        {article.difficulty}
                      </span>
                    )}
                    {article.read_time != null && (
                      <span className="text-xs" style={{ color: '#475569' }}>{article.read_time} min read</span>
                    )}
                    {article.content_id && (
                      <span
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1f2937', color: '#475569', fontFamily: 'monospace', fontSize: '10px', padding: '2px 6px', borderRadius: 6 }}>
                        {article.content_id}
                      </span>
                    )}
                    {isPqLinked ? (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                        PQ ✓
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' }}>
                        No PQ
                      </span>
                    )}
                    <Link href={`/roodber8/articles/${article.id}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      style={{ background: 'rgba(212,160,23,0.1)', color: '#D4A017', border: '1px solid rgba(212,160,23,0.2)' }}>
                      Manage
                    </Link>
                    {article.slug && (
                      <a href={(() => {
                          const body = article.exam_body?.[0]
                          return body
                            ? `/study/${body.toLowerCase()}/${article.slug}`
                            : `/articles/${article.slug}`
                        })()} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium flex items-center gap-1" style={{ color: '#2563eb' }}>
                        View <ExternalLink size={10} />
                      </a>
                    )}
                    <span className="text-xs" style={{ color: '#334155' }}>
                      {article.created_at
                        ? new Date(article.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: '#1a2238' }}>
            <span className="text-xs" style={{ color: '#475569' }}>
              Page {page} of {totalPages} · {filteredCount} articles
            </span>
            <div className="flex items-center gap-2">
              {prevPage ? (
                <Link href={pageHref(prevPage)}
                  className="text-xs font-semibold px-4 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
                  Prev
                </Link>
              ) : (
                <span className="text-xs font-semibold px-4 py-2 rounded-xl opacity-40 cursor-default"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#64748b' }}>
                  Prev
                </span>
              )}

              <div className="flex items-center gap-1.5">
                {pageNumbers().map((p, i) =>
                  p === '…' ? (
                    <span key={`gap-${i}`} className="text-xs" style={{ color: '#334155' }}>…</span>
                  ) : (
                    <Link key={p} href={pageHref(p)}
                      className="text-xs font-semibold w-8 h-8 rounded-lg flex items-center justify-center"
                      style={p === page
                        ? { background: '#D4A017', color: '#0C1A3D' }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937', color: '#475569' }}>
                      {p}
                    </Link>
                  )
                )}
              </div>

              {nextPage ? (
                <Link href={pageHref(nextPage)}
                  className="text-xs font-bold px-4 py-2 rounded-xl"
                  style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}>
                  Next
                </Link>
              ) : (
                <span className="text-xs font-bold px-4 py-2 rounded-xl opacity-40 cursor-default"
                  style={{ background: '#0C1A3D', color: '#fff', border: '1px solid #D4A017' }}>
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
