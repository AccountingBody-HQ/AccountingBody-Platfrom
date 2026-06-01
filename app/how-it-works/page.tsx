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
            A fully managed service, from start to finish
          </h1>
          <p className="text-green-100 text-xl max-w-3xl mb-10">
            EthioTax is a managed professional services firm built exclusively for the Ethiopian community. Our team of specialists handles your accounting, tax, audit, payroll and business consulting needs &mdash; to the highest professional standards.
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

      {/* THREE STEPS */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>THE EXPERIENCE</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Simple for you. Rigorous behind the scenes.</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">From your first enquiry to your final deliverable, EthioTax manages everything. You stay informed at every stage &mdash; without the complexity.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display text-2xl font-bold text-white mb-6" style={{ backgroundColor: '#1A4731' }}>
                01
              </div>
              <h3 className="font-display text-2xl text-gray-900 mb-3">Tell us what you need</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Contact EthioTax by WhatsApp, our website form or email. Describe the service you need and we will take it from there. We respond within 24 hours on every channel, every time.</p>
            </div>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display text-2xl font-bold text-white mb-6" style={{ backgroundColor: '#1A4731' }}>
                02
              </div>
              <h3 className="font-display text-2xl text-gray-900 mb-3">Receive your proposal</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Within 72 hours you receive a clear, fixed-fee proposal covering the full scope of work and timeline. No ambiguity. No hourly rates. No surprises. You approve before anything begins.</p>
            </div>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-display text-2xl font-bold text-white mb-6" style={{ backgroundColor: '#1A4731' }}>
                03
              </div>
              <h3 className="font-display text-2xl text-gray-900 mb-3">We deliver, you review</h3>
              <p className="text-gray-500 text-sm leading-relaxed">Our team of specialists manages your engagement from brief to delivery. Every deliverable is reviewed to the highest professional standard before it reaches you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN EXPECT */}
      <section className="py-20" style={{ backgroundColor: '#f0f7f4' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#1A4731' }}>OUR STANDARDS</p>
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">What every EthioTax client receives</h2>
          <p className="text-gray-500 text-lg mb-12 max-w-3xl">Every engagement &mdash; regardless of service type or jurisdiction &mdash; is held to the same standards.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-5 p-7 rounded-2xl bg-white border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">A fixed fee, agreed in writing</h3>
                <p className="text-gray-500 text-sm leading-relaxed">You receive a written proposal before any work begins. The fee is fixed. The scope is defined. Nothing changes without your approval.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl bg-white border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">A 24-hour response guarantee</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Every enquiry, every channel, every time. WhatsApp, email or website form &mdash; you will hear from us within 24 hours.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl bg-white border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">A 72-hour proposal guarantee</h3>
                <p className="text-gray-500 text-sm leading-relaxed">From the moment you submit your enquiry, you receive a complete, fixed-fee proposal within 72 hours.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl bg-white border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Service in your language</h3>
                <p className="text-gray-500 text-sm leading-relaxed">English, Amharic or Afaan Oromoo &mdash; whichever you are most comfortable with, at every stage of your engagement.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl bg-white border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Quality assurance on every deliverable</h3>
                <p className="text-gray-500 text-sm leading-relaxed">Every piece of work is reviewed to the highest professional standard before it is released to you. No exceptions.</p>
              </div>
            </div>
            <div className="flex gap-5 p-7 rounded-2xl bg-white border" style={{ borderColor: '#e8f0eb' }}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: '#1A4731' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#C9982A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">A long-term professional relationship</h3>
                <p className="text-gray-500 text-sm leading-relaxed">EthioTax tracks your deadlines, sends advance reminders and provides proactive guidance &mdash; year after year.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY ETHIOTAX */}
      <section className="py-20" style={{ backgroundColor: '#1A4731' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: '#C9982A' }}>WHY ETHIOTAX</p>
          <h2 className="font-display text-3xl md:text-4xl text-white mb-4">Built for the Ethiopian community. Built for the world.</h2>
          <p className="text-green-100 text-lg mb-12 max-w-3xl">EthioTax combines the quality and expertise associated with world-class professional services firms with a modern, efficient and community-focused approach.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white bg-opacity-10 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#C9982A' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3 className="font-display text-xl text-white mb-3">Our team of specialists</h3>
              <p className="text-green-100 text-sm leading-relaxed">Every engagement is handled by a qualified specialist with the expertise and credentials relevant to your service and jurisdiction.</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#C9982A' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3 className="font-display text-xl text-white mb-3">Cross-border expertise</h3>
              <p className="text-green-100 text-sm leading-relaxed">We serve clients across the UK, USA, Canada, UAE, Ethiopia and beyond &mdash; with specialists who understand every jurisdiction we operate in.</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#C9982A' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3 className="font-display text-xl text-white mb-3">Community understanding</h3>
              <p className="text-green-100 text-sm leading-relaxed">Our team understands Ethiopian business culture, ERCA regulations, diaspora tax obligations and the specific challenges our community faces.</p>
            </div>
            <div className="bg-white bg-opacity-10 rounded-2xl p-7">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#C9982A' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h3 className="font-display text-xl text-white mb-3">Modern and efficient</h3>
              <p className="text-green-100 text-sm leading-relaxed">No unnecessary bureaucracy. No slow turnarounds. A professional service delivered with the efficiency and responsiveness of a modern platform.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="py-12 bg-white border-t" style={{ borderColor: '#e8f0eb' }}>
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-gray-400 text-xs leading-relaxed max-w-3xl">
            All professional work, filings and regulatory submissions are prepared and carried out by qualified specialists. EthioTax manages your engagement and maintains service standards throughout.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t bg-white" style={{ borderColor: '#e8f0eb' }}>
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-gray-900 mb-4">Ready to get started?</h2>
          <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">Tell us what you need and EthioTax will respond within 24 hours &mdash; in English, Amharic or Afaan Oromoo.</p>
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
