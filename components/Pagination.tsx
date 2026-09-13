'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { computePageItems, nextPageTarget, parseJumpToPage, prevPageTarget } from './pagination'

// The one pagination control for every public paginated list on the site
// (currently /jobs/listings and /practice-questions — both AB and ET serve
// the same build) so none of them can drift into separately-coded
// implementations again.
//
// Two navigation modes, chosen by which prop the caller passes:
//   - `onChange(page)`: for a client-fetched list (jobs/listings) that
//     changes the URL itself and re-fetches — this component holds no page
//     state of its own, `onChange` is the only way it ever asks for a
//     different page, and it's the caller's job to turn that into a URL
//     change (see JobListingsClient.navigateToState).
//   - `hrefFor(page) => string`: for a server-rendered list (practice
//     questions) where each page is a real, crawlable URL. Previous, Next
//     and every page number render as real <Link> anchors built from that
//     function — never a button pretending to navigate — and the
//     jump-to-page input performs a client-side `router.push(hrefFor(n))`
//     on submit, since typing a target page isn't knowable in advance as a
//     plain href the way Previous/Next/page-numbers are.
// Exactly one of the two must be passed; only that one mode's rendering
// path is used, so the two can't get out of sync with each other.
//
// IMPORTANT — this component is always 'use client', but its caller is
// often a Server Component (practice-questions/page.tsx). A Server
// Component can render a Client Component, but it can only pass that
// Client Component SERIALIZABLE props — a plain closure like
// `p => buildUrl({ page: p })` is not serializable, and passing one
// directly from a Server Component throws at request time (this exact
// mistake shipped once and produced a 500 on /practice-questions — see the
// revert of the first version of this commit, and
// PracticeQuestionsPagination.tsx for the fix: a small Client Component
// wrapper that receives plain data and builds the `hrefFor` closure
// itself, entirely on the client side, before handing it to <Pagination>).
//
// Local state stays limited to two purely transient, never-navigated-yet
// things: the jump-to-page input's text, and (see below) the hover flag
// used for ET's label-colour protection.

// ── ET label-visibility defence (Previous / Next / Go only) ────────────────
// The operator inspected ethiotax.com/jobs/listings in DevTools after the
// first rebuild: the <nav>, its classes, sizing and layout all apply
// correctly, and every OTHER piece of text on the same nav — the context
// line, the compact "Page X of Y", and the ZAR salaries elsewhere on the
// page — renders fine. Only the label text inside these three specific
// controls is invisible; they show up as solid dark-green blocks. That
// rules out a broad text-rewriting or layout failure. It leaves two
// candidate causes in the ethiotax-worker (a separate, unreadable repo):
// either an injected rule sets `button { color }` to the same value as the
// background it also injects, or the worker's text-node rewrite empties
// text nodes that are direct children of a <button>. We can't read that
// worker to find out which, so this defends against both at once:
//   1. every visible label lives in its own <span>, never a bare text node
//      inside the control — a `button { color }` rule only reaches a bare
//      child by inheritance; a span with its own colour breaks that chain.
//   2. that span's colour is set via inline `style`, not a Tailwind class.
//      Inline styles win over any injected stylesheet rule that doesn't
//      use !important, regardless of that rule's selector or specificity —
//      a class-based colour, however specific, is still just another
//      stylesheet rule the worker's injected one could equal or outrank.
//      Do NOT "tidy" this back into a className — that removes the one
//      thing keeping these three labels legible on ethiotax.com.
//   3. the chevron/Go icons get the same inline-style protection on their
//      own stroke/fill, and never use currentColor — currentColor would
//      just reintroduce the inheritance hole from point 1 one level down.
//   4. Go gets a solid triangle glyph, not a chevron, so it stays visually
//      distinct from Previous/Next by shape even if all label text on the
//      page were somehow lost.
const NAVY = '#0C1A3D'
const WHITE = '#FFFFFF'
const DISABLED_TEXT = '#b0ac9f' // slate-400 in this repo's warm-slate scale

function controlLabelColor(hovered: boolean, disabled: boolean): string {
  if (disabled) return DISABLED_TEXT
  return hovered ? WHITE : NAVY
}

function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
      style={{ stroke: color }}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"
      style={{ stroke: color }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}

// Deliberately a solid triangle, not a chevron — Go must stay
// distinguishable from Previous/Next by shape alone, not just by label.
function GoIcon({ color }: { color: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0"
      style={{ fill: color }}>
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  )
}

// Previous and Next share this exact class string in both navigation modes
// — the only difference between the two is which side the chevron sits on
// and their label/aria-label text — so their footprint is identical by
// construction rather than by eyeballing two separately-tuned widths.
// min-w-[44px] is the icon-only footprint below 640px; sm:min-w-[124px] is
// the with-label footprint above it. Height is 44px (h-11) at every
// breakpoint, meeting the 44x44 touch-target minimum on its own.
//
// No text-colour classes here on purpose — colour for anything that reads
// as a label lives on that label's own inline style (see above), not on
// the control itself. Background/border are unaffected by the ET
// investigation (the operator's screenshot shows those apply correctly)
// and stay as ordinary Tailwind classes.
const NAV_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-[124px] h-11 px-3 rounded-lg ' +
  'border-2 border-navy-950 bg-white text-sm font-semibold transition-colors ' +
  'hover:bg-navy-950 ' +
  'disabled:pointer-events-none disabled:border-slate-200 disabled:bg-slate-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500'

// `target` is the page Previous/Next would go to, or null at a boundary
// (see prevPageTarget/nextPageTarget). In onChange mode that null just
// disables the button. In hrefFor mode there is no real destination to
// link to, so a null target renders a plain, non-interactive placeholder
// with the exact same classes rather than an <a> pointing nowhere — links
// must always be real, crawlable destinations, never decorative.
function NavButton({
  direction,
  target,
  onChange,
  hrefFor,
}: {
  direction: 'prev' | 'next'
  target: number | null
  onChange?: (page: number) => void
  hrefFor?: (page: number) => string
}) {
  const [hovered, setHovered] = useState(false)
  const disabled = target === null
  const color = controlLabelColor(hovered, disabled)
  const label = direction === 'prev' ? 'Previous' : 'Next'
  const icon = direction === 'prev' ? <ChevronLeftIcon color={color} /> : <ChevronRightIcon color={color} />
  const hoverProps = { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }
  const content = (
    <>
      {direction === 'prev' && icon}
      <span className="hidden sm:inline" style={{ color }}>{label}</span>
      {direction === 'next' && icon}
    </>
  )

  if (hrefFor) {
    if (disabled) {
      return <span aria-disabled="true" className={NAV_BUTTON_CLASS}>{content}</span>
    }
    return (
      <Link href={hrefFor(target)} aria-label={`${label} page`} className={NAV_BUTTON_CLASS} {...hoverProps}>
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => target !== null && onChange?.(target)}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={`${label} page`}
      className={NAV_BUTTON_CLASS}
      {...hoverProps}
    >
      {content}
    </button>
  )
}

const PAGE_BUTTON_BASE =
  'min-w-[44px] h-11 px-2 rounded-lg text-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500'

// The current page is never marked by colour alone: it also gets a solid
// fill (vs. the others' outline), a heavier weight, and a visibly thicker
// border — a shape difference that survives both a colourblind viewer and,
// defensively, an external stylesheet that overrides colours but not the
// underlying classes/attributes. aria-current="page" carries the same
// signal to assistive tech independent of any of that styling.
//
// These stay class-based (not inline) deliberately — the operator's
// DevTools check found the page-number buttons rendering correctly on ET;
// the invisible-text failure is specific to Previous/Next/Go, so only
// those three get the heavier inline-style defence above.
function pageButtonClass(isCurrent: boolean): string {
  return isCurrent
    ? `${PAGE_BUTTON_BASE} bg-navy-950 border-2 border-navy-950 text-white font-bold`
    : `${PAGE_BUTTON_BASE} bg-white border border-slate-200 text-navy-700 font-medium hover:bg-slate-100`
}

// The current page number is still a real link in hrefFor mode (a
// self-link) rather than a bare span — harmless, and it's what the
// practice-questions page already did for every page number before this
// component existed.
function PageNumberControl({
  pageNumber,
  isCurrent,
  onChange,
  hrefFor,
}: {
  pageNumber: number
  isCurrent: boolean
  onChange?: (page: number) => void
  hrefFor?: (page: number) => string
}) {
  const className = pageButtonClass(isCurrent)
  const ariaCurrent = isCurrent ? 'page' : undefined
  const ariaLabel = `Page ${pageNumber}`

  if (hrefFor) {
    return (
      <Link href={hrefFor(pageNumber)} aria-current={ariaCurrent} aria-label={ariaLabel} className={className}>
        {pageNumber}
      </Link>
    )
  }
  return (
    <button type="button" onClick={() => onChange?.(pageNumber)} aria-current={ariaCurrent} aria-label={ariaLabel} className={className}>
      {pageNumber}
    </button>
  )
}

function GoButton() {
  const [hovered, setHovered] = useState(false)
  const color = controlLabelColor(hovered, false)
  return (
    <button
      type="submit"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Go to page"
      className="min-w-[44px] h-11 px-4 rounded-lg border-2 border-navy-950 bg-white text-sm font-semibold transition-colors hover:bg-navy-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500 inline-flex items-center justify-center gap-1.5"
    >
      <span style={{ color }}>Go</span>
      <GoIcon color={color} />
    </button>
  )
}

type PaginationBaseProps = {
  page: number
  totalPages: number
  total: number
  /** aria-label for the <nav> — describe what's being paginated. */
  navLabel?: string
  /** Singular noun for the context line ("job" -> "1 job" / "2 jobs"). */
  itemLabel?: string
}

type PaginationProps = PaginationBaseProps &
  (
    | { onChange: (page: number) => void; hrefFor?: undefined }
    | { hrefFor: (page: number) => string; onChange?: undefined }
  )

export function Pagination({
  page,
  totalPages,
  total,
  navLabel = 'Results pages',
  itemLabel = 'result',
  onChange,
  hrefFor,
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState('')
  const router = useRouter()
  const jumpInputId = useId()

  if (totalPages <= 1) return null

  const items = computePageItems(page, totalPages)
  const prevTarget = prevPageTarget(page)
  const nextTarget = nextPageTarget(page, totalPages)

  function submitJump() {
    const target = parseJumpToPage(jumpValue, totalPages)
    // Garbage input (letters, decimals, empty) is silently ignored rather
    // than treated as "go to page 1" — see pagination.ts. A real
    // out-of-range integer is never ignored; parseJumpToPage has already
    // clamped it into [1, totalPages] by the time it gets here, so this
    // never navigates outside that range.
    if (target === null) return
    if (onChange) onChange(target)
    else if (hrefFor) router.push(hrefFor(target))
    setJumpValue('')
  }

  return (
    <nav aria-label={navLabel} className="mt-10">
      {/* Context line — what makes a few hundred pages feel navigable
          rather than endless. Always visible, at every breakpoint. */}
      <p className="text-center text-xs text-slate-400 mb-3">
        Page {page.toLocaleString()} of {totalPages.toLocaleString()} · {total.toLocaleString()} {itemLabel}{total === 1 ? '' : 's'}
      </p>

      <div className="flex items-center justify-center gap-2">
        <NavButton direction="prev" target={prevTarget} onChange={onChange} hrefFor={hrefFor} />

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
              <PageNumberControl
                key={item}
                pageNumber={item}
                isCurrent={item === page}
                onChange={onChange}
                hrefFor={hrefFor}
              />
            )
          )}
        </div>

        <NavButton direction="next" target={nextTarget} onChange={onChange} hrefFor={hrefFor} />
      </div>

      {/* Jump to page. A real <form> — jobs/listings already uses <form>
          for its job-alert email capture, so that's the established
          pattern here rather than a bare onClick/onKeyDown pairing.
          Submits on Enter (native form behaviour) as well as via the Go
          button. In hrefFor mode this is the one control that can't be a
          plain <a> — the target page isn't known until the user types it —
          so it does a client-side router.push(hrefFor(n)) instead. */}
      <form
        onSubmit={e => { e.preventDefault(); submitJump() }}
        className="flex items-center justify-center gap-2 mt-4"
      >
        <label htmlFor={jumpInputId} className="text-xs font-medium text-slate-500">
          Jump to page
        </label>
        <input
          id={jumpInputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={e => setJumpValue(e.target.value)}
          placeholder={String(page)}
          className="w-20 h-11 px-2 rounded-lg border border-slate-200 text-sm text-navy-950 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500"
        />
        <GoButton />
      </form>
    </nav>
  )
}
