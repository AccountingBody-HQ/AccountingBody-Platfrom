// components/ArticleCard.tsx
import Link from 'next/link'
import type { ArticleSummary } from '@/lib/sanity-queries'

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
  ACCA:  'bg-blue-50  text-[#004B8D] border-blue-200',
  CIMA:  'bg-sky-50   text-[#0081C6] border-sky-200',
  AAT:   'bg-teal-50  text-teal-700  border-teal-200',
  ICAEW: 'bg-red-50   text-red-800   border-red-200',
  ATT:   'bg-purple-50 text-purple-800 border-purple-200',
  CPA:   'bg-blue-50  text-blue-800  border-blue-200',
  CIPFA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CTA:   'bg-amber-50 text-amber-800 border-amber-200',
}

interface Props {
  article:  ArticleSummary
  compact?: boolean
}

export default function ArticleCard({ article, compact = false }: Props) {
  const href = `/study/${article.examBody?.toLowerCase() ?? 'articles'}/${article.slug.current}`

  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  const accentBar  = EXAM_BODY_ACCENT[article.examBody ?? ''] ?? 'bg-navy-950'
  const badgeClass = EXAM_BODY_BADGE[article.examBody ?? '']  ?? 'bg-slate-100 text-slate-600 border-slate-200'

  if (compact) {
    return (
      <article className="group flex gap-3 py-3 border-b border-slate-100 last:border-0">
        <div className={`w-1 rounded-full shrink-0 mt-1 ${accentBar}`} />
        <div className="flex-1 min-w-0">
          <Link href={href}>
            <h4 className="text-sm font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors line-clamp-2">
              {article.title}
            </h4>
          </Link>
          {article.readTime && (
            <span className="text-xs text-slate-400 mt-0.5 block">{article.readTime} min read</span>
          )}
        </div>
      </article>
    )
  }

  return (
    <article className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className={`h-1 ${accentBar}`} />
      <div className="flex flex-col flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {article.examBody && (
            <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
              {article.examBody}
            </span>
          )}
          {article.category && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {article.category}
            </span>
          )}
        </div>

        <Link href={href} className="block mb-2 flex-1">
          <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
            {article.title}
          </h3>
        </Link>

        {article.excerpt && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
          <span className="text-xs text-slate-400">{formattedDate}</span>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            {article.readTime && (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
                </svg>
                {article.readTime} min
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}