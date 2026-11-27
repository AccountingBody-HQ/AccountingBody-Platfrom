// components/VercelStatistics.tsx
// Vercel Web Analytics and Speed Insights (PRIV-3, owner decision D353 (2)): cookie-free statistics for
// every visitor, turned off by "Reject non-essential cookies". Nothing renders on the server or before
// mount, so a visitor who rejected never loads either script. After a Reject on an open page the
// components are removed and beforeSend drops every later event; the script already in the page stays.

'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { readConsent, subscribeConsent } from '@/lib/consent'

/** Statistics run unless the visitor chose "Reject non-essential cookies". */
export function statisticsAllowed(): boolean {
  return readConsent() !== 'declined'
}

/** beforeSend for both: drop the event once the visitor has rejected. */
export function dropWhenRejected<T>(event: T): T | null {
  return statisticsAllowed() ? event : null
}

export default function VercelStatistics() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(statisticsAllowed())
    return subscribeConsent((e) => {
      if (e === 'change') setOn(statisticsAllowed())
    })
  }, [])

  if (!on) return null
  return (
    <>
      <Analytics beforeSend={dropWhenRejected} />
      <SpeedInsights beforeSend={dropWhenRejected} />
    </>
  )
}
