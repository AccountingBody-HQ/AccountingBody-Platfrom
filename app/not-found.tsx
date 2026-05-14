import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Not Found | Accounting Body',
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-20 h-20 rounded-2xl bg-navy-950 flex items-center justify-center mx-auto mb-8">
          <span className="font-display text-3xl font-bold text-gold-400">404</span>
        </div>
        <h1 className="font-display text-3xl text-navy-950 mb-4 leading-tight">
          Page not found
        </h1>
        <p className="text-slate-500 text-lg leading-relaxed mb-8">
          The page you are looking for does not exist or may have moved.
          Try browsing our study notes, exploring our services, or returning to the homepage.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
          >
            Go to homepage
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link
            href="/study"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-lg text-sm font-medium border border-slate-300 text-navy-950 hover:border-navy-950 transition-colors"
          >
            Browse study notes
          </Link>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-200">
          <p className="text-xs text-slate-400 mb-4">Looking for something specific?</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: 'ACCA',             href: '/study/acca' },
              { label: 'CIMA',             href: '/study/cima' },
              { label: 'ICAEW',            href: '/study/icaew' },
              { label: 'AAT',              href: '/study/aat' },
              { label: 'Practice Questions', href: '/practice-questions' },
              { label: 'Get Help',         href: '/get-help' },
            ].map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-navy-700 hover:border-navy-400 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
