// app/mock-exams/page.tsx
// Accounting Body — Mock Exams
// Full timed mock exams catalogue, reusing the practice questions design language.

import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mock Exams | Accounting Body',
  description: 'Full timed mock exams for ACCA, CIMA, ICAEW and AAT. Instant marking, performance reports, and exam-standard questions.',
}

const EXAM_BODIES = [
  { code: 'ACCA',  slug: 'acca',  accent: 'bg-[#004B8D]', badgeBg: 'bg-blue-50',    badgeText: 'text-[#004B8D]', papers: ['BT', 'MA', 'FA', 'LW', 'PM', 'TX', 'FR', 'AA', 'FM', 'SBL', 'SBR', 'ATX', 'APM', 'AFM', 'AAA'] },
  { code: 'CIMA',  slug: 'cima',  accent: 'bg-[#0081C6]', badgeBg: 'bg-sky-50',     badgeText: 'text-[#0081C6]', papers: ['E1', 'P1', 'F1', 'E2', 'P2', 'F2', 'E3', 'P3', 'F3'] },
  { code: 'AAT',   slug: 'aat',   accent: 'bg-[#00857A]', badgeBg: 'bg-teal-50',    badgeText: 'text-teal-700',  papers: ['Level 2', 'Level 3', 'Level 4', 'Synoptic'] },
  { code: 'ICAEW', slug: 'icaew', accent: 'bg-[#8B0000]', badgeBg: 'bg-red-50',     badgeText: 'text-red-800',   papers: ['Accounting', 'Tax', 'Law', 'Business', 'Case Study'] },
]

const FEATURES = [
  {
    title: 'Timed exam conditions',
    body: 'Every mock runs under real exam time pressure with an on-screen countdown. Pause is disabled once started.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="2" stroke="currentColor" fill="none" />
        <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    title: 'Instant marking',
    body: 'Results appear the moment you submit. MCQs are auto-marked; written questions show model answers side by side.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Performance reports',
    body: 'See exactly which topics you dropped marks on — so every revision session is targeted, not random.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'Exam-standard questions',
    body: 'Written by qualified accountants and updated every sitting. Same style, same difficulty, same mark schemes.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
]

export default function MockExamsPage() {
  return (
    <div>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-25"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10"
            style={{ background: 'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-4xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <Link href="/study" className="hover:text-white/70 transition-colors">Study</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Mock Exams</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Mock Exams</span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Practice under
              <br />
              <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                real exam conditions.
              </span>
            </h1>
            <p className="text-white/65 text-xl leading-relaxed mb-10 max-w-2xl">
              Full timed mock exams for ACCA, CIMA, ICAEW and AAT.
              Instant marking, topic-level performance reports, and exam-standard questions.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/practice-questions"
                className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                Browse practice questions
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/study"
                className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all">
                Back to Study
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-200">
        <div className="container-site py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((f, i, arr) => (
              <div key={f.title} className={['flex flex-col', i < arr.length - 1 ? 'lg:border-r lg:border-slate-200 lg:pr-8' : ''].join(' ')}>
                <div className="w-9 h-9 rounded-lg bg-navy-50 flex items-center justify-center text-navy-700 mb-3">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-navy-950 text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EXAM BODY GRID ────────────────────────────────────────────── */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-10">
            <span className="eyebrow mb-3 block">Choose Your Qualification</span>
            <h2 className="section-title mb-4">Select your exam to begin</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Mock exams for ACCA, CIMA, ICAEW and AAT. Each one mirrors the real exam format exactly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {EXAM_BODIES.map(body => (
              <Link key={body.slug} href={`/practice-questions?exam=${body.slug}&type=mock-exam`}
                className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className={['h-1.5', body.accent].join(' ')} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <span className={['text-xs font-bold px-2.5 py-1 rounded-md', body.badgeBg, body.badgeText].join(' ')}>
                      {body.code}
                    </span>
                    <span className="text-xs text-slate-400">{body.papers.length} papers</span>
                  </div>
                  <h3 className="font-display text-lg text-navy-950 mb-3 group-hover:text-navy-700 transition-colors">
                    {body.code} Mock Exams
                  </h3>
                  <div className="flex flex-wrap gap-1.5 mb-5 flex-1">
                    {body.papers.map(p => (
                      <span key={p} className="text-2xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {p}
                      </span>
                    ))}
                  </div>
                  <span className={['flex items-center gap-1.5 text-xs font-semibold group-hover:gap-2.5 transition-all', body.badgeText].join(' ')}>
                    Start a mock exam
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────── */}
      <section className="bg-white border-t border-slate-200 py-8">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl text-navy-950">Not ready for a full mock?</p>
              <p className="text-sm text-slate-500 mt-0.5">Start with topic-level practice questions instead.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/study"
                className="h-10 px-5 flex items-center text-sm font-medium rounded-lg border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors">
                Study
              </Link>
              <Link href="/practice-questions"
                className="h-10 px-5 flex items-center text-sm font-semibold rounded-lg bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm">
                Practice questions
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}