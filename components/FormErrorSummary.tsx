'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export const ERROR_SUMMARY_TEXT = 'Please correct the highlighted fields below.'

// One-line error summary for per-field forms (A11-F6, A11-F5 follow-up).
// - The visible line is shown only while the form has field errors; `hidden` keeps it out of the layout
//   (and out of Tailwind space-y spacing) at rest. It has no role, so it is never read twice.
// - The announcement comes from one empty, visually hidden alert that is in the page from load (rendered
//   into document.body, outside the form's flow). On every failed attempt it is cleared and then set again,
//   so screen readers announce the first failure and every repeat.
// Focus still moves to the first invalid field (lib/form-a11y.ts useFocusFirstInvalid).
export default function FormErrorSummary({ show, attempt, className = '' }: { show: boolean; attempt: number; className?: string }) {
  const [mounted, setMounted] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setMessage('')
    if (!show || attempt === 0) return
    const t = window.setTimeout(() => setMessage(ERROR_SUMMARY_TEXT), 100)
    return () => window.clearTimeout(t)
  }, [show, attempt])

  return (
    <>
      <p hidden={!show} className={`text-red-700 text-sm ${className}`.trim()}>
        {ERROR_SUMMARY_TEXT}
      </p>
      {mounted && createPortal(
        <div role="alert" className="sr-only">{message}</div>,
        document.body,
      )}
    </>
  )
}
