import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import ComingSoonExamCard from '@/components/course/ComingSoonExamCard'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mock Exams | ETICPA ATQ | EthioTax',
  description: 'Free timed mock exams for the ETICPA ATQ qualification. 50 questions per attempt, drawn from a 3,000+ question bank. Unlimited attempts.',
}

export const dynamic = 'force-dynamic'

const MOCK_EXAMS = [
  // Level 1
  { name: 'Introduction to Accounting', level: 'ATQ Level 1', live: true,  href: '/study/eticpa/atq/level-1/introduction-to-accounting/mock-exam' },
  { name: 'Cost Accounting',             level: 'ATQ Level 1', live: true,  href: '/study/eticpa/atq/level-1/cost-accounting/mock-exam' },
  { name: 'Business Skills',             level: 'ATQ Level 1', live: false, href: '' },
  { name: 'Ethiopian Business Law',      level: 'ATQ Level 1', live: false, href: '' },
  // Level 2
  { name: 'Financial Accounting',                level: 'ATQ Level 2', live: true,  href: '/study/eticpa/atq/level-2/financial-accounting/mock-exam' },
  { name: 'Management Accounting',               level: 'ATQ Level 2', live: true,  href: '/study/eticpa/atq/level-2/management-accounting/mock-exam' },
  { name: 'Assurance, Controls & Ethics',        level: 'ATQ Level 2', live: true,  href: '/study/eticpa/atq/level-2/assurance-controls-ethics/mock-exam' },
  { name: 'Ethiopian Taxation',                  level: 'ATQ Level 2', live: false, href: '' },
  { name: 'Ethiopian Public Sector Accounting',  level: 'ATQ Level 2', live: false, href: '' },
]

export default async function MockExamsPage() {
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
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study" className="hover:text-white/70 transition-colors">Study</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/study/eticpa" className="hover:text-white/70 transition-colors">ETICPA</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Mock Exams</span>
          </nav>
          <div className="max-w-3xl">
            <span className="inline-block text-xs font-bold px-3 py-1.5 rounded-md mb-6"
              style={{ backgroundColor: '#C9982A', color: '#1A4731' }}>
              <span translate="no">ETICPA ATQ</span> — Practice Exams
            </span>
            <h1 className="font-display text-white mb-6 leading-[1.08]" style={{ letterSpacing: '-0.025em' }}>
              Test your knowledge.
              <br />
              <span style={{ background: 'linear-gradient(135deg, #C9982A 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Build exam confidence.
              </span>
            </h1>
            <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-10">
              Free timed mock exams for every <span translate="no">ETICPA ATQ</span> module — 50 questions per attempt, drawn from a 3,000+ question bank. Balanced across all topics. Unlimited attempts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/study/eticpa"
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2 border-white/30 text-white hover:border-white/60 transition-colors"
                style={{ height: '48px', minWidth: '220px', boxSizing: 'border-box' }}>
                Back to <span translate="no">ETICPA</span> Hub
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
              { value: '3,000+', label: 'Questions in pool' },
              { value: '50',     label: 'Questions per exam' },
              { value: '∞',      label: 'Unlimited attempts' },
              { value: '5',      label: 'Live exams now' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-bold mb-1" style={{ color: '#1A4731' }}>{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOCK EXAM CARDS */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block" style={{ color: '#1A4731' }}>All Modules</span>
            <h2 className="section-title mb-4">Choose your exam</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Select any live module to start a 50-question timed exam. New modules unlock as study content is published.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MOCK_EXAMS.map(exam => exam.live ? (
              <Link key={exam.href} href={exam.href}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 hover:border-[#C9982A]">
                <div className="h-1" style={{ backgroundColor: '#1A4731' }} />
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md"
                      style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}><span translate="no">{exam.level}</span></span>
                    <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md"
                      style={{ backgroundColor: '#1A4731', color: '#C9982A' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C9982A] animate-pulse" />
                      Live
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: '#f0f7f4', border: '1px solid #d1e8db' }}>
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
                      <circle cx="24" cy="26" r="14" stroke="#1A4731" strokeWidth="2"/>
                      <path d="M24 18v8l5 3" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20 8h8M24 8v4" stroke="#1A4731" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <h3 className="font-display text-base text-navy-950 group-hover:text-[#1A4731] transition-colors leading-snug mb-2">{exam.name}</h3>
                  <div className="flex items-center gap-4 mb-5">
                    <div>
                      <p className="font-display text-xl font-bold" style={{ color: '#1A4731' }}>3,000+</p>
                      <p className="text-xs text-slate-400">questions in pool</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div>
                      <p className="font-display text-xl font-bold" style={{ color: '#1A4731' }}>50</p>
                      <p className="text-xs text-slate-400">per attempt</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div>
                      <p className="font-display text-xl font-bold" style={{ color: '#1A4731' }}>∞</p>
                      <p className="text-xs text-slate-400">attempts</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold mt-auto group-hover:gap-2.5 transition-all"
                    style={{ color: '#1A4731' }}>
                    Start mock exam
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </span>
                </div>
              </Link>
            ) : (
              <ComingSoonExamCard key={exam.name} name={exam.name} level={exam.level} />
            ))}
          </div>
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
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#0f2d1e' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0f2d1e' }}>
                  EthioTax Recruitment
                </span>
              </div>
              <h2 className="font-display leading-[1.06] mb-6"
                style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.03em', color: '#0f2d1e' }}>
                Studying, at university,<br /><span style={{ opacity: 0.7 }}>or already qualified?</span><br />We place Ethiopian-origin finance professionals globally.
              </h2>
              <p className="text-base leading-relaxed mb-8 max-w-lg"
                style={{ color: 'rgba(15,45,30,0.75)' }}>
                Register as a candidate at any stage — university student, mid-qualification or fully certified. We place Ethiopian finance professionals globally.
              </p>
              <div className="flex flex-col gap-3 mb-10">
                {[
                  'Ethiopian-origin finance professionals actively placed',
                  'ETICPA, ACCA, CIMA and CPA credentials recognised',
                  '90-day replacement guarantee on every placement',
                ].map(point => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: '#0f2d1e' }}>
                      <svg className="w-2.5 h-2.5" fill="none" stroke="#C9982A" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span translate="no" className="text-sm font-medium" style={{ color: 'rgba(15,45,30,0.85)' }}>
                      {point}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/jobs/find-work"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                  style={{ background: '#0f2d1e' }}>
                  Register as a Candidate
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <Link href="/jobs/how-it-works"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-7 rounded-xl min-h-[56px] text-sm font-semibold transition-all hover:opacity-80 border-2"
                  style={{ borderColor: '#0f2d1e', color: '#0f2d1e', background: 'transparent' }}>
                  How it works
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="rounded-2xl overflow-hidden"
                style={{ background: '#0f2d1e', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
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
                    { value: 'Practice', label: 'Build exam confidence',  sub: 'ETICPA · ACCA · CIMA · CPA' },
                    { value: 'Register', label: 'One profile — we match', sub: 'No cold applying ever' },
                    { value: 'Managed',  label: 'End-to-end placement',   sub: 'We handle every step' },
                    { value: '90 Days', label: 'Replacement guarantee',   sub: 'On every permanent role' },
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
