// app/dictionary/page.tsx
// AccountingBody.com — Accounting Dictionary
// A-Z filtered view of all Sanity articles, browsable by first letter

import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'

interface SanityArticle {
  _id:          string
  title:        string
  slug:         { current: string }
  excerpt?:     string
  category?:    string
  examBody?:    string
  readTime?:    number
  publishedAt?: string
}

const LETTERS = [
  '#','A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
]

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { letter?: string }
}): Promise<Metadata> {
  const letter = searchParams.letter?.toUpperCase() ?? ''
  return {
    title: letter
      ? `Accounting Dictionary — ${letter} | AccountingBody`
      : 'Accounting Dictionary & Glossary | AccountingBody',
    description: letter
      ? `Browse accounting terms starting with ${letter} — definitions, study notes, and exam guides.`
      : 'Browse our complete accounting dictionary — 1,200+ terms explained clearly for students and professionals.',
  }
}

async function getArticlesByLetter(letter: string): Promise<SanityArticle[]> {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
    if (!projectId) return []
    let matchConditions: string
    if (letter === '#') {
      matchConditions = Array.from({ length: 10 }, (_, i) => `title match "${i}*"`).join(' || ')
    } else {
      const u = letter.toUpperCase()
      const l = letter.toLowerCase()
      matchConditions = `title match "${u}*" || title match "${l}*"`
    }
    const query = encodeURIComponent(
      `*[_type == "article" && (${matchConditions})] | order(title asc) { _id, title, slug, excerpt, category, examBody, readTime, publishedAt }`
    )
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}?query=${query}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

const PLACEHOLDER: Record<string, SanityArticle[]> = {
  A: [
    { _id:'a1', title:'Accruals Concept',        slug:{current:'accruals-concept'},        excerpt:'The accruals concept requires revenues and expenses to be recorded when earned or incurred, not when cash changes hands.',           category:'Financial Reporting', examBody:'ACCA',  readTime:6 },
    { _id:'a2', title:'Amortisation',             slug:{current:'amortisation'},             excerpt:'The systematic write-off of an intangible asset cost over its useful economic life.',                                           category:'Financial Reporting', examBody:'ACCA',  readTime:5 },
    { _id:'a3', title:'Audit Trail',              slug:{current:'audit-trail'},              excerpt:'A chronological record providing documentary evidence for every accounting entry.',                                                  category:'Auditing',           examBody:'ICAEW', readTime:4 },
    { _id:'a4', title:'Accounts Payable',         slug:{current:'accounts-payable'},         excerpt:'Amounts owed by a business to its suppliers for goods or services received but not yet paid for.',                                 category:'Bookkeeping',        examBody:'AAT',   readTime:4 },
    { _id:'a5', title:'Accounts Receivable',      slug:{current:'accounts-receivable'},      excerpt:'Money owed to a business by customers for goods delivered on credit that have not yet been paid.',                                 category:'Bookkeeping',        examBody:'AAT',   readTime:4 },
  ],
  D: [
    { _id:'d1', title:'Deferred Tax',             slug:{current:'deferred-tax'},             excerpt:'A tax liability or asset created by temporary differences between accounting profit and taxable profit.',                            category:'Taxation',           examBody:'ACCA',  readTime:8 },
    { _id:'d2', title:'Depreciation',             slug:{current:'depreciation'},             excerpt:'The systematic allocation of a tangible fixed asset cost over its expected useful economic life.',                               category:'Financial Reporting', examBody:'ACCA',  readTime:6 },
    { _id:'d3', title:'Double Entry Bookkeeping', slug:{current:'double-entry-bookkeeping'}, excerpt:'Every transaction has two equal and opposite effects — one debit and one credit.',                                                 category:'Bookkeeping',        examBody:'AAT',   readTime:7 },
  ],
  I: [
    { _id:'i1', title:'Impairment',               slug:{current:'impairment'},               excerpt:"Impairment occurs when an asset's carrying amount exceeds its recoverable amount, requiring a write-down.',                         category:'Financial Reporting', examBody:'ACCA',  ",readTime:7 },
    { _id:'i2', title:'Internal Controls',        slug:{current:'internal-controls'},        excerpt:'Processes implemented by management to safeguard assets, ensure accurate reporting, and promote operational efficiency.',           category:'Auditing',           examBody:'ICAEW', readTime:6 },
  ],
}

function LetterNav({ activeLetter }: { activeLetter: string }) {
  return (
    <nav aria-label="Dictionary alphabet navigation" className="flex flex-wrap gap-1.5">
      {LETTERS.map(letter => {
        const isActive = letter === activeLetter
        return (
          <Link
            key={letter}
            href={`/dictionary?letter=${letter}`}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-150',
              isActive
                ? 'bg-navy-950 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-navy-950 hover:text-navy-950 hover:bg-navy-50',
            ].join(' ')}
          >
            {letter}
          </Link>
        )
      })}
    </nav>
  )
}

function ArticleRow({ article }: { article: SanityArticle }) {
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
    : null
  return (
    <article className="group flex flex-col sm:flex-row sm:items-start gap-4 py-5 border-b border-slate-100 last:border-0">
      <div className="hidden sm:flex w-10 h-10 rounded-lg bg-navy-50 border border-navy-100 items-center justify-center shrink-0 mt-0.5">
        <span className="text-sm font-bold text-navy-700">{article.title.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          {article.category && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">{article.category}</span>
          )}
          {article.examBody && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-navy-50 text-navy-700 border border-navy-100">{article.examBody}</span>
          )}
          {formattedDate && <span className="text-xs text-slate-400">{formattedDate}</span>}
        </div>
        <Link href={`/articles/${article.slug.current}`} className="block mb-1.5">
          <h3 className="font-display text-base text-navy-950 group-hover:text-navy-600 transition-colors leading-snug">{article.title}</h3>
        </Link>
        {article.excerpt && (
          <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">{article.excerpt}</p>
        )}
      </div>
      <Link
        href={`/articles/${article.slug.current}`}
        className="shrink-0 self-start sm:self-center inline-flex items-center gap-1 text-xs font-semibold text-navy-700 hover:text-gold-500 transition-colors"
      >
        Read
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </article>
  )
}

export default async function DictionaryPage({
  searchParams,
}: {
  searchParams: { letter?: string }
}) {
  const rawLetter    = searchParams.letter?.toUpperCase() ?? ''
  const activeLetter = LETTERS.includes(rawLetter) ? rawLetter : ''

  let articles: SanityArticle[] = []
  if (activeLetter) {
    const fetched = await getArticlesByLetter(activeLetter)
    articles = fetched.length > 0 ? fetched : (PLACEHOLDER[activeLetter] ?? [])
  }

  const prevLetter = activeLetter ? LETTERS[LETTERS.indexOf(activeLetter) - 1] : null
  const nextLetter = activeLetter ? LETTERS[LETTERS.indexOf(activeLetter) + 1] : null

  return (
    <>
      {/* Header */}
      <section className="bg-navy-950 py-14 md:py-20">
        <div className="container-site">
          <div className="max-w-3xl">
            <span className="eyebrow text-gold-400 mb-4 block">Reference</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight">
              Accounting Dictionary
            </h1>
            <p className="text-white/60 text-lg leading-relaxed">
              Browse 1,200+ accounting and finance terms — clearly defined for students and professionals.
              Select a letter to get started.
            </p>
          </div>
        </div>
      </section>

      {/* Sticky A-Z nav */}
      <section className="bg-white border-b border-slate-200 py-4 sticky top-0 z-20 shadow-sm">
        <div className="container-site">
          <LetterNav activeLetter={activeLetter} />
        </div>
      </section>

      {/* Content */}
      <section className="section bg-slate-50 min-h-[60vh]">
        <div className="container-site">
          {!activeLetter ? (
            <div className="max-w-xl mx-auto text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-navy-50 border border-navy-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-3">Select a letter to browse</h2>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                Use the A–Z navigation above to browse accounting terms by their first letter, or visit the{" "}
                <Link href="/glossary" className="text-navy-700 font-semibold hover:text-gold-500 transition-colors">
                  Glossary hub
                </Link>{" "}
                for featured topics.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {['A','C','D','I','P','R'].map(l => (
                  <Link
                    key={l}
                    href={`/dictionary?letter=${l}`}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-sm font-bold text-navy-700 hover:bg-navy-950 hover:text-white hover:border-navy-950 transition-all"
                  >
                    {l}
                  </Link>
                ))}
              </div>
            </div>
          ) : articles.length === 0 ? (
            <div className="max-w-xl mx-auto text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
                <span className="font-display text-3xl text-slate-400">{activeLetter}</span>
              </div>
              <h2 className="font-display text-2xl text-navy-950 mb-3">No terms under &ldquo;{activeLetter}&rdquo; yet</h2>
              <p className="text-slate-500 leading-relaxed">
                We are continuously adding new content. Try another letter or{" "}
                <Link href="/glossary" className="text-navy-700 font-semibold hover:text-gold-500 transition-colors">browse the glossary</Link>.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl">
              <div className="flex items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-navy-950 flex items-center justify-center shrink-0">
                    <span className="font-display text-2xl text-white">{activeLetter}</span>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl text-navy-950 leading-none">
                      Terms starting with &ldquo;{activeLetter}&rdquo;
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {articles.length} {articles.length === 1 ? 'result' : 'results'}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-3 shrink-0">
                  {prevLetter && (
                    <Link href={`/dictionary?letter=${prevLetter}`} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-navy-950 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                      {prevLetter}
                    </Link>
                  )}
                  {nextLetter && (
                    <Link href={`/dictionary?letter=${nextLetter}`} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-navy-950 transition-colors">
                      {nextLetter}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-6 divide-y divide-slate-50">
                {articles.map(article => (
                  <ArticleRow key={article._id} article={article} />
                ))}
              </div>
              <div className="mt-10 pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-500 mb-4 font-medium">Continue browsing:</p>
                <LetterNav activeLetter={activeLetter} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-white border-t border-slate-200 py-8">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl text-navy-950">Looking for the full glossary?</p>
              <p className="text-sm text-slate-500 mt-0.5">Browse by topic, qualification, or featured terms.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/glossary" className="h-10 px-5 flex items-center text-sm font-medium rounded-lg border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors">
                View Glossary hub
              </Link>
              <Link href="/articles" className="h-10 px-5 flex items-center text-sm font-semibold rounded-lg bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm">
                All articles
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
