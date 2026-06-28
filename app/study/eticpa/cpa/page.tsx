import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export const revalidate = 3600

const CPA_PATHWAY = [
  { step: '01', title: 'Eligibility & Registration', desc: 'Meet entry requirements and register with ETICPA as a CPA candidate.' },
  { step: '02', title: 'Examinations', desc: 'Complete structured assessments across all required CPA papers.' },
  { step: '03', title: 'Practical Experience', desc: 'Complete supervised training in a recognised accounting environment.' },
  { step: '04', title: 'Certification', desc: 'Obtain the CPA designation awarded by ETICPA.' },
  { step: '05', title: 'Continuing Development', desc: 'Maintain competence through annual CPD requirements.' },
]

export default async function CPAPage() {
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
            <Link href="/study/eticpa" className="hover:text-white/70 transition-colors">ETICPA</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">CPA</span>
          </nav>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-bold px-3 py-1.5 rounded-md" style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
                CPA — Certified Public Accountant
              </span>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 text-white/60">
                Syllabus under development
              </span>
            </div>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              The professional
              <br />
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                summit
              </span>
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-10">
              The ETICPA CPA — Certified Public Accountant — is the pinnacle of Ethiopian professional accountancy. ETICPA is currently finalising the full CPA syllabus. We will publish complete study notes as soon as the official papers are confirmed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://www.eticpa.et/our-qualifications/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
                View on ETICPA website
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
              <Link href="/study/eticpa"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors"
                style={{ height: '48px', width: '220px', boxSizing: 'border-box' }}>
                Back to ETICPA Hub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATUS NOTICE */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl p-10 border-l-4" style={{ backgroundColor: '#f0f7f4', borderColor: '#C9982A' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#C9982A' }}>
                  <svg className="w-5 h-5" fill="none" stroke="#1A4731" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h2 className="font-display text-xl text-navy-950 mb-3">CPA syllabus officially under development</h2>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    ETICPA was established in December 2025 and is currently developing the full CPA syllabus. The CPA qualification covers approximately 13 papers including globally aligned standards and Ethiopian-specific requirements.
                  </p>
                  <p className="text-slate-600 leading-relaxed mb-4">
                    We will publish complete CPA study notes as soon as ETICPA officially confirms the paper structure and syllabus content. We do not publish speculative content — only confirmed official curriculum.
                  </p>
                  <a href="https://www.eticpa.et/our-qualifications/" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold"
                    style={{ color: '#1A4731' }}>
                    Check the official ETICPA website for updates
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CPA PATHWAY */}
      <section className="section bg-slate-50 border-t border-slate-100">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>The CPA Journey</span>
            <h2 className="section-title mb-4">Five stages to CPA certification</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              While the full syllabus is being finalised, the overall pathway to CPA certification follows five confirmed stages.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CPA_PATHWAY.map((step) => (
              <div key={step.step} className="rounded-xl p-6 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
                <p className="font-display text-3xl font-bold mb-3" style={{ color: '#C9982A' }}><span translate="no">{step.step}</span></p>
                <p className="text-sm font-semibold text-navy-950 mb-2">{step.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* START WITH ATQ */}
      <section className="section relative overflow-hidden" style={{ backgroundColor: '#1A4731' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: '#C9982A', filter: 'blur(80px)' }} />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: '#C9982A', filter: 'blur(80px)' }} />
        </div>
        <div className="container-site relative z-10 text-center max-w-2xl mx-auto">
          <span className="eyebrow mb-4 block" style={{ color: '#C9982A' }}>Start your journey now</span>
          <h2 className="font-display text-4xl text-white mb-4 leading-tight">
            Begin with the ATQ qualification
          </h2>
          <p className="text-white/70 text-lg leading-relaxed mb-10">
            The ATQ — Accounting Technician Qualification — is fully structured and open for study now. Complete Level 1 and Level 2, then progress to CPA when ETICPA publishes the syllabus.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/study/eticpa/atq/level-1"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: '#C9982A', color: '#1A4731', height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Start ATQ Level 1
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link href="/study/eticpa"
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors"
              style={{ height: '48px', width: '220px', boxSizing: 'border-box' }}>
              Back to ETICPA Hub
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
