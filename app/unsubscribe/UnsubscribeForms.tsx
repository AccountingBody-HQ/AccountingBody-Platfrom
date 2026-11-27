'use client'
// The two unsubscribe forms (PRIV-1): the button for a signed link from one of
// our e-mails, and the request form that sends a new link. Both post to
// /api/unsubscribe. The request form always gives the same answer, so it
// never shows whether an address is on the list.

import { useRef, useState } from 'react'
import PersonCheck, { type PersonCheckHandle } from '@/components/PersonCheck'
import { useFocusOnShow } from '@/lib/form-a11y'
import { safeUserFacingErrorMessage } from '@/lib/turnstile-error'

export type UnsubscribeMode = 'link' | 'request' | 'bad-link'

type State = 'idle' | 'loading' | 'done' | 'error'

export default function UnsubscribeForms({
  mode,
  token,
  isEthioTax,
}: {
  mode: UnsubscribeMode
  token: string
  isEthioTax: boolean
}) {
  const [linkState, setLinkState] = useState<State>('idle')
  const [requestState, setRequestState] = useState<State>('idle')
  const [requestError, setRequestError] = useState('')
  const [personCheckToken, setPersonCheckToken] = useState('')
  const personCheck = useRef<PersonCheckHandle>(null)
  const doneLine = useFocusOnShow<HTMLParagraphElement>(linkState === 'done')
  const sentLine = useFocusOnShow<HTMLParagraphElement>(requestState === 'done')

  const showLinkButton = mode === 'link' && linkState !== 'error'
  const showBadLink = mode === 'bad-link' || linkState === 'error'

  async function handleUnsubscribe() {
    setLinkState('loading')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      setLinkState(res.ok && data.success ? 'done' : 'error')
    } catch {
      setLinkState('error')
    }
  }

  async function handleRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setRequestState('loading')
    setRequestError('')
    const form = e.currentTarget
    const email = (form.elements.namedItem('unsubscribe-email') as HTMLInputElement).value.trim()
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, 'cf-turnstile-response': personCheckToken }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || undefined)
      setRequestState('done')
      form.reset()
    } catch (err) {
      setRequestState('error')
      setRequestError(safeUserFacingErrorMessage(err instanceof Error ? err.message : undefined))
      personCheck.current?.reset()
    }
  }

  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 py-20 md:py-28">
        <div className="container-site relative z-10">
          <div className="max-w-2xl">
            <h1 className="font-display text-white mb-5 leading-tight">
              {mode === 'link' ? 'Stop receiving our newsletter e-mails?' : 'Unsubscribe from our e-mails'}
            </h1>
          </div>
        </div>
      </section>

      <section className="section bg-slate-50">
        <div className="container-site">
          <div className="max-w-xl bg-white rounded-xl border border-slate-200 p-8">
            <div aria-live="polite">
              {linkState === 'done' && (
                <p ref={doneLine} tabIndex={-1} className="text-navy-950 text-sm font-medium leading-relaxed">
                  You are unsubscribed. We will not send you newsletter e-mails again.
                </p>
              )}
              {showBadLink && (
                <p className="text-sm text-red-700 mb-6 leading-relaxed">
                  This link is not valid or has expired. You can ask for a new one below.
                </p>
              )}
            </div>

            {showLinkButton && linkState !== 'done' && (
              <button type="button" onClick={handleUnsubscribe} disabled={linkState === 'loading'}
                className="h-12 px-6 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 disabled:opacity-60 transition-colors whitespace-nowrap">
                Unsubscribe
              </button>
            )}

            {mode !== 'link' || linkState === 'error' ? (
              <>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                  Enter your e-mail address and we will send you a link to unsubscribe.
                </p>
                <div aria-live="polite">
                  {requestState === 'done' && (
                    <p ref={sentLine} tabIndex={-1} className="text-navy-950 text-sm font-medium leading-relaxed">
                      If this address is on our list, we have sent you a link. Please check your inbox.
                    </p>
                  )}
                </div>
                {requestState !== 'done' && (
                  <form onSubmit={handleRequest} className="space-y-5">
                    <div>
                      <label htmlFor="unsubscribe-email" className="block text-xs font-semibold text-navy-950 mb-1.5 uppercase tracking-wide">
                        Email address
                      </label>
                      <input id="unsubscribe-email" name="unsubscribe-email" type="email" required autoComplete="email" placeholder="jane@example.com"
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:border-transparent transition" />
                    </div>
                    {requestState === 'error' && (
                      <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-700">{requestError}</p>
                      </div>
                    )}
                    <PersonCheck ref={personCheck} onToken={setPersonCheckToken} isEthioTax={isEthioTax} />
                    <button type="submit" disabled={requestState === 'loading'}
                      className="w-full h-12 rounded-lg bg-navy-950 text-white text-sm font-semibold hover:bg-navy-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm">
                      Send me the link
                    </button>
                  </form>
                )}
              </>
            ) : null}
          </div>
        </div>
      </section>
    </>
  )
}
