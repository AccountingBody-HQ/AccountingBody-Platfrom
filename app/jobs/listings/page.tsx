import { headers } from 'next/headers'
import JobListingsClient from './JobListingsClient'
import JobSearchHero from './JobSearchHero'
import { JobListingsStructuredData } from './structured-data'

export const metadata = {
  title: 'Accounting & Finance Jobs | Accounting Body',
  description: 'Find accounting and finance jobs globally. Search roles for ACCA, CIMA, ICAEW, CPA and AAT qualified professionals across UK, US, Australia, Canada, Singapore and Africa.',
}

export default async function JobListingsPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  return (
    <>
      <JobListingsStructuredData />
      {/* HERO — matches /study page pattern exactly */}
      <section className="relative overflow-hidden bg-navy-950 py-10 md:py-16">
        {/* Background effects — identical to study page */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[70%] opacity-20"
            style={{ background: 'radial-gradient(ellipse at center top, #3a4f9a 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>
        <div className="container-wide relative z-10">
          {/* Headline */}
          <div className="max-w-2xl mb-7 md:mb-9">
            <span className="eyebrow text-gold-400 mb-3 block text-sm font-semibold uppercase tracking-widest">
              {isEthioTax ? 'Accounting & Finance Jobs — Africa' : 'Accounting & Finance Jobs'}
            </span>
            <h1 className="font-display text-white leading-tight mb-4" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', letterSpacing: '-0.02em' }}>
              Find your next{' '}
              <span style={{ background: 'linear-gradient(135deg, #D4A017 0%, #e8c050 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                accounting role.
              </span>
            </h1>
            <p className="text-white/60 text-base md:text-lg leading-relaxed">
              {isEthioTax
                ? 'ACCA, CIMA, ETICPA and AAT qualified roles across Africa and beyond.'
                : 'Roles for ACCA, CIMA, ICAEW, CPA and AAT professionals across the UK, US, Australia, Canada, Singapore and Africa.'}
            </p>
          </div>
          {/* Search form — embedded in hero, not sticky */}
          <JobSearchHero />
        </div>
      </section>
      {/* LISTINGS */}
      <JobListingsClient isEthioTax={isEthioTax} />
    </>
  )
}
