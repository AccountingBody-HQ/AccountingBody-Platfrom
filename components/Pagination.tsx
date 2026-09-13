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
// revert of the first version of that commit, and
// PracticeQuestionsPagination.tsx for the fix: a small Client Component
// wrapper that receives plain data and builds the `hrefFor` closure
// itself, entirely on the client side, before handing it to <Pagination>).
//
// Local state stays limited to the jump-to-page input's transient,
// never-navigated-yet text.

// ── ET label-visibility bug — ACTUAL cause and fix ──────────────────────────
// A prior version of this file defended Previous/Next/Go by setting their
// label colour via inline `style`, reasoning that inline styles beat any
// injected *stylesheet* rule. That reasoning was correct — against the
// wrong mechanism. The operator's DevTools capture on live ethiotax.com
// settled it: our inline `style="color: rgb(12, 26, 61)"` (navy-950,
// #0C1A3D) was arriving in the DOM as `style="color: rgb(26, 71, 49)"` —
// #1A4731, EthioTax's own brand green. A stylesheet cannot rewrite the
// *value* of an element's own inline style attribute. Only JavaScript can.
// So the ethiotax-worker is walking the DOM after render and remapping our
// navy brand hex to its green wherever it finds it — on inline styles AND
// on class-driven computed colours alike — which is a fundamentally
// different threat than a CSS specificity fight, and inline styles are no
// defence against it at all.
//
// The decisive second observation is what points at the actual fix: on
// that same live nav, the current-page button (filled navy background,
// WHITE label) renders perfectly, and the disabled Previous button (slate
// greys throughout) also renders perfectly. Only navy-on-white outline
// controls failed. So the worker's substitution evidently targets the
// navy hex specifically and leaves white and slate alone — which is why
// Previous/Next/Go are filled navy buttons with an explicit WHITE label
// below, the same proven-safe pattern the current-page button already
// uses, rather than depending on navy for a label or icon anywhere here.
//
// White/slate are colours that happen not to be remapped TODAY, observed
// from one live page. This is a workaround for a defect in a repository we
// cannot read (AccountingBody-HQ/ethiotax-worker), not a fix for it. If
// that worker's substitution ever widens to include white (or slate), this
// breaks again silently — nothing here would detect that, since the
// failure is purely visual (correct DOM, correct classes, wrong rendered
// colour) and produces no error, no failed request, nothing a status-code
// check or this repo's tests could ever catch.
//
// The label colour is still set via inline `style`, not a Tailwind class,
// for the same layering reason as before (inline beats an injected
// *stylesheet* rule without !important) — that defence is still real, it
// was just defending against the wrong threat on its own. Belt and braces:
// inline style for the CSS-injection case, a colour outside the worker's
// observed JS substitution range for the DOM-rewrite case. DO NOT
// reintroduce navy (`#0C1A3D` / `navy-950` / `navy-700` / any shade named
// "navy") as a label or icon colour anywhere in this component — that is
// the one, single cause of the whole bug.
const WHITE = '#FFFFFF'
const DISABLED_TEXT = '#b0ac9f' // slate-400 in this repo's warm-slate scale — proven safe (the disabled button already used it)

function controlLabelColor(disabled: boolean): string {
  return disabled ? DISABLED_TEXT : WHITE
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
// Filled, not outline — a deliberate visual change on Accounting Body too,
// not an ET-only workaround: border-2 border-navy-950 stays in the base
// class purely so the disabled state (below) still has a border to
// recolour, invisible here since it matches the navy-950 fill exactly.
// hover:bg-navy-900/hover:border-navy-900 gives a real, visible hover
// state on the fill itself, rather than the old outline-to-fill hover
// transition — consistent height and radius, same focus ring as before.
const NAV_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-[124px] h-11 px-3 rounded-lg ' +
  'border-2 border-navy-950 bg-navy-950 text-sm font-semibold transition-colors ' +
  'hover:bg-navy-900 hover:border-navy-900 ' +
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
  const disabled = target === null
  const color = controlLabelColor(disabled)
  const label = direction === 'prev' ? 'Previous' : 'Next'
  const icon = direction === 'prev' ? <ChevronLeftIcon color={color} /> : <ChevronRightIcon color={color} />
  const content = (
    <>
      {direction === 'prev' && icon}
      <span className="hidden sm:inline" style={{ color }}>{label}</span>
      {direction === 'next' && icon}
    </>
  )

  if (hrefFor) {
    if (disabled) {
      // Same aria-label as the enabled Link/button below — without it,
      // below 640px this control has no accessible name at all: its only
      // visible content there is the aria-hidden icon (the label span is
      // `hidden` below that breakpoint, not just visually hidden).
      return <span aria-disabled="true" aria-label={`${label} page`} className={NAV_BUTTON_CLASS}>{content}</span>
    }
    return (
      <Link href={hrefFor(target)} aria-label={`${label} page`} className={NAV_BUTTON_CLASS}>
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
// The current-page fill+white-label combination is exactly the pattern
// proven safe on live ethiotax.com (see the top-of-file note) — left
// completely unchanged. Non-current numbers use `text-slate-800`, not any
// navy shade: the operator's evidence only implicates the exact navy-950
// hex, but page numbers previously used navy-700 (a different shade) with
// no live confirmation either way, so this moves them to the same "slate"
// family already proven safe rather than trusting an untested navy shade.
function pageButtonClass(isCurrent: boolean): string {
  return isCurrent
    ? `${PAGE_BUTTON_BASE} bg-navy-950 border-2 border-navy-950 text-white font-bold`
    : `${PAGE_BUTTON_BASE} bg-white border border-slate-200 text-slate-800 font-medium hover:bg-slate-100`
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
  const color = controlLabelColor(false)
  return (
    <button
      type="submit"
      aria-label="Go to page"
      className="min-w-[44px] h-11 px-4 rounded-lg border-2 border-navy-950 bg-navy-950 text-sm font-semibold transition-colors hover:bg-navy-900 hover:border-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold-500 inline-flex items-center justify-center gap-1.5"
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
