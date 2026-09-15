'use client'

import { useEffect, useRef, useState } from 'react'
import type { Job } from '@/lib/jobs'
import { ApplyButton } from './ApplyButton'

// The only other client-rendered piece of this page besides ApplyButton,
// BackToListingsLink and ShareButton — same reasoning: page.tsx stays a
// Server Component, so anything needing state or a browser API (here,
// IntersectionObserver) has to live in its own small boundary.
//
// Both the inline apply button and the sticky mobile bar are rendered from
// this one component — not two separate instances wired together — because
// that's the only way for them to share the single "is the inline button
// visible" boolean without lifting state into page.tsx itself. The sticky
// bar is `position: fixed`, so it renders correctly regardless of where in
// this component's JSX it sits; it doesn't need to be a DOM sibling of the
// element it's tracking.
export function ApplyBarWithSticky({ job }: { job: Job }) {
  const inlineRef = useRef<HTMLDivElement>(null)
  // Hidden until the observer actually reports the inline button as
  // out of view — never defaults to visible. A bar that flashes on first
  // paint and then disappears once the observer catches up is worse than
  // no bar at all.
  const [showSticky, setShowSticky] = useState(false)

  useEffect(() => {
    const el = inlineRef.current
    if (!el) return
    // No IntersectionObserver support: stay hidden rather than guess.
    // The inline button is always present in the page, so nothing is lost.
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={inlineRef} className="mt-10 max-w-[62ch]">
        <ApplyButton job={job} />
      </div>

      {/* Sticky mobile apply bar — below 768px only, and only while the
          inline button above is out of view, so the two are never on
          screen at once. */}
      <div
        aria-hidden={!showSticky}
        className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t border-slate-200 p-3 shadow-[0_-6px_20px_-4px_rgba(12,26,61,0.12)] transition-[opacity,transform] duration-150 motion-reduce:transition-none ${
          showSticky
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-full pointer-events-none'
        }`}
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <ApplyButton job={job} size="compact" />
      </div>
    </>
  )
}
