// app/study-hub/page.tsx
// AccountingBody — Study Hub
// Central navigation hub for all study content. 17 outgoing internal links.

import Link from 'next/link'
import type { Metadata } from 'next'
import CardGrid from '@/components/CardGrid'
import type { CategoryCard } from '@/components/CardGrid'
import { getStudyLandingData } from '@/lib/sanity-queries'

export const metadata: Metadata = {
  title: 'Study Hub | AccountingBody',
  description: 'Your central hub for ACCA, CIMA, ICAEW and AAT study content — notes, courses, practice questions, mock exams, and the dictionary.',
}

// ── Static card data ───────────────────────────────────────────────────────────

const QUALIFICATION_CARDS: CategoryCard[] = [
  { id: 'acca',  title: 'ACCA',  href: '/study/acca',  description: 'All 13 papers from Applied Knowledge to Strategic Professional.', iconName: 'graduation-cap', accentClass: 'bg-[#004B8D]', iconBg: 'bg-[#004B8D]', iconColor: 'text-white', highlights: ['Applied Knowledge', 'Applied Skills', 'Strategic Professional'] },
  { id: 'cima',  title: 'CIMA',  href: '/study/cima',  description: 'Operational, Management, and Strategic levels plus Case Study.', iconName: 'chart-bar',      accentClass: 'bg-[#0081C6]', iconBg: 'bg-[#0081C6]', iconColor: 'text-white', highlights: ['Operational level', 'Management level', 'Strategic level'] },
  { id: 'aat',   title: 'AAT',   href: '/study/aat',   description: 'Level 2 Foundation through Level 4 Professional Diploma.',       iconName: 'book',           accentClass: 'bg-[#00857A]', iconBg: 'bg-[#00857A]', iconColor: 'text-white', highlights: ['Level 2 Foundation', 'Level 3 Advanced', 'Level 4 Professional'] },
  { id: 'icaew', title: 'ICAEW', href: '/study/icaew', description: 'ACA qualification — Certificate, Professional, and Advanced.',    iconName: 'award',          accentClass: 'bg-[#8B0000]', iconBg: 'bg-[#8B0000]', iconColor: 'text-white', highlights: ['Certificate level', 'Professional level', 'Advanced level'] },
]

const SUBJECT_CARDS: CategoryCard[] = [
  { id: 'financial-reporting',   title: 'Financial Reporting',    href: '/study/financial-reporting',   iconName: 'chart-bar',       iconBg: 'bg-navy-50',   iconColor: 'text-navy-700',  accentClass: 'bg-navy-600',  count: '320+' },
  { id: 'management-accounting', title: 'Management Accounting',  href: '/study/management-accounting', iconName: 'trending-up',     iconBg: 'bg-teal-50',   iconColor: 'text-teal-700',  accentClass: 'bg-teal-600',  count: '280+' },
  { id: 'taxation',              title: 'Taxation',               href: '/study/taxation',              iconName: 'receipt',         iconBg: 'bg-gold-50',   iconColor: 'text-gold-600',  accentClass: 'bg-gold-500',  count: '410+' },
  { id: 'audit-assurance',       title: 'Audit & Assurance',      href: '/study/audit-assurance',       iconName: 'clipboard-check', iconBg: 'bg-navy-50',   iconColor: 'text-navy-700',  accentClass: 'bg-navy-500',  count: '190+' },
  { id: 'financial-management',  title: 'Financial Management',   href: '/study/financial-management',  iconName: 'trending-up',     iconBg: 'bg-teal-50',   iconColor: 'text-teal-700',  accentClass: 'bg-teal-500',  count: '175+' },
  { id: 'law-ethics',            title: 'Law & Ethics',           href: '/study/law-ethics',            iconName: 'scale',           iconBg: 'bg-slate-100', iconColor: 'text-slate-700', accentClass: 'bg-slate-500', count: '130+' },
  { id: 'bookkeeping',           title: 'Bookkeeping',            href: '/study/bookkeeping',           iconName: 'book',            iconBg: 'bg-teal-50',   iconColor: 'text-teal-700',  accentClass: 'bg-teal-600',  count: '220+' },
  { id: 'performance-mgmt',      title: 'Performance Management', href: '/study/performance-management',iconName: 'target',          iconBg: 'bg-gold-50',   iconColor: 'text-gold-600',  accentClass: 'bg-gold-500',  count: '160+' },
]

const RESOURCE_CARDS: CategoryCard[] = [
  {
    id: 'free-courses', title: 'Free Courses', href: '/study/courses',
    description: 'Structured video and text courses for ACCA, CIMA, ICAEW and AAT.',
    iconName: 'graduation-cap', iconBg: 'bg-navy-950', iconColor: 'text-white',
    accentClass: 'bg-navy-950', pinned: true, badge: 'Free',
  },
  {
    id: 'practice-questions', title: 'Practice Questions', href: '/practice-questions',
    description: '50,000+ MCQs, written tasks and scenario questions to exam standard.',
    iconName: 'clipboard-check', iconBg: 'bg-teal-600', iconColor: 'text-white',
    accentClass: 'bg-teal-600', pinned: true,
  },
  {
    id: 'mock-exams', title: 'Mock Exams', href: '/mock-exams',
    description: 'Full timed mock exams with instant marking and performance reports.',
    iconName: 'clock', iconBg: 'bg-gold-500', iconColor: 'text-navy-950',
    accentClass: 'bg-gold-500', badge: 'New',
  },
  {
    id: 'dictionary', title: 'Accounting Dictionary', href: '/dictionary',
    description: '1,200+ defined accounting and finance terms, always free.',
    iconName: 'book', iconBg: 'bg-navy-800', iconColor: 'text-white',
    accentClass: 'bg-navy-800',
  },
  {
    id: 'glossary', title: 'Full Glossary', href: '/glossary',
    description: 'Browse every term A–Z across ACCA, CIMA, ICAEW and AAT.',
    iconName: 'file-text', iconBg: 'bg-slate-700', iconColor: 'text-white',
    accentClass: 'bg-slate-600',
  },
  {
    id: 'get-help', title: 'Get Help', href: '/get-help',
    description: 'Ask questions, search the community, and get expert answers.',
    iconName: 'question-circle', iconBg: 'bg-teal-50', iconColor: 'text-teal-700',
    accentClass: 'bg-teal-500',
  },
]

// ── Quick links strip ──────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { label: 'Study Notes',        href: '/study' },
  { label: 'Free Courses',       href: '/study/courses' },
  { label: 'Practice Questions', href: '/practice-questions' },
  { label: 'Mock Exams',         href: '/mock-exams' },
  { label: 'Dictionary',         href: '/dictionary' },
  { label: 'Glossary',           href: '/glossary' },
  { label: 'Get Help',           href: '/get-help' },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function StudyHubPage() {
  const liveData = await getStudyLandingData()
  const liveMap  = Object.fromEntries(liveData.map(d => [d.examBody?.toLowerCase(), d.count]))

  // Inject live article counts into qualification cards
  const qualCards = QUALIFICATION_CARDS.map(c => ({
    ...c,
    count: liveMap[c.id] ?? undefined,
  }))

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
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Study Hub</span>
            </nav>

            <span className="eyebrow text-gold-400 mb-4 block">Study Hub</span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Everything in one place.
              <br />
              <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Start studying now.
              </span>
            </h1>
            <p className="text-white/65 text-xl leading-relaxed mb-10 max-w-2xl">
              Notes, courses, practice questions, mock exams, and the accounting
              dictionary — all free to start, all in one place.
            </p>

            {/* Quick links strip */}
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_LINKS.map(l => (
                <Link key={l.href} href={l.href}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white/8 text-white/60 border border-white/12 hover:bg-white/15 hover:text-white/90 transition-all">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────── */}
      <section className="bg-white border-b border-slate-200">
        <div className="container-site py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: '3,000+',   label: 'Study articles',       sub: 'Updated for 2025 exams' },
              { value: '50,000+',  label: 'Practice questions',    sub: 'MCQ, written & scenario' },
              { value: '8',        label: 'Qualifications covered',sub: 'ACCA, CIMA, AAT & more' },
              { value: '1,200+',   label: 'Dictionary terms',      sub: 'Always free' },
            ].map((s, i, arr) => (
              <div key={s.label} className={['flex flex-col', i < arr.length - 1 ? 'lg:border-r lg:border-slate-200 lg:pr-6' : ''].join(' ')}>
                <span className="stat-number mb-1">{s.value}</span>
                <span className="text-sm font-semibold text-navy-950">{s.label}</span>
                <span className="text-xs text-slate-400 mt-0.5">{s.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUALIFICATIONS ───────────────────────────────────────────── */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-10">
            <span className="eyebrow mb-3 block">Qualifications</span>
            <h2 className="section-title mb-4">Choose your qualification</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Select your exam body to browse all study notes, listed alphabetically by topic.
            </p>
          </div>
          <CardGrid categories={qualCards} columns={4} variant="default" />
          <div className="mt-6 text-center">
            <Link href="/study"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm">
              Browse all four qualifications
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SUBJECT AREAS ─────────────────────────────────────────────── */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="max-w-2xl mb-10">
            <span className="eyebrow mb-3 block">Browse by Subject</span>
            <h2 className="section-title mb-4">Or find notes by topic</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Study any subject across ACCA, CIMA, ICAEW and AAT — from taxation to financial reporting.
            </p>
          </div>
          <CardGrid categories={SUBJECT_CARDS} columns={4} variant="compact" />
        </div>
      </section>

      {/* ── FEATURED COURSES ─────────────────────────────────────────── */}
      <section className="section bg-slate-50 border-t border-slate-200">
        <div className="container-site">
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <span className="eyebrow mb-3 block">Free Courses</span>
              <h2 className="section-title">Structured learning paths</h2>
              <p className="text-slate-500 text-lg leading-relaxed mt-2 max-w-xl">
                Complete courses for every paper — video lessons, worked examples, and built-in practice questions.
              </p>
            </div>
            <Link href="/study/courses"
              className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-gold-500 transition-colors whitespace-nowrap">
              All courses
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>

          {/* Course highlight cards — static signposts to real course pages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { title: 'ACCA Applied Knowledge',    sub: 'BT, MA & FA — perfect for beginners',             href: '/study/courses', exam: 'ACCA',  accent: 'bg-[#004B8D]' },
              { title: 'CIMA Operational Level',    sub: 'E1, P1 & F1 — full structured pathway',           href: '/study/courses', exam: 'CIMA',  accent: 'bg-[#0081C6]' },
              { title: 'AAT Level 3 Advanced',      sub: 'Financial accounting and management accounting',   href: '/study/courses', exam: 'AAT',   accent: 'bg-[#00857A]' },
            ].map(c => (
              <Link key={c.title} href={c.href}
                className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                <div className={['h-1.5', c.accent].join(' ')} />
                <div className="p-6 flex flex-col flex-1">
                  <span className={['text-xs font-bold px-2.5 py-1 rounded-md mb-4 self-start text-white', c.accent].join(' ')}>
                    {c.exam}
                  </span>
                  <h3 className="font-display text-lg text-navy-950 leading-snug mb-2 group-hover:text-navy-700 transition-colors">
                    {c.title}
                  </h3>
                  <p className="text-sm text-slate-500 flex-1">{c.sub}</p>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-navy-600 mt-4 group-hover:gap-2.5 transition-all">
                    Start course
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── RESOURCES GRID ───────────────────────────────────────────── */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="max-w-2xl mb-10">
            <span className="eyebrow mb-3 block">All Resources</span>
            <h2 className="section-title mb-4">Every tool you need</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Courses, practice questions, mock exams, the dictionary, and peer support — all free to start.
            </p>
          </div>
          <CardGrid categories={RESOURCE_CARDS} columns={3} variant="default" />
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────── */}
      <section className="section-navy section relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10 text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Ready to begin?</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">
            Start studying free today.
          </h2>
          <p className="text-white/65 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            No credit card. No trial. Just accounting study notes, practice questions, and courses.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/study"
              className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
              Browse study notes
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link href="/practice-questions"
              className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all">
              Practice questions
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}