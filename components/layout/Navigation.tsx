// components/layout/Navigation.tsx
// AccountingBody Design System — Main Navigation
// Six sections: Get Help | Study | Practice Questions | Hire Talent | Firms and Freelancers | Global Payroll
// Sticky, responsive, with mega-menu dropdowns and mobile drawer

'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavLink {
  label: string
  href: string
  badge?: string
  description?: string
  external?: boolean
}

interface NavSection {
  id:          string
  label:       string
  href?:       string      // Direct link (no dropdown)
  external?:   boolean
  featured?:   NavLink     // Featured article/page in mega-menu
  groups?:     { title: string; links: NavLink[] }[]
  cta?:        { label: string; href: string; description: string }
}

// ── Nav data ──────────────────────────────────────────────────────────────────

const navSections: NavSection[] = [
  {
    id:    'get-help',
    label: 'Get Help',
    groups: [
      {
        title: 'Free Resources',
        links: [
          { label: 'Accounting Glossary',     href: '/glossary',              description: '1,200+ accounting terms defined' },
          { label: 'Ask a Question',           href: '/ask',                   description: 'Post your accounting question' },
          { label: 'Study Forums',             href: '/forums',                description: 'Community discussion boards' },
          { label: 'Exam Tips & Guides',       href: '/exam-tips',             description: 'Pass rate improving strategies' },
          { label: 'Podcast',                  href: '/podcast',               description: 'Accounting in Plain English' },
        ],
      },
      {
        title: 'Quick Tools',
        links: [
          { label: 'Salary & Tax Calculator',  href: '/tools/salary-calculator' },
          { label: 'Depreciation Calculator',  href: '/tools/depreciation' },
          { label: 'Break-Even Calculator',    href: '/tools/break-even' },
          { label: 'Ratio Calculator',         href: '/tools/ratios' },
        ],
      },
    ],
    cta: {
      label:       'Browse All Resources →',
      href:        '/resources',
      description: 'Everything you need in one place',
    },
  },

  {
    id:    'study',
    label: 'Study',
    groups: [
      {
        title: 'By Qualification',
        links: [
          { label: 'ACCA',  href: '/study/acca',  badge: 'Popular', description: 'All 13 ACCA papers covered' },
          { label: 'CIMA',  href: '/study/cima',                     description: 'Certificate to Strategic level' },
          { label: 'AAT',   href: '/study/aat',                      description: 'Level 2, 3 and 4 coverage' },
          { label: 'ICAEW / ACA', href: '/study/aca',                description: 'ACA qualification pathway' },
          { label: 'ATT / CTA', href: '/study/att-cta',              description: 'Tax specialist qualifications' },
          { label: 'CIPFA', href: '/study/cipfa',                    description: 'Public sector accounting' },
        ],
      },
      {
        title: 'By Subject',
        links: [
          { label: 'Financial Reporting',    href: '/subjects/financial-reporting' },
          { label: 'Taxation',               href: '/subjects/taxation' },
          { label: 'Audit & Assurance',      href: '/subjects/audit' },
          { label: 'Management Accounting',  href: '/subjects/management-accounting' },
          { label: 'Corporate Finance',      href: '/subjects/corporate-finance' },
          { label: 'Business Law',           href: '/subjects/business-law' },
        ],
      },
    ],
    featured: {
      label:       'ACCA Study Hub',
      href:        '/study/acca',
      description: 'Complete ACCA study notes, question banks, and past papers for all 13 exams. Updated for 2025.',
    },
  },

  {
    id:    'practice',
    label: 'Practice Questions',
    groups: [
      {
        title: 'Question Types',
        links: [
          { label: 'MCQ Question Banks',    href: '/practice/mcq',       badge: 'New',    description: '50,000+ exam-style MCQs' },
          { label: 'Written Answer Tasks',  href: '/practice/writing',                    description: 'Constructed response practice' },
          { label: 'Case Studies',          href: '/practice/scenarios',                  description: 'Professional scenario questions' },
          { label: 'Mock Examinations',     href: '/practice/mock-exams',                 description: 'Full timed mock exams' },
          { label: 'Past Paper Archive',    href: '/practice/past-papers',                description: 'Official past papers with answers' },
        ],
      },
      {
        title: 'By Difficulty',
        links: [
          { label: 'Beginner Practice',     href: '/practice/level/easy' },
          { label: 'Intermediate',          href: '/practice/level/medium' },
          { label: 'Hard Questions',        href: '/practice/level/hard' },
          { label: 'Exam Standard',         href: '/practice/level/exam-standard' },
        ],
      },
    ],
    cta: {
      label:       'Start Practising Free →',
      href:        '/practice',
      description: 'No account required',
    },
  },

  {
    id:    'hire-talent',
    label: 'Hire Talent',
    groups: [
      {
        title: 'Find Professionals',
        links: [
          { label: 'Find an Accountant',   href: '/hire/accountants',    description: 'Qualified accountants for hire' },
          { label: 'Find a Bookkeeper',    href: '/hire/bookkeepers',    description: 'Expert bookkeeping services' },
          { label: 'Find a Tax Adviser',   href: '/hire/tax-advisers',   description: 'Personal and business tax' },
          { label: 'Find an Auditor',      href: '/hire/auditors',       description: 'Statutory and internal audit' },
          { label: 'Finance Recruitment',  href: '/hire/recruitment',    description: 'Permanent and contract roles' },
        ],
      },
      {
        title: 'For Employers',
        links: [
          { label: 'Post a Job',            href: '/hire/post-job' },
          { label: 'Browse CVs',            href: '/hire/cvs' },
          { label: 'Employer of Record',    href: 'https://globalpayrollexpert.com/eor', external: true },
        ],
      },
    ],
  },

  {
    id:    'firms',
    label: 'Firms & Freelancers',
    groups: [
      {
        title: 'For Firms',
        links: [
          { label: 'List Your Firm',        href: '/firms/list',          description: 'Get found by new clients' },
          { label: 'Firm Directory',        href: '/firms/directory',     description: 'Browse accounting firms' },
          { label: 'CPD Resources',         href: '/firms/cpd',           description: 'Continuing professional development' },
          { label: 'Staff Training',        href: '/firms/training',      description: 'Team learning solutions' },
        ],
      },
      {
        title: 'For Freelancers',
        links: [
          { label: 'Create Your Profile',   href: '/freelancers/signup' },
          { label: 'Find Work',             href: '/freelancers/jobs' },
          { label: 'Freelance Resources',   href: '/freelancers/resources' },
          { label: 'Rate Calculator',       href: '/freelancers/rate-calculator' },
        ],
      },
    ],
    cta: {
      label:       'List Your Practice Free →',
      href:        '/firms/list',
      description: 'Join 3,000+ accounting professionals',
    },
  },

  {
    id:       'global-payroll',
    label:    'Global Payroll',
    href:     'https://globalpayrollexpert.com',
    external: true,
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function ExternalIcon() {
  return (
    <svg className="w-3 h-3 inline-block ml-1 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ── Mega-menu dropdown ────────────────────────────────────────────────────────
function MegaMenu({ section, onClose }: { section: NavSection; onClose: () => void }) {
  const hasFeatured = Boolean(section.featured)
  const colCount = section.groups?.length ?? 0

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 animate-slide-down"
      style={{ minWidth: hasFeatured ? '680px' : colCount >= 2 ? '560px' : '280px' }}
    >
      {/* Pointer arrow */}
      <div className="w-full flex justify-center -mb-1">
        <div className="w-3 h-3 rotate-45 bg-white border-l border-t border-slate-200 relative z-10" />
      </div>

      <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        <div className={`flex ${hasFeatured ? '' : ''}`}>
          {/* Featured panel */}
          {section.featured && (
            <div className="w-56 bg-gradient-navy p-5 flex flex-col justify-between shrink-0">
              <div>
                <p className="text-2xs font-semibold text-gold-400 uppercase tracking-widest mb-2">Featured</p>
                <h4 className="font-display text-white text-lg leading-snug mb-2">{section.featured.label}</h4>
                <p className="text-xs text-white/60 leading-relaxed">{section.featured.description}</p>
              </div>
              <Link
                href={section.featured.href}
                onClick={onClose}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400 hover:text-gold-300 transition-colors"
              >
                Explore
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          )}

          {/* Link groups */}
          <div className="flex-1 p-5">
            <div className={`grid gap-6 ${colCount >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {section.groups?.map(group => (
                <div key={group.title}>
                  <p className="text-2xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                    {group.title}
                  </p>
                  <ul className="space-y-0.5">
                    {group.links.map(link => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          onClick={onClose}
                          className="group/link flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors duration-100"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-navy-950 group-hover/link:text-navy-700">
                                {link.label}
                              </span>
                              {link.badge && (
                                <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                  {link.badge}
                                </span>
                              )}
                              {link.external && <ExternalIcon />}
                            </span>
                            {link.description && (
                              <span className="text-xs text-slate-400 mt-0.5 block leading-tight">
                                {link.description}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* CTA bar */}
            {section.cta && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">{section.cta.description}</p>
                <Link
                  href={section.cta.href}
                  onClick={onClose}
                  className="text-xs font-semibold text-navy-700 hover:text-gold-500 transition-colors whitespace-nowrap"
                >
                  {section.cta.label}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mobile nav ────────────────────────────────────────────────────────────────
function MobileMenu({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-navy-950/50 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[88vw] max-w-sm bg-white z-50 flex flex-col
          shadow-2xl transition-transform duration-300 ease-decelerate lg:hidden
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <Link href="/" onClick={onClose}>
            <span className="font-display text-xl text-navy-950">AccountingBody</span>
          </Link>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navSections.map(section => {
            const isExpanded = expandedSection === section.id
            const hasDropdown = Boolean(section.groups?.length)

            if (!hasDropdown && section.href) {
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  target={section.external ? '_blank' : undefined}
                  rel={section.external ? 'noopener noreferrer' : undefined}
                  onClick={onClose}
                  className={`flex items-center gap-2 w-full text-left px-5 py-3.5 text-sm font-medium transition-colors hover:bg-slate-50 ${
                    section.id === 'global-payroll'
                      ? 'text-gold-600 border-t border-slate-100 mt-1'
                      : 'text-navy-950'
                  }`}
                >
                  {section.label}
                  {section.external && <ExternalIcon />}
                </Link>
              )
            }

            return (
              <div key={section.id} className="border-b border-slate-100 last:border-none">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="flex items-center justify-between w-full px-5 py-3.5 text-sm font-medium text-navy-950 hover:bg-slate-50 transition-colors"
                  aria-expanded={isExpanded}
                >
                  {section.label}
                  <ChevronDown open={isExpanded} />
                </button>

                {isExpanded && (
                  <div className="bg-slate-50 border-t border-slate-100 py-2 animate-slide-down">
                    {section.groups?.map(group => (
                      <div key={group.title} className="mb-3">
                        <p className="px-5 py-1.5 text-2xs font-semibold text-slate-400 uppercase tracking-widest">
                          {group.title}
                        </p>
                        {group.links.map(link => (
                          <Link
                            key={link.href}
                            href={link.href}
                            target={link.external ? '_blank' : undefined}
                            rel={link.external ? 'noopener noreferrer' : undefined}
                            onClick={onClose}
                            className="flex items-center gap-2 px-5 py-2 text-sm text-slate-700 hover:text-navy-950 hover:bg-slate-100 transition-colors"
                          >
                            {link.label}
                            {link.badge && (
                              <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
                                {link.badge}
                              </span>
                            )}
                            {link.external && <ExternalIcon />}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Mobile CTAs */}
        <div className="p-5 border-t border-slate-200 space-y-2">
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center justify-center h-10 px-4 rounded-lg text-sm font-semibold text-navy-950 border border-slate-300 hover:border-navy-950 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            onClick={onClose}
            className="flex items-center justify-center h-10 px-4 rounded-lg text-sm font-semibold bg-navy-950 text-white hover:bg-navy-900 transition-colors"
          >
            Start free
          </Link>
        </div>
      </div>
    </>
  )
}

// ── Main Navigation ───────────────────────────────────────────────────────────

export function Navigation() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const pathname = usePathname()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on route change
  useEffect(() => {
    setActiveDropdown(null)
    setMobileOpen(false)
  }, [pathname])

  // Scroll detection for shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const handleMouseEnter = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setActiveDropdown(id)
  }

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setActiveDropdown(null), 120)
  }

  return (
    <>
      <header
        ref={navRef}
        className={`fixed top-[var(--ticker-height,40px)] left-0 right-0 z-nav bg-white transition-shadow duration-200 ${
          scrolled ? 'shadow-md' : 'border-b border-slate-200'
        }`}
        style={{ height: 'var(--nav-height, 64px)' }}
      >
        <div className="container-wide h-full flex items-center gap-6">

          {/* Logo */}
          <Link
  href="/"
  className="flex items-center gap-2 shrink-0 mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded"
  aria-label="AccountingBody home"
>
  {/* Brand logomark */}
<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="10" height="20" rx="2.5" fill="#003A9B"/>
  <rect x="14" y="0" width="10" height="10" rx="2.5" fill="#003A9B"/>
  <rect x="14" y="14" width="10" height="10" rx="2.5" fill="#003A9B"/>
</svg>
<span className="font-sans font-semibold hidden sm:block" style={{ color: '#003A9B', fontSize: '21px', lineHeight: '24px' }}>
  Accounting Body<sup style={{ fontSize: '20px', verticalAlign: 'top', position: 'relative', top: '4px' }}>®</sup>
</span>
</Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center flex-1 gap-0.5" aria-label="Main navigation">
            {navSections.map(section => {
              const isActive = activeDropdown === section.id
              const hasDropdown = Boolean(section.groups?.length)
              const isGlobalPayroll = section.id === 'global-payroll'

              if (!hasDropdown && section.href) {
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    target={section.external ? '_blank' : undefined}
                    rel={section.external ? 'noopener noreferrer' : undefined}
                    className={[
                      'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                      isGlobalPayroll
                        ? 'text-gold-600 hover:text-gold-500 hover:bg-gold-50 ml-1'
                        : 'text-navy-950 hover:text-navy-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {section.label}
                    {section.external && <ExternalIcon />}
                  </Link>
                )
              }

              return (
                <div
                  key={section.id}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(section.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    className={[
                      'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'text-navy-950 bg-slate-50'
                        : 'text-navy-950 hover:text-navy-700 hover:bg-slate-50',
                    ].join(' ')}
                    aria-expanded={isActive}
                    aria-haspopup="true"
                  >
                    {section.label}
                    <ChevronDown open={isActive} />
                  </button>

                  {isActive && (
                    <MegaMenu
                      section={section}
                      onClose={() => setActiveDropdown(null)}
                    />
                  )}
                </div>
              )
            })}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden lg:flex items-center gap-2 ml-auto shrink-0">
            {/* Search */}
            <button
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-navy-950 hover:bg-slate-100 transition-colors"
              aria-label="Search"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <Link
              href="/login"
              className="px-4 h-9 flex items-center text-sm font-medium text-navy-950 hover:text-navy-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="px-4 h-9 flex items-center text-sm font-semibold bg-navy-950 text-white rounded-lg hover:bg-navy-900 transition-colors shadow-sm hover:shadow-md"
            >
              Start free
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 ml-auto lg:hidden">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
    </>
  )
}

export default Navigation
