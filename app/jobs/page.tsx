import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title:       'Jobs | Accounting & Finance Recruitment',
  description: 'Find your next accounting or finance role, or hire vetted professionals. A fully managed recruitment service.',
}

function CheckIcon({ color = '#C9982A' }: { color?: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke={color} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default async function JobsHubPage() {
  const headersList  = await headers()
  const isEthioTax   = headersList.get('x-et-platform') === 'ethiotax'
  const brand        = isEthioTax ? '#1A4731' : '#0C1A3D'
  const gold         = '#C9982A'
  const platformName = isEthioTax ? 'EthioTax' : 'Accounting Body'

  const seekerPoints = [
    'Permanent and contract roles',
    'We represent you to employers',
    'Your profile is never made public',
    '90-day placement guarantee',
  ]

  const employerPoints = [
    'Permanent and contract placements',
    'Pre-vetted candidates only',
    '90-day replacement guarantee',
    'Fee agreed before search begins',
  ]

  const steps = [
    { step: '01', title: 'Register or brief us', body: 'Job seekers submit a detailed profile. Employers tell us the role they need to fill. We review every submission personally.' },
    { step: '02', title: 'We find the match', body: 'We search our vetted candidate pool and identify the right fit. Candidates are never visible to employers -- we make the introduction.' },
    { step: '03', title: 'Placement and guarantee', body: 'We manage the offer process and confirm the placement. Every permanent role carries our 90-day replacement guarantee at no extra cost.' },
  ]

  const stats = [
    { value: 'Managed',  label: 'End-to-end service',    sub: 'We handle every step of the placement' },
    { value: '90 days',   label: 'Replacement guarantee', sub: 'On every permanent placement' },
    { value: '100%',      label: 'Vetted candidates',     sub: 'Every profile reviewed before activation' },
    { value: 'Finance',   label: 'Specialists only',      sub: 'Accounting, tax, audit and payroll' },
  ]

  return (
    <main className="min-h-screen bg-white">

      {/* HERO */}
      <section className="relative overflow-hidden py-20 md:py-28" style={{ background: brand }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(212,160,23,0.3) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="container-site relative z-10">
          <div className="max-w-3xl mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-widest mb-6 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(201,152,42,0.15)', color: gold, border: `1px solid ${gold}40` }}>
              {platformName} Recruitment
            </span>
            <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight"
              style={{ letterSpacing: '-0.02em' }}>
              {isEthioTax
                ? 'Accounting and finance careers -- built for the Ethiopian community'
                : 'Specialist accounting and finance recruitment'}
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-4 max-w-2xl">
              {isEthioTax
                ? 'EthioTax connects Ethiopian finance professionals with employers across the UK, USA, Canada and beyond.'
                : 'We place accounting and finance professionals in permanent and contract roles. Fully managed -- we find the right match and guarantee every placement.'}
            </p>
            <p className="text-white/35 text-sm mb-10">
              Not a job board. Not a directory. A managed recruitment service.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/jobs/find-work"
                className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: gold, color: brand }}>
                I am looking for work
                <svg className="w4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/jobs/hire-talent"
                className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-medium text-white border border-white/25 hover:bg-white/10 transition-colors">
                I am looking to hire
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>

          {/* TWO CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-16">

            {/* Job Seeker */}
            <div className="flex flex-col rounded-2xl p-8 border" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: gold }}>For Professionals</p>
              <h2 className="font-display text-white text-2xl mb-3 leading-snug">
                {isEthioTax ? 'Find your next role' : 'Find work'}
              </h2>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                {isEthioTax
                  ? 'Register with EthioTax and get matched to permanent and contract roles with employers who value Ethiopian-origin finance professionals.'
                  : 'Register with us and we will match you to suitable permanent or contract roles. We advocate for you -- you never deal with employers directly.'}
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {seekerPoints.map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/jobs/find-work"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: gold, color: brand }}>
                Register as a candidate
                <svg className="w4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>

            {/* Employer */}
            <div className="flex flex-col rounded-2xl p-8 border" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: gold }}>For Employers</p>
              <h2 className="font-display text-white text-2xl mb-3 leading-snug">Hire talent</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                {isEthioTax
                  ? 'Tell us the role you need to fill. We search our vetted pool of Ethiopian-origin finance professionals and present you with the right candidates.'
                  : 'Tell us the role you need to fill. We search our vetted candidate pool and present you with shortlisted professionals. You only meet candidates we recommend.'}
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {employerPoints.map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/jobs/hire-talent"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold border transition-colors hover:bg-white/10"
                style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}>
                Tell us your hiring need
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="eyebrow mb-3 block">How It Works</span>
            <h2 className="section-title mb-4">A managed service, not a job board</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              {platformName} sits in the middle of every placement. Neither side deals with the other directly -- we manage every introduction, negotiation, and guarantee.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {steps.map((s, i) => (
              <div key={s.step} className="relative flex flex-col items-center text-center px-8">
                {i < 2 && (
                  <div className="hidden md:block absolute top-9 left-[calc(50%+2.5rem)] right-0 h-px bg-slate-200" />
                )}
                <div className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full bg-white border-2 mb-6 shadow-sm"
                  style={{ borderColor: gold }}>
                  <span className="font-display text-xl font-bold" style={{ color: gold }}>{s.step}</span>
                </div>
                <h3 className="font-display text-lg text-navy-950 mb-3">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y border-slate-200 bg-white">
        <div className="container-site py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={stat.label} className={i < 3 ? 'lg:border-r lg:border-slate-200 lg:pr-8' : ''}>
                <span className="font-display text-3xl block mb-1" style={{ color: brand }}>{stat.value}</span>
                <span className="text-sm font-semibold text-navy-950 block">{stat.label}</span>
                <span className="text-xs text-slate-400 mt-0.5 block">{stat.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="section bg-white">
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="section-title mb-4">Ready to get started?</h2>
            <p className="text-slate-500 text-lg mb-8">
              Every registration and every hiring brief is reviewed personally by our team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/jobs/find-work"
                className="h-12 px-8 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm"
                style={{ background: brand }}>
                I am looking for work
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/jobs/hire-talent"
                className="h-12 px-8 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border-2 transition-colors"
                style={{ borderColor: brand, color: brand }}>
                I am looking to hire
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
