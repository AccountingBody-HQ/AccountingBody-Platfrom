import Link from 'next/link'
import { getETICPAArticles } from '@/lib/sanity-queries'
import type { ArticleSummary } from '@/lib/sanity-queries'

export const revalidate = 3600

const CPA_PATHWAY = [
  {
    level: 'Foundation',
    code: 'ATQ Foundation',
    description: 'The entry point for Ethiopian accounting professionals. Covers core financial accounting, business law and Ethiopian taxation principles.',
    subjects: ['Financial Accounting', 'Business Mathematics & Statistics', 'Economics', 'Business Law & Ethics', 'Ethiopian Tax System'],
    status: 'available',
  },
  {
    level: 'Advanced',
    code: 'ATQ Advanced',
    description: 'Builds on Foundation with deeper financial management, audit and assurance, and advanced Ethiopian tax practice.',
    subjects: ['Advanced Financial Accounting', 'Financial Management', 'Audit & Assurance', 'Advanced Taxation', 'Management Accounting'],
    status: 'coming-soon',
  },
  {
    level: 'Professional',
    code: 'CPA Professional',
    description: 'The pinnacle of Ethiopian professional accountancy. Strategic leadership, complex financial reporting and professional ethics at the highest level.',
    subjects: ['Strategic Financial Management', 'Corporate Reporting', 'Advanced Audit', 'Strategic Management', 'Professional Ethics'],
    status: 'coming-soon',
  },
]

const SUBJECT_AREAS = [
  {
    name: 'Financial Accounting',
    description: 'Financial statements, double-entry bookkeeping, accounting standards and reporting under Ethiopian GAAP.',
    slug: 'financial-accounting',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect x="8" y="6" width="24" height="36" rx="3" stroke="#1A4731" strokeWidth="2"/>
        <path d="M14 16h12M14 22h12M14 28h8" stroke="#C9982A" strokeWidth="2" strokeLinecap="round"/>
        <path d="M28 6v8h8" stroke="#1A4731" strokeWidth="2" strokeLinejoin="round"/>
        <rect x="28" y="14" width="12" height="16" rx="2" fill="#f0f7f4" stroke="#1A4731" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    name: 'Ethiopian Taxation',
    description: 'ERCA requirements, income tax, VAT, customs duty and tax compliance for individuals and businesses in Ethiopia.',
    slug: 'taxation',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect x="10" y="8" width="28" height="32" rx="3" stroke="#1A4731" strokeWidth="2"/>
        <path d="M17 18h14M17 24h14M17 30h8" stroke="#1A4731" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="35" cy="13" r="6" fill="#1A4731"/>
        <path d="M32 13h6M35 10v6" stroke="#C9982A" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Audit & Assurance',
    description: 'Audit procedures, internal controls, risk assessment and ETICPA-standard assurance for Ethiopian entities.',
    slug: 'audit-assurance',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <circle cx="22" cy="22" r="12" stroke="#1A4731" strokeWidth="2"/>
        <path d="M30 30l8 8" stroke="#1A4731" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M17 22l3 3 6-6" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Financial Management',
    description: 'Investment appraisal, working capital, corporate finance and financial decision-making for Ethiopian businesses.',
    slug: 'financial-management',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <path d="M8 36l9-10 6 6 10-14 7 7" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 14v22h32" stroke="#1A4731" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    name: 'Management Accounting',
    description: 'Budgeting, cost analysis, performance measurement and management reporting for Ethiopian organisations.',
    slug: 'management-accounting',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect x="8" y="28" width="8" height="12" rx="1.5" fill="#f0f7f4" stroke="#1A4731" strokeWidth="1.5"/>
        <rect x="20" y="20" width="8" height="20" rx="1.5" fill="#f0f7f4" stroke="#1A4731" strokeWidth="1.5"/>
        <rect x="32" y="10" width="8" height="30" rx="1.5" fill="#f0f7f4" stroke="#1A4731" strokeWidth="1.5"/>
        <path d="M12 22l8-8 8 6 8-12" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: 'Business Law & Ethics',
    description: 'Ethiopian commercial law, corporate governance, professional ethics and regulatory compliance.',
    slug: 'business-management',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
        <rect x="16" y="24" width="16" height="16" rx="2" stroke="#1A4731" strokeWidth="2"/>
        <circle cx="24" cy="16" r="6" stroke="#1A4731" strokeWidth="2"/>
        <path d="M24 24v-2" stroke="#C9982A" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
]

function ArticleCard({ article }: { article: ArticleSummary }) {
  const href = `/study/eticpa/${article.slug.current}`
  return (
    <Link
      href={href}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
    >
      <div className="h-1 bg-[#1A4731]" />
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#f0f7f4] text-[#1A4731]">
            ATQ Foundation
          </span>
          {article.readTime && (
            <span className="text-xs text-slate-400">{article.readTime} min read</span>
          )}
        </div>
        <h3 className="font-display text-base text-navy-950 leading-snug mb-3 group-hover:text-[#1A4731] transition-colors flex-1">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">{article.excerpt}</p>
        )}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1A4731] group-hover:gap-2.5 transition-all mt-auto">
          Read note
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

export default async function ETICPAStudyPage() {
  const articles = await getETICPAArticles()

  return (
    <div>

      {/* HERO */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ backgroundColor: '#1A4731' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #C9982A 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study" className="hover:text-white/70 transition-colors">Study</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">ETICPA</span>
          </nav>
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-md mb-6" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
              ETICPA — Ethiopian Institute of Certified Public Accountants
            </span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              The qualification that opens
              <br />
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                every door in Ethiopian finance.
              </span>
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-10">
              Study notes, worked examples and exam guides for the CPA and ATQ qualifications — written for Ethiopian finance professionals, wherever you are in the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="#study-notes"
                className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                Browse study notes
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="#pathways"
                className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors">
                View qualification pathways
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IS ETICPA */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>The Qualification</span>
              <h2 className="section-title mb-6">Why ETICPA is the qualification Ethiopian professionals must hold</h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-6">
                ETICPA — the Ethiopian Institute of Certified Public Accountants — is Ethiopia&apos;s national professional accountancy body. Its qualifications are the benchmark for finance professionals working in or with Ethiopia.
              </p>
              <p className="text-slate-600 text-lg leading-relaxed mb-8">
                Whether you are building a career inside Ethiopia, managing finances for a diaspora business, or advising clients with Ethiopian operations — the CPA and ATQ qualifications give you the credibility, legal standing and technical expertise that employers and regulators demand.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { stat: 'Nationally', label: 'Recognised by all Ethiopian regulators' },
                  { stat: '2 Routes', label: 'ATQ Foundation → Advanced → CPA Professional' },
                  { stat: 'Global', label: 'Valued by diaspora employers worldwide' },
                ].map(item => (
                  <div key={item.stat} className="rounded-xl p-5 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
                    <p className="font-display text-lg font-bold mb-1" style={{ color: '#1A4731' }}>{item.stat}</p>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl p-10 border-l-4" style={{ backgroundColor: '#f0f7f4', borderColor: '#1A4731' }}>
              <p className="font-display text-2xl text-navy-950 mb-6">Who this is for</p>
              <ul className="space-y-4">
                {[
                  'Finance professionals employed in Ethiopian companies or government bodies',
                  'Diaspora accountants advising businesses with Ethiopian operations',
                  'Graduates seeking a nationally recognised professional qualification',
                  'Bookkeepers and accounting technicians building towards CPA status',
                  'Business owners who want to understand Ethiopian financial reporting standards',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-600 text-sm leading-relaxed">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                      <svg className="w-3 h-3" fill="none" stroke="#C9982A" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* QUALIFICATION PATHWAYS */}
      <section id="pathways" className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Qualification Pathways</span>
            <h2 className="section-title mb-4">Three levels. One destination.</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              The ETICPA pathway progresses from ATQ Foundation through ATQ Advanced to the CPA Professional qualification. Each level builds on the last.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CPA_PATHWAY.map((path, index) => (
              <div key={path.code}
                className="relative flex flex-col bg-white rounded-xl border overflow-hidden"
                style={{ borderColor: index === 0 ? '#1A4731' : '#e2e8f0' }}>
                {index === 0 && (
                  <div className="absolute top-4 right-4">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                      Start here
                    </span>
                  </div>
                )}
                <div className="h-1.5" style={{ backgroundColor: index === 0 ? '#1A4731' : '#cbd5e1' }} />
                <div className="p-7 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: index === 0 ? '#1A4731' : '#94a3b8' }}>
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: index === 0 ? '#1A4731' : '#94a3b8' }}>
                      {path.level}
                    </span>
                  </div>
                  <h3 className="font-display text-xl text-navy-950 mb-3">{path.code}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">{path.description}</p>
                  <div className="space-y-2 mb-6">
                    {path.subjects.map(subject => (
                      <div key={subject} className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: index === 0 ? '#1A4731' : '#cbd5e1' }} />
                        {subject}
                      </div>
                    ))}
                  </div>
                  {path.status === 'available' ? (
                    <Link href="#study-notes"
                      className="inline-flex items-center gap-2 text-xs font-semibold transition-all"
                      style={{ color: '#1A4731' }}>
                      Browse study notes
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Study notes coming soon</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STUDY NOTES */}
      <section id="study-notes" className="section bg-white border-t border-slate-100">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Study Notes</span>
              <h2 className="section-title mb-4">Start studying today</h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Professionally written study notes for the ETICPA qualification — free, comprehensive and built for exam success.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-4xl" style={{ color: '#1A4731' }}>{articles.length}</p>
              <p className="text-slate-400 text-sm">notes published</p>
            </div>
          </div>

          {articles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {articles.map((article) => (
                <ArticleCard key={article._id} article={article} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl p-12 text-center border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <p className="font-display text-xl text-navy-950 mb-2">Study notes being published</p>
              <p className="text-slate-500 text-sm">New ETICPA study notes are added every week.</p>
            </div>
          )}
        </div>
      </section>

      {/* SUBJECT AREAS */}
      <section className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Subject Areas</span>
            <h2 className="section-title mb-4">Browse by subject</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              All ETICPA subject areas — from Ethiopian taxation to financial management. Find exactly what you need for your exam.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SUBJECT_AREAS.map(area => (
              <Link key={area.slug} href={`/study/${area.slug}`}
                className="group flex items-start gap-5 p-6 rounded-xl border bg-white transition-all duration-200 hover:shadow-lg"
                style={{ borderColor: '#e2e8f0' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#C9982A' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{ backgroundColor: '#f0f7f4', border: '1px solid #d1e8db' }}>
                  {area.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base text-navy-950 group-hover:text-[#1A4731] transition-colors leading-snug mb-1">{area.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-2">{area.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1A4731]">
                    Browse notes
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PROFESSIONAL SERVICES CTA */}
      <section className="section relative overflow-hidden" style={{ backgroundColor: '#1A4731' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: '#C9982A', filter: 'blur(80px)' }} />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: '#C9982A', filter: 'blur(80px)' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="eyebrow mb-4 block" style={{ color: '#C9982A' }}>Professional Services</span>
              <h2 className="font-display text-4xl text-white mb-4 leading-tight">
                Working in Ethiopian finance?
              </h2>
              <p className="text-white/70 text-lg leading-relaxed mb-8">
                EthioTax provides accounting, tax, audit and business consulting services to Ethiopian professionals and businesses worldwide — delivered by qualified specialists, in your language.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/get-help"
                  className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-sm font-semibold transition-colors"
                  style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                  Explore our services
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <Link href="/how-it-works"
                  className="inline-flex items-center justify-center gap-2 h-13 px-7 rounded-lg text-sm font-semibold border-2 text-white transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.3)' }}>
                  How it works
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'Tax Filing & Compliance', desc: 'ERCA filings, income tax and VAT compliance for Ethiopian businesses.', href: '/get-help/tax-filing-compliance' },
                { title: 'Accounting & Bookkeeping', desc: 'ETICPA-standard accounts and financial reporting.', href: '/get-help/accounting-bookkeeping' },
                { title: 'Audit & Assurance', desc: 'ETICPA-standard audit for Ethiopian entities and diaspora businesses.', href: '/get-help/audit-assurance' },
                { title: 'Business Consulting', desc: 'Strategic advice for businesses operating in or with Ethiopia.', href: '/get-help/business-consulting' },
              ].map(service => (
                <Link key={service.href} href={service.href}
                  className="group rounded-xl p-5 border transition-all"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)' }}>
                  <h3 className="font-display text-white text-sm mb-2 group-hover:text-[#C9982A] transition-colors">{service.title}</h3>
                  <p className="text-white/50 text-xs leading-relaxed">{service.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
