// app/glossary/page.tsx
// Accounting Body.com — Glossary Hub
// Main entry point — A-Z navigation, topic browsing, popular terms

import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getGlossaryCategories } from '@/lib/sanity-queries'

export const revalidate = 3600

// ── Metadata ──────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'Accounting Glossary | Accounting Body',
  description: 'Your complete reference for accounting and finance terminology. Browse 1,200+ terms by letter or topic — written and reviewed by qualified accountants.',
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LETTERS = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
]

const CATEGORY_COLOURS = [
  'bg-navy-50 text-navy-700 border-navy-100',
  'bg-teal-50 text-teal-700 border-teal-100',
  'bg-gold-50 text-gold-700 border-gold-100',
  'bg-slate-100 text-slate-700 border-slate-200',
  'bg-blue-50 text-blue-700 border-blue-100',
  'bg-rose-50 text-rose-700 border-rose-100',
  'bg-purple-50 text-purple-700 border-purple-100',
  'bg-green-50 text-green-700 border-green-100',
]

// ── PAGE ──────────────────────────────────────────────────────────────────────
export default async function GlossaryPage() {
  const categories = await getGlossaryCategories()

  return (
    <>
      {/* ════ Hero ══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10"
            style={{ background: 'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)' }}
          />
        </div>

        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <span className="eyebrow text-gold-400 mb-4 block">Reference Library</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight">
              The Accounting &amp; Finance Glossary
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10">
              Over 1,200 accounting terms and concepts explained clearly — written and
              reviewed by qualified accountants. The definitive reference for students
              and professionals.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-white/35 text-xs font-semibold uppercase tracking-widest">Jump to:</span>
              {['A','B','C','D'].map(l => (
                <Link
                  key={l}
                  href={`/dictionary?letter=${l}`}
                  className="px-3 py-1.5 rounded-md text-xs font-bold bg-white/8 text-white/60 border border-white/12 hover:bg-white/15 hover:text-white/90 transition-all"
                >
                  {l}
                </Link>
              ))}
              <span className="text-white/25 text-xs">…</span>
              <Link
                href="/dictionary"
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-gold-500/20 text-gold-400 border border-gold-500/30 hover:bg-gold-500/30 transition-all"
              >
                View full A–Z →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════ Stats bar ═════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-200 py-5">
        <div className="container-site">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
            {[
              { value:'1,200+', label:'Terms defined' },
              { value:'3,000+', label:'Study articles' },
              { value:'4',      label:'Qualifications covered' },
              { value:'Free',   label:'Always' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="font-display text-xl text-navy-950">{stat.value}</span>
                <span className="text-sm text-slate-400">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ A–Z Browse ════════════════════════════════════════════════════ */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-4xl">
            <span className="eyebrow mb-3 block">Browse A–Z</span>
            <h2 className="section-title mb-2">Find terms by letter</h2>
            <p className="text-slate-500 mb-8 text-base leading-relaxed">
              Select any letter to browse all accounting terms, definitions, and study
              notes that begin with that letter.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <Link
                href="/dictionary?letter=%23"
                className="group w-12 h-12 flex flex-col items-center justify-center rounded-xl bg-white border border-slate-200 hover:border-navy-950 hover:bg-navy-950 transition-all duration-150 shadow-sm hover:shadow"
              >
                <span className="text-base font-bold text-slate-400 group-hover:text-white transition-colors">#</span>
                <span className="text-[9px] text-slate-300 group-hover:text-white/50 transition-colors leading-none">0-9</span>
              </Link>
              {LETTERS.map(letter => (
                <Link
                  key={letter}
                  href={`/dictionary?letter=${letter}`}
                  className="group w-12 h-12 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:border-navy-950 hover:bg-navy-950 transition-all duration-150 shadow-sm hover:shadow"
                >
                  <span className="text-base font-bold text-navy-700 group-hover:text-white transition-colors" translate="no">
                    {letter}
                  </span>
                </Link>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Can&apos;t find what you&apos;re looking for?{' '}
              <Link href="/articles" className="text-navy-700 font-medium hover:text-gold-500 transition-colors">
                Search all 2,015+ articles
              </Link>.
            </p>
          </div>
        </div>
      </section>

      {/* ════ Browse by Topic ═══════════════════════════════════════════════ */}
      {categories.length > 0 && (
        <section className="section bg-white">
          <div className="container-site">
            <div className="max-w-4xl">
              <span className="eyebrow mb-3 block">By Subject</span>
              <h2 className="section-title mb-2">Browse by topic area</h2>
              <p className="text-slate-500 mb-8 text-base leading-relaxed">
                Jump straight into a subject area that matches your exam or specialism.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((topic, i) => (
                  <Link
                    key={topic.slug}
                    href={`/dictionary?category=${topic.slug}`}
                    className="group flex items-center gap-4 p-5 rounded-xl bg-white border border-slate-200 hover:border-navy-950 hover:shadow-md transition-all duration-200"
                  >
                    <div className={`px-2.5 py-1 rounded-lg border text-xs font-bold shrink-0 ${CATEGORY_COLOURS[i % CATEGORY_COLOURS.length]}`}>
                      {topic.count.toLocaleString()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-navy-950 text-sm group-hover:text-navy-600 transition-colors truncate">
                        {topic.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">articles &amp; definitions</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-navy-700 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}



      {/* ════ Why Trust ══════════════════════════════════════════════════════ */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-4xl">
            <div className="bg-navy-950 rounded-2xl p-8 md:p-10 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 50%)' }}
              />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex-1">
                  <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-3">
                    Why trust us?
                  </p>
                  <h3 className="font-display text-2xl text-white mb-3 leading-snug">
                    Every definition written by a qualified accountant
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    The internet is full of accounting content written by people who
                    have never sat an exam. Every term on Accounting Body is written or
                    reviewed by a qualified accountant.
                    We have been trusted by students since 2018.
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:items-end shrink-0">
                  <div className="flex items-center gap-3 bg-white/8 border border-white/10 rounded-xl px-4 py-3">
                    <span className="font-display text-2xl text-white">3,000+</span>
                    <span className="text-white/50 text-xs">study articles</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/8 border border-white/10 rounded-xl px-4 py-3">
                    <span className="font-display text-2xl text-white">Since 2018</span>
                    <span className="text-white/50 text-xs">trusted by educators</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ Bottom CTA ═════════════════════════════════════════════════════ */}
      <section className="section-navy section">
        <div className="container-site text-center">
          <h2 className="font-display text-3xl text-white mb-4">
            Ready to put it into practice?
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            Test your knowledge with practice questions across every
            major accounting qualification.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <Link
              href="/practice-questions"
              className="sm:flex-1 h-13 px-7 flex items-center justify-center text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold"
            >
              Browse practice questions
            </Link>
            <Link
              href="/study"
              className="sm:flex-1 h-13 px-7 flex items-center justify-center text-sm font-medium rounded-lg border border-white/25 text-white hover:bg-white/10 hover:border-white/40 transition-all"
            >
              Start studying free
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
