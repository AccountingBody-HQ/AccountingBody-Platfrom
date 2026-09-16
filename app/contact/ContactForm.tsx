'use client'
// app/contact/ContactForm.tsx
// Saves contact submissions and email subscribers to Supabase via /api/contact
// No third-party email service required.

import { useState, useRef, useEffect } from 'react'
import { safeUserFacingErrorMessage } from '@/lib/turnstile-error'

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
    }
  }
}

type FormState = 'idle' | 'loading' | 'success' | 'error'

const subjects = [
  'General Enquiry',
  'Professional Services Enquiry',
  'Enterprise Enquiry',
  'Content Error',
  'Content Partnership',
  'Technical Issue',
  'Press / Media',
  'Other',
]

export default function ContactForm() {
  const [formState, setFormState]     = useState<FormState>('idle')
  const [errorMsg, setErrorMsg]       = useState('')
  const [subscribeState, setSubState] = useState<FormState>('idle')
  const [subAlreadySent, setSubAlreadySent] = useState(false)
  const [subErrorMsg, setSubErrorMsg] = useState('')
  const contactContainer              = useRef<HTMLDivElement | null>(null)
  const contactWidgetId               = useRef<string | null>(null)
  const subscribeContainer            = useRef<HTMLDivElement | null>(null)
  const subscribeWidgetId             = useRef<string | null>(null)

  function sitekeyForThisPlatform(): string {
    return (typeof document !== 'undefined' && document.cookie.includes('x-et-platform=ethiotax'))
      ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '')
      : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_AB ?? '')
  }

  // Renders into `container` only if `widgetId` is currently empty — the
  // same one-shot guard the old single mount-effect used, just factored
  // out so it can be re-armed later (see the second pair of effects
  // below), not just run once for the component's whole lifetime. Never
  // throws: a render() failure (window.turnstile not ready yet, or a
  // genuine Cloudflare error) is logged and left for the next
  // opportunity to retry — never surfaced to the visitor.
  function renderWidgetIfNeeded(
    containerRef: React.RefObject<HTMLDivElement | null>,
    widgetIdRef: React.MutableRefObject<string | null>,
  ) {
    if (widgetIdRef.current !== null) return
    if (!containerRef.current || !window.turnstile) return
    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: sitekeyForThisPlatform(),
      })
    } catch (err) {
      console.warn('[turnstile] render failed:', err)
    }
  }

  // A submit that succeeds swaps the container out for a "success" view —
  // the widget is being thrown away, not reused, so there is nothing to
  // reset in place. Best-effort remove() (Cloudflare's own cleanup once
  // the container node is gone), then clear the id so the container's
  // next appearance (e.g. "Send another message") renders a fresh widget
  // via the formState-keyed effect below.
  function discardWidget(widgetIdRef: React.MutableRefObject<string | null>) {
    const id = widgetIdRef.current
    widgetIdRef.current = null
    if (id && window.turnstile && 'remove' in window.turnstile) {
      try {
        (window.turnstile as unknown as { remove: (id: string) => void }).remove(id)
      } catch (err) {
        console.warn('[turnstile] remove failed (non-fatal):', err)
      }
    }
  }

  // A submit that fails keeps the same container mounted (the form stays
  // visible) — reset it in place for a fresh token. If reset() itself
  // throws (the exact "Nothing to reset found for provided container"
  // failure this fixes — e.g. a stale id left over from an earlier
  // discard), fall back to rendering a brand-new widget into the
  // still-mounted container immediately, rather than leaving the form
  // without a working widget until some later, unrelated re-render.
  function resetWidgetInPlace(
    widgetIdRef: React.MutableRefObject<string | null>,
    containerRef: React.RefObject<HTMLDivElement | null>,
  ) {
    const id = widgetIdRef.current
    if (!id || !window.turnstile) {
      widgetIdRef.current = null
      renderWidgetIfNeeded(containerRef, widgetIdRef)
      return
    }
    try {
      window.turnstile.reset(id)
    } catch (err) {
      console.warn('[turnstile] reset failed; re-rendering:', err)
      widgetIdRef.current = null
      renderWidgetIfNeeded(containerRef, widgetIdRef)
    }
  }

  // Retries on a short interval only until window.turnstile becomes
  // available (the sitewide script tag in app/layout.tsx loads
  // asynchronously), giving up after ~10s. Runs once per mount; true
  // unmount is the only time the widget is actually removed here.
  useEffect(() => {
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const tryRender = () => {
      if (cancelled) return
      if (contactWidgetId.current !== null) return
      if (contactContainer.current && window.turnstile) {
        renderWidgetIfNeeded(contactContainer, contactWidgetId)
        return
      }
      attempts += 1
      if (attempts < 100) timeoutId = setTimeout(tryRender, 100)
    }
    tryRender()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (contactWidgetId.current && window.turnstile && 'remove' in window.turnstile) {
        try {
          (window.turnstile as unknown as { remove: (id: string) => void }).remove(contactWidgetId.current)
        } catch (err) {
          console.warn('[turnstile] remove on unmount failed:', err)
        }
      }
      contactWidgetId.current = null
    }
  }, [])

  useEffect(() => {
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const tryRender = () => {
      if (cancelled) return
      if (subscribeWidgetId.current !== null) return
      if (subscribeContainer.current && window.turnstile) {
        renderWidgetIfNeeded(subscribeContainer, subscribeWidgetId)
        return
      }
      attempts += 1
      if (attempts < 100) timeoutId = setTimeout(tryRender, 100)
    }
    tryRender()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (subscribeWidgetId.current && window.turnstile && 'remove' in window.turnstile) {
        try {
          (window.turnstile as unknown as { remove: (id: string) => void }).remove(subscribeWidgetId.current)
        } catch (err) {
          console.warn('[turnstile] remove on unmount failed:', err)
        }
      }
      subscribeWidgetId.current = null
    }
  }, [])

  // Re-arms rendering whenever this state changes — a no-op unless the
  // widget id was cleared (by discardWidget/resetWidgetInPlace above) AND
  // the container is currently mounted with nothing rendered into it yet.
  // This is what lets "Send another message" (formState success -> idle,
  // a fresh container) end up with a working widget/token again without a
  // page reload.
  useEffect(() => {
    renderWidgetIfNeeded(contactContainer, contactWidgetId)
  }, [formState])

  useEffect(() => {
    renderWidgetIfNeeded(subscribeContainer, subscribeWidgetId)
  }, [subscribeState])

  async function handleContactSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormState('loading')
    setErrorMsg('')
    const form = e.currentTarget

    // Get Turnstile token
    const token = (form.elements.namedItem('cf-turnstile-response') as HTMLInputElement)?.value ?? ''

    const data = {
      name:      (form.elements.namedItem('name')    as HTMLInputElement).value.trim(),
      email:     (form.elements.namedItem('email')   as HTMLInputElement).value.trim(),
      subject:   (form.elements.namedItem('subject') as HTMLSelectElement).value,
      message:   (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim(),
      subscribe: (form.elements.namedItem('subscribe') as HTMLInputElement).checked,
      _h:        (form.elements.namedItem('_h') as HTMLInputElement).value,
      'cf-turnstile-response': token,
    }
    try {
      const res  = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
      setFormState('success')
      form.reset()
      discardWidget(contactWidgetId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined
      setFormState('error')
      setErrorMsg(safeUserFacingErrorMessage(message))
      resetWidgetInPlace(contactWidgetId, contactContainer)
    }
  }

  async function handleSubscribeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubState('loading')
    const form  = e.currentTarget
    const email = (form.elements.namedItem('sub-email') as HTMLInputElement).value.trim()
    const token = (form.elements.namedItem('cf-turnstile-response') as HTMLInputElement)?.value ?? ''
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, _h: '', 'cf-turnstile-response': token }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong. Please try again.')
      setSubAlreadySent(Boolean(data.alreadySent))
      setSubState('success')
      form.reset()
      discardWidget(subscribeWidgetId)
    } catch (err) {
      setSubState('error')
      setSubErrorMsg(safeUserFacingErrorMessage(err instanceof Error ? err.message : undefined))
      resetWidgetInPlace(subscribeWidgetId, subscribeContainer)
    }
  }

  return (
    <>
      {/* No <Script> tag here — app/layout.tsx already loads the Turnstile
          API script once, globally, for every page (id="cf-turnstile-script").
          This component used to load its own second, undeduplicated copy;
          see the P8 report and components/EmailSignupForm.tsx for the same
          fix applied there. */}
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
              {/* Honeypot */}
              <input type="text" name="_h" defaultValue="" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
              {/* Turnstile invisible widget — explicit render only (see the
                  useEffect above); no className="cf-turnstile"/data-sitekey
                  here, since that would make api.js's own implicit
                  auto-render race the explicit render() call below against
                  the same container, which throws Cloudflare error 400020
                  on the second attempt regardless of any external script. */}
              <div ref={contactContainer} />
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
              Join accounting students and professionals.
            </p>
            {subscribeState === 'success' ? (
              <div className="flex items-center gap-3 bg-white/10 rounded-lg px-5 py-4 border border-white/20 max-w-sm">
                <svg className="w-5 h-5 text-gold-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-white text-sm font-medium">
                  {subAlreadySent
                    ? "We already sent you a confirmation link. Check your inbox and your spam folder. If it hasn't arrived, try again in an hour."
                    : 'Check your inbox to confirm'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubscribeSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md">
                <input name="sub-email" type="email" required placeholder="your@email.com"
                  className="flex-1 w-full h-12 px-4 rounded-lg text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent" />
                {/* Turnstile invisible widget for subscribe */}
                <div ref={subscribeContainer} />
                <button type="submit" disabled={subscribeState === 'loading'}
                  className="h-12 px-6 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 disabled:opacity-60 transition-colors whitespace-nowrap">
                  {subscribeState === 'loading' ? 'Subscribing…' : 'Subscribe free'}
                </button>
              </form>
            )}
            {subscribeState === 'error' && (
              <p role="alert" className="text-red-400 text-xs mt-2">{subErrorMsg || 'Something went wrong. Please try again.'}</p>
            )}
            <p className="text-white/30 text-xs mt-4">No spam, ever. Unsubscribe any time.</p>
          </div>
        </div>

      </div>
    </>
  )
}
