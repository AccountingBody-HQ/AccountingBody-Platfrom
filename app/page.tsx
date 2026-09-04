// app/page.tsx
// Accounting Body.com — Homepage (Session 4 Redesign)
// Structure: Hero → Qualification Paths → How It Works → Platform Features → Stats → Articles → Trust → Email → CTA

import React from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import EmailSignupForm from '@/components/EmailSignupForm'
import HomepageJobSearch from '@/components/HomepageJobSearch'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedArticle {
  id:              string
  title:           string
  slug:            string
  excerpt?:        string
  category?:       string
  category_title?: string
  exam_body?:      string[]
  read_time?:      number
  published_at?:   string
}

// ── Supabase fetch ───────────────────────────────────────────────────────────

async function getFeaturedArticles(siteCode: string): Promise<FeaturedArticle[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, category, category_title, exam_body, read_time, published_at')
      .eq('status', 'published')
      .contains('show_on_sites', [siteCode])
      .order('published_at', { ascending: false })
      .limit(4)
    if (error || !data) return []
    return data as FeaturedArticle[]
  } catch {
    return []
  }
}


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
    title: 'Find your next role',
    body:  'Browse 250,000+ live accounting and finance vacancies. Filter by role, location and contract type. New roles added every day.',
  },
  {
    step:  '02',
    title: 'Test and build your skills',
    body:  '20,000+ practice questions across ACCA, CIMA, AAT and ICAEW. Exam-standard MCQs with instant marking and detailed explanations.',
  },
  {
    step:  '03',
    title: 'Get placed or get help',
    body:  'Register for managed recruitment and let our team match you to permanent or contract roles. Or engage our professional services for tax, audit and advisory.',
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
    sublabel: 'Guides, briefs and technical resources',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    value:    '20,000+',
    label:    'Practice Questions',
    sublabel: 'ACCA, CIMA, AAT and ICAEW',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value:    'Since 2018',
    label:    'Trusted Platform',
    sublabel: 'Built for accounting and finance professionals',
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

// ── Sub-components ────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: FeaturedArticle }) {
  const examBodyFirst = Array.isArray(article.exam_body) ? article.exam_body[0] : article.exam_body
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
  // Not tracked in Supabase yet — kept as always-off so the badges below stay dead code, not deleted markup.
  const isHotTopic = false
  const insightTag: string | null = null

  return (
    <article className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative">
      <div className="h-1" style={{ backgroundColor: bodyColor }} />
      {isHotTopic && (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-black uppercase tracking-wider"
            style={{ background: '#f43f5e', color: '#fff' }}>
            🔥 Hot
          </span>
        </div>
      )}
      <div className="flex flex-col flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {insightTag && (
            <span className="text-[0.6rem] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(212,160,23,0.1)', color: '#B8860B', border: '1px solid rgba(212,160,23,0.25)' }}>
              {tagLabels[insightTag] ?? insightTag}
            </span>
          )}
          {article.category_title && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {article.category_title}
            </span>
          )}
        </div>
        <Link href={`/articles/${article.slug}`} className="block mb-2 flex-1">
          <h3 className="font-display text-lg text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
            {article.title}
          </h3>
        </Link>
        {article.excerpt && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-4">{article.excerpt}</p>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
          {article.read_time && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                <path strokeLinecap="round" strokeWidth="2" d="M12 6v6l4 2"/>
              </svg>
              {article.read_time} min
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
function EmailSignupSection({ isEthioTax = false }: { isEthioTax?: boolean }) {
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
            Jobs, placements and exam tips — straight to your inbox
          </h2>
          <p className="text-white/65 text-lg mb-8 leading-relaxed">
            New accounting and finance jobs, managed placement updates, and exam-standard practice question releases — delivered weekly. Written for accounting professionals. No spam, ever.
          </p>
          <EmailSignupForm isEthioTax={isEthioTax} />
          <div className="w-full flex justify-center mt-4">
            <p className="text-white/35 text-xs text-center">Join accounting and finance professionals. Unsubscribe any time.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default async function HomePage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const sp = await searchParams
  const confirmedStatus = sp.confirmed
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const etTrustPoints = [
    {
      number: '01',
      title: 'Verified Professionals Only',
      body: 'Every specialist in the EthioTax network is qualified, referenced and performance-monitored. You never deal with an unverified provider — ever.',
      stat: '100%', statLabel: 'Verified',
    },
    {
      number: '02',
      title: 'Built for the Ethiopian Community',
      body: 'We understand Amharic, Afaan Oromoo, ERCA, Ethiopian business law and the cross-border reality of diaspora life. Generalist firms simply do not.',
      stat: '4+', statLabel: 'Languages',
    },
    {
      number: '03',
      title: 'Every Deliverable Reviewed',
      body: 'EthioTax quality-checks every piece of work before it reaches you. No raw output. No surprises. A guaranteed professional standard, every time.',
      stat: '100%', statLabel: 'Quality Checked',
    },
    {
      number: '04',
      title: 'Global Diaspora Coverage',
      body: 'UK, USA, Canada, UAE, Ethiopia and beyond. Our specialists operate across every jurisdiction the diaspora calls home — one firm, every border.',
      stat: '6+', statLabel: 'Countries',
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
  const featuredArticles = await getFeaturedArticles(isEthioTax ? 'et' : 'ab')
  const articles = featuredArticles

  return (
    <>
      {confirmedStatus === 'true' && (
        <div className={`w-full text-center text-sm font-medium py-3 px-4 ${isEthioTax ? 'bg-[#1A4731]' : 'bg-navy-950'} text-white`}>
          You&apos;re subscribed — welcome! Great to have you on board.
        </div>
      )}
      {confirmedStatus === 'already' && (
        <div className={`w-full text-center text-sm font-medium py-3 px-4 ${isEthioTax ? 'bg-[#1A4731]' : 'bg-navy-950'} text-white`}>
          You were already subscribed — no further action needed.
        </div>
      )}
      {(confirmedStatus === 'invalid' || confirmedStatus === 'error') && (
        <div className="w-full text-center text-sm font-medium py-3 px-4 bg-red-50 text-red-700">
          That confirmation link is invalid or has expired. Please subscribe again from the footer.
        </div>
      )}

      {isEthioTax ? (
        <>

{/* ══════════════════════════════════════════════════════
    1. HERO — two-column, services-led
    ══════════════════════════════════════════════════════ */}
<section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1A4731 0%, #0d2b1f 100%)' }}>

  {/* Background layers */}
  <div className="absolute inset-0 pointer-events-none">
    <div
      className="absolute inset-0 opacity-[0.035]"
      style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }}
    />
    <div
      className="absolute bottom-0 left-0 w-full h-1/2 opacity-[0.08]"
      style={{ background: 'linear-gradient(to top, #0d2b1f 0%, transparent 100%)' }}
    />
  </div>

  <div className="container-site relative z-10 py-16 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start lg:items-center">

    {/* LEFT COLUMN */}
    <div className="lg:col-span-1">

      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
        style={{ background: 'rgba(201,152,42,0.15)', border: '1px solid rgba(201,152,42,0.3)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#C9982A' }} />
        <span className="text-xs font-semibold uppercase tracking-widest leading-tight" style={{ color: '#C9982A' }}>
          <span className="sm:hidden">Services · Study · Jobs</span>
          <span className="hidden sm:inline">Professional Services · Study · Jobs · አማርኛ · Afaan Oromoo</span>
        </span>
      </div>

      <h1
        className="font-display text-white mb-6 leading-[1.06]"
        style={{ fontSize: 'clamp(2.6rem, 5vw, 4rem)', letterSpacing: '-0.025em' }}
      >
        <>
          <span
            style={{
              background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              display: 'block',
            }}
          >
            Accounting &amp; finance jobs.
          </span>
          Expert services.
          <br />
          Exam practice.
          <br />
          <span className="text-white">Built for Ethiopia.</span>
        </>
      </h1>

      <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-xl">
        1,000+ accounting and finance jobs for the Ethiopian diaspora. Expert professional services across tax, accounting and consulting. ETICPA, ACCA, CIMA and AAT exam practice — all in one place.
      </p>

      <div className="flex flex-col gap-3 mb-8 w-full max-w-2xl">
        <Link
          href="/jobs/listings"
          className="w-full inline-flex items-center justify-center gap-2 h-13 px-7 rounded-xl text-base font-semibold transition-all hover:opacity-90"
          style={{ backgroundColor: '#C9982A', color: '#0f2d1e' }}
        >
          Find a job
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/get-help"
            className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-xl text-base font-semibold transition-all hover:opacity-90 text-white border-2"
            style={{ borderColor: 'rgba(201,152,42,0.5)', background: 'rgba(255,255,255,0.08)' }}
          >
            Get expert help
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link
            href="/wa"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-xl text-base font-semibold transition-all hover:opacity-80 border-2 text-white"
            style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'transparent' }}
          >
            WhatsApp us
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-2xl">
        {[
          '1,000+ diaspora accounting jobs',
          'ETICPA · ACCA · CIMA · AAT',
          'UK · USA · Canada · UAE · Ethiopia',
        ].map(label => (
          <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-white/50">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="#C9982A" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            {label}
          </span>
        ))}
      </div>

      <div className="mt-5 flex justify-center lg:justify-start">
        <Link
          href="/jobs/post-a-job"
          className="inline-flex items-center gap-2 h-10 rounded-xl px-5 text-sm font-semibold transition-all duration-200 group"
          style={{ border: '1.5px solid rgba(201,152,42,0.6)', color: '#C9982A', background: 'transparent' }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(201,152,42,0.08)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#C9982A' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(201,152,42,0.6)' }}
        >
          <span className="text-[10px]" aria-hidden="true">◆</span>
          <span className="text-white/80 group-hover:text-white transition-colors duration-200 font-medium text-sm">Hiring in Ethiopia?</span>
          <span className="font-semibold text-sm">Post a job from £9 →</span>
        </Link>
      </div>

    </div>

    {/* RIGHT COLUMN — two equal cards */}
    <div className="relative">
      <div className="flex flex-col gap-4">

        {/* CARD 1 — Professional Services */}
        <div
          className="flex-1 rounded-2xl overflow-hidden border flex flex-col"
          style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>Professional Services</p>
            <h3 className="font-display text-white text-lg mt-1 leading-snug">Fully managed — fixed-fee proposals in 72 hours</h3>
          </div>

          <div className="flex flex-col gap-2 p-5 flex-1">
            {[
              { label: 'Tax & Self Assessment', desc: 'UK, US, Ethiopian ERCA and cross-border filings' },
              { label: 'Accounting & Bookkeeping', desc: 'Monthly accounts, management reports, Xero setup' },
              { label: 'Business Consulting', desc: 'Company formation, diaspora investment, financial modelling' },
              { label: 'Payroll & Audit', desc: 'UK PAYE, Ethiopian payroll, ETICPA-standard audit' },
            ].map(item => (
              <div
                key={item.label}
                className="flex flex-col rounded-xl px-4 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-white/80 text-xs font-semibold">{item.label}</p>
                <p className="text-white/40 text-xs leading-snug mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5">
            <Link
              href="/get-help"
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#C9982A', color: '#0f2d1e' }}
            >
              Get a free quote →
            </Link>
          </div>
        </div>

        {/* CARD 2 — Study Platform */}
        <div
          className="flex-1 rounded-2xl overflow-hidden border flex flex-col"
          style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>Exam Practice</p>
            <h3 className="font-display text-white text-lg mt-1 leading-snug">20,000+ exam-standard questions — free to start</h3>
          </div>

          <div className="flex flex-col gap-2 p-5 flex-1">
            {[
              { badge: 'ETICPA', badgeBg: 'bg-[#f0f7f4]', badgeText: 'text-[#1A4731]', body: "Ethiopia's national accountancy body — CPA and ATQ qualifications" },
              { badge: 'ACCA', badgeBg: 'bg-blue-50', badgeText: 'text-[#004B8D]', body: 'All 13 papers — Applied Knowledge to Strategic Professional' },
              { badge: 'CIMA', badgeBg: 'bg-sky-50', badgeText: 'text-[#0081C6]', body: 'Certificate to Strategic level, including Case Study prep' },
              { badge: 'AAT', badgeBg: 'bg-teal-50', badgeText: 'text-teal-700', body: 'Level 2 Foundation through Level 4 Professional Diploma' },
            ].map(item => (
              <div
                key={item.badge}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${item.badgeBg} ${item.badgeText}`} translate="no">
                  {item.badge}
                </span>
                <p className="text-white/55 text-xs leading-snug">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5">
            <Link
              href="/practice-questions"
              className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ border: '1.5px solid rgba(201,152,42,0.5)', color: '#C9982A', background: 'transparent' }}
            >
              Start practising free →
            </Link>
          </div>
        </div>

      </div>
    </div>

  </div>
</section>

{/* ══════════════════════════════════════════════════════
    2. SERVICES STRIP — 4 service cards
    ══════════════════════════════════════════════════════ */}
<section className="bg-white border-b border-slate-100">
  <div className="container-site py-14 md:py-20">

    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
      <div>
        <span className="eyebrow mb-2 block">Professional Services</span>
        <h2 className="section-title">Fully managed accounting and finance services</h2>
        <p className="text-slate-500 text-base mt-2 max-w-xl">
          Fixed-fee proposals within 72 hours. Every engagement reviewed personally. UK, USA, Canada, UAE and Ethiopia covered.
        </p>
      </div>
      <Link
        href="/get-help"
        className="hidden md:flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap transition-colors"
        style={{ color: '#1A4731' }}
      >
        View all services →
      </Link>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {[
        {
          title: 'Tax & Self Assessment',
          desc: 'UK Self Assessment, US returns, Ethiopian ERCA filings and cross-border treaty claims.',
          icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z',
        },
        {
          title: 'Accounting & Bookkeeping',
          desc: 'Monthly bookkeeping, annual accounts, management reporting and Xero setup.',
          icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        },
        {
          title: 'Business Consulting',
          desc: 'Company formation, business plans, diaspora investment structuring and financial modelling.',
          icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        },
        {
          title: 'Payroll & Audit',
          desc: 'UK PAYE, Ethiopian payroll withholding, pension auto-enrolment and ETICPA-standard audit.',
          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
        },
      ].map(service => (
        <Link
          key={service.title}
          href="/get-help"
          className="rounded-xl border border-slate-200 p-5 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer flex flex-col"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0"
            style={{ backgroundColor: '#f0f7f4' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="#1A4731" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" d={service.icon} />
            </svg>
          </div>
          <h3 className="font-display text-navy-950 text-base font-semibold mb-2">{service.title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed flex-1">{service.desc}</p>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-xs font-semibold transition-colors" style={{ color: '#1A4731' }}>
              Get a free quote →
            </span>
          </div>
        </Link>
      ))}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto mt-6">
      <Link
        href="/get-help"
        className="h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors w-full"
        style={{ background: '#1A4731' }}
      >
        Get expert help →
      </Link>
      <Link
        href="/wa"
        target="_blank"
        rel="noopener noreferrer"
        className="h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors w-full"
        style={{ border: '2px solid #1A4731', color: '#1A4731', background: 'transparent' }}
      >
        WhatsApp us
      </Link>
    </div>

  </div>
</section>

{/* ══════════════════════════════════════════════════════
    3. WHY ETHIOTAX — existing green trust section, kept exactly as-is
    ══════════════════════════════════════════════════════ */}
<section className="relative overflow-hidden py-24" style={{ backgroundColor: '#1A4731' }}>
  <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
  <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none"
    style={{ background: 'radial-gradient(ellipse at top right, #C9982A 0%, transparent 60%)' }} />

  <div className="container-site relative z-10">
    <div className="max-w-3xl mb-16">
      <p className="text-[#C9982A] text-[11px] font-bold uppercase tracking-[0.15em] mb-4">Why EthioTax</p>
      <h2 className="font-display text-white text-4xl md:text-5xl leading-tight mb-5" style={{ letterSpacing: '-0.02em' }}>
        Not a directory.<br />Not a marketplace.<br />A managed service.
      </h2>
      <p className="text-white/55 text-lg leading-relaxed max-w-2xl">
        EthioTax is built exclusively for the Ethiopian community — every professional vetted, every deliverable reviewed, every engagement managed end to end.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {etTrustPoints.map((point) => (
        <div key={point.title}
          className="group relative flex flex-col rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="absolute top-0 left-7 right-7 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ backgroundColor: '#C9982A' }} />
          <p className="font-display text-[48px] leading-none font-bold mb-5 opacity-20 text-white" translate="no">{point.number}</p>
          <h3 className="font-display text-white text-[17px] font-bold mb-3 leading-snug">{point.title}</h3>
          <p className="text-white/55 text-sm leading-relaxed flex-1 mb-6">{point.body}</p>
          <div className="pt-5 border-t border-white/10 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold" style={{ color: '#C9982A' }}>{point.stat}</span>
            <span className="text-white/40 text-xs font-medium uppercase tracking-wider">{point.statLabel}</span>
          </div>
        </div>
      ))}
    </div>

    <div className="mt-14 flex flex-col sm:flex-row items-start gap-4">
      <Link href="/get-help"
        className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
        style={{ backgroundColor: '#C9982A', color: '#1A4731', width: '280px', minHeight: '56px' }}>
        Get a free quote
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
      <Link href="/wa" target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/10"
        style={{ borderColor: 'rgba(255,255,255,0.25)', color: 'white', width: '280px', minHeight: '56px' }}>
        WhatsApp us
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </div>
  </div>
</section>

{/* ══════════════════════════════════════════════════════
    4. STUDY PLATFORM PILLAR — mirrors AB Practice Questions section
    ══════════════════════════════════════════════════════ */}
<section className="section bg-slate-50">
  <div className="container-site">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

      {/* LEFT — content */}
      <div>
        <span className="eyebrow mb-3 block">Exam Practice Questions</span>
        <h2 className="section-title mb-4">20,000+ exam-standard questions — free to start</h2>
        <p className="text-slate-500 text-lg leading-relaxed mb-8">
          ETICPA, ACCA, CIMA and AAT question banks. Exam-standard MCQs with instant marking and detailed explanations. Track your progress and walk into the exam room ready.
        </p>

        <div className="space-y-4">
          {[
            {
              title: 'ETICPA and international qualifications covered',
              body: "Ethiopia's national accountancy body alongside ACCA, CIMA and AAT — all in one platform.",
              d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
            },
            {
              title: 'Instant marking and detailed explanations',
              body: 'Every question marked instantly with a full worked explanation written by qualified accountants.',
              d: 'M13 10V3L4 14h7v7l9-11h-7z',
            },
            {
              title: 'Track your progress by topic',
              body: 'See which topics you have mastered and where you need more practice before exam day.',
              d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
            },
            {
              title: 'Free to start — no credit card required',
              body: 'Core question banks permanently free. Study notes, practice questions and the full glossary at no cost.',
              d: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
            },
          ].map(row => (
            <div key={row.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#f0f7f4' }}>
                <svg className="w-5 h-5" fill="none" stroke="#1A4731" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={row.d} />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-navy-950 mb-0.5">{row.title}</h4>
                <p className="text-sm text-slate-500">{row.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-10">
          <Link
            href="/practice-questions"
            className="h-12 px-8 inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: '#1A4731' }}
          >
            Start practising free →
          </Link>
          <Link
            href="/study/eticpa"
            className="h-12 px-8 inline-flex items-center gap-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ border: '2px solid #C9982A', color: '#C9982A', background: 'transparent' }}
          >
            Explore ETICPA →
          </Link>
        </div>
      </div>

      {/* RIGHT — question bank card */}
      <div className="relative">
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">

          <div className="px-7 pt-7 pb-6" style={{ background: '#1A4731' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#C9982A' }}>Question bank</p>
            <p className="font-display text-white text-2xl">20,000+ questions</p>
            <p className="text-white/50 text-sm mt-1">ETICPA · ACCA · CIMA · AAT — all in one place</p>
          </div>

          <div className="divide-y divide-slate-100">
            {[
              { badge: 'ETICPA', badgeBg: 'bg-[#f0f7f4]', badgeText: 'text-[#1A4731]', stats: "Ethiopia's national accountancy body — CPA and ATQ" },
              { badge: 'ACCA', badgeBg: 'bg-blue-50', badgeText: 'text-[#004B8D]', stats: 'The global standard for accounting professionals' },
              { badge: 'CIMA', badgeBg: 'bg-sky-50', badgeText: 'text-[#0081C6]', stats: "The world's largest management accounting body" },
              { badge: 'AAT', badgeBg: 'bg-teal-50', badgeText: 'text-teal-700', stats: 'The practical accounting foundation qualification' },
            ].map(row => (
              <div key={row.badge} className="flex items-center justify-between px-7 py-4">
                <span className={`text-xs font-bold px-2.5 py-1 rounded ${row.badgeBg} ${row.badgeText}`} translate="no">
                  {row.badge}
                </span>
                <span className="text-sm text-slate-500 text-right max-w-[200px]">{row.stats}</span>
              </div>
            ))}
          </div>

          <div className="px-7 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">Instant marking · Detailed solutions · Free to start</p>
            <Link href="/practice-questions" className="text-xs font-semibold transition-colors" style={{ color: '#1A4731' }}>
              Browse questions →
            </Link>
          </div>
        </div>
      </div>

    </div>
  </div>
</section>

{/* ══════════════════════════════════════════════════════
    5. LATEST INSIGHTS
    ══════════════════════════════════════════════════════ */}
<section className="section" style={{ backgroundColor: '#f0f7f4' }}>
  <div className="container-site">
    <div className="flex items-end justify-between mb-10 gap-4">
      <div>
        <span className="eyebrow mb-3 block">Daily Digest</span>
        <h2 className="section-title">Latest from EthioTax</h2>
        <p className="text-slate-500 text-base leading-relaxed mt-2 max-w-xl">
          Industry updates, tax briefs and insights for Ethiopian finance professionals and the diaspora.
        </p>
      </div>
      <Link
        href="/articles"
        className="shrink-0 flex items-center gap-1.5 text-sm font-semibold transition-colors whitespace-nowrap"
        style={{ color: '#1A4731' }}
      >
        View all
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {articles.slice(0, 4).map(article => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>

    <div className="mt-8 text-center">
      <Link
        href="/articles"
        className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold transition-colors shadow-sm text-white hover:opacity-90"
        style={{ backgroundColor: '#1A4731' }}
      >
        Browse all insights
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </div>
  </div>
</section>

{/* ══════════════════════════════════════════════════════
    6. STATS BAR
    ══════════════════════════════════════════════════════ */}
<section className="bg-slate-50 border-y border-slate-200">
  <div className="container-site py-10">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
      {[
        { value: '24hr', label: 'Response Guarantee', sublabel: 'Every inquiry, every channel' },
        { value: '72hr', label: 'Fixed-Fee Proposal', sublabel: 'Clear scope, clear price' },
        { value: '100%', label: 'Quality Checked', sublabel: 'Every deliverable reviewed' },
        { value: 'Global', label: 'Diaspora Coverage', sublabel: 'UK, USA, Canada, UAE, Ethiopia & more' },
      ].map((stat, i) => (
        <div key={stat.label} className={`flex flex-col items-start ${i < 3 ? 'lg:border-r lg:border-slate-200 lg:pr-8' : ''}`}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: '#f0f7f4' }}>
            <span className="text-lg font-bold" style={{ color: '#1A4731' }}>✓</span>
          </div>
          <span className="stat-number mb-1" style={{ color: '#1A4731' }}><span translate="no">{stat.value}</span></span>
          <span className="text-sm font-semibold text-navy-950">{stat.label}</span>
          <span className="text-xs text-slate-400 mt-0.5">{stat.sublabel}</span>
        </div>
      ))}
    </div>
  </div>
</section>

{/* ══════════════════════════════════════════════════════
    7. TESTIMONIALS
    ══════════════════════════════════════════════════════ */}
<section className="section bg-white">
  <div className="container-site">
    <div className="max-w-2xl mb-12">
      <span className="eyebrow mb-3 block">Client Stories</span>
      <h2 className="section-title mb-4">What our clients say</h2>
      <p className="text-slate-500 text-lg leading-relaxed">
        EthioTax clients across the UK, USA and Canada share their experience.
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[
        {
          initials: 'TA',
          name: 'Tigist A.',
          role: 'Business owner — London, UK',
          quote: 'EthioTax handled my UK Self Assessment quickly and professionally. They understood my situation straight away and the whole process was straightforward. I will not be going anywhere else.',
        },
        {
          initials: 'DM',
          name: 'Dawit M.',
          role: 'Finance professional — Washington DC, USA',
          quote: 'I needed advice on structuring a diaspora investment in Ethiopia. EthioTax provided a clear proposal within 72 hours and guided me through the entire process. Excellent service.',
        },
        {
          initials: 'SG',
          name: 'Selam G.',
          role: 'Business owner — Toronto, Canada',
          quote: 'Managing accounts across two countries was always complicated. EthioTax handled everything and I could communicate in Amharic throughout. Professional, reliable and highly recommended.',
        },
      ].map((t) => (
        <div key={t.name} className="bg-white rounded-2xl p-8 shadow-sm flex flex-col h-full border border-slate-100" style={{ borderTop: '4px solid #C9982A' }}>
          <div className="flex gap-1 mb-4">
            {[1,2,3,4,5].map(s => (
              <svg key={s} width="16" height="16" viewBox="0 0 16 16" fill="#C9982A"><path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1-3-2.9 4.2-.9z"/></svg>
            ))}
          </div>
          <div className="text-4xl font-display leading-none mb-3 opacity-40" style={{ color: '#1A4731' }} translate="no">&ldquo;</div>
          <p className="text-gray-700 text-sm leading-relaxed mb-6 flex-1">{t.quote}</p>
          <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e8f0eb' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 text-white" style={{ backgroundColor: '#1A4731' }} translate="no">{t.initials}</div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
              <p className="text-gray-400 text-xs">{t.role}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

{/* ══════════════════════════════════════════════════════
    8. QUALIFICATION PATHWAYS
    ══════════════════════════════════════════════════════ */}
<section className="section" style={{ backgroundColor: '#f0f7f4' }}>
  <div className="container-site">
    <div className="max-w-2xl mb-12">
      <span className="eyebrow mb-3 block">Qualification Pathways</span>
      <h2 className="section-title mb-4">Study with EthioTax — free to start</h2>
      <p className="text-slate-500 text-lg leading-relaxed">
        Full coverage for <span translate="no">ETICPA</span>, <span translate="no">ACCA</span>, <span translate="no">CIMA</span> and <span translate="no">AAT</span> — study notes, practice questions and mock exams.
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
              <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${q.badgeBg} ${q.badgeText}`} translate="no">{q.code}</span>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed flex-1">{q.description}</p>
            <ul className="space-y-1.5 mb-5">
              {q.highlights.map(h => (
                <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${q.accent}`} />
                  {h}
                </li>
              ))}
            </ul>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${q.badgeText} group-hover:gap-2.5 transition-all`} translate="no">
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
      EthioTax is an independent study platform and is not affiliated with, endorsed by, or connected to ACCA, CIMA, ETICPA, or AAT. These names are used solely to identify the qualifications our study materials are designed to support.
    </p>
  </div>
</section>

{/* ══════════════════════════════════════════════════════
    9. EMAIL SIGNUP
    ══════════════════════════════════════════════════════ */}
<section className="section-navy section">
  <div className="container-site relative z-10">
    <div className="max-w-2xl mx-auto text-center">
      <span className="eyebrow text-gold-400 mb-4 block">Stay Ahead</span>
      <h2 className="font-display text-4xl text-white mb-4 leading-tight">
        Tax updates, exam tips and job alerts — straight to your inbox
      </h2>
      <p className="text-white/65 text-lg mb-8 leading-relaxed">
        ERCA deadlines, ETICPA news, new practice question releases and Ethiopian finance job alerts — delivered weekly. No spam, ever.
      </p>
      <EmailSignupForm isEthioTax={isEthioTax} />
      <div className="w-full flex justify-center mt-4">
        <p className="text-white/35 text-xs text-center">Join the EthioTax community. Unsubscribe any time.</p>
      </div>
    </div>
  </div>
</section>

{/* ══════════════════════════════════════════════════════
    10. BOTTOM CTA
    ══════════════════════════════════════════════════════ */}
<section className="bg-white border-t border-slate-200 py-8">
  <div className="container-site">
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
      <div>
        <p className="font-display text-xl text-navy-950">Ready to get started?</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">Get expert accounting help, practise for your ETICPA or ACCA exams, or find your next accounting role.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto sm:min-w-[520px]">
        <Link
          href="/get-help"
          className="h-11 flex items-center justify-center text-sm font-semibold rounded-xl text-white transition-colors w-full whitespace-nowrap"
          style={{ background: '#1A4731' }}
        >
          Get expert help
        </Link>
        <Link
          href="/practice-questions"
          className="h-11 flex items-center justify-center text-sm font-medium rounded-xl border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors w-full whitespace-nowrap"
        >
          Practice questions
        </Link>
        <Link
          href="/jobs/listings"
          className="h-11 flex items-center justify-center text-sm font-medium rounded-xl border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors w-full whitespace-nowrap"
        >
          Browse jobs
        </Link>
      </div>
    </div>
  </div>
</section>

        </>
      ) : (
        <>
      {/* ════════════════════════════════════════════════════════════════
          1. HERO
          ════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-navy-950">

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
            style={{ background: 'radial-gradient(ellipse at bottom right, #C9982A 0%, transparent 60%)' }}
          />
        </div>

        <div className="container-site relative z-10 py-20 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-1">

            <div
              className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{ background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.2)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-gold-400" />
              <span className="text-xs font-semibold text-gold-400 uppercase tracking-widest">
                Jobs · Practice Questions · Services
              </span>
            </div>

            <h1
              className="font-display text-white mb-6 leading-[1.06]"
              style={{ fontSize: 'clamp(2.6rem, 5vw, 4rem)', letterSpacing: '-0.025em' }}
            >
              Find jobs.
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Exam practice questions.
              </span>
              <br />
              Expert placement.
            </h1>

            <p className="text-white/55 text-lg leading-relaxed mb-10 max-w-xl">
              The dedicated platform for accounting and finance professionals. Live job listings, exam practice questions, and expert managed placement — all in one place.
            </p>

            <HomepageJobSearch />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-6 w-full max-w-2xl">
              {['250,000+ live jobs', '20,000+ practice questions', 'Free to start'].map(label => (
                <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-white/50">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="#C9982A" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-5 flex justify-center lg:justify-start">
              <Link
                href="/jobs/post-a-job"
                className="inline-flex items-center gap-2 h-10 rounded-xl px-5 text-sm font-semibold transition-all duration-200 group"
                style={{ border: '1.5px solid rgba(201,152,42,0.6)', color: '#C9982A', background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(201,152,42,0.08)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = '#C9982A' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(201,152,42,0.6)' }}
              >
                <span className="text-[10px]" aria-hidden="true">◆</span>
                <span className="text-white/80 group-hover:text-white transition-colors duration-200 font-medium text-sm">Hiring?</span>
                <span className="font-semibold text-sm">Post a job from £9 →</span>
              </Link>
            </div>

          </div>

          {/* RIGHT COLUMN */}
          <div className="relative block">

            <div className="flex flex-col gap-4 h-full">

              {/* CARD 1 — Practice Questions */}
              <div
                className="flex-1 rounded-2xl overflow-hidden border flex flex-col"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>Practice Questions</p>
                  <h3 className="font-display text-white text-lg mt-1 leading-snug">20,000+ exam-standard questions</h3>
                </div>

                <div className="flex flex-col gap-2 p-5 flex-1">
                  {[
                    { badge: 'ACCA', badgeBg: 'bg-blue-50', badgeText: 'text-[#004B8D]', body: 'All 13 papers — Applied Knowledge to Strategic Professional' },
                    { badge: 'CIMA', badgeBg: 'bg-sky-50', badgeText: 'text-[#0081C6]', body: 'Certificate to Strategic level, including Case Study prep' },
                    { badge: 'AAT', badgeBg: 'bg-teal-50', badgeText: 'text-teal-700', body: 'Level 2 Foundation through Level 4 Professional Diploma' },
                    { badge: 'ICAEW', badgeBg: 'bg-red-50', badgeText: 'text-red-800', body: 'ACA — Certificate, Professional and Advanced levels' },
                  ].map(item => (
                    <div
                      key={item.badge}
                      className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${item.badgeBg} ${item.badgeText}`} translate="no">
                        {item.badge}
                      </span>
                      <p className="text-white/55 text-xs leading-snug">{item.body}</p>
                    </div>
                  ))}
                </div>

                <div className="px-5 pb-5">
                  <Link
                    href="/practice-questions"
                    className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ background: '#C9982A', color: '#0C1A3D' }}
                  >
                    Start practising free →
                  </Link>
                </div>
              </div>

              {/* CARD 2 — Managed Recruitment */}
              <div
                className="flex-1 rounded-2xl overflow-hidden border flex flex-col"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                <div className="px-6 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>Managed Recruitment</p>
                  <h3 className="font-display text-white text-lg mt-1 leading-snug">Get personally matched to roles</h3>
                </div>

                <div className="flex flex-col gap-3 p-5 flex-1">
                  {[
                    'Permanent and contract accounting and finance roles',
                    'We represent you — you never deal with employers directly',
                    '90-day replacement guarantee on every permanent placement',
                    'Every candidate personally reviewed before activation',
                  ].map(point => (
                    <div key={point} className="flex items-start gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'rgba(212,160,23,0.2)', border: '1px solid rgba(212,160,23,0.3)' }}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="#C9982A" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-white/55 text-xs leading-snug">{point}</p>
                    </div>
                  ))}
                </div>

                <div className="px-5 pb-5">
                  <Link
                    href="/jobs/find-work"
                    className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ border: '1.5px solid rgba(212,160,23,0.5)', color: '#C9982A', background: 'transparent' }}
                  >
                    Register as a candidate →
                  </Link>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          2. JOBS PILLAR STRIP
          ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-100">
        <div className="container-site py-14 md:py-20">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="eyebrow mb-2 block">Live Accounting &amp; Finance Jobs</span>
              <h2 className="section-title">250,000+ roles updated daily</h2>
              <p className="text-slate-500 text-base mt-2 max-w-xl">
                Permanent, contract and temporary roles across the UK and internationally. Filtered to accounting and finance only.
              </p>
            </div>
            <Link
              href="/jobs/listings"
              className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-navy-700 hover:text-gold-500 transition-colors whitespace-nowrap"
            >
              Browse all jobs →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                title: 'Financial Accountant',
                descriptor: 'Permanent and contract roles across industry and practice',
                slug: 'financial+accountant',
              },
              {
                title: 'Management Accountant',
                descriptor: 'Industry and practice roles from part-qualified to senior level',
                slug: 'management+accountant',
              },
              {
                title: 'Tax Manager',
                descriptor: 'In-house and practice tax roles across all sectors and geographies',
                slug: 'tax+manager',
              },
            ].map(job => (
              <Link
                key={job.title}
                href={`/jobs/listings?role=${job.slug}`}
                className="rounded-xl border border-slate-200 p-5 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="font-display text-navy-950 text-base font-semibold leading-snug">{job.title}</span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap bg-slate-100 text-slate-600">
                    Accounting &amp; Finance
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed flex-1">{job.descriptor}</p>
                <div className="flex items-center gap-1.5 mt-4">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs text-slate-400">Global</span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-navy-700 group-hover:text-gold-500 transition-colors">
                    Search roles →
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto mt-6">
            <Link
              href="/jobs/listings"
              className="h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors w-full"
              style={{ background: '#0C1A3D' }}
            >
              Browse 250,000+ live jobs →
            </Link>
            <Link
              href="/jobs"
              className="h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors w-full"
              style={{ border: '2px solid #0C1A3D', color: '#0C1A3D', background: 'transparent' }}
            >
              Managed recruitment
            </Link>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          3. MANAGED RECRUITMENT
          ════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ background: '#C9982A' }}>

        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

        {/* Dark top border */}

        <div className="container-site relative z-10 py-16 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            {/* LEFT — 6 cols */}
            <div className="lg:col-span-6">

              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7"
                style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full"
                  style={{ background: isEthioTax ? '#0f2d1e' : '#0C1A3D' }} />
                <span className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: isEthioTax ? '#0f2d1e' : '#0C1A3D' }}>
                  {isEthioTax ? 'EthioTax Recruitment' : 'Accounting Body Recruitment'}
                </span>
              </div>

              {/* Headline */}
              <h2 className="font-display leading-[1.06] mb-6"
                style={{
                  fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
                  letterSpacing: '-0.03em',
                  color: isEthioTax ? '#0f2d1e' : '#0C1A3D',
                }}>
                {isEthioTax ? (
                  <>Finance careers<br />
                  <span style={{ opacity: 0.75 }}>built for Ethiopia</span><br />
                  and its diaspora.</>
                ) : (
                  <>Specialist<br />
                  <span style={{ opacity: 0.75 }}>accounting & finance</span><br />
                  recruitment.</>
                )}
              </h2>

              {/* Body */}
              <p className="text-base leading-relaxed mb-8 max-w-lg"
                style={{ color: isEthioTax ? 'rgba(15,45,30,0.75)' : 'rgba(12,26,61,0.75)' }}>
                {isEthioTax
                  ? <><span translate="no">ACCA</span>, <span translate="no">CIMA</span>, <span translate="no">ICAEW</span> or <span translate="no">CPA</span> qualified? We place Ethiopian finance professionals in permanent and contract roles across the UK, USA, Canada and beyond. You never deal with employers directly — we manage every step.</>
                  : 'We place accounting and finance professionals in permanent and contract roles across the UK and internationally. Fully managed — we find the right match, negotiate on your behalf, and guarantee every placement for 90 days.'}
              </p>

              {/* Trust points */}
              <div className="flex flex-col gap-3 mb-10">
                {(isEthioTax ? [
                  'Ethiopian-origin finance professionals actively placed',
                  'ICAEW, ACCA, CIMA and CPA credentials recognised',
                  '90-day replacement guarantee on every placement',
                ] : [
                  'Accounting and finance professionals',
                  'Every candidate personally reviewed before activation',
                  '90-day replacement guarantee on every permanent placement',
                ]).map(point => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: isEthioTax ? '#0f2d1e' : '#0C1A3D' }}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="#C9982A" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium"
                      style={{ color: isEthioTax ? 'rgba(15,45,30,0.85)' : 'rgba(12,26,61,0.85)' }}>
                      {point}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/jobs/find-work"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ background: isEthioTax ? '#0f2d1e' : '#0C1A3D' }}>
                  {isEthioTax ? 'Register as a candidate' : 'Register as a candidate'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link href={isEthioTax ? '/jobs/ethiopian-professionals' : '/jobs/hire-talent'}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold transition-all hover:opacity-80 border-2"
                  style={{
                    borderColor: isEthioTax ? '#0f2d1e' : '#0C1A3D',
                    color: isEthioTax ? '#0f2d1e' : '#0C1A3D',
                    background: 'transparent',
                  }}>
                  {isEthioTax ? 'Ethiopian professionals' : 'Hire talent'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* RIGHT — 6 cols — Stats card */}
            <div className="lg:col-span-6">
                <div className="rounded-2xl overflow-hidden" style={{ background: isEthioTax ? '#0f2d1e' : '#0C1A3D', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

                  {/* Card header */}
                  <div className="px-7 pt-6 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>
                        Two ways to find your next role
                      </p>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(201,152,42,0.15)', color: '#C9982A', border: '1px solid rgba(201,152,42,0.3)' }}>
                        Finance specialists
                      </span>
                    </div>
                  </div>

                  {/* Split path cards */}
                  <div className="grid grid-cols-2">

                    {/* Left — Job board */}
                    <div className="p-6 flex flex-col" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#C9982A' }}>
                        Job board
                      </p>
                      <p className="font-display text-white text-lg mb-2 leading-snug">Browse jobs</p>
                      <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Search {isEthioTax ? '1,000+' : '250,000+'} live vacancies. Filter by role, location and contract type.
                      </p>
                      <Link href="/jobs/listings"
                        className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                        style={{ background: '#C9982A', color: isEthioTax ? '#0f2d1e' : '#0C1A3D' }}>
                        Browse jobs →
                      </Link>
                    </div>

                    {/* Right — Managed placement */}
                    <div className="p-6 flex flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#C9982A' }}>
                        Managed placement
                      </p>
                      <p className="font-display text-white text-lg mb-2 leading-snug">Get matched</p>
                      <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Register once. We personally match you to roles and advocate on your behalf.
                      </p>
                      <Link href="/jobs/find-work"
                        className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                        style={{ border: '1.5px solid rgba(201,152,42,0.45)', color: '#C9982A', background: 'transparent' }}>
                        Register free →
                      </Link>
                    </div>

                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="p-5" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="font-display text-xl font-bold text-white block mb-0.5">
                        {isEthioTax ? '1,000+' : '250,000+'}
                      </span>
                      <span className="text-[10px] font-semibold block" style={{ color: '#C9982A' }}>Live roles</span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Updated daily</span>
                    </div>
                    <div className="p-5">
                      <span className="font-display text-xl font-bold text-white block mb-0.5">90 Days</span>
                      <span className="text-[10px] font-semibold block" style={{ color: '#C9982A' }}>Placement guarantee</span>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Every permanent role</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-7 py-4 flex items-center justify-between"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(201,152,42,0.05)' }}>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Your profile is never made public.{' '}
                      <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>We contact you only when a role matches.</span>
                    </p>
                    <Link href="/jobs/how-it-works"
                      className="text-xs font-semibold whitespace-nowrap ml-4 hover:opacity-80 transition-opacity"
                      style={{ color: '#C9982A' }}>
                      How it works →
                    </Link>
                  </div>

                </div>
            </div>

          </div>
        </div>

        {/* Dark bottom border */}
      </section>


      {/* ════════════════════════════════════════════════════════════════
          4. PRACTICE QUESTIONS PILLAR
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* LEFT COLUMN */}
            <div>
              <span className="eyebrow mb-3 block">Practice Questions</span>
              <h2 className="section-title mb-4">20,000+ exam-standard questions</h2>
              <p className="text-slate-500 text-lg leading-relaxed mb-8">
                MCQs, written tasks and full mock exams for ACCA, CIMA, AAT and ICAEW. Instant marking with detailed explanations. Track your progress and walk into the exam room ready.
              </p>

              <div className="space-y-4">
                {[
                  {
                    title: 'Exam-standard questions',
                    body: "Built to the exact standard and format of each qualification's real exams.",
                    d: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
                  },
                  {
                    title: 'Instant marking and feedback',
                    body: 'Every question marked instantly with a full worked explanation.',
                    d: 'M13 10V3L4 14h7v7l9-11h-7z',
                  },
                  {
                    title: 'Track your progress',
                    body: 'See which topics you have mastered and where you need more practice.',
                    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
                  },
                  {
                    title: 'Free to start',
                    body: 'Core question banks permanently free. No credit card, no trial period.',
                    d: 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z',
                  },
                ].map(row => (
                  <div key={row.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-navy-700 shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={row.d} />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-navy-950 mb-0.5">{row.title}</h4>
                      <p className="text-sm text-slate-500">{row.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-10">
                <Link
                  href="/practice-questions"
                  className="h-12 px-8 inline-flex items-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ background: '#0C1A3D' }}
                >
                  Start practising free →
                </Link>
                <Link
                  href="/mock-exams/acca"
                  className="h-12 px-8 inline-flex items-center gap-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ border: '2px solid #C9982A', color: '#B8860B', background: 'transparent' }}
                >
                  Try a mock exam →
                </Link>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">

                <div className="bg-navy-950 px-7 pt-7 pb-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gold-400 mb-2">Question bank</p>
                  <p className="font-display text-white text-2xl">20,000+ questions</p>
                  <p className="text-white/50 text-sm mt-1">ACCA · CIMA · AAT · ICAEW — all in one place</p>
                </div>

                <div className="divide-y divide-slate-100">
                  {[
                    { badge: 'ACCA', badgeBg: 'bg-blue-50', badgeText: 'text-[#004B8D]', stats: 'The global standard for accounting professionals' },
                    { badge: 'CIMA', badgeBg: 'bg-sky-50', badgeText: 'text-[#0081C6]', stats: "The world's largest management accounting body" },
                    { badge: 'AAT', badgeBg: 'bg-teal-50', badgeText: 'text-teal-700', stats: 'The practical accounting foundation qualification' },
                    { badge: 'ICAEW', badgeBg: 'bg-red-50', badgeText: 'text-red-800', stats: 'The ACA — one of the most respected finance qualifications' },
                  ].map(row => (
                    <div key={row.badge} className="flex items-center justify-between px-7 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded ${row.badgeBg} ${row.badgeText}`} translate="no">
                        {row.badge}
                      </span>
                      <span className="text-sm text-slate-500">{row.stats}</span>
                    </div>
                  ))}
                </div>

                <div className="px-7 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Instant marking · Detailed solutions · Free to start</p>
                  <Link href="/practice-questions" className="text-xs font-semibold text-navy-700 hover:text-gold-500 transition-colors">
                    Browse questions →
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          5. LATEST INSIGHTS
          ════════════════════════════════════════════════════════════════ */}
      <section className={`section ${isEthioTax ? 'bg-[#f0f7f4]' : 'bg-white'}`}>
        <div className="container-site">

          <div className="flex items-end justify-between mb-10 gap-4">
            <div>
              <span className={`eyebrow mb-3 block`}>
                {isEthioTax ? 'Daily Digest' : 'Daily Digest'}
              </span>
              <h2 className="section-title">
                {isEthioTax ? 'Latest from EthioTax' : 'Latest from Accounting Body'}
              </h2>
              <p className="text-slate-500 text-base leading-relaxed mt-2 max-w-xl">
                {isEthioTax
                  ? 'Industry updates, tax briefs and insights for Ethiopian finance professionals and the diaspora.'
                  : 'The latest accounting news, finance briefs and study insights from our editorial team.'}
              </p>
            </div>
            <Link
              href="/articles"
              className={`shrink-0 flex items-center gap-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${isEthioTax ? 'text-[#1A4731] hover:text-[#C9982A]' : 'text-navy-700 hover:text-gold-500'}`}
            >
              View all
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {articles.slice(0, 4).map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/articles"
              className={`inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold transition-colors shadow-sm ${isEthioTax ? 'text-white hover:opacity-90' : 'bg-navy-950 text-white hover:bg-navy-900'}`}
              style={isEthioTax ? {backgroundColor: '#1A4731'} : {}}
            >
              {isEthioTax ? 'Browse all insights' : 'Browse all articles'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          6. STATS BAR
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
                  <span className="stat-number mb-1"><span translate="no">{stat.value}</span></span>
                  <span className="text-sm font-semibold text-navy-950">{stat.label}</span>
                  <span className="text-xs text-slate-400 mt-0.5">{stat.sublabel}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

      {/* ════════════════════════════════════════════════════════════════
          7. PLATFORM FEATURES (CONDENSED)
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-white">
        <div className="container-site">
              <div className="max-w-2xl mb-12">
                <span className="eyebrow mb-3 block">The Full Platform</span>
                <h2 className="section-title mb-4">Jobs, practice questions, and professional services — all in one place</h2>
                <p className="text-slate-500 text-lg leading-relaxed">
                  Accounting Body is built exclusively for accounting and finance professionals. Browse 250,000+ live jobs, practise with 20,000+ exam-standard questions, get matched to roles via our managed placement service, or engage our professional services team — everything you need, on one platform.
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

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          8. HOW IT WORKS
          ════════════════════════════════════════════════════════════════ */}
      <section className="section bg-slate-50">
        <div className="container-site">

          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="eyebrow mb-3 block">How It Works</span>
            <h2 className="section-title mb-4">Three ways Accounting Body works for you</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Find your next role, sharpen your exam skills, or get matched to a permanent position — all on one platform.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
            {howItWorks.map((step, i) => (
              <div key={step.step} className="relative flex flex-col items-start md:items-center text-left md:text-center px-0 md:px-8 mb-10 md:mb-0">

                {i < howItWorks.length - 1 && (
                  <div className="hidden md:block absolute top-9 left-[calc(50%+2.5rem)] right-0 h-px bg-slate-200" />
                )}

                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 border-gold-500 mb-6 shadow-sm">
                  <span className="font-display text-xl font-bold text-gold-500" translate="no">{step.step}</span>
                </div>

                <h3 className="font-display text-lg text-navy-950 mb-3">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/jobs/listings"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
            >
              Browse live jobs
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          9. QUALIFICATION PATHWAYS
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
          10. TRUST & AUTHORITY
          ════════════════════════════════════════════════════════════════ */}
        <section className="section bg-slate-50">
          <div className="container-site">
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

    <div>
      <span className="eyebrow mb-3 block">Why Accounting Body</span>
      <h2 className="section-title mb-6">Jobs, placement and practice — built for accounting professionals</h2>
      <p className="text-slate-500 text-lg leading-relaxed mb-8">
        Accounting Body is the only platform combining a live job board, a fully managed placement service, and 20,000+ exam-standard practice questions — all built specifically for accounting and finance professionals.
      </p>
      <div className="space-y-5">
        {[
          {
            title: '250,000+ live accounting and finance jobs',
            body: 'Updated daily. Filtered to accounting and finance only — no irrelevant roles, no noise. Search by role, location and contract type.',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
              </svg>
            ),
          },
          {
            title: 'Managed placement — not just a job board',
            body: 'Register and our team personally matches you to permanent and contract roles. You never deal with employers directly. Every placement carries a 90-day guarantee.',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
          },
          {
            title: '20,000+ exam-standard practice questions',
            body: 'ACCA, CIMA, AAT and ICAEW question banks. Instant marking with full worked explanations. Free to start — no credit card required.',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ),
          },
          {
            title: 'Trusted since 2018',
            body: 'Built for accounting and finance professionals from day one. Every job, every question, every placement — specific to the profession.',
            icon: (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            ),
          },
        ].map(point => (
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

        <div className="bg-navy-950 p-8 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #C9982A 0%, transparent 50%)' }}
          />
          <div className="relative z-10">
            <p className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-5">
              Placed professional
            </p>
            <div className="text-gold-500 text-6xl font-display leading-none mb-2 opacity-60">&ldquo;</div>
            <p className="text-white text-base leading-relaxed mb-6">
              Accounting Body matched me to my Financial Controller role within three weeks. I never had to approach a single employer directly — the team handled everything and negotiated a salary above my target.
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 text-sm font-bold shrink-0">
                J
              </div>
              <div>
                <span className="text-white text-sm font-semibold block">James T.</span>
                <span className="text-white/50 text-xs">Financial Controller, placed via Accounting Body</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200 bg-white">
          <div className="p-6 flex flex-col items-center text-center">
            <span className="font-display text-3xl text-navy-950 leading-none mb-1">90 days</span>
            <span className="text-slate-500 text-xs font-medium">Replacement guarantee</span>
          </div>
          <div className="p-6 flex flex-col items-center text-center">
            <span className="font-display text-3xl text-navy-950 leading-none mb-1">100%</span>
            <span className="text-slate-500 text-xs font-medium">Vetted candidates</span>
          </div>
        </div>

      </div>
    </div>

  </div>
          </div>
        </section>

      {/* ════════════════════════════════════════════════════════════════
          11. EMAIL SIGNUP
          ════════════════════════════════════════════════════════════════ */}
      <EmailSignupSection isEthioTax={isEthioTax} />

      {/* ════════════════════════════════════════════════════════════════
          12. BOTTOM CTA
          ════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-t border-slate-200 py-8">
        <div className="container-site">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <p className="font-display text-xl text-navy-950">Ready to get started?</p>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">Find your next role, practise your exams, or engage our professional services team.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto sm:min-w-[520px]">
              <Link
                href="/jobs/listings"
                className="h-11 flex items-center justify-center text-sm font-semibold rounded-xl bg-navy-950 text-white hover:bg-navy-900 transition-colors w-full whitespace-nowrap"
              >
                Browse jobs
              </Link>
              <Link
                href="/practice-questions"
                className="h-11 flex items-center justify-center text-sm font-medium rounded-xl border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors w-full whitespace-nowrap"
              >
                Practice questions
              </Link>
              <Link
                href="/get-help"
                className="h-11 flex items-center justify-center text-sm font-medium rounded-xl border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors w-full whitespace-nowrap"
              >
                Get help
              </Link>
            </div>
          </div>
        </div>
      </section>
        </>
      )}

    </>
  )
}
