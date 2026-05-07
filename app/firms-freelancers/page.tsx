import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Firms & Freelancers | AccountingBody',
  description: 'Find a trusted accounting firm or freelance professional — or list your practice and get discovered by new clients.',
}

const benefits = [
  { icon: '🌐', title: 'UK-Wide Reach',      desc: 'Get discovered by businesses and individuals searching for accounting help across the UK.' },
  { icon: '⭐', title: 'Verified Listings',  desc: 'All profiles are reviewed to maintain quality and professional trust.' },
  { icon: '📩', title: 'Direct Enquiries',   desc: 'Clients contact you directly through your profile page — no middleman.' },
  { icon: '📊', title: 'Showcase Your Work', desc: 'Highlight your specialisms, qualifications, and professional experience.' },
]

const forProfessionals = [
  'Free listing — no subscription required',
  'Appear in searches by location and specialism',
  'Receive direct client enquiries',
  'Highlight ACCA, CIMA, ICAEW or AAT credentials',
]

const forClients = [
  'Search by location, specialism, and qualification',
  'View full profiles before making contact',
  'All professionals independently verified',
  'Free to search and contact',
]

export default function FirmsFreelancersPage() {
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
          <div className="max-w-3xl mx-auto text-center">
            <nav className="flex items-center justify-center gap-2 text-white/40 text-sm mb-8">
              <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
              <span className="text-white/70">Firms &amp; Freelancers</span>
            </nav>
            <span className="eyebrow text-gold-400 mb-4 block">Professional Directory</span>
            <h1 className="font-display text-white text-4xl md:text-5xl mb-5 leading-tight" style={{ letterSpacing: '-0.02em' }}>
              The Accounting Firms &amp;<br />Freelancers Directory
            </h1>
            <p className="text-white/60 text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
              Find a trusted accounting firm or freelance professional — or list your practice and get discovered by clients looking for your expertise.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/firms-freelancers/directory"
                className="h-12 px-7 flex items-center gap-2 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold">
                Browse Directory
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
              <Link href="/firms-freelancers/join"
                className="h-12 px-7 flex items-center text-sm font-medium rounded-lg border border-white/25 text-white hover:bg-white/10 hover:border-white/40 transition-all">
                List Your Practice
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* WHY JOIN */}
      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow mb-3 block">Why Join the Directory</span>
            <h2 className="section-title mb-4">Grow your practice with a free listing</h2>
            <p className="text-slate-500 text-lg leading-relaxed">
              The UK&apos;s dedicated accounting directory — built exclusively for qualified professionals.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="text-3xl mb-4">{b.icon}</div>
                <h3 className="font-display text-lg text-navy-950 mb-2">{b.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOR PROFESSIONALS / FOR CLIENTS */}
      <section className="section bg-white border-t border-slate-200">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* For clients */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8">
              <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center text-navy-700 mb-5">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-navy-950 mb-2">Looking for a Professional?</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Search our directory of verified accounting firms and freelancers by location and specialism.
              </p>
              <ul className="space-y-3 mb-8">
                {forClients.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
                    <svg className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/firms-freelancers/directory"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 transition-colors shadow-sm">
                Browse Directory
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>

            {/* For professionals */}
            <div className="bg-navy-950 rounded-xl p-8">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-gold-400 mb-5">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-white mb-2">Are You an Accountant?</h3>
              <p className="text-white/55 text-sm mb-6 leading-relaxed">
                Get listed in front of thousands of businesses and individuals searching for accounting help.
              </p>
              <ul className="space-y-3 mb-8">
                {forProfessionals.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/65">
                    <svg className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/firms-freelancers/join"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg bg-gold-500 text-navy-950 text-sm font-semibold hover:bg-gold-400 transition-colors shadow-gold">
                Join the Directory
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </Link>
            </div>

          </div>
        </div>
      </section>

    </main>
  )
}
