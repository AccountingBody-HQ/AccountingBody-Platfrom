// app/study/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import { getStudyLandingData } from '@/lib/sanity-queries'

export const metadata: Metadata = {
  title:       'Study Notes | AccountingBody',
  description: 'Comprehensive study notes for every paper across ACCA, CIMA, AAT, ICAEW, ATT, CPA, CIPFA, and CTA. Written and reviewed by qualified accountants.',
}

const EXAM_BODIES = [
  {
    code:        'ACCA',
    slug:        'acca',
    name:        'Association of Chartered Certified Accountants',
    description: 'All 13 papers from Applied Knowledge through Strategic Professional, with worked examples and exam technique guides.',
    accent:      'bg-[#004B8D]',
    badgeBg:     'bg-blue-50',
    badgeText:   'text-[#004B8D]',
    highlights:  ['Applied Knowledge', 'Applied Skills', 'Strategic Professional', 'Ethics module'],
  },
  {
    code:        'CIMA',
    slug:        'cima',
    name:        'Chartered Institute of Management Accountants',
    description: 'Complete coverage of the CIMA pathway — Operational, Management, and Strategic levels, plus Case Study preparation.',
    accent:      'bg-[#0081C6]',
    badgeBg:     'bg-sky-50',
    badgeText:   'text-[#0081C6]',
    highlights:  ['Operational level', 'Management level', 'Strategic level', 'Case Study prep'],
  },
  {
    code:        'AAT',
    slug:        'aat',
    name:        'Association of Accounting Technicians',
    description: 'Level 2 Foundation through Level 4 Professional Diploma — the complete bookkeeping to advanced accounting journey.',
    accent:      'bg-[#00857A]',
    badgeBg:     'bg-teal-50',
    badgeText:   'text-teal-700',
    highlights:  ['Level 2 Foundation', 'Level 3 Advanced', 'Level 4 Professional', 'Synoptic prep'],
  },
  {
    code:        'ICAEW',
    slug:        'icaew',
    name:        'Institute of Chartered Accountants in England and Wales',
    description: 'ACA qualification study support — Certificate, Professional, and Advanced levels for aspiring chartered accountants.',
    accent:      'bg-[#8B0000]',
    badgeBg:     'bg-red-50',
    badgeText:   'text-red-800',
    highlights:  ['Certificate level', 'Professional level', 'Advanced level', 'Case Study'],
  },
  {
    code:        'ATT',
    slug:        'att',
    name:        'Association of Taxation Technicians',
    description: 'Solid grounding in UK tax for the ATT qualification — personal tax, business tax, and the core principles exams.',
    accent:      'bg-[#6B21A8]',
    badgeBg:     'bg-purple-50',
    badgeText:   'text-purple-800',
    highlights:  ['Personal taxation', 'Business taxation', 'Law & ethics', 'Elective papers'],
  },
  {
    code:        'CPA',
    slug:        'cpa',
    name:        'Certified Public Accountant',
    description: 'US CPA exam preparation — FAR, AUD, REG, and BAR/TCP sections with full syllabus notes and practice MCQs.',
    accent:      'bg-[#1D4ED8]',
    badgeBg:     'bg-blue-50',
    badgeText:   'text-blue-800',
    highlights:  ['Financial (FAR)', 'Auditing (AUD)', 'Regulation (REG)', 'Business (BAR)'],
  },
  {
    code:        'CIPFA',
    slug:        'cipfa',
    name:        'Chartered Institute of Public Finance and Accountancy',
    description: 'Public finance and government accounting study notes for CIPFA students across all qualification stages.',
    accent:      'bg-[#065F46]',
    badgeBg:     'bg-emerald-50',
    badgeText:   'text-emerald-800',
    highlights:  ['Public finance', 'Financial reporting', 'Audit & governance', 'Treasury'],
  },
  {
    code:        'CTA',
    slug:        'cta',
    name:        'Chartered Tax Adviser',
    description: 'Advanced UK tax study notes for the CTA — the gold standard qualification for tax professionals.',
    accent:      'bg-[#B45309]',
    badgeBg:     'bg-amber-50',
    badgeText:   'text-amber-800',
    highlights:  ['Human capital taxes', 'Business tax', 'Indirect taxes', 'Advisory skills'],
  },
]

const SUBJECT_AREAS = [
  { name: 'Financial Reporting',    slug: 'financial-reporting',    icon: '📊', count: '320+' },
  { name: 'Management Accounting',  slug: 'management-accounting',  icon: '📈', count: '280+' },
  { name: 'Taxation',               slug: 'taxation',               icon: '🧾', count: '410+' },
  { name: 'Audit & Assurance',      slug: 'audit-assurance',        icon: '✅', count: '190+' },
  { name: 'Financial Management',   slug: 'financial-management',   icon: '💰', count: '175+' },
  { name: 'Law & Ethics',           slug: 'law-ethics',             icon: '⚖️',  count: '130+' },
  { name: 'Bookkeeping',            slug: 'bookkeeping',            icon: '📒', count: '220+' },
  { name: 'Performance Management', slug: 'performance-management', icon: '🎯', count: '160+' },
]

export default async function StudyPage() {
  const liveData = await getStudyLandingData()
  const liveMap  = Object.fromEntries(liveData.map(d => [d.examBody, d.count]))

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-25"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>
        <div className="container-site relative z-10">
          <div className="max-w-3xl">
            <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-white/70">Study</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Study Notes</span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Everything you need to
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                pass your exams.
              </span>
            </h1>
            <p className="text-white/65 text-xl leading-relaxed max-w-2xl">
              Study notes, worked examples, and exam technique guides for every major
              accounting qualification — written and reviewed by qualified professionals.
            </p>
          </div>
        </div>
      </section>

      {/* EXAM BODY GRID */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Qualifications</span>
            <h2 className="section-title mb-4">Choose your qualification</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Select your exam body below to browse all study notes for that qualification,
              listed alphabetically for easy reference.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {EXAM_BODIES.map((body) => {
              const articleCount = liveMap[body.code]
              return (
                <Link
                  key={body.slug}
                  href={`/study/${body.slug}`}
                  className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                >
                  <div className={`h-1.5 ${body.accent}`} />
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${body.badgeBg} ${body.badgeText}`}>
                        {body.code}
                      </span>
                      {articleCount && (
                        <span className="text-xs text-slate-400 font-medium">
                          {articleCount.toLocaleString()} articles
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-base text-navy-950 leading-snug mb-2 group-hover:text-navy-700 transition-colors">
                      {body.code}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4 leading-relaxed flex-1">
                      {body.description}
                    </p>
                    <ul className="space-y-1.5 mb-5">
                      {body.highlights.map(h => (
                        <li key={h} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${body.accent}`} />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${body.badgeText} group-hover:gap-2.5 transition-all`}>
                      Browse {body.code} notes
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* SUBJECT AREAS */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="max-w-2xl mb-10">
            <span className="eyebrow mb-3 block">Browse by Subject</span>
            <h2 className="section-title mb-4">Or browse by topic</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Cross-qualification topic index — find study notes on any subject
              regardless of which exam body you are studying with.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SUBJECT_AREAS.map(area => (
              <Link
                key={area.slug}
                href={`/study/${area.slug}`}
                className="group flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-navy-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <span className="text-2xl shrink-0">{area.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-950 leading-snug group-hover:text-navy-700 transition-colors">
                    {area.name}
                  </p>
                  <p className="text-xs text-slate-400">{area.count} articles</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="section-navy section relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
        </div>
        <div className="container-site relative z-10 text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Practice Questions</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">
            Ready to test your knowledge?
          </h2>
          <p className="text-white/65 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
            50,000+ exam-standard practice questions across every qualification.
            MCQ, written tasks, and scenario-based questions.
          </p>
          <Link
            href="/practice"
            className="inline-flex items-center gap-2 h-13 px-7 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold"
          >
            Browse practice questions
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </>
  )
}