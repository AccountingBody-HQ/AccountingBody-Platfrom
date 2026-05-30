// app/page.tsx
// Accounting Body.com — Homepage (Session 4 Redesign)
// Structure: Hero → Qualification Paths → How It Works → Platform Features → Stats → Articles → Trust → Email → CTA

import React from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import EmailSignupForm from '@/components/EmailSignupForm'
import HeroSearch from '@/components/HeroSearch'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SanityArticle {
  _id:             string
  title:           string
  slug:            { current: string }
  excerpt?:        string
  category?:       string
  examBody?:       string
  readTime?:       number
  publishedAt?:    string
  coverImage?:     { asset: { url: string } }
  author?:         { name: string }
  showInLatestInsights?: boolean
  isHotTopic?:     boolean
  insightTag?:     string
}

// ── Sanity fetch ──────────────────────────────────────────────────────────────

async function getFeaturedArticles(): Promise<SanityArticle[]> {
  try {
    const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '4rllejq1'
    const dataset   = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production'
    const query = encodeURIComponent(
      `*[_type == "article" && "accountingbody" in showOnSites && showInLatestInsights == true] | order(publishedAt desc) [0..7] {
        _id, title, slug, excerpt, examBody, readTime, publishedAt,
        showInLatestInsights, isHotTopic, insightTag,
        "categoryTitle": categories[0]->title,
        "coverImage": featuredImage { asset -> { url } }
      }`
    )
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}?query=${query}`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const results = data.result ?? []
    if (results.length === 0) {
      const fallbackQuery = encodeURIComponent(
        `*[_type == "article" && "accountingbody" in showOnSites] | order(publishedAt desc) [0..3] {
          _id, title, slug, excerpt, examBody, readTime, publishedAt,
          showInLatestInsights, isHotTopic, insightTag,
          "categoryTitle": categories[0]->title,
          "coverImage": featuredImage { asset -> { url } }
        }`
      )
      const fallbackRes = await fetch(
        `https://${projectId}.api.sanity.io/v2023-05-03/data/query/${dataset}?query=${fallbackQuery}`,
        { next: { revalidate: 1800 } }
      )
      if (!fallbackRes.ok) return []
      const fallbackData = await fallbackRes.json()
      return fallbackData.result ?? []
    }
    return results
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
    author: { name: 'Accounting Body' },
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
    author: { name: 'Accounting Body' },
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
    author: { name: 'Accounting Body' },
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
    author: { name: 'Accounting Body' },
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
    highlights:  ['20,000+ questions', 'Full mock exams', 'Instant marking', 'Detailed solutions'],
    iconBg:      'bg-gold-500',
    iconColor:   'text-navy-950',
    accentText:  'text-gold-600',
  },
  {
    id:          'get-help',
    title:       'Professional Services',
    description: 'Engage Accounting Body for tax, audit, bookkeeping, payroll, and advisory. We manage every engagement through our verified professional network.',
    href:        '/get-help',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    highlights:  ['Tax & audit', 'Bookkeeping & payroll', 'Business advisory', 'Global coverage'],
    iconBg:      'bg-navy-950',
    iconColor:   'text-white',
    accentText:  'text-navy-700',
  },
  {
    id:          'firms',
    title:       'Join Our Network',
    description: 'Accounting firms and independent professionals can apply to join the Accounting Body managed network and receive matched client engagements.',
    href:        '/firms-freelancers',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    highlights:  ['Verified network', 'Managed engagements', 'Global coverage', 'Firms & independents'],
    iconBg:      'bg-slate-700',
    iconColor:   'text-white',
    accentText:  'text-slate-700',
  },
]

const stats = [
  {
    value:    '3,000+',
    label:    'Articles',
    sublabel: 'Written by qualified accountants',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    value:    '20,000+',
    label:    'Practice Questions',
    sublabel: 'MCQ, written & scenario',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value:    'Since 2018',
    label:    'Trusted Platform',
    sublabel: 'Helping students pass exams',
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
    title: 'Trusted Since 2018',
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

function ArticleCard({ article }: { article: SanityArticle & { category?: string } }) {
  const examBodyFirst = Array.isArray(article.examBody) ? article.examBody[0] : article.examBody
  const bodyColor =
    examBodyFirst === 'acca'  ? '#004B8D' :
    examBodyFirst === 'cima'  ? '#0081C6' :
    examBodyFirst === 'aat'   ? '#00857A' :
    examBodyFirst === 'icaew' ? '#1e3a7a' : '#0C1A3D'

  const tagLabels: Record<string, string> = {
    'trending':          'Trending',
    'new':               'New',
    'exam-relevant':     'Exam Relevant',
    'technical-update':  'Technical Update',
    'industry-change':   'Industry Change',
    'regulatory-update': 'Regulatory Update',
  }

  return (
    <article className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative">
      <div className="h-1" style={{ backgroundColor: bodyColor }} />
      {article.isHotTopic && (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-black uppercase tracking-wider"
            style={{ background: '#f43f5e', color: '#fff' }}>
            🔥 Hot
          </span>
        </div>
      )}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {article.insightTag && (
            <span className="text-[0.6rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(212,160,23,0.1)', color: '#B8860B', border: '1px solid rgba(212,160,23,0.25)' }}>
              {tagLabels[article.insightTag] ?? article.insightTag}
            </span>
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
          <div className="w-full flex justify-center mt-4">
            <p className="text-white/35 text-xs text-center">Join accounting students and professionals. Unsubscribe any time.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const etHowItWorks = [
    {
      step:  '01',
      title: 'Tell us what you need',
      body:  'Contact EthioTax by WhatsApp, email or our website form. You can write in English, በአማርኛ or Afaan Oromoo. We respond within 24 hours, every time.',
    },
    {
      step:  '02',
      title: 'We prepare your proposal',
      body:  'EthioTax qualifies your requirement, selects the right professional from our verified network, and delivers a clear fixed-fee proposal within 72 hours.',
    },
    {
      step:  '03',
      title: 'We manage everything',
      body:  'Once you approve, EthioTax briefs the professional, monitors progress and quality-checks every deliverable before it reaches you.',
    },
    {
      step:  '04',
      title: 'You receive the work',
      body:  'EthioTax delivers your completed work with a covering note. We follow up within 5 days to confirm your satisfaction.',
    },
    {
      step:  '05',
      title: 'We stay with you',
      body:  'EthioTax tracks your deadlines, sends annual reminders and proactively advises as your needs grow. One relationship. Complete financial support.',
    },
  ]
  const etPillars = [
    {
      id:          'tax',
      title:       'Tax & Compliance',
      description: 'EthioTax manages your tax obligations across every jurisdiction you live and work in. UK Self Assessment, US returns, Ethiopian ERCA filings and cross-border treaty claims.',
      href:        '/get-help',
      highlights:  ['UK Self Assessment', 'US & Canadian returns', 'Ethiopian ERCA filing', 'Cross-border tax planning'],
      iconBg:      '#1A4731',
      accentText:  '#1A4731',
    },
    {
      id:          'accounting',
      title:       'Accounting & Bookkeeping',
      description: 'Monthly bookkeeping, annual accounts, management reporting and software setup. ETICPA-standard accounts for Ethiopian entities. Clean, accurate, on time.',
      href:        '/get-help',
      highlights:  ['Monthly bookkeeping', 'Annual accounts', 'Management reports', 'Xero & QuickBooks setup'],
      iconBg:      '#1A4731',
      accentText:  '#1A4731',
    },
    {
      id:          'consulting',
      title:       'Business Consulting',
      description: 'Company formation, business plans, financial modelling and diaspora investment structuring. We navigate Ethiopian and international regulatory requirements for you.',
      href:        '/get-help',
      highlights:  ['Company formation', 'Business plans', 'Diaspora investment', 'Financial modelling'],
      iconBg:      '#1A4731',
      accentText:  '#1A4731',
    },
    {
      id:          'payroll',
      title:       'Payroll & Audit',
      description: 'UK PAYE, Ethiopian payroll withholding and pension auto-enrolment managed end to end. ETICPA-standard audit and assurance for Ethiopian entities and diaspora businesses.',
      href:        '/get-help',
      highlights:  ['UK PAYE processing', 'Ethiopian payroll', 'Pension auto-enrolment', 'ETICPA-standard audit'],
      iconBg:      '#1A4731',
      accentText:  '#1A4731',
    },
  ]
  const etStudyPillars = [
    {
      id:          'eticpa',
      title:       'ETICPA / CPA',
      description: "Ethiopia's national accountancy body. The CPA and ATQ qualifications for finance professionals working in or with Ethiopia.",
      href:        '/study/eticpa',
      highlights:  ['CPA Professional', 'ATQ Foundation', 'ATQ Advanced', 'Ethiopian Taxation'],
    },
    {
      id:          'acca',
      title:       'ACCA',
      description: 'The global gold standard in professional accounting. All 13 papers covered with study notes, practice questions and mock exams.',
      href:        '/study/acca',
      highlights:  ['All 13 papers', 'Study notes', 'Practice questions', 'Mock exams'],
    },
    {
      id:          'cima',
      title:       'CIMA',
      description: "The world's largest management accounting body. Certificate to Strategic level — full coverage for every stage of your journey.",
      href:        '/study/cima',
      highlights:  ['Certificate level', 'Operational level', 'Management level', 'Strategic level'],
    },
    {
      id:          'aat',
      title:       'AAT',
      description: 'The practical accounting qualification. Level 2, 3 and 4 fully covered — the ideal foundation before ACCA or CIMA.',
      href:        '/study/aat',
      highlights:  ['Level 2 Foundation', 'Level 3 Advanced', 'Level 4 Professional', 'Free to start'],
    },
  ]
  const etTrustPoints = [
    {
      title: 'The Vetting Premium',
      body: 'Every professional in our network is qualified, referenced, licensed and performance-monitored. You never deal with an unverified provider.',
    },
    {
      title: 'The Convenience Premium',
      body: 'One inquiry. One point of contact. EthioTax manages every step from brief to delivery - you focus on your business, not your accountant.',
    },
    {
      title: 'The Community Premium',
      body: 'We understand Amharic, Afaan Oromoo, ERCA, Ethiopian business law and the cross-border reality of diaspora life. Generalist firms do not.',
    },
    {
      title: 'The Quality Assurance Premium',
      body: 'Every deliverable is reviewed by EthioTax before it reaches you. No raw output. No surprises. Guaranteed professional standard.',
    },
    {
      title: 'The Cross-Border Expertise Premium',
      body: 'UK, USA, Canada, UAE, Ethiopia and beyond. We coordinate professionals across every jurisdiction the diaspora calls home.',
    },
    {
      title: 'The Relationship Continuity Premium',
      body: 'EthioTax remembers every engagement. We track your deadlines, send annual reminders and proactively advise as your needs grow.',
    },
    {
      title: 'The Amharic Accessibility Premium',
      body: 'Professional financial services in your language. English, Amharic or Afaan Oromoo - you choose, we deliver.',
    },
    {
      title: 'The Ecosystem Premium',
      body: 'EthioTax is the first pillar of a complete Ethiopian financial services ecosystem. BirrBank finance marketplace coming next.',
    },
  ]
  const eticpaCard = {
    code:        'ETICPA',
    slug:        'eticpa',
    description: "Ethiopia's national accountancy body — CPA and ATQ qualifications for finance professionals.",
    accent:      'bg-[#1A4731]',
    badgeBg:     'bg-[#f0f7f4]',
    badgeText:   'text-[#1A4731]',
    highlights:  ['CPA Professional', 'ATQ Foundation', 'ATQ Advanced', 'Ethiopian Taxation'],
  }
  const activeQualificationPaths = isEthioTax
    ? [eticpaCard, ...qualificationPaths.filter(q => q.slug !== 'icaew')]
    : qualificationPaths
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
              {isEthioTax ? "For the Ethiopian Community — Worldwide · አማርኛ · Afaan Oromoo" : "Professional Accounting Services · Study Platform · Trusted Since 2018"}
            </p>

            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              {isEthioTax ? 'The accounting experts' : 'Your accounting'}
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {isEthioTax ? 'built for Ethiopia' : 'education & services'}
              </span>
              <br />
              {isEthioTax ? 'and its diaspora.' : 'platform.'}
            </h1>

            <p className="text-white/65 text-xl leading-relaxed mb-6 max-w-2xl">
              {isEthioTax ? 'EthioTax delivers professional accounting, tax, audit, payroll and business consulting to Ethiopian individuals and businesses — in Ethiopia and across the global diaspora. Qualified professionals. Amharic and Afaan Oromoo service available.' : 'Study for globally recognised accounting and finance qualifications with expert notes and practice questions — and access our managed professional services network for tax, audit, bookkeeping, and advisory.'}
            </p>
            <p className="text-white/40 text-base leading-relaxed mb-10 max-w-2xl">
              {isEthioTax ? 'UK · USA · Canada · UAE · Ethiopia · Sweden · Australia' : 'One platform. Two pillars. Education and professional services, managed to the same standard.'}
            </p>

            <div className="flex flex-col sm:flex-row items-stretch gap-3 mb-16">
              <Link
                href={isEthioTax ? "https://wa.me/447825730440?text=Hello%20EthioTax%2C%20I%20would%20like%20to%20enquire%20about%20your%20services." : "/study"}
                target={isEthioTax ? "_blank" : undefined}
                rel={isEthioTax ? "noopener noreferrer" : undefined}
                className="sm:flex-1 inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold"
              >
                {isEthioTax ? 'Talk to us on WhatsApp' : 'Start studying free'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href={isEthioTax ? "/get-help" : "/get-help"}
                className="sm:flex-1 inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-base font-medium text-white border border-white/25 hover:bg-white/10 hover:border-white/40 transition-all"
              >
                {isEthioTax ? 'Explore our services' : 'Explore our services'}
              </Link>
            </div>

            {/* Search box */}
            <div className="w-full mb-10">
              <HeroSearch placeholder={isEthioTax ? "Search tax guides, accounting articles, ETICPA resources…" : "Search study notes, practice questions, glossary…"} />
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              {(isEthioTax ? [
                { value: 'Tax & Accounting', label: 'for individuals & businesses' },
                { value: 'Cross-Border', label: 'expertise' },
                { value: 'Amharic & Afaan Oromoo', label: 'service available' },
                { value: 'Global', label: 'diaspora coverage' },
              ] : [
                { value: '3,000+',   label: 'articles' },
                { value: '20,000+',  label: 'practice questions' },
                { value: 'Top Global Qualifications', label: '' },
                { value: 'Free',     label: 'to start' },
              ]).map(item => (
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
            {activeQualificationPaths.map(q => (
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
            Accounting Body is an independent study platform and is not affiliated with,
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
            <h2 className="section-title mb-4">{isEthioTax ? 'Five steps to a managed service' : 'Three steps to exam success'}</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              {isEthioTax ? 'From your first inquiry to long-term financial partnership — EthioTax manages every step.' : 'From choosing your qualification to walking into the exam room with confidence.'}
            </p>
          </div>

          <div className={`grid grid-cols-1 gap-0 ${isEthioTax ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
            {(isEthioTax ? etHowItWorks : howItWorks).map((step, i) => (
              <div key={step.step} className="relative flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-8">

                {/* Connector line between steps */}
                {i < (isEthioTax ? etHowItWorks : howItWorks).length - 1 && (
                  <div className="hidden md:block absolute top-9 left-[calc(50%+2.5rem)] right-0 h-px bg-slate-200" />
                )}

                {/* Step number circle */}
                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-gold-500 mb-6 shadow-sm">
                  <span className="font-display text-xl font-bold text-gold-500">{step.step}</span>
                </div>

                <h3 className="font-display text-lg text-navy-950 mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex justify-center">
            <Link
              href={isEthioTax ? "/get-help" : "/study"}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
            >
              {isEthioTax ? 'Get a free quote' : 'Start your journey'}
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

          {isEthioTax ? (
            <>
              {/* ── Section header ── */}
              <div className="text-center max-w-3xl mx-auto mb-14">
                <span className="eyebrow mb-3 block">What EthioTax Offers</span>
                <h2 className="section-title mb-4">Professional services and study — everything in one place</h2>
                <p className="text-slate-500 text-lg leading-relaxed">
                  EthioTax delivers fully managed professional services for the Ethiopian community, and a world-class study platform for the next generation of Ethiopian finance professionals.
                </p>
              </div>

              {/* ── Top half: Professional Services ── */}
              <div className="mb-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white">
                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#1A4731'}} />
                    <span className="text-xs font-semibold uppercase tracking-widest" style={{color: '#1A4731'}}>Professional Services</span>
                  </div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {etPillars.map((pillar) => (
                    <Link
                      key={pillar.id}
                      href={pillar.href}
                      className="group flex flex-col bg-white rounded-xl border-2 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                      style={{borderColor: '#1A4731'}}
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{backgroundColor: '#1A4731'}}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="1.75" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="font-display text-lg mb-2 group-hover:opacity-80 transition-colors" style={{color: '#1A4731'}}>
                        {pillar.title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">
                        {pillar.description}
                      </p>
                      <ul className="space-y-1.5 mb-5">
                        {pillar.highlights.map(h => (
                          <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor: '#C9982A'}} />
                            {h}
                          </li>
                        ))}
                      </ul>
                      <span className="flex items-center gap-1.5 text-xs font-semibold group-hover:gap-2.5 transition-all" style={{color: '#1A4731'}}>
                        Get a free quote
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              {/* ── Bottom half: Study Platform ── */}
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 bg-white">
                    <span className="w-2 h-2 rounded-full bg-teal-600" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-teal-700">Study Platform</span>
                  </div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {etStudyPillars.map((pillar) => (
                    <Link
                      key={pillar.id}
                      href={pillar.href}
                      className="group flex flex-col bg-white rounded-xl border-2 border-slate-200 p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                    >
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-teal-600">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="1.75" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <h3 className="font-display text-lg text-teal-700 mb-2 group-hover:opacity-80 transition-colors">
                        {pillar.title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-4 flex-1">
                        {pillar.description}
                      </p>
                      <ul className="space-y-1.5 mb-5">
                        {pillar.highlights.map(h => (
                          <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-teal-600" />
                            {h}
                          </li>
                        ))}
                      </ul>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 group-hover:gap-2.5 transition-all">
                        Start studying free
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="max-w-2xl mb-12">
                <span className="eyebrow mb-3 block">The Full Platform</span>
                <h2 className="section-title mb-4">Education and professional services, in one place</h2>
                <p className="text-slate-500 text-lg leading-relaxed">
                  Accounting Body combines a world-class accounting study platform with a managed professional services network. Whether you are studying for your exams or need expert accounting support — we have you covered.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
            </>
          )}

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
              <h2 className="section-title">Latest Insights</h2>
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
              href="/study"
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
      {isEthioTax ? (
        /* ── EthioTax: Why EthioTax ── */
        <section className="section bg-slate-50">
          <div className="container-site">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="eyebrow mb-3 block">Why EthioTax</span>
              <h2 className="section-title mb-4">Eight reasons the community trusts us</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                EthioTax is not a directory. We are not a marketplace. We are a fully managed professional services coordinator built specifically for the Ethiopian community.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
              {etTrustPoints.map((point, i) => (
                <div key={point.title} className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 text-white text-sm font-bold shrink-0" style={{backgroundColor: '#1A4731'}}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <h4 className="font-semibold text-sm mb-2" style={{color: '#1A4731'}}>{point.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{point.body}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg max-w-2xl mx-auto">
              <div className="p-8 relative overflow-hidden" style={{backgroundColor: '#1A4731'}}>
                <div
                  className="absolute inset-0 opacity-20"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #C9982A 0%, transparent 50%)' }}
                />
                <div className="relative z-10">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{color: '#C9982A'}}>
                    Client experience
                  </p>
                  <div className="text-6xl font-display leading-none mb-2 opacity-60" style={{color: '#C9982A'}}>&ldquo;</div>
                  <p className="text-white text-base leading-relaxed mb-6">
                    EthioTax handled my UK self-assessment and my Ethiopian business accounts at the same time. One contact, one invoice, zero stress. I did not have to explain my situation twice.
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{backgroundColor: '#C9982A', color: '#1A4731'}}>
                      T
                    </div>
                    <div>
                      <span className="text-white text-sm font-semibold block">Tigist A.</span>
                      <span className="text-white/50 text-xs">Business owner, London</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-200 bg-white">
                <div className="p-5 flex flex-col items-center text-center">
                  <span className="font-display text-2xl leading-none mb-1" style={{color: '#1A4731'}}>24hr</span>
                  <span className="text-slate-500 text-xs font-medium">Response guarantee</span>
                </div>
                <div className="p-5 flex flex-col items-center text-center">
                  <span className="font-display text-2xl leading-none mb-1" style={{color: '#1A4731'}}>72hr</span>
                  <span className="text-slate-500 text-xs font-medium">Fixed-fee proposal</span>
                </div>
                <div className="p-5 flex flex-col items-center text-center">
                  <span className="font-display text-2xl leading-none mb-1" style={{color: '#1A4731'}}>100%</span>
                  <span className="text-slate-500 text-xs font-medium">Quality checked</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* ── AccountingBody: original section unchanged ── */
        <section className="section bg-slate-50">
          <div className="container-site">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

              <div>
                <span className="eyebrow mb-3 block">Why Accounting Body</span>
                <h2 className="section-title mb-6">Content you can actually trust</h2>
                <p className="text-slate-500 text-lg leading-relaxed mb-8">
                  The internet is full of accounting content written by people who have
                  never sat an exam. Every piece of content on Accounting Body is written
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
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg">

                  {/* Quote card */}
                  <div className="bg-navy-950 p-8 relative overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 50%)' }}
                    />
                    <div className="relative z-10">
                      <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-5">
                        Student experience
                      </p>
                      <div className="text-gold-500 text-6xl font-display leading-none mb-2 opacity-60">&ldquo;</div>
                      <p className="text-white text-base leading-relaxed mb-6">
                        Accounting Body has been my go-to resource throughout my
                        qualification journey. The study notes and practice questions
                        are genuinely exam standard.
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 text-sm font-bold shrink-0">
                          S
                        </div>
                        <div>
                          <span className="text-white text-sm font-semibold block">Sarah M.</span>
                          <span className="text-white/50 text-xs">Professional accounting student, UK</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white">
                    <div className="p-6 flex flex-col items-center text-center">
                      <span className="font-display text-3xl text-navy-950 leading-none mb-1">Since 2018</span>
                      <span className="text-slate-500 text-xs font-medium">Trusted by educators</span>
                    </div>
                    <div className="p-6 flex flex-col items-center text-center">
                      <span className="font-display text-3xl text-navy-950 leading-none mb-1">Top Global</span>
                      <span className="text-slate-500 text-xs font-medium">Qualifications covered</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>
      )}


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
              <p className="font-display text-xl text-navy-950">Ready to get started?</p>
              <p className="text-sm text-slate-500 mt-0.5">Study for free — or engage our professional services team.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/get-help"
                className="h-10 px-5 flex items-center text-sm font-medium rounded-lg border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors"
              >
                Explore our services
              </Link>
              <Link
                href="/study"
                className="h-10 px-5 flex items-center text-sm font-semibold rounded-lg bg-navy-950 text-white hover:bg-navy-900 transition-colors shadow-sm"
              >
                Start studying free
              </Link>
            </div>
          </div>
        </div>
      </section>

    </>
  )
}
