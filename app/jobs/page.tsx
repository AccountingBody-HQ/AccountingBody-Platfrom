'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function CheckIcon({ color = '#C9982A' }: { color?: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke={color} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default function JobsHubPage() {
  const brand        = '#0C1A3D'
  const gold         = '#C9982A'
  const platformName = 'Accounting Body'

  const router = useRouter()
  const [roleValue, setRoleValue] = useState('')
  const [locationValue, setLocationValue] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(`/jobs/listings?role=${encodeURIComponent(roleValue)}&location=${encodeURIComponent(locationValue)}`)
  }

  const employerBullets = [
    'Pre-vetted candidates only',
    '90-day replacement guarantee',
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

        <div className="container-site relative z-10 text-center">
          <span className="eyebrow text-gold-400 mb-5 block">Accounting & Finance Jobs</span>
          <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight mx-auto max-w-3xl"
            style={{ letterSpacing: '-0.02em' }}>
            Find your next accounting or finance role
          </h1>
          <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
            Browse thousands of live accounting, tax, audit and finance vacancies updated daily.
          </p>

          <form
            onSubmit={handleSearch}
            className="mx-auto w-full max-w-2xl bg-white rounded-xl p-2 flex flex-col sm:flex-row items-stretch gap-2 shadow-lg"
          >
            <input
              type="text"
              value={roleValue}
              onChange={e => setRoleValue(e.target.value)}
              placeholder="Job title, role or keyword"
              className="flex-1 h-12 px-4 rounded-lg text-sm text-navy-950 placeholder:text-slate-400 outline-none min-w-0"
              autoComplete="off"
            />
            <input
              type="text"
              value={locationValue}
              onChange={e => setLocationValue(e.target.value)}
              placeholder="City or country"
              className="flex-1 h-12 px-4 rounded-lg text-sm text-navy-950 placeholder:text-slate-400 outline-none min-w-0"
              autoComplete="off"
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-lg text-sm font-semibold whitespace-nowrap transition-opacity hover:opacity-90"
              style={{ background: gold, color: brand }}
            >
              Search Jobs
            </button>
          </form>

          <Link href="/jobs/listings" className="inline-block mt-5 text-sm text-white/50 hover:text-white/80 transition-colors">
            or browse all live jobs →
          </Link>
        </div>
      </section>

      {/* STAT PILLS */}
      <section className="bg-white py-10">
        <div className="container-site">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['17,000+ live jobs', 'Updated daily', 'Accounting & finance only'].map(label => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border px-5 py-2 text-sm font-medium"
                style={{ borderColor: brand, color: gold }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* TWO PATHS */}
      <section className="section bg-white">
        <div className="container-site">
          <h2 className="section-title text-center mb-12">Two ways to find work</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {/* Card A — Browse live jobs */}
            <div className="flex flex-col rounded-2xl p-8 border-2 bg-white" style={{ borderColor: brand }}>
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" stroke={brand} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zM9 5h6v2H9V5z" />
                </svg>
              </div>
              <h3 className="font-display text-navy-950 text-2xl mb-3 leading-snug">Browse live jobs</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">
                Search thousands of live accounting and finance vacancies from employers across the UK and beyond. New roles added daily.
              </p>
              <Link
                href="/jobs/listings"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: gold, color: brand }}
              >
                Browse jobs →
              </Link>
            </div>

            {/* Card B — Managed placement */}
            <div className="flex flex-col rounded-2xl p-8 border border-slate-200 bg-white">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" stroke={brand} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h9m5-6l2 2 4-4" />
                </svg>
              </div>
              <h3 className="font-display text-navy-950 text-2xl mb-3 leading-snug">Get matched by our team</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">
                Register with us and we will personally match you to permanent or contract roles. You never deal with employers directly.
              </p>
              <Link
                href="/jobs/find-work"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold border-2 transition-colors"
                style={{ borderColor: brand, color: brand }}
              >
                Register as a candidate →
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* FOR EMPLOYERS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="font-display text-navy-950 text-2xl md:text-3xl mb-4 leading-snug">Looking to hire?</h2>
              <p className="text-slate-500 text-base leading-relaxed">
                Tell us the role. We search our vetted candidate pool and present you with shortlisted accounting and finance professionals. Every placement carries a 90-day guarantee.
              </p>
            </div>
            <div>
              <ul className="space-y-3 mb-6">
                {employerBullets.map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-navy-950">
                    <CheckIcon color={gold} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/jobs/hire-talent"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: brand }}
              >
                Tell us your hiring need →
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
                  <span translate="no" className="font-display text-xl font-bold" style={{ color: gold }}>{s.step}</span>
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
                <span className="font-display text-3xl block mb-1" style={{ color: brand }}><span translate="no">{stat.value}</span></span>
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
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/jobs/find-work"
                className="h-12 px-6 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm whitespace-nowrap"
                style={{ background: brand }}>
                I am looking for work
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/jobs/hire-talent"
                className="h-12 px-6 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border-2 transition-colors whitespace-nowrap"
                style={{ borderColor: brand, color: brand }}>
                I am looking to hire
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/freelancing-pathways"
                className="h-12 px-6 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold border-2 transition-colors whitespace-nowrap"
                style={{ borderColor: gold, color: gold }}>
                Explore Freelancing
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
