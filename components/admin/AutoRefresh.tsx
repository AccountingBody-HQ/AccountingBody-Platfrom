'use client'

import { useEffect } from 'react'

export default function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload()
    }, intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])

  return null
}
