'use client'
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

export default function EmailSignupForm({ isEthioTax = false }: { isEthioTax?: boolean }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [alreadySent, setAlreadySent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const turnstileContainer = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  function sitekeyForThisPlatform(): string {
    return isEthioTax ? (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '') : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_AB ?? '')
  }

  // Renders into the container only if no widget id is currently tracked —
  // re-armable (see the status-keyed effect below), not just run once for
  // the component's whole lifetime. Never throws: a render() failure
  // (window.turnstile not ready yet, or a genuine Cloudflare error) is
  // logged and left for the next opportunity to retry — never surfaced to
  // the visitor.
  function renderWidgetIfNeeded() {
    if (turnstileWidgetId.current !== null) return
    if (!turnstileContainer.current || !window.turnstile) return
    try {
      turnstileWidgetId.current = window.turnstile.render(turnstileContainer.current, {
        sitekey: sitekeyForThisPlatform(),
      })
    } catch (err) {
      console.warn('[turnstile] render failed:', err)
    }
  }

  // A submit that succeeds swaps the form out for a "success" view — the
  // widget is being thrown away, not reused, so there is nothing to reset
  // in place. Best-effort remove(), then clear the id so the form's next
  // appearance (e.g. "Subscribe another email") renders a fresh widget via
  // the status-keyed effect below.
  function discardWidget() {
    const id = turnstileWidgetId.current
    turnstileWidgetId.current = null
    if (id && window.turnstile && 'remove' in window.turnstile) {
      try {
        (window.turnstile as unknown as { remove: (id: string) => void }).remove(id)
      } catch (err) {
        console.warn('[turnstile] remove failed (non-fatal):', err)
      }
    }
  }

  // A submit that fails keeps the same form (and container) mounted —
  // reset it in place for a fresh token. If reset() itself throws (the
  // exact "Nothing to reset found for provided container" failure this
  // fixes — e.g. a stale id left over from an earlier discard), fall back
  // to rendering a brand-new widget into the still-mounted container
  // immediately.
  function resetWidgetInPlace() {
    const id = turnstileWidgetId.current
    if (!id || !window.turnstile) {
      turnstileWidgetId.current = null
      renderWidgetIfNeeded()
      return
    }
    try {
      window.turnstile.reset(id)
    } catch (err) {
      console.warn('[turnstile] reset failed; re-rendering:', err)
      turnstileWidgetId.current = null
      renderWidgetIfNeeded()
    }
  }

  // Retries on a short interval only until window.turnstile becomes
  // available (the sitewide script tag in app/layout.tsx loads
  // asynchronously), and gives up after ~10s so it can't poll forever.
  // Runs once per mount; true unmount is the only time the widget is
  // actually removed here.
  useEffect(() => {
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const tryRender = () => {
      if (cancelled) return
      if (turnstileWidgetId.current !== null) return
      if (turnstileContainer.current && window.turnstile) {
        renderWidgetIfNeeded()
        return
      }
      attempts += 1
      if (attempts < 100) timeoutId = setTimeout(tryRender, 100)
    }
    tryRender()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (turnstileWidgetId.current && window.turnstile && 'remove' in window.turnstile) {
        try {
          (window.turnstile as unknown as { remove: (id: string) => void }).remove(turnstileWidgetId.current)
        } catch (err) {
          console.warn('[turnstile] remove on unmount failed:', err)
        }
      }
      turnstileWidgetId.current = null
    }
  }, [isEthioTax])

  // Re-arms rendering whenever status changes — a no-op unless the widget
  // id was cleared (by discardWidget/resetWidgetInPlace above) AND the
  // container is currently mounted with nothing rendered into it yet. This
  // is what lets "Subscribe another email" (success -> idle, a fresh
  // container) end up with a working widget/token again without a page
  // reload.
  useEffect(() => {
    renderWidgetIfNeeded()
  }, [status])

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
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong. Please try again.')
      setAlreadySent(Boolean(data.alreadySent))
      setStatus('success')
      setEmail('')
      discardWidget()
    } catch (err) {
      setStatus('error')
      setErrorMsg(safeUserFacingErrorMessage(err instanceof Error ? err.message : undefined))
      // Reset so a retry gets a fresh token — without this, a visitor who
      // fails once can never succeed again without reloading the page.
      resetWidgetInPlace()
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
        <div className="flex items-center gap-3 bg-white/10 rounded-lg px-5 py-4 border border-white/20 w-full">
          <svg className="w-5 h-5 text-gold-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-white text-sm font-medium">
            {alreadySent
              ? "We already sent you a confirmation link. Check your inbox and your spam folder. If it hasn't arrived, try again in an hour."
              : 'Check your inbox to confirm'}
          </p>
        </div>
        <button onClick={() => setStatus('idle')} className="text-xs text-white/50 hover:text-white/80 transition-colors">
          Subscribe another email
        </button>
      </div>
    )
  }

  return (
    // No <Script> tag here — app/layout.tsx already loads the Turnstile
    // API script once, globally, for every page (id="cf-turnstile-script").
    // This component used to load its own second, undeduplicated copy of
    // the same script on top of that; see the P8 report for why that's a
    // real redundancy worth removing even though Next.js's own script
    // loader likely already prevents it from being fetched twice over the
    // network — a widget SDK should never be initialised from two
    // independent <Script> instances if a single sitewide one already
    // covers it.
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
      <div ref={turnstileContainer} />
      {status === 'error' && (
        <p role="alert" className="text-red-400 text-xs text-center">{errorMsg || 'Something went wrong. Please try again.'}</p>
      )}
    </form>
  )
}
