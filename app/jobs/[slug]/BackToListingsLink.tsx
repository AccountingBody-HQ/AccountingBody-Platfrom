'use client'

import { useRouter } from 'next/navigation'

// The only other client-rendered piece of this page besides ApplyButton —
// same reasoning: a Server Component element can't own an onClick.
//
// router.back() only makes sense if there's actually an in-app page behind
// this one to land on. document.referrer can't tell us that: it's fixed at
// whatever referred the browser to the *first* document this tab loaded,
// and Next's client-side <Link> transition from /jobs/listings to here
// never creates a new document, so it never updates — a user who arrived
// via Google, browsed listings, then clicked into a job still has
// document.referrer pointing at Google, not at us. history.length alone
// doesn't answer it either: it counts every entry in the tab, including
// ones from other sites if the tab was reused.
//
// Instead, JobListingsClient.tsx sets ab_visited_listings in
// sessionStorage the moment the user is actually on /jobs/listings this
// tab session — a signal we write ourselves rather than infer from a
// browser property that freezes at document-load time. history.length > 1
// stays as a second check specifically for the case sessionStorage can't
// distinguish: a new tab opened via middle-click inherits the opener's
// sessionStorage, so the flag can read '1' in a tab whose own history has
// nothing to go back to — router.back() there would silently no-op.
function canGoBackInApp(): boolean {
  try {
    return sessionStorage.getItem('ab_visited_listings') === '1' && window.history.length > 1
  } catch {
    return false
  }
}

export function BackToListingsLink({ brandColor }: { brandColor: string }) {
  const router = useRouter()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (canGoBackInApp()) router.back()
    else router.push('/jobs/listings')
  }

  return (
    <a
      href="/jobs/listings"
      onClick={handleClick}
      className="inline-flex items-center gap-2 text-sm font-semibold"
      style={{ color: brandColor }}
    >
      ← Back to all jobs
    </a>
  )
}
