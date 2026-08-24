'use client'

import Link from 'next/link'

// ── Full section — used on study, practice questions, mock exams, firms & freelancers ──

export function JobsRecruitmentSection({ isEthioTax = false }: { isEthioTax?: boolean }) {
  const brand    = isEthioTax ? '#0f2d1e' : '#0C1A3D'
  const jobCount = isEthioTax ? '1,000+' : '250,000+'

  return (
    <section className="relative overflow-hidden" style={{ background: '#C9982A' }}>
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="container-site relative z-10 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

          {/* LEFT */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7"
              style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.15)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: brand }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: brand }}>
                {isEthioTax ? 'EthioTax Recruitment' : 'Accounting Body Recruitment'}
              </span>
            </div>

            <h2 className="font-display leading-[1.06] mb-5"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: brand }}>
              {isEthioTax ? (
                <>Your next finance role<br /><span style={{ opacity: 0.65 }}>starts here.</span></>
              ) : (
                <>Your next accounting<br /><span style={{ opacity: 0.65 }}>or finance role</span><br />starts here.</>
              )}
            </h2>

            <p className="text-base leading-relaxed mb-8 max-w-lg"
              style={{ color: isEthioTax ? 'rgba(15,45,30,0.72)' : 'rgba(12,26,61,0.72)' }}>
              {isEthioTax
                ? `Browse ${jobCount} accounting and finance jobs for the Ethiopian diaspora, or register as a candidate and let our team personally match you to the right role.`
                : `Browse ${jobCount} live accounting and finance jobs yourself, or register as a candidate and let our team find the right match for you. Two paths. One platform.`}
            </p>

            {/* Two path buttons */}
            <div className="flex flex-col gap-3 mb-8">

              {/* Path 1 — Job board */}
              <Link href="/jobs/listings"
                className="flex items-center gap-4 rounded-xl px-5 py-4 transition-opacity hover:opacity-90"
                style={{ background: 'rgba(12,26,61,0.1)', border: '1.5px solid rgba(12,26,61,0.2)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(12,26,61,0.12)' }}>
                  <svg className="w-5 h-5" fill="none" stroke={brand} strokeWidth="1.75" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
                    style={{ color: isEthioTax ? 'rgba(15,45,30,0.5)' : 'rgba(12,26,61,0.5)' }}>
                    Search independently
                  </p>
                  <p className="text-sm font-semibold" style={{ color: brand }}>
                    Browse {jobCount} live jobs
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: isEthioTax ? 'rgba(15,45,30,0.5)' : 'rgba(12,26,61,0.5)' }}>
                    Filter by role, location and contract type
                  </p>
                </div>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke={brand} strokeWidth="2" viewBox="0 0 24 24" style={{ opacity: 0.4 }}>
                  <path strokeLinecap="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </Link>

              {/* Path 2 — Managed placement */}
              <Link href="/jobs/find-work"
                className="flex items-center gap-4 rounded-xl px-5 py-4 transition-opacity hover:opacity-90"
                style={{ background: brand, border: `1.5px solid ${brand}` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.75" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-white/50">
                    Get personally matched
                  </p>
                  <p className="text-sm font-semibold text-white">Register as a candidate</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    We find the right role — you never deal with employers directly
                  </p>
                </div>
                <svg className="w-4 h-4 shrink-0 text-white/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </Link>

            </div>

            {/* Trust pills */}
            <div className="flex flex-wrap gap-4">
              {[
                `${jobCount} live roles`,
                '90-day placement guarantee',
                'Accounting & finance only',
              ].map(pill => (
                <span key={pill} className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: isEthioTax ? 'rgba(15,45,30,0.55)' : 'rgba(12,26,61,0.55)' }}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M5 13l4 4L19 7"/>
                  </svg>
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT — split card */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden" style={{ background: brand, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

              {/* Card header */}
              <div className="px-8 pt-7 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
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
                  <p className="text-xs text-white/45 leading-relaxed mb-4 flex-1">
                    Search {jobCount} live vacancies. Filter by role, location and contract type. Apply directly.
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
                  <p className="text-xs text-white/45 leading-relaxed mb-4 flex-1">
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
                  <span className="font-display text-xl font-bold text-white block mb-0.5">{jobCount}</span>
                  <span className="text-[10px] font-semibold block" style={{ color: '#C9982A' }}>Live roles</span>
                  <span className="text-[10px] text-white/30">Updated daily</span>
                </div>
                <div className="p-5">
                  <span className="font-display text-xl font-bold text-white block mb-0.5">90 Days</span>
                  <span className="text-[10px] font-semibold block" style={{ color: '#C9982A' }}>Placement guarantee</span>
                  <span className="text-[10px] text-white/30">Every permanent role</span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-4 flex items-center justify-between"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(201,152,42,0.05)' }}>
                <p className="text-xs text-white/35 leading-relaxed">
                  Your profile is never made public.{' '}
                  <span className="text-white/55 font-medium">We contact you only when a role matches.</span>
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
    </section>
  )
}

// ── Compact banner — used on individual article and PQ pages ──

export function JobsRecruitmentBanner({ isEthioTax = false }: { isEthioTax?: boolean }) {
  const brand    = isEthioTax ? '#1A4731' : '#0C1A3D'
  const jobCount = isEthioTax ? '1,000+' : '250,000+'

  return (
    <section className="border-t border-slate-200 bg-white py-12">
      <div className="container-site">
        <div className="rounded-2xl overflow-hidden" style={{ background: '#C9982A' }}>
          <div className="relative px-8 py-10 md:px-12 md:py-12">
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">

              <div className="max-w-xl">
                <p className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'rgba(12,26,61,0.5)' }}>
                  {isEthioTax ? 'EthioTax Recruitment' : 'Accounting Body Recruitment'}
                </p>
                <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 leading-tight"
                  style={{ color: '#0C1A3D', letterSpacing: '-0.02em' }}>
                  {isEthioTax
                    ? 'Your next finance role starts here.'
                    : 'Your next accounting or finance role starts here.'}
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(12,26,61,0.65)' }}>
                  {isEthioTax
                    ? `Browse ${jobCount} diaspora accounting and finance jobs, or register as a candidate and let our team find the right match for you.`
                    : `Browse ${jobCount} live accounting and finance jobs yourself, or register as a candidate and let our team find the right match for you.`}
                </p>
              </div>

              <div className="flex flex-col gap-3 shrink-0 min-w-[220px]">
                <Link href="/jobs/listings"
                  className="min-h-[52px] px-6 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                  style={{ background: brand, color: '#fff' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  Browse jobs
                </Link>
                <Link href="/jobs/find-work"
                  className="min-h-[52px] px-6 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-80 border-2"
                  style={{ borderColor: brand, color: brand, background: 'transparent' }}>
                  Register as a Candidate
                </Link>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
