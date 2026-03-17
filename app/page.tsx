// app/page.tsx
// AccountingBody.com — Homepage
// Sections: Hero, Five Pillars, Featured Articles, Stats Bar, Trust, Email Signup

import React from 'react'
import Link from 'next/link'


import { ExamBodyBadge, StatusBadge } from '@/components/ui/Badge'

// ── Sanity fetch ──────────────────────────────────────────────────────────────
// Fetches the 4 most recent articles from Sanity.
// Falls back to placeholder data gracefully if Sanity is not yet configured.

interface SanityArticle {
  _id:         string
  title:       string
  slug:        { current: string }
  excerpt?:    string
  category?:   string
  examBody?:   string
  readTime?:   number
  publishedAt?: string
  coverImage?: { asset: { url: string } }
  author?:     { name: string }
}

async function getFeaturedArticles(): Promise<SanityArticle[]> {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'

    if (!projectId) return []

    const query = encodeURIComponent(`
      *[_type == "article"] | order(publishedAt desc) [0..3] {
        _id,
        title,
        slug,
        excerpt,
        category,
        examBody,
        readTime,
        publishedAt,
        "coverImage": coverImage { asset -> { url } },
        "author": author -> { name }
      }
    `)

    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}?query=${query}`,
      { next: { revalidate: 3600 } }   // ISR: revalidate every hour
    )

    if (!res.ok) return []
    const data = await res.json()
    return data.result ?? []
  } catch {
    return []
  }
}

// ── Placeholder articles (shown when Sanity not yet connected) ────────────────
const placeholderArticles = [
  {
    _id: '1',
    title: 'ACCA F3 Financial Accounting: Complete Study Guide 2025',
    slug: { current: 'acca-f3-financial-accounting-study-guide' },
    excerpt: 'Everything you need to pass ACCA F3 first time — from double entry to financial statements.',
    category: 'Financial Reporting',
    examBody: 'ACCA',
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
    examBody: 'ACCA',
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
    examBody: 'CIMA',
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
    examBody: 'AAT',
    readTime: 9,
    publishedAt: '2025-02-20',
    author: { name: 'AccountingBody' },
  },
]

// ── Section data ──────────────────────────────────────────────────────────────

const pillars = [
  {
    id:          'get-help',
    title:       'Get Help',
    description: 'Ask questions, search the glossary, use free calculators, and get expert answers from the community.',
    href:        '/get-help',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75"
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    highlights: ['1,200+ Glossary terms', 'Free calculators', 'Community Q&A', 'Exam tip guides'],
    accent: 'border-navy-500',
    accentBg: 'bg-navy-50',
    accentText: 'text-navy-700',
    iconBg: 'bg-navy-950',
    iconColor: 'text-white',
  },
  {
    id:          'study',
    title:       'Study',
    description: 'Comprehensive study notes for every paper across ACCA, CIMA, AAT, ICAEW, and more.',
    href:        '/study',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75"
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    highlights: ['ACCA all 13 papers', 'CIMA full pathway', 'AAT Levels 2–4', 'Worked examples'],
    accent: 'border-teal-500',
    accentBg: 'bg-teal-50',
    accentText: 'text-teal-700',
    iconBg: 'bg-teal-600',
    iconColor: 'text-white',
  },
  {
    id:          'practice',
    title:       'Practice Questions',
    description: 'MCQs, written tasks, case studies and mock exams — built to exam standard for every qualification.',
    href:        '/practice',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    highlights: ['50,000+ MCQs', 'Full mock exams', 'Past papers', 'Instant marking'],
    accent: 'border-gold-500',
    accentBg: 'bg-gold-50',
    accentText: 'text-gold-600',
    iconBg: 'bg-gold-500',
    iconColor: 'text-navy-950',
  },
  {
    id:          'hire',
    title:       'Hire Talent',
    description: 'Find qualified accountants, bookkeepers, and tax advisers — or post a role to reach our network.',
    href:        '/hire',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    highlights: ['Vetted accountants', 'Tax advisers', 'Bookkeepers', 'Post a job free'],
    accent: 'border-navy-400',
    accentBg: 'bg-navy-50',
    accentText: 'text-navy-600',
    iconBg: 'bg-navy-800',
    iconColor: 'text-white',
  },
  {
    id:          'firms',
    title:       'Firms & Freelancers',
    description: 'List your practice, find new clients, access CPD resources and connect with the profession.',
    href:        '/firms',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75"
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    highlights: ['Free firm listing', 'Client leads', 'CPD resources', 'Freelance profiles'],
    accent: 'border-slate-400',
    accentBg: 'bg-slate-50',
    accentText: 'text-slate-700',
    iconBg: 'bg-slate-700',
    iconColor: 'text-white',
  },
]

const stats = [
  {
    value:    '3,000+',
    label:    'Articles & Study Notes',
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
    body:  'Every article, study note and question is written or reviewed by qualified accountants — ACCA, CIMA, and ICAEW members.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    title: 'Exam-Accurate Content',
    body:  'Our question banks are updated every exam sitting. We track examiner reports, syllabus changes and pass rates to keep content current.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    title: 'Trusted Since 2010',
    body:  'Over a decade of helping students pass professional accounting exams. More than 3,000 articles indexed by Google and trusted by educators.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Always Free to Start',
    body:  'Core study notes, practice questions, and the full glossary are permanently free. No paywall, no credit card, no trial period.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
]

const examBodies = ['ACCA', 'CIMA', 'AAT', 'ICAEW', 'ATT', 'CPA', 'CIPFA', 'CTA']

// ── Sub-components ────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: typeof placeholderArticles[0] }) {
  const formattedDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  return (
    <article className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Colour accent top bar based on exam body */}
      <div className={`h-1 ${
        article.examBody === 'ACCA' ? 'bg-[#004B8D]' :
        article.examBody === 'CIMA' ? 'bg-[#0081C6]' :
        article.examBody === 'AAT'  ? 'bg-[#00857A]' :
        'bg-navy-950'
      }`} />

      <div className="flex flex-col flex-1 p-5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {article.examBody && <ExamBodyBadge body={article.examBody} />}
          {article.category && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {article.category}
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/articles/${article.slug.current}`} className="block mb-2 flex-1">
          <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
            {article.title}
          </h3>
        </Link>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-4">
            {article.excerpt}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
          <span className="text-xs text-slate-400">{formattedDate}</span>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            {article.readTime && (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
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

// ── Email Signup Section component ────────────────────────────────────────────
function EmailSignupSection() {
  return (
    <section className="section-navy section relative overflow-hidden">
      {/* Background decoration */}
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

          {/* Form — wires to /api/subscribe */}
          <form
            action="/api/subscribe"
            method="POST"
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              name="email"
              placeholder="your@email.com"
              required
              className="flex-1 h-12 px-4 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold whitespace-nowrap"
            >
              Subscribe free
            </button>
          </form>

          <p className="text-white/35 text-xs mt-4">
            Join 12,000+ accounting students and professionals.
            Unsubscribe any time.
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
          1. HERO SECTION
          ════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-navy-950 min-h-[85vh] flex items-center">

        {/* Background layers */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Radial gradient spotlight */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-30"
            style={{
              background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)',
            }}
          />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }}
          />
          {/* Gold accent blob */}
          <div
            className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-10"
            style={{
              background: 'radial-gradient(ellipse at bottom right, #D4A017 0%, transparent 60%)',
            }}
          />
        </div>

        <div className="container-site relative z-10 py-20 md:py-28">
          <div className="max-w-4xl">

            {/* Eyebrow */}
            <div className="flex flex-wrap items-center gap-3 mb-8">
              <StatusBadge status="New" animate size="sm" />
              <span className="text-white/50 text-sm">50,000+ practice questions now live</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Everything you need
              <br />
              for{' '}
              <span className="relative inline-block">
                <span
                  className="relative z-10"
                  style={{
                    background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  accounting
                </span>
              </span>
              {' '}&amp; finance
              <br />
              in one place.
            </h1>

            {/* Value proposition */}
            <p className="text-white/65 text-xl leading-relaxed mb-10 max-w-2xl">
              Study notes, practice questions, and professional connections for
              every accounting qualification — ACCA, CIMA, AAT, ICAEW, and more.
              Trusted by 250,000+ students worldwide.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 mb-14">
              <Link
                href="/study"
                className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold hover:shadow-gold-lg"
              >
                Start studying free
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="/practice"
                className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all"
              >
                Browse practice questions
              </Link>
            </div>

            {/* Exam body logos row */}
            <div>
              <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mb-4">
                Covering all major qualifications
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {examBodies.map(body => (
                  <Link
                    key={body}
                    href={`/study/${body.toLowerCase()}`}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white/8 text-white/60 border border-white/12 hover:bg-white/15 hover:text-white/90 transition-all"
                  >
                    {body}
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Bottom fade into page */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, #F8F7F4)' }}
        />
      </section>


      {/* ════════════════════════════════════════════════════════════════
          2. FIVE PILLAR CARDS
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-slate-50">
        <div className="container-site">

          {/* Section header */}
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">What We Offer</span>
            <h2 className="section-title mb-4">
              Five ways AccountingBody helps you
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Whether you are a student preparing for exams, a professional
              looking to hire, or a firm seeking new clients — we have the
              tools and resources you need.
            </p>
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {pillars.map((pillar, i) => (
              <Link
                key={pillar.id}
                href={pillar.href}
                className={[
                  'group flex flex-col bg-white rounded-xl border-2 p-6',
                  'hover:shadow-lg hover:-translate-y-1 transition-all duration-200',
                  'border-slate-200 hover:' + pillar.accent,
                ].join(' ')}
                style={{ animationDelay: `${i * 75}ms` }}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${pillar.iconBg} ${pillar.iconColor}`}>
                  {pillar.icon}
                </div>

                {/* Title */}
                <h3 className="font-display text-lg text-navy-950 mb-2 group-hover:text-navy-700 transition-colors">
                  {pillar.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">
                  {pillar.description}
                </p>

                {/* Highlights list */}
                <ul className="space-y-1.5 mb-5">
                  {pillar.highlights.map(h => (
                    <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pillar.iconBg}`} />
                      {h}
                    </li>
                  ))}
                </ul>

                {/* CTA link */}
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
          3. STATS BAR
          ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-slate-200">
        <div className="container-site py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`flex flex-col items-start ${
                  i < stats.length - 1 ? 'lg:border-r lg:border-slate-200 lg:pr-8' : ''
                }`}
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
          4. FEATURED ARTICLES
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-slate-50">
        <div className="container-site">

          {/* Header */}
          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <span className="eyebrow mb-3 block">Latest Content</span>
              <h2 className="section-title">
                Featured articles &amp; study notes
              </h2>
            </div>
            <Link
              href="/articles"
              className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-gold-500 transition-colors whitespace-nowrap"
            >
              View all articles
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Articles grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {articles.slice(0, 4).map(article => (
              <ArticleCard key={article._id} article={article as typeof placeholderArticles[0]} />
            ))}
          </div>

          {/* Bottom CTA */}
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
          5. TRUST & AUTHORITY SECTION
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left — text */}
            <div>
              <span className="eyebrow mb-3 block">Why AccountingBody</span>
              <h2 className="section-title mb-6">
                Content you can actually trust
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                The internet is full of accounting content written by people who
                have never sat an exam. Every piece of content on AccountingBody
                is written or reviewed by someone who has.
              </p>

              {/* Trust points */}
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

            {/* Right — visual authority card */}
            <div className="relative">
              {/* Main card */}
              <div className="bg-navy-950 rounded-2xl p-8 relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 50%)`,
                  }}
                />

                <div className="relative z-10">
                  <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-6">
                    Qualifications covered
                  </p>

                  {/* Exam body grid */}
                  <div className="grid grid-cols-4 gap-2 mb-8">
                    {examBodies.map(body => (
                      <div
                        key={body}
                        className="flex items-center justify-center py-2.5 rounded-lg bg-white/8 border border-white/10 text-xs font-bold text-white/80"
                      >
                        {body}
                      </div>
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="border-l-2 border-gold-500 pl-4">
                    <p className="text-white/70 text-sm leading-relaxed italic">
                      &ldquo;AccountingBody has been my go-to resource throughout my ACCA journey.
                      The study notes and practice questions are genuinely exam standard.&rdquo;
                    </p>
                    <footer className="mt-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gold-500/30 flex items-center justify-center text-gold-400 text-xs font-bold">
                        S
                      </div>
                      <div>
                        <span className="text-white/80 text-xs font-medium block">Sarah M.</span>
                        <span className="text-white/40 text-xs">ACCA student, UK</span>
                      </div>
                    </footer>
                  </blockquote>
                </div>
              </div>

              {/* Floating stat cards */}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl border border-slate-200 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-navy-950 font-display text-lg leading-none block">98%</span>
                  <span className="text-slate-500 text-xs">Would recommend</span>
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl border border-slate-200 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gold-50 flex items-center justify-center text-gold-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div>
                  <span className="text-navy-950 font-display text-lg leading-none block">4.9/5</span>
                  <span className="text-slate-500 text-xs">Average rating</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════
          6. EMAIL SIGNUP SECTION
          ════════════════════════════════════════════════════════════════ */}
      <EmailSignupSection />


      {/* ════════════════════════════════════════════════════════════════
          BOTTOM CTA STRIP — before footer
          ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-200 py-8">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl text-navy-950">
                Ready to start? It&apos;s completely free.
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                No credit card. No trial. Just accounting.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/study"
                className="h-10 px-5 flex items-center text-sm font-medium rounded-lg border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors"
              >
                Browse study notes
              </Link>
              <Link
                href="/signup"
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
