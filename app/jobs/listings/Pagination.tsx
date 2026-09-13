'use client'

import { useState } from 'react'
import { computePageItems, parseJumpToPage } from './pagination'

// The one pagination control for /jobs/listings, shared by both hosts (AB
// and ET serve this same component through the same build) so the two
// cannot drift into two different implementations again.
//
// State stays URL-derived, same contract as the rest of this page:
// `onChange` is the only way this component ever changes the current page,
// and it's the caller's job (JobListingsClient.navigateToState) to turn
// that into a URL change that the fetch then reads back. This component
// holds no page state of its own — only the transient, never-navigated-yet
// text of the jump-to-page input.

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// Previous and Next share this exact class string — the only difference
// between the two buttons is which side the chevron sits on and their
// label/aria-label text — so their footprint is identical by construction
// rather than by eyeballing two separately-tuned widths. min-w-[44px] is
// the icon-only footprint below 640px; sm:min-w-[124px] is the
// with-label footprint above it. Height is 44px (h-11) at every breakpoint,
// meeting the 44x44 touch-target minimum on its own.
//
// Colours are set explicitly here (bg, border and text each named, never
// inherited or driven by a brand variable) — see the ET investigation notes
// in this component and in tmp-audit/p4-pagination.md for why: this page
// renders through EthioTax's Cloudflare proxy, which runs a separate CSS
// injector against the DOM, and the more independent-and-explicit each
// property is, the less surface there is for an external rule to collapse
// text and background onto the same value.
const NAV_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-[124px] h-11 px-3 rounded-lg ' +
  'border-2 border-navy-950 bg-white text-navy-950 text-sm font-semibold transition-colors ' +
  'hover:bg-navy-950 hover:text-white ' +
  'disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500'

const PAGE_BUTTON_BASE =
  'min-w-[44px] h-11 px-2 rounded-lg text-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500'

// The current page is never marked by colour alone: it also gets a solid
// fill (vs. the others' outline), a heavier weight, and a visibly thicker
// border — a shape difference that survives both a colourblind viewer and,
// defensively, an external stylesheet that overrides colours but not the
// underlying classes/attributes. aria-current="page" carries the same
// signal to assistive tech independent of any of that styling.
function pageButtonClass(isCurrent: boolean): string {
  return isCurrent
    ? `${PAGE_BUTTON_BASE} bg-navy-950 border-2 border-navy-950 text-white font-bold`
    : `${PAGE_BUTTON_BASE} bg-white border border-slate-200 text-navy-700 font-medium hover:bg-slate-100`
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}) {
  const [jumpValue, setJumpValue] = useState('')

  if (totalPages <= 1) return null

  const items = computePageItems(page, totalPages)
  const atFirst = page <= 1
  const atLast = page >= totalPages

  function submitJump() {
    const target = parseJumpToPage(jumpValue, totalPages)
    // Garbage input (letters, decimals, empty) is silently ignored rather
    // than treated as "go to page 1" — see pagination.ts. A real
    // out-of-range integer is never ignored; parseJumpToPage has already
    // clamped it into [1, totalPages] by the time it gets here, so onChange
    // is never called with an out-of-range page.
    if (target === null) return
    onChange(target)
    setJumpValue('')
  }

  return (
    <nav aria-label="Job results pages" className="mt-10">
      {/* Context line — what makes a few hundred pages feel navigable
          rather than endless. Always visible, at every breakpoint. */}
      <p className="text-center text-xs text-slate-400 mb-3">
        Page {page.toLocaleString()} of {totalPages.toLocaleString()} · {total.toLocaleString()} job{total === 1 ? '' : 's'}
      </p>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={atFirst}
          aria-disabled={atFirst}
          aria-label="Previous page"
          className={NAV_BUTTON_CLASS}
        >
          <ChevronLeftIcon />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Below 640px: a compact, non-interactive "Page X of Y" fills the
            middle slot instead of the full number row, which has no room
            to breathe at that width. Above 640px: the full windowed number
            row with ellipsis. */}
        <span className="sm:hidden text-sm font-semibold text-navy-950 px-2 whitespace-nowrap" aria-hidden="true">
          Page {page} of {totalPages}
        </span>

        <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-center">
          {items.map((item, i) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="w-6 text-center text-slate-400 text-sm select-none" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onChange(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${item}`}
                className={pageButtonClass(item === page)}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={atLast}
          aria-disabled={atLast}
          aria-label="Next page"
          className={NAV_BUTTON_CLASS}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon />
        </button>
      </div>

      {/* Jump to page. A real <form> — this file already uses <form> for
          the job-alert email capture, so that's the established pattern
          here rather than a bare onClick/onKeyDown pairing. Submits on
          Enter (native form behaviour) as well as via the Go button. */}
      <form
        onSubmit={e => { e.preventDefault(); submitJump() }}
        className="flex items-center justify-center gap-2 mt-4"
      >
        <label htmlFor="jobs-page-jump" className="text-xs font-medium text-slate-500">
          Jump to page
        </label>
        <input
          id="jobs-page-jump"
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={e => setJumpValue(e.target.value)}
          placeholder={String(page)}
          className="w-20 h-11 px-2 rounded-lg border border-slate-200 text-sm text-navy-950 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500"
        />
        <button
          type="submit"
          className="min-w-[44px] h-11 px-4 rounded-lg border-2 border-navy-950 bg-white text-navy-950 text-sm font-semibold transition-colors hover:bg-navy-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500"
        >
          Go
        </button>
      </form>
    </nav>
  )
}
