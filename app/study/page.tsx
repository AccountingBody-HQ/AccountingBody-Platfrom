import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getStudyLandingData, getCategoryCounts } from '@/lib/sanity-queries'
import { getPracticePostCount } from '@/lib/practice-queries'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Study Notes | Accounting Body',
  description: 'Comprehensive study notes for ACCA, CIMA, AAT, and ICAEW — the four leading professional accounting qualifications.',
}

const EXAM_BODIES = [
  {
    code: 'ACCA', slug: 'acca',
    description: 'All 13 papers from Applied Knowledge through Strategic Professional.',
    accent: 'bg-[#004B8D]', badgeBg: 'bg-blue-50', badgeText: 'text-[#004B8D]',
    highlights: ['Applied Knowledge', 'Applied Skills', 'Strategic Professional', 'Ethics module'],
  },
  {
    code: 'CIMA', slug: 'cima',
    description: 'Operational, Management, and Strategic levels plus Case Study prep.',
    accent: 'bg-[#0081C6]', badgeBg: 'bg-sky-50', badgeText: 'text-[#0081C6]',
    highlights: ['Operational level', 'Management level', 'Strategic level', 'Case Study prep'],
  },
  {
    code: 'ICAEW', slug: 'icaew',
    description: 'ACA qualification — Certificate, Professional, and Advanced levels.',
    accent: 'bg-[#8B0000]', badgeBg: 'bg-red-50', badgeText: 'text-red-800',
    highlights: ['Certificate level', 'Professional level', 'Advanced level', 'Case Study'],
  },
  {
    code: 'AAT', slug: 'aat',
    description: 'Level 2 Foundation through Level 4 Professional Diploma.',
    accent: 'bg-[#00857A]', badgeBg: 'bg-teal-50', badgeText: 'text-teal-700',
    highlights: ['Level 2 Foundation', 'Level 3 Advanced', 'Level 4 Professional', 'Synoptic prep'],
  },
]

const SUBJECT_AREAS = [
  {
    name: 'Financial Accounting',
    slug: 'financial-accounting',
    description: 'Financial statements, bookkeeping, accounting standards and reporting practices.',
    count: '714+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect x="8" y="6" width="24" height="36" rx="3" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M14 16h12M14 22h12M14 28h8" stroke="#D4A017" strokeWidth="2" strokeLinecap="round"/>
        <path d="M28 6v8h8" stroke="#0C1A3D" strokeWidth="2" strokeLinejoin="round"/>
        <rect x="28" y="14" width="12" height="16" rx="2" fill="#EEF2FF" stroke="#0C1A3D" strokeWidth="1.5"/>
        <path d="M31 20h6M31 24h4" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Financial Management',
    slug: 'financial-management',
    description: 'Investment strategies, corporate finance, risk analysis and financial markets.',
    count: '742+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <path d="M8 36l9-10 6 6 10-14 7 7" stroke="#D4A017" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="40" cy="25" r="3" fill="#0C1A3D"/>
        <path d="M8 14v22h32" stroke="#0C1A3D" strokeWidth="2" strokeLinecap="round"/>
        <rect x="10" y="8" width="8" height="6" rx="1.5" fill="#EEF2FF" stroke="#0C1A3D" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    name: 'Management Accounting',
    slug: 'management-accounting',
    description: 'Budgeting, cost analysis, performance measurement and decision-making techniques.',
    count: '446+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect x="8" y="28" width="8" height="12" rx="1.5" fill="#EEF2FF" stroke="#0C1A3D" strokeWidth="1.5"/>
        <rect x="20" y="20" width="8" height="20" rx="1.5" fill="#EEF2FF" stroke="#0C1A3D" strokeWidth="1.5"/>
        <rect x="32" y="10" width="8" height="30" rx="1.5" fill="#EEF2FF" stroke="#0C1A3D" strokeWidth="1.5"/>
        <path d="M12 22l8-8 8 6 8-12" stroke="#D4A017" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Financial Market',
    slug: 'financial-market',
    description: 'Stocks, bonds, derivatives and investment instruments that shape the global economy.',
    count: '211+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <circle cx="24" cy="24" r="16" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M24 8v4M24 36v4M8 24h4M36 24h4" stroke="#0C1A3D" strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 24c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" stroke="#D4A017" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="24" r="3" fill="#D4A017"/>
      </svg>
    ),
  },
  {
    name: 'Business Management',
    slug: 'business-management',
    description: 'Organisational structures, strategy, operations and leadership for growing businesses.',
    count: '187+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect x="16" y="24" width="16" height="16" rx="2" stroke="#0C1A3D" strokeWidth="2"/>
        <rect x="6" y="30" width="12" height="10" rx="2" stroke="#0C1A3D" strokeWidth="1.5"/>
        <rect x="30" y="30" width="12" height="10" rx="2" stroke="#0C1A3D" strokeWidth="1.5"/>
        <circle cx="24" cy="16" r="6" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M24 24v-2M12 30v-4M36 30v-4" stroke="#D4A017" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Audit and Assurance',
    slug: 'audit-assurance',
    description: 'Audit procedures, internal controls, risk assessment and financial reporting assurance.',
    count: '61+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <circle cx="22" cy="22" r="12" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M30 30l8 8" stroke="#0C1A3D" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M17 22l3 3 6-6" stroke="#D4A017" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Tax',
    slug: 'taxation',
    description: 'Tax principles, compliance requirements and how taxation impacts financial decisions.',
    count: '40+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect x="10" y="8" width="28" height="32" rx="3" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M17 18h14M17 24h14M17 30h8" stroke="#0C1A3D" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="35" cy="13" r="6" fill="#0C1A3D"/>
        <path d="M32 13h6M35 10v6" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Economics',
    slug: 'economics',
    description: 'Macroeconomics, microeconomics, inflation and global policies that impact financial systems.',
    count: '120+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <path d="M8 40h32" stroke="#0C1A3D" strokeWidth="2" strokeLinecap="round"/>
        <path d="M12 40V28M20 40V20M28 40V24M36 40V14" stroke="#D4A017" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M12 20c0-6.6 5.4-12 12-12s12 5.4 12 12" stroke="#0C1A3D" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
      </svg>
    ),
  },
  {
    name: 'Mock Exams',
    slug: 'mock-exams',
    description: 'Full exam simulations to test your knowledge and build exam confidence.',
    count: '181+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect x="8" y="8" width="32" height="32" rx="3" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M16 18h16M16 24h16M16 30h10" stroke="#0C1A3D" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="36" cy="36" r="8" fill="#0C1A3D"/>
        <path d="M33 36l2 2 4-4" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Cryptocurrency',
    slug: 'cryptocurrency',
    description: 'Blockchain fundamentals, Bitcoin, Ethereum and the impact of crypto on modern finance.',
    count: '7+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <circle cx="24" cy="24" r="16" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M20 16v16M28 16v16" stroke="#0C1A3D" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M18 20h8c2.2 0 4 1.8 4 4s-1.8 4-4 4h-8" stroke="#D4A017" strokeWidth="2" strokeLinecap="round"/>
        <path d="M18 24h9" stroke="#D4A017" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Tools and Templates',
    slug: 'tools-templates',
    description: 'Practical calculators, templates and downloadable tools to support your studies.',
    count: '3+',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
        <rect x="8" y="16" width="20" height="24" rx="2" stroke="#0C1A3D" strokeWidth="2"/>
        <path d="M14 22h8M14 27h8M14 32h5" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M28 12l8 8-12 12-8-8z" stroke="#0C1A3D" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M36 20l2 2-4 4-2-2" stroke="#0C1A3D" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export default async function StudyPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  const eticpaCard = {
    code: 'ETICPA', slug: 'eticpa',
    description: "Ethiopia's national accountancy body — CPA and ATQ qualifications for finance professionals.",
    accent: 'bg-[#1A4731]', badgeBg: 'bg-[#f0f7f4]', badgeText: 'text-[#1A4731]',
    highlights: ['CPA Professional', 'ATQ Foundation', 'ATQ Advanced', 'Ethiopian Taxation'],
  }
  const activeExamBodies = isEthioTax
    ? [eticpaCard, ...EXAM_BODIES.filter(b => b.slug !== 'icaew')]
    : EXAM_BODIES
  const [liveData, categoryCounts, practicePostCount] = await Promise.all([
    getStudyLandingData(),
    getCategoryCounts(isEthioTax ? 'ethiotax' : 'accountingbody'),
    getPracticePostCount(),
  ])
  const liveMap = Object.fromEntries(liveData.map(d => [d.examBody, d.count]))

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-25"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Study</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Study Notes</span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Everything you need to
              <br />
              <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                pass your exams.
              </span>
            </h1>
            <p className="text-white/65 text-xl leading-relaxed max-w-2xl">
              {isEthioTax ? <><span translate="no">ACCA</span>, <span translate="no">CIMA</span>, <span translate="no">ETICPA</span> and <span translate="no">AAT</span> study notes, worked examples, and exam technique guides.</> : <><span translate="no">ACCA</span>, <span translate="no">CIMA</span>, <span translate="no">ICAEW</span> and <span translate="no">AAT</span> study notes, worked examples, and exam technique guides.</>}
            </p>
          </div>
        </div>
      </section>

      {/* QUALIFICATIONS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Qualifications</span>
            <h2 className="section-title mb-4">Choose your qualification</h2>
            <p className="text-slate-500 text-lg leading-relaxed">Select your qualification to browse all study notes for that pathway.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {activeExamBodies.map((body) => {
              const articleCount = liveMap[body.code.toLowerCase()]
              return (
                <Link key={body.slug} href={`/study/${body.slug}`}
                  className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                  <div className={`h-1.5 ${body.accent}`} />
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${body.badgeBg} ${body.badgeText}`} translate="no">{body.code}</span>
                      {articleCount && <span className="text-xs text-slate-400 font-medium">{articleCount.toLocaleString()} articles</span>}
                    </div>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed flex-1">{body.description}</p>
                    <ul className="space-y-1.5 mb-5">
                      {body.highlights.map(h => (
                        <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${body.accent}`} />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${body.badgeText} group-hover:gap-2.5 transition-all`}>
                      <span translate="no">Browse {body.code} notes</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* BROWSE BY SUBJECT */}
      <section className="section bg-white border-t border-slate-100">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Browse by Subject</span>
            <h2 className="section-title mb-4">Or explore by topic</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              {isEthioTax ? <><span translate="no">ACCA</span>, <span translate="no">CIMA</span>, <span translate="no">ETICPA</span> and <span translate="no">AAT</span> — find what you need by topic.</> : <><span translate="no">ACCA</span>, <span translate="no">CIMA</span>, <span translate="no">ICAEW</span> and <span translate="no">AAT</span> — find what you need by topic.</>}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SUBJECT_AREAS.map(area => {
              const isMockExams = area.slug === 'mock-exams'
              const href = isMockExams ? '/practice-questions' : `/study/${area.slug}`
              const count = isMockExams
                ? practicePostCount.toLocaleString()
                : (categoryCounts[area.slug] ?? 0).toLocaleString()
              const browseLabel = isMockExams ? 'Browse question sets' : 'Browse notes'
              return (
                <Link key={area.slug} href={href}
                  className="group flex items-start gap-5 p-6 rounded-xl border border-slate-200 bg-white hover:border-gold-400 hover:shadow-lg transition-all duration-200">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-gold-50 group-hover:border-gold-200 transition-all">
                    {area.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display text-base text-navy-950 group-hover:text-navy-700 transition-colors leading-snug">{area.name}</h3>
                      <span className="text-xs font-semibold text-gold-600 bg-gold-50 px-2 py-0.5 rounded-full shrink-0 mt-0.5">{count}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{area.description}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy-950 group-hover:text-gold-600 group-hover:gap-2 transition-all">
                      {browseLabel}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-navy section relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10 text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Practice Questions</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">Ready to test your knowledge?</h2>
          <p className="text-white/65 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            {isEthioTax ? <>Thousands of exam-standard practice questions for <span translate="no">ACCA</span>, <span translate="no">CIMA</span>, <span translate="no">ETICPA</span> and <span translate="no">AAT</span>.</> : <>Thousands of exam-standard practice questions for <span translate="no">ACCA</span>, <span translate="no">CIMA</span>, <span translate="no">ICAEW</span> and <span translate="no">AAT</span>.</>}
          </p>
          <Link href="/practice-questions"
            className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
            Browse practice questions
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
        </div>
      </section>

      {/* JOBS BRIDGE — matches homepage Jobs section design */}
      <section className="relative overflow-hidden" style={{ background: '#C9982A' }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="container-site relative z-10 py-16 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            {/* LEFT */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7"
                style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: isEthioTax ? '#0f2d1e' : '#0C1A3D' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: isEthioTax ? '#0f2d1e' : '#0C1A3D' }}>
                  {isEthioTax ? 'EthioTax Recruitment' : 'Accounting Body Recruitment'}
                </span>
              </div>
              <h2 className="font-display leading-[1.06] mb-6"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: isEthioTax ? '#0f2d1e' : '#0C1A3D' }}>
                {isEthioTax ? (
                  <>Studying, at university,<br /><span style={{ opacity: 0.7 }}>or already qualified?</span><br />We place finance professionals.</>
                ) : (
                  <>Studying, at university,<br /><span style={{ opacity: 0.7 }}>or already qualified?</span><br />We place accounting & finance professionals.</>
                )}
              </h2>
              <p className="text-base leading-relaxed mb-8 max-w-lg"
                style={{ color: isEthioTax ? 'rgba(15,45,30,0.75)' : 'rgba(12,26,61,0.75)' }}>
                {isEthioTax
                  ? 'Register as a candidate at any stage — university student, mid-qualification or fully certified. We place Ethiopian finance professionals globally.'
                  : 'Register as a candidate at any stage of your journey — whether you are at university, mid-qualification or fully certified. We match you to the right role when the time is right.'}
              </p>
              <div className="flex flex-col gap-3 mb-10">
                {(isEthioTax ? [
                  'Ethiopian-origin finance professionals actively placed',
                  'ETICPA, ACCA, CIMA and CPA credentials recognised',
                  '90-day replacement guarantee on every placement',
                ] : [
                  'Accounting and finance professionals only',
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
                    <span className="text-sm font-medium" style={{ color: isEthioTax ? 'rgba(15,45,30,0.85)' : 'rgba(12,26,61,0.85)' }}>
                      {point}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/jobs/find-work"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ background: isEthioTax ? '#0f2d1e' : '#0C1A3D' }}>
                  Register as a Candidate
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <Link href="/jobs/how-it-works"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold transition-all hover:opacity-80 border-2"
                  style={{ borderColor: isEthioTax ? '#0f2d1e' : '#0C1A3D', color: isEthioTax ? '#0f2d1e' : '#0C1A3D', background: 'transparent' }}>
                  How it works
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            </div>

            {/* RIGHT — dark stats card */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden"
                style={{ background: isEthioTax ? '#0f2d1e' : '#0C1A3D', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div className="px-8 pt-7 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>
                      Your study-to-placement path
                    </p>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(201,152,42,0.15)', color: '#C9982A', border: '1px solid rgba(201,152,42,0.3)' }}>
                      No job boards
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2">
                  {[
                    { value: 'Study',    label: 'Build your qualification', sub: 'ACCA · CIMA · AAT · ETICPA', noTranslate: true },
                    { value: 'Register', label: 'One profile — we match',   sub: 'No cold applying ever' },
                    { value: 'Managed',  label: 'End-to-end placement',     sub: 'We handle every step' },
                    { value: '90 Days',  label: 'Replacement guarantee',    sub: 'On every permanent role' },
                  ].map((stat, i) => (
                    <div key={stat.label} className="p-6"
                      style={{
                        borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      }}>
                      <span className="font-display text-2xl font-bold text-white block mb-1">{stat.value}</span>
                      <span className="text-xs font-semibold block mb-0.5" style={{ color: '#C9982A' }}>{stat.label}</span>
                      <span className="text-xs text-white/35">{stat.sub}</span>
                    </div>
                  ))}
                </div>
                <div className="px-8 py-5 flex items-center justify-between"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(201,152,42,0.06)' }}>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Your profile is never made public.{' '}
                    <span className="text-white/60 font-medium">We contact you only when a role matches.</span>
                  </p>
                  <Link href="/jobs" className="text-xs font-semibold whitespace-nowrap ml-4 hover:opacity-80 transition-opacity"
                    style={{ color: '#C9982A' }}>
                    Learn more →
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  )
}