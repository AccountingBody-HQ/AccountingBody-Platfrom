// components/CookieConsent.tsx
// UK GDPR compliant cookie consent banner.
// GTM only loads AFTER the user clicks "Accept cookies".

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
  const noscript = document.createElement('noscript')
  const iframe = document.createElement('iframe')
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`
  iframe.height = '0'
  iframe.width = '0'
  iframe.style.cssText = 'display:none;visibility:hidden'
  noscript.appendChild(iframe)
  document.body.insertBefore(noscript, document.body.firstChild)
}

export default function CookieConsent({ gtmId }: { gtmId: string }) {
  const [visible, setVisible]   = useState(false)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentValue | null
    if (stored === 'accepted') {
      loadGTM(gtmId)
      setResolved(true)
    } else if (stored === 'declined') {
      setResolved(true)
    } else {
      const timer = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [gtmId])

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setVisible(false)
    setResolved(true)
    loadGTM(gtmId)
  }

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, 'declined')
    setVisible(false)
    setResolved(true)
  }

  if (resolved || !visible) return null

  return (
    <>
      <div className="fixed inset-0 bg-navy-950/20 z-40 pointer-events-none" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cookie consent"
        className="fixed bottom-0 left-0 right-0 z-50 bg-navy-950 border-t border-white/10 shadow-2xl"
      >
        <div className="container-site py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

            <div className="w-10 h-10 rounded-xl bg-gold-500/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 leading-relaxed">
                <span className="font-semibold text-white">We use cookies</span> to analyse site
                traffic and improve your experience. Under UK GDPR we need your consent before
                loading analytics. We never sell your data.{' '}
                <Link href="/cookie-policy" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors">
                  Cookie policy
                </Link>
                {' · '}
                <Link href="/privacy-policy" className="text-gold-400 hover:text-gold-300 underline underline-offset-2 transition-colors">
                  Privacy policy
                </Link>
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleDecline}
                className="h-10 px-5 rounded-lg text-sm font-medium text-white/60 border border-white/20 hover:border-white/40 hover:text-white/90 transition-all"
              >
                Decline
              </button>
              <button
                onClick={handleAccept}
                className="h-10 px-5 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 transition-colors"
              >
                Accept cookies
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
