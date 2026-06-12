'use client'
import { useState, useRef } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
    }
  }
}

export default function EmailSignupForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const turnstileWidgetId = useRef<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const token = (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? ''
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, _h: honeypot, 'cf-turnstile-response': token }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
      setEmail('')
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
    } catch {
      setStatus('error')
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
        <div className="flex items-center gap-3 bg-white/10 rounded-lg px-5 py-4 border border-white/20 w-full">
          <svg className="w-5 h-5 text-gold-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-white text-sm font-medium">You are subscribed — welcome!</p>
        </div>
        <button onClick={() => setStatus('idle')} className="text-xs text-white/50 hover:text-white/80 transition-colors">
          Subscribe another email
        </button>
      </div>
    )
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-md mx-auto">
        <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', padding: '2px' }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full h-13 px-4 rounded-lg text-base text-navy-950 placeholder:text-slate-400 focus:outline-none transition-all"
            style={{ backgroundColor: 'white', fontSize: '16px', WebkitAppearance: 'none', appearance: 'none', display: 'block' }}
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full h-14 px-6 rounded-lg text-base font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors shadow-gold disabled:opacity-60"
        >
          {status === 'loading' ? 'Subscribing...' : 'Subscribe free'}
        </button>
        {/* Honeypot */}
        <input type="text" value={honeypot} onChange={e => setHoneypot(e.target.value)} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
        {/* Turnstile invisible widget */}
        <div
          ref={(el) => {
            if (el && window.turnstile && !turnstileWidgetId.current) {
              turnstileWidgetId.current = window.turnstile.render(el, {
                sitekey: '0x4AAAAADeWpXpm7NrIBZp_',
                size: 'invisible',
              })
            }
          }}
        />
        {status === 'error' && (
          <p className="text-red-400 text-xs text-center">Something went wrong. Please try again.</p>
        )}
      </form>
    </>
  )
}
