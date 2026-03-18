// components/layout/NewsTicker.tsx
// AccountingBody Design System — News Ticker
// TV-style scrolling ticker for site-wide news, exam dates, updates
// Position: fixed top-0, height = var(--ticker-height, 40px)

'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TickerItem {
  id:        string
  text:      string
  href?:     string
  tag?:      string
  tagColor?: 'navy' | 'gold' | 'teal' | 'crimson'
  external?: boolean
}

interface NewsTickerProps {
  items?:        TickerItem[]
  speed?:        number
  pauseOnHover?: boolean
  label?:        string
  className?:    string
}

// ── Default ticker items ───────────────────────────────────────────────────────

const defaultItems: TickerItem[] = [
  {
    id:       '1',
    text:     'ACCA March 2025 exam results now available — check your results portal',
    tag:      'ACCA',
    tagColor: 'navy',
    href:     '/study/acca/results',
  },
  {
    id:       '2',
    text:     'New: CIMA 2025 Operational Case Study practice materials now live',
    tag:      'New',
    tagColor: 'teal',
    href:     '/study/cima/ocs',
  },
  {
    id:       '3',
    text:     'AAT Level 3 Synoptic Assessment updated for AQ2022 — download free study notes',
    tag:      'AAT',
    tagColor: 'teal',
    href:     '/study/aat/level-3',
  },
  {
    id:       '4',
    text:     'Tax year end 5 April 2025 — key dates and deadlines for accountants',
    tag:      'Tax',
    tagColor: 'gold',
    href:     '/articles/tax-year-end-2025',
  },
  {
    id:       '5',
    text:     'ACCA June 2025 exam entry deadline: 15 April — book your exams now',
    tag:      'Exam Date',
    tagColor: 'crimson',
    href:     'https://myacca.acca.global',
    external: true,
  },
  {
    id:       '6',
    text:     '50,000+ practice questions now live across all qualifications — try free',
    tag:      'New',
    tagColor: 'teal',
    href:     '/practice',
  },
  {
    id:       '7',
    text:     'ICAEW ACA Business Planning: Taxation — new written scenario questions added',
    tag:      'ACA',
    tagColor: 'navy',
    href:     '/study/aca/bpt',
  },
  {
    id:       '8',
    text:     'Self-assessment tax return deadline: 31 January 2026 — start your preparation',
    tag:      'Tax',
    tagColor: 'gold',
    href:     '/articles/self-assessment-guide',
  },
]

// ── Tag colour styles ──────────────────────────────────────────────────────────
const tagStyles: Record<NonNullable<TickerItem['tagColor']>, string> = {
  navy:    'bg-white/15 text-white border-white/20',
  gold:    'bg-gold-500  text-navy-950  border-gold-400',
  teal:    'bg-teal-500  text-white     border-teal-400',
  crimson: 'bg-crimson-500 text-white   border-crimson-400',
}

// ── Separator ──────────────────────────────────────────────────────────────────
function Separator() {
  return (
    <span className="inline-block w-1 h-1 rounded-full bg-white/30 mx-5 align-middle" />
  )
}

// ── Ticker Item render ─────────────────────────────────────────────────────────
function TickerItemEl({ item }: { item: TickerItem }) {
  const tag = item.tag && item.tagColor
    ? (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border mr-2 leading-none ${tagStyles[item.tagColor]}`}>
        {item.tag}
      </span>
    )
    : item.tag
    ? (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border mr-2 leading-none bg-white/15 text-white border-white/20">
        {item.tag}
      </span>
    )
    : null

  const content = (
    <span className="inline-flex items-center">
      {tag}
      <span className="text-xs text-white/85 leading-none">{item.text}</span>
    </span>
  )

  if (item.href) {
    return (
      <Link
        href={item.href}
        target={item.external ? '_blank' : undefined}
        rel={item.external ? 'noopener noreferrer' : undefined}
        className="hover:text-white transition-colors duration-150 cursor-pointer"
      >
        {content}
      </Link>
    )
  }

  return <span>{content}</span>
}

// ── Main NewsTicker ───────────────────────────────────────────────────────────
export function NewsTicker({
  items        = defaultItems,
  speed        = 60,
  pauseOnHover = true,
  label        = 'Latest',
  className    = '',
}: NewsTickerProps) {
  const [paused,    setPaused]    = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const displayItems  = [...items, ...items]
  const contentSpeed  = Math.max(speed, items.length * 6)

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('ticker-dismissed')
    if (wasDismissed) setDismissed(true)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('ticker-dismissed', 'true')
  }

  if (dismissed) return null

  return (
    <div
      className={[
        'fixed top-0 left-0 right-0 z-ticker',
        'bg-navy-950 border-b border-white/10',
        'flex items-center overflow-hidden',
        'select-none',
        className,
      ].join(' ')}
      style={{ height: 'var(--ticker-height, 40px)' }}
      role="marquee"
      aria-label="Latest updates"
      aria-live="off"
    >
      {/* Label badge */}
      <div
        className="shrink-0 flex items-center h-full pl-3 pr-4 border-r border-white/10 z-10"
        style={{ background: 'linear-gradient(135deg, #1a2e5a, #0C1A3D)' }}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-70" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-gold-400" />
          </span>
          <span className="text-xs font-bold text-white uppercase tracking-widest whitespace-nowrap">
            {label}
          </span>
        </div>
      </div>

      {/* Scrolling track */}
      <div
        className="flex-1 overflow-hidden relative"
        onMouseEnter={() => pauseOnHover && setPaused(true)}
        onMouseLeave={() => pauseOnHover && setPaused(false)}
        onTouchStart={() => pauseOnHover && setPaused(true)}
        onTouchEnd={() => pauseOnHover && setPaused(false)}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, #0C1A3D, transparent)' }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, #0C1A3D, transparent)' }}
        />

        <div
          ref={trackRef}
          className="flex items-center whitespace-nowrap"
          style={{
            animation:          `ticker ${contentSpeed}s linear infinite`,
            animationPlayState: paused ? 'paused' : 'running',
            paddingLeft:        '2rem',
          }}
        >
          {displayItems.map((item, index) => (
            <span key={`${item.id}-${index}`} className="inline-flex items-center">
              <TickerItemEl item={item} />
              <Separator />
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 flex items-center gap-0 border-l border-white/10">
        <button
          onClick={() => setPaused(p => !p)}
          className="w-8 h-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
          aria-label={paused ? 'Resume ticker' : 'Pause ticker'}
        >
          {paused ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          )}
        </button>

        <button
          onClick={handleDismiss}
          className="w-8 h-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
          aria-label="Dismiss ticker"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Static ticker variant ─────────────────────────────────────────────────────
interface StaticTickerProps {
  message:      string
  tag?:         string
  href?:        string
  variant?:     'navy' | 'gold' | 'teal'
  dismissible?: boolean
}

export function StaticTicker({
  message,
  tag,
  href,
  variant     = 'navy',
  dismissible = true,
}: StaticTickerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const variantStyles = {
    navy: 'bg-navy-950 text-white border-white/10',
    gold: 'bg-gold-500 text-navy-950 border-gold-400',
    teal: 'bg-teal-600 text-white border-teal-500',
  }

  const content = (
    <div className="flex items-center gap-2 justify-center">
      {tag && (
        <span className={`text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
          variant === 'gold' ? 'bg-navy-950/15 text-navy-950' : 'bg-white/20 text-white'
        }`}>
          {tag}
        </span>
      )}
      <span className={`text-xs font-medium ${variant === 'gold' ? 'text-navy-900' : 'text-white/90'}`}>
        {message}
      </span>
      {href && (
        <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      )}
    </div>
  )

  return (
    <div
      className={[
        'fixed top-0 left-0 right-0 z-ticker border-b',
        'flex items-center justify-center px-10',
        variantStyles[variant],
      ].join(' ')}
      style={{ height: 'var(--ticker-height, 40px)' }}
      role="banner"
    >
      {href ? (
        <Link href={href} className="flex-1 flex items-center justify-center">
          {content}
        </Link>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          {content}
        </div>
      )}
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className={`absolute right-3 w-7 h-7 flex items-center justify-center rounded opacity-50 hover:opacity-100 transition-opacity ${
            variant === 'gold' ? 'text-navy-950 hover:bg-navy-950/10' : 'text-white hover:bg-white/10'
          }`}
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default NewsTicker
