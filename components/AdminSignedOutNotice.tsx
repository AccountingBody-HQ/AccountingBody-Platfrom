'use client'
import { useEffect, useState } from 'react'
import { ADMIN_SIGNED_OUT_EVENT } from '@/lib/admin-fetch'
import { ADMIN_COLORS } from '@/lib/admin-theme'

type MessageProps = {
  loginHref: string
  onDismiss?: () => void
}

// The sign-in link opens a new tab so an unsaved form on this page is kept.
export function SignedOutMessage({ loginHref, onDismiss }: MessageProps) {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 32px)',
        padding: '12px 16px',
        borderRadius: 12,
        fontSize: 14,
        background: ADMIN_COLORS.card,
        color: ADMIN_COLORS.text,
        border: `1px solid ${ADMIN_COLORS.warning}`,
      }}
    >
      <span>You have been signed out, so your last action was not completed.</span>
      <a
        href={loginHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: ADMIN_COLORS.warning, fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        Sign in again in a new tab
      </a>
      <button
        type="button"
        onClick={onDismiss}
        style={{ color: ADMIN_COLORS.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        Dismiss
      </button>
    </div>
  )
}

export default function AdminSignedOutNotice({ loginHref }: { loginHref: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = () => setVisible(true)
    window.addEventListener(ADMIN_SIGNED_OUT_EVENT, show)
    return () => window.removeEventListener(ADMIN_SIGNED_OUT_EVENT, show)
  }, [])

  if (!visible) return null
  return <SignedOutMessage loginHref={loginHref} onDismiss={() => setVisible(false)} />
}
