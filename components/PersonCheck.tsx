'use client'
// The person-check widget (Cloudflare Turnstile) for a public form.
//
// Renders into its own container with the api.js script that the root layout
// already loads, and waits for it the same way the contact form does. The
// current token goes to the parent through `onToken` ('' when there is none).
// `reset()` drops the current token and asks the widget for a fresh one: a
// token can be used for one submission only. The widget is removed when the
// component unmounts.

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { personCheckSiteKey } from '@/lib/person-check'

declare global {
  interface Window {
    turnstile: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string
      reset: (widgetId: string) => void
    }
  }
}

export type PersonCheckHandle = { reset: () => void }

type Props = {
  onToken: (token: string) => void
  // The server's decision for the second site, where the screen has it.
  isEthioTax?: boolean
}

function removeWidget(id: string) {
  if (!window.turnstile || !('remove' in window.turnstile)) return
  try {
    (window.turnstile as unknown as { remove: (id: string) => void }).remove(id)
  } catch (err) {
    console.warn('[turnstile] remove failed (non-fatal):', err)
  }
}

const PersonCheck = forwardRef<PersonCheckHandle, Props>(function PersonCheck({ onToken, isEthioTax }, ref) {
  const container = useRef<HTMLDivElement | null>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  const isEthioTaxRef = useRef(isEthioTax)

  useEffect(() => {
    onTokenRef.current = onToken
    isEthioTaxRef.current = isEthioTax
  })

  // Renders only when nothing is rendered yet and the script is ready.
  // Never throws: a failure is logged and left for the next attempt.
  function renderIfNeeded() {
    if (widgetId.current !== null) return
    if (!container.current || !window.turnstile) return
    try {
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: personCheckSiteKey(document.cookie, isEthioTaxRef.current, {
          ethiotax: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          ab: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY_AB,
        }),
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
      })
    } catch (err) {
      console.warn('[turnstile] render failed:', err)
    }
  }

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current('')
      const id = widgetId.current
      if (!id || !window.turnstile) {
        widgetId.current = null
        renderIfNeeded()
        return
      }
      try {
        window.turnstile.reset(id)
      } catch (err) {
        console.warn('[turnstile] reset failed; rendering again:', err)
        widgetId.current = null
        removeWidget(id)
        renderIfNeeded()
      }
    },
  }))

  // Waits for window.turnstile on a short interval, giving up after ~10 s.
  useEffect(() => {
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const tryRender = () => {
      if (cancelled || widgetId.current !== null) return
      if (container.current && window.turnstile) {
        renderIfNeeded()
        return
      }
      attempts += 1
      if (attempts < 100) timeoutId = setTimeout(tryRender, 100)
    }
    tryRender()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      const id = widgetId.current
      widgetId.current = null
      if (id) removeWidget(id)
      onTokenRef.current('')
    }
    // Runs once per mount; the refs above carry the latest props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={container} />
})

export default PersonCheck
