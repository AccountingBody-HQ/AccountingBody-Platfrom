// components/layout/Footer.tsx
// AccountingBody Design System — Footer
// Complete footer with link columns, email signup, legal, social, stats bar

'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FooterLink {
  label:    string
  href:     string
  badge?:   string
  external?: boolean
  new?:     boolean
}

interface FooterColumn {
  title: string
  links: FooterLink[]
}

// ── Footer data ───────────────────────────────────────────────────────────────

const footerColumns: FooterColumn[] = [
  {
    title: 'Study',
    links: [
      { label: 'ACCA Study Hub',           href: '/study/acca',    badge: 'Popular' },
      { label: 'CIMA Study Hub',            href: '/study/cima' },
      { label: 'AAT Study Hub',             href: '/study/aat' },
      { label: 'ICAEW / ACA',               href: '/study/icaew' },
      { label: 'All Qualifications',        href: '/study' },
      { label: 'Study Planner',             href: '/study', new: true },
      { label: 'Free Courses',              href: '/courses', new: true },
    ],
  },
  {
    title: 'Practice',
    links: [
      { label: 'MCQ Question Banks',        href: '/practice-questions' },
      { label: 'Written Answer Practice',   href: '/practice-questions' },
      { label: 'Mock Exams',                href: '/mock-exams' },
      { label: 'Past Papers',               href: '/practice-questions' },
      { label: 'Case Studies',              href: '/practice-questions' },
      { label: 'All Practice',              href: '/practice-questions' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Accounting Glossary',       href: '/glossary' },
      { label: 'Accounting Dictionary',      href: '/dictionary' },
      { label: 'Ask a Question',            href: '/get-help' },
      { label: 'Community Forums',          href: '/get-help' },
      { label: 'Exam Tips',                 href: '/study' },
      { label: 'Podcast',                   href: '/about' },
      { label: 'Blog & Articles',           href: '/articles' },
      { label: 'Free Calculators',          href: '/calculators' },
    ],
  },

  {
    title: 'Company',
    links: [
      { label: 'About Us',                  href: '/about' },
      { label: 'Contact',                   href: '/contact' },
      { label: 'Advertise',                 href: '/contact' },
      { label: 'Partnerships',              href: '/contact' },
      { label: 'Careers',                   href: '/about' },
      { label: 'Press',                     href: '/about' },
    ],
  },
]

const socialLinks = [
  {
    label: 'LinkedIn',
    href:  '/contact',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
  {
    label: 'X (Twitter)',
    href:  '/contact',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href:  '/contact',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href:  '/contact',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
]

const legalLinks = [
  { label: 'Privacy Policy',    href: '/privacy-policy' },
  { label: 'Terms of Service',  href: '/terms' },
  { label: 'Cookie Policy',     href: '/cookie-policy' },
  { label: 'Disclaimer',        href: '/disclaimer' },
  { label: 'Accessibility',     href: '/accessibility' },
]

const stats = [
  { value: '3,000+',   label: 'Articles' },
  { value: '20,000+',  label: 'Practice Questions' },
  { value: 'Since 2018', label: 'Trusted Platform' },
  { value: 'Free',      label: 'To Start' },
]

// ── Email Signup Widget ───────────────────────────────────────────────────────
function EmailSignup({ isEthioTax }: { isEthioTax: boolean }) {
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [honeypot, setHoneypot] = useState('')
  const turnstileWidgetId = React.useRef<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setStatus('loading')
    try {
      await fetch('/api/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, _h: honeypot, 'cf-turnstile-response': (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement)?.value ?? '' }),
      })
      setStatus('success')
      setEmail('')
      if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
        Stay Updated
      </p>
      <h3 className="font-display text-white text-lg mb-1.5">
        {isEthioTax ? 'EthioTax community updates' : 'Free exam tips & study notes'}
      </h3>
      <p className="text-sm text-white/60 mb-4 leading-relaxed">
        {isEthioTax
          ? 'Tax deadlines, ERCA updates and Ethiopian business insights. No spam, ever.'
          : 'Weekly study tips, exam technique guides, and new question releases. No spam, unsubscribe any time.'}
      </p>

      {status === 'success' ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-teal-500/20 border border-teal-500/30">
          <svg className="w-4 h-4 text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-teal-300 font-medium">You&apos;re subscribed!</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2" noValidate>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full h-14 px-4 rounded-lg text-base bg-white/10 border border-white/30 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all" style={{ fontSize: "16px", WebkitAppearance: "none" }}
              required
              autoComplete="email"
            />
            {/* Honeypot — hidden from real users, bots fill it */}
            <input type="text" value={honeypot} onChange={e => setHoneypot(e.target.value)} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true"
              disabled={status === 'loading'}
            />
            <button
              type="submit"
              disabled={status === 'loading' || !email}
              className="h-14 px-4 rounded-lg text-sm font-semibold bg-gold-500 text-navy-950 hover:bg-gold-400 disabled:opacity-50 transition-colors shadow-gold whitespace-nowrap w-full sm:w-auto"
            >
              {status === 'loading' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : 'Subscribe'}
            </button>
          </div>
          {status === 'error' && (
            <p className="text-xs text-red-400">Something went wrong. Please try again.</p>
          )}
          <p className="text-xs text-white/35">
            By subscribing you agree to our{' '}
            <Link href="/privacy-policy" className="underline hover:text-white/60">Privacy Policy</Link>.
          </p>
        </form>
      )}
    </div>
  )
}

// ── External link icon ────────────────────────────────────────────────────────
function ExtIcon() {
  return (
    <svg className="w-3 h-3 inline-block ml-0.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

// ── Main Footer ───────────────────────────────────────────────────────────────
export function Footer() {
  const [isEthioTax, setIsEthioTax] = React.useState(false)

  const companyColumn: FooterColumn = isEthioTax ? {
    title: 'Company',
    links: [
      { label: 'About EthioTax', href: '/about-ethiotax' },
      { label: 'How It Works',   href: '/how-it-works' },
      { label: 'FAQ',            href: '/faq' },
      { label: 'Contact',        href: '/contact' },
    ],
  } : footerColumns[footerColumns.length - 1]

    const professionalsColumn: FooterColumn = {
    title: 'Professionals',
    links: [
      { label: isEthioTax ? 'Get Professional Help' : 'Find an Accountant', href: isEthioTax ? '/get-help' : '/firms-freelancers/directory' },
      { label: isEthioTax ? 'Join as a Provider' : 'List Your Firm',        href: isEthioTax ? '/firms-freelancers' : '/firms-freelancers/join' },
      { label: 'Post a Job',                href: '/hire-talent/post-a-job' },
      { label: 'Freelancer Directory',      href: '/firms-freelancers/directory' },
      { label: 'CPD Resources',             href: '/firms-freelancers' },
    ],
  }
  useEffect(() => {
    setIsEthioTax(window.location.hostname.includes('ethiotax.com'))
  }, [])
  return (
    <footer className="bg-navy-950 text-white" aria-label="Site footer">

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/10">
        <div className="container-wide py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(stat => (
              <div key={stat.label} className="flex flex-col items-start">
                <span className="font-display text-2xl text-white leading-none mb-1">
                  {stat.value}
                </span>
                <span className="text-xs text-white/50 font-medium">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main footer body ──────────────────────────────────────────────── */}
      <div className="container-wide py-14">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-10 lg:gap-8">

          {/* ── Brand column ────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Logo */}
            <Link href="/" id="et-footer-logo" className="inline-flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded">
              {isEthioTax ? (
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 2L4 8v8c0 7 5.4 13.5 12 15.5C22.6 29.5 28 23 28 16V8L16 2z" fill="#C9982A"/>
                  <path d="M16 7l-2.5 5-5.5.8 4 3.9-.95 5.5L16 19.5l4.95 2.7-.95-5.5 4-3.9-5.5-.8z" fill="#1A4731"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0"  y="0"  width="9" height="20" fill="#ffffff"/>
                  <rect x="11" y="0"  width="9" height="9"  fill="#ffffff"/>
                  <rect x="11" y="11" width="9" height="9"  fill="#ffffff"/>
                </svg>
              )}
              <span className="font-sans font-semibold" style={{ color: '#ffffff', fontSize: '21px', lineHeight: '24px' }}>{isEthioTax ? <>EthioTax<sup style={{ fontSize: '20px', verticalAlign: 'top', position: 'relative', top: '4px' }}>®</sup></> : <>Accounting Body<sup style={{ fontSize: '20px', verticalAlign: 'top', position: 'relative', top: '4px' }}>®</sup></>}</span>
            </Link>

            <p className="text-sm text-white/55 leading-relaxed max-w-xs">
              {isEthioTax
                ? 'EthioTax delivers professional accounting, tax, audit, payroll and business consulting to the Ethiopian community worldwide. Qualified professionals. Amharic and Afaan Oromoo service available.'
                : 'Everything you need for accounting and finance in one place. Study notes, practice questions, and professional connections for ACCA, CIMA, ICAEW and AAT.'}
            </p>

            {/* Email signup */}
            <EmailSignup isEthioTax={isEthioTax} />

            {/* Social links */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Follow Us
              </p>
              <div className="flex items-center gap-1.5">
                {socialLinks.map(social => (
                  <Link
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all duration-150"
                  >
                    {social.icon}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── Link columns ────────────────────────────────────────────── */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
            {[...footerColumns.slice(0,3), professionalsColumn, companyColumn].map(column => (
              <div key={column.title}>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                  {column.title}
                </h4>
                <ul className="space-y-2.5">
                  {column.links.map(link => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors duration-150"
                      >
                        {link.label}
                        {link.external && <ExtIcon />}
                        {link.badge && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
                            {link.badge}
                          </span>
                        )}
                        {link.new && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 border border-gold-500/30">
                            New
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ── Legal bar ─────────────────────────────────────────────────────── */}
      <div className="border-t border-white/10">
        <div className="container-wide py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs text-white/35">
                © {new Date().getFullYear()} AccountingBody Ltd. All rights reserved.{' '}
                Registered in England &amp; Wales.
              </p>
              <p className="text-xs text-white/25">
                AccountingBody is an independent educational resource. Not affiliated with,
                endorsed by, or authorised by ACCA, CIMA, AAT, ICAEW, or any other
                professional body. All qualification names are trademarks of their respective owners.
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0" aria-label="Legal navigation">
              {legalLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs text-white/35 hover:text-white/70 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

    </footer>
  )
}

export default Footer
