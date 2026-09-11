'use client'

import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useEffect } from 'react'
import './globals.css'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en-GB">
      <body className="antialiased bg-surface text-slate-900 min-h-screen flex flex-col">
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full text-center">
            <div className="w-20 h-20 rounded-2xl bg-navy-950 flex items-center justify-center mx-auto mb-8">
              <span className="font-display text-3xl font-bold text-gold-500">!</span>
            </div>
            <h1 className="font-display text-3xl text-navy-950 mb-4 leading-tight">
              Something went wrong
            </h1>
            <p className="text-slate-500 text-lg leading-relaxed mb-8">
              An unexpected error occurred. Our team has been notified. You can try again
              or return to the homepage.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => reset()}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-medium border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors"
              >
                Go to homepage
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
