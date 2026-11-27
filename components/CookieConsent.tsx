// components/CookieConsent.tsx
// Cookie banner (CC-1, owner decision D245): a small, non-blocking region at the bottom of the page with
// two equal choices. Nothing is shown on the server; the stored choice is read after mount. Google Tag
// Manager and Google AdSense load only through lib/consent.ts, and only after "Accept cookies".

'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import {
  applyConsent,
  clearGoogleCookies,
  focusScrollDelta,
  isPinned,
  readConsent,
  subscribeConsent,
  thirdPartyLoaded,
  writeConsent,
  type ConsentChoice,
} from '@/lib/consent'

type Props = { gtmId: string; adsenseId: string; isEthioTax: boolean }
type Mode = 'first' | 'settings' | null

export default function CookieConsent({ gtmId, adsenseId, isEthioTax }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const [current, setCurrent] = useState<ConsentChoice | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const brand = isEthioTax ? 'EthioTax' : 'Accounting Body'

  useEffect(() => {
    const stored = readConsent()
    setCurrent(stored)
    if (stored) applyConsent(stored, { gtmId, adsenseId })
    else setMode('first')
    return subscribeConsent((e) => {
      if (e !== 'open') return
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setCurrent(readConsent())
      setMode('settings')
    })
  }, [gtmId, adsenseId])

  // Opened from "Cookie settings" (a user action): move focus to the banner title. Never on page load.
  useEffect(() => {
    if (mode === 'settings') titleRef.current?.focus()
  }, [mode])

  // While the banner shows, keep its height free at the bottom of the page (app/globals.css).
  useEffect(() => {
    const el = ref.current
    if (!mode || !el) return
    const root = document.documentElement
    const set = () => root.style.setProperty('--consent-height', `${el.getBoundingClientRect().height}px`)
    set()
    root.setAttribute('data-consent-open', '')
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      root.removeAttribute('data-consent-open')
      root.style.removeProperty('--consent-height')
    }
  }, [mode])

  // While the banner shows, an item reached with the keyboard must not be left behind it (WCAG 2.2 SC 2.4.11).
  // After the browser's own focus scroll has started, move the page just enough to show the item above the
  // banner. Items in the banner, mouse focus and items in fixed or sticky layers are left alone.
  useEffect(() => {
    const banner = ref.current
    if (!mode || !banner) return
    let raf = 0
    const check = (el: HTMLElement, again: boolean) => {
      if (!el.isConnected || document.activeElement !== el) return
      const topLimit = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
      const delta = focusScrollDelta(el.getBoundingClientRect(), banner.getBoundingClientRect().top, topLimit)
      if (delta > 0) window.scrollBy({ top: delta, behavior: 'instant' })
      else if (again) raf = requestAnimationFrame(() => check(el, false))
    }
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target
      if (!(el instanceof HTMLElement) || banner.contains(el)) return
      let keyboard = true
      try {
        keyboard = el.matches(':focus-visible')
      } catch {
        // Older browsers without :focus-visible: treat as keyboard focus.
      }
      if (!keyboard || isPinned(el)) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => check(el, true))
    }
    document.addEventListener('focusin', onFocusIn)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [mode])

  function moveFocusOut() {
    if (!ref.current?.contains(document.activeElement)) return
    const back = mode === 'settings' ? returnTo.current : null
    const target = back && back.isConnected ? back : document.getElementById('main-content')
    target?.focus({ preventScroll: true })
  }

  function choose(choice: ConsentChoice) {
    writeConsent(choice)
    setCurrent(choice)
    if (choice === 'accepted') {
      applyConsent('accepted', { gtmId, adsenseId })
    } else {
      clearGoogleCookies()
      // Code already loaded in this page cannot be unloaded: start a clean page without it.
      if (thirdPartyLoaded()) {
        window.location.reload()
        return
      }
    }
    moveFocusOut()
    setMode(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // Escape closes the banner only when it was re-opened from settings (a choice is already stored).
    if (e.key !== 'Escape' || mode !== 'settings') return
    e.preventDefault()
    moveFocusOut()
    setMode(null)
  }

  if (!mode) return null

  const buttonClass = `w-full min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
    isEthioTax ? 'bg-[#1A4731] hover:bg-[#0f2d1e]' : 'bg-navy-950 hover:bg-navy-800'
  }`

  return (
    <div
      ref={ref}
      id="cookie-banner"
      role="region"
      aria-labelledby="cookie-banner-title"
      onKeyDown={onKeyDown}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-6px_20px_-4px_rgba(12,26,61,0.15)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="container-wide py-4 lg:flex lg:items-center lg:gap-8">
        <div className="lg:flex-1">
          <p id="cookie-banner-title" ref={titleRef} tabIndex={-1} className="text-sm font-semibold text-navy-950">
            Cookies on {brand}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            We use what is needed to run this site, a security check on forms, cookie-free visit counting, and your practice notes on this device.{' '}
            {adsenseId
              ? 'If you accept, we also use analytics and advertising cookies to understand how the site is used and to show ads.'
              : 'If you accept, we also use analytics cookies to understand how the site is used.'}{' '}
            <Link
              href="/cookie-policy"
              className="font-medium text-navy-950 underline underline-offset-2 hover:text-navy-700"
            >
              Read our cookie policy
            </Link>
          </p>
          {mode === 'settings' && current && (
            <p className="mt-1 text-sm text-slate-700">
              Your current choice: {current === 'accepted' ? 'accepted' : 'rejected'}.
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-0 lg:w-[30rem] lg:shrink-0">
          <button type="button" onClick={() => choose('accepted')} className={buttonClass}>Accept cookies</button>
          <button type="button" onClick={() => choose('declined')} className={buttonClass}>Reject non-essential cookies</button>
        </div>
      </div>
    </div>
  )
}
