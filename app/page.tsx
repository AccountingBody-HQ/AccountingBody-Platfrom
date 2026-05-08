// app/page.tsx
// AccountingBody.com — Homepage (Session 4 Redesign)
// Structure: Hero → Qualification Paths → How It Works → Platform Features → Stats → Articles → Trust → Email → CTA

import React from 'react'
import Link from 'next/link'
import { ExamBodyBadge } from '@/components/ui/Badge'
import EmailSignupForm from '@/components/EmailSignupForm'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SanityArticle {
  _id:          string
  title:        string
  slug:         { current: string }
  excerpt?:     string
  category?:    string
  examBody?:    string
  readTime?:    number
  publishedAt?: string
  coverImage?:  { asset: { url: string } }
  author?:      { name: string }
}

// ── Sanity fetch ──────────────────────────────────────────────────────────────

async function getFeaturedArticles(): Promise<SanityArticle[]> {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
    if (!projectId) return []
    const query = encodeURIComponent(`
      *[_type == "article"] | order(publishedAt desc) [0..3] {
        _id, title, slug, excerpt, category, examBody, readTime, publishedAt,
        "coverImage": featuredImage { asset -> { url } },
        "author": author -> { name }
      }
    `)
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

// ── Placeholder articles ──────────────────────────────────────────────────────

const placeholderArticles = [
  {
    _id: '1',
    title: 'ACCA F3 Financial Accounting: Complete Study Guide 2025',
    slug: { current: 'acca-f3-financial-accounting-study-guide' },
    excerpt: 'Everything you need to pass ACCA F3 first time — from double entry to financial statements.',
    category: 'Financial Reporting',
    examBody: 'acca',
    readTime: 12,
    publishedAt: '2025-03-01',
    author: { name: 'AccountingBody' },
  },
  {
    _id: '2',
    title: 'How to Calculate Deferred Tax: Step-by-Step with Examples',
    slug: { current: 'how-to-calculate-deferred-tax' },
    excerpt: 'Deferred tax trips up thousands of students every year. This guide makes it simple.',
    category: 'Taxation',
    examBody: 'acca',
    readTime: 8,
    publishedAt: '2025-02-28',
    author: { name: 'AccountingBody' },
  },
  {
    _id: '3',
    title: 'CIMA Operational Case Study: How to Structure Your Answer',
    slug: { current: 'cima-ocs-answer-structure' },
    excerpt: 'The OCS rewards structure above all else. Here is the exact framework top scorers use.',
    category: 'Management Accounting',
    examBody: 'cima',
    readTime: 10,
    publishedAt: '2025-02-25',
    author: { name: 'AccountingBody' },
  },
  {
    _id: '4',
    title: 'AAT Level 3 Synoptic Assessment: Everything You Need to Know',
    slug: { current: 'aat-level-3-synoptic-assessment-guide' },
    excerpt: 'The synoptic is unlike any other AAT exam. This complete guide tells you exactly what to expect.',
    category: 'Bookkeeping',
    examBody: 'aat',
    readTime: 9,
    publishedAt: '2025-02-20',
    author: { name: 'AccountingBody' },
  },
]

// ── Data ──────────────────────────────────────────────────────────────────────

const qualificationPaths = [
  {
    code:        'ACCA',
    slug:        'acca',
    description: 'All 13 papers from Applied Knowledge through Strategic Professional.',
    accent:      'bg-[#004B8D]',
    badgeBg:     'bg-blue-50',
    badgeText:   'text-[#004B8D]',
    highlights:  ['Applied Knowledge', 'Applied Skills', 'Strategic Professional', 'Ethics module'],
  },
  {
    code:        'CIMA',
    slug:        'cima',
    description: 'Operational, Management, and Strategic levels plus Case Study prep.',
    accent:      'bg-[#0081C6]',
    badgeBg:     'bg-sky-50',
    badgeText:   'text-[#0081C6]',
    highlights:  ['Operational level', 'Management level', 'Strategic level', 'Case Study prep'],
  },
  {
    code:        'ICAEW',
    slug:        'icaew',
    description: 'ACA qualification — Certificate, Professional, and Advanced levels.',
    accent:      'bg-[#8B0000]',
    badgeBg:     'bg-red-50',
    badgeText:   'text-red-800',
    highlights:  ['Certificate level', 'Professional level', 'Advanced level', 'Case Study'],
  },
  {
    code:        'AAT',
    slug:        'aat',
    description: 'Level 2 Foundation through Level 4 Professional Diploma.',
    accent:      'bg-[#00857A]',
    badgeBg:     'bg-teal-50',
    badgeText:   'text-teal-700',
    highlights:  ['Level 2 Foundation', 'Level 3 Advanced', 'Level 4 Professional', 'Synoptic prep'],
  },
]

const howItWorks = [
  {
    step:  '01',
    title: 'Choose your qualification',
    body:  'Select from ACCA, CIMA, ICAEW, or AAT. Browse by paper, subject area, or exam level to find exactly what you need.',
  },
  {
    step:  '02',
    title: 'Study with expert notes',
    body:  'Written and reviewed by qualified accountants. Clear explanations, worked examples, and exam technique built in throughout.',
  },
  {
    step:  '03',
    title: 'Practise and pass',
    body:  'Exam-standard questions with instant feedback. Track your progress and walk into the exam room knowing you are ready.',
  },
]

const pillars = [
  {
    id:          'study',
    title:       'Study Notes',
    description: 'Comprehensive study notes for every paper — written by qualified accountants and updated each exam sitting.',
    href:        '/study',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    highlights:  ['All papers covered', 'Worked examples', 'Examiner insights', 'Regular updates'],
    iconBg:      'bg-teal-600',
    iconColor:   'text-white',
    accentText:  'text-teal-700',
  },
  {
    id:          'practice',
    title:       'Practice Questions',
    description: 'MCQs, written tasks, and full mock exams built to exam standard. Instant marking with detailed explanations.',
    href:        '/practice-questions',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    highlights:  ['50,000+ questions', 'Full mock exams', 'Instant marking', 'Detailed solutions'],
    iconBg:      'bg-gold-500',
    iconColor:   'text-navy-950',
    accentText:  'text-gold-600',
  },
  {
    id:          'get-help',
    title:       'Get Help',
    description: 'Ask questions, search the glossary, and get matched with expert accountants for one-to-one support.',
    href:        '/get-help',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    highlights:  ['1,200+ glossary terms', 'Expert matching', 'Free calculators', 'Exam tip guides'],
    iconBg:      'bg-navy-950',
    iconColor:   'text-white',
    accentText:  'text-navy-700',
  },
  {
    id:          'hire',
    title:       'Hire Talent',
    description: 'Find qualified accountants, bookkeepers and tax advisers — or post a role to reach our network.',
    href:        '/hire-talent',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    highlights:  ['Vetted professionals', 'Tax advisers', 'Bookkeepers', 'Post a job free'],
    iconBg:      'bg-navy-800',
    iconColor:   'text-white',
    accentText:  'text-navy-600',
  },
  {
    id:          'firms',
    title:       'Firms & Freelancers',
    description: 'List your practice, find new clients, and connect with the wider accounting profession.',
    href:        '/firms-freelancers',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    highlights:  ['Free firm listing', 'Client enquiries', 'CPD resources', 'Freelance profiles'],
    iconBg:      'bg-slate-700',
    iconColor:   'text-white',
    accentText:  'text-slate-700',
  },
]

const stats = [
  {
    value:    '3,000+',
    label:    'Study Notes',
    sublabel: 'Updated for 2025 exams',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    value:    '50,000+',
    label:    'Practice Questions',
    sublabel: 'MCQ, written & scenario',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value:    '250,000+',
    label:    'Students Helped',
    sublabel: 'Across 80+ countries',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ),
  },
  {
    value:    'Free',
    label:    'To Start',
    sublabel: 'No credit card required',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
]

const trustPoints = [
  {
    title: 'Written by Qualified Professionals',
    body:  'Every article, study note and practice question is written or reviewed by a qualified accountant.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    title: 'Exam-Accurate Content',
    body:  'Question banks updated every exam sitting. We track examiner reports, syllabus changes and pass rates.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: 'Trusted Since 2010',
    body:  'Over a decade of helping students pass professional accounting exams. More than 3,000 articles trusted by educators.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Always Free to Start',
    body:  'Core study notes, practice questions and the full glossary are permanently free. No paywall. No trial.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: typeof placeholderArticles[0] }) {
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  const bodyColor =
    article.examBody === 'acca'  ? '#004B8D' :
    article.examBody === 'cima'  ? '#0081C6' :
    article.examBody === 'aat'   ? '#00857A' :
    article.examBody === 'icaew' ? '#1e3a7a' : '#0C1A3D'

  return (
    <article className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="h-1" style={{ backgroundColor: bodyColor }} />
      <div className="flex flex-col flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {article.examBody && (
            <ExamBodyBadge body={article.examBody.toUpperCase()} />
          )}
          {article.category && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {article.category}
            </span>
          )}
        </div>
        <Link href={`/articles/${article.slug.current}`} className="block mb-2 flex-1">
          <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
            {article.title}
          </h3>
        </Link>
        {article.excerpt && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-4">{article.excerpt}</p>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
          <span className="text-xs text-slate-400">{formattedDate}</span>
          {article.readTime && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
              </svg>
              {article.readTime} min
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function EmailSignupSection() {
  return (
    <section className="section-navy section relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
      </div>
      <div className="container-site relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Stay Ahead</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">
            Free exam tips, straight to your inbox
          </h2>
          <p className="text-white/65 text-lg mb-8 leading-relaxed">
            Weekly study tips, new question releases, and exam technique guides —
            written by qualified accountants. No spam, ever.
          </p>
          <EmailSignupForm />
          <p className="text-white/35 text-xs mt-4">
            Join 12,000+ accounting students and professionals. Unsubscribe any time.
          </p>
        </div>
      </div>
    </section>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const sanityArticles = await getFeaturedArticles()
  const articles = sanityArticles.length > 0 ? sanityArticles : placeholderArticles

  return (
    <>

      {/* ════════════════════════════════════════════════════════════════
          1. HERO
          ════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-navy-950 min-h-[85vh] flex items-center">

        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-30"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10"
            style={{ background: 'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)' }}
          />
        </div>

        <div className="container-site relative z-10 py-20 md:py-32">
          <div className="max-w-4xl">

            <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-7">
              Independent Study Platform &nbsp;&middot;&nbsp; Trusted Since 2010
            </p>

            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Study smarter.
              <br />
              Pass your{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                accounting exams
              </span>
              <br />
              first time.
            </h1>

            <p className="text-white/65 text-xl leading-relaxed mb-10 max-w-2xl">
              Expert study notes, exam-standard practice questions, and professional
              connections — everything in one place, completely free to start.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-16">
              <Link
                href="/study"
                className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold"
              >
                Start studying free
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/practice-questions"
                className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all"
              >
                Browse practice questions
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {[
                { value: '3,000+',   label: 'study notes' },
                { value: '50,000+',  label: 'practice questions' },
                { value: '250,000+', label: 'students helped' },
                { value: 'Free',     label: 'to start' },
              ].map(item => (
                <div key={item.label} className="flex items-baseline gap-2">
                  <span className="text-white font-display text-xl">{item.value}</span>
                  <span className="text-white/40 text-sm">{item.label}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          2. QUALIFICATION PATHWAYS
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-white">
        <div className="container-site">

          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Qualification Pathways</span>
            <h2 className="section-title mb-4">Choose your qualification</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Full coverage from foundation to strategic level. Select your qualification
              to explore study notes, practice questions, and exam resources.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {qualificationPaths.map(q => (
              <Link
                key={q.slug}
                href={`/study/${q.slug}`}
                className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className={`h-1.5 ${q.accent}`} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${q.badgeBg} ${q.badgeText}`}>
                      {q.code}
                    </span>
                  </div>
                  <h3 className="font-display text-base text-navy-950 leading-snug mb-2 group-hover:text-navy-700 transition-colors">
                    {q.code}
                  </h3>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed flex-1">{q.description}</p>
                  <ul className="space-y-1.5 mb-5">
                    {q.highlights.map(h => (
                      <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${q.accent}`} />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${q.badgeText} group-hover:gap-2.5 transition-all`}>
                    Browse {q.code} notes
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <p className="text-xs text-slate-400 border-t border-slate-100 pt-5">
            AccountingBody is an independent study platform and is not affiliated with,
            endorsed by, or connected to ACCA, CIMA, ICAEW, or AAT. These names are used
            solely to identify the qualifications our study materials are designed to support.
          </p>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          3. HOW IT WORKS
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-slate-50">
        <div className="container-site">

          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="eyebrow mb-3 block">How It Works</span>
            <h2 className="section-title mb-4">Simple. Structured. Effective.</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Three steps from starting your studies to walking into the exam room with confidence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {howItWorks.map((step) => (
              <div key={step.step} className="flex flex-col">
                <span className="font-display text-6xl text-gold-500 font-bold leading-none mb-5">
                  {step.step}
                </span>
                <h3 className="font-display text-xl text-navy-950 mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              href="/study"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
            >
              Start your journey
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          4. PLATFORM FEATURES
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-white">
        <div className="container-site">

          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Everything in One Place</span>
            <h2 className="section-title mb-4">What is on the platform</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Whether you are studying for exams, looking to hire a qualified accountant,
              or growing your practice — AccountingBody has the tools you need.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {pillars.map((pillar) => (
              <Link
                key={pillar.id}
                href={pillar.href}
                className="group flex flex-col bg-white rounded-xl border-2 border-slate-200 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${pillar.iconBg} ${pillar.iconColor}`}>
                  {pillar.icon}
                </div>
                <h3 className="font-display text-lg text-navy-950 mb-2 group-hover:text-navy-700 transition-colors">
                  {pillar.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">
                  {pillar.description}
                </p>
                <ul className="space-y-1.5 mb-5">
                  {pillar.highlights.map(h => (
                    <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pillar.iconBg}`} />
                      {h}
                    </li>
                  ))}
                </ul>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${pillar.accentText} group-hover:gap-2.5 transition-all`}>
                  Explore
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          5. STATS BAR
          ════════════════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="container-site py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-start ${i < stats.length - 1 ? 'lg:border-r lg:border-slate-200 lg:pr-8' : ''}`}
              >
                <div className="w-9 h-9 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600 mb-3">
                  {stat.icon}
                </div>
                <span className="stat-number mb-1">{stat.value}</span>
                <span className="text-sm font-semibold text-navy-950">{stat.label}</span>
                <span className="text-xs text-slate-400 mt-0.5">{stat.sublabel}</span>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          6. FEATURED ARTICLES
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-white">
        <div className="container-site">

          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <span className="eyebrow mb-3 block">Latest Content</span>
              <h2 className="section-title">Featured articles &amp; study notes</h2>
            </div>
            <Link
              href="/articles"
              className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-gold-500 transition-colors whitespace-nowrap"
            >
              View all
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {articles.slice(0, 4).map(article => (
              <ArticleCard key={article._id} article={article as typeof placeholderArticles[0]} />
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/articles"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm"
            >
              Browse all 3,000+ articles
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          7. TRUST & AUTHORITY
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            <div>
              <span className="eyebrow mb-3 block">Why AccountingBody</span>
              <h2 className="section-title mb-6">Content you can actually trust</h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                The internet is full of accounting content written by people who have
                never sat an exam. Every piece of content on AccountingBody is written
                or reviewed by someone who has.
              </p>
              <div className="space-y-5">
                {trustPoints.map(point => (
                  <div key={point.title} className="flex gap-4">
                    <div className="w-9 h-9 rounded-lg bg-navy-50 flex items-center justify-center text-navy-700 shrink-0 mt-0.5">
                      {point.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-navy-950 mb-1 text-sm">{point.title}</h4>
                      <p className="text-sm text-slate-500 leading-relaxed">{point.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="bg-navy-950 rounded-2xl p-8 relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 50%)' }}
                />
                <div className="relative z-10">
                  <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-6">
                    Student experience
                  </p>
                  <blockquote className="border-l-2 border-gold-500 pl-4 mb-8">
                    <p className="text-white/75 text-base leading-relaxed italic">
                      &ldquo;AccountingBody has been my go-to resource throughout my
                      qualification journey. The study notes and practice questions
                      are genuinely exam standard.&rdquo;
                    </p>
                    <footer className="mt-4 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gold-500/30 flex items-center justify-center text-gold-400 text-xs font-bold">
                        S
                      </div>
                      <div>
                        <span className="text-white/80 text-xs font-medium block">Sarah M.</span>
                        <span className="text-white/40 text-xs">Professional accounting student, UK</span>
                      </div>
                    </footer>
                  </blockquote>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/8 rounded-xl p-4 border border-white/10">
                      <span className="text-white font-display text-2xl block mb-0.5">98%</span>
                      <span className="text-white/50 text-xs">Would recommend</span>
                    </div>
                    <div className="bg-white/8 rounded-xl p-4 border border-white/10">
                      <span className="text-white font-display text-2xl block mb-0.5">4.9/5</span>
                      <span className="text-white/50 text-xs">Average rating</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          8. EMAIL SIGNUP
          ════════════════════════════════════════════════════════════════ */}
      <EmailSignupSection />


      {/* ════════════════════════════════════════════════════════════════
          9. BOTTOM CTA
          ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-200 py-8">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl text-navy-950">Ready to start? It&apos;s completely free.</p>
              <p className="text-sm text-slate-500 mt-0.5">No credit card. No trial. Just accounting.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/study"
                className="h-10 px-5 flex items-center text-sm font-medium rounded-lg border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors"
              >
                Browse study notes
              </Link>
              <Link
                href="/sign-up"
                className="h-10 px-5 flex items-center text-sm font-semibold rounded-lg bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm"
              >
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </section>

    </>
  )
}
