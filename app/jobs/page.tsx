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

  const [role, setRole] = useState('')
  const [location, setLocation] = useState('')
  const router = useRouter()

  function handleSearch() {
    const params = new URLSearchParams()
    if (role.trim())     params.set('role', role.trim())
    if (location.trim()) params.set('location', location.trim())
    router.push('/jobs/listings' + (params.toString() ? '?' + params.toString() : ''))
  }

  const employerBullets = [
    'Pre-vetted candidates only',
    '90-day replacement guarantee on every permanent placement',
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
          <span className="eyebrow text-gold-400 mb-5 block">Accounting & Finance Jobs</span>
          <h1 className="font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight"
            style={{ letterSpacing: '-0.02em' }}>
            Find your next accounting or finance role
          </h1>
          <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-2xl">
            Browse 250,000+ live accounting, tax, audit and finance vacancies. Updated daily, accounting and finance only.
          </p>

          <div className="bg-white rounded-2xl max-w-2xl overflow-hidden flex flex-col sm:flex-row">
            <input
              type="text"
              value={role}
              onChange={e => setRole(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Job title, role or keyword"
              className="flex-1 px-5 py-4 text-base border-none outline-none min-w-0"
              autoComplete="off"
            />
            <div className="hidden sm:block w-px bg-gray-200 my-3" />
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="City or country"
              className="flex-1 px-5 py-4 text-base border-none outline-none min-w-0"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSearch}
              style={{ background: gold, color: brand }}
              className="m-2 px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
            >
              Search Jobs
            </button>
          </div>

          <Link href="/jobs/listings" className="text-white/40 text-sm mt-4 inline-block hover:text-white/70 transition-colors">
            or browse all live jobs →
          </Link>

          {/* STAT PILLS */}
          <div className="flex flex-wrap gap-3 mt-10">
            {['250,000+ live jobs', 'Updated daily', 'Accounting & finance only'].map(label => (
              <span
                key={label}
                style={{ border: '1px solid rgba(212,160,23,0.4)', color: gold }}
                className="px-5 py-2 rounded-full text-sm font-medium"
              >
                {label}
              </span>
            ))}
          </div>

          {/* TWO WAYS TO FIND WORK */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">

            {/* Card A — Browse Live Jobs */}
            <div className="flex flex-col rounded-2xl p-8 border" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" stroke={gold} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                </svg>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: gold }}>Live Vacancies</p>
              <h2 className="font-display text-white text-2xl mb-3 leading-snug">Browse live jobs</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                Search 250,000+ live accounting and finance vacancies from employers across the UK and beyond. New roles posted daily.
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'Accounting and finance roles only',
                  'Updated daily from top employers',
                  'Filter by role, location and contract type',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/jobs/listings"
                style={{ backgroundColor: gold, color: brand }}
                className="mt-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              >
                Browse jobs →
              </Link>
            </div>

            {/* Card B — Managed Placement */}
            <div className="flex flex-col rounded-2xl p-8 border" style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-5">
                <svg className="w-6 h-6" fill="none" stroke={gold} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 11l2 2 4-4" />
                </svg>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: gold }}>Managed Service</p>
              <h2 className="font-display text-white text-2xl mb-3 leading-snug">Get matched by our team</h2>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                Register with us and we will personally match you to permanent or contract roles. You never deal with employers directly. Every profile reviewed personally.
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'Permanent and contract roles',
                  'We represent you to employers',
                  '90-day placement guarantee',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/jobs/find-work"
                style={{ border: '2px solid #C9982A', color: '#C9982A', background: 'transparent' }}
                className="mt-auto inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
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
          <div className="rounded-2xl p-8 md:p-12 border border-slate-200 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="eyebrow mb-3 block">For Employers</span>
                <h2 className="section-title mb-4">Looking to hire?</h2>
                <p className="text-slate-500 leading-relaxed mb-6">
                  Tell us the role. We search our vetted candidate pool and present shortlisted accounting and finance professionals. You only meet candidates we recommend.
                </p>
              </div>
              <div>
                <ul className="space-y-3">
                  {employerBullets.map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm text-navy-950">
                      <CheckIcon color={brand} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/jobs/hire-talent"
                  style={{ background: brand }}
                  className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-xl text-sm font-semibold text-white transition-colors"
                >
                  Tell us your hiring need →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <span className="eyebrow mb-3 block">How Our Managed Service Works</span>
            <h2 className="section-title mb-4">A managed service, not a job board</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              {platformName} sits in the middle of every placement. Neither side deals with the other directly — we manage every introduction, negotiation, and guarantee.
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
            <div className="grid grid-cols-4 gap-3 w-full max-w-4xl mx-auto">
              <Link
                href="/jobs/listings"
                className="flex items-center justify-center rounded-xl text-sm font-semibold text-white transition-colors py-3 px-4 text-center whitespace-nowrap"
                style={{ background: brand }}
              >
                Find a job
              </Link>
              <Link
                href="/jobs/find-work"
                className="flex items-center justify-center rounded-xl text-sm font-semibold transition-colors py-3 px-4 text-center whitespace-nowrap"
                style={{ border: '2px solid #0C1A3D', color: '#0C1A3D', background: 'transparent' }}
              >
                Register as candidate
              </Link>
              <Link
                href="/jobs/hire-talent"
                className="flex items-center justify-center rounded-xl text-sm font-semibold transition-colors py-3 px-4 text-center whitespace-nowrap"
                style={{ border: '2px solid #0C1A3D', color: '#0C1A3D', background: 'transparent' }}
              >
                I am looking to hire
              </Link>
              <Link
                href="/freelancing-pathways"
                className="flex items-center justify-center rounded-xl text-sm font-semibold transition-colors py-3 px-4 text-center whitespace-nowrap"
                style={{ border: '2px solid #C9982A', color: '#C9982A', background: 'transparent' }}
              >
                Explore freelancing
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
