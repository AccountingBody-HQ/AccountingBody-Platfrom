'use client'
// app/contact/ContactForm.tsx
// Saves contact submissions and email subscribers to Supabase via /api/contact
// No third-party email service required.

import { useState } from 'react'

type FormState = 'idle' | 'loading' | 'success' | 'error'

const subjects = [
  'General Enquiry',
  'Content Error',
  'Content Partnership',
  'Enterprise Enquiry',
  'Technical Issue',
  'Press / Media',
  'Other',
]

export default function ContactForm() {
  const [formState, setFormState]     = useState<FormState>('idle')
  const [errorMsg, setErrorMsg]       = useState('')
  const [subscribeState, setSubState] = useState<FormState>('idle')

  async function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('loading')
    setErrorMsg('')
    const form = e.currentTarget
    const data = {
      name:      (form.elements.namedItem('name')    as HTMLInputElement).value.trim(),
      email:     (form.elements.namedItem('email')   as HTMLInputElement).value.trim(),
      subject:   (form.elements.namedItem('subject') as HTMLSelectElement).value,
      message:   (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim(),
      subscribe: (form.elements.namedItem('subscribe') as HTMLInputElement).checked,
    }
    try {
      const res  = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
      setFormState('success')
      form.reset()
    } catch (err: any) {
      setFormState('error')
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.')
    }
  }

  async function handleSubscribeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubState('loading')
    const form  = e.currentTarget
    const email = (form.elements.namedItem('sub-email') as HTMLInputElement).value.trim()
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, subscribe: true, subscribeOnly: true }),
      })
      if (!res.ok) throw new Error()
      setSubState('success')
      form.reset()
    } catch {
      setSubState('error')
    }
  }

  return (
    <div className="space-y-10">

      {/* CONTACT FORM */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <h2 className="font-display text-2xl text-navy-950 mb-2">Send us a message</h2>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Fill in the form below. We read every message and reply within 2 business days.
        </p>

        {formState === 'success' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-display text-xl text-navy-950 mb-2">Message received</h3>
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">
              Thank you for getting in touch. We will reply within 2 business days.
            </p>
            <button onClick={() => setFormState('idle')}
              className="mt-6 text-sm font-medium text-navy-700 hover:text-gold-600 transition-colors">
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleContactSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="name" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input id="name" name="name" type="text" required placeholder="Jane Smith"
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition" />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input id="email" name="email" type="email" required placeholder="jane@example.com"
                  className="w-full h-11 px-4 rounded-lg border border-slate-300 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition" />
              </div>
            </div>
            <div>
              <label htmlFor="subject" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                Subject <span className="text-red-500">*</span>
              </label>
              <select id="subject" name="subject" required defaultValue=""
                className="w-full h-11 px-4 rounded-lg border border-slate-300 text-sm text-navy-950 bg-white focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition">
                <option value="" disabled>Select a subject…</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="message" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea id="message" name="message" required rows={6} placeholder="How can we help you?"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition resize-none" />
            </div>
            <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
              <input id="subscribe" name="subscribe" type="checkbox" defaultChecked
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-navy-950 focus:ring-navy-950 shrink-0" />
              <label htmlFor="subscribe" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                Also subscribe me to the free weekly email — exam tips and study guides written by qualified accountants.
              </label>
            </div>
            {formState === 'error' && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{errorMsg || 'Something went wrong. Please try again.'}</p>
              </div>
            )}
            <button type="submit" disabled={formState === 'loading'}
              className="w-full h-12 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm">
              {formState === 'loading' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Sending…
                </>
              ) : 'Send message'}
            </button>
            <p className="text-xs text-slate-400 text-center">
              By submitting this form you agree to our{" "}
              <a href="/privacy-policy" className="underline hover:text-navy-700 transition-colors">Privacy Policy</a>.
            </p>
          </form>
        )}
      </div>

      {/* NEWSLETTER-ONLY */}
      <div className="bg-navy-950 rounded-xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 20%, #D4A017 0%, transparent 60%)' }} />
        <div className="relative z-10">
          <span className="eyebrow text-gold-400 mb-3 block">Stay Ahead</span>
          <h2 className="font-display text-2xl text-white mb-2 leading-tight">Free exam tips, straight to your inbox</h2>
          <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-lg">
            Weekly study tips and new question releases — written by qualified accountants.
            Join 12,000+ accounting students and professionals.
          </p>
          {subscribeState === 'success' ? (
            <div className="flex items-center gap-3 bg-white/10 rounded-lg px-5 py-4 border border-white/20 max-w-sm">
              <svg className="w-5 h-5 text-gold-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-white text-sm font-medium">You are subscribed — welcome!</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribeSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
              <input name="sub-email" type="email" required placeholder="your@email.com"
                className="flex-1 h-12 px-4 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" />
              <button type="submit" disabled={subscribeState === 'loading'}
                className="h-12 px-6 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 disabled:opacity-60 transition-colors whitespace-nowrap">
                {subscribeState === 'loading' ? 'Subscribing…' : 'Subscribe free'}
              </button>
            </form>
          )}
          {subscribeState === 'error' && (
            <p className="text-red-400 text-xs mt-2">Something went wrong. Please try again.</p>
          )}
          <p className="text-white/30 text-xs mt-4">No spam, ever. Unsubscribe any time.</p>
        </div>
      </div>

    </div>
  )
}
