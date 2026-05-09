import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Hire Talent | AccountingBody',
  description: 'Find qualified accounting and finance professionals across the UK. Post a job or browse open roles.',
}

const roleCategories = [
  {
    title: 'Accountant',
    desc:  'Qualified accountants for statutory accounts, compliance and reporting.',
    href:  '/hire-talent/jobs?role=Accountant',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#EEF2FF"/><rect x="10" y="11" width="20" height="18" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M14 16h12M14 20h12M14 24h7" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/><path d="M10 15h2M10 20h2M10 25h2" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/></svg>),
  },
  {
    title: 'Bookkeeper',
    desc:  'Day-to-day financial records, bank reconciliations and ledger management.',
    href:  '/hire-talent/jobs?role=Bookkeeper',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#F0FDF4"/><rect x="11" y="10" width="18" height="20" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M15 17l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 23l2 2 4-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M23 18h2M23 24h2" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round"/></svg>),
  },
  {
    title: 'CFO',
    desc:  'Senior finance leadership for strategy, fundraising and financial oversight.',
    href:  '/hire-talent/jobs?role=CFO',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#FFF7ED"/><path d="M14 26c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/><circle cx="20" cy="16" r="3" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M28 22c1.5.8 2.5 2.3 2.5 4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/><circle cx="28" cy="18" r="2" stroke="#D4A017" strokeWidth="1.4"/><path d="M12 22c-1.5.8-2.5 2.3-2.5 4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/><circle cx="12" cy="18" r="2" stroke="#D4A017" strokeWidth="1.4"/></svg>),
  },
  {
    title: 'Tax Advisor',
    desc:  'Personal and business tax planning, returns and compliance support.',
    href:  '/hire-talent/jobs?role=Tax+Advisor',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#EEF2FF"/><path d="M12 28V14a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H14a2 2 0 01-2-2z" stroke="#0C1A3D" strokeWidth="1.6" strokeLinejoin="round"/><path d="M22 12v6h6" stroke="#0C1A3D" strokeWidth="1.6" strokeLinejoin="round"/><path d="M16 21h8M16 25h5" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/></svg>),
  },
  {
    title: 'Auditor',
    desc:  'Statutory and internal audit professionals for assurance and compliance.',
    href:  '/hire-talent/jobs?role=Auditor',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#F5F3FF"/><circle cx="19" cy="19" r="7" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M24 24l5 5" stroke="#0C1A3D" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 19h6M19 16v6" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/></svg>),
  },
  {
    title: 'Payroll Manager',
    desc:  'End-to-end payroll processing, submissions and auto-enrolment management.',
    href:  '/hire-talent/jobs?role=Payroll+Manager',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#FFFBEB"/><circle cx="20" cy="20" r="9" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M20 14v1.5M20 24.5V26M17 17.5c0-1.38 1.12-2.5 3-2.5s3 1.12 3 2.5c0 1.5-1.5 2-3 2.5-1.5.5-3 1.12-3 2.5 0 1.38 1.12 2.5 3 2.5s3-1.12 3-2.5" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/></svg>),
  },
  {
    title: 'Finance Director',
    desc:  'Strategic financial leadership, planning and business partnering.',
    href:  '/hire-talent/jobs?role=Finance+Director',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#EFF6FF"/><path d="M11 29l6-7 4 4 8-10" stroke="#D4A017" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="29" cy="16" r="2" fill="#0C1A3D"/><path d="M11 12v17h18" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/></svg>),
  },
  {
    title: 'Management Accountant',
    desc:  'Budgeting, forecasting, variance analysis and management reporting.',
    href:  '/hire-talent/jobs?role=Management+Accountant',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#ECFDF5"/><rect x="10" y="24" width="4" height="6" rx="1" fill="#D4A017"/><rect x="16" y="18" width="4" height="12" rx="1" fill="#D4A017"/><rect x="22" y="21" width="4" height="9" rx="1" fill="#0C1A3D"/><rect x="28" y="14" width="4" height="16" rx="1" fill="#0C1A3D"/><path d="M11 22l6-5 6 3 6-8" stroke="#0C1A3D" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  },
  {
    title: 'Financial Controller',
    desc:  'Overseeing financial reporting, controls, reconciliations and audits.',
    href:  '/hire-talent/jobs?role=Financial+Controller',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#FEF2F2"/><rect x="10" y="13" width="20" height="14" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M10 18h20" stroke="#0C1A3D" strokeWidth="1.4"/><path d="M15 22.5h3M25 22.5h-4" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/><circle cx="28" cy="12" r="4" fill="#0C1A3D"/><path d="M26.5 12h3M28 10.5v3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>),
  },
  {
    title: 'Credit Controller',
    desc:  'Managing debtor accounts, collections and credit risk assessment.',
    href:  '/hire-talent/jobs?role=Credit+Controller',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#F0FDF4"/><rect x="8" y="14" width="24" height="15" rx="2.5" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M8 19h24" stroke="#0C1A3D" strokeWidth="1.4"/><rect x="12" y="23" width="5" height="2.5" rx="1" fill="#D4A017"/><rect x="19" y="23" width="3" height="2.5" rx="1" fill="#D4A017"/><path d="M20 10l2 4h-4l2-4z" fill="#0C1A3D"/></svg>),
  },
  {
    title: 'Accounts Assistant',
    desc:  'Supporting finance teams with data entry, invoicing and reconciliations.',
    href:  '/hire-talent/jobs?role=Accounts+Assistant',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#EEF2FF"/><rect x="11" y="9" width="18" height="22" rx="2" stroke="#0C1A3D" strokeWidth="1.6"/><path d="M15 15h10M15 19h10M15 23h6" stroke="#D4A017" strokeWidth="1.6" strokeLinecap="round"/><circle cx="28" cy="28" r="5" fill="#0C1A3D"/><path d="M26.5 28h3M28 26.5v3" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>),
  },
  {
    title: 'Practice Manager',
    desc:  'Running accountancy practice operations, client management and workflows.',
    href:  '/hire-talent/jobs?role=Practice+Manager',
    icon: (<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10"><rect width="40" height="40" rx="10" fill="#FFF7ED"/><path d="M10 29v-8a2 2 0 012-2h16a2 2 0 012 2v8" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 19v-3a6 6 0 0112 0v3" stroke="#0C1A3D" strokeWidth="1.6" strokeLinecap="round"/><rect x="17" y="22" width="6" height="7" rx="1" stroke="#D4A017" strokeWidth="1.4"/><path d="M20 24v3" stroke="#D4A017" strokeWidth="1.2" strokeLinecap="round"/></svg>),
  },
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {roleCategories.map((role) => (
              <Link key={role.title} href={role.href}
                className="group bg-white rounded-xl border border-slate-200 p-6 hover:border-gold-400 hover:shadow-lg transition-all duration-200 text-left block">
                <div className="mb-4">{role.icon}</div>
                <h3 className="font-display text-lg text-navy-950 mb-2 group-hover:text-navy-700 transition-colors">{role.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{role.desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-gold-600 group-hover:gap-2 transition-all">
                  Browse roles
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOR EMPLOYERS / FOR JOB SEEKERS */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
