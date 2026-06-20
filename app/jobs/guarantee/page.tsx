import Link from 'next/link'

export default function GuaranteePage() {
  return (
    <main className="min-h-screen bg-surface">
      <section className="relative overflow-hidden bg-navy-950 py-16 md:py-20">
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
            <span className="text-white/70">Our Guarantee</span>
          </nav>
          <span className="eyebrow text-gold-400 mb-4 block">Accounting Body Recruitment</span>
          <h1 className="font-display text-white text-4xl md:text-5xl mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
            90-day replacement guarantee
          </h1>
          <p className="text-white/60 text-xl leading-relaxed max-w-2xl">
            Every permanent placement we make carries a 90-day replacement guarantee. If it does not work out, we conduct a replacement search at no additional cost.
          </p>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto space-y-8">

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <h2 className="font-display text-xl text-navy-950 mb-4">What the guarantee covers</h2>
            <ul className="space-y-3">
              {[
                'If the placed candidate resigns or is dismissed within 90 days of their start date, we will conduct a replacement search at no additional fee.',
                'The guarantee applies to all permanent placements made by Accounting Body.',
                'The replacement search will be conducted within a reasonable timeframe and to the same brief as the original search.',
                'The guarantee is void if the role, responsibilities, or terms of employment change materially after placement.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-600 text-sm leading-relaxed">
                  <svg className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <h2 className="font-display text-xl text-navy-950 mb-4">What the guarantee does not cover</h2>
            <ul className="space-y-3">
              {[
                'Contract and freelance placements — the guarantee applies to permanent roles only.',
                'Situations where the employer has materially changed the role after the candidate started.',
                'Redundancy situations not related to the candidate performance or suitability.',
                'Cases where the employer has not notified us within the 90-day period.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-500 text-sm leading-relaxed">
                  <svg className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
            <h2 className="font-display text-xl text-navy-950 mb-3">How to claim the guarantee</h2>
            <p className="text-slate-500 leading-relaxed mb-4">
              If a placement does not work out within the guarantee period, contact us at <a href="mailto:info@accountingbody.com" className="text-navy-700 underline hover:text-gold-600">info@accountingbody.com</a> with the placement details. We will respond within 2 working days and initiate the replacement search process.
            </p>
            <p className="text-xs text-slate-400">Full terms and conditions are provided in the Fee Agreement Letter issued before each placement search begins.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="font-display text-xl text-navy-950 mb-2">Ready to hire?</h2>
            <p className="text-slate-500 mb-6">Submit a hiring brief and we will search our vetted candidate pool for the right match.</p>
            <Link href="/jobs/hire-talent"
              className="inline-flex font-semibold py-3 px-6 rounded-lg text-white transition-colors"
              style={{ background: '#0C1A3D' }}>
              Submit a hiring brief →
            </Link>
          </div>

        </div>
      </section>
    </main>
  )
}
