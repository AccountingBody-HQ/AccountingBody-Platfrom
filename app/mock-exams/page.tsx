// app/mock-exams/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getPracticeFilters } from '@/lib/practice-queries'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mock Exams | Accounting Body',
  description: 'Free timed mock exams organised by subject. 50 questions per attempt drawn from a live question bank. Unlimited attempts.',
}

export const dynamic = 'force-dynamic'

const CATEGORY_ICONS: Record<string, string> = {
  'financial-accounting':   'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z',
  'management-accounting':  'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  'audit-and-assurance':    'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  'tax':                    'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  'financial-management':   'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  'business-management':    'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  'economics':              'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  'financial-market':       'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
}

const DEFAULT_ICON = 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'

export default async function MockExamsPage() {
  const headersList = await headers()
  const isEthioTax  = headersList.get('x-et-platform') === 'ethiotax'

  // ET users stay on their own mock exams page
  if (isEthioTax) redirect('/study/mock-exams')

  const filters = await getPracticeFilters()
  const categories = filters.categories

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study" className="hover:text-white/70 transition-colors">Study</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Mock Exams</span>
          </nav>
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-widest text-gold-400 mb-4">Mock Exams</p>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Test your knowledge.<br />
              <span className="text-gold-400">Build exam confidence.</span>
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-10">
              Free timed mock exams organised by subject. Every attempt draws 50 fresh questions from the live question bank. Unlimited attempts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/practice-questions"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors"
                style={{ height: '48px', minWidth: '220px', boxSizing: 'border-box' }}>
                Browse Practice Questions
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="bg-white border-b border-slate-100">
        <div className="container-site py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            {[
              { value: '50',        label: 'Questions per exam' },
              { value: '75 mins',   label: 'Time allowed' },
              { value: '60%',       label: 'Pass mark' },
              { value: '∞',    label: 'Unlimited attempts' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-bold text-navy-950 mb-1">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORY CARDS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <p className="eyebrow mb-3 block text-navy-950">By Subject</p>
            <h2 className="section-title mb-4">Choose your subject</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Select a subject to start a 50-question timed exam. Every attempt draws a fresh random set from that subject&apos;s question bank.
            </p>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400 text-lg">No exam subjects available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map(cat => {
                const iconPath = CATEGORY_ICONS[cat.slug] ?? DEFAULT_ICON
                return (
                  <Link
                    key={cat.slug}
                    href={`/mock-exams/${cat.slug}`}
                    className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-navy-300"
                  >
                    <div className="h-1 bg-navy-950" />
                    <div className="p-6 flex flex-col flex-1">
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                          Mock Exam
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md bg-navy-950 text-gold-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
                          Live
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-slate-100 border border-slate-200">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#0C1A3D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                          <path d={iconPath} />
                        </svg>
                      </div>
                      <h3 className="font-display text-base text-navy-950 group-hover:text-gold-600 transition-colors leading-snug mb-2">
                        {cat.title}
                      </h3>
                      <div className="flex items-center gap-4 mb-5">
                        <div>
                          <p className="font-display text-xl font-bold text-navy-950">50</p>
                          <p className="text-xs text-slate-400">per attempt</p>
                        </div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div>
                          <p className="font-display text-xl font-bold text-navy-950">75</p>
                          <p className="text-xs text-slate-400">minutes</p>
                        </div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div>
                          <p className="font-display text-xl font-bold text-navy-950">\u221e</p>
                          <p className="text-xs text-slate-400">attempts</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-auto text-navy-950 group-hover:gap-2.5 transition-all">
                        Start mock exam
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* JOBS BANNER */}
      <section className="relative overflow-hidden" style={{ background: '#C9982A' }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="container-site relative z-10 py-16 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7"
                style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.15)' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#0C1A3D' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0C1A3D' }}>
                  Accounting Body Recruitment
                </span>
              </div>
              <h2 className="font-display leading-[1.06] mb-6"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: '#0C1A3D' }}>
                Studying, at university,<br /><span style={{ opacity: 0.7 }}>or already qualified?</span><br />We place accounting &amp; finance professionals.
              </h2>
              <p className="text-base leading-relaxed mb-8 max-w-lg" style={{ color: 'rgba(12,26,61,0.75)' }}>
                Register as a candidate at any stage of your journey — whether you are at university, mid-qualification or fully certified. We match you to the right role when the time is right.
              </p>
              <div className="flex flex-col gap-3 mb-10">
                {[
                  'Accounting and finance professionals only',
                  'Every candidate personally reviewed before activation',
                  '90-day replacement guarantee on every permanent placement',
                ].map(point => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: '#0C1A3D' }}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="#C9982A" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'rgba(12,26,61,0.85)' }}>{point}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/jobs/find-work"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ background: '#0C1A3D' }}>
                  Register as a Candidate
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <Link href="/jobs/how-it-works"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold transition-all hover:opacity-80 border-2"
                  style={{ borderColor: '#0C1A3D', color: '#0C1A3D', background: 'transparent' }}>
                  How it works
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden"
                style={{ background: '#0C1A3D', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div className="px-8 pt-7 pb-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#C9982A' }}>
                      Your exam-to-placement path
                    </p>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(201,152,42,0.15)', color: '#C9982A', border: '1px solid rgba(201,152,42,0.3)' }}>
                      Not a job board
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2">
                  {[
                    { value: 'Practice', label: 'Build exam confidence',  sub: 'ACCA \u00b7 CIMA \u00b7 ICAEW \u00b7 AAT' },
                    { value: 'Register', label: 'One profile \u2014 we match', sub: 'No cold applying ever' },
                    { value: 'Managed',  label: 'End-to-end placement',   sub: 'We handle every step' },
                    { value: '90 Days',  label: 'Replacement guarantee',   sub: 'On every permanent role' },
                  ].map((stat, i) => (
                    <div key={stat.label} className="p-6"
                      style={{
                        borderRight:  i % 2 === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderBottom: i < 2       ? '1px solid rgba(255,255,255,0.08)' : 'none',
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
                    Learn more \u2192
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
