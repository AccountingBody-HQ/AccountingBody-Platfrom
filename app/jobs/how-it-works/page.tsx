'use client'

import Link from 'next/link'

export default function HowItWorksPage() {
  const isEthioTax = typeof window !== 'undefined' && window.location.hostname.includes('ethiotax.com')
  const brand = isEthioTax ? '#1A4731' : '#0C1A3D'

  return (
    <main className="min-h-screen bg-surface">
      <section className="relative overflow-hidden py-16 md:py-20" style={{ background: brand }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(212,160,23,0.3) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/jobs" className="hover:text-white/70 transition-colors">Jobs</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">How It Works</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Accounting Body Recruitment</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
            A fully managed recruitment service
          </h1>
          <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
            We sit in the middle of every placement. Candidates never deal with employers directly, and employers only meet candidates we have selected. Here is exactly how the process works.
          </p>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">

          <div className="space-y-0">
            {[
              {
                step: '01',
                title: 'You register or submit a brief',
                forWho: 'Both sides',
                body: 'Candidates complete a detailed registration form and verify their email. Employers submit a hiring brief describing the role, requirements, and budget. Both are reviewed personally by our team before any action is taken.',
              },
              {
                step: '02',
                title: 'We review and verify',
                forWho: 'Internal',
                body: 'Every candidate profile is manually reviewed. We check qualifications, experience, and fit. Every employer brief is assessed for clarity and suitability. Nothing moves forward automatically — a person reads every submission.',
              },
              {
                step: '03',
                title: 'We search and match',
                forWho: 'Internal',
                body: 'When an employer brief arrives, we search our active candidate pool for the right fit. We do not post jobs publicly or run open applications. Matching is done privately, based on role requirements and candidate profiles.',
              },
              {
                step: '04',
                title: 'We make the introduction',
                forWho: 'Both sides',
                body: 'We present the employer with a shortlist of pre-vetted candidates. We facilitate the introduction and manage all communication. Candidates are informed when they are being considered for a role — always with their prior knowledge.',
              },
              {
                step: '05',
                title: 'Offer and placement',
                forWho: 'Both sides',
                body: 'We manage the offer process, negotiate on both sides where needed, and confirm the placement. Our Fee Agreement Letter is sent before any search begins — no surprises on fees.',
              },
              {
                step: '06',
                title: '90-day guarantee',
                forWho: 'Employers',
                body: 'Every permanent placement carries our 90-day replacement guarantee. If the candidate leaves or does not work out within 90 days of starting, we conduct a replacement search at no additional cost.',
              },
            ].map((item, i, arr) => (
              <div key={item.step} className="flex gap-8 relative">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-black text-sm"
                    style={{ background: brand, color: '#C9982A', border: '2px solid #C9982A' }}>
                    {item.step}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px flex-1 my-2" style={{ background: '#e2e8f0' }} />
                  )}
                </div>
                <div className="pb-12">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-display text-xl text-navy-950">{item.title}</h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(12,26,61,0.06)', color: '#64748b' }}>
                      {item.forWho}
                    </span>
                  </div>
                  <p className="text-slate-500 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="font-display text-xl text-navy-950 mb-2">Ready to get started?</h2>
            <p className="text-slate-500 mb-6">Whether you are looking for work or looking to hire, the first step is simple.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/jobs/find-work"
                className="flex-1 text-center font-semibold py-3 px-6 rounded-lg text-white transition-colors"
                style={{ background: brand }}>
                Register as a candidate
              </Link>
              <Link href="/jobs/hire-talent"
                className="flex-1 text-center font-semibold py-3 px-6 rounded-lg transition-colors"
                style={{ background: '#fff', color: brand, border: `2px solid ${brand}` }}>
                Submit a hiring brief
              </Link>
            </div>
          </div>

        </div>
      </section>
    </main>
  )
}
