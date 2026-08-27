import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Ethiopian Finance Professionals | EthioTax Recruitment',
  description: 'EthioTax places qualified Ethiopian-origin finance professionals in permanent and contract roles across the UK, US, Canada and beyond.',
}

export default async function EthiopianProfessionalsPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (!isEthioTax) redirect('/jobs')

  return (
    <main className="min-h-screen bg-surface">

      {/* HERO */}
      <section className="relative overflow-hidden py-16 md:py-24" style={{ background: '#1A4731' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, rgba(212,160,23,0.4) 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-site relative z-10">
          <nav className="flex items-center gap-2 text-white/40 text-sm mb-8">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href="/jobs" className="hover:text-white/70 transition-colors">Jobs</Link>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <span className="text-white/70">Ethiopian Professionals</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">EthioTax Recruitment</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-6 leading-tight max-w-3xl" style={{ letterSpacing: '-0.02em' }}>
            You are qualified. You should be working in finance.
          </h1>
          <p className="text-white/70 text-xl leading-relaxed max-w-2xl mb-8">
            Thousands of Ethiopian-origin professionals hold ACCA, CIMA, ETICPA, or CPA qualifications and are working in roles that do not reflect their training. We exist to change that.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/jobs/find-work"
              className="inline-flex items-center justify-center font-semibold h-11 px-6 rounded-lg text-white transition-colors hover:opacity-90 sm:flex-1"
              style={{ background: '#C9982A' }}>
              Register as a Candidate
            </Link>
            <Link href="/jobs/how-it-works"
              className="inline-flex items-center justify-center font-semibold h-11 px-6 rounded-lg transition-colors hover:opacity-80 sm:flex-1"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* WHO THIS IS FOR */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="eyebrow text-gold-600 mb-3 block">Who we work with</span>
            <h2 className="font-display text-3xl md:text-4xl text-navy-950 mb-4">Does this describe you?</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">You do not have to fit every description. One is enough.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: 'Qualified but underemployed',
                body: 'You hold ACCA, CIMA, ETICPA, CPA, or an equivalent qualification, but you are working in a role or a sector that does not use your training.',
              },
              {
                title: 'Recently relocated to the UK or abroad',
                body: 'You have moved to the UK, EU, US, Canada, or UAE and are finding it difficult to get your qualifications recognised or your experience taken seriously.',
              },
              {
                title: 'Career break or gap',
                body: 'You were working in finance in Ethiopia or elsewhere, took a break for family, relocation, or other reasons, and are ready to return but do not know where to start.',
              },
              {
                title: 'Working outside your field',
                body: 'Your current employer does not know your finance background. You are in customer service, retail, logistics, or another sector and want to move into the role you trained for.',
              },
              {
                title: 'Struggling with recognition',
                body: 'You have tried to apply directly and been ignored or rejected. You are not sure how to present your Ethiopian qualifications to international employers.',
              },
              {
                title: 'Experienced but new to the market',
                body: 'You have 5, 10, or 15 years of finance experience in Ethiopia or the region, but international employers keep asking for local experience you have not yet had the chance to build.',
              },
            ].map(card => (
              <div key={card.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="w-8 h-8 rounded-lg mb-4 flex items-center justify-center" style={{ background: 'rgba(26,71,49,0.08)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="#1A4731" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="font-semibold text-navy-950 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHAT WE DO DIFFERENTLY */}
      <section className="py-20 px-6" style={{ background: '#f8f9ff' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="eyebrow text-gold-600 mb-3 block">Why EthioTax</span>
            <h2 className="font-display text-3xl md:text-4xl text-navy-950 mb-4">We know your credentials. Employers trust our word.</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Most recruitment agencies do not understand Ethiopian qualifications. We do — and we advocate for you directly with employers who are ready to hire.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'We speak your language',
                body: 'We understand ETICPA, the Ethiopian academic system, and the standard of finance education in Ethiopia. We know what your qualification means and we explain it to employers in terms they understand.',
              },
              {
                title: 'We advocate, not just introduce',
                body: 'We do not just send your CV. We brief the employer on your background, explain your qualifications, and make the case for why you are the right candidate. You never have to justify your credentials alone.',
              },
              {
                title: 'We work with employers who are ready',
                body: 'We only work with employers who have confirmed they are open to Ethiopian-origin candidates. We do not waste your time with employers who will not give you a fair assessment.',
              },
            ].map(card => (
              <div key={card.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="w-8 h-8 rounded-lg mb-4 flex items-center justify-center" style={{ background: 'rgba(26,71,49,0.08)' }}>
                  <svg className="w-4 h-4" fill="none" stroke="#1A4731" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="font-semibold text-navy-950 mb-2">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUALIFICATIONS */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="eyebrow text-gold-600 mb-3 block">Qualifications we work with</span>
            <h2 className="font-display text-3xl text-navy-950 mb-4">Your qualification is valid. We know its value.</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">We work with candidates holding any of the following qualifications, at any stage of completion.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[
              { q: 'ETICPA', d: 'Ethiopian Institute of CPAs' },
              { q: 'ACCA', d: 'Association of Chartered Certified Accountants' },
              { q: 'CIMA', d: 'Chartered Institute of Management Accountants' },
              { q: 'CPA', d: 'Certified Public Accountant (US)' },
              { q: 'ACA / ICAEW', d: 'Institute of Chartered Accountants England & Wales' },
              { q: 'AAT', d: 'Association of Accounting Technicians' },
              { q: 'CA', d: 'Chartered Accountant (various bodies)' },
              { q: 'Degree', d: 'Accounting or Finance degree from an accredited institution' },
            ].map(item => (
              <div key={item.q} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
                <p className="font-black text-navy-950 text-lg mb-1">{item.q}</p>
                <p className="text-xs text-slate-400 leading-tight">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6" style={{ background: '#1A4731' }}>
        <div className="max-w-2xl mx-auto text-center">
          <span className="eyebrow text-gold-400 mb-4 block">Ready to register?</span>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Your next role in finance starts here.</h2>
          <p className="text-white/60 text-lg leading-relaxed mb-8">
            Registration is free. We review every profile personally. You will only hear from us when we have a role that matches your profile. We will never spam you or share your details without your knowledge.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/jobs/find-work"
              className="inline-flex items-center justify-center font-semibold h-11 px-6 rounded-lg text-white transition-colors hover:opacity-90 flex-1"
              style={{ background: '#C9982A' }}>
              Register as a Candidate
            </Link>
            <Link href="/jobs/how-it-works"
              className="inline-flex items-center justify-center font-semibold h-11 px-6 rounded-lg transition-colors hover:opacity-80 flex-1"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)' }}>
              How It Works
            </Link>
          </div>
          <p className="text-white/30 text-sm mt-6">
            Questions? Email us at{' '}
            <a href="mailto:info@ethiotax.com" className="text-white/50 hover:text-white/70 underline">info@ethiotax.com</a>
          </p>
        </div>
      </section>

    </main>
  )
}
