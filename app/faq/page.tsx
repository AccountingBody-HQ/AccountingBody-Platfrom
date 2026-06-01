'use client'

import React, { useEffect, useState } from 'react'

export default function FAQPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isEthioTax, setIsEthioTax] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    setIsEthioTax(window.location.hostname.includes('ethiotax.com'))
  }, [])

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <main className="min-h-screen bg-white">

      {/* HERO */}
      <section style={{ backgroundColor: '#1A4731' }} className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-4">
            <a href="/" className="text-sm" style={{ color: '#C9982A' }}>Home</a>
            <span className="text-green-200 mx-2">/</span>
            <span className="text-green-200 text-sm">FAQ</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-6">
            Frequently asked questions
          </h1>
          <p className="text-green-100 text-xl max-w-3xl mb-10">
            Everything you need to know about working with EthioTax. If you have a question that is not answered here, contact us directly &mdash; we respond within 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm" style={{ backgroundColor: '#C9982A', color: '#fff' }}>
              Enquire about a service
            </a>
            <a href="/wa" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2 border-white text-white">
              Ask us on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* FAQ SECTIONS */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-6 mt-12" style={{ color: '#1A4731' }}>About EthioTax</p>
          <div className="space-y-3 mb-4">
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(0)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>What is EthioTax?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 0 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 0 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 0 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 0 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">EthioTax is a managed professional services firm built exclusively for the Ethiopian community. We deliver accounting, tax, audit, payroll and business consulting services to individuals and businesses worldwide &mdash; to the highest professional standards.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(1)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>Who is EthioTax for?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 1 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 1 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 1 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 1 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">EthioTax serves the Ethiopian diaspora worldwide &mdash; in the UK, USA, Canada, UAE, Sweden, Australia and beyond &mdash; as well as individuals and businesses operating inside Ethiopia. If you are Ethiopian or have financial connections to Ethiopia, EthioTax is built for you.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(2)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>What languages do you work in?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 2 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 2 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 2 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 2 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">We work in English, Amharic and Afaan Oromoo. Every stage of your engagement &mdash; from first contact to final delivery &mdash; can be conducted in the language you are most comfortable with.</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm font-semibold tracking-widest uppercase mb-6 mt-12" style={{ color: '#1A4731' }}>Our Services</p>
          <div className="space-y-3 mb-4">
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(3)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>What services does EthioTax offer?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 3 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 3 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 3 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 3 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">EthioTax offers accounting and bookkeeping, tax filing and compliance, business consulting, payroll services, company formation, audit and assurance, and financial planning and advisory. We cover multiple jurisdictions including the UK, USA, Canada, UAE and Ethiopia.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(4)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>Do you handle cross-border tax situations?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 4 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 4 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 4 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 4 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">Yes. Cross-border tax is one of our core specialisms. We regularly handle clients with tax obligations in multiple countries &mdash; for example, an Ethiopian living in the UK with income or assets in Ethiopia, or a diaspora business operating across two jurisdictions.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(5)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>Can you help with ERCA filings in Ethiopia?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 5 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 5 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 5 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 5 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">Yes. Our team includes specialists with expertise in Ethiopian tax regulations and ERCA compliance. We handle Ethiopian income tax, business tax and other ERCA-related filings.</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm font-semibold tracking-widest uppercase mb-6 mt-12" style={{ color: '#1A4731' }}>Fees and Proposals</p>
          <div className="space-y-3 mb-4">
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(6)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>How much does EthioTax charge?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 6 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 6 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 6 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 6 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">Every engagement is priced on a fixed-fee basis, agreed in writing before any work begins. The fee depends on the service, complexity and jurisdiction. Submit an enquiry and we will provide a clear, fixed-fee proposal within 72 hours &mdash; with no obligation to proceed.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(7)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>Are there any hidden charges?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 7 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 7 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 7 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 7 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">No. The fee stated in your proposal is the fee you pay. Nothing changes without your written approval. There are no hourly rates, no scope creep charges and no surprises.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(8)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>How quickly will I receive a proposal?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 8 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 8 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 8 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 8 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">Within 72 hours of submitting your enquiry, you will receive a complete, fixed-fee proposal covering the full scope of work and timeline.</p>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm font-semibold tracking-widest uppercase mb-6 mt-12" style={{ color: '#1A4731' }}>Working With Us</p>
          <div className="space-y-3 mb-4">
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(9)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>How do I get started?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 9 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 9 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 9 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 9 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">Simply contact us via our website enquiry form, WhatsApp or email. Tell us the service you need and we will take it from there. We respond to every enquiry within 24 hours.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(10)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>What happens after I submit an enquiry?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 10 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 10 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 10 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 10 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">We review your requirements, confirm we can help, and prepare a fixed-fee proposal. Once you approve the proposal, we manage the entire engagement from that point &mdash; keeping you informed throughout.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(11)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>Is my information kept confidential?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 11 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 11 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 11 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 11 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">Absolutely. All information you share with EthioTax is treated with the strictest confidentiality. We do not share your personal or financial information with any third party without your consent.</p>
                </div>
              )}
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ borderColor: '#e8f0eb' }}>
              <button
                onClick={() => toggle(12)}
                className="w-full text-left px-7 py-5 flex items-center justify-between gap-4 font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <span>What if I am not satisfied with the service?</span>
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: openIndex === 12 ? '#1A4731' : '#f0f7f4' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: openIndex === 12 ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M2 4l4 4 4-4" stroke={openIndex === 12 ? 'white' : '#1A4731'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              {openIndex === 12 && (
                <div className="px-7 pb-5">
                  <p className="text-gray-500 text-sm leading-relaxed">We are committed to delivering to the standard agreed in your proposal. If you are not satisfied, contact us directly and we will address it. Your satisfaction is our responsibility.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="py-12 bg-white border-t" style={{ borderColor: '#e8f0eb' }}>
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-gray-400 text-xs leading-relaxed max-w-3xl">
            All professional work, filings and regulatory submissions are prepared and carried out by qualified specialists. EthioTax manages your engagement and maintains service standards throughout.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t bg-white" style={{ borderColor: '#e8f0eb' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Still have a question?</h2>
          <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">Contact us directly and we will respond within 24 hours &mdash; in English, Amharic or Afaan Oromoo.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm text-white" style={{ backgroundColor: '#1A4731' }}>
              Enquire about a service
            </a>
            <a href="/wa" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2" style={{ borderColor: '#1A4731', color: '#1A4731' }}>
              Ask us on WhatsApp
            </a>
          </div>
        </div>
      </section>

    </main>
  )
}
