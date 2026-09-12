'use client'

import { useId, useState } from 'react'

// The only other client-rendered piece of this page besides ApplyButton and
// BackToListingsLink — same reasoning: a Server Component element can't own
// an onClick.

function ShareIcon() {
  return (
    <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  )
}

// Falls back to the deprecated execCommand path when navigator.clipboard is
// missing entirely — insecure (non-HTTPS/non-localhost) origins and some
// older or embedded browsers don't expose the Clipboard API at all, which
// is a different failure than the modern API existing but its promise
// rejecting (denied permission, etc). Both paths funnel into this one
// boolean so the caller has a single success/failure result to react to.
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  // Off-screen but still focusable/selectable — execCommand('copy') only
  // acts on an actual text selection, so the element must be a real,
  // visible-to-the-DOM node, just not visible to the user.
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(textarea)
  return ok
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Falls through to the legacy path — writeText rejects on insecure
      // origins and when the permission is denied, even though the API
      // itself exists.
    }
  }
  return legacyCopy(text)
}

type Status = 'idle' | 'copied' | 'error'

export function ShareButton({ url, jobTitle, brandColor }: { url: string; jobTitle: string; brandColor: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const statusId = useId()

  async function handleClick() {
    const ok = await copyToClipboard(url)
    setStatus(ok ? 'copied' : 'error')
    setTimeout(() => setStatus('idle'), 2000)
  }

  const label = status === 'copied' ? 'Copied!' : status === 'error' ? "Couldn't copy" : 'Share'
  // A visually hidden live region carries the same message to screen
  // readers — the visible label swap alone conveys success/failure by
  // text, but nothing announces the change to someone not looking at the
  // button when it happens.
  const announcement =
    status === 'copied'
      ? 'Link copied to clipboard'
      : status === 'error'
        ? 'Could not copy the link. You can copy it from the address bar instead.'
        : ''

  return (
    <div className="shrink-0">
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Copy link to ${jobTitle}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold transition-colors hover:bg-slate-50"
        style={{ color: brandColor }}
      >
        <ShareIcon />
        <span>{label}</span>
      </button>
      <span id={statusId} role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
