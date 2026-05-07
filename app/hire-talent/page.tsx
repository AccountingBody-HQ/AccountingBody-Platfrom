import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Hire Talent | AccountingBody',
  description: 'Find qualified accounting and finance professionals across the UK. Post a job or browse open roles.',
}

const roleCategories = [
  { title: 'Accountant',           icon: '📊' },
  { title: 'Bookkeeper',           icon: '📒' },
  { title: 'CFO',                  icon: '👔' },
  { title: 'Tax Advisor',          icon: '🧾' },
  { title: 'Auditor',              icon: '🔍' },
  { title: 'Payroll Manager',      icon: '💷' },
  { title: 'Finance Director',     icon: '📈' },
  { title: 'Management Accountant',icon: '📋' },
  { title: 'Financial Controller', icon: '🏦' },
  { title: 'Credit Controller',    icon: '💳' },
  { title: 'Accounts Assistant',   icon: '🗂️' },
  { title: 'Practice Manager',     icon: '🏢' },
]

const stats = [
  { label: 'Specialist Platform', value: 'Accounting' },
  { label: 'Coverage',            value: 'UK Wide' },
  { label: 'Role Types',          value: '12+' },
  { label: 'Response Time',       value: '< 24hrs' },
]

const employerBenefits = [
  'Post jobs to a targeted accounting audience',
  'Reach qualified professionals across the UK',
  'Receive applications directly to your inbox',
  'Hire faster with pre-screened candidates',
]

const seekerBenefits = [
  'Browse roles matched to your specialism',
  'Apply directly through the platform',
  'Roles from firms and businesses across the UK',
  'Dedicated accounting and finance focus',
]

export default function HireTalentPage() {
  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
                <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                <span className="text-white/70">Hire Talent</span>
              </nav>
              <span className="eyebrow text-gold-400 mb-4 block">Talent Marketplace</span>
              <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Find Top Accounting &amp;<br />Finance Talent
              </h1>
              <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-lg">
                Connect with qualified accounting professionals across the UK — from bookkeepers to CFOs. Post a role or browse open positions today.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/hire-talent/post-a-job"
                  className="h-12 px-7 flex items-center gap-2 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                  Post a Job
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <Link href="/hire-talent/jobs"
                  className="h-12 px-7 flex items-center text-sm font-medium rounded-lg border border-white/25 text-white hover:bg-white/10 hover:border-white/40 transition-all">
                  Browse Jobs
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-white/10 rounded-xl p-6 text-center border border-white/10">
                  <div className="font-display text-xl text-gold-400 mb-1">{stat.value}</div>
                  <div className="text-sm text-white/50">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BROWSE BY ROLE */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Browse by Role</span>
            <h2 className="section-title mb-4">Roles across every accounting specialism</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              Find or post roles across every accounting and finance discipline.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {roleCategories.map((role) => (
              <Link key={role.title}
                href={`/hire-talent/jobs?role=${encodeURIComponent(role.title)}`}
                className="group bg-white border border-slate-200 rounded-xl p-6 text-center hover:border-gold-400 hover:shadow-md transition-all duration-200">
                <div className="text-3xl mb-3">{role.icon}</div>
                <h3 className="text-sm font-semibold text-navy-950 group-hover:text-navy-700 transition-colors">{role.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOR EMPLOYERS / FOR JOB SEEKERS */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Employers */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8">
              <h3 className="font-display text-2xl text-navy-950 mb-6">For Employers</h3>
              <ul className="space-y-3 mb-8">
                {employerBenefits.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/hire-talent/post-a-job"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors shadow-sm">
                Post a Job
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>

            {/* Job seekers */}
            <div className="bg-navy-950 rounded-xl p-8">
              <h3 className="font-display text-2xl text-white mb-6">For Job Seekers</h3>
              <ul className="space-y-3 mb-8">
                {seekerBenefits.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/65">
                    <svg className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/hire-talent/jobs"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-gold-500 text-navy-950 text-sm font-semibold hover:bg-gold-400 transition-colors shadow-gold">
                Browse Jobs
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>

          </div>
        </div>
      </section>

    </main>
  )
}
