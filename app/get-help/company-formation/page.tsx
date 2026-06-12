import { headers } from 'next/headers'
import CompanyFormationClient from './_client'

const bullets = [
  'Company incorporation — correctly structured from day one',
  'Shareholder and director setup and documentation',
  'Bespoke articles of association or equivalent governance documents',
  'Tax registration with the relevant authorities',
  'Registered address and corporate secretarial services',
  'Advice on the most tax-efficient ownership structure',
]

export default async function CompanyFormationPage() {
  const headersList = await headers()
  const isEthioTax = headersList.get('x-et-platform') === 'ethiotax'
  if (isEthioTax) return <CompanyFormationClient />

  return (
    <main className='bg-surface'>
      <section className='relative overflow-hidden bg-navy-950 py-20 md:py-28'>
        <div className='container-site relative z-10'>
          <div className='max-w-3xl'>
            <span className='eyebrow text-gold-400 mb-5 block'>Accounting Body Professional Services</span>
            <h1 className='font-display text-white text-4xl md:text-5xl lg:text-6xl mb-6 leading-tight'>
              Company Formation
            </h1>
            <p className='text-white/60 text-xl leading-relaxed mb-4 max-w-2xl'>
              Get your business set up correctly from the very first day.
            </p>
            <p className='text-white/50 text-lg leading-relaxed mb-10 max-w-2xl'>
              Forming a company can appear straightforward but getting the structure, shareholding, governance, and director responsibilities right from the start makes an enormous difference.
            </p>
            <a href='#enquire' className='inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors'>
              Enquire About This Service
            </a>
          </div>
        </div>
      </section>
      <section className='section bg-white'>
        <div className='container-site'>
          <div className='max-w-2xl mb-10'>
            <span className='eyebrow mb-3 block'>What We Deliver</span>
            <h2 className='section-title mb-4'>Company Formation and Registration</h2>
          </div>
          <ul className='space-y-4 max-w-2xl'>
            {bullets.map(b => (
              <li key={b} className='flex items-start gap-3'>
                <span className='w-5 h-5 rounded-full bg-navy-950/10 flex items-center justify-center shrink-0 mt-0.5'>
                  <svg className='w-3 h-3 text-gold-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeWidth='3' d='M5 13l4 4L19 7'/></svg>
                </span>
                <span className='text-slate-600 text-[15px] leading-relaxed'>{b}</span>
              </li>
            ))}
          </ul>
          <p className='mt-10 text-slate-500 text-sm max-w-2xl'>
            Perfect for anyone starting a new business, transitioning from sole trader to incorporated company, or restructuring an existing business.
          </p>
        </div>
      </section>
      <section id='enquire' className='section bg-slate-50'>
        <div className='container-site'>
          <div className='max-w-lg mx-auto text-center'>
            <span className='eyebrow mb-3 block'>Get Started</span>
            <h2 className='section-title mb-4'>Enquire About Company Formation</h2>
            <p className='text-slate-500 mb-8'>Contact us and one of our specialists will be in touch within 24 hours.</p>
            <a href='/contact' className='inline-flex items-center gap-2 h-12 px-7 text-sm font-semibold rounded-lg bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors'>
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
