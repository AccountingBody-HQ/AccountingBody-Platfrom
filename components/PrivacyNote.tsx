// components/PrivacyNote.tsx
// The short privacy note under the submit button of a public form (PRIV-4, owner decision D358).
// Brand-neutral and server-safe (no hooks, no handlers), so server and client forms can both use it.
// The default classes are the light-form small print (app/get-help/accounting-bookkeeping/page.tsx:363)
// and link (app/contact/ContactForm.tsx:374); a form on a dark background passes its own.

import Link from 'next/link'

export const PRIVACY_NOTE_TEXT = 'We use these details only to deal with your request. See our Privacy Policy.'

type Props = { className?: string; linkClassName?: string }

export default function PrivacyNote({
  className = 'text-xs text-slate-500 text-center',
  linkClassName = 'underline hover:text-navy-700 transition-colors',
}: Props) {
  return (
    <p className={className}>
      We use these details only to deal with your request. See our{' '}
      <Link href="/privacy-policy" className={linkClassName}>Privacy Policy</Link>.
    </p>
  )
}
