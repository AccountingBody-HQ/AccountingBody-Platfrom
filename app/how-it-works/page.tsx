'use client'

import React, { useEffect, useState } from 'react'

export default function HowItWorksPage() {
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
            <span className="text-green-200 text-sm">How It Works</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white mb-6">
            How EthioTax Works
          </h1>
          <p className="text-green-100 text-xl max-w-3xl mb-10">
            EthioTax is a professional services coordinator &mdash; not a directory, not a marketplace. You deal with us. We handle everything.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm" style={{ backgroundColor: '#C9982A', color: '#fff' }}>
              Enquire about a service
            </a>
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2 border-white text-white">
              View our services
            </a>
          </div>
        </div>
      </section>

      {/* THE MODEL */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>THE MODEL</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">One contact. Full coordination. No complexity.</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">EthioTax operates as your single point of contact for every professional service. You never deal with the professional directly &mdash; we source, instruct, manage and quality-check everything on your behalf.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">One point of contact</h3>
              <p className="text-gray-600 text-sm leading-relaxed">You always deal with EthioTax &mdash; never with the professional delivering the work. One inbox, one invoice, one relationship.</p>
            </div>
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Your provider is never disclosed</h3>
              <p className="text-gray-600 text-sm leading-relaxed">All work comes branded as EthioTax. The identity, contact details and rates of the professional are never shared with you &mdash; by design.</p>
            </div>
            <div className="rounded-2xl p-8 border" style={{ borderColor: '#d1e8db', backgroundColor: '#f0f7f4' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#C9982A"/></svg>
              </div>
              <h3 className="font-display text-xl text-gray-900 mb-3">Fixed fee always agreed first</h3>
              <p className="text-gray-600 text-sm leading-relaxed">You receive a clear, fixed-fee proposal before any work begins. No hourly surprises. No scope creep. No hidden charges.</p>
            </div>
          </div>
        </div>
      </section>

      {/* THE 5 STEPS */}
      <section className="py-20" style={{ backgroundColor: '#f0f7f4' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>THE PROCESS</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Five steps from enquiry to delivery</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Every EthioTax engagement follows the same structured process &mdash; designed to protect you, maintain quality and deliver on time.</p>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8" style={{ borderLeft: '4px solid #1A4731' }}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-bold text-white" style={{ backgroundColor: '#C9982A' }}>01</div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <h3 className="font-display text-2xl text-gray-900">Tell us what you need</h3>
                    <span className="mt-2 md:mt-0 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}>24hr response guarantee</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#C9982A' }}>What you do</p>
                      <p className="text-gray-600 text-sm leading-relaxed">Contact EthioTax via WhatsApp, our website form or email. Tell us the service you need, your jurisdiction, and any relevant context.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1A4731' }}>What EthioTax does</p>
                      <p className="text-gray-600 text-sm leading-relaxed">We respond within 24 hours on every channel, every time. We qualify your requirements, confirm we can help, and set clear expectations.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8" style={{ borderLeft: '4px solid #1A4731' }}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-bold text-white" style={{ backgroundColor: '#C9982A' }}>02</div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <h3 className="font-display text-2xl text-gray-900">We qualify your requirements</h3>
                    <span className="mt-2 md:mt-0 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}>Within 48 hours of your enquiry</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#C9982A' }}>What you do</p>
                      <p className="text-gray-600 text-sm leading-relaxed">Answer a few questions to help us scope the work accurately. The more context you provide, the more precise your proposal will be.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1A4731' }}>What EthioTax does</p>
                      <p className="text-gray-600 text-sm leading-relaxed">EthioTax prepares an internal brief covering service type, jurisdiction, complexity and urgency. We select the most appropriate professional from our vetted network.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8" style={{ borderLeft: '4px solid #1A4731' }}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-bold text-white" style={{ backgroundColor: '#C9982A' }}>03</div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <h3 className="font-display text-2xl text-gray-900">You receive a fixed-fee proposal</h3>
                    <span className="mt-2 md:mt-0 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}>72hr proposal guarantee</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#C9982A' }}>What you do</p>
                      <p className="text-gray-600 text-sm leading-relaxed">Review the proposal at your own pace. Ask questions. Once you are satisfied, confirm and pay the agreed fee or deposit.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1A4731' }}>What EthioTax does</p>
                      <p className="text-gray-600 text-sm leading-relaxed">Within 72 hours you receive a clear, fixed-fee proposal with full scope and timeline. No ambiguity. No surprises.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8" style={{ borderLeft: '4px solid #1A4731' }}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-bold text-white" style={{ backgroundColor: '#C9982A' }}>04</div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <h3 className="font-display text-2xl text-gray-900">EthioTax manages delivery</h3>
                    <span className="mt-2 md:mt-0 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}>Updates every 5 working days</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#C9982A' }}>What you do</p>
                      <p className="text-gray-600 text-sm leading-relaxed">Relax. EthioTax handles everything from this point. You will receive progress updates at minimum every 5 working days.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1A4731' }}>What EthioTax does</p>
                      <p className="text-gray-600 text-sm leading-relaxed">We instruct the professional, monitor progress, manage all communication, and perform a midpoint check-in to ensure the work is on track.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8" style={{ borderLeft: '4px solid #1A4731' }}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-xl font-bold text-white" style={{ backgroundColor: '#C9982A' }}>05</div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <h3 className="font-display text-2xl text-gray-900">Delivered and quality-checked</h3>
                    <span className="mt-2 md:mt-0 text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: '#f0f7f4', color: '#1A4731' }}>100% quality checked</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#C9982A' }}>What you do</p>
                      <p className="text-gray-600 text-sm leading-relaxed">Receive your completed work from EthioTax with a covering note. Confirm satisfaction. We follow up within 5 working days.</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1A4731' }}>What EthioTax does</p>
                      <p className="text-gray-600 text-sm leading-relaxed">Every deliverable is reviewed by EthioTax before it reaches you. We check accuracy, completeness and presentation. Nothing leaves without passing our review.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GUARANTEES */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR GUARANTEES</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">What you can expect from EthioTax</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Every engagement comes with the same four guarantees &mdash; no exceptions.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#f0f7f4' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#1A4731" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Fixed fee agreed before work starts</h3>
                <p className="text-gray-500 text-sm leading-relaxed">You will never receive a bill for more than the agreed amount. Scope changes are always discussed and agreed in writing before any additional work begins.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#f0f7f4' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#1A4731" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Quality check before every delivery</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Every deliverable is reviewed by EthioTax before it reaches you. Accuracy, completeness and presentation are checked against the agreed scope.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#f0f7f4' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#1A4731" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Amharic and Afaan Oromoo available throughout</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Every stage of your engagement &mdash; from first contact to final delivery &mdash; can be conducted in English, Amharic or Afaan Oromoo.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#f0f7f4' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="#1A4731" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Annual reminders and proactive follow-up</h3>
                <p className="text-gray-500 text-sm leading-relaxed">EthioTax tracks your deadlines and sends reminders before they fall due. We are your long-term financial services partner, not a one-time transaction.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 22-STEP PROCESS */}
      <section className="py-20" style={{ backgroundColor: '#1A4731' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#C9982A' }}>BEHIND THE SCENES</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">The 22-step coordination process</h2>
          <p className="text-green-100 text-lg mb-12 max-w-3xl">While you see five simple steps, EthioTax runs a 22-step internal process on every engagement to ensure nothing is missed.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white bg-opacity-10 rounded-2xl p-6">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C9982A' }}>PHASE 1 — ACQUISITION</p>
              <ol className="space-y-2">
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>1.</span>
                  <span>Client contacts EthioTax via website, WhatsApp, email or phone.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>2.</span>
                  <span>EthioTax responds within 24 hours — warm, professional, English or Amharic or Afaan Oromoo.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>3.</span>
                  <span>EthioTax qualifies: service type, jurisdiction, complexity, urgency, budget.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>4.</span>
                  <span>EthioTax confirms it can help and sets clear expectations.</span>
                </li>
              </ol>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-6">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C9982A' }}>PHASE 2 — PROVIDER SOURCING</p>
              <ol className="space-y-2">
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>1.</span>
                  <span>EthioTax prepares internal brief: service, jurisdiction, complexity, context.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>2.</span>
                  <span>EthioTax selects the most appropriate provider from the network.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>3.</span>
                  <span>EthioTax requests a fixed-fee quotation from provider within 48 hours.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>4.</span>
                  <span>EthioTax evaluates quotation against market rates and selects best.</span>
                </li>
              </ol>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-6">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C9982A' }}>PHASE 3 — FEE AGREEMENT</p>
              <ol className="space-y-2">
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>1.</span>
                  <span>EthioTax adds 10-15% coordination margin to provider quotation.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>2.</span>
                  <span>EthioTax prepares professional client proposal: scope, fee, timeline.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>3.</span>
                  <span>Client agrees and pays EthioTax (deposit or full payment per service).</span>
                </li>
              </ol>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-6">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C9982A' }}>PHASE 4 — DELIVERY</p>
              <ol className="space-y-2">
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>1.</span>
                  <span>EthioTax instructs provider with full brief, fee and deadline.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>2.</span>
                  <span>EthioTax monitors progress — midpoint check-in, timeline management.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>3.</span>
                  <span>Provider delivers completed work to EthioTax — never to client directly.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>4.</span>
                  <span>EthioTax quality-checks every deliverable — accuracy, completeness, presentation.</span>
                </li>
              </ol>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-6">
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: '#C9982A' }}>PHASE 5 — CLIENT DELIVERY AND RELATIONSHIP</p>
              <ol className="space-y-2">
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>1.</span>
                  <span>EthioTax delivers completed work to client with covering note.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>2.</span>
                  <span>EthioTax follows up within 5 days to confirm satisfaction.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>3.</span>
                  <span>EthioTax requests a testimonial from satisfied clients.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>4.</span>
                  <span>EthioTax pays provider their agreed fee within agreed terms.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>5.</span>
                  <span>EthioTax records the full engagement internally.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>6.</span>
                  <span>EthioTax initiates the relationship cycle — annual reminders, proactive advisory.</span>
                </li>
                <li className="flex gap-3 text-sm text-green-100">
                  <span className="flex-shrink-0 font-bold" style={{ color: '#C9982A' }}>7.</span>
                  <span>EthioTax assesses whether client is a BirrBank referral opportunity.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* COMMON QUESTIONS */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>COMMON QUESTIONS</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-12">Questions about how we work</h2>
          <div className="space-y-5">
            <div className="rounded-2xl p-7 border" style={{ borderColor: '#e8f0eb' }}>
              <h3 className="font-semibold text-gray-900 mb-3">Who actually does the work?</h3>
              <p className="text-gray-500 text-sm leading-relaxed">A qualified, vetted professional from the EthioTax network — selected specifically for your service type and jurisdiction. Their identity is not disclosed. All work is delivered under the EthioTax brand.</p>
            </div>
            <div className="rounded-2xl p-7 border" style={{ borderColor: '#e8f0eb' }}>
              <h3 className="font-semibold text-gray-900 mb-3">Will I ever speak to the professional directly?</h3>
              <p className="text-gray-500 text-sm leading-relaxed">No. All communication goes through EthioTax. This is by design — it protects you, maintains quality control, and ensures accountability sits with EthioTax throughout.</p>
            </div>
            <div className="rounded-2xl p-7 border" style={{ borderColor: '#e8f0eb' }}>
              <h3 className="font-semibold text-gray-900 mb-3">What if I am not happy with the work?</h3>
              <p className="text-gray-500 text-sm leading-relaxed">EthioTax quality-checks every deliverable before it reaches you. If you are not satisfied after delivery, raise it with EthioTax directly. We own the outcome and will resolve it — you are not dealing with a freelancer alone.</p>
            </div>
            <div className="rounded-2xl p-7 border" style={{ borderColor: '#e8f0eb' }}>
              <h3 className="font-semibold text-gray-900 mb-3">How does the fixed fee work?</h3>
              <p className="text-gray-500 text-sm leading-relaxed">You receive a written proposal stating the exact fee and scope before any work begins. Nothing changes without your written agreement. There are no hourly rates, no scope creep charges, and no surprises.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Ready to get started?</h2>
          <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">Tell us what you need and EthioTax will respond within 24 hours.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm text-white" style={{ backgroundColor: '#1A4731' }}>
              Enquire about a service
            </a>
            <a href="/get-help" className="inline-flex items-center justify-center h-[52px] w-full sm:w-[240px] rounded-xl font-semibold text-sm border-2" style={{ borderColor: '#1A4731', color: '#1A4731' }}>
              View our services
            </a>
          </div>
        </div>
      </section>

    </main>
  )
}
