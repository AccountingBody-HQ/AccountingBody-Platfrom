import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const revalidate = 3600

const MODULES = [
  {
    number: 1,
    slug: 'financial-accounting',
    name: 'Financial Accounting',
    description: 'Financial statements under Ethiopian GAAP, accounting standards, company accounts, consolidated statements and financial reporting.',
    topics: 5,
    href: '/study/eticpa/atq/level-2/financial-accounting',
  },
  {
    number: 2,
    slug: 'management-accounting',
    name: 'Management Accounting',
    description: 'Budgeting and forecasting, variance analysis, performance measurement, decision making and management reporting.',
    topics: 5,
    href: '/study/eticpa/atq/level-2/management-accounting',
  },
  {
    number: 3,
    slug: 'assurance-controls-ethics',
    name: 'Assurance, Controls & Ethics',
    description: 'Internal controls, audit procedures, professional ethics, risk assessment and assurance engagements.',
    topics: 5,
    href: '/study/eticpa/atq/level-2/assurance-controls-ethics',
  },
  {
    number: 4,
    slug: 'ethiopian-taxation',
    name: 'Ethiopian Taxation',
    description: 'ERCA and tax administration, income tax for individuals and businesses, VAT, customs and other taxes.',
    topics: 5,
    href: '/study/eticpa/atq/level-2/ethiopian-taxation',
  },
  {
    number: 5,
    slug: 'ethiopian-public-sector-accounting',
    name: 'Ethiopian Public Sector Accounting',
    description: 'Public financial management, government accounting standards, budget execution, public sector audit and accountability.',
    topics: 5,
    href: '/study/eticpa/atq/level-2/ethiopian-public-sector-accounting',
  },
]

export default async function ATQLevel2Page() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) redirect('/study')

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
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8 flex-wrap">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study/eticpa" className="hover:text-white/70 transition-colors"><span translate="no">ETICPA</span></Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70"><span translate="no">ATQ Level 2</span></span>
          </nav>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold px-3 py-1.5 rounded-md" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                <span translate="no">ATQ</span> — Accounting Technician Qualification
              </span>
            </div>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Level 2 —
              <br />
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Advanced Technician
              </span>
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-10">
              Five modules developing deeper technical competence across financial reporting, taxation and assurance — preparing candidates for senior technician roles in Ethiopian organisations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="#modules"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Browse modules
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/study/eticpa/atq/level-1"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors"
                style={{ height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Back to Level 1
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* LEVEL OVERVIEW */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Level Overview</span>
              <h2 className="section-title mb-6">What Level 2 covers</h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-6">
                <span translate="no">ATQ Level 2</span> — Advanced Technician builds on the foundations of Level 1 with five specialist modules covering financial reporting, management accounting, assurance, taxation and public sector finance.
              </p>
              <p className="text-slate-600 text-lg leading-relaxed">
                Completion of Level 2 earns the full <span translate="no">ATQ</span> — Accounting Technician Qualification and provides the platform to progress towards the <span translate="no">ETICPA CPA</span> — Certified Public Accountant.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { stat: '5', label: 'Modules' },
                { stat: '25', label: 'Core topics' },
                { stat: 'Level 2', label: 'Advanced Technician' },
                { stat: 'ATQ', label: 'Full qualification on completion', noTranslate: true },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-6 border text-center" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
                  <p className="font-display text-2xl font-bold mb-1" style={{ color: '#1A4731' }}>{item.stat}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>Level 2 Modules</span>
            <h2 className="section-title mb-4">Five modules. Advanced expertise.</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Select a module to access study notes, topics and learning outcomes. Study notes are added every week.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {MODULES.map((mod) => (
              <Link key={mod.slug} href={mod.href}
                className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-[#1A4731] transition-all duration-200">
                <div className="h-1.5 bg-[#1A4731]" />
                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-center gap-4 mb-5">
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: '#1A4731' }}>
                      {mod.number}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#1A4731' }}>Module {mod.number}</p>
                      <h3 className="font-display text-lg text-navy-950 group-hover:text-[#1A4731] transition-colors">{mod.name}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">{mod.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">{mod.topics} topics</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A4731] group-hover:gap-2.5 transition-all">
                      Study this module
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* NAVIGATION */}
      <section className="section bg-white border-t border-slate-100">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Link href="/study/eticpa/atq/level-1"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 transition-colors"
              style={{ borderColor: '#1A4731', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>
              Back to Level 1
            </Link>
            <Link href="/study/eticpa"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#1A4731', color: 'white', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Back to <span translate="no">ETICPA</span> Hub
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
