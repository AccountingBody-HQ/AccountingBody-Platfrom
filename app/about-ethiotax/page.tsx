'use client'

import React, { useEffect, useState } from 'react'

export default function AboutEthioTaxPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isEthioTax, setIsEthioTax] = useState(false)

  useEffect(() => {
    setIsEthioTax(window.location.hostname.includes('ethiotax.com'))
  }, [])

  return (
    <main className="min-h-screen bg-white">

      {/* HERO */}
      <section style={{ backgroundColor: '#1A4731' }} className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-4">
            <a href="/" className="text-sm" style={{ color: '#C9982A' }}>Home</a>
            <span className="text-green-200 mx-2">/</span>
            <span className="text-green-200 text-sm">About EthioTax</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-6">
            About EthioTax
          </h1>
          <p className="text-green-100 text-xl max-w-3xl mb-10">
            EthioTax is a professional services coordinator built for the Ethiopian community worldwide. We deliver accounting, tax, audit, payroll and business consulting &mdash; fully managed, under one roof.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm" style={{ backgroundColor: '#C9982A', color: '#fff' }}>
              Enquire about a service
            </a>
            <a href="/how-it-works" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2 border-white text-white">
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* OUR MISSION */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR MISSION</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-6">For the Ethiopian Community &mdash; Worldwide</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">The Ethiopian community &mdash; whether in Addis Ababa, London, Washington DC, Toronto, Dubai or Stockholm &mdash; has long deserved a professional services firm that truly understands its needs.</p>
              <p className="text-gray-600 text-lg leading-relaxed mb-6">EthioTax was built to fill that gap. We coordinate qualified, Ethiopian-origin professionals to deliver accounting, tax, audit, payroll and business consulting services to individuals and businesses across the globe.</p>
              <p className="text-gray-600 text-lg leading-relaxed">Every engagement is managed end-to-end by EthioTax. You deal with us. We handle everything.</p>
            </div>
            <div className="rounded-2xl p-8" style={{ backgroundColor: '#f0f7f4', borderLeft: '4px solid #1A4731' }}>
              <p className="font-display text-2xl text-gray-900 mb-2">Our mission</p>
              <p className="text-gray-600 leading-relaxed mb-6">To make world-class professional financial services accessible to every member of the Ethiopian community, wherever they are in the world &mdash; delivered in their language, by professionals who understand their context.</p>
              <p className="font-display text-2xl text-gray-900 mb-2">Our vision</p>
              <p className="text-gray-600 leading-relaxed">To become the most trusted financial services brand in the global Ethiopian community &mdash; the first call for tax, accounting, business and finance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* THE COORDINATOR MODEL */}
      <section className="py-20" style={{ backgroundColor: '#f0f7f4' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>HOW WE WORK</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">The coordinator model</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">EthioTax is not a directory. We are not a marketplace. We do not connect you with a professional and step back. We coordinate, manage and quality-check every engagement from start to finish.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl p-8 text-white" style={{ backgroundColor: '#1A4731' }}>
              <h3 className="font-display text-xl mb-5">What we are</h3>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>A professional services coordinator</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>Your single point of contact</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>The quality check on every deliverable</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>Your long-term financial services partner</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>Available in English, Amharic and Afaan Oromoo</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl p-8 text-white" style={{ backgroundColor: '#C9982A' }}>
              <h3 className="font-display text-xl mb-5">What we are not</h3>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm">
                  <span style={{ color: 'white' }}>&#10007;</span>
                  <span>A freelancer marketplace</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: 'white' }}>&#10007;</span>
                  <span>A professional directory</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: 'white' }}>&#10007;</span>
                  <span>A platform that connects and steps back</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: 'white' }}>&#10007;</span>
                  <span>An employer of professionals</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: 'white' }}>&#10007;</span>
                  <span>A firm that holds professional licences</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl p-8 text-white" style={{ backgroundColor: '#1A4731' }}>
              <h3 className="font-display text-xl mb-5">What you get</h3>
              <ul className="space-y-3">
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>One contact for every service</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>A fixed fee agreed before work starts</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>Quality-checked deliverables every time</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>24hr response on every channel</span>
                </li>
                <li className="flex gap-3 text-sm">
                  <span style={{ color: '#C9982A' }}>&#10003;</span>
                  <span>Annual reminders and proactive follow-up</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* OUR LANGUAGES */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR LANGUAGES</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Professional services in your language</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Every stage of your engagement &mdash; from first contact to final delivery &mdash; can be conducted in the language you are most comfortable with.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">English</h3>
              <p className="text-gray-600 text-sm leading-relaxed">The primary language of all formal deliverables, proposals and legal documents.</p>
            </div>
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Amharic</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Full service available in Amharic &mdash; from first enquiry to final delivery.</p>
            </div>
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Afaan Oromoo</h3>
              <p className="text-gray-600 text-sm leading-relaxed">Full service available in Afaan Oromoo &mdash; from first enquiry to final delivery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OUR COMMUNITY */}
      <section className="py-20" style={{ backgroundColor: '#1A4731' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#C9982A' }}>OUR COMMUNITY</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Ethiopia and its global diaspora</h2>
          <p className="text-green-100 text-lg mb-12 max-w-3xl">EthioTax serves the Ethiopian community wherever they are &mdash; inside Ethiopia and across every major diaspora market worldwide.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Ethiopia</p>
              <p className="text-green-200 text-sm mb-3">Addis Ababa and all regions</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Tier 1</span>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">United Kingdom</p>
              <p className="text-green-200 text-sm mb-3">London, Sheffield, Milton Keynes</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Tier 1</span>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">United States</p>
              <p className="text-green-200 text-sm mb-3">Washington DC, Minneapolis, Dallas</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Tier 1</span>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Canada</p>
              <p className="text-green-200 text-sm mb-3">Toronto, Calgary</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Tier 2</span>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">UAE</p>
              <p className="text-green-200 text-sm mb-3">Dubai, Abu Dhabi</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Tier 2</span>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Sweden</p>
              <p className="text-green-200 text-sm mb-3">Stockholm</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Tier 2</span>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Australia</p>
              <p className="text-green-200 text-sm mb-3">Melbourne, Sydney</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Tier 3</span>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-5">
              <p className="font-semibold text-white mb-1">Worldwide</p>
              <p className="text-green-200 text-sm mb-3">All other diaspora locations</p>
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: '#C9982A', color: 'white' }}>Global</span>
            </div>
          </div>
        </div>
      </section>

      {/* OUR VALUES */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR VALUES</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">What we stand for</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Four values guide every decision EthioTax makes &mdash; from how we vet professionals to how we handle a client complaint.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Quality</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Every deliverable is quality-checked before it reaches you. We do not release work that does not meet our standards. No exceptions.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Transparency</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Fixed fees agreed in writing before work starts. No hidden charges. No surprises. You always know exactly what you are paying and what you are getting.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Community</h3>
                <p className="text-gray-500 text-sm leading-relaxed">EthioTax exists to serve the Ethiopian community. Every decision we make is guided by what is best for our clients and the broader community we serve.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1A4731' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="#C9982A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-display text-xl text-gray-900 mb-2">Trust</h3>
                <p className="text-gray-500 text-sm leading-relaxed">You trust EthioTax with sensitive financial information. We protect that trust through confidentiality, professionalism and consistent delivery.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Ready to work with EthioTax?</h2>
          <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">Tell us what you need and we will respond within 24 hours &mdash; in English, Amharic or Afaan Oromoo.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm text-white" style={{ backgroundColor: '#1A4731' }}>
              Enquire about a service
            </a>
            <a href="/how-it-works" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2" style={{ borderColor: '#1A4731', color: '#1A4731' }}>
              How it works
            </a>
          </div>
        </div>
      </section>

    </main>
  )
}
