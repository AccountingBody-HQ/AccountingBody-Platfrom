// components/CookieConsent.tsx
// UK GDPR compliant cookie consent — centred modal style

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const CONSENT_KEY = 'ab_cookie_consent'
type ConsentValue = 'accepted' | 'declined'

function loadGTM(gtmId: string) {
  if (!gtmId || typeof window === 'undefined') return
  const w = window as Window & { __gtm_loaded?: boolean; dataLayer?: unknown[] }
  if (w.__gtm_loaded) return
  w.__gtm_loaded = true
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`
  document.head.appendChild(script)
}

export default function CookieConsent({ gtmId }: { gtmId: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentValue | null
    if (stored === 'accepted') {
      loadGTM(gtmId)
    } else if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [gtmId])

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
    loadGTM(gtmId)
  }

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      {/* ── Backdrop ── */}
      <div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm" />

      {/* ── Modal ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

          {/* Gold top bar */}
          <div className="h-1 w-full bg-gold-500" />

          <div className="p-8">
            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-navy-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h2 className="font-display text-lg text-navy-950">
                Your privacy matters
              </h2>
            </div>

            {/* Body text */}
            <p className="text-sm text-slate-500 leading-relaxed mb-2">
              We use cookies to understand how you use AccountingBody and to improve
              your experience. We never sell your data.
            </p>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              Under UK GDPR, we need your consent before loading any analytics.{' '}
              <Link
                href="/cookie-policy"
                className="text-navy-700 hover:text-gold-600 underline underline-offset-2 transition-colors"
              >
                Read our cookie policy
              </Link>
            </p>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAccept}
                className="w-full h-12 rounded-xl text-sm font-semibold bg-navy-950 text-white hover:bg-navy-800 transition-colors"
              >
                Accept cookies
              </button>
              <button
                onClick={handleDecline}
                className="w-full h-12 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:border-slate-400 hover:text-slate-800 transition-all"
              >
                Decline non-essential cookies
              </button>
            </div>

            {/* Fine print */}
            <p className="text-xs text-slate-400 text-center mt-4 leading-relaxed">
              You can change your preference at any time in our{' '}
              <Link href="/privacy-policy" className="underline hover:text-slate-600 transition-colors">
                privacy policy
              </Link>
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
