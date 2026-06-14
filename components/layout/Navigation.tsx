// components/layout/Navigation.tsx
// AccountingBody Design System — Main Navigation
// Five sections: Get Help | Study | Practice Questions | Hire Talent | Firms & Freelancers
// Sticky, responsive, with mega-menu dropdowns and mobile drawer

'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LanguageSwitcher, MobileLangSwitcher } from './LanguageSwitcher'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavLink {
  label:        string
  href:         string
  badge?:       string
  description?: string
  external?:    boolean
  noTranslate?: boolean
}

interface NavSection {
  id:        string
  label:     string
  href?:     string
  external?: boolean
  featured?: NavLink
  groups?:   { title: string; links: NavLink[] }[]
  cta?:      { label: string; href: string; description: string }
}

// ── Nav data ──────────────────────────────────────────────────────────────────

const navSections: NavSection[] = [
  {
    id:    'get-help',
    label: 'Get Help',
    href:  '/get-help',
    groups: [
      {
        title: 'Professional Services',
        links: [
          { label: 'Tax Advice',         href: '/get-help/tax-advice', description: 'Personal and business tax planning and compliance' },
          { label: 'Bookkeeping',        href: '/get-help/bookkeeping', description: 'Day-to-day financial records and reporting' },
          { label: 'Payroll',            href: '/get-help/payroll', description: 'Payroll processing and RTI submissions' },
          { label: 'Financial Planning', href: '/get-help/financial-planning', description: 'Forecasting and cash flow management' },
          { label: 'Audit',              href: '/get-help/audit', description: 'Statutory and voluntary audits' },
        ],
      },
      {
        title: 'More Services',
        links: [
          { label: 'Business Advisory',  href: '/get-help/business-advisory', description: 'Strategic advice to grow your business' },
          { label: 'Company Formation',  href: '/get-help/company-formation', description: 'Register your limited company correctly' },
          { label: 'VAT',                href: '/get-help/vat', description: 'VAT registration, returns and MTD compliance' },
          { label: 'Self Assessment',    href: '/get-help/self-assessment', description: 'Personal tax returns filed accurately' },
        ],
      },
    ],
    cta: {
      label:       'Find a Professional →',
      href:        '/get-help',
      description: 'Matched to a vetted expert within 24 hours',
    },
  },

  {
    id:    'global-payroll',
    label: 'Global Payroll',
    href:  '/global-payroll',
    groups: [
      {
        title: 'Entity & Setup',
        links: [
          { label: 'Entity Setup & Registration', href: '/global-payroll/entity-setup',            description: 'Incorporate and register in any jurisdiction' },
          { label: 'Payroll Advisory',            href: '/global-payroll/payroll-advisory',        description: 'Strategic advice for global payroll operations' },
        ],
      },
      {
        title: 'Payroll Services',
        links: [
          { label: 'Global Payroll Management',       href: '/global-payroll/global-payroll-management', description: 'End-to-end payroll across multiple countries' },
          { label: 'Multi-Country Payroll',           href: '/global-payroll/multi-country-payroll',     description: 'One engagement, multiple jurisdictions' },
          { label: 'Payroll Compliance & Reporting',  href: '/global-payroll/payroll-compliance',        description: 'Every filing, every deadline, every country' },
          { label: 'Employer of Record (EOR) Support',href: '/global-payroll/eor-support',               description: 'Local delivery partner for EOR providers' },
        ],
      },
    ],
    cta: {
      label:       'Submit a Global Payroll Brief →',
      href:        '/global-payroll',
      description: 'We cover 150+ countries — any jurisdiction welcome',
    },
  },

  {
    id:    'study',
    label: 'Study',
    href:  '/study',
    groups: [
      {
        title: 'By Qualification',
        links: [
          { label: 'ACCA',        href: '/study/acca',     badge: 'Popular', description: 'All 13 ACCA papers covered', noTranslate: true },
          { label: 'CIMA',        href: '/study/cima',                        description: 'Certificate to Strategic level', noTranslate: true },
          { label: 'AAT',         href: '/study/aat',                         description: 'Level 2, 3 and 4 coverage', noTranslate: true },
          { label: 'ICAEW / ACA', href: '/study/icaew',                         description: 'ACA qualification pathway', noTranslate: true },
        ],
      },
      {
        title: 'By Subject',
        links: [
          { label: 'Financial Accounting',   href: '/study/financial-accounting' },
          { label: 'Financial Management',   href: '/study/financial-management' },
          { label: 'Management Accounting',  href: '/study/management-accounting' },
          { label: 'Financial Market',       href: '/study/financial-market' },
          { label: 'Business Management',    href: '/study/business-management' },
          { label: 'Audit and Assurance',    href: '/study/audit-assurance' },
          { label: 'Tax',                    href: '/study/taxation' },
          { label: 'Economics',              href: '/study/economics' },
          { label: 'Mock Exams',             href: '/study/mock-exams' },
        ],
      },
      {
        title: 'Free Tools',
        links: [
          { label: 'Accounting Calculators', href: '/calculators', badge: 'New', description: '22 free calculators for students' },
        ],
      },
    ],
    featured: {
      label:       'ACCA Study Hub',
      href:        '/study/acca',
      description: 'Complete ACCA study notes, question banks, and past papers for all 13 exams.',
    },
  },

  {
    id:    'courses',
    label: 'Courses',
    href:  '/courses',
    groups: [
      {
        title: 'Free Courses',
        links: [
          { label: 'All Courses',             href: '/free-courses',               badge: 'New', description: 'All structured learning paths' },
          { label: 'Beginner Courses',         href: '/free-courses?level=beginner',          description: 'Start from the foundations' },
          { label: 'Intermediate Courses',     href: '/free-courses?level=intermediate',      description: 'Build on your knowledge' },
          { label: 'Advanced Courses',         href: '/free-courses?level=advanced',          description: 'Master complex topics' },
          { label: 'Professional Courses',     href: '/free-courses?level=professional',      description: 'Expert-level content' },
        ],
      },
    ],
    featured: {
      label:       'Free Accounting Courses',
      href:        '/courses',
      description: 'Structured learning paths assembled from expert study notes — developed by the Accounting Body Editorial Team. Always free.',
    },
  },
  {
    id:    'practice',
    label: 'Practice Questions',
    href:  '/practice-questions',
    groups: [
      {
        title: 'Question Types',
        links: [
          { label: 'MCQ Questions',     href: '/practice-questions?type=mcq',      badge: 'New', description: 'Multiple choice — 4 options, one correct answer' },
          { label: 'Scenario',          href: '/practice-questions?type=scenario',              description: 'Case-based questions with linked exhibit' },
          { label: 'Writing',           href: '/practice-questions?type=writing',               description: 'Constructed response with model answer' },
          { label: 'Mock Examinations', href: '/study/mock-exams',                              description: 'Full timed mock exams' },
        ],
      },
      {
        title: 'By Difficulty',
        links: [
          { label: 'All Questions',     href: '/practice-questions' },
          { label: 'Beginner',          href: '/practice-questions?difficulty=beginner' },
          { label: 'Intermediate',      href: '/practice-questions?difficulty=intermediate' },
          { label: 'Advanced',          href: '/practice-questions?difficulty=advanced' },
        ],
      },
    ],
    cta: {
      label:       'Start Practising Free →',
      href:        '/practice-questions',
      description: 'No account required',
    },
  },

  {
    id:    'firms',
    label: 'Firms & Freelancers',
    href:  '/firms-freelancers',
    groups: [
      {
        title: 'Join Our Network',
        links: [
          { label: 'Apply to Join',      href: '/firms-freelancers/join', description: 'Register your interest to join our verified professional network' },
          { label: 'How It Works',       href: '/firms-freelancers',      description: 'How we match professionals with clients' },
        ],
      },
      {
        title: 'Need Accounting Help?',
        links: [
          { label: 'Get Matched to an Expert', href: '/get-help', description: 'Submit a request and we will find the right professional for you' },
        ],
      },
    ],
    cta: {
      label:       'Apply to Join Our Network →',
      href:        '/firms-freelancers/join',
      description: 'Verified professionals only — we review every application',
    },
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
  const colCount    = section.groups?.length ?? 0

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
        <div className="flex">
          {/* Featured panel */}
          {section.featured && (
            <div className="w-56 bg-gradient-navy p-5 flex flex-col justify-between shrink-0">
              <div>
                <p className="text-xs font-semibold text-gold-400 uppercase tracking-widest mb-2">Featured</p>
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
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
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
                              <span className="text-sm font-medium text-navy-950 group-hover/link:text-navy-700" {...(link.noTranslate ? { translate: "no" } : {})}>
                                {link.label}
                              </span>
                              {link.badge && (
                                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
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
function MobileMenu({ open, onClose, onSearch, sections, isEthioTax }: { open: boolean; onClose: () => void; onSearch: () => void; sections: NavSection[]; isEthioTax?: boolean }) {
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
            <span className="font-display text-xl text-navy-950">Accounting Body</span>
          </Link>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Language switcher — ET only, below header */}
        {isEthioTax && <MobileLangSwitcher />}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map(section => {
            const isExpanded  = expandedSection === section.id
            const hasDropdown = Boolean(section.groups?.length)

            if (!hasDropdown && section.href) {
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  target={section.external ? '_blank' : undefined}
                  rel={section.external ? 'noopener noreferrer' : undefined}
                  onClick={onClose}
                  className="flex items-center gap-2 w-full text-left px-5 py-3.5 text-sm font-medium text-navy-950 transition-colors hover:bg-slate-50"
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
                        <p className="px-5 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">
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
                              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
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

        {/* Mobile footer — search */}
        <div className="border-t border-slate-200">
          <div className="p-5">
            <button
              onClick={() => { onSearch(); onClose() }}
              className="flex items-center justify-center gap-2 w-full h-10 px-4 rounded-lg text-sm font-semibold text-navy-950 border border-slate-300 hover:border-navy-950 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search the platform
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Navigation ───────────────────────────────────────────────────────────

export function Navigation({ studyQualificationLinks, etGetHelpLinks, etCompanyLinks }: { studyQualificationLinks?: NavLink[], etGetHelpLinks?: { groups: { title: string, links: NavLink[] }[], cta: { label: string, href: string, description: string } }, etCompanyLinks?: { groups: { title: string, links: NavLink[] }[], cta: { label: string, href: string, description: string } } }) {
  const etCompanySection: NavSection | null = etCompanyLinks ? {
    id: 'company',
    label: 'Company',
    href: '/about-ethiotax',
    groups: etCompanyLinks.groups,
    cta: etCompanyLinks.cta,
  } : null

  const sections = [
    ...navSections.filter(section => !(etGetHelpLinks && section.id === 'global-payroll')).map(section => {
      if (section.id === 'study') {
        const isET = Boolean(etGetHelpLinks)
        return {
          ...section,
          groups: section.groups?.map(group => {
            if (group.title === 'By Qualification' && studyQualificationLinks) {
              return { ...group, links: studyQualificationLinks }
            }
            if (group.title === 'By Subject') {
              return {
                ...group,
                links: group.links.map(link =>
                  link.label === 'Mock Exams'
                    ? { ...link, href: isET ? '/study/mock-exams' : '/practice-questions' }
                    : link
                ),
              }
            }
            return group
          }),
        }
      }
      if (section.id === 'get-help' && etGetHelpLinks) {
        return {
          ...section,
          groups: etGetHelpLinks.groups,
          cta: etGetHelpLinks.cta,
        }
      }
      if (section.id === 'practice') {
        const isET = Boolean(etGetHelpLinks)
        return {
          ...section,
          groups: section.groups?.map(group => {
            if (group.title !== 'Question Types') return group
            return {
              ...group,
              links: group.links.map(link =>
                link.label === 'Mock Examinations'
                  ? { ...link, href: isET ? '/study/mock-exams' : '/practice-questions', label: isET ? 'Mock Examinations' : 'All Practice Questions', description: isET ? 'Full timed mock exams' : 'Browse all practice question sets' }
                  : link
              ),
            }
          }),
        }
      }
      return section
    }),
    ...(etCompanySection ? [etCompanySection] : []),
  ]
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [scrolled,       setScrolled]       = useState(false)
  const navRef    = useRef<HTMLElement>(null)
  const pathname  = usePathname()
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setActiveDropdown(null)
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = searchQuery.trim()
    if (q.length < 1) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
    setSearchQuery('')
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearchSubmit()
    if (e.key === 'Escape') { setSearchQuery('') }
  }

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
        className={`fixed top-0 left-0 right-0 z-nav bg-white transition-shadow duration-200 ${
          scrolled ? 'shadow-md' : 'border-b border-slate-200'
        }`}
        style={{ height: 'var(--nav-height, 64px)' }}
      >
        <div className="container-wide h-full grid grid-cols-[auto_1fr_auto] items-center gap-6">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 rounded"
            aria-label="AccountingBody home"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <rect x="0"  y="0" width="9" height="20" rx="2" fill="#1e3a7a"/>
              <rect x="11" y="0" width="9" height="9"  rx="2" fill="#1e3a7a"/>
              <rect x="11" y="11" width="9" height="9" rx="2" fill="#1e3a7a"/>
            </svg>
            <span className="font-sans font-semibold hidden sm:block" style={{ color: '#1e3a7a', fontSize: '21px', lineHeight: '24px' }}>
              Accounting Body<sup style={{ fontSize: '20px', verticalAlign: 'top', position: 'relative', top: '4px' }}>®</sup>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center justify-center gap-0.5" aria-label="Main navigation">
            {sections.map(section => {
              const isActive      = activeDropdown === section.id
              const hasDropdown   = Boolean(section.groups?.length)
              const isCurrentPage = section.href
                ? (section.href === '/' ? pathname === '/' : pathname.startsWith(section.href))
                : false

              if (!hasDropdown && section.href) {
                return (
                  <Link
                    key={section.id}
                    href={section.href}
                    target={section.external ? '_blank' : undefined}
                    rel={section.external ? 'noopener noreferrer' : undefined}
                    className={[
                      'relative flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                      isCurrentPage
                        ? 'text-gold-600 font-semibold'
                        : 'text-navy-950 hover:text-navy-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {section.label}
                    {isCurrentPage && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gold-500 rounded-full" />
                    )}
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
                  <div className={[
                    'flex items-center rounded-lg transition-colors duration-150',
                    isActive ? 'bg-slate-50' : '',
                  ].join(' ')}>
                    <Link
                      href={section.href ?? '#'}
                      className={[
                        'relative flex items-center pl-3 pr-1 py-2 text-sm font-medium transition-colors duration-150',
                        isCurrentPage
                          ? 'text-gold-600 font-semibold'
                          : 'text-navy-950 hover:text-navy-700',
                      ].join(' ')}
                    >
                      {section.label}
                      {isCurrentPage && (
                        <span className="absolute bottom-0 left-3 right-1 h-0.5 bg-gold-500 rounded-full" />
                      )}
                    </Link>
                    <button
                      className="flex items-center pr-2 py-2 text-navy-950 hover:text-navy-700"
                      aria-expanded={isActive}
                      aria-haspopup="true"
                    >
                      <ChevronDown open={isActive} />
                    </button>
                  </div>

                  <div
                    style={{
                      visibility: isActive ? 'visible' : 'hidden',
                      opacity: isActive ? 1 : 0,
                      pointerEvents: isActive ? 'auto' : 'none',
                      transition: 'opacity 120ms ease, visibility 120ms ease',
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 50,
                    }}
                  >
                    <MegaMenu
                      section={section}
                      onClose={() => setActiveDropdown(null)}
                    />
                  </div>
                </div>
              )
            })}
          </nav>

          {/* Desktop right actions — search (always visible) */}
          <div className="hidden lg:flex items-center justify-end gap-3 shrink-0">
            {etGetHelpLinks && (
              <div className="flex items-center">
                <LanguageSwitcher />
              </div>
            )}
            <div className="w-px h-5 bg-slate-200" />
            <form onSubmit={handleSearchSubmit} className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search articles, questions, glossary…"
                autoComplete="off"
                className="h-9 w-72 pl-9 pr-4 rounded-lg border border-slate-200 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all bg-slate-50 hover:bg-white hover:border-slate-300 focus:bg-white"
                aria-label="Search AccountingBody"
              />
            </form>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 justify-end lg:hidden">
            <button
              onClick={() => router.push('/search')}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
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

      <MobileMenu
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onSearch={() => router.push('/search')}
        sections={sections}
        isEthioTax={Boolean(etGetHelpLinks)}
      />
    </>
  )
}

export default Navigation
